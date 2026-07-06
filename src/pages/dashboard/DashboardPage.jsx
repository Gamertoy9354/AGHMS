import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, FileText, Users, TrendingUp, CheckSquare,
  IndianRupee, GraduationCap, ShieldCheck, ArrowRight,
  Clock, AlertTriangle, CheckCircle, Activity
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useMeetings, useDocuments, useActionItems, useDashboard, useCurrentYear, useDepartments } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { MEETING_STATUS_COLORS, MEETING_STATUS_LABELS } from '../../lib/constants';
import { formatDate } from '../../lib/supabaseHelpers';
import { SkeletonCard, ProgressBar, Avatar } from '../../components/ui/index';
import { jsPDF } from 'jspdf';

// ─── Mock data for charts (used as fallback and for demo) ─────────────────────
const DEPT_PERFORMANCE = [
  { dept:'CSE', pass:88, sgpa:7.2, placement:78 },
  { dept:'MECH', pass:79, sgpa:6.8, placement:65 },
  { dept:'ELE', pass:84, sgpa:7.0, placement:71 },
  { dept:'EC', pass:81, sgpa:6.9, placement:68 },
  { dept:'IT', pass:92, sgpa:7.5, placement:85 },
  { dept:'CIV', pass:75, sgpa:6.5, placement:58 },
];

const TREND_DATA = [
  { month:'Jan', meetings:2, documents:18, actions:12 },
  { month:'Feb', meetings:3, documents:24, actions:15 },
  { month:'Mar', meetings:2, documents:20, actions:9 },
  { month:'Apr', meetings:4, documents:31, actions:18 },
  { month:'May', meetings:3, documents:22, actions:14 },
];

const DOC_STATUS_PIE = [
  { name:'Approved', value:42, color:'#22c55e' },
  { name:'Submitted', value:28, color:'#3b82f6' },
  { name:'Pending',   value:19, color:'#94a3b8' },
  { name:'Overdue',   value:11, color:'#ef4444' },
];

const RECENT_ACTIVITIES = [
  { icon:FileText, text:'CSE dept submitted CO Attainment Sheet', time:'2h ago',  color:'bg-primary-100 text-primary-600' },
  { icon:CheckCircle, text:'Monthly HOD Meeting approved by Principal', time:'5h ago', color:'bg-success-100 text-success-600' },
  { icon:AlertTriangle, text:'MECH dept document overdue – 3 items',  time:'1d ago', color:'bg-danger-100 text-danger-600' },
  { icon:GraduationCap, text:'Infosys placement drive: 12 offers',  time:'2d ago', color:'bg-warning-100 text-warning-600' },
  { icon:Activity, text:'NAAC criterion 2 evidence submitted',      time:'3d ago', color:'bg-violet-100 text-violet-600' },
];

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color, to, trend }) {
  const card = (
    <div className={`kpi-card group ${to ? 'cursor-pointer hover:shadow-card-hover' : ''}`}>
      <div className={`p-2.5 rounded-xl border w-fit ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-black text-surface-900">{value ?? '—'}</p>
        <p className="text-sm font-medium text-surface-600">{label}</p>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`mt-auto text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
          <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
          {Math.abs(trend)}% vs last month
        </div>
      )}
      {to && (
        <ArrowRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
      )}
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile, role } = useAuth();
  const { data: kpis, isLoading: kpisLoading } = useDashboard();
  const { data: meetings = [], isLoading: meetingsLoading } = useMeetings({ limit: 5 });
  const { data: documents = [] } = useDocuments({});
  const { data: actionItems = [] } = useActionItems({});
  const { data: currentYear } = useCurrentYear();
  const { data: departments = [] } = useDepartments();

  const userDept = departments.find(d => d.id === profile?.department_id);
  const userDeptCode = userDept?.code; // e.g. "CSE"

  const filteredMeetings = meetings.filter(m => {
    if (['admin', 'principal', 'director'].includes(role)) return true;
    if (m.invited_departments && m.invited_departments.length > 0) {
      return m.invited_departments.includes(profile?.department_id);
    }
    return true;
  });

  const pendingMeetings = filteredMeetings.filter(m => m.status === 'pending_approval').length;
  const upcomingMeetings= filteredMeetings.filter(m => ['approved','circulated'].includes(m.status)).length;
  const overdueActions  = actionItems.filter(a => a.status === 'delayed').length;
  const pendingDocs     = documents.filter(d => d.status === 'pending').length;
  const approvedDocs    = documents.filter(d => d.status === 'approved').length;
  const totalDocs       = documents.length;

  const isStaff = ['hod', 'faculty'].includes(role);
  const postMeetingBrief = isStaff && meetings.find(m => 
    m.status === 'conducted' && 
    m.ai_summary?.departmentBriefs && 
    userDeptCode && 
    m.ai_summary.departmentBriefs[userDeptCode]
  );

  const handleDownloadMOMPDF = (meeting, briefText, deptName) => {
    const doc = new jsPDF();
    const pageH = doc.internal.pageSize.height;
    const pageW = doc.internal.pageSize.width;
    const margin = 15;
    const contentW = pageW - margin * 2;

    const cleanText = (text) => (text || '').replace(/[*#`]/g, '').trim();

    const addWrappedText = (text, x, y, maxW, fontSize = 10, fontStyle = 'normal', color = [51, 65, 85]) => {
      doc.setFontSize(fontSize);
      doc.setFont('Helvetica', fontStyle);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(cleanText(text), maxW);
      lines.forEach(line => {
        if (y > pageH - 25) {
          doc.addPage();
          y = margin + 10;
          // Re-apply footer on new page
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, pageH - 20, pageW - margin, pageH - 20);
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text('AI-generated official MOM brief • AGHMS Platform', margin, pageH - 12);
          doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin - 60, pageH - 12);
        }
        doc.text(line, x, y);
        y += fontSize * 0.45;
      });
      return y;
    };

    // ── Header banner ───────────────────────────────────────────────────────
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageW, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RNGPIT ACADEMIC GOVERNANCE SYSTEM', margin, 14);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text('AUTOMATED DEPARTMENTAL MINUTES OF MEETING (MOM)', margin, 26);

    // ── Meeting details ─────────────────────────────────────────────────────
    let y = 48;
    doc.setTextColor(30, 41, 59);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('MEETING DETAILS', margin, y); y += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Title: ${meeting.agenda_title}`, margin, y); y += 6;
    doc.text(`Date: ${formatDate(meeting.meeting_date)}`, margin, y); y += 6;
    doc.text(`Venue: ${meeting.venue || '—'}`, margin, y); y += 6;
    doc.text(`Department: ${deptName}`, margin, y); y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y); y += 8;

    // ── Department Brief section ────────────────────────────────────────────
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('DEPARTMENT-SPECIFIC BRIEF & ACTION PLANS', margin, y); y += 8;

    y = addWrappedText(briefText, margin, y, contentW, 10, 'normal', [51, 65, 85]);
    y += 4;

    // ── Footer on last page ─────────────────────────────────────────────────
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 20, pageW - margin, pageH - 20);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('This is an AI-generated official minutes brief dispatched instantly post-meeting conclusion.', margin, pageH - 12);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageW - margin - 60, pageH - 12);

    doc.save(`${meeting.agenda_title.replace(/\s+/g, '_')}_${deptName}_MOM.pdf`);
  };


  const today   = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const greeting= new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="page-wrapper">
      {/* Welcome bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-surface-400 mb-1">{today}</p>
          <h1 className="text-2xl font-black text-surface-900">
            {greeting}, {profile?.full_name?.split(' ')[0] || 'Welcome'} 👋
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            {currentYear ? `Academic Year ${currentYear.year_name}` : 'RNGPIT Academic Governance'} · {role ? role.charAt(0).toUpperCase()+role.slice(1) : 'Dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/meetings/agendas/new" className="btn-primary text-sm">
            <Calendar size={14} /> New Agenda
          </Link>
          <Link to="/reports" className="btn-secondary text-sm">
            <FileText size={14} /> Reports
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(8)].map((_,i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KPICard icon={Calendar}     label="Upcoming Meetings"   value={upcomingMeetings || '2'}  sub="Next 30 days"        color="bg-primary-50 border-primary-100 text-primary-600"   to="/meetings/agendas"      trend={5} />
          <KPICard icon={Clock}        label="Pending Approvals"   value={pendingMeetings || '1'}   sub="Awaiting review"     color="bg-warning-50 border-warning-100 text-warning-600"   to="/meetings/agendas" />
          <KPICard icon={FileText}     label="Documents Pending"   value={pendingDocs || kpis?.pendingDocuments || '19'}  sub="Awaiting submission"  color="bg-orange-50 border-orange-100 text-orange-600"  to="/documents" />
          <KPICard icon={CheckSquare}  label="Actions Overdue"     value={overdueActions || '5'}    sub="Needs immediate action" color="bg-danger-50 border-danger-100 text-danger-600"    to="/meetings/action-items" trend={-8} />
          <KPICard icon={Users}        label="Active Students"     value={kpis?.activeStudents || '640'} sub="All departments"  color="bg-success-50 border-success-100 text-success-600" to="/academics/attendance" />
          <KPICard icon={IndianRupee}  label="Fee Collection"      value="76.2%"                    sub="Even Sem 2024-25"    color="bg-emerald-50 border-emerald-100 text-emerald-600"   to="/fees"                  trend={3} />
          <KPICard icon={GraduationCap} label="Placed Students"   value="312"                      sub="AY 2024-25"          color="bg-violet-50 border-violet-100 text-violet-600"      to="/placement"             trend={12} />
          <KPICard icon={ShieldCheck}  label="NAAC Readiness"     value="81%"                      sub="Criterion coverage"  color="bg-indigo-50 border-indigo-100 text-indigo-600"      to="/compliance/nba-naac" />
        </div>
      )}

      {/* AI MOM Brief Card for HOD / Faculty */}
      {postMeetingBrief && (
        <div className="card p-6 mb-6 border-l-4 border-violet-500 bg-gradient-to-r from-violet-50/50 to-indigo-50/10 shadow-md rounded-3xl overflow-hidden relative animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 bg-violet-100 rounded-2xl text-violet-600 flex-shrink-0 mt-0.5">
                <ShieldCheck size={24} className="animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">AI Generated MOM Brief</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{formatDate(postMeetingBrief.meeting_date)}</span>
                </div>
                <h3 className="text-base font-black text-surface-900 leading-tight">
                  MOM Actions Brief: {postMeetingBrief.agenda_title}
                </h3>
                <p className="text-xs text-surface-600 mt-2 leading-relaxed whitespace-pre-wrap font-medium bg-white/40 p-4 rounded-xl border border-violet-100/50">
                  {postMeetingBrief.ai_summary.departmentBriefs[userDeptCode]}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadMOMPDF(
                postMeetingBrief,
                postMeetingBrief.ai_summary.departmentBriefs[userDeptCode],
                userDeptCode
              )}
              className="btn-primary text-xs bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-150 border-0 flex items-center gap-1.5 font-bold shrink-0 self-end md:self-center cursor-pointer"
            >
              <FileText size={14} /> Download Brief PDF
            </button>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Charts */}
        <div className="xl:col-span-2 space-y-6">
          {/* Department Performance */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-surface-900">Department Performance</h3>
                <p className="text-xs text-surface-400 mt-0.5">Pass % – Even Semester 2024-25</p>
              </div>
              <Link to="/academics/performance" className="text-xs text-primary-600 font-semibold hover:underline flex items-center gap-1">
                Full Report <ArrowRight size={12} />
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DEPT_PERFORMANCE} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}
                  formatter={(v, n) => [`${v}${n==='sgpa'?'':('%')}`]}
                />
                <Legend wrapperStyle={{ fontSize:'11px' }} />
                <Bar dataKey="pass"      name="Pass %" radius={[4,4,0,0]} fill="#3b82f6" />
                <Bar dataKey="placement" name="Placed %" radius={[4,4,0,0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity Trend */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-surface-900">Activity Trend</h3>
                <p className="text-xs text-surface-400 mt-0.5">Meetings, Documents & Actions (2025)</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }} />
                <Legend wrapperStyle={{ fontSize:'11px' }} />
                <Line type="monotone" dataKey="documents" name="Documents" stroke="#3b82f6" strokeWidth={2.5} dot={{ r:4 }} />
                <Line type="monotone" dataKey="actions"   name="Actions"   stroke="#f59e0b" strokeWidth={2.5} dot={{ r:4 }} />
                <Line type="monotone" dataKey="meetings"  name="Meetings"  stroke="#22c55e" strokeWidth={2.5} dot={{ r:4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Lists & Pie */}
        <div className="space-y-5">
          {/* Document status pie */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-800 mb-3">Document Status</h3>
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={DOC_STATUS_PIE} cx="50%" cy="50%" outerRadius={45} innerRadius={25} dataKey="value" paddingAngle={2}>
                    {DOC_STATUS_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {DOC_STATUS_PIE.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs text-surface-600">{s.name}</span>
                    </div>
                    <span className="text-xs font-bold text-surface-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming meetings */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-surface-800">Upcoming Meetings</h3>
              <Link to="/meetings/agendas" className="text-xs text-primary-600 font-semibold hover:underline">View all</Link>
            </div>
            {meetingsLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="skeleton h-12 rounded-xl"/>)}</div>
            ) : filteredMeetings.slice(0,4).length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-4">No upcoming meetings</p>
            ) : (
              <div className="space-y-2">
                {(filteredMeetings.length > 0 ? filteredMeetings : [
                  { id:'m1', agenda_title:'Monthly HOD Meeting – June 2025', meeting_date:'2025-06-14', status:'approved' },
                  { id:'m2', agenda_title:'NBA Review Committee', meeting_date:'2025-06-20', status:'circulated' },
                  { id:'m3', agenda_title:'Monthly HOD Meeting – July 2025', meeting_date:'2025-07-12', status:'draft' },
                ]).slice(0,4).map(m => (
                  <Link key={m.id} to={`/meetings/agendas/${m.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-primary-500 font-semibold leading-tight">
                        {new Date(m.meeting_date).toLocaleString('default',{month:'short'})}
                      </span>
                      <span className="text-sm font-black text-primary-700 leading-tight">
                        {new Date(m.meeting_date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-surface-800 truncate group-hover:text-primary-700 transition-colors">
                        {m.agenda_title}
                      </p>
                      <span className={`badge text-[10px] mt-0.5 ${MEETING_STATUS_COLORS[m.status]}`}>
                        {MEETING_STATUS_LABELS[m.status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-surface-800">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              {RECENT_ACTIVITIES.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${a.color}`}>
                      <Icon size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-700 leading-snug">{a.text}</p>
                      <p className="text-[10px] text-surface-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HOD compliance mini-table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-surface-800">HOD Doc. Compliance</h3>
              <Link to="/documents" className="text-xs text-primary-600 font-semibold hover:underline">Details</Link>
            </div>
            <div className="space-y-2">
              {[
                { dept:'CSE', pct:92 },{ dept:'IT', pct:88 },{ dept:'ELE', pct:83 },
                { dept:'EC', pct:75 },{ dept:'MECH', pct:68 },{ dept:'CIV', pct:55 },
              ].map(d => (
                <div key={d.dept} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-7 text-surface-700">{d.dept}</span>
                  <ProgressBar value={d.pct} showLabel={false} className="flex-1" />
                  <span className={`text-xs font-bold w-9 text-right ${d.pct>=80?'text-success-700':d.pct>=65?'text-warning-700':'text-danger-700'}`}>
                    {d.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
