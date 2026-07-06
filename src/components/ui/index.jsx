import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';
import clsx from 'clsx';

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={clsx('modal-content', sizeMap[size], 'w-full')}>
        <div className="modal-header">
          <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, variant = 'danger', loading }) {
  if (!open) return null;
  const icons = { danger: Trash2, warning: AlertTriangle, info: Info };
  const Icon = icons[variant] || AlertTriangle;
  const colors = {
    danger:  { icon: 'text-danger-600 bg-danger-100', btn: 'btn-danger' },
    warning: { icon: 'text-warning-600 bg-warning-100', btn: 'btn-warning' },
    info:    { icon: 'text-primary-600 bg-primary-100', btn: 'btn-primary' },
  };
  const c = colors[variant];
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm w-full">
        <div className="p-6 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${c.icon}`}>
            <Icon size={24} />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 mb-2">{title}</h3>
          <p className="text-sm text-surface-500 mb-6">{message}</p>
          <div className="flex items-center gap-3 justify-center">
            <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
            <button onClick={onConfirm} className={c.btn} disabled={loading}>
              {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</span> : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton h-5 w-2/3 rounded" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className={`skeleton h-4 rounded ${i === lines - 2 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-surface-100">
        <div className="skeleton h-5 w-48 rounded" />
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} className="border-b border-surface-100">
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} className="px-4 py-3">
                  <div className={`skeleton h-4 rounded ${ci === 0 ? 'w-3/4' : 'w-1/2'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-surface-400" />
      </div>
      <h3 className="text-base font-semibold text-surface-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-surface-400 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">{title}</h1>
        {subtitle && <p className="text-surface-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────
export function StatsRow({ stats }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${Math.min(stats.length, 4)} gap-4 mb-6`}>
      {stats.map(s => (
        <div key={s.label} className="card p-4 text-center">
          <p className={`text-2xl font-bold ${s.color || 'text-surface-900'}`}>{s.value}</p>
          <p className="text-xs text-surface-500 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status, labels, styles }) {
  const label = labels?.[status] || status;
  const style = styles?.[status] || 'badge-surface';
  return <span className={`badge ${style}`}>{label}</span>;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, className = '', showLabel = true, colorThresholds = [80, 60] }) {
  const pct  = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= colorThresholds[0] ? 'bg-success-500' : pct >= colorThresholds[1] ? 'bg-warning-500' : 'bg-danger-500';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="progress flex-1">
        <div className={`progress-bar ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-xs font-semibold text-surface-700 w-8 text-right">{pct}%</span>}
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export function FormField({ label, error, hint, required, children }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="form-error">{error}</p>}
      {hint  && <p className="form-hint">{hint}</p>}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 'sm' }) {
  const sizes = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const initials = name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
  return (
    <div className={`avatar-initials gradient-primary flex-shrink-0 ${sizes[size]}`}>
      {initials}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 mb-6 bg-surface-100 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
            active === tab.id ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
          )}
        >
          {tab.icon && <tab.icon size={14} />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              active === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-surface-200 text-surface-500'
            }`}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Search + Filter bar ──────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search…', children }) {
  return (
    <div className="card p-4 mb-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
  return (
    <div className="card p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-danger-400 mb-3" />
      <h3 className="font-semibold text-surface-700 mb-1">Something went wrong</h3>
      <p className="text-sm text-surface-400 mb-4">{message || 'An error occurred. Please try again.'}</p>
      {onRetry && <button onClick={onRetry} className="btn-secondary text-sm">Try Again</button>}
    </div>
  );
}

// ─── Inline Loader ────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }) {
  return (
    <span className={`inline-block border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin ${className}`}
          style={{ width: size, height: size }} />
  );
}

// ─── Tag / pill input ─────────────────────────────────────────────────────────
export function TagInput({ value = [], onChange, placeholder = 'Add tag…', suggestions = [] }) {
  const [input, setInput] = React.useState('');
  const add = (tag) => {
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput('');
  };
  const remove = (tag) => onChange(value.filter(v => v !== tag));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 p-2 border border-surface-200 rounded-xl min-h-[42px] bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
        {value.map(tag => (
          <span key={tag} className="badge-primary flex items-center gap-1">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-primary-900"><X size={10} /></button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.trim()); } }}
          placeholder={placeholder}
          className="flex-1 min-w-[120px] border-0 p-0 text-sm focus:ring-0 bg-transparent"
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>
      <p className="form-hint">Press Enter or comma to add</p>
    </div>
  );
}
