import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Filter, Calendar, Clock, ChevronRight,
  Eye, Edit, Trash2, CheckCircle, XCircle, Send, FileText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MEETING_STATUS_LABELS, MEETING_STATUS_COLORS, MEETING_CATEGORIES } from '../../lib/constants';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useMeetings, useUpdateMeeting, useApproveMeeting, useCirculateMeeting } from '../../hooks/useData';
import { Spinner } from '../../components/ui/index';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['all', 'draft', 'pending_approval', 'approved', 'circulated', 'conducted', 'cancelled'];

export default function AgendasPage() {
  const { canApprove, canManageMeetings } = useAuth();
  const [search, setSearch]       = useState('');
  const [statusFilter, setFilter] = useState('all');
  
  const { data: meetings, isLoading, isError } = useMeetings();
  const approveMeeting = useApproveMeeting();
  const updateMeeting = useUpdateMeeting();
  const circulateMeeting = useCirculateMeeting();

  const handleApprove = async (id) => {
    try {
      await approveMeeting.mutateAsync(id);
      toast.success('Meeting approved successfully!');
    } catch (error) {
      toast.error('Failed to approve meeting');
    }
  };

  const handleReject = async (id) => {
    try {
      await updateMeeting.mutateAsync({ id, status: 'draft' });
      toast.success('Meeting rejected and moved to draft');
    } catch (error) {
      toast.error('Failed to reject meeting');
    }
  };

  const handleCirculate = async (id) => {
    try {
      const circNo = `RNGPIT/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
      await circulateMeeting.mutateAsync({ id, circularNumber: circNo });
      toast.success('Meeting circulated! Circular No: ' + circNo);
    } catch (error) {
      toast.error('Failed to circulate meeting');
    }
  };

  const filtered = (meetings || []).filter(m => {
    const matchSearch = m.agenda_title?.toLowerCase().includes(search.toLowerCase()) ||
                        m.venue?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getDocProgress = (submitted, required) => {
    if (!required) return 0;
    return Math.round((submitted / required) * 100);
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="section-header mb-6">
        <div>
          <h1 className="section-title">Meeting Agendas</h1>
          <p className="section-subtitle">
            Manage HOD meeting agendas, approvals, and circulars
          </p>
        </div>
        {canManageMeetings && (
          <Link to="/meetings/agendas/new" className="btn-primary">
            <Plus size={16} /> Create Agenda
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="search"
              placeholder="Search agendas, venues…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  statusFilter === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                )}
              >
                {s === 'all' ? 'All' : MEETING_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Meetings', value: (meetings || []).length, color: 'text-primary-600' },
          { label: 'Pending Approval', value: (meetings || []).filter(m => m.status === 'pending_approval').length, color: 'text-warning-600' },
          { label: 'Circulated', value: (meetings || []).filter(m => m.status === 'circulated').length, color: 'text-accent-600' },
          { label: 'Conducted', value: (meetings || []).filter(m => m.status === 'conducted').length, color: 'text-success-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Meeting List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-12 flex justify-center items-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar size={40} className="mx-auto text-surface-300 mb-3" />
            <h3 className="text-surface-600 font-medium">No meetings found</h3>
            <p className="text-surface-400 text-sm mt-1">
              {search ? 'Try adjusting your search or filters' : 'Create a new agenda to get started'}
            </p>
          </div>
        ) : (
          filtered.map(meeting => {
            const agendaCount = meeting.agenda_items?.length || 0;
            const docsRequired = meeting.agenda_items?.reduce((acc, item) => acc + (item.required_documents?.length || 0), 0) || 0;
            const docsSubmitted = meeting.documents?.length || 0;
            const progress = getDocProgress(docsSubmitted, docsRequired);
            
            const badgeClass = MEETING_STATUS_COLORS[meeting.status] || 'badge-surface';
            
            return (
              <div key={meeting.id} className="card p-5 hover:shadow-card-hover transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Date box */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 border border-primary-100
                                  flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-primary-700 leading-none">
                      {new Date(meeting.meeting_date).getDate()}
                    </span>
                    <span className="text-xs text-primary-500 uppercase">
                      {new Date(meeting.meeting_date).toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`badge ${badgeClass}`}>
                        {MEETING_STATUS_LABELS[meeting.status]}
                      </span>
                      {meeting.category && (
                        <span className="badge-surface">{meeting.category}</span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-surface-900 mb-1">
                      {meeting.agenda_title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(meeting.meeting_date).toLocaleDateString('en-IN', {
                          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                        })} at {meeting.meeting_time}
                      </span>
                      <span>📍 {meeting.venue}</span>
                      <span>📋 {agendaCount} agenda items</span>
                      {meeting.circular_number && (
                        <span className="text-primary-600 font-medium">#{meeting.circular_number}</span>
                      )}
                    </div>

                    {/* Document progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-surface-500">
                          Documents: {docsSubmitted}/{docsRequired}
                        </span>
                        <span className={`text-xs font-semibold ${
                          progress === 100 ? 'text-success-600' :
                          progress >= 60  ? 'text-warning-600' : 'text-danger-600'
                        }`}>{progress}%</span>
                      </div>
                      <div className="progress">
                        <div
                          className={`progress-bar ${
                            progress === 100 ? 'bg-success-500' :
                            progress >= 60  ? 'bg-warning-500' : 'bg-danger-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-col sm:items-end">
                    <Link to={`/meetings/agendas/${meeting.id}`} className="btn-secondary text-xs">
                      <Eye size={13} /> View
                    </Link>
                    {canManageMeetings && meeting.status === 'draft' && (
                      <Link to={`/meetings/agendas/${meeting.id}/edit`} className="btn-ghost text-xs">
                        <Edit size={13} /> Edit
                      </Link>
                    )}
                    {canApprove && meeting.status === 'pending_approval' && (
                      <>
                        <button onClick={() => handleApprove(meeting.id)} className="btn-success text-xs">
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button onClick={() => handleReject(meeting.id)} className="btn-danger text-xs">
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    )}
                    {canManageMeetings && meeting.status === 'approved' && (
                      <button onClick={() => handleCirculate(meeting.id)} className="btn-primary text-xs">
                        <Send size={13} /> Circulate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
