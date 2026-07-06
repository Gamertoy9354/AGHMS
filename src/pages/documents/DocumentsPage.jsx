import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Upload, Eye, Download, CheckCircle, XCircle,
  AlertCircle, Clock, FileText, Filter, Building, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../hooks/useData';
import { DEPARTMENTS, DOC_STATUS_LABELS, DOC_STATUS_STYLES, DOCUMENT_TYPES } from '../../lib/constants';
import clsx from 'clsx';
import { Spinner } from '../../components/ui/index';

// Compliance matrix data
const DEPARTMENTS_LIST = ['CSE', 'MECH', 'ELE', 'EC', 'IT', 'CIV'];
const DOC_TYPES_SHORT  = ['CO Attainment', 'Attendance', 'Result Analysis', 'Placement', 'LMS Report', 'Fees'];

const MATRIX = {
  CSE: { 'CO Attainment':'approved',  'Attendance':'submitted', 'Result Analysis':'approved', 'Placement':'approved',  'LMS Report':'submitted', 'Fees':'submitted' },
  MECH: { 'CO Attainment':'submitted', 'Attendance':'submitted', 'Result Analysis':'pending',  'Placement':'submitted', 'LMS Report':'pending',   'Fees':'approved'  },
  ELE: { 'CO Attainment':'pending',   'Attendance':'pending',   'Result Analysis':'submitted','Placement':'submitted', 'LMS Report':'submitted', 'Fees':'submitted' },
  EC: { 'CO Attainment':'submitted', 'Attendance':'revision_requested', 'Result Analysis':'submitted', 'Placement':'pending', 'LMS Report':'submitted', 'Fees':'approved' },
  IT: { 'CO Attainment':'approved',  'Attendance':'approved',  'Result Analysis':'approved', 'Placement':'approved',  'LMS Report':'approved',  'Fees':'approved'  },
  CIV: { 'CO Attainment':'pending',   'Attendance':'overdue',   'Result Analysis':'overdue',  'Placement':'pending',   'LMS Report':'pending',   'Fees':'overdue'   },
};

const STATUS_CELL_STYLE = {
  approved:           'bg-success-100 text-success-700',
  submitted:          'bg-primary-100 text-primary-700',
  pending:            'bg-surface-100 text-surface-500',
  revision_requested: 'bg-warning-100 text-warning-700',
  overdue:            'bg-danger-100 text-danger-700',
};
const STATUS_ICON = {
  approved:           <CheckCircle size={13} />,
  submitted:          <Clock size={13} />,
  pending:            <AlertCircle size={13} />,
  revision_requested: <RefreshCw size={13} />,
  overdue:            <XCircle size={13} />,
};

export default function DocumentsPage() {
  const { isHOD, canApprove, profile } = useAuth();
  const [tab, setTab]   = useState('list'); // 'list' | 'matrix'
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: realDocs, isLoading } = useDocuments({});
  const docs = realDocs || [];

  const filtered = docs.filter(d => {
    const matchSearch = d.title?.toLowerCase().includes(search.toLowerCase()) ||
                        d.document_type?.toLowerCase().includes(search.toLowerCase());
    const deptCode = d.department?.code || d.dept;
    const matchDept   = deptFilter === 'all' || deptCode === deptFilter;
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="section-header mb-6">
        <div>
          <h1 className="section-title">Document Hub</h1>
          <p className="section-subtitle">
            Upload, track, and review meeting documents across all departments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHOD && (
            <button className="btn-primary">
              <Upload size={14} /> Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Dashboard KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Required', value: docs.length,  color: 'text-surface-700' },
          { label: 'Approved',       value: docs.filter(d=>d.status==='approved').length,   color: 'text-success-600' },
          { label: 'Submitted',      value: docs.filter(d=>d.status==='submitted').length,  color: 'text-primary-600' },
          { label: 'Pending',        value: docs.filter(d=>d.status==='pending').length,    color: 'text-warning-600' },
          { label: 'Overdue',        value: docs.filter(d=>d.status==='overdue').length,    color: 'text-danger-600' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-surface-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 bg-surface-100 p-1 rounded-xl w-fit">
        {['list', 'matrix'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
            )}
          >
            {t === 'list' ? 'Document List' : 'Compliance Matrix'}
          </button>
        ))}
      </div>

      {tab === 'list' ? (
        <>
          {/* Filters */}
          <div className="card p-4 mb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="search"
                  placeholder="Search documents…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="sm:w-40 text-sm"
              >
                <option value="all">All Depts</option>
                {DEPARTMENTS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="sm:w-40 text-sm"
              >
                <option value="all">All Status</option>
                {Object.entries(DOC_STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Document list */}
          <div className="space-y-2">
            {filtered.map(doc => {
              const style = DOC_STATUS_STYLES[doc.status] || DOC_STATUS_STYLES.pending;
              return (
                <div key={doc.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-100 border border-surface-200
                                  flex items-center justify-center">
                    <FileText size={18} className="text-surface-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`badge ${style.badge}`}>{DOC_STATUS_LABELS[doc.status]}</span>
                      <span className="badge-surface">{doc.dept}</span>
                      <span className="badge-surface">{doc.doc_type}</span>
                      {doc.version > 1 && <span className="badge-warning">v{doc.version}</span>}
                    </div>
                    <p className="text-sm font-semibold text-surface-800 truncate">{doc.title}</p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {doc.submitted_at
                        ? `Submitted: ${new Date(doc.submitted_at).toLocaleDateString('en-IN')}`
                        : 'Not yet submitted'
                      }
                      {doc.file_size ? ` · ${doc.file_size}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status !== 'pending' && doc.status !== 'overdue' && (
                      <>
                        <button className="btn-ghost text-xs">
                          <Eye size={13} /> Preview
                        </button>
                        <button className="btn-secondary text-xs">
                          <Download size={13} /> Download
                        </button>
                      </>
                    )}
                    {canApprove && doc.status === 'submitted' && (
                      <>
                        <button className="btn-success text-xs">
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button className="btn-warning text-xs">
                          <RefreshCw size={13} /> Revise
                        </button>
                      </>
                    )}
                    {isHOD && (doc.status === 'pending' || doc.status === 'overdue' || doc.status === 'revision_requested') && (
                      <button className="btn-primary text-xs">
                        <Upload size={13} /> Upload
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Compliance Matrix */
        <div className="card p-5 overflow-x-auto">
          <h3 className="text-base font-semibold text-surface-800 mb-4">
            Document Compliance Matrix — HOD Meeting June 2025
          </h3>
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="text-left p-2 font-semibold text-surface-600 border-b border-surface-200 w-20">Dept</th>
                {DOC_TYPES_SHORT.map(dt => (
                  <th key={dt} className="p-2 font-semibold text-surface-600 border-b border-surface-200 text-center min-w-[110px]">
                    {dt}
                  </th>
                ))}
                <th className="p-2 font-semibold text-surface-600 border-b border-surface-200 text-center">Score</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENTS_LIST.map(dept => {
                const deptData = MATRIX[dept] || {};
                const submitted = Object.values(deptData).filter(s => ['approved','submitted'].includes(s)).length;
                const total     = DOC_TYPES_SHORT.length;
                const score     = Math.round((submitted / total) * 100);
                return (
                  <tr key={dept} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="p-2 font-semibold text-surface-800">{dept}</td>
                    {DOC_TYPES_SHORT.map(dt => {
                      const status = deptData[dt] || 'pending';
                      return (
                        <td key={dt} className="p-1.5 text-center">
                          <span className={clsx(
                            'inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium',
                            STATUS_CELL_STYLE[status]
                          )}>
                            {STATUS_ICON[status]}
                            <span className="capitalize hidden sm:inline">{status.replace('_',' ')}</span>
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="progress w-16">
                          <div
                            className={`progress-bar ${score >= 80 ? 'bg-success-500' : score >= 50 ? 'bg-warning-500' : 'bg-danger-500'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="font-semibold text-surface-700">{score}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-surface-100">
            {Object.entries(STATUS_CELL_STYLE).map(([status, style]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <span className={`px-2 py-0.5 rounded-md font-medium ${style}`}>
                  {DOC_STATUS_LABELS[status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
