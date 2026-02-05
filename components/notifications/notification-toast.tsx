'use client';

import React from 'react';
import { X, Bell, Shield, User, ShoppingBag, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Notification, NotificationType, NotificationPriority } from '@/types/notifications';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  className?: string;
}

const typeIcons: Record<NotificationType, React.ElementType> = {
  [NotificationType.SYSTEM]: Bell,
  [NotificationType.PROFILE]: User,
  [NotificationType.SECURITY]: Shield,
  [NotificationType.UPDATE]: Bell,
  [NotificationType.GAME]: Bell,
  [NotificationType.STORE]: ShoppingBag,
  [NotificationType.CUSTOM]: Settings,
};

const typeColors: Record<NotificationType, string> = {
  [NotificationType.SYSTEM]: 'border-blue-500/30 bg-blue-500/10',
  [NotificationType.PROFILE]: 'border-green-500/30 bg-green-500/10',
  [NotificationType.SECURITY]: 'border-red-500/30 bg-red-500/10',
  [NotificationType.UPDATE]: 'border-purple-500/30 bg-purple-500/10',
  [NotificationType.GAME]: 'border-orange-500/30 bg-orange-500/10',
  [NotificationType.STORE]: 'border-cyan-500/30 bg-cyan-500/10',
  [NotificationType.CUSTOM]: 'border-gray-500/30 bg-gray-500/10',
};

const priorityStyles: Record<NotificationPriority, string> = {
  [NotificationPriority.LOW]: 'opacity-80',
  [NotificationPriority.NORMAL]: '',
  [NotificationPriority.HIGH]: 'ring-1 ring-orange-500/50',
  [NotificationPriority.URGENT]: 'ring-2 ring-red-500/50 animate-pulse',
};

export function NotificationToast({
  notification,
  onDismiss,
  onAction,
  className
}: NotificationToastProps) {
  const Icon = typeIcons[notification.type] || Bell;
  const colorClass = typeColors[notification.type] || typeColors[NotificationType.SYSTEM];
  const priorityClass = priorityStyles[notification.priority] || '';

  return (
    <div
      role="alert"
      aria-live={notification.priority === NotificationPriority.URGENT ? 'assertive' : 'polite'}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        colorClass,
        priorityClass,
        className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm">{notification.title}</h4>
        {notification.message && (
          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
        )}
        
              </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default NotificationToast;
