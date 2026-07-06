import React, { useState } from 'react';
import { Activity, Search, Download, Filter, User, Shield } from 'lucide-react';
import { useAuditLogs } from '../../hooks/useData';
import { PageHeader, SearchBar, Spinner } from '../../components/ui/index';
import { formatDateTime } from '../../lib/supabaseHelpers';

const ACTION_STYLES = {
  INSERT:'badge-success', UPDATE:'badge-primary', DELETE:'badge-danger',
  APPROVE:'badge-primary', LOGIN:'badge-surface', UPLOAD:'badge-warning',
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');

  const { data: realLogs, isLoading } = useAuditLogs();
  const logs = realLogs || [];

  const filtered = logs.filter(l => {
    const matchSearch = (l.user?.full_name||'').toLowerCase().includes(search.toLowerCase()) ||
                        l.action_type.toLowerCase().includes(search.toLowerCase()) ||
                        l.entity_type.toLowerCase().includes(search.toLowerCase());
    const matchEntity = filterEntity === 'all' || l.entity_type === filterEntity;
    return matchSearch && matchEntity;
  });

  const entities = [...new Set(logs.map(l => l.entity_type))];

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Audit Logs"
        subtitle="Complete system activity trail — who did what, when"
        actions={<button className="btn-secondary text-sm"><Download size={14}/> Export Logs</button>}
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search by user, action, entity…">
        <select value={filterEntity} onChange={e=>setFilterEntity(e.target.value)} className="w-auto text-sm">
          <option value="all">All Entities</option>
          {entities.map(e=><option key={e} value={e}>{e}</option>)}
        </select>
      </SearchBar>

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Changes</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="text-center py-8"><Spinner size={24} className="mx-auto"/></td></tr>}
            {!isLoading && filtered.map(log => (
              <tr key={log.id}>
                <td className="text-xs text-surface-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <User size={12} className="text-primary-600"/>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">{log.user?.full_name||'System'}</p>
                      <p className="text-xs text-surface-400 capitalize">{log.user?.role||'—'}</p>
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${ACTION_STYLES[log.action_type]||'badge-surface'}`}>{log.action_type}</span></td>
                <td>
                  <p className="text-xs font-mono bg-surface-100 px-2 py-0.5 rounded">{log.entity_type}</p>
                  {log.entity_id && <p className="text-[10px] text-surface-400 mt-0.5">{String(log.entity_id).slice(0,8)}</p>}
                </td>
                <td className="max-w-xs">
                  <p className="text-xs text-surface-600 font-mono truncate">
                    {JSON.stringify(log.changes)}
                  </p>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length===0 && (
              <tr><td colSpan={5} className="text-center py-10 text-surface-400">No audit logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
