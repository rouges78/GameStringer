'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar } from './progress-bar';
import type { ProgressNotification } from '@/lib/types/progress';

interface ProgressNotificationProps {
  notification: ProgressNotification;
  onClose?: () => void;
  onAction?: (actionIndex: number) => void;
  className?: string;
}

export function ProgressNotificationComponent({
  notification,
  onClose,
  onAction,
  className
}: ProgressNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide se specificato
  useEffect(() => {
    if (notification.autoHide && notification.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Aspetta animazione
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.autoHide, notification.duration, onClose]);

  if (!isVisible) return null;

  const typeIcons = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle
  };

  const typeColors = {
    info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
    error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
  };

  const iconColors = {
    info: 'text-blue-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500'
  };

  const Icon = typeIcons[notification.type];

  return (
    <div
      className={cn(
        'border rounded-lg p-4 shadow-sm transition-all duration-300',
        typeColors[notification.type],
        {
          'opacity-0 translate-x-full': !isVisible,
          'opacity-100 translate-x-0': isVisible
        },
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icona */}
        <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', iconColors[notification.type])} />

        {/* Contenuto */}
        <div className="flex-1 min-w-0">
          {/* Titolo */}
          <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
            {notification.title}
          </div>

          {/* Messaggio */}
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {notification.message}
          </div>

          {/* Barra di progresso se presente */}
          {typeof notification.progress === 'number' && (
            <div className="mb-3">
              <ProgressBar
                progress={notification.progress}
                size="sm"
                variant={notification.type === 'error' ? 'error' : 'default'}
                showPercentage={true}
                animated={true}
              />
            </div>
          )}

          {/* Azioni */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => onAction?.(index)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    {
                      'bg-blue-600 hover:bg-blue-700 text-white': notification.type === 'info',
                      'bg-green-600 hover:bg-green-700 text-white': notification.type === 'success',
                      'bg-yellow-600 hover:bg-yellow-700 text-white': notification.type === 'warning',
                      'bg-red-600 hover:bg-red-700 text-white': notification.type === 'error'
                    }
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pulsante chiudi */}
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
          }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Container per gestire multiple notifiche
interface ProgressNotificationContainerProps {
  notifications: ProgressNotification[];
  onCloseNotification: (id: string) => void;
  onNotificationAction: (id: string, actionIndex: number) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
  className?: string;
}

export function ProgressNotificationContainer({
  notifications,
  onCloseNotification,
  onNotificationAction,
  position = 'top-right',
  maxNotifications = 5,
  className
}: ProgressNotificationContainerProps) {
  const positionClasses = {
    'top-right': 'fixed top-4 right-4',
    'top-left': 'fixed top-4 left-4',
    'bottom-right': 'fixed bottom-4 right-4',
    'bottom-left': 'fixed bottom-4 left-4'
  };

  // Limita numero di notifiche mostrate
  const visibleNotifications = notifications.slice(0, maxNotifications);

  if (visibleNotifications.length === 0) return null;

  return (
    <div
      className={cn(
        'z-50 space-y-3 max-w-sm w-full',
        positionClasses[position],
        className
      )}
    >
      {visibleNotifications.map((notification) => (
        <ProgressNotificationComponent
          key={notification.id}
          notification={notification}
          onClose={() => onCloseNotification(notification.id)}
          onAction={(actionIndex) => onNotificationAction(notification.id, actionIndex)}
        />
      ))}

      {/* Indicatore se ci sono più notifiche */}
      {notifications.length > maxNotifications && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
            <span>+{notifications.length - maxNotifications} altre notifiche</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook per gestire notifiche di progresso
export function useProgressNotifications() {
  const [notifications, setNotifications] = useState<ProgressNotification[]>([]);

  const addNotification = (notification: Omit<ProgressNotification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: ProgressNotification = {
      ...notification,
      id
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove se non ha durata specifica
    if (notification.autoHide !== false && !notification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, 5000); // Default 5 secondi
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const updateNotification = (id: string, updates: Partial<ProgressNotification>) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, ...updates } : n
    ));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNotificationAction = (id: string, actionIndex: number) => {
    const notification = notifications.find(n => n.id === id);
    if (notification?.actions?.[actionIndex]) {
      notification.actions[actionIndex].action();
      removeNotification(id);
    }
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    updateNotification,
    clearAllNotifications,
    handleNotificationAction
  };
}


