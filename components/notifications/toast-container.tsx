'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import NotificationToast from './notification-toast';
import { Notification, NotificationPriority } from '@/types/notifications';

interface ToastNotification extends Notification {
  toastId: string;
  showTime: number;
}

interface ToastContainerProps {
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHideDuration?: number;
  stackSpacing?: number;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  maxToasts = 5,
  position = 'top-right',
  autoHideDuration = 5000,
  stackSpacing = 8
}) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Funzione per aggiungere una nuova toast
  const addToast = useCallback((notification: Notification) => {
    const toastNotification: ToastNotification = {
      ...notification,
      toastId: `toast-${notification.id}-${Date.now()}`,
      showTime: Date.now()
    };

    setToasts(prev => {
      // Rimuovi toast più vecchie se superiamo il limite
      let newToasts = [...prev, toastNotification];
      
      if (newToasts.length > maxToasts) {
        // Mantieni le toast urgenti e rimuovi le più vecchie non urgenti
        const urgentToasts = newToasts.filter(t => t.priority === NotificationPriority.URGENT);
        const nonUrgentToasts = newToasts.filter(t => t.priority !== NotificationPriority.URGENT);
        
        // Ordina per tempo di visualizzazione (più recenti prima)
        nonUrgentToasts.sort((a, b) => b.showTime - a.showTime);
        
        // Mantieni solo le toast più recenti
        const toastsToKeep = Math.max(0, maxToasts - urgentToasts.length);
        newToasts = [...urgentToasts, ...nonUrgentToasts.slice(0, toastsToKeep)];
      }
      
      return newToasts;
    });
  }, [maxToasts]);

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

  // Calcola la posizione di ogni toast per evitare sovrapposizioni
  const getToastStyle = (index: number) => {
    const isTopPosition = position.includes('top');
    const offset = index * (80 + stackSpacing); // Altezza approssimativa toast + spacing
    
    return {
      transform: `translateY(${isTopPosition ? offset : -offset}px)`,
      zIndex: 1000 - index // Toast più recenti sopra
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
    <div className="fixed inset-0 pointer-events-none z-50">
      {toasts.map((toast, index) => (
        <div
          key={toast.toastId}
          style={getToastStyle(index)}
          className="absolute"
        >
          <NotificationToast
            notification={toast}
            onDismiss={() => removeToast(toast.toastId)}
            onAction={handleToastAction}
            autoHideDuration={autoHideDuration}
            position={position}
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