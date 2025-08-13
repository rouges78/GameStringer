'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ExternalLink, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, NotificationType, NotificationPriority } from '@/types/notifications';
import { 
  announceToScreenReader, 
  createNotificationAnnouncement, 
  announceDismissal,
  getPriorityText,
  getTypeText,
  getIconAriaLabel,
  createHelpText,
  prefersReducedMotion
} from '@/lib/notification-accessibility';
import { useUIInterferenceDetector } from '@/lib/ui-interference-detector';
import { useDynamicToastPositioner } from './dynamic-toast-positioner';
import { useIntelligentTiming } from '@/lib/intelligent-timing-manager';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  autoHideDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
  enableDynamicPositioning?: boolean;
  customPosition?: { x: number; y: number };
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onAction,
  autoHideDuration = 5000,
  position = 'top-right',
  className,
  enableDynamicPositioning = true,
  customPosition
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const toastRef = useRef<HTMLDivElement>(null);
  const [hasBeenAnnounced, setHasBeenAnnounced] = useState(false);
  
  // Sistema anti-interferenza
  const { 
    hasInterferences, 
    hasHighPriorityInterferences, 
    getOptimalToastPosition 
  } = useUIInterferenceDetector({
    enableDynamicPositioning,
    debugMode: false
  });
  
  // Sistema posizionamento dinamico
  const { registerToast, unregisterToast } = useDynamicToastPositioner();
  
  // Sistema timing intelligente
  const { scheduleAutoDismiss, cancelAutoDismiss } = useIntelligentTiming({
    enableAdaptiveTiming: true,
    enableUserActivityDetection: true,
    enableInterferenceAdjustment: true,
    debugMode: false
  });
  
  const [dynamicPosition, setDynamicPosition] = useState<{ x: number; y: number } | null>(null);

  // Calcola posizione dinamica quando necessario
  useEffect(() => {
    if (enableDynamicPositioning && !customPosition) {
      const optimalPosition = getOptimalToastPosition(position, { width: 400, height: 100 });
      setDynamicPosition({ x: optimalPosition.x, y: optimalPosition.y });
    } else if (customPosition) {
      setDynamicPosition(customPosition);
    }
  }, [enableDynamicPositioning, customPosition, position, getOptimalToastPosition, hasInterferences]);

  // Registrazione con il sistema di posizionamento dinamico
  useEffect(() => {
    if (toastRef.current && enableDynamicPositioning) {
      const priorityMap = {
        [NotificationPriority.URGENT]: 'urgent' as const,
        [NotificationPriority.HIGH]: 'high' as const,
        [NotificationPriority.NORMAL]: 'normal' as const,
        [NotificationPriority.LOW]: 'low' as const
      };
      
      registerToast(notification.id, toastRef.current, priorityMap[notification.priority]);
      
      return () => {
        unregisterToast(notification.id);
      };
    }
  }, [notification.id, notification.priority, enableDynamicPositioning, registerToast, unregisterToast]);

  // Gestione auto-hide e annunci screen reader con timing intelligente
  useEffect(() => {
    // Ritarda la visualizzazione se ci sono interferenze ad alta priorità
    const shouldDelay = hasHighPriorityInterferences && 
                       notification.priority !== NotificationPriority.URGENT;
    const showDelay = shouldDelay ? 1000 : 50;

    // Mostra il toast con animazione
    const showTimer = setTimeout(() => {
      setIsVisible(true);
      
      // Annuncia la notifica agli screen reader dopo che è visibile
      if (!hasBeenAnnounced) {
        announceNotification();
        setHasBeenAnnounced(true);
      }
    }, showDelay);

    // Auto-hide con timing intelligente
    if (notification.priority !== NotificationPriority.URGENT && autoHideDuration > 0) {
      // Usa il sistema di timing intelligente invece del setTimeout semplice
      scheduleAutoDismiss(notification.id, notification.priority, handleDismiss);

      // Progress bar animation (manteniamo quella esistente per ora)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (autoHideDuration / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);

      return () => {
        clearTimeout(showTimer);
        cancelAutoDismiss(notification.id);
        clearInterval(progressInterval);
      };
    }

    return () => clearTimeout(showTimer);
  }, [
    notification.id, 
    notification.priority, 
    autoHideDuration, 
    hasBeenAnnounced, 
    hasHighPriorityInterferences,
    scheduleAutoDismiss,
    cancelAutoDismiss,
    handleDismiss,
    announceNotification
  ]);

  // Funzione per annunciare la notifica agli screen reader
  const announceNotification = useCallback(() => {
    const announcement = createNotificationAnnouncement(
      notification.title,
      notification.message,
      notification.type,
      notification.priority
    );
    
    const priority = notification.priority === NotificationPriority.URGENT ? 'assertive' : 'polite';
    announceToScreenReader(announcement, priority);
  }, [notification]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    
    // Annuncia la dismissione agli screen reader
    announceDismissal(notification.title);
    
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300); // Durata animazione uscita
  }, [notification.id, notification.title, onDismiss]);

  const handleAction = useCallback(() => {
    if (notification.actionUrl && onAction) {
      onAction(notification.id, 'navigate');
    }
    handleDismiss();
  }, [notification.id, notification.actionUrl, onAction, handleDismiss]);

  // Controlla se l'utente preferisce animazioni ridotte
  const shouldReduceMotion = prefersReducedMotion();

  // Icona basata sul tipo di notifica
  const getNotificationIcon = () => {
    const ariaLabel = getIconAriaLabel(notification.type);
    
    switch (notification.type) {
      case NotificationType.SECURITY:
        return <AlertTriangle className="h-5 w-5" aria-label={ariaLabel} role="img" />;
      case NotificationType.SYSTEM:
        return <Info className="h-5 w-5" aria-label={ariaLabel} role="img" />;
      case NotificationType.PROFILE:
        return <CheckCircle className="h-5 w-5" aria-label={ariaLabel} role="img" />;
      case NotificationType.UPDATE:
        return <AlertCircle className="h-5 w-5" aria-label={ariaLabel} role="img" />;
      default:
        return <Info className="h-5 w-5" aria-label={ariaLabel} role="img" />;
    }
  };

  // Testo di aiuto per screen reader
  const helpText = createHelpText('toast');

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

  // Posizionamento del toast con supporto dinamico
  const getPositionStyles = () => {
    // Se abbiamo una posizione dinamica, usa coordinate assolute
    if (dynamicPosition) {
      return '';
    }
    
    // Altrimenti usa il posizionamento standard
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

  // Stili inline per posizionamento dinamico
  const getDynamicPositionStyles = (): React.CSSProperties => {
    if (!dynamicPosition) return {};
    
    return {
      left: `${dynamicPosition.x}px`,
      top: `${dynamicPosition.y}px`,
      right: 'auto',
      bottom: 'auto'
    };
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

  // Genera un ID unico per la notifica per l'accessibilità
  const toastId = `notification-toast-${notification.id}`;
  const titleId = `${toastId}-title`;
  const messageId = `${toastId}-message`;
  const progressId = `${toastId}-progress`;

  return (
    <div
      ref={toastRef}
      id={toastId}
      className={cn(
        "fixed z-50 max-w-sm w-full pointer-events-auto",
        getPositionStyles(),
        getAnimationStyles(),
        // Aumenta z-index se ci sono interferenze per assicurarsi che sia visibile
        hasInterferences && "z-[9999]",
        className
      )}
      style={getDynamicPositionStyles()}
      role="alert"
      aria-live={notification.priority === NotificationPriority.URGENT ? "assertive" : "polite"}
      aria-atomic="true"
      aria-labelledby={titleId}
      aria-describedby={`${messageId} ${toastId}-help`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleDismiss();
        } else if (e.key === 'Enter' && notification.actionUrl) {
          e.preventDefault();
          handleAction();
        }
      }}
    >
      {/* Testo di aiuto nascosto per screen reader */}
      <div id={`${toastId}-help`} className="sr-only">
        {helpText}
      </div>
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
          <div 
            className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Tempo rimanente prima della chiusura automatica"
            id={progressId}
          >
            <div
              className="h-full bg-current opacity-30 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start space-x-3">
            {/* Icona */}
            <div className={cn("flex-shrink-0 mt-0.5", getIconColor())} aria-hidden="true">
              {notification.icon ? (
                <img 
                  src={notification.icon} 
                  alt={getIconAriaLabel(notification.type)}
                  className="h-5 w-5"
                  role="img"
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
                  <h4 
                    id={titleId}
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
                  >
                    {notification.title}
                  </h4>
                  <p 
                    id={messageId}
                    className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                  >
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
                  className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label={`Chiudi notifica: ${notification.title}`}
                  aria-describedby={messageId}
                  type="button"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-hidden="true" />
                </button>
              </div>

              {/* Azione opzionale */}
              {notification.actionUrl && (
                <div className="mt-3 flex">
                  <button
                    onClick={handleAction}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    aria-label={`Visualizza dettagli per: ${notification.title}`}
                    type="button"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" aria-hidden="true" />
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