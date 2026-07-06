import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Award, AlertTriangle, Users, Download
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { exportToCSV } from '../../lib/exportUtils';
import { useResultsList } from '../../hooks/useData';
import { Spinner } from '../../components/ui/index';

const COLORS = ['#3b82f6','#22c55e','#f97316','#a855f7','#ef4444','#eab308'];

export default function PerformancePage() {
  const [selectedDept, setSelectedDept] = useState('all');
  const [semester,     setSemester]     = useState('');

  const { data: resultsRaw = [], isLoading } = useResultsList({});

  // ── Aggregate per department ─────────────────────────────────────────────────
  const deptMetrics = useMemo(() => {
    const map = {};
    resultsRaw.forEach(r => {
      const code = r.student?.department?.code || 'Unknown';
      const name = r.student?.department?.name || code;
      if (!map[code]) {
        map[code] = {
          dept: code, fullName: name,
          totalMarks: 0, passMarks: 0, sgpaSum: 0, sgpaCount: 0,
          backlogs: 0, studentSet: new Set(),
        };
      }
      const d = map[code];
      d.studentSet.add(r.student_id);
      if (r.total_marks != null && r.max_marks != null) {
        d.totalMarks += 1;
        const pct = (r.total_marks / r.max_marks) * 100;
        if (pct >= 40) d.passMarks += 1;
        else d.backlogs += 1;
      }
      if (r.sgpa) { d.sgpaSum += r.sgpa; d.sgpaCount += 1; }
    });

    return Object.values(map).map(d => ({
      dept:          d.dept,
      fullName:      d.fullName,
      result:        d.totalMarks > 0 ? Math.round((d.passMarks / d.totalMarks) * 100) : 0,
      pass:          d.totalMarks > 0 ? Math.round((d.passMarks / d.totalMarks) * 100) : 0,
      sgpa:          d.sgpaCount > 0  ? parseFloat((d.sgpaSum / d.sgpaCount).toFixed(1)) : 0,
      backlog:       d.backlogs,
      weak:          Math.round(d.backlogs * 0.6), // approx weak students from backlog count
      co_attainment: d.totalMarks > 0 ? Math.round((d.passMarks / d.totalMarks) * 90) : 0,
    })).sort((a, b) => a.dept.localeCompare(b.dept));
  }, [resultsRaw]);

  const data = selectedDept === 'all'
    ? deptMetrics
    : deptMetrics.filter(d => d.dept === selectedDept);

  const getColor = (v, thresholds = [75, 60]) => {
    if (v >= thresholds[0]) return 'text-success-700';
    if (v >= thresholds[1]) return 'text-warning-700';
    return 'text-danger-700';
  };

  const getBg = (v, thresholds = [75, 60]) => {
    if (v >= thresholds[0]) return 'bg-success-50 border-success-200';
    if (v >= thresholds[1]) return 'bg-warning-50 border-warning-200';
    return 'bg-danger-50 border-danger-200';
  };

  if (isLoading) {
    return (
      <div className="page-wrapper min-h-[60vh] flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  const avgResult  = deptMetrics.length ? Math.round(deptMetrics.reduce((s,d) => s+d.result, 0) / deptMetrics.length) : 0;
  const avgSGPA    = deptMetrics.length ? (deptMetrics.reduce((s,d) => s+d.sgpa, 0) / deptMetrics.length).toFixed(1) : '—';
  const totalBacklog = deptMetrics.reduce((s,d) => s+d.backlog, 0);
  const totalWeak    = deptMetrics.reduce((s,d) => s+d.weak, 0);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="section-header mb-6">
        <div>
          <h1 className="section-title">Academic Performance</h1>
          <p className="section-subtitle">Department-wise result analysis and CO attainment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(data, 'performance_report.csv')} className="btn-secondary text-xs">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="kpi-card">
          <div className="p-2.5 rounded-xl bg-primary-50 border border-primary-100 w-fit">
            <Award size={20} className="text-primary-600" />
          </div>
          <p className="text-2xl font-bold text-surface-900">{avgResult}%</p>
          <p className="text-sm font-medium text-surface-600">Avg Result %</p>
        </div>
        <div className="kpi-card">
          <div className="p-2.5 rounded-xl bg-success-50 border border-success-100 w-fit">
            <TrendingUp size={20} className="text-success-600" />
          </div>
          <p className="text-2xl font-bold text-surface-900">{avgSGPA}</p>
          <p className="text-sm font-medium text-surface-600">Avg SGPA</p>
        </div>
        <div className="kpi-card">
          <div className="p-2.5 rounded-xl bg-warning-50 border border-warning-100 w-fit">
            <AlertTriangle size={20} className="text-warning-600" />
          </div>
          <p className="text-2xl font-bold text-surface-900">{totalBacklog}</p>
          <p className="text-sm font-medium text-surface-600">Total Backlogs</p>
        </div>
        <div className="kpi-card">
          <div className="p-2.5 rounded-xl bg-danger-50 border border-danger-100 w-fit">
            <Users size={20} className="text-danger-600" />
          </div>
          <p className="text-2xl font-bold text-surface-900">{totalWeak}</p>
          <p className="text-sm font-medium text-surface-600">Weak Students (est.)</p>
        </div>
      </div>

      {deptMetrics.length === 0 ? (
        <div className="card p-12 text-center">
          <Award size={40} className="mx-auto text-surface-300 mb-3" />
          <p className="text-sm font-semibold text-surface-500">No results data available yet.</p>
          <p className="text-xs text-surface-400 mt-1">Data will appear here once faculty upload results through meetings.</p>
        </div>
      ) : (
        <>
          {/* Chart row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Result comparison */}
            <div className="card p-5">
              <h3 className="section-title text-base mb-4">Department Result Comparison</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptMetrics} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dept" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }} formatter={v => [`${v}%`]} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="result" name="Result %" radius={[4,4,0,0]} fill="#3b82f6" />
                  <Bar dataKey="pass"   name="Pass %"   radius={[4,4,0,0]} fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* CO Attainment */}
            <div className="card p-5">
              <h3 className="section-title text-base mb-4">CO Attainment by Department</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }} formatter={v => [`${v}%`]} />
                  <Bar dataKey="co_attainment" name="CO Attainment %" radius={[4,4,0,0]}>
                    {deptMetrics.map((entry, i) => (
                      <Cell key={i} fill={entry.co_attainment >= 70 ? '#22c55e' : entry.co_attainment >= 55 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="card p-5 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title text-base">Department-wise Performance Details</h3>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="text-sm w-auto"
              >
                <option value="all">All Departments</option>
                {deptMetrics.map(d => <option key={d.dept} value={d.dept}>{d.dept}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Result %</th>
                    <th>Pass %</th>
                    <th>SGPA</th>
                    <th>Backlogs</th>
                    <th>Weak (est.)</th>
                    <th>CO Attainment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(dept => (
                    <tr key={dept.dept}>
                      <td>
                        <div>
                          <p className="font-semibold text-surface-900">{dept.dept}</p>
                          <p className="text-xs text-surface-400">{dept.fullName}</p>
                        </div>
                      </td>
                      <td>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold border ${getBg(dept.result)}`}>
                          <span className={getColor(dept.result)}>{dept.result}%</span>
                        </div>
                      </td>
                      <td className={`font-semibold ${getColor(dept.pass)}`}>{dept.pass}%</td>
                      <td className={`font-semibold ${getColor(dept.sgpa*10, [75,60])}`}>{dept.sgpa}</td>
                      <td>
                        <span className={`font-semibold ${dept.backlog>20 ? 'text-danger-600' : dept.backlog>10 ? 'text-warning-600' : 'text-success-600'}`}>
                          {dept.backlog}
                        </span>
                      </td>
                      <td>
                        <span className={`font-semibold ${dept.weak>15 ? 'text-danger-600' : dept.weak>8 ? 'text-warning-600' : 'text-success-600'}`}>
                          {dept.weak}
                        </span>
                        {dept.weak > 0 && (
                          <Link to="/academics/weak-students" className="ml-2 text-xs text-primary-600 hover:underline">
                            View →
                          </Link>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress w-16">
                            <div
                              className={`progress-bar ${dept.co_attainment>=70?'bg-success-500':dept.co_attainment>=55?'bg-warning-500':'bg-danger-500'}`}
                              style={{ width: `${dept.co_attainment}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{dept.co_attainment}%</span>
                        </div>
                      </td>
                      <td>
                        <button className="btn-ghost text-xs">Detailed View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ranking */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-4">Department Ranking</h3>
            <div className="space-y-3">
              {[...deptMetrics]
                .sort((a,b) => (b.result+b.pass+b.co_attainment) - (a.result+a.pass+a.co_attainment))
                .map((d, i) => {
                  const overall = Math.round((d.result + d.pass + d.co_attainment) / 3);
                  const medals = ['🥇','🥈','🥉'];
                  return (
                    <div key={d.dept} className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-50">
                      <div className="w-8 text-center">
                        {i < 3 ? <span className="text-xl">{medals[i]}</span> : (
                          <span className="text-sm font-bold text-surface-400">#{i+1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-surface-800">{d.fullName}</span>
                          <span className="text-sm font-bold text-surface-900">{overall}%</span>
                        </div>
                        <div className="progress">
                          <div
                            className={`progress-bar ${overall>=80?'bg-success-500':overall>=65?'bg-warning-500':'bg-danger-500'}`}
                            style={{ width: `${overall}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
