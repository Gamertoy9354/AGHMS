import React, { useState, useMemo } from 'react';
import {
  TrendingDown, UserX, Plus, AlertTriangle, CheckCircle,
  Phone, Edit, Download, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWeakStudents, useUpdateWeakStudent } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, ProgressBar, SearchBar, EmptyState, TabBar, Modal, FormField, Spinner } from '../../components/ui/index';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/supabaseHelpers';

// DEPT_STATS is computed dynamically from live data below

const STATUS_LABELS = { under_observation:'Under Observation', improving:'Improving', critical:'Critical', resolved:'Resolved' };
const STATUS_STYLES = { under_observation:'badge-warning', improving:'badge-primary', critical:'badge-danger', resolved:'badge-success' };

export default function WeakStudentsPage() {
  const { isHOD } = useAuth();
  const [tab, setTab]     = useState('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editModal, setEditModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: realData, isLoading } = useWeakStudents({});
  const updateWeak = useUpdateWeakStudent();
  const students = realData || [];

  const filtered = students.filter(s => {
    const matchSearch = (s.student?.full_name||'').toLowerCase().includes(search.toLowerCase()) ||
                        (s.student?.enrollment_number||'').includes(search) ||
                        (s.student?.department?.code||'').toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filterStatus === 'all' || s.status === filterStatus);
  });

  const counts = {
    all: students.length,
    critical: students.filter(s=>s.status==='critical').length,
    under_observation: students.filter(s=>s.status==='under_observation').length,
    improving: students.filter(s=>s.status==='improving').length,
    resolved: students.filter(s=>s.status==='resolved').length,
  };

  // Dynamic dept stats from live data
  const deptStats = useMemo(() => {
    const map = {};
    students.forEach(s => {
      const code = s.student?.department?.code || 'Unknown';
      if (!map[code]) map[code] = { dept: code, weak: 0, critical: 0 };
      map[code].weak += 1;
      if (s.status === 'critical') map[code].critical += 1;
    });
    return Object.values(map).sort((a, b) => b.weak - a.weak);
  }, [students]);

  const openEdit = (s) => { setSelected({...s}); setEditModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (realData && realData.length > 0) await updateWeak.mutateAsync({ id: selected.id, status: selected.status, action_taken: selected.action_taken, notes: selected.notes });
      toast.success('Updated!');
      setEditModal(false);
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Weak Student Monitoring"
        subtitle="Track academically at-risk students and remediation progress"
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(filtered, 'weak_students.csv')} className="btn-secondary text-sm"><Download size={14}/> Export</button>
            {isHOD && <button className="btn-primary text-sm"><Plus size={14}/> Add</button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total', value:counts.all, color:'bg-surface-50 text-surface-600', icon:UserX },
          { label:'Critical', value:counts.critical, color:'bg-danger-50 text-danger-600', icon:AlertTriangle },
          { label:'Improving', value:counts.improving, color:'bg-primary-50 text-primary-600', icon:TrendingDown },
          { label:'Resolved', value:counts.resolved, color:'bg-success-50 text-success-600', icon:CheckCircle },
        ].map(kpi => <div key={kpi.label} className="kpi-card">
          <div className={`p-2 rounded-xl w-fit ${kpi.color}`}><kpi.icon size={18}/></div>
          <p className="text-2xl font-bold">{kpi.value}</p>
          <p className="text-sm text-surface-500">{kpi.label}</p>
        </div>)}
      </div>

      <TabBar tabs={[{id:'list',label:'Student List',count:students.length},{id:'chart',label:'Dept View'}]} active={tab} onChange={setTab}/>

      {tab==='chart' && (
        <div className="card p-5 mb-6">
          <h3 className="text-base font-semibold mb-4">Weak Students by Department</h3>
          {deptStats.length === 0 ? (
            <p className="text-xs text-surface-400 text-center py-8">No data to display</p>
          ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="dept" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',fontSize:'12px'}}/>
              <Bar dataKey="weak" name="Under Observation" radius={[4,4,0,0]} fill="#f59e0b"/>
              <Bar dataKey="critical" name="Critical" radius={[4,4,0,0]} fill="#ef4444"/>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      )}

      {tab==='list' && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Search student…">
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-auto text-sm">
              <option value="all">All ({counts.all})</option>
              <option value="critical">Critical ({counts.critical})</option>
              <option value="under_observation">Under Obs. ({counts.under_observation})</option>
              <option value="improving">Improving ({counts.improving})</option>
              <option value="resolved">Resolved ({counts.resolved})</option>
            </select>
          </SearchBar>

          <div className="space-y-3">
            {filtered.length===0 && <EmptyState icon={UserX} title="No students found"/>}
            {filtered.map(s => (
              <div key={s.id} className={`card p-4 ${s.status==='critical'?'border-l-4 border-danger-400':s.status==='improving'?'border-l-4 border-primary-300':''}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <p className="font-semibold text-surface-900">{s.student?.full_name}</p>
                      <span className="text-xs text-surface-400">{s.student?.enrollment_number}</span>
                      <span className="badge-surface text-xs">{s.student?.department?.code}</span>
                      <span className={`badge ${STATUS_STYLES[s.status]}`}>{STATUS_LABELS[s.status]}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div><p className="text-xs text-surface-400">Reason</p><p className="text-surface-700">{s.reason}</p></div>
                      <div><p className="text-xs text-surface-400">Action</p><p className="text-surface-700">{s.action_taken||'—'}</p></div>
                      <div><p className="text-xs text-surface-400">Faculty</p><p className="text-surface-700">{s.assigned_faculty?.full_name||'—'}</p></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className={`text-xl font-black ${s.sgpa>=5?'text-warning-600':'text-danger-600'}`}>{s.sgpa}</p>
                      <p className="text-xs text-surface-400">SGPA</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {s.student?.phone && <a href={`tel:${s.student.phone}`} className="btn-ghost p-1.5"><Phone size={12}/></a>}
                      <button onClick={()=>openEdit(s)} className="btn-secondary text-xs p-1.5"><Edit size={12}/></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={editModal} onClose={()=>setEditModal(false)} title="Update Weak Student"
        footer={<><button onClick={()=>setEditModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving?<Spinner size={13} className="border-t-white border-white/30"/>:null} Save</button></>}>
        {selected && <div className="space-y-4">
          <div className="p-3 bg-surface-50 rounded-xl"><p className="text-sm font-semibold">{selected.student?.full_name}</p></div>
          <FormField label="Status"><select value={selected.status} onChange={e=>setSelected(p=>({...p,status:e.target.value}))} className="text-sm">
            <option value="critical">Critical</option><option value="under_observation">Under Observation</option>
            <option value="improving">Improving</option><option value="resolved">Resolved</option>
          </select></FormField>
          <FormField label="Action Taken"><textarea rows={2} value={selected.action_taken||''} onChange={e=>setSelected(p=>({...p,action_taken:e.target.value}))} className="text-sm"/></FormField>
          <FormField label="Notes"><textarea rows={2} value={selected.notes||''} onChange={e=>setSelected(p=>({...p,notes:e.target.value}))} className="text-sm" placeholder="Additional observations…"/></FormField>
        </div>}
      </Modal>
    </div>
  );
}
