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
      
      // Annuncia le nuove notifiche agli screen reader
      if (unreadCount !== lastAnnouncedCount) {
        announceNotificationCount(unreadCount, lastAnnouncedCount);
        setLastAnnouncedCount(unreadCount);
      }
      
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount, animate, lastAnnouncedCount]);

  // Testo di aiuto per screen reader
  const helpText = createHelpText('indicator');

  const displayCount = unreadCount > maxCount ? `${maxCount}+` : unreadCount.toString();
  const hasNotifications = unreadCount > 0;

  // Genera descrizione dettagliata per screen reader
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
        "relative h-10 w-10 rounded-full transition-all duration-200",
        "hover:bg-accent/50 focus:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isAnimating && "animate-pulse",
        className
      )}
      aria-label={getAriaLabel()}
      aria-describedby={hasNotifications ? "notification-count-description notification-help" : "notification-help"}
      disabled={isLoading}
      type="button"
    >
      {/* Testo di aiuto nascosto per screen reader */}
      <div id="notification-help" className="sr-only">
        {helpText}
      </div>
      {/* Icona campana */}
      <div className="relative">
        {hasNotifications ? (
          <BellRing 
            className={cn(
              "h-5 w-5 transition-all duration-200 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]",
              isAnimating && "animate-bounce"
            )}
            aria-hidden="true"
          />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
        
        {/* Indicatore animato per nuove notifiche */}
        {isAnimating && (
          <div className="absolute -top-1 -right-1" aria-hidden="true">
            <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
          </div>
        )}
      </div>

      {/* Descrizione nascosta per screen reader */}
      {hasNotifications && (
        <div id="notification-count-description" className="sr-only">
          {unreadCount === 1 
            ? 'You have 1 unread notification' 
            : `You have ${unreadCount} unread notifications`
          }
        </div>
      )}

      {/* Badge conteggio */}
      {showBadge && hasNotifications && (
        <Badge
          variant="destructive"
          className={cn(
            "absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1",
            "text-xs font-medium flex items-center justify-center",
            "transition-all duration-200 transform",
            isAnimating && "scale-110"
          )}
          aria-hidden="true"
        >
          {displayCount}
        </Badge>
      )}
      
      {/* Indicatore semplice senza conteggio */}
      {!showBadge && hasNotifications && (
        <div 
          className={cn(
            "absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full",
            "border-2 border-background",
            isAnimating && "animate-pulse"
          )}
          aria-hidden="true"
        />
      )}
    </Button>
  );
};

export default NotificationIndicator;


