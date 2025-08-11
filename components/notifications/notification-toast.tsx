'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, ExternalLink, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, NotificationType, NotificationPriority } from '@/types/notifications';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  autoHideDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onAction,
  autoHideDuration = 5000,
  position = 'top-right',
  className
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  // Gestione auto-hide
  useEffect(() => {
    // Mostra il toast con animazione
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-hide solo se non è urgente
    if (notification.priority !== NotificationPriority.URGENT && autoHideDuration > 0) {
      const hideTimer = setTimeout(() => {
        handleDismiss();
      }, autoHideDuration);

      // Progress bar animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (autoHideDuration / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        clearInterval(progressInterval);
      };
    }

    return () => clearTimeout(showTimer);
  }, [notification.priority, autoHideDuration]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300); // Durata animazione uscita
  }, [notification.id, onDismiss]);

  const handleAction = useCallback(() => {
    if (notification.actionUrl && onAction) {
      onAction(notification.id, 'navigate');
    }
    handleDismiss();
  }, [notification.id, notification.actionUrl, onAction, handleDismiss]);

  // Icona basata sul tipo di notifica
  const getNotificationIcon = () => {
    switch (notification.type) {
      case NotificationType.SECURITY:
        return <AlertTriangle className="h-5 w-5" />;
      case NotificationType.SYSTEM:
        return <Info className="h-5 w-5" />;
      case NotificationType.PROFILE:
        return <CheckCircle className="h-5 w-5" />;
      case NotificationType.UPDATE:
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  // Colori basati su tipo e priorità
  const getNotificationStyles = () => {
    const baseStyles = "border-l-4";
    
    switch (notification.priority) {
      case NotificationPriority.URGENT:
        return `${baseStyles} border-red-500 bg-red-50 dark:bg-red-950/20`;
      case NotificationPriority.HIGH:
        return `${baseStyles} border-orange-500 bg-orange-50 dark:bg-orange-950/20`;
      case NotificationPriority.NORMAL:
        return `${baseStyles} border-blue-500 bg-blue-50 dark:bg-blue-950/20`;
      case NotificationPriority.LOW:
        return `${baseStyles} border-gray-500 bg-gray-50 dark:bg-gray-950/20`;
      default:
        return `${baseStyles} border-blue-500 bg-blue-50 dark:bg-blue-950/20`;
    }
  };

  const getIconColor = () => {
    switch (notification.priority) {
      case NotificationPriority.URGENT:
        return "text-red-600 dark:text-red-400";
      case NotificationPriority.HIGH:
        return "text-orange-600 dark:text-orange-400";
      case NotificationPriority.NORMAL:
        return "text-blue-600 dark:text-blue-400";
      case NotificationPriority.LOW:
        return "text-gray-600 dark:text-gray-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  // Posizionamento del toast
  const getPositionStyles = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  // Animazioni di entrata e uscita
  const getAnimationStyles = () => {
    const baseTransition = "transition-all duration-300 ease-in-out";
    
    if (isExiting) {
      return `${baseTransition} opacity-0 transform translate-x-full scale-95`;
    }
    
    if (isVisible) {
      return `${baseTransition} opacity-100 transform translate-x-0 scale-100`;
    }
    
    return `${baseTransition} opacity-0 transform translate-x-full scale-95`;
  };

  return (
    <div
      className={cn(
        "fixed z-50 max-w-sm w-full pointer-events-auto",
        getPositionStyles(),
        getAnimationStyles(),
        className
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          "relative rounded-lg shadow-lg backdrop-blur-sm border",
          "bg-white/95 dark:bg-gray-800/95",
          "border-gray-200 dark:border-gray-700",
          getNotificationStyles()
        )}
      >
        {/* Progress bar per auto-hide */}
        {notification.priority !== NotificationPriority.URGENT && autoHideDuration > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden">
            <div
              className="h-full bg-current opacity-30 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start space-x-3">
            {/* Icona */}
            <div className={cn("flex-shrink-0 mt-0.5", getIconColor())}>
              {notification.icon ? (
                <img 
                  src={notification.icon} 
                  alt="" 
                  className="h-5 w-5"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={notification.icon ? 'hidden' : ''}>
                {getNotificationIcon()}
              </div>
            </div>

            {/* Contenuto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {notification.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {notification.message}
                  </p>
                  
                  {/* Metadata opzionale */}
                  {notification.metadata?.category && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {notification.metadata.category}
                    </span>
                  )}
                </div>

                {/* Pulsante chiudi */}
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Chiudi notifica"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </button>
              </div>

              {/* Azione opzionale */}
              {notification.actionUrl && (
                <div className="mt-3 flex">
                  <button
                    onClick={handleAction}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Visualizza
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Indicatore priorità urgente */}
        {notification.priority === NotificationPriority.URGENT && (
          <div className="absolute -top-1 -right-1">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationToast;