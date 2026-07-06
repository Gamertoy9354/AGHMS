import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { useNotificationsList, useMarkNotificationRead } from '../../hooks/useData';
import { notificationsService } from '../../lib/services';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, EmptyState, Spinner, TabBar } from '../../components/ui/index';
import { formatDateTime } from '../../lib/supabaseHelpers';
import toast from 'react-hot-toast';

const NOTIF_ICONS = {
  meeting:     { icon: Bell, bg: 'bg-primary-100', text: 'text-primary-600' },
  document:    { icon: CheckCircle, bg: 'bg-success-100', text: 'text-success-600' },
  action_item: { icon: AlertTriangle, bg: 'bg-danger-100', text: 'text-danger-600' },
  attendance:  { icon: XCircle, bg: 'bg-warning-100', text: 'text-warning-600' },
  fees:        { icon: Info, bg: 'bg-violet-100', text: 'text-violet-600' },
  default:     { icon: Bell, bg: 'bg-surface-100', text: 'text-surface-600' },
};

const PRIORITY_DOT = {
  critical: 'bg-danger-500',
  high:     'bg-warning-500',
  medium:   'bg-primary-500',
  low:      'bg-surface-400',
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60)  return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
  return `${Math.floor(seconds/86400)}d ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('all');
  const { data: realData, refetch } = useNotificationsList();
  const markRead = useMarkNotificationRead();

  const notifs = realData || [];

  const filtered = notifs.filter(n => {
    if (tab === 'unread') return !n.read_status;
    if (tab === 'critical') return n.priority === 'critical' || n.priority === 'high';
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read_status).length;

  const handleMarkRead = async (id) => {
    try {
      if (realData && realData.length > 0) await markRead.mutateAsync(id);
      toast.success('Marked as read');
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      if (realData && realData.length > 0) await notificationsService.markAllRead(user?.id);
      toast.success('All marked as read');
      refetch();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="page-wrapper max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        actions={
          unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn-secondary text-sm">
              <CheckCheck size={14} /> Mark all read
            </button>
          )
        }
      />

      <TabBar
        tabs={[
          { id:'all',      label:'All',      count: notifs.length },
          { id:'unread',   label:'Unread',   count: unreadCount },
          { id:'critical', label:'Important' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="space-y-2">
        {filtered.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description={tab === 'unread' ? "You're all caught up!" : "No notifications to show"}
          />
        )}
        {filtered.map(notif => {
          const typeConfig = NOTIF_ICONS[notif.notification_type] || NOTIF_ICONS.default;
          const Icon = typeConfig.icon;
          return (
            <div
              key={notif.id}
              className={`card p-4 flex items-start gap-4 transition-all hover:shadow-md ${
                !notif.read_status ? 'border-l-4 border-primary-400 bg-primary-50/20' : ''
              }`}
            >
              <div className={`p-2.5 rounded-xl ${typeConfig.bg} flex-shrink-0`}>
                <Icon size={18} className={typeConfig.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[notif.priority] || 'bg-surface-300'}`} />
                  <p className={`text-sm font-semibold ${!notif.read_status ? 'text-surface-900' : 'text-surface-700'}`}>
                    {notif.title}
                  </p>
                  <span className="text-xs text-surface-400 ml-auto flex-shrink-0">{timeAgo(notif.created_at)}</span>
                </div>
                <p className="text-sm text-surface-500 leading-relaxed">{notif.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  {notif.action_url && (
                    <a href={notif.action_url} className="text-xs font-medium text-primary-600 hover:underline">
                      View details →
                    </a>
                  )}
                  {!notif.read_status && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="text-xs text-surface-400 hover:text-surface-600 flex items-center gap-1 ml-auto"
                    >
                      <Check size={12} /> Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
