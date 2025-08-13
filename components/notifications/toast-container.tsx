'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import NotificationToast from './notification-toast';
import { Notification, NotificationPriority } from '@/types/notifications';
import { useUIInterferenceDetector } from '@/lib/ui-interference-detector';
import { useNotificationQueue } from '@/lib/notification-queue-manager';

interface ToastNotification extends Notification {
  toastId: string;
  showTime: number;
}

interface ToastContainerProps {
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHideDuration?: number;
  stackSpacing?: number;
  enableAntiInterference?: boolean;
  enableDynamicPositioning?: boolean;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  maxToasts = 5,
  position = 'top-right',
  autoHideDuration = 5000,
  stackSpacing = 8,
  enableAntiInterference = true,
  enableDynamicPositioning = true
}) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [mounted, setMounted] = useState(false);

  // Sistema anti-interferenza
  const { 
    hasInterferences, 
    hasHighPriorityInterferences,
    getOptimalToastPosition 
  } = useUIInterferenceDetector({
    enableDynamicPositioning,
    debugMode: false
  });

  // Sistema di coda per gestire interferenze
  const { 
    enqueue, 
    stats: queueStats 
  } = useNotificationQueue({
    maxQueueSize: maxToasts * 2,
    urgentBypassQueue: true,
    priorityBoost: true,
    debugMode: false
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Funzione per aggiungere una nuova toast con sistema anti-interferenza
  const addToast = useCallback((notification: Notification) => {
    if (!enableAntiInterference) {
      // Comportamento originale senza anti-interferenza
      const toastNotification: ToastNotification = {
        ...notification,
        toastId: `toast-${notification.id}-${Date.now()}`,
        showTime: Date.now()
      };

      setToasts(prev => {
        let newToasts = [...prev, toastNotification];
        
        if (newToasts.length > maxToasts) {
          const urgentToasts = newToasts.filter(t => t.priority === NotificationPriority.URGENT);
          const nonUrgentToasts = newToasts.filter(t => t.priority !== NotificationPriority.URGENT);
          
          nonUrgentToasts.sort((a, b) => b.showTime - a.showTime);
          
          const toastsToKeep = Math.max(0, maxToasts - urgentToasts.length);
          newToasts = [...urgentToasts, ...nonUrgentToasts.slice(0, toastsToKeep)];
        }
        
        return newToasts;
      });
      return;
    }

    // Sistema anti-interferenza attivo
    const shouldQueue = hasHighPriorityInterferences && 
                       notification.priority !== NotificationPriority.URGENT;

    if (shouldQueue) {
      // Accoda la notifica
      enqueue(notification, {
        onShow: () => {
          console.log(`[ToastContainer] Notifica mostrata dalla coda: ${notification.title}`);
        },
        onDequeue: () => {
          console.log(`[ToastContainer] Notifica rimossa dalla coda: ${notification.title}`);
        }
      });
    } else {
      // Mostra immediatamente
      const toastNotification: ToastNotification = {
        ...notification,
        toastId: `toast-${notification.id}-${Date.now()}`,
        showTime: Date.now()
      };

      setToasts(prev => {
        let newToasts = [...prev, toastNotification];
        
        if (newToasts.length > maxToasts) {
          const urgentToasts = newToasts.filter(t => t.priority === NotificationPriority.URGENT);
          const nonUrgentToasts = newToasts.filter(t => t.priority !== NotificationPriority.URGENT);
          
          nonUrgentToasts.sort((a, b) => b.showTime - a.showTime);
          
          const toastsToKeep = Math.max(0, maxToasts - urgentToasts.length);
          newToasts = [...urgentToasts, ...nonUrgentToasts.slice(0, toastsToKeep)];
        }
        
        return newToasts;
      });
    }
  }, [maxToasts, enableAntiInterference, hasHighPriorityInterferences, enqueue]);

  // Funzione per rimuovere una toast
  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.toastId !== toastId));
  }, []);

  // Funzione per gestire azioni delle toast
  const handleToastAction = useCallback((toastId: string, action: string) => {
    const toast = toasts.find(t => t.toastId === toastId);
    if (!toast) return;

    switch (action) {
      case 'navigate':
        if (toast.actionUrl) {
          // Naviga all'URL specificato
          if (toast.actionUrl.startsWith('http')) {
            window.open(toast.actionUrl, '_blank');
          } else {
            // Navigazione interna (assumendo Next.js router)
            window.location.href = toast.actionUrl;
          }
        }
        break;
      default:
        console.log(`Azione toast non gestita: ${action}`);
    }
  }, [toasts]);

  // Calcola la posizione di ogni toast con supporto dinamico
  const getToastStyle = (index: number, toast: ToastNotification) => {
    if (enableDynamicPositioning && hasInterferences) {
      // Usa posizionamento dinamico per evitare interferenze
      const optimalPosition = getOptimalToastPosition(position, { width: 400, height: 100 });
      const isTopPosition = position.includes('top');
      const offset = index * (80 + stackSpacing);
      
      return {
        transform: `translateY(${isTopPosition ? offset : -offset}px)`,
        zIndex: hasInterferences ? 9999 - index : 1000 - index,
        left: `${optimalPosition.x}px`,
        top: `${optimalPosition.y + (isTopPosition ? offset : -offset)}px`,
        right: 'auto',
        bottom: 'auto'
      };
    }
    
    // Posizionamento standard
    const isTopPosition = position.includes('top');
    const offset = index * (80 + stackSpacing);
    
    return {
      transform: `translateY(${isTopPosition ? offset : -offset}px)`,
      zIndex: hasInterferences ? 9999 - index : 1000 - index
    };
  };

  // Esponi la funzione addToast globalmente per l'uso da altri componenti
  useEffect(() => {
    (window as any).showNotificationToast = addToast;
    
    return () => {
      delete (window as any).showNotificationToast;
    };
  }, [addToast]);

  if (!mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 pointer-events-none z-50"
      role="region"
      aria-label="Notifiche toast"
      aria-live="polite"
      aria-atomic="false"
    >
      {/* Descrizione nascosta per screen reader */}
      <div className="sr-only">
        Area notifiche toast. {toasts.length > 0 
          ? `${toasts.length} notifiche attive.` 
          : 'Nessuna notifica attiva.'
        }
        {enableAntiInterference && queueStats.totalQueued > 0 && 
          ` ${queueStats.totalQueued} notifiche in coda.`
        }
        {hasInterferences && ' Rilevate interferenze UI.'}
      </div>
      
      {toasts.map((toast, index) => (
        <div
          key={toast.toastId}
          style={getToastStyle(index, toast)}
          className="absolute"
        >
          <NotificationToast
            notification={toast}
            onDismiss={() => removeToast(toast.toastId)}
            onAction={handleToastAction}
            autoHideDuration={autoHideDuration}
            position={position}
            enableDynamicPositioning={enableDynamicPositioning}
          />
        </div>
      ))}
    </div>,
    document.body
  );
};

// Hook per utilizzare il sistema di toast
export const useToast = () => {
  const showToast = useCallback((notification: Notification) => {
    if (typeof window !== 'undefined' && (window as any).showNotificationToast) {
      (window as any).showNotificationToast(notification);
    }
  }, []);

  const showSuccessToast = useCallback((title: string, message: string) => {
    showToast({
      id: `success-${Date.now()}`,
      profileId: 'current', // Sarà sostituito dal profilo attuale
      type: 'Profile' as any,
      title,
      message,
      priority: 'Normal' as any,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'ui',
        category: 'success',
        tags: ['success']
      }
    });
  }, [showToast]);

  const showErrorToast = useCallback((title: string, message: string) => {
    showToast({
      id: `error-${Date.now()}`,
      profileId: 'current',
      type: 'Security' as any,
      title,
      message,
      priority: 'High' as any,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'ui',
        category: 'error',
        tags: ['error']
      }
    });
  }, [showToast]);

  const showInfoToast = useCallback((title: string, message: string) => {
    showToast({
      id: `info-${Date.now()}`,
      profileId: 'current',
      type: 'System' as any,
      title,
      message,
      priority: 'Normal' as any,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'ui',
        category: 'info',
        tags: ['info']
      }
    });
  }, [showToast]);

  return {
    showToast,
    showSuccessToast,
    showErrorToast,
    showInfoToast
  };
};

export default ToastContainer;