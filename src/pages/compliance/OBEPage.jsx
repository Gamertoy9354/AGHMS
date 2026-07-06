import React, { useState } from 'react';
import { Award, BookOpen, Target, TrendingUp, Plus, Download, Info } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageHeader, TabBar, ProgressBar, FormField, Spinner } from '../../components/ui/index';
import { exportToCSV } from '../../lib/exportUtils';
import toast from 'react-hot-toast';

const PO_LABELS = ['PO1','PO2','PO3','PO4','PO5','PO6','PO7','PO8','PO9','PO10','PO11','PO12'];
const PO_NAMES  = ['Engineering Knowledge','Problem Analysis','Design/Dev of Solutions','Investigation','Modern Tool Usage','Engineer & Society','Environment','Ethics','Individual & Teamwork','Communication','Project Management','Lifelong Learning'];

const CO_PO_DATA = {
  'CS301': { name:'Data Structures', cos: [
    { co:'CO1', po1:3,po2:2,po3:1,attainment:2.8 },
    { co:'CO2', po1:2,po2:3,po3:2,attainment:2.5 },
    { co:'CO3', po1:1,po2:2,po3:3,attainment:2.1 },
  ]},
  'CS401': { name:'Database Systems', cos: [
    { co:'CO1', po1:3,po2:1,po3:2,attainment:2.9 },
    { co:'CO2', po1:2,po2:2,po3:3,attainment:2.3 },
  ]},
};

const PO_ATTAINMENT_DATA = PO_LABELS.map((po,i) => ({
  po,
  direct:   +(2 + Math.random()).toFixed(2),
  indirect: +(1.5 + Math.random()*0.8).toFixed(2),
  target:   2.5,
}));

const DEPT_PO = [
  { dept:'CSE', avg:2.4 },{ dept:'MECH', avg:2.1 },{ dept:'ELE', avg:2.3 },
  { dept:'EC', avg:2.2 },{ dept:'IT', avg:2.6 },{ dept:'CIV', avg:1.9 },
];

export default function OBEPage() {
  const [tab, setTab]    = useState('co_po');
  const [subject, setSubject] = useState('CS301');
  const [saving, setSaving]   = useState(false);

  const currentSubj = CO_PO_DATA[subject];

  const radarData = PO_LABELS.slice(0,6).map((po,i) => ({
    po, CSE:2.4, MECH:2.1, IT:2.6
  }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,1000));
    toast.success('CO-PO mapping saved!');
    setSaving(false);
  };

  const corr = (v) => v===3?'H':v===2?'M':v===1?'L':'—';
  const corrColor = (v) => v===3?'bg-success-500 text-white':v===2?'bg-warning-400 text-white':v===1?'bg-primary-200 text-primary-800':'bg-surface-100 text-surface-300';

  return (
    <div className="page-wrapper">
      <PageHeader
        title="OBE / CO-PO Attainment"
        subtitle="Course outcome mapping, direct/indirect attainment, and PO computation"
        actions={<button onClick={() => exportToCSV(PO_ATTAINMENT, 'obe_attainment.csv')} className="btn-secondary text-sm"><Download size={14}/> Export Report</button>}
      />

      <TabBar
        tabs={[
          { id:'co_po',       label:'CO-PO Mapping' },
          { id:'attainment',  label:'PO Attainment' },
          { id:'dept_compare',label:'Dept Comparison' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab==='co_po' && (
        <div className="space-y-5">
          <div className="card p-4 flex items-center gap-4">
            <FormField label="Select Subject" hint="CO-PO matrix for this subject">
              <select value={subject} onChange={e=>setSubject(e.target.value)} className="text-sm w-56">
                {Object.entries(CO_PO_DATA).map(([code,s])=><option key={code} value={code}>{code} – {s.name}</option>)}
              </select>
            </FormField>
            <div className="flex items-center gap-1.5 text-xs text-surface-500 mt-5">
              <span className="w-4 h-4 rounded bg-success-500 text-white text-center leading-4 text-[10px] font-bold">H</span>High (3)
              <span className="w-4 h-4 rounded bg-warning-400 text-white text-center leading-4 text-[10px] font-bold ml-2">M</span>Medium (2)
              <span className="w-4 h-4 rounded bg-primary-200 text-primary-800 text-center leading-4 text-[10px] font-bold ml-2">L</span>Low (1)
            </div>
          </div>

          {currentSubj && (
            <div className="card overflow-auto">
              <div className="p-4 border-b border-surface-100">
                <h3 className="text-sm font-semibold text-surface-800">{subject} – {currentSubj.name} | CO-PO Mapping Matrix</h3>
              </div>
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th>CO</th>
                    {PO_LABELS.slice(0,6).map(p=><th key={p} className="text-center">{p}</th>)}
                    <th>Attainment</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSubj.cos.map(co=>(
                    <tr key={co.co}>
                      <td className="font-semibold text-primary-700">{co.co}</td>
                      {['po1','po2','po3','po4','po5','po6'].map(p=>(
                        <td key={p} className="text-center p-2">
                          <span className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center mx-auto ${corrColor(co[p])}`}>
                            {corr(co[p])}
                          </span>
                        </td>
                      ))}
                      <td>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={co.attainment} max={3} showLabel={false} className="w-16"/>
                          <span className={`font-bold text-sm ${co.attainment>=2.5?'text-success-700':co.attainment>=2?'text-warning-700':'text-danger-700'}`}>{co.attainment}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex justify-end border-t border-surface-100">
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                  {saving?<Spinner size={13} className="border-t-white border-white/30"/>:null} Save Mapping
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='attainment' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-1">PO Attainment – CSE Department (Even Sem 2024-25)</h3>
            <p className="text-xs text-surface-400 mb-4">Target: 2.5 | Direct: Exam/Assignment | Indirect: Survey</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={PO_ATTAINMENT_DATA.slice(0,8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="po" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,3]} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',fontSize:'12px'}}/>
                <Bar dataKey="direct"   name="Direct"   radius={[4,4,0,0]} fill="#3b82f6"/>
                <Bar dataKey="indirect" name="Indirect" radius={[4,4,0,0]} fill="#22c55e"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-100">
              <h3 className="text-sm font-semibold">PO Attainment Table</h3>
            </div>
            <table className="table-base text-sm">
              <thead><tr><th>PO</th><th>Description</th><th>Direct</th><th>Indirect</th><th>Final</th><th>Status</th></tr></thead>
              <tbody>
                {PO_ATTAINMENT_DATA.slice(0,8).map((po,i)=>{
                  const final = +(po.direct*0.8 + po.indirect*0.2).toFixed(2);
                  return (
                    <tr key={po.po}>
                      <td className="font-bold text-primary-700">{po.po}</td>
                      <td className="text-xs text-surface-500">{PO_NAMES[i]}</td>
                      <td className="font-semibold">{po.direct}</td>
                      <td className="font-semibold">{po.indirect}</td>
                      <td className="font-bold">{final}</td>
                      <td><span className={`badge ${final>=2.5?'badge-success':final>=2?'badge-warning':'badge-danger'}`}>{final>=2.5?'Attained':final>=2?'Partial':'Not Attained'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='dept_compare' && (
        <div className="card p-5">
          <h3 className="text-base font-semibold mb-4">Average PO Attainment by Department</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={DEPT_PO}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="dept" tick={{fontSize:12,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,3]} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',fontSize:'12px'}}/>
              <Bar dataKey="avg" name="Avg PO Attainment" radius={[6,6,0,0]}>
                {DEPT_PO.map((e,i) => (
                  <Cell key={i} fill={e.avg>=2.5?'#22c55e':e.avg>=2?'#f59e0b':'#ef4444'}/>
                ))}
              </Bar>
            </BarChart>

          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {DEPT_PO.map(d=>(
              <div key={d.dept} className="flex items-center gap-3">
                <span className="text-sm font-semibold w-8">{d.dept}</span>
                <ProgressBar value={d.avg} max={3} className="flex-1"/>
                <span className={`text-sm font-bold w-8 ${d.avg>=2.5?'text-success-700':d.avg>=2?'text-warning-700':'text-danger-700'}`}>{d.avg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
