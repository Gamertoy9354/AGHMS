import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Users, Save, Plus, Trash2,
  CheckCircle, Download, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMeeting, useMOM, useCreateMOM, useCreateActionItem } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, FormField, Spinner, Modal, EmptyState, Avatar } from '../../components/ui/index';
import { formatDate } from '../../lib/supabaseHelpers';

// Mock attendees for demo
const ALL_HODS = [
  { id:'u1', full_name:'CSE Faculty Member',   dept:'CSE', role:'hod', present:true },
  { id:'u2', full_name:'MECH Faculty Member',  dept:'MECH', role:'hod', present:true },
  { id:'u3', full_name:'ELE Faculty Member',   dept:'ELE', role:'hod', present:false },
  { id:'u4', full_name:'IT Faculty Member',    dept:'IT', role:'hod', present:true },
  { id:'u5', full_name:'CIV Faculty Member',   dept:'CIV', role:'hod', present:true },
  { id:'u6', full_name:'CHEM Faculty Member',  dept:'CHEM', role:'hod', present:false },
];

export default function MOMPage() {
  const { id } = useParams();
  const { user, canManageMeetings } = useAuth();
  const { data: meeting, isLoading: meetingLoading } = useMeeting(id);
  const { data: existingMOM }  = useMOM(id);
  const createMOM = useCreateMOM();
  const createAction = useCreateActionItem();

  const [attendees, setAttendees] = useState(ALL_HODS);
  const [discussions, setDiscussions] = useState([
    { agenda_item: '', discussion: '', decision: '', id: Date.now() }
  ]);
  const [actions, setActions] = useState([
    { description: '', assigned_dept: '', deadline: '', id: Date.now() + 1 }
  ]);
  const [saving, setSaving] = useState(false);

  const toggleAttendance = (uid) => {
    setAttendees(prev => prev.map(a => a.id === uid ? { ...a, present: !a.present } : a));
  };

  const addDiscussion = () => setDiscussions(p => [...p, { agenda_item:'', discussion:'', decision:'', id: Date.now() }]);
  const removeDiscussion = (id) => setDiscussions(p => p.filter(d => d.id !== id));
  const updateDiscussion = (id, field, val) => setDiscussions(p => p.map(d => d.id === id ? { ...d, [field]: val } : d));

  const addAction = () => setActions(p => [...p, { description:'', assigned_dept:'', deadline:'', id: Date.now() }]);
  const removeAction = (id) => setActions(p => p.filter(a => a.id !== id));
  const updateAction = (id, field, val) => setActions(p => p.map(a => a.id === id ? { ...a, [field]: val } : a));

  const handleSave = async () => {
    if (!meeting) return;
    setSaving(true);
    try {
      await createMOM.mutateAsync({
        meeting_id:  meeting.id,
        created_by:  user?.id,
        mom_content: discussions,
        attendees:   attendees,
      });
      // Create action items
      for (const a of actions) {
        if (a.description) {
          await createAction.mutateAsync({
            meeting_id:  meeting.id,
            description: a.description,
            deadline:    a.deadline || null,
            status:      'pending',
            completion_percentage: 0,
          });
        }
      }
      toast.success('MOM saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to save MOM');
    } finally {
      setSaving(false);
    }
  };

  if (meetingLoading) return <div className="page-wrapper"><div className="skeleton h-10 w-1/2 rounded mb-4" /><div className="skeleton h-64 rounded" /></div>;

  const presentCount = attendees.filter(a => a.present).length;

  return (
    <div className="page-wrapper max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/meetings/agendas/${id}`} className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold text-surface-900">Minutes of Meeting</h1>
          {meeting && <p className="text-sm text-surface-500">{meeting.agenda_title} · {formatDate(meeting.meeting_date)}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-secondary text-sm"><Printer size={14} /> Print</button>
          <button className="btn-secondary text-sm"><Download size={14} /> PDF</button>
          {canManageMeetings && (
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : <Save size={14} />}
              Save MOM
            </button>
          )}
        </div>
      </div>

      {existingMOM ? (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-success-600" />
            <h3 className="font-semibold text-success-700">MOM Already Prepared</h3>
          </div>
          <p className="text-sm text-surface-600">
            Minutes of Meeting for this session have been recorded on{' '}
            <strong>{formatDate(existingMOM.created_at)}</strong>.
          </p>
          <div className="mt-4 space-y-2">
            {Array.isArray(existingMOM.mom_content) && existingMOM.mom_content.map((d, i) => (
              <div key={i} className="p-3 border border-surface-100 rounded-xl">
                <p className="text-xs font-semibold text-primary-600 mb-1">{d.agenda_item}</p>
                <p className="text-sm text-surface-700">{d.discussion}</p>
                {d.decision && <p className="text-xs text-success-700 mt-1 font-medium">✓ Decision: {d.decision}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Attendance */}
          <div className="card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-surface-800 flex items-center gap-2">
                <Users size={16} className="text-primary-500" /> Attendance
                <span className="badge-success text-xs ml-2">{presentCount}/{attendees.length} Present</span>
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attendees.map(a => (
                <button
                  key={a.id}
                  onClick={() => toggleAttendance(a.id)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                    a.present
                      ? 'border-success-300 bg-success-50'
                      : 'border-surface-200 bg-surface-50 opacity-60'
                  }`}
                >
                  <Avatar name={a.full_name} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-surface-800 truncate">{a.full_name}</p>
                    <p className="text-[10px] text-surface-400">{a.dept} – HOD</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                    a.present ? 'bg-success-500' : 'bg-surface-300'
                  }`}>
                    {a.present && <CheckCircle size={10} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Discussion points */}
          <div className="card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-surface-800">Discussion Points</h3>
              <button onClick={addDiscussion} className="btn-secondary text-sm"><Plus size={13} /> Add Point</button>
            </div>
            <div className="space-y-4">
              {discussions.map((d, i) => (
                <div key={d.id} className="border border-surface-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-primary-600">Point #{i + 1}</span>
                    {discussions.length > 1 && (
                      <button onClick={() => removeDiscussion(d.id)} className="btn-ghost p-1 text-danger-400 hover:bg-danger-50">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <FormField label="Agenda Item / Topic">
                      <input
                        value={d.agenda_item}
                        onChange={e => updateDiscussion(d.id, 'agenda_item', e.target.value)}
                        placeholder="e.g. CO Attainment data review"
                        className="text-sm"
                      />
                    </FormField>
                    <FormField label="Discussion Summary">
                      <textarea
                        rows={2}
                        value={d.discussion}
                        onChange={e => updateDiscussion(d.id, 'discussion', e.target.value)}
                        placeholder="Summarize the discussion…"
                        className="text-sm"
                      />
                    </FormField>
                    <FormField label="Decision / Resolution">
                      <input
                        value={d.decision}
                        onChange={e => updateDiscussion(d.id, 'decision', e.target.value)}
                        placeholder="e.g. All HODs to submit by May 30, 2025"
                        className="text-sm"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
              <button
                onClick={addDiscussion}
                className="w-full py-3 border-2 border-dashed border-surface-200 rounded-xl text-sm text-surface-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
              >
                <Plus size={14} className="inline mr-1" /> Add Discussion Point
              </button>
            </div>
          </div>

          {/* Action Items from this meeting */}
          <div className="card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-surface-800">Action Items Arising</h3>
              <button onClick={addAction} className="btn-secondary text-sm"><Plus size={13} /> Add Action</button>
            </div>
            <div className="space-y-3">
              {actions.map((a, i) => (
                <div key={a.id} className="border border-surface-100 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <FormField label={`Action #${i + 1}`}>
                      <input
                        value={a.description}
                        onChange={e => updateAction(a.id, 'description', e.target.value)}
                        placeholder="Describe the action item…"
                        className="text-sm"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Dept">
                      <select value={a.assigned_dept} onChange={e => updateAction(a.id, 'assigned_dept', e.target.value)} className="text-xs">
                        <option value="">All</option>
                        {['CSE','MECH','ELE','IT','CIV','CHEM','EC'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Deadline">
                      <input type="date" value={a.deadline} onChange={e => updateAction(a.id, 'deadline', e.target.value)} className="text-xs" />
                    </FormField>
                  </div>
                  {actions.length > 1 && (
                    <button onClick={() => removeAction(a.id)} className="btn-ghost p-1 text-danger-400 hover:bg-danger-50 justify-self-end sm:col-span-3">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addAction}
                className="w-full py-3 border-2 border-dashed border-surface-200 rounded-xl text-sm text-surface-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
              >
                <Plus size={14} className="inline mr-1" /> Add Action Item
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
