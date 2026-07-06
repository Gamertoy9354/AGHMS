import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, Plus, Upload, Download, Edit2, Trash2, CheckCircle,
  AlertTriangle, FileText, ChevronLeft, ChevronRight, List, Eye, Settings
} from 'lucide-react';
import { PageHeader, Modal, FormField, TabBar } from '../../components/ui/index';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  useAcademicEvents,
  useCreateAcademicEvent,
  useUpdateAcademicEvent,
  useDeleteAcademicEvent,
  useCurrentYear,
  useSemesters,
  useUpdateSemester
} from '../../hooks/useData';
import { academicEventsService } from '../../lib/services';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '../../lib/supabaseHelpers';
import { exportToCSV, exportCalendarToPDF } from '../../lib/exportUtils';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EVENT_TYPES = {
  academic:   { label: 'Academic', color: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100/70', badge: 'bg-primary-500' },
  exam:       { label: 'Exam', color: 'bg-danger-50 text-danger-700 border-danger-200 hover:bg-danger-100/70', badge: 'bg-danger-500' },
  submission: { label: 'Submission', color: 'bg-warning-50 text-warning-700 border-warning-200 hover:bg-warning-100/70', badge: 'bg-warning-500' },
  holiday:    { label: 'Holiday', color: 'bg-success-50 text-success-700 border-success-200 hover:bg-success-100/70', badge: 'bg-success-500' },
  vacation:   { label: 'Vacation', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70', badge: 'bg-purple-500' },
  other:      { label: 'Other', color: 'bg-surface-50 text-surface-700 border-surface-200 hover:bg-surface-100/70', badge: 'bg-surface-500' },
};

function getEventStyle(evt) {
  const isWeekendHoliday = evt.id?.toString().startsWith('sunday-') || 
                           evt.id?.toString().startsWith('2sat-') || 
                           evt.id?.toString().startsWith('4sat-');
  if (isWeekendHoliday) {
    return {
      label: 'Holiday',
      color: 'bg-surface-100 text-surface-600 border-surface-200 hover:bg-surface-200/70',
      badge: 'bg-surface-400'
    };
  }
  return EVENT_TYPES[evt.type] || {
    label: 'Other',
    color: 'bg-surface-50 text-surface-700 border-surface-200 hover:bg-surface-100/70',
    badge: 'bg-surface-500'
  };
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function getWeekendHoliday(year, month, day) {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  if (dayOfWeek === 0) {
    return {
      id: `sunday-${year}-${month}-${day}`,
      title: 'Sunday (Weekly Off)',
      type: 'holiday',
      start_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      week: 0,
      semester_type: 'both'
    };
  }
  
  if (dayOfWeek === 6) {
    const occurrence = Math.ceil(day / 7);
    if (occurrence === 2) {
      return {
        id: `2sat-${year}-${month}-${day}`,
        title: '2nd Saturday (Holiday)',
        type: 'holiday',
        start_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        week: 0,
        semester_type: 'both'
      };
    }
    if (occurrence === 4) {
      return {
        id: `4sat-${year}-${month}-${day}`,
        title: '4th Saturday (Holiday)',
        type: 'holiday',
        start_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        week: 0,
        semester_type: 'both'
      };
    }
  }
  
  return null;
}

function getAcademicWeekForDate(dateStr, semesters, tab) {
  const semester = semesters?.find(s => s.semester_type === tab);
  if (!semester || !semester.start_date || !semester.end_date) return null;
  
  const date = new Date(dateStr);
  const start = new Date(semester.start_date);
  const end = new Date(semester.end_date);
  
  date.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  
  if (date < start || date > end) return null;
  
  const diffTime = date - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return week <= 26 ? week : null;
}

function getWeekendHolidaysInRange(startDateStr, endDateStr, semesters, semesterType) {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  
  const holidays = [];
  let curr = new Date(start);
  
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth();
    const d = curr.getDate();
    
    const holiday = getWeekendHoliday(y, m, d);
    if (holiday) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const week = getAcademicWeekForDate(dateStr, semesters, semesterType);
      if (week !== null) {
        holidays.push({
          ...holiday,
          week: week,
          semester_type: semesterType
        });
      }
    }
    
    curr.setDate(curr.getDate() + 1);
  }
  
  return holidays;
}

export default function AcademicCalendarPage() {
  const { hasRole } = useAuth();
  const canManageCalendar = hasRole('director', 'principal', 'admin', 'hod', 'exam_cell');
  const canManageSemesters = hasRole('director', 'principal', 'admin');

  // Semester & View state
  const [tab, setTab] = useState('odd'); // 'odd' or 'even'
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'

  // Month navigation state
  const today = new Date();
  const [year, setYear] = useState(2025); // Set default to 2025 to match seeded semester events
  const [month, setMonth] = useState(6); // Set default to July (index 6) to show Odd Sem events immediately

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  
  // Selected day details state
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState('academic');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState([1]);
  const [semesterType, setSemesterType] = useState('odd');

  // Semester Configuration Date states
  const [oddStart, setOddStart] = useState('');
  const [oddEnd, setOddEnd] = useState('');
  const [evenStart, setEvenStart] = useState('');
  const [evenEnd, setEvenEnd] = useState('');

  // Backend connection hooks
  const { data: currentYear } = useCurrentYear();
  const { data: rawEvents, isLoading } = useAcademicEvents(
    currentYear?.id ? { academic_year_id: currentYear.id } : {}
  );
  
  const { data: semesters } = useSemesters(currentYear?.id);
  const updateSemesterMutation = useUpdateSemester();
  
  // Mutations
  const createMutation = useCreateAcademicEvent();
  const updateMutation = useUpdateAcademicEvent();
  const deleteMutation = useDeleteAcademicEvent();
  
  const queryClient = useQueryClient();
  const bulkImportMutation = useMutation({
    mutationFn: academicEventsService.bulkImport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic_events'] }),
  });

  // Keep semesterType in sync with active semester tab in modal when opening Add
  useEffect(() => {
    setSemesterType(tab);
    // Auto-focus calendar view month on tab switch based on configured semesters
    const activeSem = semesters?.find(s => s.semester_type === tab);
    if (activeSem?.start_date) {
      const d = new Date(activeSem.start_date);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    } else {
      if (tab === 'odd') {
        setYear(2025);
        setMonth(6); // July 2025
      } else {
        setYear(2025);
        setMonth(11); // December 2025
      }
    }
  }, [tab, semesters]);

  // Filter events based on active semester tab
  const events = useMemo(() => {
    if (!rawEvents) return [];
    return rawEvents.filter(e => e.semester_type === tab);
  }, [rawEvents, tab]);

  // Compute weekend holidays for the active semester tab dynamically
  const activeSemester = semesters?.find(s => s.semester_type === tab);
  const weekendHolidays = useMemo(() => {
    if (!activeSemester?.start_date || !activeSemester?.end_date) return [];
    return getWeekendHolidaysInRange(activeSemester.start_date, activeSemester.end_date, semesters, tab);
  }, [activeSemester, semesters, tab]);

  // Map events to date strings (YYYY-MM-DD) taking range into account
  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(evt => {
      const start = new Date(evt.start_date);
      const end = new Date(evt.end_date);
      
      // Zero out time
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      
      let curr = new Date(start);
      while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(evt);
        
        curr.setDate(curr.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  // Month navigation actions
  const prevMonth = () => {
    if (month === 0) {
      setYear(y => y - 1);
      setMonth(11);
    } else {
      setMonth(m => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setYear(y => y + 1);
      setMonth(0);
    } else {
      setMonth(m => m + 1);
    }
  };

  // Form open/save triggers
  const openAdd = () => {
    setEditingEvent(null);
    setTitle('');
    setType('academic');
    setStartDate('');
    setEndDate('');
    setSelectedWeeks([1]);
    setSemesterType(tab);
    setIsModalOpen(true);
  };

  const openEdit = (e) => {
    setEditingEvent(e);
    setTitle(e.title);
    setType(e.type);
    setStartDate(e.start_date);
    setEndDate(e.end_date);
    const parsedWeeks = e.week
      ? e.week.toString().split(',').map(s => parseInt(s.trim(), 10)).filter(w => !isNaN(w))
      : [1];
    setSelectedWeeks(parsedWeeks);
    setSemesterType(e.semester_type);
    setIsDetailModalOpen(false);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!title || !startDate || !endDate) {
      toast.error('Please fill all required fields');
      return;
    }
    if (selectedWeeks.length === 0) {
      toast.error('Please select at least one academic week');
      return;
    }
    if (!currentYear?.id) {
      toast.error('No current academic year selected');
      return;
    }

    const payload = {
      title,
      type,
      start_date: startDate,
      end_date: endDate,
      week: selectedWeeks.sort((a, b) => a - b).join(','),
      semester_type: semesterType,
      academic_year_id: currentYear.id,
    };

    try {
      if (editingEvent) {
        await updateMutation.mutateAsync({ id: editingEvent.id, ...payload });
        toast.success('Academic event updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Academic event created successfully');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save academic event');
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Academic event deleted successfully');
      setIsDetailModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event');
    }
  };

  const openConfigureSemesters = () => {
    const oddSem = semesters?.find(s => s.semester_type === 'odd');
    const evenSem = semesters?.find(s => s.semester_type === 'even');
    
    setOddStart(oddSem?.start_date || '');
    setOddEnd(oddSem?.end_date || '');
    setEvenStart(evenSem?.start_date || '');
    setEvenEnd(evenSem?.end_date || '');
    
    setIsSemesterModalOpen(true);
  };

  const handleSaveSemesters = async () => {
    const oddSem = semesters?.find(s => s.semester_type === 'odd');
    const evenSem = semesters?.find(s => s.semester_type === 'even');
    
    if (!oddSem || !evenSem) {
      toast.error('Semester records not found for current year.');
      return;
    }
    
    if (!oddStart || !oddEnd || !evenStart || !evenEnd) {
      toast.error('All start and end dates are required.');
      return;
    }
    
    try {
      await Promise.all([
        updateSemesterMutation.mutateAsync({ id: oddSem.id, start_date: oddStart, end_date: oddEnd }),
        updateSemesterMutation.mutateAsync({ id: evenSem.id, start_date: evenStart, end_date: evenEnd })
      ]);
      toast.success('Semesters configured successfully');
      setIsSemesterModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update semester configuration');
    }
  };

  const handleExportYear = () => {
    if (!rawEvents) {
      toast.error('No events available to export.');
      return;
    }
    
    const oddSem = semesters?.find(s => s.semester_type === 'odd');
    const evenSem = semesters?.find(s => s.semester_type === 'even');
    
    const oddWeekendHolidays = oddSem?.start_date && oddSem?.end_date 
      ? getWeekendHolidaysInRange(oddSem.start_date, oddSem.end_date, semesters, 'odd') 
      : [];
    const evenWeekendHolidays = evenSem?.start_date && evenSem?.end_date 
      ? getWeekendHolidaysInRange(evenSem.start_date, evenSem.end_date, semesters, 'even') 
      : [];

    const allEvents = [...rawEvents, ...oddWeekendHolidays, ...evenWeekendHolidays];
    
    if (allEvents.length === 0) {
      toast.error('No events available to export.');
      return;
    }

    // Sort events by date
    const sortedEvents = allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    
    const exportData = sortedEvents.map(evt => ({
      'Event Title': evt.title,
      'Type': EVENT_TYPES[evt.type]?.label || evt.type,
      'Start Date': evt.start_date,
      'End Date': evt.end_date,
      'Academic Week': evt.week ? `Week ${evt.week}` : 'N/A',
      'Semester': evt.semester_type === 'odd' ? 'Odd Semester' : evt.semester_type === 'even' ? 'Even Semester' : 'Both Semesters'
    }));
    
    exportToCSV(exportData, `Academic_Calendar_${currentYear?.year_name || 'Year'}.csv`);
    toast.success('Whole year calendar exported successfully!');
  };

  const handleExportPDF = () => {
    if (!rawEvents) {
      toast.error('No events available to export.');
      return;
    }
    try {
      exportCalendarToPDF(rawEvents, semesters, currentYear);
      toast.success('Calendar PDF exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF.');
    }
  };

  const handleDateClick = (day) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setSelectedDateStr(dateStr);
    const customEvents = eventMap[dateStr] || [];
    const weekendHoliday = getWeekendHoliday(year, month, day);
    const dayEvents = weekendHoliday ? [...customEvents, weekendHoliday] : customEvents;
    setSelectedDayEvents(dayEvents);

    if (dayEvents.length > 0) {
      setIsDetailModalOpen(true);
    } else if (canManageCalendar) {
      // Direct quick-add pre-fill
      setEditingEvent(null);
      setTitle('');
      setType('academic');
      setStartDate(dateStr);
      setEndDate(dateStr);
      const computedWeek = getAcademicWeekForDate(dateStr, semesters, tab);
      setSelectedWeeks(computedWeek ? [computedWeek] : [1]);
      setSemesterType(tab);
      setIsModalOpen(true);
    }
  };

  // CSV/JSON Data Import parser
  const handleUploadData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentYear?.id) {
      toast.error('Cannot import: current academic year is missing.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        let imported = [];
        
        if (file.name.endsWith('.json')) {
          imported = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, idx) => {
              row[h] = values[idx];
            });
            imported.push(row);
          }
        } else {
          toast.error('Unsupported file format. Please upload CSV or JSON.');
          return;
        }

        const parsedRows = imported.map(item => ({
          academic_year_id: currentYear.id,
          title: item.title || item.eventtitle || 'Untitled Event',
          type: item.type || 'academic',
          start_date: item.start_date || item.startdate || new Date().toISOString().split('T')[0],
          end_date: item.end_date || item.enddate || new Date().toISOString().split('T')[0],
          week: (item.week || item.academicweek || '1').toString().trim(),
          semester_type: item.semester_type || item.semestertype || tab,
        }));

        await bulkImportMutation.mutateAsync(parsedRows);
        toast.success(`${parsedRows.length} events uploaded and synchronized successfully!`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse and synchronize calendar data. Check file structure.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  // Generate calendar grid structure
  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfWk = getFirstDayOfMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDayOfWk; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Group events by week for the Weekly list view
  const weeks = Array.from({ length: 26 }, (_, i) => i + 1);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Academic Calendar"
        subtitle={`Schedule and plan academic milestones for ${currentYear?.year_name || 'Academic Year'}.`}
        actions={
          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-xl border border-surface-200">
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'month' ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                <Calendar size={13} /> Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'week' ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                <List size={13} /> Week List
              </button>
            </div>

            <button onClick={handleExportYear} className="btn-secondary text-sm">
              <Download size={14} /> Export Year
            </button>

            <button onClick={handleExportPDF} className="btn-secondary text-sm flex items-center gap-1.5 border-primary-200 text-primary-700 bg-primary-50/50 hover:bg-primary-50">
              <FileText size={14} className="text-primary-600" /> Export PDF
            </button>

            {canManageCalendar && (
              <div className="flex gap-2">
                {canManageSemesters && (
                  <button onClick={openConfigureSemesters} className="btn-secondary text-sm flex items-center gap-1.5">
                    <Settings size={14} /> Configure Semesters
                  </button>
                )}
                <button onClick={() => document.getElementById('upload-data').click()} className="btn-secondary text-sm">
                  <Upload size={14} /> Upload Data
                  <input id="upload-data" type="file" accept=".csv,.json" className="hidden" onChange={handleUploadData} />
                </button>
                <button onClick={openAdd} className="btn-primary text-sm">
                  <Plus size={14} /> Add Event
                </button>
              </div>
            )}
          </div>
        }
      />

      <TabBar 
        tabs={[{id:'odd', label:'Odd Semester'}, {id:'even', label:'Even Semester'}]} 
        active={tab} 
        onChange={setTab} 
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64 mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          <span className="ml-3 text-sm text-surface-500 font-medium">Syncing calendar...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          {/* Main Calendar Space */}
          <div className="lg:col-span-3">
            {viewMode === 'month' ? (
              <div className="card p-5 shadow-sm border border-surface-200">
                {/* Month Selector header */}
                <div className="flex items-center justify-between mb-5">
                  <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-surface-100 transition-colors border border-surface-100 shadow-sm bg-white">
                    <ChevronLeft size={18} className="text-surface-600" />
                  </button>
                  <h2 className="text-lg font-extrabold text-surface-800 tracking-tight select-none">
                    {MONTHS[month]} {year}
                  </h2>
                  <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-surface-100 transition-colors border border-surface-100 shadow-sm bg-white">
                    <ChevronRight size={18} className="text-surface-600" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2 border-b border-surface-100 pb-2">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-surface-400 uppercase tracking-wider py-1">{d}</div>
                  ))}
                </div>

                {/* Cells Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="bg-surface-50/50 rounded-xl border border-dashed border-surface-100 min-h-[96px]" />;
                    
                    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const customEvents = eventMap[dateStr] || [];
                    const weekendHoliday = getWeekendHoliday(year, month, day);
                    const dayEvents = weekendHoliday ? [...customEvents, weekendHoliday] : customEvents;
                    const isToday     = dateStr === todayStr;
                    const isWeekend   = weekendHoliday !== null;
                    
                    return (
                      <button
                        key={day}
                        onClick={() => handleDateClick(day)}
                        className={`
                          relative p-2 rounded-xl min-h-[96px] text-left transition-all flex flex-col justify-between border
                          ${isToday ? 'bg-primary-50/30 border-primary-300 ring-1 ring-primary-300' : isWeekend ? 'bg-surface-50/60 border-surface-200 hover:border-surface-300 hover:shadow-sm' : 'bg-white border-surface-200 hover:border-surface-300 hover:shadow-sm'}
                        `}
                      >
                        <span className={`
                          text-xs font-bold block mb-1.5 px-1 py-0.5 rounded-md w-fit
                          ${isToday ? 'bg-primary-500 text-white shadow-sm' : 'text-surface-600'}
                        `}>{day}</span>
                        
                        <div className="flex-1 w-full space-y-1 overflow-hidden">
                          {dayEvents.slice(0, 2).map(evt => {
                            const style = getEventStyle(evt);
                            return (
                              <div
                                key={evt.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded-md truncate font-semibold border leading-tight ${style.color}`}
                              >
                                {evt.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="text-[9px] text-surface-400 font-bold pl-1.5 flex items-center gap-1">
                              <Eye size={10} /> +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Original Weekly schedule list layout */
              <div className="card p-5 border border-surface-200">
                <h3 className="text-base font-bold text-surface-800 mb-4 flex items-center gap-2">
                  <List size={18} className="text-primary-600" />
                  Weekly Schedule ({tab === 'odd' ? 'Odd' : 'Even'} Sem)
                </h3>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {weeks.map(w => {
                    const weekEvents = [
                      ...events.filter(e => {
                        if (!e.week) return false;
                        const eventWeeks = e.week.toString().split(',').map(s => parseInt(s.trim(), 10));
                        return eventWeeks.includes(w);
                      }),
                      ...weekendHolidays.filter(e => e.week === w)
                    ].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                    const isOccupied = weekEvents.length > 0;
                    
                    return (
                      <div key={w} className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all ${isOccupied ? 'bg-white border-surface-200 shadow-sm' : 'bg-surface-50 border-surface-100 border-dashed'}`}>
                        <div className="w-16 flex-shrink-0 flex items-center">
                          <span className="text-sm font-extrabold text-surface-500">Week {w}</span>
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          {weekEvents.length === 0 ? (
                            <span className="text-sm text-surface-400 italic font-medium py-1">No events scheduled</span>
                          ) : (
                            weekEvents.map(evt => {
                              const style = getEventStyle(evt);
                              return (
                                <div key={evt.id} className={`flex items-center justify-between p-3 rounded-xl border shadow-sm transition-all ${style.color}`}>
                                  <div>
                                    <p className="font-bold text-sm text-surface-800 flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${style.badge}`} />
                                      {evt.title}
                                    </p>
                                    <p className="text-xs text-surface-500 font-semibold mt-1">
                                      {formatDate(evt.start_date)} to {formatDate(evt.end_date)}
                                    </p>
                                  </div>
                                  {canManageCalendar && !evt.id.toString().startsWith('sunday-') && !evt.id.toString().startsWith('2sat-') && !evt.id.toString().startsWith('4sat-') && (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => openEdit(evt)} className="p-2 hover:bg-black/5 rounded-lg transition-colors text-surface-500 hover:text-surface-700"><Edit2 size={13} /></button>
                                      <button onClick={() => handleDeleteEvent(evt.id)} className="p-2 hover:bg-black/5 rounded-lg transition-colors text-danger-500 hover:text-danger-700"><Trash2 size={13} /></button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Summary & Information */}
          <div className="space-y-6">
            <div className="card p-5 border border-surface-200 shadow-sm">
              <h3 className="text-sm font-bold text-surface-800 mb-4 uppercase tracking-wider">Event Legend</h3>
              <div className="space-y-3.5">
                {Object.entries(EVENT_TYPES).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3 text-sm font-semibold text-surface-700">
                    <span className={`w-3.5 h-3.5 rounded-full border ${v.badge} shadow-sm`} />
                    <span className="text-surface-600">{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/60 shadow-sm rounded-2xl">
              <h3 className="text-primary-800 font-extrabold mb-2.5 flex items-center gap-2">
                <AlertTriangle size={18} className="text-primary-600 animate-bounce" /> 
                Planner Note
              </h3>
              <p className="text-primary-700/90 text-xs leading-relaxed font-semibold">
                Ensure that mid-semester exams and submission weeks do not heavily overlap with placement drives or major holidays to keep student stress levels and logistics manageable.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Add/Edit Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEvent ? 'Edit Calendar Event' : 'Add Calendar Event'} size="md"
             footer={
               <div className="flex gap-2 justify-end">
                 <button className="btn-secondary text-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
                 <button className="btn-primary text-sm" onClick={handleSaveEvent}>Save Event</button>
               </div>
             }>
        <div className="space-y-4 py-1">
          <FormField label="Event Title" required>
            <input type="text" className="input-base text-sm" placeholder="e.g., Mid Sem 1" value={title} onChange={e => setTitle(e.target.value)} />
          </FormField>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Event Type" required>
              <select className="input-base text-sm" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </FormField>
            <FormField label="Academic Weeks (Select all that apply)" required>
              <div className="mt-1 bg-surface-50 border border-surface-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                <div className="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-9 gap-1.5">
                  {Array.from({ length: 26 }, (_, i) => i + 1).map(w => {
                    const isSelected = selectedWeeks.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedWeeks(selectedWeeks.filter(x => x !== w));
                          } else {
                            setSelectedWeeks([...selectedWeeks, w]);
                          }
                        }}
                        className={`h-8 w-8 text-xs font-bold rounded-lg border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-primary-500 text-white border-primary-600 shadow-sm'
                            : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-100 hover:text-surface-800'
                        }`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-1 text-[10px] text-surface-400 font-semibold pl-1">
                Selected: {selectedWeeks.length > 0 ? selectedWeeks.sort((a,b) => a-b).join(', ') : 'None'}
              </div>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Semester Type" required>
              <select className="input-base text-sm" value={semesterType} onChange={e => setSemesterType(e.target.value)}>
                <option value="odd">Odd Semester</option>
                <option value="even">Even Semester</option>
              </select>
            </FormField>
            <FormField label="Current Semester Year">
              <input type="text" className="input-base text-sm bg-surface-50 text-surface-500 cursor-not-allowed" value={currentYear?.year_name || ''} disabled />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" required>
              <input type="date" className="input-base text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End Date" required>
              <input type="date" className="input-base text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Day Details Modal */}
      <Modal
        open={isDetailModalOpen && selectedDayEvents.length > 0}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedDateStr ? `Events on ${formatDate(selectedDateStr)}` : 'Day Schedule'}
        size="sm"
      >
        <div className="space-y-3.5 py-1">
          {selectedDayEvents.map(evt => {
            const style = getEventStyle(evt);
            return (
              <div key={evt.id} className="p-4 rounded-xl border border-surface-200 shadow-sm bg-white hover:shadow-md transition-all">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`badge text-xs font-bold px-2 py-0.5 border ${style.color}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-surface-400 font-extrabold">
                    {evt.week && evt.week !== 0 ? `Week(s): ${evt.week}` : 'N/A'}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-surface-800 leading-snug">{evt.title}</h4>
                <p className="text-xs text-surface-500 font-semibold mt-1">
                  Range: {formatDate(evt.start_date)} to {formatDate(evt.end_date)}
                </p>
                
                {canManageCalendar && !evt.id.toString().startsWith('sunday-') && !evt.id.toString().startsWith('2sat-') && !evt.id.toString().startsWith('4sat-') && (
                  <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-surface-100">
                    <button onClick={() => openEdit(evt)} className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold">
                      <Edit2 size={11} /> Edit
                    </button>
                    <button onClick={() => handleDeleteEvent(evt.id)} className="btn-secondary text-xs text-danger-600 hover:text-danger-700 hover:bg-danger-50 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Semester Configuration Modal */}
      <Modal
        open={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
        title="Configure Semesters"
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary text-sm" onClick={() => setIsSemesterModalOpen(false)}>Cancel</button>
            <button className="btn-primary text-sm" onClick={handleSaveSemesters}>Save Changes</button>
          </div>
        }
      >
        <div className="space-y-5 py-2">
          <p className="text-xs text-surface-500 font-semibold leading-relaxed">
            Specify the duration for both semesters in <span className="text-surface-700 font-bold">{currentYear?.year_name || 'the current year'}</span>. This configuration dynamically defines calendar views and centers appropriate months.
          </p>

          <div className="border border-surface-200 rounded-xl p-4 bg-surface-50/50 space-y-4">
            <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-500" /> Odd Semester
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" required>
                <input type="date" className="input-base text-sm" value={oddStart} onChange={e => setOddStart(e.target.value)} />
              </FormField>
              <FormField label="End Date" required>
                <input type="date" className="input-base text-sm" value={oddEnd} onChange={e => setOddEnd(e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="border border-surface-200 rounded-xl p-4 bg-surface-50/50 space-y-4">
            <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success-500" /> Even Semester
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" required>
                <input type="date" className="input-base text-sm" value={evenStart} onChange={e => setEvenStart(e.target.value)} />
              </FormField>
              <FormField label="End Date" required>
                <input type="date" className="input-base text-sm" value={evenEnd} onChange={e => setEvenEnd(e.target.value)} />
              </FormField>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
