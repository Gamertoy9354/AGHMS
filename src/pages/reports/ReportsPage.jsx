import React, { useState } from 'react';
import {
  FileText, Download, Filter, BarChart2, Calendar,
  CheckSquare, IndianRupee, GraduationCap, Users, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, FormField, TabBar } from '../../components/ui/index';
import { useDepartments, useAcademicYears, useCurrentYear } from '../../hooks/useData';

const REPORT_TYPES = [
  {
    id:'meeting_summary',
    icon: Calendar,
    title:'Meeting Summary Report',
    desc:'HOD meeting history, attendance, action item completion rates',
    color:'bg-primary-50 text-primary-600 border-primary-100',
  },
  {
    id:'compliance_matrix',
    icon: CheckSquare,
    title:'Document Compliance Matrix',
    desc:'Department-wise document submission status for all meetings',
    color:'bg-success-50 text-success-600 border-success-100',
  },
  {
    id:'academic_performance',
    icon: BarChart2,
    title:'Academic Performance Report',
    desc:'Sem-wise SGPA, pass %, backlogs, and weak student analysis',
    color:'bg-warning-50 text-warning-600 border-warning-100',
  },
  {
    id:'attendance_report',
    icon: Users,
    title:'Attendance Defaulter Report',
    desc:'Students below 75% with contact details and parent info',
    color:'bg-orange-50 text-orange-600 border-orange-100',
  },
  {
    id:'fees_collection',
    icon: IndianRupee,
    title:'Fee Collection Report',
    desc:'Department and semester-wise fee collection summary with defaulters',
    color:'bg-green-50 text-green-600 border-green-100',
  },
  {
    id:'placement_report',
    icon: GraduationCap,
    title:'Placement Report',
    desc:'Company-wise offers, package analysis, and department placement rates',
    color:'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    id:'naac_readiness',
    icon: FileText,
    title:'NBA/NAAC Readiness Report',
    desc:'Criterion-wise evidence status and submission completeness',
    color:'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    id:'atr_report',
    icon: RefreshCw,
    title:'ATR Status Report',
    desc:'Action Taken Report — pending, delayed, and completed items across all meetings',
    color:'bg-rose-50 text-rose-600 border-rose-100',
  },
];

const FORMATS = ['PDF', 'Excel (.xlsx)', 'CSV'];

export default function ReportsPage() {
  const [selected, setSelected]  = useState(null);
  const [genModal, setGenModal]  = useState(false);
  const [format, setFormat]      = useState('PDF');
  const [deptFilter, setDeptFilter] = useState('all');
  const [generating, setGenerating] = useState(false);

  const { data: depts = [] }    = useDepartments();
  const { data: years = [] }    = useAcademicYears();
  const { data: currentYear }   = useCurrentYear();
  const [yearFilter, setYearFilter] = useState('');

  const openGenerate = (r) => { setSelected(r); setGenModal(true); };

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise(res => setTimeout(res, 1800));
    toast.success(`${selected.title} (${format}) generated successfully!`);
    setGenerating(false);
    setGenModal(false);
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Reports Generator"
        subtitle="Generate PDF or Excel reports for any module — meetings, academics, fees, compliance"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {REPORT_TYPES.map(r => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => openGenerate(r)}
              className="card p-5 text-left hover:shadow-card-hover active:scale-[0.98] transition-all group"
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 ${r.color} group-hover:scale-110 transition-transform`}>
                <Icon size={22}/>
              </div>
              <h3 className="text-sm font-bold text-surface-900 mb-1 group-hover:text-primary-700 transition-colors">{r.title}</h3>
              <p className="text-xs text-surface-500 leading-relaxed">{r.desc}</p>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-primary-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                <Download size={12}/> Generate Report
              </div>
            </button>
          );
        })}
      </div>

      {/* Generate Modal */}
      {selected && (
        <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${genModal?'':'hidden'}`}
             onClick={e => e.target===e.currentTarget && setGenModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-surface-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${selected.color}`}>
                  <selected.icon size={18}/>
                </div>
                <h3 className="text-base font-semibold text-surface-900">{selected.title}</h3>
              </div>
              <button onClick={()=>setGenModal(false)} className="btn-ghost p-1.5 text-surface-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <FormField label="Academic Year">
                <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} className="text-sm">
                  <option value="">All Years</option>
                  {years.map(y=><option key={y.id} value={y.id}>{y.year_name}</option>)}
                  {years.length===0 && <option value="2024-25">2024-25</option>}
                </select>
              </FormField>
              <FormField label="Department">
                <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="text-sm">
                  <option value="all">All Departments</option>
                  {depts.map(d=><option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
                  {depts.length===0 && ['CSE','MECH','ELE','IT','CIV','EC'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Export Format">
                <div className="flex gap-2">
                  {FORMATS.map(f=>(
                    <button key={f} onClick={()=>setFormat(f)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${format===f?'bg-primary-600 text-white border-primary-600':'bg-white text-surface-600 border-surface-200 hover:border-primary-300'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-surface-100">
              <button onClick={()=>setGenModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleGenerate} disabled={generating} className="btn-primary">
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    Generating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Download size={14}/> Generate</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
