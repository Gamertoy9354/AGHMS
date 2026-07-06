import React, { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock,
  MapPin, Users, CheckCircle, AlertCircle, Circle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMeetings } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { MEETING_STATUS_COLORS, MEETING_STATUS_LABELS } from '../../lib/constants';
import { PageHeader, Modal } from '../../components/ui/index';
import { formatDate } from '../../lib/supabaseHelpers';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function MeetingCalendarPage() {
  const today   = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [detailModal, setDetailModal] = useState(false);

  const { data: realMeetings, isLoading } = useMeetings({});
  const meetings = realMeetings || [];
  const { canManageMeetings } = useAuth();

  // Build date→meetings map
  const meetingMap = useMemo(() => {
    const map = {};
    meetings.forEach(m => {
      const d = m.meeting_date?.slice(0, 10);
      if (d) { if (!map[d]) map[d] = []; map[d].push(m); }
    });
    return map;
  }, [meetings]);

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfWk = getFirstDayOfMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDayOfWk; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    : null;
  const selectedMeetings = selectedDateStr ? (meetingMap[selectedDateStr] || []) : [];

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const statusDot = {
    draft:            'bg-surface-300',
    pending_approval: 'bg-warning-500',
    approved:         'bg-primary-500',
    circulated:       'bg-accent-500',
    conducted:        'bg-success-500',
    cancelled:        'bg-danger-500',
  };

  // Upcoming meetings (next 30 days)
  const upcoming = meetings
    .filter(m => m.meeting_date >= todayStr)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
    .slice(0, 5);

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Meeting Calendar"
        subtitle="Annual HOD meeting schedule and planning calendar"
        actions={
          canManageMeetings && (
            <Link to="/meetings/agendas/new" className="btn-primary text-sm">
              <Plus size={14} /> Schedule Meeting
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 card p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prev} className="p-2 rounded-xl hover:bg-surface-100 transition-colors">
              <ChevronLeft size={18} className="text-surface-600" />
            </button>
            <h2 className="text-lg font-bold text-surface-900">{MONTHS[month]} {year}</h2>
            <button onClick={next} className="p-2 rounded-xl hover:bg-surface-100 transition-colors">
              <ChevronRight size={18} className="text-surface-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-surface-400 py-1">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayMeetings = meetingMap[dateStr] || [];
              const isToday     = dateStr === todayStr;
              const isSelected  = day === selectedDay;
              const isPast      = dateStr < todayStr;

              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDay(day); if (dayMeetings.length) setDetailModal(true); }}
                  className={`
                    relative p-1.5 rounded-xl min-h-[52px] text-left transition-all
                    ${isSelected ? 'bg-primary-100 ring-2 ring-primary-400' : 'hover:bg-surface-50'}
                    ${isToday ? 'ring-2 ring-primary-500' : ''}
                  `}
                >
                  <span className={`
                    text-sm font-semibold block mb-1
                    ${isToday ? 'text-primary-700' : isPast ? 'text-surface-300' : 'text-surface-700'}
                  `}>{day}</span>
                  <div className="flex flex-wrap gap-0.5">
                    {dayMeetings.slice(0, 2).map((m, i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${statusDot[m.status] || 'bg-surface-300'}`} title={m.agenda_title} />
                    ))}
                    {dayMeetings.length > 2 && (
                      <span className="text-[9px] text-surface-400 font-bold">+{dayMeetings.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-surface-100">
            {Object.entries(statusDot).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-xs text-surface-500">{MEETING_STATUS_LABELS[status]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-800 mb-4">Upcoming Meetings</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">No upcoming meetings</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(m => {
                  const d = new Date(m.meeting_date);
                  return (
                    <Link key={m.id} to={`/meetings/agendas/${m.id}`} className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors group">
                      <div className="text-center bg-primary-50 rounded-lg p-2 flex-shrink-0 w-12">
                        <p className="text-xs text-primary-500 font-semibold">{MONTHS[d.getMonth()].slice(0,3)}</p>
                        <p className="text-lg font-black text-primary-700">{d.getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-800 group-hover:text-primary-700 transition-colors line-clamp-2">{m.agenda_title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge text-[10px] ${MEETING_STATUS_COLORS[m.status]}`}>{MEETING_STATUS_LABELS[m.status]}</span>
                          {m.meeting_time && <span className="text-xs text-surface-400">{m.meeting_time}</span>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-800 mb-3">This Year</h3>
            <div className="space-y-2">
              {[
                { label: 'Scheduled', count: meetings.filter(m=>m.status!=='cancelled').length, color:'text-primary-700' },
                { label: 'Conducted', count: meetings.filter(m=>m.status==='conducted').length, color:'text-success-700' },
                { label: 'Pending',   count: meetings.filter(m=>m.status==='pending_approval').length, color:'text-warning-700' },
                { label: 'Cancelled', count: meetings.filter(m=>m.status==='cancelled').length, color:'text-danger-700' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-surface-600">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      <Modal
        open={detailModal && selectedMeetings.length > 0}
        onClose={() => setDetailModal(false)}
        title={selectedDateStr ? formatDate(selectedDateStr) : ''}
        size="sm"
      >
        <div className="space-y-3">
          {selectedMeetings.map(m => (
            <div key={m.id} className="p-3 rounded-xl border border-surface-100 hover:bg-surface-50">
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge text-xs ${MEETING_STATUS_COLORS[m.status]}`}>{MEETING_STATUS_LABELS[m.status]}</span>
              </div>
              <p className="text-sm font-semibold text-surface-800">{m.agenda_title}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                {m.meeting_time && <span className="flex items-center gap-1"><Clock size={11} />{m.meeting_time}</span>}
                {m.venue && <span className="flex items-center gap-1"><MapPin size={11} />{m.venue}</span>}
              </div>
              <Link to={`/meetings/agendas/${m.id}`} onClick={() => setDetailModal(false)} className="text-xs text-primary-600 font-medium hover:underline mt-2 inline-block">
                View details →
              </Link>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
