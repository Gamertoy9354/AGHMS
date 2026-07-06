import React, { useState, useMemo } from 'react';
import { BookOpen, TrendingUp, Award, Download, Upload, Search } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { PageHeader, SearchBar, TabBar, EmptyState, ProgressBar, Spinner } from '../../components/ui/index';
import { exportToCSV } from '../../lib/exportUtils';
import { useResultsList } from '../../hooks/useData';

const COLORS = ['#3b82f6','#f59e0b','#22c55e','#f97316','#8b5cf6','#ec4899'];

export default function ResultsPage() {
  const [tab,        setTab]        = useState('overview');
  const [search,     setSearch]     = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const { data: resultsRaw = [], isLoading } = useResultsList({});

  // ── Department aggregates ────────────────────────────────────────────────────
  const deptResults = useMemo(() => {
    const map = {};
    resultsRaw.forEach(r => {
      const code = r.student?.department?.code || 'Unknown';
      if (!map[code]) {
        map[code] = { dept: code, total: 0, passed: 0, sgpaSum: 0, sgpaCount: 0, backlogs: 0, studentSet: new Set() };
      }
      const d = map[code];
      d.studentSet.add(r.student_id);
      if (r.total_marks != null && r.max_marks != null) {
        d.total += 1;
        const pct = (r.total_marks / r.max_marks) * 100;
        if (pct >= 40) d.passed += 1;
        else d.backlogs += 1;
      }
      if (r.sgpa) { d.sgpaSum += r.sgpa; d.sgpaCount += 1; }
    });
    return Object.values(map).map(d => ({
      dept:            d.dept,
      total_students:  d.studentSet.size,
      pass:            d.total > 0 ? parseFloat(((d.passed / d.total) * 100).toFixed(1)) : 0,
      fail:            d.total > 0 ? parseFloat((100 - (d.passed / d.total) * 100).toFixed(1)) : 0,
      avg_sgpa:        d.sgpaCount > 0 ? parseFloat((d.sgpaSum / d.sgpaCount).toFixed(1)) : 0,
      backlogs:        d.backlogs,
    })).sort((a, b) => b.avg_sgpa - a.avg_sgpa);
  }, [resultsRaw]);

  // ── Student-level list ───────────────────────────────────────────────────────
  const studentResults = useMemo(() => {
    // Deduplicate by student
    const map = {};
    resultsRaw.forEach(r => {
      const sid = r.student_id;
      if (!map[sid]) {
        map[sid] = {
          id: sid,
          name: r.student?.full_name || '—',
          enrollment: r.student?.enrollment_number || '—',
          dept: r.student?.department?.code || '—',
          sgpa: r.sgpa || 0,
          backlogs: 0,
          passed: true,
        };
      }
      if (r.total_marks != null && r.max_marks != null) {
        const pct = (r.total_marks / r.max_marks) * 100;
        if (pct < 40) { map[sid].backlogs += 1; map[sid].passed = false; }
      }
      if (r.sgpa && r.sgpa > map[sid].sgpa) map[sid].sgpa = r.sgpa;
    });
    return Object.values(map);
  }, [resultsRaw]);

  const filteredStudents = useMemo(() => {
    return studentResults.filter(s => {
      const matchDept   = deptFilter === 'all' || s.dept === deptFilter;
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.enrollment.includes(search);
      return matchDept && matchSearch;
    });
  }, [studentResults, search, deptFilter]);

  const sorted = [...deptResults].sort((a, b) => b.avg_sgpa - a.avg_sgpa);

  const overallPass = deptResults.length
    ? (deptResults.reduce((s, d) => s + d.pass, 0) / deptResults.length).toFixed(1)
    : '—';
  const overallSGPA = deptResults.length
    ? (deptResults.reduce((s, d) => s + d.avg_sgpa, 0) / deptResults.length).toFixed(1)
    : '—';
  const totalBacklogs = deptResults.reduce((s, d) => s + d.backlogs, 0);
  const topDept       = deptResults.length ? deptResults[0].dept : '—';

  const deptCodes = [...new Set(studentResults.map(s => s.dept))].filter(Boolean);

  if (isLoading) {
    return (
      <div className="page-wrapper min-h-[60vh] flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Results & Exam Analysis"
        subtitle="Department-wise results, SGPA trends, and backlog tracking"
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(sorted, 'results_analysis.csv')} className="btn-secondary text-sm">
              <Download size={14}/> Export
            </button>
            <button onClick={() => document.getElementById('import-results').click()} className="btn-primary text-sm">
              <input id="import-results" type="file" accept=".csv" className="hidden" onChange={e => { e.target.value = ''; }} />
              <Upload size={14}/> Import Results
            </button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Overall Pass %',       value: overallPass ? `${overallPass}%` : '—',  color:'text-success-700' },
          { label:'Avg Institute SGPA',   value: overallSGPA,                            color:'text-primary-700' },
          { label:'Total Backlogs',       value: totalBacklogs || '—',                   color:'text-danger-700' },
          { label:'Top Dept (SGPA)',       value: topDept,                               color:'text-warning-700' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-surface-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {deptResults.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen size={40} className="mx-auto text-surface-300 mb-3" />
          <p className="text-sm font-semibold text-surface-500">No results data available yet.</p>
          <p className="text-xs text-surface-400 mt-1">Data will appear after faculty upload results through the meeting submissions system.</p>
        </div>
      ) : (
        <>
          <TabBar
            tabs={[
              { id:'overview', label:'Dept Overview' },
              { id:'students', label:'Student Results' },
              { id:'ranking',  label:'Rankings' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab==='overview' && (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-base font-semibold mb-4">Pass % by Department</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={deptResults}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="dept" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                    <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} unit="%"/>
                    <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',fontSize:'12px'}} formatter={v=>[`${v}%`]}/>
                    <Bar dataKey="pass" name="Pass %" radius={[4,4,0,0]}>
                      {deptResults.map((e,i) => <Cell key={i} fill={e.pass>=85?'#22c55e':e.pass>=75?'#f59e0b':'#ef4444'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <table className="table-base">
                  <thead><tr><th>Department</th><th>Students</th><th>Pass %</th><th>Avg SGPA</th><th>Backlogs</th><th>Pass Rate</th></tr></thead>
                  <tbody>
                    {deptResults.map(d => (
                      <tr key={d.dept}>
                        <td className="font-semibold">{d.dept}</td>
                        <td>{d.total_students}</td>
                        <td className={`font-semibold ${d.pass>=85?'text-success-700':d.pass>=75?'text-warning-700':'text-danger-700'}`}>{d.pass}%</td>
                        <td className="font-semibold text-primary-700">{d.avg_sgpa}</td>
                        <td className="text-danger-600 font-semibold">{d.backlogs}</td>
                        <td className="min-w-[120px]"><ProgressBar value={d.pass}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab==='students' && (
            <>
              <SearchBar value={search} onChange={setSearch} placeholder="Search student name or enrollment…">
                <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="w-auto text-sm">
                  <option value="all">All Depts</option>
                  {deptCodes.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </SearchBar>
              <div className="card overflow-hidden">
                <table className="table-base">
                  <thead><tr><th>Student</th><th>Enrollment</th><th>Dept</th><th>SGPA</th><th>Backlogs</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-surface-400">No student results found</td></tr>
                    ) : filteredStudents.map(s => (
                      <tr key={s.id}>
                        <td className="font-semibold text-surface-900">{s.name}</td>
                        <td className="text-surface-500 font-mono text-xs">{s.enrollment}</td>
                        <td><span className="badge-surface text-xs">{s.dept}</span></td>
                        <td className={`font-semibold ${s.sgpa>=7?'text-success-700':s.sgpa>=5?'text-warning-700':'text-danger-700'}`}>{s.sgpa || '—'}</td>
                        <td className={s.backlogs>0?'text-danger-600 font-semibold':'text-success-600 font-semibold'}>{s.backlogs}</td>
                        <td>
                          <span className={`badge ${s.backlogs===0?'badge-success':'badge-danger'}`}>
                            {s.backlogs===0?'Pass':'Backlog'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab==='ranking' && (
            <div className="card p-5">
              <h3 className="text-base font-semibold mb-4">Department Rankings</h3>
              <div className="space-y-3">
                {sorted.map((d,i) => (
                  <div key={d.dept} className={`flex items-center gap-4 p-4 rounded-xl border ${i===0?'border-yellow-200 bg-yellow-50':i===1?'border-surface-200 bg-surface-50':i===2?'border-orange-100 bg-orange-50':'border-surface-100'}`}>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                      i===0?'bg-yellow-400 text-yellow-900':i===1?'bg-surface-200 text-surface-600':i===2?'bg-orange-200 text-orange-700':'bg-surface-100 text-surface-500'
                    }`}>#{i+1}</span>
                    <div className="flex-1">
                      <p className="font-bold text-surface-900">{d.dept}</p>
                      <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                        <span>Pass: <strong className="text-success-700">{d.pass}%</strong></span>
                        <span>SGPA: <strong className="text-primary-700">{d.avg_sgpa}</strong></span>
                        <span>Backlogs: <strong className="text-danger-600">{d.backlogs}</strong></span>
                      </div>
                    </div>
                    {i===0 && <Award size={22} className="text-yellow-500"/>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
