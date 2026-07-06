import React, { useState } from 'react';
import {
  Users, BookOpen, AlertTriangle, Bell, TrendingDown,
  Search, Filter, Download, CheckCircle, Phone, Mail,
  ChevronRight, UserX
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { useAttendance, useStudents } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, ProgressBar, SearchBar, EmptyState, SkeletonTable, TabBar, Modal, FormField } from '../../components/ui/index';
import { formatDate } from '../../lib/supabaseHelpers';
import { exportToCSV } from '../../lib/exportUtils';

export default function AttendancePage() {
  const { user, isHOD } = useAuth();
  const [tab, setTab]     = useState('defaulters');
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState('75');
  const [notifyModal, setNotifyModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Fetch all attendance records to calculate true aggregates
  const { data: realData } = useAttendance({});
  const records = realData || [];

  // Calculate dynamic KPIs
  const below75  = records.filter(r => r.attendance_percentage < 75).length;
  const below65  = records.filter(r => r.attendance_percentage < 65).length;
  const critical = records.filter(r => r.attendance_percentage < 50).length;

  // Filter based on selected threshold and search query
  const filtered = records.filter(r => {
    const s = r.student;
    const pct = r.attendance_percentage;
    const matchSearch = (s?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
                        (s?.enrollment_number || '').includes(search) ||
                        (s?.department?.code || '').toLowerCase().includes(search.toLowerCase());
    const matchThreshold = pct < Number(threshold);
    return matchSearch && matchThreshold;
  });

  // Calculate dynamic department summaries for the bar chart
  const deptSummaryMap = {};
  records.forEach(r => {
    const dept = r.student?.department?.code || 'Other';
    if (!deptSummaryMap[dept]) {
      deptSummaryMap[dept] = { dept, below75: 0, below65: 0, total: 0 };
    }
    deptSummaryMap[dept].total++;
    if (r.attendance_percentage < 75) {
      deptSummaryMap[dept].below75++;
    }
    if (r.attendance_percentage < 65) {
      deptSummaryMap[dept].below65++;
    }
  });
  const computedDeptSummary = Object.values(deptSummaryMap).sort((a, b) => b.below75 - a.below75);

  const getColor = (pct) => pct >= 75 ? 'text-success-700' : pct >= 65 ? 'text-warning-700' : 'text-danger-700';
  const getBg    = (pct) => pct >= 75 ? 'bg-success-50' : pct >= 65 ? 'bg-warning-50' : 'bg-danger-50';

  const openNotify = (student) => { setSelectedStudent(student); setNotifyModal(true); };
  const handleNotify = () => {
    toast.success(`Notification sent to ${selectedStudent?.student?.full_name}'s parent`);
    setNotifyModal(false);
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Attendance Monitoring"
        subtitle="Track student attendance defaulters and send parent notifications"
        actions={
          <button 
            onClick={() => exportToCSV(filtered, 'attendance_defaulters.csv')}
            className="btn-secondary text-sm"
          >
            <Download size={14} /> Export Defaulters
          </button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center border-l-4 border-warning-400">
          <p className="text-2xl font-bold text-warning-700">{below75}</p>
          <p className="text-xs text-surface-500 mt-1">Below 75%</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-orange-400">
          <p className="text-2xl font-bold text-orange-600">{below65}</p>
          <p className="text-xs text-surface-500 mt-1">Below 65%</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-danger-400">
          <p className="text-2xl font-bold text-danger-700">{critical}</p>
          <p className="text-xs text-surface-500 mt-1">Critical (&lt;50%)</p>
        </div>
      </div>

      <TabBar
        tabs={[
          { id: 'defaulters', label: 'Defaulters List', count: filtered.length },
          { id: 'chart', label: 'Dept Overview' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'chart' && (
        <div className="card p-5 mb-6">
          <h3 className="section-title text-base mb-4">Department-wise Attendance Defaulters</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={computedDeptSummary} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dept" tick={{ fontSize:12, fill:'#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }} />
              <Bar dataKey="below75" name="Below 75%" radius={[4,4,0,0]} fill="#f59e0b" />
              <Bar dataKey="below65" name="Below 65%" radius={[4,4,0,0]} fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'defaulters' && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Search student name, enrollment, department…">
            <select value={threshold} onChange={e => setThreshold(e.target.value)} className="w-auto text-sm">
              <option value="75">Below 75% (Defaulter)</option>
              <option value="65">Below 65% (Serious)</option>
              <option value="50">Below 50% (Critical)</option>
            </select>
          </SearchBar>

          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Dept</th>
                  <th>Sem</th>
                  <th>Attendance</th>
                  <th>Classes</th>
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-surface-400">No defaulters found for selected threshold</td></tr>
                )}
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td>
                      <p className="font-semibold text-surface-900">{row.student?.full_name}</p>
                      <p className="text-xs text-surface-400">{row.student?.enrollment_number}</p>
                    </td>
                    <td><span className="badge-surface text-xs">{row.student?.department?.code}</span></td>
                    <td className="text-center">{row.semester}</td>
                    <td className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={row.attendance_percentage}
                          showLabel={false}
                          className="flex-1"
                          colorThresholds={[75, 65]}
                        />
                        <span className={`text-sm font-bold ${getColor(row.attendance_percentage)}`}>
                          {row.attendance_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="text-sm text-surface-600">
                      {row.attended_classes}/{row.total_classes}
                    </td>
                    <td>
                      {row.student?.phone && (
                        <div className="flex items-center gap-1 text-xs text-surface-600">
                          <Phone size={11} /> {row.student.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openNotify(row)}
                          className="btn-ghost text-xs text-warning-600 hover:bg-warning-50"
                          title="Notify Parent"
                        >
                          <Bell size={12} /> Notify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Notify Modal */}
      <Modal
        open={notifyModal}
        onClose={() => setNotifyModal(false)}
        title="Send Parent Notification"
        footer={
          <>
            <button onClick={() => setNotifyModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleNotify} className="btn-primary text-sm">
              <Bell size={14} /> Send Notification
            </button>
          </>
        }
      >
        {selectedStudent && (
          <div className="space-y-4">
            <div className="p-3 bg-warning-50 rounded-xl border border-warning-200">
              <p className="text-sm font-semibold text-warning-800">{selectedStudent.student?.full_name}</p>
              <p className="text-xs text-warning-600 mt-0.5">Attendance: {selectedStudent.attendance_percentage}% · {selectedStudent.student?.department?.code} Sem {selectedStudent.semester}</p>
            </div>
            <FormField label="Parent Phone">
              <input readOnly value={selectedStudent.student?.parent_phone || 'Not on record'} />
            </FormField>
            <FormField label="Message">
              <textarea rows={4} defaultValue={`Dear Parent,\n\nThis is to inform you that your ward ${selectedStudent.student?.full_name} (${selectedStudent.student?.enrollment_number}) has ${selectedStudent.attendance_percentage}% attendance in the current semester, which is below the required 75% threshold.\n\nPlease contact the department HOD at the earliest.\n\nRegards,\nRNGPIT Administration`} className="text-sm" />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
