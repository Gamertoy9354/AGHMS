import React, { useState } from 'react';
import {
  IndianRupee, TrendingUp, TrendingDown, AlertCircle,
  Download, Search, Plus, CheckCircle, Clock, XCircle, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useFees, useUpdateFee } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, SearchBar, TabBar, Modal, FormField, ProgressBar, Spinner } from '../../components/ui/index';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/supabaseHelpers';

const STATUS_STYLES = { paid:'badge-success', partial:'badge-warning', defaulter:'badge-danger', pending:'badge-surface' };

const fmt = (n) => `₹${(n/100000).toFixed(1)}L`;

export default function FeesPage() {
  const { user, canApprove } = useAuth();
  const [search, setSearch]  = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [tab, setTab]        = useState('list');
  const [payModal, setPayModal] = useState(false);
  const [selectedRec, setSelectedRec] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [saving, setSaving]  = useState(false);
  const updateFee = useUpdateFee();

  const { data: realData, isLoading } = useFees({});
  const records = realData || [];

  // Compute department aggregates dynamically from real data
  const deptMap = {};
  records.forEach(r => {
    const deptCode = r.student?.department?.code || 'Other';
    if (!deptMap[deptCode]) {
      deptMap[deptCode] = { collected: 0, total: 0 };
    }
    deptMap[deptCode].collected += r.total_paid || 0;
    deptMap[deptCode].total += r.net_payable || 0;
  });

  const computedDeptCollection = Object.keys(deptMap).map(dept => {
    const { collected, total } = deptMap[dept];
    const pct = total > 0 ? Number(((collected / total) * 100).toFixed(1)) : 0;
    return { dept, collected, total, pct };
  }).sort((a, b) => b.pct - a.pct);

  // Compute status pie distribution dynamically from real data
  const statusCounts = { paid: 0, partial: 0, defaulter: 0, pending: 0 };
  records.forEach(r => {
    const s = r.status || 'pending';
    if (statusCounts[s] !== undefined) {
      statusCounts[s]++;
    } else {
      statusCounts.pending++;
    }
  });

  const computedStatusPie = [
    { name: 'Paid',     value: statusCounts.paid, color: '#22c55e' },
    { name: 'Partial',  value: statusCounts.partial, color: '#f59e0b' },
    { name: 'Defaulter',value: statusCounts.defaulter, color: '#ef4444' },
    { name: 'Pending',  value: statusCounts.pending, color: '#94a3b8' },
  ];

  const filtered = records.filter(r => {
    const s = r.student;
    const matchSearch = (s?.full_name||'').toLowerCase().includes(search.toLowerCase()) ||
                        (s?.enrollment_number||'').includes(search) ||
                        (s?.department?.code||'').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPayable  = records.reduce((s,r)=>s+r.net_payable, 0);
  const totalCollected= records.reduce((s,r)=>s+r.total_paid, 0);
  const totalBalance  = records.reduce((s,r)=>s+r.balance, 0);
  const collectionPct = Math.round((totalCollected/totalPayable)*100) || 0;

  const openPay = (rec) => { setSelectedRec(rec); setPayAmount(''); setPayModal(true); };
  const handleRecord = async () => {
    if (!payAmount || isNaN(payAmount)) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    const paid = (selectedRec.total_paid || 0) + Number(payAmount);
    const balance = selectedRec.net_payable - paid;
    const status  = balance <= 0 ? 'paid' : 'partial';
    try {
      if (realData && realData.length > 0) {
        await updateFee.mutateAsync({ id: selectedRec.id, total_paid: paid, balance, status, last_payment_date: new Date().toISOString().split('T')[0] });
      }
      toast.success('Payment recorded successfully');
      setPayModal(false);
    } catch { toast.error('Failed to record payment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Fees Monitoring"
        subtitle="Track fee collection, defaulters, and scholarship adjustments"
        actions={
          <button onClick={() => exportToCSV(filtered, 'fees_report.csv')} className="btn-secondary text-sm"><Download size={14} /> Export Report</button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Payable',   value: fmt(totalPayable),   color:'bg-primary-50 border-primary-100 text-primary-600', icon: IndianRupee },
          { label:'Collected',       value: fmt(totalCollected), color:'bg-success-50 border-success-100 text-success-600', icon: CheckCircle },
          { label:'Outstanding',     value: fmt(totalBalance),   color:'bg-danger-50 border-danger-100 text-danger-600', icon: AlertCircle },
          { label:'Collection %',    value: `${collectionPct}%`, color:'bg-warning-50 border-warning-100 text-warning-600', icon: TrendingUp },
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

      <TabBar tabs={[{ id:'list', label:'Student Records' }, { id:'dept', label:'Dept Collection' }, { id:'chart', label:'Overview' }]} active={tab} onChange={setTab} />

      {tab === 'chart' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card p-5">
            <h3 className="section-title text-base mb-4">Collection Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={computedStatusPie} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                  {computedStatusPie.map((e,i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v=>[`${v} students`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="section-title text-base mb-4">Dept Collection %</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={computedDeptCollection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }} formatter={v=>[`${v}%`]} />
                <Bar dataKey="pct" name="Collection %" radius={[4,4,0,0]}>
                  {computedDeptCollection.map((e,i) => <Cell key={i} fill={e.pct>=80?'#22c55e':e.pct>=70?'#f59e0b':'#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'dept' && (
        <div className="card overflow-hidden mb-6">
          <table className="table-base">
            <thead><tr><th>Department</th><th>Collected</th><th>Total Payable</th><th>Outstanding</th><th>Progress</th></tr></thead>
            <tbody>
              {computedDeptCollection.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-surface-400">No records found</td></tr>}
              {computedDeptCollection.map(d => (
                <tr key={d.dept}>
                  <td className="font-semibold">{d.dept}</td>
                  <td className="text-success-700 font-semibold">{fmt(d.collected)}</td>
                  <td>{fmt(d.total)}</td>
                  <td className="text-danger-600 font-semibold">{fmt(d.total - d.collected)}</td>
                  <td className="min-w-[160px]"><ProgressBar value={d.pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'list' && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Search student name, enrollment, dept…">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-auto text-sm">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="defaulter">Defaulter</option>
              <option value="pending">Pending</option>
            </select>
          </SearchBar>
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Student</th><th>Dept</th><th>Sem</th><th>Net Payable</th><th>Paid</th><th>Balance</th><th>Scholarship</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-surface-400">No records found</td></tr>}
                {filtered.map(rec => (
                  <tr key={rec.id} className={rec.status==='defaulter'?'bg-danger-50/20':''}>
                    <td>
                      <p className="font-semibold text-surface-900">{rec.student?.full_name}</p>
                      <p className="text-xs text-surface-400">{rec.student?.enrollment_number}</p>
                    </td>
                    <td><span className="badge-surface text-xs">{rec.student?.department?.code}</span></td>
                    <td className="text-center">{rec.semester}</td>
                    <td className="font-semibold">₹{rec.net_payable?.toLocaleString('en-IN')}</td>
                    <td className="text-success-700 font-semibold">₹{rec.total_paid?.toLocaleString('en-IN')}</td>
                    <td className={`font-semibold ${rec.balance>0?'text-danger-600':'text-success-600'}`}>
                      ₹{rec.balance?.toLocaleString('en-IN')}
                    </td>
                    <td className="text-surface-600">₹{rec.scholarship_amount?.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${STATUS_STYLES[rec.status]||'badge-surface'}`}>{rec.status}</span></td>
                    <td>
                      {rec.status !== 'paid' && (
                        <button onClick={() => openPay(rec)} className="btn-ghost text-xs text-primary-600">Record Payment</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Fee Payment"
        footer={
          <>
            <button onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleRecord} disabled={saving} className="btn-primary">
              {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : null} Record Payment
            </button>
          </>
        }
      >
        {selectedRec && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl">
              <p className="text-sm font-semibold">{selectedRec.student?.full_name}</p>
              <p className="text-xs text-surface-500">Balance: ₹{selectedRec.balance?.toLocaleString('en-IN')}</p>
            </div>
            <FormField label="Payment Amount (₹)" required>
              <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="e.g. 25000" />
            </FormField>
            <FormField label="Receipt No." hint="Optional"><input type="text" placeholder="e.g. REC/2025/001" /></FormField>
            <FormField label="Date"><input type="date" defaultValue={new Date().toISOString().split('T')[0]} /></FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
