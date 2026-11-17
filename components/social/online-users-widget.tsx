'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Circle,
  Gamepad2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  onPresenceUpdate,
  getOnlineUsers,
  refreshOnlineUsers,
  type OnlineUser,
} from '@/lib/social/presence';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ─── STATUS COLORS ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-noir-500',
};

const STATUS_LABELS: Record<string, string> = {
  online: '🟢 Online',
  away: '🟡 Away',
  busy: '🔴 Busy',
  offline: '⚫ Offline',
};

// ─── ONLINE USERS WIDGET ─────────────────────────────────────────────────────

interface OnlineUsersWidgetProps {
  onUserClick?: (userId: string) => void;
  maxDisplay?: number;
  showActivity?: boolean;
  className?: string;
}

export function OnlineUsersWidget({ 
  onUserClick, 
  maxDisplay = 10,
  showActivity = true,
  className 
}: OnlineUsersWidgetProps) {
  const { t } = useTranslation();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Subscribe to Realtime presence updates
    const unsub = onPresenceUpdate((users) => {
      setOnlineUsers(users);
      setLoading(false);
      setConnected(true);
    });

    // Also do an initial refresh from DB (in case Realtime hasn't synced)
    refreshOnlineUsers().then((users) => {
      if (users.length > 0) {
        setOnlineUsers(users);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Periodic DB refresh as fallback (every 60s)
    const interval = setInterval(() => {
      refreshOnlineUsers().catch(() => {});
    }, 60000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className={cn("p-4 rounded-xl bg-noir-800/50 border border-noir-700/50", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">{t('social.online')}</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="h-5 w-5 text-noir-500 animate-spin" />
        </div>
      </div>
    );
  }

  const displayUsers = onlineUsers.slice(0, maxDisplay);
  const remainingCount = Math.max(0, onlineUsers.length - maxDisplay);

  return (
    <div className={cn("p-4 rounded-xl bg-noir-800/50 border border-noir-700/50", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Users className="h-4 w-4 text-emerald-400" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          <span className="text-sm font-semibold text-white">{t('social.online')}</span>
          <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-400">
            {onlineUsers.length}
          </Badge>
          {connected && (
            <Wifi className="h-3 w-3 text-emerald-500/60" />
          )}
        </div>
        <button
          onClick={() => refreshOnlineUsers()}
          className="p-1 rounded hover:bg-noir-700/50 transition-colors"
          title="Aggiorna"
        >
          <RefreshCw className="h-3 w-3 text-noir-500" />
        </button>
      </div>

      {/* Users List */}
      {onlineUsers.length > 0 ? (
        <div className="space-y-2">
          {displayUsers.map(user => (
            <div
              key={user.userId}
              onClick={() => onUserClick?.(user.userId)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-noir-700/50 cursor-pointer transition-colors"
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  {user.avatar && !user.avatar.startsWith('gradient-') && !user.avatar.startsWith('avatar_') && <AvatarImage src={user.avatar} alt={user.username} />}
                  <AvatarFallback className="bg-noir-700 text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-noir-800",
                  STATUS_COLORS[user.status]
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{user.username}</p>
                {showActivity && user.currentGame ? (
                  <p className="text-xs text-emerald-400 flex items-center gap-1 truncate">
                    <Gamepad2 className="h-3 w-3" />
                    {user.currentGame}
                  </p>
                ) : showActivity && user.currentActivity ? (
                  <p className="text-xs text-noir-400 truncate">{user.currentActivity}</p>
                ) : (
                  <p className="text-2xs text-noir-500">{STATUS_LABELS[user.status] || ''}</p>
                )}
              </div>
            </div>
          ))}

          {remainingCount > 0 && (
            <div className="flex items-center justify-center pt-2">
              <span className="text-xs text-noir-400">
                +{remainingCount} {t('social.usersOnline')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <WifiOff className="h-6 w-6 text-noir-600 mx-auto mb-2" />
          <p className="text-sm text-noir-500">{t('social.noOnlineUsers')}</p>
          <p className="text-2xs text-noir-600 mt-1">Connettiti per vedere chi è online</p>
        </div>
      )}
    </div>
  );
}

// ─── COMPACT ONLINE INDICATOR ────────────────────────────────────────────────

interface OnlineIndicatorProps {
  className?: string;
}

export function OnlineIndicator({ className }: OnlineIndicatorProps) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Subscribe to Realtime presence updates (instant)
    const unsub = onPresenceUpdate((users) => {
      setCount(users.length);
    });

    // Initial load
    const users = getOnlineUsers();
    setCount(users.length);

    return () => { unsub(); };
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5 text-xs", className)}>
            <div className="relative">
              <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
              <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-50" />
            </div>
            <span className="text-emerald-400 font-medium">{count}</span>
            <span className="text-noir-400">{t('social.online').toLowerCase()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {count} {t('social.usersOnline')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default OnlineUsersWidget;

