import React, { useState } from 'react';
import { BookMarked, Monitor, FileCheck, AlertTriangle, Upload, CheckCircle, Clock, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageHeader, TabBar, ProgressBar, Modal, FormField, Spinner } from '../../components/ui/index';
import toast from 'react-hot-toast';
import { exportToCSV } from '../../lib/exportUtils';

import { useLmsActivity } from '../../hooks/useData';

export default function LMSPage() {
  const [tab, setTab]      = useState('overview');
  const [nudgeModal, setNudgeModal] = useState(false);
  const [nudgeDept, setNudgeDept]   = useState('');

  const { data: realData, isLoading } = useLmsActivity({});
  const lmsRecords = realData || [];

  const computedDeptLms = lmsRecords.map(r => {
    const courses = r.total_courses || 0;
    const uploaded = r.uploaded_courses || 0;
    const uploadPct = courses > 0 ? Math.round((uploaded / courses) * 100) : 0;
    const active_students = r.active_students || 0;
    const avg_engagement = r.engagement_score || 0;
    
    let status = 'critical';
    if (uploadPct >= 90 && avg_engagement >= 80) status = 'excellent';
    else if (uploadPct >= 75 && avg_engagement >= 65) status = 'good';
    else if (uploadPct >= 50 && avg_engagement >= 50) status = 'warning';
    
    return {
      dept: r.department?.code || 'Other',
      courses,
      uploaded,
      active_students,
      avg_engagement,
      status,
      last_upload_date: r.last_upload_date,
      faculty: r.user?.full_name || 'Faculty Member'
    };
  });

  const avgUpload  = computedDeptLms.length ? Math.round(computedDeptLms.reduce((s,d)=>s+(d.courses > 0 ? (d.uploaded/d.courses*100) : 0),0)/computedDeptLms.length) : 0;
  const avgEngagement = computedDeptLms.length ? Math.round(computedDeptLms.reduce((s,d)=>s+d.avg_engagement,0)/computedDeptLms.length) : 0;
  const totalCourses  = computedDeptLms.reduce((s,d)=>s+d.courses,0);
  const totalUploaded = computedDeptLms.reduce((s,d)=>s+d.uploaded,0);

  const computedActivityLog = lmsRecords.slice(0, 10).map(r => {
    const dept = r.department?.code || 'Other';
    const uploadPct = r.total_courses > 0 ? Math.round((r.uploaded_courses / r.total_courses) * 100) : 0;
    return {
      dept,
      faculty: r.user?.full_name || 'HOD/Faculty',
      action: `Uploaded ${r.uploaded_courses} of ${r.total_courses} courses (${uploadPct}% compliance)`,
      time: r.last_upload_date ? new Date(r.last_upload_date).toLocaleDateString() : 'Recent',
      alert: uploadPct < 60
    };
  });

  const openNudge = (dept) => { setNudgeDept(dept); setNudgeModal(true); };
  const sendNudge = () => {
    toast.success(`Reminder sent to ${nudgeDept} HOD`);
    setNudgeModal(false);
  };

  const statusColor = { excellent:'badge-success', good:'badge-primary', warning:'badge-warning', critical:'badge-danger' };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="LMS Compliance Monitoring"
        subtitle="Track Moodle/LMS course uploads, faculty activity, and student engagement"
        actions={<button onClick={() => exportToCSV(computedDeptLms, 'lms_compliance.csv')} className="btn-secondary text-sm"><Download size={14}/> Export Report</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Courses', value:totalCourses, color:'text-surface-800' },
          { label:'Materials Uploaded', value:`${totalUploaded}/${totalCourses}`, color:'text-primary-700' },
          { label:'Avg Upload %', value:`${avgUpload}%`, color:'text-success-700' },
          { label:'Avg Engagement', value:`${avgEngagement}%`, color:'text-warning-700' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-surface-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <TabBar tabs={[{id:'overview',label:'Dept Overview'},{id:'chart',label:'Charts'},{id:'activity',label:'Activity Log'}]} active={tab} onChange={setTab}/>

      {tab==='overview' && (
        <div className="space-y-3">
          {computedDeptLms.length === 0 && (
            <div className="card p-8 text-center text-surface-500">No LMS compliance reports found in database.</div>
          )}
          {computedDeptLms.map(d => {
            const uploadPct = Math.round((d.uploaded/d.courses)*100) || 0;
            return (
              <div key={d.dept} className={`card p-4 ${d.status==='critical'?'border-l-4 border-danger-400':d.status==='warning'?'border-l-4 border-warning-400':''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Monitor size={20} className="text-primary-600"/>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-surface-900">{d.dept}</p>
                      <span className={`badge ${statusColor[d.status]}`}>{d.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-surface-400 mb-1">Course Upload ({d.uploaded}/{d.courses})</p>
                        <ProgressBar value={uploadPct} showLabel={true}/>
                      </div>
                      <div>
                        <p className="text-xs text-surface-400 mb-1">Student Engagement</p>
                        <ProgressBar value={d.avg_engagement}/>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <p className="text-xs text-surface-400 text-right">{d.active_students} active students</p>
                    {(d.status==='critical'||d.status==='warning') && (
                      <button onClick={()=>openNudge(d.dept)} className="btn-warning text-xs">
                        <AlertTriangle size={11}/> Send Reminder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==='chart' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-4">Upload Compliance %</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={computedDeptLms.map(d=>({...d, uploadPct:Math.round(d.uploaded/d.courses*100) || 0}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="dept" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',fontSize:'12px'}} formatter={v=>[`${v}%`]}/>
                <Bar dataKey="uploadPct" name="Upload %" radius={[4,4,0,0]}>
                  {computedDeptLms.map((e,i)=><Cell key={i} fill={e.status==='excellent'?'#22c55e':e.status==='good'?'#3b82f6':e.status==='warning'?'#f59e0b':'#ef4444'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-4">Student Engagement %</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={computedDeptLms}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="dept" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',fontSize:'12px'}}/>
                <Bar dataKey="avg_engagement" name="Engagement" radius={[4,4,0,0]} fill="#8b5cf6"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab==='activity' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h3 className="text-sm font-semibold text-surface-700">Recent Faculty LMS Activity</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {computedActivityLog.length === 0 && (
              <div className="p-8 text-center text-surface-500">No LMS activity logs found.</div>
            )}
            {computedActivityLog.map((log, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 ${log.alert?'bg-danger-50/40':''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.alert?'bg-danger-100':'bg-primary-100'}`}>
                  {log.alert ? <AlertTriangle size={14} className="text-danger-600"/> : <CheckCircle size={14} className="text-primary-600"/>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-800">{log.action}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="badge-surface text-xs">{log.dept}</span>
                    <span className="text-xs text-surface-500">{log.faculty}</span>
                  </div>
                </div>
                <span className={`text-xs ${log.alert?'text-danger-500 font-semibold':'text-surface-400'}`}>{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={nudgeModal} onClose={()=>setNudgeModal(false)} title={`Send Reminder – ${nudgeDept}`}
        footer={<><button onClick={()=>setNudgeModal(false)} className="btn-secondary">Cancel</button><button onClick={sendNudge} className="btn-warning">Send Reminder</button></>}>
        <div className="space-y-4">
          <div className="alert-warning"><AlertTriangle size={15}/>{nudgeDept} has low LMS compliance. This will notify the HOD.</div>
          <FormField label="Message"><textarea rows={3} className="text-sm" defaultValue={`Dear HOD,\n\nPlease ensure all course materials are uploaded to LMS and students are actively engaged. Current compliance is below the required 80% threshold.\n\nRegards,\nPrincipal Office`}/></FormField>
        </div>
      </Modal>
    </div>
  );
}
