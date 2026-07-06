import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Play, Square, Send, Bot, FileText, Download, Check, AlertTriangle, Sparkles,
  MessageSquare, RefreshCw, BarChart2, CheckCircle2, ChevronRight, X, Edit2, Loader2, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';
import { useMeeting, useAgendaSubmissions, useDepartments, useUpdateMeeting } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { compileMeetingData, generateLiveDashboard, askMeetingChatbot, synthesizePostMeetingNotes } from '../../lib/ai';
import { runAutomatedDataIngestion } from '../../lib/ingestion';
import { emailService } from '../../lib/emailService';
import { PageHeader, Spinner, Modal } from '../../components/ui/index';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

export default function MeetingWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, profile } = useAuth();
  
  const { data: meeting, isLoading: loadingMeeting, refetch: refetchMeeting } = useMeeting(id);
  const { data: submissions = [], refetch: refetchSubmissions } = useAgendaSubmissions(id);
  const { data: departments = [] } = useDepartments();
  const updateMeeting = useUpdateMeeting();

  // State variables
  const [localSubmissions, setLocalSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  // ── Notes: isolated JSON object { admin: '...', CSE: '...', MECH: '...' } ────
  // Parse live_notes string from DB into object
  const parseNotesObject = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      if (raw.trim().startsWith('{')) return JSON.parse(raw);
    } catch {}
    // Legacy fallback: treat raw text as admin note
    return { admin: raw };
  };

  const [notesObj, setNotesObj] = useState({});
  const [notesViewTab, setNotesViewTab] = useState('mine'); // 'mine' | dept-code for admin viewing HOD notes
  const [isTypingNotes, setIsTypingNotes] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Meeting Copilot. I have analyzed all uploaded spreadsheets for this meeting. Ask me anything about the data (e.g. "which department has the highest pending fees?" or "what are the weak students counts?").' }
  ]);
  const [isThinkingChat, setIsThinkingChat] = useState(false);
  const [aiDashboard, setAiDashboard] = useState(null);
  const [isReanalyzingDashboard, setIsReanalyzingDashboard] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [concludedSummary, setConcludedSummary] = useState(null);
  
  // Spreadsheet Editing State
  const [editingCell, setEditingCell] = useState(null); // { subId, rowIndex, colName }
  const [editingValue, setEditingValue] = useState('');

  const typingTimeoutRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  const isAdminOrPrincipal = ['admin', 'principal', 'director'].includes(role);

  // Sync loaded submissions to local editable state
  useEffect(() => {
    if (submissions && submissions.length > 0) {
      setLocalSubmissions(submissions);
      if (!activeTab) {
        setActiveTab(submissions[0].id);
      }
    }
  }, [submissions]);

  // Load live notes and dashboard from meeting record
  useEffect(() => {
    if (meeting) {
      if (meeting.live_notes) {
        setNotesObj(parseNotesObject(meeting.live_notes));
      }
      if (meeting.ai_summary?.dashboard) {
        setAiDashboard(meeting.ai_summary.dashboard);
      }
    }
  }, [meeting]);

  // Supabase Realtime Channel Configuration
  useEffect(() => {
    if (!id) return;

    // Connect to meeting workspace channel
    const channelName = `meeting_workspace_${id}`;
    const channel = supabase.channel(channelName);
    realtimeChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'notes_update' }, (payload) => {
        if (payload.payload.senderId !== user.id) {
          const { noteKey, notes } = payload.payload;
          setNotesObj(prev => ({ ...prev, [noteKey]: notes }));
        }
      })
      .on('broadcast', { event: 'cell_update' }, (payload) => {
        const { subId, rowIndex, colName, value } = payload.payload;
        setLocalSubmissions(prev => prev.map(sub => {
          if (sub.id === subId) {
            const updatedData = [...sub.submitted_data];
            updatedData[rowIndex] = { ...updatedData[rowIndex], [colName]: value };
            return { ...sub, submitted_data: updatedData };
          }
          return sub;
        }));
      })
      .on('broadcast', { event: 'meeting_ended' }, (payload) => {
        toast.success('This meeting has been concluded by the administrator!');
        navigate(`/meetings/agendas/${id}`);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime workspace channel subscribed successfully.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user.id, navigate]);

  // Debounced database sync helper for notepad
  const syncNotesToDatabase = useCallback(async (updatedObj) => {
    try {
      await supabase
        .from('meetings')
        .update({ live_notes: JSON.stringify(updatedObj) })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to autosave notes:', err);
    }
  }, [id]);

  const saveNotesDebounced = useRef(
    debounce((updatedObj) => {
      syncNotesToDatabase(updatedObj);
    }, 1500)
  ).current;

  // Determine the note key for the current user
  const myNoteKey = isAdminOrPrincipal ? 'admin' : (profile?.department?.code || role || 'unknown');

  // Handle local notes typing and broadcast
  const handleNotesChange = (e) => {
    const value = e.target.value;
    const updated = { ...notesObj, [myNoteKey]: value };
    setNotesObj(updated);
    setIsTypingNotes(true);

    // Broadcast only this user's portion
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'notes_update',
        payload: { noteKey: myNoteKey, notes: value, senderId: user.id }
      });
    }

    // Debounced save
    saveNotesDebounced(updated);

    // Typing reset timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingNotes(false);
    }, 2000);
  };

  // Debounced database sync for cell changes
  const saveSubmissionToDatabase = useCallback(async (subId, data) => {
    try {
      await supabase
        .from('agenda_submissions')
        .update({ submitted_data: data, updated_at: new Date().toISOString() })
        .eq('id', subId);
    } catch (err) {
      console.error('Failed to autosave cell to database:', err);
    }
  }, []);

  const saveSubmissionDebounced = useRef(
    debounce((subId, data) => {
      saveSubmissionToDatabase(subId, data);
    }, 1000)
  ).current;

  // Cell Editing
  const startEditing = (subId, rowIndex, colName, currentValue) => {
    setEditingCell({ subId, rowIndex, colName });
    setEditingValue(currentValue || '');
  };

  const saveCellEdit = () => {
    if (!editingCell) return;

    const { subId, rowIndex, colName } = editingCell;
    const value = editingValue;

    // Update local state
    let targetSubmission = null;
    setLocalSubmissions(prev => prev.map(sub => {
      if (sub.id === subId) {
        const updatedData = [...sub.submitted_data];
        updatedData[rowIndex] = { ...updatedData[rowIndex], [colName]: value };
        targetSubmission = { ...sub, submitted_data: updatedData };
        
        // Save to database
        saveSubmissionDebounced(subId, updatedData);
        
        return targetSubmission;
      }
      return sub;
    }));

    // Broadcast to other users
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'cell_update',
        payload: { subId, rowIndex, colName, value }
      });
    }

    setEditingCell(null);
    toast.success('Cell updated and synced in real-time!', { duration: 1500 });
  };

  // AI Chatbot Interface
  const handleSendChatMessage = async () => {
    if (!chatQuestion.trim()) return;
    const question = chatQuestion;
    setChatQuestion('');

    const newHistory = [...chatHistory, { role: 'user', content: question }];
    setChatHistory(newHistory);
    setIsThinkingChat(true);

    try {
      const compiledText = compileMeetingData(localSubmissions, departments);
      const answer = await askMeetingChatbot(compiledText, chatHistory, question);
      setChatHistory(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      toast.error('Failed to get answer from AI copilot');
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'I encountered an error querying the AI NIM gateway. Please try again.' }]);
    } finally {
      setIsThinkingChat(false);
    }
  };

  // Re-run AI analytics dashboard
  const handleReanalyzeDashboard = async () => {
    setIsReanalyzingDashboard(true);
    try {
      const compiledText = compileMeetingData(localSubmissions, departments);
      const dashboard = await generateLiveDashboard(compiledText);
      setAiDashboard(dashboard);

      // Save to meeting table
      const updatedSummary = {
        ...(meeting.ai_summary || {}),
        dashboard
      };
      await supabase
        .from('meetings')
        .update({ ai_summary: updatedSummary })
        .eq('id', id);

      toast.success('AI Meeting Analytics Dashboard updated successfully!');
    } catch (err) {
      toast.error('Failed to regenerate dashboard');
    } finally {
      setIsReanalyzingDashboard(false);
    }
  };

  // Conclude Meeting Workflow (Admin Only)
  const handleConcludeMeeting = async () => {
    setIsEndingMeeting(true);
    try {
      const compiledText = compileMeetingData(localSubmissions, departments);
      
      // 1. Synthesize MOM notes using Minimax AI NIM – pass isolated notes JSON
      toast.loading('AI is generating executive MOM and department briefs...', { id: 'end-meeting' });
      const momSynthesis = await synthesizePostMeetingNotes(notesObj, compiledText);

      // 2. run post-meeting automated data ingestion
      toast.loading('Auto-ingesting Excel data into academic databases...', { id: 'end-meeting' });
      const ingestionResult = await runAutomatedDataIngestion(meeting, localSubmissions);

      // 3. Save everything in Supabase & set status to conducted
      const finalSummary = {
        ...(meeting.ai_summary || {}),
        adminNote: momSynthesis.adminNote,
        departmentBriefs: momSynthesis.departmentBriefs,
        ingestionLogs: ingestionResult.logs,
        recordsIngested: ingestionResult.recordsIngested
      };

      await supabase
        .from('meetings')
        .update({
          status: 'conducted',
          live_notes: JSON.stringify(notesObj),
          ai_summary: finalSummary,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      // 4. Send Notifications and HOD briefs to all active users
      toast.loading('Publishing MOM and notifying HODs...', { id: 'end-meeting' });
      const allBriefsKeys = Object.keys(momSynthesis.departmentBriefs || {});
      
      if (allBriefsKeys.length > 0) {
        // Fetch users matching department codes
        const { data: users = [] } = await supabase
          .from('users')
          .select('id, role, department:departments(code)');

        const notifPayloads = users
          .filter(u => u.department?.code && allBriefsKeys.includes(u.department.code))
          .map(u => ({
            user_id: u.id,
            title: `MOM Directives: ${meeting.agenda_title}`,
            message: `The meeting has concluded. Check your dashboard for actionable directives from the AI summary of notes.`,
            read_status: false,
            notification_type: 'meeting',
            priority: 'high',
            action_url: '/dashboard',
            created_at: new Date().toISOString()
          }));

        if (notifPayloads.length > 0) {
          await supabase.from('notifications').insert(notifPayloads);
        }
      }

      // 5. Broadcast to other active clients to kick them out
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'meeting_ended',
          payload: {}
        });
      }

      toast.dismiss('end-meeting');
      toast.success('Meeting concluded successfully and data ingested!');

      // 📧 Send email notifications (fire-and-forget)
      emailService.meetingConcludedAdmin(meeting, momSynthesis.adminNote);
      emailService.meetingConcludedDeptBriefs(meeting, momSynthesis.departmentBriefs);

      // Set concluded summary state to display success modal
      setConcludedSummary({
        momSynthesis,
        ingestionResult
      });
    } catch (err) {
      console.error(err);
      toast.dismiss('end-meeting');
      toast.error(err.message || 'Failed to conclude meeting');
    } finally {
      setIsEndingMeeting(false);
    }
  };

  // PDF Exporter for HOD / Admin summary
  const downloadMOMpdf = () => {
    if (!concludedSummary && !meeting?.ai_summary?.adminNote) {
      return toast.error('No MOM data found to export');
    }

    const doc = new jsPDF();
    const adminNote = concludedSummary?.momSynthesis?.adminNote || meeting.ai_summary?.adminNote || '';
    const briefs    = concludedSummary?.momSynthesis?.departmentBriefs || meeting.ai_summary?.departmentBriefs || {};

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // surface-800
    doc.text('Meeting Minutes of Meeting (MOM)', 20, 20);

    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Title: ${meeting.agenda_title}`, 20, 30);
    doc.text(`Concluded On: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 36);
    doc.text(`Venue: ${meeting.venue || 'Admin Hall'}`, 20, 42);

    doc.line(20, 48, 190, 48);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('1. Executive MOM Summary:', 20, 56);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(adminNote.replace(/[*#]/g, ''), 170);
    doc.text(splitSummary, 20, 64);

    let y = 70 + (splitSummary.length * 5);
    
    if (Object.keys(briefs).length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('2. Action Directives by Department:', 20, y);
      y += 8;

      Object.entries(briefs).forEach(([dept, text]) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(79, 70, 229); // indigo-600
        doc.text(`Department: ${dept}`, 20, y);
        y += 6;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        const splitText = doc.splitTextToSize(text.replace(/[*#]/g, ''), 165);
        doc.text(splitText, 25, y);
        y += (splitText.length * 4.5) + 6;
      });
    }

    doc.save(`${meeting.agenda_title.replace(/[^a-zA-Z0-9]/g, '_')}_MOM.pdf`);
    toast.success('MOM PDF document downloaded successfully!');
  };

  if (loadingMeeting) {
    return (
      <div className="page-wrapper min-h-[70vh] flex items-center justify-center">
        <Spinner size={48} />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="page-wrapper">
        <div className="alert-danger">Meeting details could not be found or loaded.</div>
      </div>
    );
  }

  const selectedSubmission = localSubmissions.find(s => s.id === activeTab);
  const schemaCols = meeting.agenda_template_id
    ? selectedSubmission?.agenda_template?.format_schema?.columns || []
    : [];

  return (
    <div className="page-wrapper max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* 1. Header Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-indigo-500 text-white text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full animate-pulse">
              Live Meeting Workspace
            </span>
            <span className="text-slate-400 text-xs font-semibold">• Real-Time Sync Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1 truncate">{meeting.agenda_title}</h1>
          <p className="text-slate-400 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Venue: <b>{meeting.venue}</b></span>
            <span>Date: <b>{new Date(meeting.meeting_date).toLocaleDateString()}</b></span>
            <span>Time: <b>{meeting.meeting_time || '10:00 AM'}</b></span>
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Link to={`/meetings/agendas/${id}`} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700">
            Exit Workspace
          </Link>
          {isAdminOrPrincipal && (
            <button
              onClick={() => setShowEndModal(true)}
              className="px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 border border-red-400 flex items-center gap-1.5"
            >
              <Square size={13} fill="white" /> End Meeting
            </button>
          )}
        </div>
      </div>

      {/* 2. Responsive Workspace Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Collaborative Pad and Editable Grid (Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* A. Collaborative Live Notepad */}
          <div className="card p-6 border border-slate-200 bg-white rounded-3xl relative shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileText size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Meeting Notepad</h3>
                  <p className="text-[10px] text-slate-400">
                    {isAdminOrPrincipal ? 'Admin notes — view HOD notes read-only' : 'Your notes — admin notes read-only'}
                  </p>
                </div>
              </div>
              
              {isTypingNotes ? (
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Saving...
                </span>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Synced</span>
              )}
            </div>

            {/* Admin: tabs to switch between own notes and each HOD's read-only notes */}
            {isAdminOrPrincipal && (
              <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 mb-3">
                <button
                  onClick={() => setNotesViewTab('mine')}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                    notesViewTab === 'mine'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  My Notes (Admin)
                </button>
                {Object.keys(notesObj).filter(k => k !== 'admin').map(deptCode => (
                  <button
                    key={deptCode}
                    onClick={() => setNotesViewTab(deptCode)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      notesViewTab === deptCode
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {deptCode} (read-only)
                  </button>
                ))}
              </div>
            )}

            {/* HOD: tabs - own notes and read-only admin */}
            {!isAdminOrPrincipal && (
              <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 mb-3">
                <button
                  onClick={() => setNotesViewTab('mine')}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                    notesViewTab === 'mine'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  My Notes
                </button>
                {notesObj['admin'] !== undefined && (
                  <button
                    onClick={() => setNotesViewTab('admin')}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      notesViewTab === 'admin'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Admin Notes (read-only)
                  </button>
                )}
              </div>
            )}

            {/* Editable textarea for own notes */}
            {notesViewTab === 'mine' ? (
              <textarea
                value={notesObj[myNoteKey] || ''}
                onChange={handleNotesChange}
                placeholder="Take your own meeting notes here. Your notes are private until the meeting ends and AI synthesizes them."
                rows={8}
                className="w-full border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-xs leading-relaxed font-normal bg-slate-50/40 rounded-2xl p-4 shadow-inner"
              />
            ) : (
              /* Read-only view of another participant's notes */
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[190px] text-xs leading-relaxed text-slate-600 font-normal overflow-y-auto shadow-inner">
                {notesObj[notesViewTab]
                  ? <pre className="whitespace-pre-wrap font-sans">{notesObj[notesViewTab]}</pre>
                  : <span className="text-slate-400 italic">No notes written yet for this participant.</span>
                }
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 bg-slate-50 p-2 rounded-xl">
              <Sparkles size={12} className="text-indigo-500" />
              <span>All notes are synthesized by AI into a structured MOM Report when the meeting ends.</span>
            </div>
          </div>

          {/* B. Live Spreadsheet Editor */}
          {localSubmissions.length === 0 ? (
            <div className="card p-8 text-center bg-slate-50 border border-slate-150 rounded-3xl shadow-sm">
              <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
              <h4 className="text-xs font-bold text-slate-700">No Spreadsheet Submissions Linked</h4>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                Once departments upload Excel spreadsheets, they will render here as editable real-time synchronized grids.
              </p>
            </div>
          ) : (
            <div className="card p-6 border border-slate-200 bg-white rounded-3xl shadow-md overflow-hidden">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Live Operational Data Editor</h3>
                  <p className="text-[10px] text-slate-400">Double-click or click edit icon in any cell to change operational data in real-time</p>
                </div>
                
                {/* Department tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                  {localSubmissions.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setActiveTab(sub.id)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                        activeTab === sub.id
                          ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {sub.department?.code || 'DEPT'}
                    </button>
                  ))}
                </div>
              </div>

              {selectedSubmission && schemaCols.length > 0 ? (
                <div className="space-y-4">
                  {/* File info banner */}
                  <div className="bg-slate-50 px-4 py-2 border border-slate-100 rounded-xl flex items-center justify-between text-[10px] text-slate-600">
                    <span className="font-mono">Active Sheet: <b>{selectedSubmission.file_name}</b></span>
                    <span>Uploaded by: <b>{selectedSubmission.user?.full_name}</b></span>
                  </div>

                  {/* Grid table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-inner max-h-[360px] overflow-y-auto no-scrollbar">
                    <table className="w-full text-left text-[11px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50/80 sticky top-0 border-b border-slate-200 backdrop-blur z-10">
                          <th className="p-2.5 w-10 border-r border-slate-200 text-center font-bold text-slate-400">#</th>
                          {schemaCols.map((c, i) => (
                            <th key={i} className="p-2.5 border-r border-slate-250 font-bold text-slate-700 bg-slate-50 min-w-[120px]">
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedSubmission.submitted_data || []).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-100 hover:bg-indigo-50/10">
                            <td className="p-2.5 border-r border-slate-200 text-center text-slate-400 font-medium bg-slate-50/20">
                              {rIdx + 1}
                            </td>
                            {schemaCols.map((col, cIdx) => {
                              const isEditing = editingCell?.subId === selectedSubmission.id &&
                                                editingCell?.rowIndex === rIdx &&
                                                editingCell?.colName === col.name;
                              const cellValue = row[col.name] || '';

                              return (
                                <td
                                  key={cIdx}
                                  className="p-1 border-r border-slate-100 text-slate-700 min-w-[120px] transition-all relative group"
                                  onClick={() => !isEditing && startEditing(selectedSubmission.id, rIdx, col.name, cellValue)}
                                >
                                  {isEditing ? (
                                    <div className="flex items-center gap-1 w-full z-20 bg-white">
                                      <input
                                        type="text"
                                        value={editingValue}
                                        onChange={e => setEditingValue(e.target.value)}
                                        onBlur={saveCellEdit}
                                        onKeyDown={e => e.key === 'Enter' && saveCellEdit()}
                                        autoFocus
                                        className="w-full border-1 border-indigo-400 p-1 rounded text-[11px] h-7 focus:ring-0 focus:border-indigo-500"
                                      />
                                      <button onClick={saveCellEdit} className="p-1 text-emerald-600 bg-emerald-50 rounded">
                                        <Check size={11} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-1 w-full min-h-[22px] px-1.5 cursor-text">
                                      <span className="truncate">{cellValue || '—'}</span>
                                      <Edit2 size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">Select a department above to view operational data.</p>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: AI Copilot and Analytics Dashboard (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* C. Interactive AI Meeting Chatbot */}
          <div className="card p-6 border border-slate-200 bg-white rounded-3xl shadow-md flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
                  <Bot size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">AI Meeting Chatbot</h3>
                  <p className="text-[10px] text-slate-400">Contextual answers from uploaded files</p>
                </div>
              </div>
              
              <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                Nvidia NIM
              </span>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 mb-3 text-xs no-scrollbar">
              {chatHistory.map((chat, idx) => (
                <div
                  key={idx}
                  className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl leading-relaxed shadow-sm ${
                      chat.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}
                  >
                    {chat.content}
                  </div>
                </div>
              ))}
              {isThinkingChat && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 text-slate-400 border border-slate-150 px-3 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-indigo-600" /> Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                value={chatQuestion}
                onChange={e => setChatQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ask about attendance, fees, weak students..."
                className="flex-1 text-xs border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 rounded-xl"
              />
              <button
                type="button"
                onClick={handleSendChatMessage}
                disabled={isThinkingChat || !chatQuestion.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* D. Live AI Analytics Dashboard */}
          <div className="card p-6 border border-slate-200 bg-white rounded-3xl shadow-md space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <BarChart2 size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">AI Analytics Dashboard</h3>
                  <p className="text-[10px] text-slate-400">visual insights derived from documents</p>
                </div>
              </div>
              
              <button
                onClick={handleReanalyzeDashboard}
                disabled={isReanalyzingDashboard || localSubmissions.length === 0}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-transparent border-0 cursor-pointer disabled:opacity-50"
                title="Refresh AI Analysis"
              >
                <RefreshCw size={11} className={isReanalyzingDashboard ? 'animate-spin' : ''} /> Analyze Data
              </button>
            </div>

            {aiDashboard ? (
              <div className="space-y-6">
                {/* Executive Summary */}
                {aiDashboard.executiveSummary && (
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-[11px] text-slate-600 leading-relaxed">
                    <b className="text-slate-800 block mb-1">Executive Summary:</b>
                    {aiDashboard.executiveSummary}
                  </div>
                )}

                {/* KPIs Grid */}
                {aiDashboard.kpis && aiDashboard.kpis.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {aiDashboard.kpis.slice(0, 4).map((kpi, kIdx) => (
                      <div key={kIdx} className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm text-center">
                        <p className="text-[10px] text-slate-400 font-semibold truncate uppercase">{kpi.label}</p>
                        <p className="text-base font-black text-indigo-600 mt-1">{kpi.value}</p>
                        <span className="text-[8px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full inline-block mt-1 font-medium">{kpi.change}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visual Chart */}
                {aiDashboard.visuals && aiDashboard.visuals.length > 0 && (
                  <div className="space-y-4">
                    {aiDashboard.visuals.slice(0, 2).map((chart, cIdx) => (
                      <div key={cIdx} className="bg-slate-50/50 border border-slate-200/50 p-3 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-slate-700 mb-3 text-center">{chart.title}</h4>
                        
                        {chart.type === 'bar' && (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={chart.data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                              <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '10px' }} />
                              {chart.keys.map((key, keyIdx) => (
                                <Bar key={key} dataKey={key} fill={keyIdx === 0 ? '#6366f1' : '#10b981'} radius={[3, 3, 0, 0]} />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        )}

                        {chart.type === 'line' && (
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chart.data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                              <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '10px' }} />
                              {chart.keys.map((key, keyIdx) => (
                                <Line key={key} type="monotone" dataKey={key} stroke={keyIdx === 0 ? '#6366f1' : '#10b981'} strokeWidth={2} dot={{ r: 2 }} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        )}

                        {chart.type === 'pie' && (
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={chart.data}
                                dataKey={chart.keys[0]}
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                fill="#6366f1"
                                label={{ fontSize: 8 }}
                              >
                                {chart.data.map((entry, idx) => (
                                  <Cell key={`cell-${idx}`} fill={['#6366f1', '#10b981', '#f59e0b', '#3b82f6'][idx % 4]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '10px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Sparkles size={20} className="mx-auto mb-2 text-indigo-400" />
                Click "Analyze Data" above to synthesize and generate dynamic KPI widgets and recharts graphs.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 3. Conclude / End Meeting Confirmation Modal */}
      <Modal
        open={showEndModal}
        onClose={() => !isEndingMeeting && setShowEndModal(false)}
        title="Conclude Live HOD Meeting"
        footer={
          <>
            <button
              onClick={() => setShowEndModal(false)}
              disabled={isEndingMeeting}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleConcludeMeeting}
              disabled={isEndingMeeting}
              className="btn-danger text-xs flex items-center gap-1 bg-red-600 hover:bg-red-700"
            >
              {isEndingMeeting ? <Spinner size={12} className="border-t-white border-white/30" /> : <CheckCircle2 size={13} />}
              Confirm End Meeting
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="alert-warning text-xs">
            <AlertTriangle size={16} />
            Ending the meeting will instantly freeze real-time document editing and lock the collaborative notepad.
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            By concluding this meeting, the system will trigger the following automated governance workflows:
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-500 space-y-2">
            <li><b>AI MOM Synthesis</b>: Generates high-level executive summaries and department-specific briefs.</li>
            <li><b>Database Auto-Ingestion</b>: Extracts spreadsheet rows (Student Fees/Weak Students) and automatically categorizes/inserts them into dashboard tables.</li>
            <li><b>HOD Dashboard Push</b>: Directives and action items are pushed directly to each department’s calendar and HOD dashboard.</li>
          </ul>
        </div>
      </Modal>

      {/* 4. Concluded Summary / Success Modal */}
      <Modal
        open={!!concludedSummary}
        onClose={() => {
          setConcludedSummary(null);
          navigate(`/meetings/agendas/${id}`);
        }}
        title="Meeting Concluded Successfully! 🎉"
        footer={
          <button
            onClick={() => {
              setConcludedSummary(null);
              navigate(`/meetings/agendas/${id}`);
            }}
            className="btn-primary text-xs"
          >
            Go Back to Agenda Detail
          </button>
        }
      >
        <div className="space-y-5 text-xs leading-relaxed max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold">Automated Ingestion Engine: Success</h4>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                Ingested <b>{concludedSummary?.ingestionResult?.recordsIngested || 0} records</b> into the operational dashboard. All fee collection and weak student backlogs are updated.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-2">AI Executive Summary (MOM):</h4>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-mono text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap">
              {concludedSummary?.momSynthesis?.adminNote}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center pt-3 border-t border-slate-100">
            <button
              onClick={downloadMOMpdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-1.5"
            >
              <Download size={13} /> Download Official MOM PDF
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

// Simple debounce helper function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
