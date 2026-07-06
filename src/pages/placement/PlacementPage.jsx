import React, { useState, useMemo } from 'react';
import {
  Briefcase, TrendingUp, Users, Award, Building, MapPin,
  Search, Download, DollarSign, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line
} from 'recharts';
import { usePlacementOffers, usePlacementDrives, useDepartments } from '../../hooks/useData';
import { exportToCSV } from '../../lib/exportUtils';
import { Spinner, EmptyState } from '../../components/ui/index';

const COLORS = ['#3b82f6', '#f97316', '#a855f7', '#22c55e', '#94a3b8', '#ec4899'];

const TYPE_BADGE = {
  IT:   'bg-blue-100 text-blue-700',
  Core: 'bg-orange-100 text-orange-700',
};
const STATUS_STYLE = {
  completed: 'badge-success',
  scheduled: 'badge-primary',
  upcoming:  'badge-warning',
};

export default function PlacementPage() {
  const [search, setSearch] = useState('');

  const { data: offersRaw = [],  isLoading: loadingOffers }  = usePlacementOffers({});
  const { data: drivesRaw = [],  isLoading: loadingDrives }  = usePlacementDrives();
  const { data: departments = [] } = useDepartments();

  const loading = loadingOffers || loadingDrives;

  // ── KPI Aggregates ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const accepted    = offersRaw.filter(o => o.acceptance_status === 'accepted');
    const pkgs        = offersRaw.filter(o => o.package_ctc).map(o => o.package_ctc);
    const uniqueStuds = new Set(offersRaw.map(o => o.student_id)).size;
    const uniqueCos   = new Set(offersRaw.map(o => o.company_id)).size;
    const avg         = pkgs.length ? pkgs.reduce((s, p) => s + p, 0) / pkgs.length : 0;
    const max         = pkgs.length ? Math.max(...pkgs) : 0;
    return {
      placed:    accepted.length,
      eligible:  uniqueStuds,
      pct:       uniqueStuds > 0 ? ((accepted.length / uniqueStuds) * 100).toFixed(1) : '—',
      avg_pkg:   avg ? (avg / 100000).toFixed(1) : '—', // assuming stored in rupees
      highest:   max ? (max / 100000).toFixed(1) : '—',
      companies: uniqueCos,
    };
  }, [offersRaw]);

  // ── Department-wise breakdown ────────────────────────────────────────────────
  const deptPlacement = useMemo(() => {
    const map = {};
    offersRaw.forEach(o => {
      const code = o.student?.department?.code || 'Unknown';
      if (!map[code]) map[code] = { dept: code, eligible: 0, placed: 0, totalPkg: 0, pkgCount: 0 };
      map[code].eligible += 1;
      if (o.acceptance_status === 'accepted') {
        map[code].placed += 1;
        if (o.package_ctc) { map[code].totalPkg += o.package_ctc; map[code].pkgCount += 1; }
      }
    });
    return Object.values(map).map(d => ({
      ...d,
      pct:     d.eligible > 0 ? parseFloat(((d.placed / d.eligible) * 100).toFixed(1)) : 0,
      avg_pkg: d.pkgCount > 0 ? parseFloat((d.totalPkg / d.pkgCount / 100000).toFixed(1)) : 0,
    })).sort((a, b) => b.pct - a.pct);
  }, [offersRaw]);

  // ── Sector / Industry breakdown ──────────────────────────────────────────────
  const sectorData = useMemo(() => {
    const map = {};
    offersRaw.forEach(o => {
      const sector = o.company?.industry || o.company?.sector || 'Others';
      map[sector] = (map[sector] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [offersRaw]);

  // ── Package distribution ─────────────────────────────────────────────────────
  const pkgDist = useMemo(() => {
    const accepted = offersRaw.filter(o => o.acceptance_status === 'accepted' && o.package_ctc);
    const buckets  = [
      { range: '<3 LPA',   min: 0,       max: 300000,  color: '#ef4444', count: 0 },
      { range: '3-5 LPA',  min: 300000,  max: 500000,  color: '#f97316', count: 0 },
      { range: '5-8 LPA',  min: 500000,  max: 800000,  color: '#3b82f6', count: 0 },
      { range: '8-15 LPA', min: 800000,  max: 1500000, color: '#a855f7', count: 0 },
      { range: '>15 LPA',  min: 1500000, max: Infinity, color: '#22c55e', count: 0 },
    ];
    accepted.forEach(o => {
      const pkg = o.package_ctc;
      const bucket = buckets.find(b => pkg >= b.min && pkg < b.max);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [offersRaw]);

  // ── Recent Drives ────────────────────────────────────────────────────────────
  const filteredDrives = useMemo(() => {
    return drivesRaw.filter(d =>
      d.company?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.roles_offered?.toLowerCase().includes(search.toLowerCase())
    );
  }, [drivesRaw, search]);

  if (loading) {
    return (
      <div className="page-wrapper min-h-[60vh] flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="section-header mb-6">
        <div>
          <h1 className="section-title">Placement Monitoring</h1>
          <p className="section-subtitle">Track placement drives, offers, and department-wise statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(drivesRaw, 'placement_drives.csv')} className="btn-secondary text-xs">
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Placement %',    value: `${stats.pct}%`,     icon: TrendingUp,  color: 'blue' },
          { label: 'Students Placed', value: stats.placed,       icon: Users,       color: 'green' },
          { label: 'Avg Package',    value: `${stats.avg_pkg} LPA`, icon: DollarSign, color: 'purple' },
          { label: 'Companies',      value: stats.companies,     icon: Building,    color: 'orange' },
        ].map(kpi => {
          const colorMap = {
            blue:   'bg-primary-50 border-primary-100 text-primary-600',
            green:  'bg-success-50 border-success-100 text-success-600',
            purple: 'bg-violet-50 border-violet-100 text-violet-600',
            orange: 'bg-accent-50 border-accent-100 text-accent-600',
          };
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="kpi-card">
              <div className={`p-2.5 rounded-xl border ${colorMap[kpi.color]}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-surface-900">{kpi.value ?? '—'}</p>
              <p className="text-sm font-medium text-surface-600">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Dept bar chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="section-title text-base mb-4">Department-wise Placement %</h3>
          {deptPlacement.length === 0 ? (
            <EmptyState icon={Briefcase} title="No placement data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptPlacement} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize:12, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }}
                  formatter={v => [`${v}%`]}
                />
                <Legend wrapperStyle={{ fontSize:'11px' }} />
                <Bar dataKey="pct" name="Placement %" radius={[4,4,0,0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sector pie */}
        <div className="card p-5">
          <h3 className="section-title text-base mb-2">Sector-wise Placement</h3>
          {sectorData.length === 0 ? (
            <p className="text-xs text-surface-400 text-center py-8">No sector data available</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={2}>
                    {sectorData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${v} students`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {sectorData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-surface-600">{s.name}</span>
                    </div>
                    <span className="font-semibold text-surface-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Package distribution */}
      <div className="card p-5 mb-8">
        <h3 className="section-title text-base mb-4">Package Distribution (Accepted Offers)</h3>
        {pkgDist.every(b => b.count === 0) ? (
          <p className="text-xs text-surface-400 text-center py-6">No package data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pkgDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px' }} />
              <Bar dataKey="count" name="Students" radius={[4,4,0,0]}>
                {pkgDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent drives */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title text-base">Placement Drives</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="search"
              placeholder="Search company or role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 text-xs py-1.5 w-48"
            />
          </div>
        </div>
        {filteredDrives.length === 0 ? (
          <EmptyState icon={Briefcase} title="No placement drives found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role(s)</th>
                  <th>Drive Date</th>
                  <th>Offers Made</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrives.map(drive => {
                  const offerCount = drive.offers?.length ?? 0;
                  const driveDate  = drive.drive_date ? new Date(drive.drive_date) : null;
                  const today      = new Date();
                  const status     = !driveDate ? 'scheduled' : driveDate < today ? 'completed' : 'upcoming';
                  return (
                    <tr key={drive.id}>
                      <td className="font-semibold text-surface-900">{drive.company?.company_name || '—'}</td>
                      <td className="text-surface-600">{drive.roles_offered || '—'}</td>
                      <td className="text-surface-500">
                        {driveDate ? driveDate.toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="font-semibold">{offerCount}</td>
                      <td>
                        <span className={`badge ${STATUS_STYLE[status] || 'badge-surface'}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
