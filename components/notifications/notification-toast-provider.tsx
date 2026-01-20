'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import ToastContainer from './toast-container';
import { Notification, NotificationPriority, NotificationType } from '@/types/notifications';

interface NotificationToastContextType {
  showToast: (notification: Notification) => void;
  showSuccessToast: (title: string, message: string, actionUrl?: string) => void;
  showErrorToast: (title: string, message: string, actionUrl?: string) => void;
  showInfoToast: (title: string, message: string, actionUrl?: string) => void;
  showWarningToast: (title: string, message: string, actionUrl?: string) => void;
  clearAllToasts: () => void;
  isUIBlocked: boolean;
  setUIBlocked: (blocked: boolean) => void;
}

const NotificationToastContext = createContext<NotificationToastContextType | undefined>(undefined);

interface NotificationToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHideDuration?: number;
}

export const NotificationToastProvider: React.FC<NotificationToastProviderProps> = ({
  children,
  maxToasts = 5,
  position = 'top-right',
  autoHideDuration = 5000
}) => {
  const [toastQueue, setToastQueue] = useState<Notification[]>([]);
  const [isUIBlocked, setIsUIBlocked] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');

  // Rileva il profilo corrente (integrazione con il sistema profili esistente)
  useEffect(() => {
    // Ascolta i cambiamenti del profilo corrente
    const handleProfileChange = (event: CustomEvent) => {
      setCurrentProfileId(event.detail.profileId || 'default');
    };

    window.addEventListener('profile-changed', handleProfileChange as EventListener);
    
    // Try a ottenere il profilo corrente dal localStorage o da altri sistemi
    const savedProfile = localStorage.getItem('currentProfileId');
    if (savedProfile) {
      setCurrentProfileId(savedProfile);
    }

    return () => {
      window.removeEventListener('profile-changed', handleProfileChange as EventListener);
    };
  }, []);

  // Rileva quando l'UI è bloccata da dialoghi o modali
  useEffect(() => {
    const checkUIBlocked = () => {
      // Controlla se ci sono dialoghi aperti, modali, o altri elementi che bloccano l'UI
      const modals = document.querySelectorAll('[role="dialog"], .modal, [data-modal="true"]');
      const overlays = document.querySelectorAll('.overlay, [data-overlay="true"]');
      const dropdowns = document.querySelectorAll('[data-state="open"]');
      
      const blocked = modals.length > 0 || overlays.length > 0 || dropdowns.length > 0;
      setIsUIBlocked(blocked);
    };

    // Controlla inizialmente
    checkUIBlocked();

    // Osserva i cambiamenti nel DOM per rilevare dialoghi aperti/chiusi
    const observer = new MutationObserver(checkUIBlocked);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'data-state', 'class']
    });

    // Ascolta eventi personalizzati per dialoghi
    const handleDialogOpen = () => setIsUIBlocked(true);
    const handleDialogClose = () => setTimeout(checkUIBlocked, 100);

    window.addEventListener('dialog-opened', handleDialogOpen);
    window.addEventListener('dialog-closed', handleDialogClose);
    window.addEventListener('modal-opened', handleDialogOpen);
    window.addEventListener('modal-closed', handleDialogClose);

    return () => {
      observer.disconnect();
      window.removeEventListener('dialog-opened', handleDialogOpen);
      window.removeEventListener('dialog-closed', handleDialogClose);
      window.removeEventListener('modal-opened', handleDialogOpen);
      window.removeEventListener('modal-closed', handleDialogClose);
    };
  }, []);

  const createNotification = useCallback((
    type: NotificationType,
    priority: NotificationPriority,
    title: string,
    message: string,
    actionUrl?: string,
    icon?: string
  ): Notification => {
    return {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      profileId: currentProfileId,
      type,
      title,
      message,
      icon,
      actionUrl,
      priority,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'toast-system',
        category: type.toLowerCase(),
        tags: [type.toLowerCase(), priority.toLowerCase()]
      }
    };
  }, [currentProfileId]);

  const showToast = useCallback((notification: Notification) => {
    // Se l'UI è bloccata e la notifica non è urgente, mettila in coda
    if (isUIBlocked && notification.priority !== NotificationPriority.URGENT) {
      setToastQueue(prev => [...prev, notification]);
      return;
    }

    // Mostra la toast immediatamente
    if (typeof window !== 'undefined' && (window as any).showNotificationToast) {
      (window as any).showNotificationToast(notification);
    }
  }, [isUIBlocked]);

  const showSuccessToast = useCallback((title: string, message: string, actionUrl?: string) => {
    const notification = createNotification(
      NotificationType.PROFILE,
      NotificationPriority.NORMAL,
      title,
      message,
      actionUrl,
      '✅'
    );
    showToast(notification);
  }, [createNotification, showToast]);

  const showErrorToast = useCallback((title: string, message: string, actionUrl?: string) => {
    const notification = createNotification(
      NotificationType.SECURITY,
      NotificationPriority.HIGH,
      title,
      message,
      actionUrl,
      '❌'
    );
    showToast(notification);
  }, [createNotification, showToast]);

  const showInfoToast = useCallback((title: string, message: string, actionUrl?: string) => {
    const notification = createNotification(
      NotificationType.SYSTEM,
      NotificationPriority.NORMAL,
      title,
      message,
      actionUrl,
      'ℹ️'
    );
    showToast(notification);
  }, [createNotification, showToast]);

  const showWarningToast = useCallback((title: string, message: string, actionUrl?: string) => {
    const notification = createNotification(
      NotificationType.SYSTEM,
      NotificationPriority.HIGH,
      title,
      message,
      actionUrl,
      '⚠️'
    );
    showToast(notification);
  }, [createNotification, showToast]);

  const clearAllToasts = useCallback(() => {
    setToastQueue([]);
    // Invia evento per pulire le toast attive
    window.dispatchEvent(new CustomEvent('clear-all-toasts'));
  }, []);

  // Processa la coda quando l'UI non è più bloccata
  useEffect(() => {
    if (!isUIBlocked && toastQueue.length > 0) {
      // Mostra le toast in coda con un piccolo ritardo tra una e l'altra
      toastQueue.forEach((notification, index) => {
        setTimeout(() => {
          showToast(notification);
        }, index * 200); // 200ms di ritardo tra le toast
      });
      
      setToastQueue([]);
    }
  }, [isUIBlocked, toastQueue, showToast]);

  const contextValue: NotificationToastContextType = {
    showToast,
    showSuccessToast,
    showErrorToast,
    showInfoToast,
    showWarningToast,
    clearAllToasts,
    isUIBlocked,
    setUIBlocked: setIsUIBlocked
  };

  return (
    <NotificationToastContext.Provider value={contextValue}>
      {children}
      
      {/* Live region per annunci globali */}
      <div 
        id="notification-announcements"
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      />
      
      <ToastContainer
        maxToasts={maxToasts}
        position={position}
        autoHideDuration={autoHideDuration}
      />
    </NotificationToastContext.Provider>
  );
};

// Hook per utilizzare il sistema di toast
export const useNotificationToast = () => {
  const context = useContext(NotificationToastContext);
  if (context === undefined) {
    throw new Error('useNotificationToast deve essere utilizzato all\'interno di NotificationToastProvider');
  }
  return context;
};

// Hook semplificato per compatibilità
export const useToast = () => {
  const context = useContext(NotificationToastContext);
  if (context === undefined) {
    // Fallback se il provider non è disponibile
    return {
      showToast: (notification: Notification) => console.log('Toast:', notification),
      showSuccessToast: (title: string, message: string) => console.log('Success:', title, message),
      showErrorToast: (title: string, message: string) => console.log('Error:', title, message),
      showInfoToast: (title: string, message: string) => console.log('Info:', title, message),
      showWarningToast: (title: string, message: string) => console.log('Warning:', title, message)
    };
  }
  
  return {
    showToast: context.showToast,
    showSuccessToast: context.showSuccessToast,
    showErrorToast: context.showErrorToast,
    showInfoToast: context.showInfoToast,
    showWarningToast: context.showWarningToast
  };
};

export default NotificationToastProvider;


