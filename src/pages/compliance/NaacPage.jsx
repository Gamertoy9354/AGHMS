import React, { useState } from 'react';
import {
  ShieldCheck, FileCheck, AlertTriangle, Upload, Plus,
  Download, Search, CheckCircle, Clock, XCircle, ChevronRight,
  BookOpen, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompliance, useCreateComplianceDoc } from '../../hooks/useData';
import { useDepartments } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, ProgressBar, TabBar, Modal, FormField, Spinner, EmptyState, SearchBar } from '../../components/ui/index';
import { exportToCSV } from '../../lib/exportUtils';

const CRITERIA = [
  { id:'1', label:'1. Institutional Vision & Leadership', docs:8, submitted:7, pct:87.5 },
  { id:'2', label:'2. Academic Excellence', docs:15, submitted:12, pct:80 },
  { id:'3', label:'3. Research & Innovation', docs:10, submitted:6, pct:60 },
  { id:'4', label:'4. Infrastructure & Resources', docs:12, submitted:11, pct:91.7 },
  { id:'5', label:'5. Student Support & Progression', docs:14, submitted:10, pct:71.4 },
  { id:'6', label:'6. Governance, Leadership & Management', docs:9, submitted:8, pct:88.9 },
  { id:'7', label:'7. Institutional Values & Best Practices', docs:6, submitted:5, pct:83.3 },
];

const NBA_CRITERIA = [
  { id:'a', label:'A. Program Outcomes & PSOs', docs:6, submitted:5, pct:83.3 },
  { id:'b', label:'B. CO-PO Mapping & Attainment', docs:8, submitted:6, pct:75 },
  { id:'c', label:'C. Continuous Assessment', docs:5, submitted:5, pct:100 },
  { id:'d', label:'D. CO Attainment Computation', docs:7, submitted:4, pct:57.1 },
  { id:'e', label:'E. PO Attainment', docs:6, submitted:3, pct:50 },
];

const STATUS_STYLE = { approved:'badge-success', pending:'badge-warning', rejected:'badge-danger' };

export default function NaacPage() {
  const { user, isHOD, canApprove } = useAuth();
  const [tab, setTab]   = useState('naac');
  const [search, setSearch] = useState('');
  const [uploadModal, setUploadModal] = useState(false);
  const [form, setForm]     = useState({ criterion:'', document_title:'', department_id:'', file:null });
  const [saving, setSaving] = useState(false);

  const { data: depts = [] } = useDepartments();
  const { data: realDocs }   = useCompliance({});
  const createDoc = useCreateComplianceDoc();

  const docs = realDocs || [];
  const criteria = tab === 'naac' ? CRITERIA : NBA_CRITERIA;

  const totalPct = Math.round(criteria.reduce((s,c)=>s+(c.submitted/c.docs)*100,0) / criteria.length);

  const handleUpload = async () => {
    if (!form.criterion || !form.document_title) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    try {
      await createDoc.mutateAsync({
        criterion_name: form.criterion,
        document_title: form.document_title,
        department_id:  form.department_id || null,
        uploaded_by:    user?.id,
        uploaded_date:  new Date().toISOString().split('T')[0],
      });
      toast.success('Document uploaded for review');
      setUploadModal(false);
    } catch { toast.error('Upload failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="NBA / NAAC Compliance"
        subtitle="Track accreditation evidence, criteria completion, and document submissions"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => exportToCSV(docs, 'naac_nba_compliance.csv')} className="btn-secondary text-sm"><Download size={14} /> Export</button>
            <button onClick={() => setUploadModal(true)} className="btn-primary text-sm"><Upload size={14} /> Upload Evidence</button>
          </div>
        }
      />

      {/* Overall readiness */}
      <div className="card p-6 mb-6 gradient-primary text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white/80 text-sm mb-1">Overall Readiness</h3>
            <p className="text-4xl font-black">{totalPct}%</p>
            <p className="text-white/70 text-sm mt-1">
              {tab === 'naac' ? 'NAAC' : 'NBA'} Criterion Coverage
            </p>
          </div>
          <div className="w-24 h-24 rounded-full border-4 border-white/30 flex items-center justify-center">
            <Award size={36} className="text-white/80" />
          </div>
        </div>
        <ProgressBar
          value={totalPct}
          className="mt-4"
          colorThresholds={[80, 60]}
        />
      </div>

      <TabBar
        tabs={[
          { id:'naac', label:'NAAC Criteria' },
          { id:'nba',  label:'NBA OBE Criteria' },
          { id:'docs', label:'Evidence Docs', count: docs.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {(tab === 'naac' || tab === 'nba') && (
        <div className="space-y-3">
          {criteria.map(c => (
            <div key={c.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      c.pct >= 80 ? 'bg-success-100 text-success-700' : c.pct >= 60 ? 'bg-warning-100 text-warning-700' : 'bg-danger-100 text-danger-700'
                    }`}>{c.id}</span>
                    <h4 className="text-sm font-semibold text-surface-800">{c.label}</h4>
                  </div>
                  <ProgressBar value={c.pct} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-surface-900">{c.pct}%</p>
                  <p className="text-xs text-surface-400">{c.submitted}/{c.docs} docs</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'docs' && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder="Search documents, criteria, department…" />
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr><th>Document</th><th>Criterion</th><th>Department</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {docs.filter(d =>
                  d.document_title.toLowerCase().includes(search.toLowerCase()) ||
                  d.department?.code?.toLowerCase().includes(search.toLowerCase())
                ).map(doc => (
                  <tr key={doc.id}>
                    <td className="font-medium text-surface-800">{doc.document_title}</td>
                    <td><span className="badge-primary text-xs">Criterion {doc.criterion_name}</span></td>
                    <td className="text-surface-600">{doc.department?.code || '—'}</td>
                    <td className="text-surface-500 text-xs">{doc.uploaded_date}</td>
                    <td><span className={`badge ${STATUS_STYLE[doc.approval_status]||'badge-surface'}`}>{doc.approval_status}</span></td>
                    <td>
                      {doc.document_url
                        ? <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">View</a>
                        : <span className="text-xs text-surface-300">No file</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Upload Modal */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Upload Evidence Document"
        footer={
          <>
            <button onClick={() => setUploadModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleUpload} disabled={saving} className="btn-primary">
              {saving ? <Spinner size={14} className="border-t-white border-white/30" /> : <Upload size={14} />}
              Upload Document
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Accreditation Type" required>
            <select value={form.criterion.split('.')[0] || ''} onChange={e => setForm(p=>({...p, criterion:''}))} className="text-sm">
              <option value="">Select type</option>
              <option value="naac">NAAC</option>
              <option value="nba">NBA</option>
            </select>
          </FormField>
          <FormField label="Criterion" required>
            <select value={form.criterion} onChange={e => setForm(p=>({...p, criterion:e.target.value}))} className="text-sm">
              <option value="">Select criterion</option>
              {CRITERIA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Document Title" required>
            <input type="text" value={form.document_title} onChange={e=>setForm(p=>({...p, document_title:e.target.value}))} placeholder="e.g. CO-PO Mapping Matrix 2024-25" />
          </FormField>
          <FormField label="Department (if department-specific)">
            <select value={form.department_id} onChange={e => setForm(p=>({...p, department_id:e.target.value}))} className="text-sm">
              <option value="">Institute Level</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
            </select>
          </FormField>
          <FormField label="Upload File" hint="PDF, DOCX, XLSX accepted (max 10MB)">
            <input type="file" accept=".pdf,.docx,.xlsx,.xls,.ppt,.pptx" className="text-sm" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
