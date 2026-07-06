import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Clock, AlertTriangle, TrendingUp, Plus, Download,
  Search, Filter, ChevronRight, MoreVertical, Percent
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useActionItems, useUpdateActionStatus, useAddAtrUpdate } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal, FormField, ProgressBar, EmptyState, SkeletonTable, SearchBar, Spinner, StatusBadge } from '../../components/ui/index';
import { formatDate } from '../../lib/supabaseHelpers';

const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', delayed: 'Delayed' };
const STATUS_STYLES = { pending: 'badge-surface', in_progress: 'badge-primary', completed: 'badge-success', delayed: 'badge-danger' };

const MOCK = [
  { id:1, description:'Submit CO attainment data for all subjects', meeting:{agenda_title:'Monthly HOD Meeting – May 2025', meeting_date:'2025-05-10'}, assigned_dept:{code:'CSE',name:'Computer Science & Engineering'}, assigned_user:{full_name:'CSE Faculty Member'}, deadline:'2025-05-25', status:'in_progress', completion_percentage:60, atr_updates:[{id:'a1',progress_description:'CSE dept 70% done',created_at:'2025-05-18T10:00:00Z'}] },
  { id:2, description:'Upload NAAC criterion 2.4 evidence', meeting:{agenda_title:'Monthly HOD Meeting – May 2025', meeting_date:'2025-05-10'}, assigned_dept:{code:'MECH',name:'Mechanical Engineering'}, assigned_user:{full_name:'MECH Faculty Member'}, deadline:'2025-05-20', status:'delayed', completion_percentage:20, atr_updates:[] },
  { id:3, description:'Prepare list of weak students with remedial plan', meeting:{agenda_title:'Monthly HOD Meeting – Apr 2025', meeting_date:'2025-04-12'}, assigned_dept:{code:'ELE',name:'Electrical Engineering'}, assigned_user:{full_name:'ELE Faculty Member'}, deadline:'2025-04-30', status:'completed', completion_percentage:100, atr_updates:[] },
  { id:4, description:'Submit placement readiness report', meeting:{agenda_title:'Monthly HOD Meeting – May 2025', meeting_date:'2025-05-10'}, assigned_dept:{code:'IT',name:'Information Technology'}, assigned_user:{full_name:'IT Faculty Member'}, deadline:'2025-05-28', status:'pending', completion_percentage:0, atr_updates:[] },
  { id:5, description:'Update faculty attendance register', meeting:{agenda_title:'Monthly HOD Meeting – Apr 2025', meeting_date:'2025-04-12'}, assigned_dept:{code:'CIV',name:'Civil Engineering'}, assigned_user:{full_name:'CIV Faculty Member'}, deadline:'2025-04-22', status:'delayed', completion_percentage:30, atr_updates:[] },
];

export default function ActionItemsPage() {
  const { user, isHOD, canApprove } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [newPct, setNewPct] = useState(0);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Use real data if available, fallback to mock
  const { data: realData, isLoading } = useActionItems({});
  const updateStatus = useUpdateActionStatus();
  const addUpdate    = useAddAtrUpdate();

  const items = (realData && realData.length > 0) ? realData : MOCK;

  const filtered = items.filter(i => {
    const matchSearch = i.description.toLowerCase().includes(search.toLowerCase()) ||
                        i.assigned_dept?.code?.toLowerCase().includes(search.toLowerCase()) ||
                        i.assigned_user?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    all:         items.length,
    pending:     items.filter(i => i.status === 'pending').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    completed:   items.filter(i => i.status === 'completed').length,
    delayed:     items.filter(i => i.status === 'delayed').length,
  };

  const openUpdate = (item) => {
    setSelectedItem(item);
    setNewPct(item.completion_percentage);
    setNewStatus(item.status);
    setUpdateText('');
    setUpdateModal(true);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      if (realData && realData.length > 0) {
        await updateStatus.mutateAsync({ id: selectedItem.id, status: newStatus, pct: newPct });
        if (updateText) await addUpdate.mutateAsync({
          action_item_id: selectedItem.id,
          progress_description: updateText,
          updated_by: user?.id,
          update_date: new Date().toISOString().split('T')[0],
        });
      }
      toast.success('Action item updated');
      setUpdateModal(false);
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const today = new Date();
  const isOverdue = (item) => item.status !== 'completed' && new Date(item.deadline) < today;

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Action Items / ATR"
        subtitle="Track action points from HOD meetings and compliance deadlines"
        actions={
          canApprove && <button className="btn-primary text-sm"><Plus size={14} /> Add Action</button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Actions', value: counts.all, icon: CheckSquare, color: 'bg-primary-50 border-primary-100 text-primary-600' },
          { label: 'In Progress',   value: counts.in_progress, icon: TrendingUp, color: 'bg-blue-50 border-blue-100 text-blue-600' },
          { label: 'Completed',     value: counts.completed, icon: CheckSquare, color: 'bg-success-50 border-success-100 text-success-600' },
          { label: 'Delayed',       value: counts.delayed, icon: AlertTriangle, color: 'bg-danger-50 border-danger-100 text-danger-600' },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="kpi-card">
              <div className={`p-2.5 rounded-xl border w-fit ${kpi.color}`}><Icon size={20} /></div>
              <p className="text-2xl font-bold text-surface-900">{kpi.value}</p>
              <p className="text-sm text-surface-600">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search + Filter */}
      <SearchBar value={search} onChange={setSearch} placeholder="Search by description, department, person…">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-auto text-sm">
          <option value="all">All Status ({counts.all})</option>
          <option value="pending">Pending ({counts.pending})</option>
          <option value="in_progress">In Progress ({counts.in_progress})</option>
          <option value="completed">Completed ({counts.completed})</option>
          <option value="delayed">Delayed ({counts.delayed})</option>
        </select>
      </SearchBar>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Action Item</th>
                <th>Meeting</th>
                <th>Assigned To</th>
                <th>Deadline</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-surface-400">No action items found</td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.id} className={isOverdue(item) ? 'bg-danger-50/30' : ''}>
                  <td className="max-w-xs">
                    <p className="text-sm font-medium text-surface-800 line-clamp-2">{item.description}</p>
                    {isOverdue(item) && <span className="badge-danger text-[10px] mt-1">Overdue</span>}
                    {item.atr_updates?.length > 0 && (
                      <p className="text-xs text-surface-400 mt-1">
                        Last update: {item.atr_updates.at(-1)?.progress_description?.slice(0,40)}…
                      </p>
                    )}
                  </td>
                  <td>
                    <p className="text-xs font-medium text-surface-700 line-clamp-1">{item.meeting?.agenda_title}</p>
                    <p className="text-xs text-surface-400">{formatDate(item.meeting?.meeting_date)}</p>
                  </td>
                  <td>
                    <p className="text-sm font-medium">{item.assigned_dept?.code || '—'}</p>
                    <p className="text-xs text-surface-400">{item.assigned_user?.full_name}</p>
                  </td>
                  <td>
                    <span className={`text-sm font-medium ${isOverdue(item) ? 'text-danger-600' : 'text-surface-700'}`}>
                      {formatDate(item.deadline)}
                    </span>
                  </td>
                  <td className="min-w-[120px]">
                    <ProgressBar value={item.completion_percentage} />
                  </td>
                  <td>
                    <span className={`badge ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                  </td>
                  <td>
                    <button onClick={() => openUpdate(item)} className="btn-ghost text-xs">Update</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Modal */}
      <Modal
        open={updateModal}
        onClose={() => setUpdateModal(false)}
        title="Update Action Item"
        footer={
          <>
            <button onClick={() => setUpdateModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleUpdate} disabled={saving} className="btn-primary">
              {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : null}
              Save Update
            </button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl">
              <p className="text-sm font-medium text-surface-800">{selectedItem.description}</p>
              <p className="text-xs text-surface-400 mt-1">
                {selectedItem.assigned_dept?.name} · Due {formatDate(selectedItem.deadline)}
              </p>
            </div>
            <FormField label="Status">
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="text-sm">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="delayed">Delayed</option>
              </select>
            </FormField>
            <FormField label={`Completion: ${newPct}%`}>
              <input type="range" min={0} max={100} step={5}
                     value={newPct} onChange={e => setNewPct(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-[10px] text-surface-400 mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </FormField>
            <FormField label="Progress Update" hint="Describe what was done or what obstacles exist">
              <textarea
                rows={3}
                value={updateText}
                onChange={e => setUpdateText(e.target.value)}
                placeholder="e.g. CO data submitted for 4 of 6 subjects…"
                className="text-sm"
              />
            </FormField>
            {selectedItem.atr_updates?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-500 mb-2">Previous Updates</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedItem.atr_updates.map(u => (
                    <div key={u.id} className="p-2 bg-surface-50 rounded-lg">
                      <p className="text-xs text-surface-700">{u.progress_description}</p>
                      <p className="text-[10px] text-surface-400 mt-0.5">{formatDate(u.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
