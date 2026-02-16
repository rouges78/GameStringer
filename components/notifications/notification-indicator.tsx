'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { announceNotificationCount, createHelpText } from '@/lib/notification-accessibility';

interface NotificationIndicatorProps {
  onClick?: () => void;
  className?: string;
  showBadge?: boolean;
  maxCount?: number;
  animate?: boolean;
}

export const NotificationIndicator: React.FC<NotificationIndicatorProps> = ({
  onClick,
  className,
  showBadge = true,
  maxCount = 99,
  animate = true
}) => {
  const { unreadCount, isLoading } = useNotifications();
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevCount, setPrevCount] = useState(unreadCount);
  const [lastAnnouncedCount, setLastAnnouncedCount] = useState(0);

  // Animazione e annunci screen reader quando arrivano nuove notifiche
  useEffect(() => {
    if (animate && unreadCount > prevCount && unreadCount > 0) {
      setIsAnimating(true);
      
      if (unreadCount !== lastAnnouncedCount) {
        announceNotificationCount(unreadCount, lastAnnouncedCount);
        setLastAnnouncedCount(unreadCount);
      }
      
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount, animate, lastAnnouncedCount]);

  const helpText = createHelpText('indicator');
  const displayCount = unreadCount > maxCount ? `${maxCount}+` : unreadCount.toString();
  const hasNotifications = unreadCount > 0;

  const getAriaLabel = () => {
    if (isLoading) return 'Loading notifications...';
    if (!hasNotifications) return 'No unread notifications. Click to open notification center.';
    const countText = unreadCount === 1 ? '1 unread notification' : `${unreadCount} unread notifications`;
    return `${countText}. Click to open notification center.`;
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "relative h-8 w-8 rounded-full transition-colors",
        "hover:bg-white/10",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        className
      )}
      aria-label={getAriaLabel()}
      aria-describedby={hasNotifications ? "notification-count-description notification-help" : "notification-help"}
      disabled={isLoading}
      type="button"
    >
      <div id="notification-help" className="sr-only">
        {helpText}
      </div>

      {hasNotifications ? (
        <BellRing 
          className={cn(
            "h-4 w-4 transition-colors text-yellow-400",
            isAnimating && "animate-bounce"
          )}
          aria-hidden="true"
        />
      ) : (
        <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}

      {hasNotifications && (
        <div id="notification-count-description" className="sr-only">
          {unreadCount === 1 
            ? 'You have 1 unread notification' 
            : `You have ${unreadCount} unread notifications`
          }
        </div>
      )}

      {showBadge && unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 border-2 border-background",
            "text-[9px] font-bold text-white flex items-center justify-center",
            "transition-all duration-200",
            isAnimating && "scale-110"
          )}
          aria-hidden="true"
        >!</span>
      )}

      {!showBadge && hasNotifications && (
        <span 
          className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 border border-background text-[8px] font-bold text-white flex items-center justify-center"
          aria-hidden="true"
        >!</span>
      )}
    </Button>
  );
};

export default NotificationIndicator;


