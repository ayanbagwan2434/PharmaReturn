import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
} from 'lucide-react';
import { AppNotification, NavSection } from '../types/pharma';
import { formatDateTime } from '../utils/formatters';

interface NotificationsViewProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenTarget: (section: NavSection, targetId?: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onOpenTarget,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const visibleNotifications = useMemo(() => {
    return notifications.filter((n) => (filter === 'unread' ? !n.isRead : true));
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Notifications &amp; Deadline Reminders
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Actionable alerts for closing return windows, pending supplier pickups, and credit note discrepancies.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filter === 'unread'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md inline-flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
        {visibleNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-900">You are all caught up</div>
            <div className="text-xs text-slate-500 mt-1">
              No unread deadline alerts or credit discrepancy reminders.
            </div>
          </div>
        ) : (
          visibleNotifications.map((item) => {
            const Icon =
              item.severity === 'critical'
                ? AlertTriangle
                : item.severity === 'warning'
                  ? Clock
                  : Info;
            const iconColor =
              item.severity === 'critical'
                ? 'text-red-600'
                : item.severity === 'warning'
                  ? 'text-amber-600'
                  : 'text-teal-700';

            return (
              <div
                key={item.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  item.isRead ? 'bg-white' : 'bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          item.isRead
                            ? 'font-medium text-slate-700'
                            : 'font-semibold text-slate-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span className="text-[11px] font-medium text-teal-700">Unread</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                    <div className="text-[11px] font-mono text-slate-400 mt-1.5">
                      {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!item.isRead && (
                    <button
                      onClick={() => onMarkRead(item.id)}
                      className="h-8 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-md inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Read</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!item.isRead) onMarkRead(item.id);
                      onOpenTarget(item.targetSection, item.targetId);
                    }}
                    className="h-8 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Open Record</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
