'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  Bell,
  UserPlus,
  MessageSquare,
  Heart,
  AtSign,
  Trophy,
  Info,
  CheckCheck,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification
} from '@/lib/social/social';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { clientLogger } from '@/lib/client-logger';
import { toast } from 'sonner';

// ─── NOTIFICATION ICONS ──────────────────────────────────────────────────────

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  friend_request: <UserPlus className="h-4 w-4 text-blue-400" />,
  friend_accepted: <UserPlus className="h-4 w-4 text-green-400" />,
  thread_reply: <MessageSquare className="h-4 w-4 text-emerald-400" />,
  mention: <AtSign className="h-4 w-4 text-purple-400" />,
  like: <Heart className="h-4 w-4 text-pink-400" />,
  system: <Info className="h-4 w-4 text-slate-400" />,
  achievement: <Trophy className="h-4 w-4 text-amber-400" />,
};

// ─── NOTIFICATION ITEM ───────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }
    onClick?.(notification);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
        notification.is_read 
          ? "bg-transparent hover:bg-slate-800/50" 
          : "bg-blue-500/10 hover:bg-blue-500/15"
      )}
    >
      {/* Icon */}
      <div className="mt-0.5">
        {NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          notification.is_read ? "text-slate-300" : "text-white font-medium"
        )}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: it })}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
      )}
    </div>
  );
}

// ─── NOTIFICATIONS PANEL ─────────────────────────────────────────────────────

interface NotificationsPanelProps {
  /** uid di Supabase Auth (notifications.user_id), NON l'id del profilo locale. */
  userId: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationsPanel({ userId, onNotificationClick }: NotificationsPanelProps) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Caricamento fallito: il pannello lo dice invece di mostrare "nessuna notifica".
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);

  // ─── LOAD DATA ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(userId),
        getUnreadCount(userId)
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
      setLoadFailed(false);
    } catch (error) {
      clientLogger.warn('[NotificationsPanel] Error loading:', error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
    // Refresh every minute
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Reload when panel opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────────

  const handleMarkRead = async (notificationId: string) => {
    const ok = await markNotificationRead(notificationId).catch(() => false);
    if (!ok) return; // resta non letta: sul server non è cambiato nulla
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    const ok = await markAllNotificationsRead(userId).catch(() => false);
    if (!ok) {
      toast.error(t('common.impossibileSalvareLeModifiche'));
      return;
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick?.(notification);
    if (notification.link) {
      // Navigate to link
      window.location.href = notification.link;
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('social.notifications')} title={t('social.notifications')}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-500 text-white text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        align="end" 
        className="w-96 p-0 bg-slate-900 border-slate-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-white">{t('social.notifications')}</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-slate-400 hover:text-white"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Segna tutte lette
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : loadFailed ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Bell className="h-12 w-12 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">{t('forum.backendUnavailable')}</p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="p-2 space-y-1">
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleMarkRead}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">{t('social.noNotifications')}</p>
              <p className="text-xs text-slate-500 mt-1">
                {t('social.notifications').toLowerCase()}
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-slate-700">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              {t('social.notifications')}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── NOTIFICATIONS BADGE (Simple) ────────────────────────────────────────────

interface NotificationsBadgeProps {
  userId: string;
  onClick?: () => void;
}

export function NotificationsBadge({ userId, onClick }: NotificationsBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={onClick}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}

export default NotificationsPanel;

