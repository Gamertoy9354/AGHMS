import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, Send, Download, FileText,
  Clock, Edit, Users, MapPin, Calendar, Plus, ChevronDown, ChevronRight,
  FileSpreadsheet, Upload, Clipboard, AlertTriangle, AlertCircle, Info, Check, Sparkles,
  Maximize2, Minimize2, Play
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import {
  useMeeting, useApproveMeeting, useCirculateMeeting, 
  useAgendaTemplate, useAgendaSubmissions, useSubmitAgendaData, useDepartments
} from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { MEETING_STATUS_LABELS, MEETING_STATUS_COLORS, PRIORITY_LABELS } from '../../lib/constants';
import { PageHeader, Modal, FormField, Spinner, SkeletonCard, EmptyState, ProgressBar } from '../../components/ui/index';
import { formatDate } from '../../lib/supabaseHelpers';
import clsx from 'clsx';
import { exportMeetingToPDF } from '../../lib/exportUtils';
import { emailService } from '../../lib/emailService';

const PRIORITY_LABELS_MAP = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
const PRIORITY_COLORS_MAP = {
  1: 'badge-surface', 2: 'badge-primary', 3: 'badge-warning', 4: 'badge-danger'
};

export default function AgendaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, canApprove, canManageMeetings } = useAuth();
  
  const { data: meeting, isLoading, error, refetch } = useMeeting(id);
  const approveMutation = useApproveMeeting();
  const circulateMutation = useCirculateMeeting();

  // Template and submissions hooks
  const { data: template } = useAgendaTemplate(meeting?.agenda_template_id);
  const { data: submissions = [], refetch: refetchSubmissions } = useAgendaSubmissions(id);
  const submitAgendaData = useSubmitAgendaData();
  const { data: departments = [] } = useDepartments();

  const [rejectModal, setRejectModal] = useState(false);
  const [circulateModal, setCirculateModal] = useState(false);
  const [circNum, setCircNum] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  // Start Meeting workflow states
  const [startMeetingModal, setStartMeetingModal] = useState(false);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);

  // Uploader workspace modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedGrid, setParsedGrid] = useState([]); // [{ rowIdx, data: {colName: val}, errors: {colName: err} }]
  const [validationErrors, setValidationErrors] = useState([]); // Array of string errors
  const [uploadDeptId, setUploadDeptId] = useState('');
  const [isSubmittingData, setIsSubmittingData] = useState(false);
  const [isUploadFullScreen, setIsUploadFullScreen] = useState(false);
  const [fullscreenSubmission, setFullscreenSubmission] = useState(null);
  const [expandedTables, setExpandedTables] = useState({});
  const toggleTableExpand = (subId) => {
    setExpandedTables(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  const handleStartMeeting = async () => {
    setIsStartingMeeting(true);
    toast.loading('AI NIM (Minimax) is processing and synthesizing uploaded spreadsheets...', { id: 'start-meeting' });
    try {
      const { compileMeetingData, generateLiveDashboard } = await import('../../lib/ai');
      
      // Compile data
      const compiledText = compileMeetingData(submissions, departments);
      
      // Generate live dashboard from AI
      const dashboard = await generateLiveDashboard(compiledText);
      
      // Save status = in_progress, and ai_summary = { dashboard }
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase
        .from('meetings')
        .update({
          status: 'in_progress',
          ai_summary: { dashboard, summaryText: compiledText },
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.dismiss('start-meeting');
      toast.success('Meeting started! Opening active workspace...');
      setStartMeetingModal(false);
      // 📧 Notify all participants that meeting is live
      emailService.meetingStarted(meeting); // fire-and-forget
      // Redirect to workspace
      navigate(`/meetings/agendas/${id}/workspace`);
    } catch (err) {
      console.error(err);
      toast.dismiss('start-meeting');
      toast.error(err.message || 'Failed to start meeting');
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const invitedDeptIds = meeting?.invited_departments || [];
  const invitedDepts = departments.filter(d => invitedDeptIds.includes(d.id));
  const uploadedDeptIds = new Set(submissions.map(s => s.department_id));
  const invitedSubmissions = submissions.filter(s => invitedDeptIds.includes(s.department_id));
  const remainingDepts = invitedDepts.filter(d => d && d.id && !uploadedDeptIds.has(d.id));
  const totalDeptsCount = invitedDepts.length || 1;
  const uploadedPercent = Math.round((invitedSubmissions.length / totalDeptsCount) * 100);

  // Load user's department as default
  useEffect(() => {
    if (user?.department_id) {
      setUploadDeptId(user.department_id);
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });

  if (isLoading) return <div className="page-wrapper"><SkeletonCard lines={6} /><SkeletonCard lines={4} /></div>;
  if (error || !meeting) return (
    <div className="page-wrapper">
      <EmptyState icon={FileText} title="Meeting not found" description={error?.message} action={<Link to="/meetings/agendas" className="btn-secondary">← Back to Agendas</Link>} />
    </div>
  );

  const statusBadge = MEETING_STATUS_COLORS[meeting.status] || 'badge-surface';
  const docs = meeting.documents || [];
  const agendaItems = meeting.agenda_items || [];
  const docsApproved = docs.filter(d => d.status === 'approved').length;
  const docsTotal = docs.length;

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(meeting.id);
      toast.success('Meeting approved!');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCirculate = async () => {
    try {
      const num = circNum || `RNGPIT/${new Date().getFullYear()}/${String(Date.now()).slice(-3)}`;
      await circulateMutation.mutateAsync({ id: meeting.id, circularNumber: num });
      toast.success('Meeting circular sent!');
      setCirculateModal(false);
      refetch();
      // 📧 Notify all invited dept HODs/faculty
      emailService.meetingCirculated(meeting, num); // fire-and-forget
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleItem = (idx) => setExpandedItems(p => ({ ...p, [idx]: !p[idx] }));

  // ==========================================
  // XLS/CSV PARSING AND VALIDATION LOGIC
  // ==========================================
  const schemaCols = template?.format_schema?.columns || [];

  // Helper to render dual-row header when columns have parents
  const renderMultiLevelHeader = (cols, includeAction = false, actionHeader = "Action") => {
    const hasParent = cols.some(col => col.parent);
    if (!hasParent) {
      return (
        <tr className="bg-slate-50 border-b border-surface-200">
          <th className="p-2 w-10 border-r border-surface-200 text-center font-bold text-slate-400">#</th>
          {cols.map((col, idx) => (
            <th key={idx} className="p-2 border-r border-surface-200 font-semibold text-surface-700 min-w-[120px]">
              <div className="flex items-center justify-between">
                <span>{col.name}</span>
                <span className="text-[9px] font-normal text-slate-400 lowercase italic bg-slate-100/50 px-1 rounded">
                  {col.type}
                </span>
              </div>
            </th>
          ))}
          {includeAction && (
            <th className="p-2 w-12 text-center font-bold text-slate-400">{actionHeader}</th>
          )}
        </tr>
      );
    }

    const row1 = [];
    const row2 = [];

    row1.push(
      <th key="index-col" rowSpan={2} className="p-2 w-10 border-r border-b border-surface-200 text-center font-bold text-slate-400 bg-slate-50">
        #
      </th>
    );

    const parentGroups = {};
    cols.forEach(col => {
      if (col.parent) {
        if (!parentGroups[col.parent]) {
          parentGroups[col.parent] = [];
        }
        parentGroups[col.parent].push(col);
      }
    });

    const processedParents = new Set();

    cols.forEach((col, idx) => {
      if (!col.parent) {
        row1.push(
          <th key={`r1-col-${idx}`} rowSpan={2} className="p-2 border-r border-b border-surface-200 font-semibold text-surface-700 min-w-[120px] bg-slate-50 text-left">
            <div className="flex items-center justify-between">
              <span>{col.name}</span>
              <span className="text-[9px] font-normal text-slate-400 lowercase italic bg-slate-100/50 px-1 rounded">
                {col.type}
              </span>
            </div>
          </th>
        );
      } else {
        if (!processedParents.has(col.parent)) {
          processedParents.add(col.parent);
          const children = parentGroups[col.parent];
          row1.push(
            <th
              key={`r1-parent-${col.parent}`}
              colSpan={children.length}
              className="p-1.5 border-r border-b border-surface-200 text-center font-bold text-primary-700 bg-primary-50/50"
            >
              {col.parent}
            </th>
          );
        }
        row2.push(
          <th key={`r2-col-${idx}`} className="p-1.5 border-r border-b border-surface-200 font-medium text-surface-600 min-w-[100px] bg-slate-50 text-left">
            <div className="flex items-center justify-between">
              <span>{col.name}</span>
              <span className="text-[9px] font-normal text-slate-400 lowercase italic bg-slate-100/50 px-1 rounded">
                {col.type}
              </span>
            </div>
          </th>
        );
      }
    });

    if (includeAction) {
      row1.push(
        <th key="action-col" rowSpan={2} className="p-2 w-12 border-b border-surface-200 text-center font-bold text-slate-400 bg-slate-50">
          {actionHeader}
        </th>
      );
    }

    return (
      <>
        <tr className="bg-slate-50">{row1}</tr>
        <tr className="bg-slate-50">{row2}</tr>
      </>
    );
  };

  const validateRows = (rowsToValidate) => {
    const gridRows = [];
    const errorLogs = [];

    rowsToValidate.forEach((row, rowIdx) => {
      const rowData = {};
      const rowErrors = {};

      schemaCols.forEach(col => {
        let rawVal = row[col.name] !== undefined && row[col.name] !== null ? String(row[col.name]).trim() : '';

        // Validate type
        if (col.type === 'number' && rawVal !== '') {
          const num = Number(rawVal);
          if (isNaN(num)) {
            rowErrors[col.name] = 'Must be a valid number';
            errorLogs.push(`Row ${rowIdx + 1}: Column "${col.name}" value "${rawVal}" is not a number.`);
          }
        } else if (col.type === 'date' && rawVal !== '') {
          const timestamp = Date.parse(rawVal);
          if (isNaN(timestamp)) {
            rowErrors[col.name] = 'Must be a valid date';
            errorLogs.push(`Row ${rowIdx + 1}: Column "${col.name}" value "${rawVal}" is not a valid date.`);
          }
        }

        rowData[col.name] = rawVal;
      });

      gridRows.push({
        rowIdx,
        data: rowData,
        errors: rowErrors
      });
    });

    return { gridRows, errorLogs };
  };

  const handleEditCell = (rowIndex, colName, value) => {
    const updated = [...parsedGrid];
    const rowData = { ...updated[rowIndex].data, [colName]: value };
    updated[rowIndex] = { ...updated[rowIndex], data: rowData };
    
    // Re-run validation on the entire updated dataset to keep everything in sync
    const rawRows = updated.map(r => r.data);
    const { gridRows, errorLogs } = validateRows(rawRows);
    setParsedGrid(gridRows);
    setValidationErrors(errorLogs);
  };

  const handleAddRow = () => {
    const newRow = {};
    schemaCols.forEach(col => {
      newRow[col.name] = '';
    });
    const rawRows = [...parsedGrid.map(r => r.data), newRow];
    const { gridRows, errorLogs } = validateRows(rawRows);
    setParsedGrid(gridRows);
    setValidationErrors(errorLogs);
    if (!uploadedFileName) {
      setUploadedFileName('manual_entry.xlsx');
    }
  };

  const handleDeleteRow = (rowIndex) => {
    const updated = parsedGrid.filter((_, i) => i !== rowIndex);
    const rawRows = updated.map(r => r.data);
    const { gridRows, errorLogs } = validateRows(rawRows);
    setParsedGrid(gridRows);
    setValidationErrors(errorLogs);
  };

  const renderUploadGridTable = () => {
    return (
      <table className="w-full text-left text-[11px] border-collapse bg-white">
        <thead>
          {renderMultiLevelHeader(schemaCols, true, "Actions")}
        </thead>
        <tbody>
          {parsedGrid.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-surface-100 hover:bg-slate-50/20">
              <td className="p-2 border-r border-surface-200 text-center text-slate-400 font-medium bg-slate-50/30">
                {rIdx + 1}
              </td>
              {schemaCols.map((c, cIdx) => {
                const err = row.errors[c.name];
                return (
                  <td
                    key={cIdx}
                    className={clsx(
                      'p-1 border-r border-surface-100 text-surface-700 min-w-[130px]',
                      err ? 'bg-danger-50/70 border-danger-200' : ''
                    )}
                    title={err || undefined}
                  >
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type={c.type === 'number' ? 'text' : c.type === 'date' ? 'date' : 'text'}
                        value={row.data[c.name] || ''}
                        onChange={e => handleEditCell(rIdx, c.name, e.target.value)}
                        className={clsx(
                          "w-full border-0 p-1 focus:ring-1 focus:ring-primary-500 rounded bg-transparent focus:bg-white text-[11px] h-7",
                          err ? 'text-danger-800' : 'text-surface-700'
                        )}
                        placeholder={`Enter ${c.name}...`}
                      />
                      {err && <AlertCircle size={10} className="text-danger-500 flex-shrink-0" />}
                    </div>
                  </td>
                );
              })}
              <td className="p-1 text-center bg-slate-50/30">
                <button
                  type="button"
                  onClick={() => handleDeleteRow(rIdx)}
                  className="p-1 hover:bg-danger-50 hover:text-danger-600 rounded transition-colors text-slate-400"
                  title="Delete Row"
                >
                  <XCircle size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  function handleParseData(headers, rowsData, sourceName) {
    if (headers.length === 0 || rowsData.length === 0) {
      toast.error('No readable rows found in file');
      return;
    }

    setUploadedFileName(sourceName);
    
    // Case-insensitive mapping of input headers to template columns
    const colMapping = {}; // { inputHeader: schemaColumnName }
    const missingCols = [];

    schemaCols.forEach(col => {
      const matchedHeader = headers.find(h => h.toLowerCase().trim() === col.name.toLowerCase().trim());
      if (matchedHeader) {
        colMapping[matchedHeader] = col.name;
      } else {
        missingCols.push(col.name);
      }
    });

    if (missingCols.length > 0) {
      toast.error(`Missing expected columns: ${missingCols.join(', ')}`);
      return;
    }

    // Convert row keys to match template schema keys exactly
    const normalizedRows = rowsData.map(row => {
      const normalizedRow = {};
      schemaCols.forEach(col => {
        const inputHeader = Object.keys(colMapping).find(k => colMapping[k] === col.name);
        let rawVal = row[inputHeader] !== undefined ? String(row[inputHeader]).trim() : '';
        
        // Parse serial number dates from Excel if needed
        if (col.type === 'date' && rawVal !== '') {
          if (!isNaN(Number(rawVal)) && rawVal.length > 4) {
            try {
              const dateObj = XLSX.SSF.parse_date_code(Number(rawVal));
              rawVal = `${dateObj.y}-${String(dateObj.m).padStart(2,'0')}-${String(dateObj.d).padStart(2,'0')}`;
            } catch (e) {}
          }
        }
        normalizedRow[col.name] = rawVal;
      });
      return normalizedRow;
    });

    const { gridRows, errorLogs } = validateRows(normalizedRows);

    setParsedGrid(gridRows);
    setValidationErrors(errorLogs);
    if (errorLogs.length === 0) {
      toast.success('Spreadsheet data loaded and validated successfully!');
    } else {
      toast.error(`Loaded with ${errorLogs.length} validation errors`);
    }
  };

  // CSV Paste parser
  const handleCsvPaste = () => {
    if (!csvText.trim()) return toast.error('Please paste some CSV data first');
    
    // Parse CSV lines
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return toast.error('CSV data must contain a header row and at least one data row');

    // Split headers by comma
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rowsData = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const rowObj = {};
      headers.forEach((h, cIdx) => {
        rowObj[h] = cells[cIdx] !== undefined ? cells[cIdx] : '';
      });
      rowsData.push(rowObj);
    }

    handleParseData(headers, rowsData, 'pasted_csv.csv');
  };

  // Dropzone file uploader setup
  function onDrop(acceptedFiles) {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const hasParent = schemaCols.some(col => col.parent);
      
      if (hasParent) {
        // Dual-row header parsing supporting vertically merged cells
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (rows.length < 2) {
          toast.error('Excel sheet must contain at least 2 rows of headers');
          return;
        }

        const r1 = rows[0];
        const r2 = rows[1];
        const headers = [];

        // If cell in Row 2 is not empty, use Row 2. Otherwise, use Row 1 (supporting vertically merged cells).
        for (let c = 0; c < Math.max(r1.length, r2.length); c++) {
          const val1 = r1[c] !== undefined ? String(r1[c]).trim() : '';
          const val2 = r2[c] !== undefined ? String(r2[c]).trim() : '';
          headers.push(val2 !== '' ? val2 : val1);
        }

        // Map data rows starting from row index 2
        const dataRows = [];
        for (let r = 2; r < rows.length; r++) {
          // Skip completely empty rows
          if (rows[r].every(val => val === '')) continue;
          
          const rowObj = {};
          headers.forEach((h, cIdx) => {
            if (h) {
              rowObj[h] = rows[r][cIdx] !== undefined ? rows[r][cIdx] : '';
            }
          });
          dataRows.push(rowObj);
        }

        if (dataRows.length === 0) {
          toast.error('Excel sheet contains no data rows');
          return;
        }

        handleParseData(headers, dataRows, file.name);
      } else {
        // Standard single-row header parsing
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (jsonData.length === 0) {
          toast.error('Excel sheet is empty');
          return;
        }

        const headers = Object.keys(jsonData[0]);
        handleParseData(headers, jsonData, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Download empty Excel template matching schema
  const handleDownloadTemplate = () => {
    if (!schemaCols || schemaCols.length === 0) {
      toast.error('No agenda format schema defined');
      return;
    }
    
    const hasParent = schemaCols.some(col => col.parent);
    
    let headersRow1 = [];
    let headersRow2 = [];
    let merges = [];
    let dataRows = [];

    if (!hasParent) {
      // Simple 1-row header
      headersRow1 = schemaCols.map(col => col.name);
      dataRows.push(headersRow1);
    } else {
      // 2-row header with cell merges
      headersRow1 = new Array(schemaCols.length).fill("");
      headersRow2 = new Array(schemaCols.length).fill("");

      let i = 0;
      while (i < schemaCols.length) {
        const col = schemaCols[i];
        if (!col.parent) {
          // No parent: Row 1 has the name, Row 2 is empty (merged vertically)
          headersRow1[i] = col.name;
          headersRow2[i] = "";
          // Merge vertically: cell at index i in row 0 (Row 1) and row 1 (Row 2)
          merges.push({
            s: { r: 0, c: i },
            e: { r: 1, c: i }
          });
          i++;
        } else {
          // Has parent: group consecutive columns with the exact same parent
          const parentName = col.parent;
          let startIdx = i;
          while (i < schemaCols.length && schemaCols[i].parent === parentName) {
            headersRow1[i] = ""; // Will be placed at startIdx
            headersRow2[i] = schemaCols[i].name; // Child name in Row 2
            i++;
          }
          let endIdx = i - 1;
          headersRow1[startIdx] = parentName;
          
          // Merge horizontally across the group in Row 1: from startIdx to endIdx
          if (startIdx < endIdx) {
            merges.push({
              s: { r: 0, c: startIdx },
              e: { r: 0, c: endIdx }
            });
          }
        }
      }
      dataRows.push(headersRow1, headersRow2);
    }

    // Pre-fill with admin's template rows if any exist, otherwise create a blank example row
    const defaultRows = template?.format_schema?.rows || [];
    if (defaultRows.length > 0) {
      defaultRows.forEach(rowObj => {
        const rowData = schemaCols.map(col => rowObj[col.name] !== undefined ? rowObj[col.name] : '');
        dataRows.push(rowData);
      });
    } else {
      // Add a single blank row
      const blankRow = schemaCols.map(() => '');
      dataRows.push(blankRow);
    }

    // Generate Excel sheet
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    
    // Apply merges if any exist
    if (merges.length > 0) {
      ws['!merges'] = merges;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upload Template");
    
    // Save/Download sheet
    const safeTitle = (template.title || 'Agenda').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeTitle}_template.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Spreadsheet template downloaded successfully with grouped parent columns!');
  };

  // Submit parsed data
  const handleSubmission = async () => {
    if (!uploadDeptId) return toast.error('Please select your department');
    if (parsedGrid.length === 0) return toast.error('No validated data rows to submit');
    if (validationErrors.length > 0) return toast.error('Cannot submit data containing validation errors. Please correct the source file.');

    setIsSubmittingData(true);
    const rowsToSubmit = parsedGrid.map(r => r.data);

    try {
      await submitAgendaData.mutateAsync({
        meeting_id: id,
        agenda_template_id: meeting.agenda_template_id,
        user_id: user.id,
        department_id: uploadDeptId,
        submitted_data: rowsToSubmit,
        file_name: uploadedFileName || 'uploaded_sheet.xlsx'
      });

      toast.success('Structured spreadsheet data submitted successfully!');
      setUploadModal(false);
      setParsedGrid([]);
      setValidationErrors([]);
      setUploadedFileName('');
      setCsvText('');
      refetchSubmissions();
    } catch (err) {
      toast.error(err.message || 'Failed to submit structured data');
    } finally {
      setIsSubmittingData(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/meetings/agendas" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`badge ${statusBadge}`}>{MEETING_STATUS_LABELS[meeting.status]}</span>
            {meeting.circular_number && <span className="badge-primary text-xs">#{meeting.circular_number}</span>}
          </div>
          <h1 className="text-xl font-bold text-surface-900">{meeting.agenda_title}</h1>
        </div>
      </div>

      {/* Meta info */}
      <div className="card p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-start gap-2.5">
            <Calendar size={16} className="text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-surface-400">Date & Time</p>
              <p className="text-sm font-semibold">{formatDate(meeting.meeting_date)}</p>
              <p className="text-xs text-surface-500">{meeting.meeting_time || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-surface-400">Venue</p>
              <p className="text-sm font-semibold">{meeting.venue || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Users size={16} className="text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-surface-400">Created by</p>
              <p className="text-sm font-semibold">{meeting.created_by_user?.full_name || '—'}</p>
              <p className="text-xs text-surface-500 capitalize">{meeting.created_by_user?.role}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet size={16} className="text-primary-500 mt-0.5" />
            <div>
              <p className="text-xs text-surface-400">Predefined Template</p>
              <p className="text-sm font-semibold truncate max-w-[150px]">{template?.title || 'None linked'}</p>
              {template && <p className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1 rounded inline-block">Structured format active</p>}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-surface-100">
          {canApprove && meeting.status === 'pending_approval' && (
            <>
              <button onClick={handleApprove} disabled={approveMutation.isPending} className="btn-success text-sm">
                {approveMutation.isPending ? <Spinner size={14} className="border-t-white border-white/30" /> : <CheckCircle size={15} />}
                Approve Agenda
              </button>
              <button onClick={() => setRejectModal(true)} className="btn-danger text-sm">
                <XCircle size={15} /> Reject
              </button>
            </>
          )}
          {canManageMeetings && meeting.status === 'approved' && (
            <button onClick={() => setCirculateModal(true)} className="btn-primary text-sm">
              <Send size={15} /> Circulate to HODs
            </button>
          )}
          {meeting.status === 'in_progress' && (
            <Link
              to={`/meetings/agendas/${id}/workspace`}
              className="btn-primary text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 animate-pulse shadow-md shadow-indigo-200 border-0 flex items-center gap-1.5 font-bold"
            >
              <Sparkles size={14} className="text-white" />
              Go to Live Workspace
            </Link>
          )}
          {canManageMeetings && ['approved', 'circulated'].includes(meeting.status) && (
            <button
              onClick={() => setStartMeetingModal(true)}
              className="btn-success text-sm flex items-center gap-1.5 shadow-md shadow-emerald-150 font-bold"
            >
              <Play size={14} />
              Start Meeting
            </button>
          )}
          {meeting.status === 'draft' && canManageMeetings && (
            <Link to={`/meetings/agendas/${meeting.id}/edit`} className="btn-secondary text-sm">
              <Edit size={14} /> Edit Draft Meeting
            </Link>
          )}
          {meeting.status === 'conducted' && !meeting.meeting_mom?.length && canManageMeetings && (
            <Link to={`/meetings/agendas/${id}/mom`} className="btn-primary text-sm">
              <FileText size={15} /> Prepare MOM
            </Link>
          )}
          <button
            onClick={() => {
              try {
                exportMeetingToPDF(meeting, template, submissions, departments);
                toast.success('Meeting PDF report downloaded successfully!');
              } catch (err) {
                console.error(err);
                toast.error('Failed to export PDF.');
              }
            }}
            className="btn-secondary text-sm ml-auto flex items-center gap-1.5"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* ==========================================
          FACULTY DATA SUBMISSION BANNER & TRIGGER
          ========================================== */}
      {template?.format_schema && (
        <div className="card border-l-4 border-emerald-500 bg-emerald-50/10 p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 flex-shrink-0 mt-1 sm:mt-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-surface-800">Predefined Format Report Required</h3>
                <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">
                  This meeting requires HODs to submit structural data matching the designed Excel grid template.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {schemaCols.map((c, i) => (
                    <span key={i} className="text-[10px] bg-emerald-100/50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                      {c.name} ({c.type})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn-secondary text-xs shadow-sm bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
              >
                <Download size={14} className="text-emerald-600" /> Download Template
              </button>
              {['hod', 'faculty', 'admin'].includes(role) && (
                <button onClick={() => setUploadModal(true)} className="btn-primary text-xs shadow-md shadow-emerald-200">
                  <Upload size={14} /> Submit Formatted Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agenda Items */}
      <div className="card p-5 mb-6">
        <h3 className="text-base font-semibold text-surface-800 mb-4">
          Agenda Items ({agendaItems.length})
        </h3>
        {agendaItems.length === 0 ? (
          <EmptyState icon={FileText} title="No agenda items" description="Agenda items will appear here" />
        ) : (
          <div className="space-y-2">
            {agendaItems.map((item, idx) => (
              <div key={item.id} className="border border-surface-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleItem(idx)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-surface-50 transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className={`badge text-[10px] ${PRIORITY_COLORS_MAP[item.priority_level]}`}>
                        {PRIORITY_LABELS_MAP[item.priority_level]}
                      </span>
                      <span className="badge-surface text-[10px]">{item.category}</span>
                      {item.responsible_department && (
                        <span className="text-xs text-surface-400">{item.responsible_department.code}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-surface-800">{item.title}</p>
                  </div>
                  {item.deadline && (
                    <span className="text-xs text-surface-400 flex items-center gap-1 flex-shrink-0">
                      <Clock size={11} /> {formatDate(item.deadline)}
                    </span>
                  )}
                  {expandedItems[idx] ? <ChevronDown size={14} className="text-surface-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-surface-400 flex-shrink-0" />}
                </button>
                {expandedItems[idx] && (
                  <div className="px-4 pb-4 bg-surface-50/50 border-t border-surface-100">
                    {item.description && <p className="text-sm text-surface-600 mt-3 mb-2">{item.description}</p>}
                    {item.required_documents?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-surface-500 mb-2">Required Documents:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.required_documents.map(doc => <span key={doc} className="badge-surface text-xs">{doc}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==========================================
          DEPARTMENTAL SUBMISSION PROGRESS TRACKING DASHBOARD
          ========================================== */}
      {template?.format_schema && (
        <div className="card p-6 mb-6 border border-surface-200 shadow-sm bg-white rounded-3xl overflow-hidden relative">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-surface-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-primary-50 rounded-lg text-primary-600">
                  <FileSpreadsheet size={18} />
                </span>
                <h3 className="text-base font-bold text-surface-800">
                  Departmental Spreadsheet Submission Tracking
                </h3>
              </div>
              <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                Track structural data spreadsheet uploads for Naac/Academic data collection requirements.
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-surface-100 self-start md:self-auto">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-extrabold text-sm">
                {invitedSubmissions.length}/{totalDeptsCount}
              </div>
              <div>
                <div className="text-xs font-bold text-surface-700">Submissions</div>
                <div className="text-[10px] text-surface-400 font-medium">Uploaded Successfully</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-surface-100">
            <div className="flex justify-between items-center text-xs font-bold text-surface-600 mb-2">
              <span>Overall Progress</span>
              <span className={clsx(
                uploadedPercent === 100 ? "text-emerald-600" : "text-primary-600"
              )}>{uploadedPercent}% Complete</span>
            </div>
            <div className="w-full bg-slate-200/70 rounded-full h-3.5 overflow-hidden p-[2px]">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${uploadedPercent}%` }}
              />
            </div>
          </div>

          {/* Grid Layout: Uploaded vs Remaining */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Column 1: Uploaded Departments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Uploaded ({invitedSubmissions.length})
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">Completed</span>
              </div>

              {invitedSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-slate-100 bg-slate-50/50 rounded-2xl text-center">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-2">
                    <Sparkles size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-surface-600">No Submissions Yet</h4>
                  <p className="text-[10px] text-surface-400 mt-1 max-w-[240px]">
                    Waiting for HODs or Faculty members to upload structural Excel files.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {invitedSubmissions.map((sub) => {
                    const isExpanded = !!expandedTables[sub.id];
                    return (
                      <div key={sub.id} className="border border-surface-150 rounded-2xl overflow-hidden bg-white hover:border-emerald-200 transition-colors shadow-sm">
                        {/* Header card info */}
                        <div className="p-4 bg-slate-50/55 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 flex-shrink-0">
                              <CheckCircle size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-surface-800 leading-tight">
                                {sub.department?.code} – {sub.department?.name}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-surface-400 mt-1">
                                <span>Uploaded by: <b className="text-surface-600">{sub.user?.full_name}</b></span>
                                <span>Date: <b>{formatDate(sub.created_at)}</b></span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => setFullscreenSubmission(sub)}
                              className="text-[10px] bg-white border border-surface-200 hover:border-primary-300 text-primary-600 hover:bg-primary-50 px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                            >
                              <Maximize2 size={10} /> Full Screen
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleTableExpand(sub.id)}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-surface-600 px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              {isExpanded ? "Hide Table" : "Quick View"}
                            </button>
                          </div>
                        </div>

                        {/* Excel Filename Banner */}
                        <div className="bg-emerald-50/20 border-t border-surface-150 px-4 py-2 flex items-center gap-1.5 text-[10px] text-emerald-700">
                          <FileText size={11} className="text-emerald-500" />
                          <span className="font-mono truncate max-w-xs sm:max-w-md">File: <b>{sub.file_name}</b></span>
                        </div>

                        {/* Inline Expandable Table Grid */}
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-surface-200">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                {renderMultiLevelHeader(schemaCols, false)}
                              </thead>
                              <tbody>
                                {(sub.submitted_data || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={schemaCols.length + 1} className="p-4 text-center text-slate-400 italic">
                                      No data rows submitted in this grid.
                                    </td>
                                  </tr>
                                ) : (
                                  (sub.submitted_data || []).map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-surface-100 hover:bg-slate-50/20">
                                      <td className="p-2 border-r border-surface-200 text-center text-slate-400 font-medium bg-slate-50/30">
                                        {rIdx + 1}
                                      </td>
                                      {schemaCols.map((c, cIdx) => (
                                        <td key={cIdx} className="p-2 border-r border-surface-100 text-surface-700">
                                          {row[c.name] || '—'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Remaining Departments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Remaining ({remainingDepts.length})
                </span>
                <span className="text-[10px] text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full font-mono font-bold">Pending</span>
              </div>

              {remainingDepts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-emerald-100 bg-emerald-50/10 rounded-2xl text-center">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle size={22} />
                  </div>
                  <h4 className="text-xs font-bold text-emerald-800">100% Submission Completed</h4>
                  <p className="text-[10px] text-emerald-600 mt-1 max-w-[240px]">
                    All academic departments have successfully uploaded their Excel spreadsheets!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {remainingDepts.map((dept) => (
                    <div key={dept.id} className="p-4 border border-surface-200 hover:border-amber-200 rounded-2xl bg-white hover:bg-amber-50/5 transition-all shadow-sm flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 flex-shrink-0 mt-0.5">
                          <AlertTriangle size={15} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-surface-800 leading-tight">
                            {dept.code} – {dept.name}
                          </div>
                          <p className="text-[10px] text-surface-400 mt-1">
                            Pending spreadsheet upload. HOD has not yet submitted formatting rows.
                          </p>
                        </div>
                      </div>
                      
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex-shrink-0 border border-amber-100">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Full Screen Consolidated Submission Overlay */}
      {fullscreenSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col p-6 overflow-hidden animate-in fade-in zoom-in duration-150">
          <div className="flex items-center justify-between bg-white border border-surface-200 px-6 py-4 rounded-2xl shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <FileSpreadsheet size={20} />
              </span>
              <div>
                <h3 className="font-bold text-surface-800 text-sm">
                  Department Submission Review (Full Screen Mode)
                </h3>
                <p className="text-[11px] text-surface-500">
                  Department: <b>{fullscreenSubmission.department?.code} – {fullscreenSubmission.department?.name}</b> • File: <b>{fullscreenSubmission.file_name}</b> • Submitted by: <b>{fullscreenSubmission.user?.full_name}</b>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                Uploaded: {formatDate(fullscreenSubmission.created_at)}
              </span>
              <button
                type="button"
                onClick={() => setFullscreenSubmission(null)}
                className="btn-primary text-xs flex items-center gap-1.5 px-4 py-1.5 rounded-xl h-9 shadow-md shadow-primary-200"
              >
                <Minimize2 size={14} /> Close Full Screen
              </button>
            </div>
          </div>

          <div className="flex-1 bg-white border border-surface-200 rounded-2xl shadow-inner overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                {renderMultiLevelHeader(schemaCols, false)}
              </thead>
              <tbody>
                {(fullscreenSubmission.submitted_data || []).map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-surface-100 hover:bg-slate-50/20">
                    <td className="p-2 border-r border-surface-200 text-center text-slate-400 font-medium bg-slate-50/30">
                      {rIdx + 1}
                    </td>
                    {schemaCols.map((c, cIdx) => (
                      <td key={cIdx} className="p-2 border-r border-surface-100 text-surface-700">
                        {row[c.name] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 p-3 rounded-xl text-[11px] text-slate-500 mt-4 shadow-sm">
            <Info size={14} className="text-slate-400 flex-shrink-0" />
            <span>Viewing submitted data for {fullscreenSubmission.department?.code} in read-only visual spreadsheet grid.</span>
          </div>
        </div>
      )}

      {/* Documents submitted for this meeting */}
      {docs.length > 0 && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-surface-800 mb-4">Submitted Documents ({docs.length})</h3>
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-surface-100 hover:bg-surface-50">
                <FileText size={16} className="text-surface-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{doc.title}</p>
                  <p className="text-xs text-surface-400">{doc.department?.code} · {doc.document_type}</p>
                </div>
                <span className={`badge text-xs ${
                  doc.status === 'approved' ? 'badge-success' :
                  doc.status === 'submitted' ? 'badge-primary' :
                  doc.status === 'pending' ? 'badge-surface' : 'badge-danger'
                }`}>
                  {doc.status}
                </span>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5 text-xs">
                    <Download size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================
          FACULTY UPLOADER & VALIDATOR WORKSPACE MODAL
          ========================================== */}
      <Modal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title="Spreadsheet Report Submission"
        footer={
          <>
            <button type="button" onClick={() => setUploadModal(false)} className="btn-ghost text-xs">Cancel</button>
            <button
              type="button"
              onClick={handleSubmission}
              disabled={isSubmittingData || parsedGrid.length === 0 || validationErrors.length > 0}
              className="btn-primary text-xs"
            >
              {isSubmittingData ? <Spinner size={12} className="border-t-white border-white/30" /> : <Check size={14} />}
              Submit Spreadsheet Data
            </button>
          </>
        }
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
          <div className="alert-info text-xs">
            <Info size={16} />
            Select your department, drag-and-drop your Excel uploader template (`.xlsx`) or paste your CSV data. The browser validator checks cell types against expected fields in real-time.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Responsible Department" required>
              <select
                value={uploadDeptId}
                onChange={e => setUploadDeptId(e.target.value)}
                className="text-xs bg-white"
              >
                <option value="">-- Choose Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.code} – {d.name}</option>
                ))}
              </select>
            </FormField>
            
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">Expected Format Headers</label>
              <div className="flex flex-wrap gap-1.5">
                {schemaCols.map((c, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                    {c.name} ({c.type})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Option A: Excel Drag and Drop */}
          <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-surface-200 px-4 py-2 text-xs font-bold text-surface-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet size={14} className="text-emerald-600" />
                Upload Excel Sheet (.xlsx / .xls / .csv)
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-[10px] text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <Download size={11} /> Download Blank Template
              </button>
            </div>
            <div className="p-4">
              <div
                {...getRootProps()}
                className={clsx(
                  'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all',
                  isDragActive ? 'border-primary-500 bg-primary-50/30' : 'border-surface-200 hover:border-primary-300'
                )}
              >
                <input {...getInputProps()} />
                <Upload size={24} className="mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-medium text-surface-700">
                  {isDragActive ? 'Drop your spreadsheet file here...' : 'Drag & drop Excel or CSV file, or click to browse'}
                </p>
                <p className="text-[10px] text-surface-400 mt-1">Accepts .xlsx, .xls, and .csv formats</p>
              </div>
            </div>
          </div>

          {/* Option B: Copy Paste CSV */}
          <div className="border border-surface-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 border-b border-surface-200 px-4 py-2 text-xs font-bold text-surface-700 flex items-center gap-1.5">
              <Clipboard size={14} className="text-primary-600" />
              Direct CSV Copy-Paste
            </div>
            <div className="p-4 space-y-3">
              <FormField label="Paste Comma-Separated Data (including header row)" hint="Header row must match expected headers">
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={`Header1,Header2,Header3\nValue1,Value2,Value3`}
                  rows={4}
                  className="font-mono text-[11px] bg-slate-50"
                />
              </FormField>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCsvPaste}
                  className="btn-secondary text-[11px] py-1.5 px-3"
                >
                  Parse Pasted CSV
                </button>
              </div>
            </div>
          </div>

          {/* Option C: Start with Blank Sheet */}
          {parsedGrid.length === 0 && (
            <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
              <div className="bg-slate-50 border-b border-surface-200 px-4 py-2 text-xs font-bold text-surface-700 flex items-center gap-1.5">
                <Plus size={14} className="text-emerald-600" />
                Or Start with a Blank Sheet
              </div>
              <div className="p-4 flex flex-col items-center justify-center text-center space-y-3">
                <p className="text-xs text-surface-500">
                  Prefer to enter details manually? Start with a blank sheet matching the template column schema.
                </p>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="btn-primary text-xs flex items-center gap-1 shadow-sm"
                >
                  <Plus size={14} /> Create Blank Sheet & Add Row
                </button>
              </div>
            </div>
          )}

          {/* PARSED GRID VALIDATOR PREVIEW */}
          {parsedGrid.length > 0 && (
            <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 border-b border-surface-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-surface-700">Uploader Parsing Validation Preview ({parsedGrid.length} rows)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadFullScreen(true)}
                    className="btn-secondary text-[10px] py-1.5 px-2.5 flex items-center gap-1 shadow-sm bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-primary-600 font-semibold"
                  >
                    <Maximize2 size={11} /> Full Screen
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="btn-secondary text-[10px] py-1 px-2.5 flex items-center gap-1 shadow-sm bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                  >
                    <Plus size={11} /> Add Row
                  </button>
                  {validationErrors.length === 0 ? (
                    <span className="text-[10px] bg-success-100 text-success-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle size={10} /> Valid Format
                    </span>
                  ) : (
                    <span className="text-[10px] bg-danger-100 text-danger-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle size={10} /> {validationErrors.length} Errors Found
                    </span>
                  )}
                </div>
              </div>

              {/* Validation errors summary logs */}
              {validationErrors.length > 0 && (
                <div className="bg-danger-50/50 border-b border-danger-100 p-3 text-[10px] text-danger-600 space-y-1 font-mono max-h-24 overflow-y-auto">
                  {validationErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <AlertCircle size={11} className="flex-shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Grid table */}
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto no-scrollbar">
                {renderUploadGridTable()}
              </div>
            </div>
          )}

          {/* Full-screen Uploader Validator Overlay */}
          {isUploadFullScreen && parsedGrid.length > 0 && (
            <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col p-6 overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between bg-white border border-surface-200 px-6 py-4 rounded-2xl shadow-sm mb-4">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-primary-50 rounded-xl text-primary-600">
                    <FileSpreadsheet size={20} />
                  </span>
                  <div>
                    <h3 className="font-bold text-surface-800 text-sm">Spreadsheet Report Validator (Full Screen Mode)</h3>
                    <p className="text-[11px] text-surface-500">File: <b>{uploadedFileName}</b> • expected headers parsed • {parsedGrid.length} rows</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="btn-secondary text-xs flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-primary-600 font-semibold px-3 py-1.5 rounded-xl h-9 shadow-sm"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                  {validationErrors.length === 0 ? (
                    <span className="text-[11px] bg-success-100 text-success-800 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <CheckCircle size={13} /> Valid Format
                    </span>
                  ) : (
                    <span className="text-[11px] bg-danger-100 text-danger-800 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <AlertTriangle size={13} /> {validationErrors.length} Errors Found
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsUploadFullScreen(false)}
                    className="btn-primary text-xs flex items-center gap-1.5 px-4 py-1.5 rounded-xl h-9 shadow-md shadow-primary-200"
                  >
                    <Minimize2 size={14} /> Exit Full Screen
                  </button>
                </div>
              </div>

              {/* Validation errors summary logs in Full Screen */}
              {validationErrors.length > 0 && (
                <div className="bg-danger-50 border border-danger-100 rounded-xl p-3 text-[11px] text-danger-600 space-y-1 font-mono max-h-24 overflow-y-auto mb-4">
                  {validationErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <AlertCircle size={12} className="flex-shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1 bg-white border border-surface-200 rounded-2xl shadow-inner overflow-auto">
                {renderUploadGridTable()}
              </div>

              <div className="flex items-center justify-between bg-slate-100 border border-slate-200/60 p-4 rounded-xl mt-4 shadow-sm text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Info size={14} className="text-slate-400 flex-shrink-0" />
                  <span>Double-click or tab into cells to correct formats instantly. Errors are checked in real-time.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSubmission}
                  disabled={isSubmittingData || parsedGrid.length === 0 || validationErrors.length > 0}
                  className="btn-primary text-xs flex items-center gap-1 px-5 py-2 rounded-xl"
                >
                  {isSubmittingData ? <Spinner size={12} className="border-t-white border-white/30" /> : <Check size={14} />}
                  Submit Spreadsheet Data
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Circulate Modal */}
      <Modal open={circulateModal} onClose={() => setCirculateModal(false)} title="Circulate Meeting Agenda"
             footer={
               <><button onClick={() => setCirculateModal(false)} className="btn-secondary">Cancel</button>
               <button onClick={handleCirculate} className="btn-primary" disabled={circulateMutation.isPending}>
                 {circulateMutation.isPending ? <Spinner size={14} className="border-t-white border-white/30" /> : <Send size={14} />}
                 Send Circular
               </button></>
             }>
        <div className="space-y-4">
          <div className="alert-info"><FileText size={16} />The agenda will be emailed to all HODs with the meeting circular PDF.</div>
          <FormField label="Circular Number" hint="Leave blank to auto-generate">
            <input
              type="text"
              value={circNum}
              onChange={e => setCircNum(e.target.value)}
              placeholder={`RNGPIT/${new Date().getFullYear()}/XXX`}
            />
          </FormField>
        </div>
      </Modal>

      {/* Start Meeting Modal showing Departmental Checklist */}
      <Modal
        open={startMeetingModal}
        onClose={() => !isStartingMeeting && setStartMeetingModal(false)}
        title="Start Live Meeting Checklist"
        footer={
          <>
            <button
              type="button"
              disabled={isStartingMeeting}
              onClick={() => setStartMeetingModal(false)}
              className="btn-ghost text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartMeeting}
              disabled={isStartingMeeting}
              className="btn-success text-xs flex items-center gap-1.5 shadow-md shadow-emerald-250 font-bold"
            >
              {isStartingMeeting ? (
                <>
                  <Spinner size={12} className="border-t-white border-white/30" />
                  Synthesizing Data with NIM AI...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Confirm & Start Meeting
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="alert-info text-xs">
            <Info size={16} />
            Review the spreadsheet data submissions of all invited departments before starting the live workspace. HODs can still adjust data in real-time while the meeting is in progress.
          </div>

          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1">
              Invited Departments Checklist ({invitedSubmissions.length} of {invitedDepts.length} uploaded)
            </label>
            {invitedDepts.map((dept) => {
              const submission = invitedSubmissions.find(s => s.department_id === dept.id);
              const isUploaded = !!submission;
              return (
                <div
                  key={dept.id}
                  className={clsx(
                    "p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all",
                    isUploaded
                      ? "bg-emerald-50/20 border-emerald-200"
                      : "bg-amber-50/20 border-amber-200"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={clsx(
                        "p-2 rounded-xl flex-shrink-0 mt-0.5",
                        isUploaded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {isUploaded ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-surface-800 leading-none mb-1 truncate">
                        {dept.code} – {dept.name}
                      </div>
                      <div className="text-[10px] text-surface-400 truncate">
                        {isUploaded ? (
                          <span>
                            Uploaded: <span className="font-mono text-emerald-700 font-semibold">{submission.file_name}</span> by {submission.user?.full_name}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Pending spreadsheet upload</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      "text-[9px] font-bold px-2 py-1 rounded-lg border flex-shrink-0",
                      isUploaded
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                    )}
                  >
                    {isUploaded ? "Ready" : "Missing"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
