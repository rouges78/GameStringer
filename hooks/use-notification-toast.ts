'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNotificationToast } from '@/components/notifications/notification-toast-provider';
import { Notification, NotificationPreferences, shouldShowNotification } from '@/types/notifications';
import { invoke } from '@/lib/tauri-api';

interface UseNotificationToastIntegrationOptions {
  profileId?: string;
  autoShowNewNotifications?: boolean;
  respectPreferences?: boolean;
}

export const useNotificationToastIntegration = (options: UseNotificationToastIntegrationOptions = {}) => {
  const {
    profileId = 'current',
    autoShowNewNotifications = true,
    respectPreferences = true
  } = options;

  const { showToast, isUIBlocked } = useNotificationToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  // Carica le preferenze del profilo corrente
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Usa wrapper invoke (gestisce ambiente Tauri/web). In web può lanciare: gestiamo con try/catch
        const result = await invoke('get_notification_preferences', { profile_id: profileId });
        if ((result as any)?.success && (result as any)?.data) {
          setPreferences((result as any).data as NotificationPreferences);
        }
      } catch (error) {
        console.error('Errore nel caricamento delle preferenze notifiche:', error);
      }
    };

    if (profileId) {
      loadPreferences();
    }
  }, [profileId]);

  // Ascolta le nuove notifiche dal backend
  useEffect(() => {
    if (!autoShowNewNotifications) return;

    const handleNewNotification = (event: CustomEvent<Notification>) => {
      const notification = event.detail;

      // Evita di mostrare la stessa notifica più volte
      if (notification.id === lastNotificationId) return;
      setLastNotificationId(notification.id);

      // Controlla se la notifica appartiene al profilo corrente
      if (notification.profileId !== profileId) return;

      // Rispetta le preferenze se richiesto
      if (respectPreferences && preferences) {
        if (!shouldShowNotification(notification, preferences)) {
          return;
        }
      }

      // Mostra il toast
      showToast(notification);
    };

    // Ascolta eventi personalizzati per nuove notifiche
    window.addEventListener('new-notification', handleNewNotification as EventListener);

    // Ascolta eventi Tauri se disponibili (con guardie)
    let unlistenPromise: Promise<(() => void) | void> | null = null;
    if (typeof window !== 'undefined') {
      const tauri: any = (window as any).__TAURI__;
      const listenFn = tauri?.event?.listen as
        | ((event: string, cb: (e: any) => void) => Promise<() => void>)
        | undefined;
      if (listenFn) {
        unlistenPromise = listenFn('notification-created', (evt: any) => {
          const notification = evt?.payload as Notification;
          handleNewNotification(new CustomEvent('new-notification', { detail: notification }));
        });
      }
    }

    return () => {
      window.removeEventListener('new-notification', handleNewNotification as EventListener);
      if (unlistenPromise) {
        unlistenPromise.then((unlisten) => {
          if (typeof unlisten === 'function') unlisten();
        });
      }
    };
  }, [autoShowNewNotifications, profileId, preferences, respectPreferences, showToast, lastNotificationId]);

  // Funzione per mostrare una notifica manualmente
  const showNotificationToast = useCallback((notification: Notification) => {
    // Controlla le preferenze se richiesto
    if (respectPreferences && preferences) {
      if (!shouldShowNotification(notification, preferences)) {
        console.log('Notifica bloccata dalle preferenze:', notification.title);
        return false;
      }
    }

    showToast(notification);
    return true;
  }, [showToast, preferences, respectPreferences]);

  // Funzione per aggiornare le preferenze
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      const result = await invoke('update_notification_preferences', {
        preferences: updatedPreferences
      });

      if ((result as any)?.success) {
        setPreferences(updatedPreferences as NotificationPreferences);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle preferenze:', error);
      return false;
    }
  }, [preferences]);

  // Funzione per testare una notifica
  const testNotification = useCallback((type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const testNotifications = {
      success: {
        id: `test-success-${Date.now()}`,
        profileId,
        type: 'Profile' as any,
        title: 'Test Successo',
        message: 'Questa è una notifica di test per verificare il funzionamento del sistema.',
        priority: 'Normal' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'success',
          tags: ['test', 'success']
        }
      },
      error: {
        id: `test-error-${Date.now()}`,
        profileId,
        type: 'Security' as any,
        title: 'Test Errore',
        message: 'Questa è una notifica di errore di test.',
        priority: 'High' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'error',
          tags: ['test', 'error']
        }
      },
      info: {
        id: `test-info-${Date.now()}`,
        profileId,
        type: 'System' as any,
        title: 'Test Informazione',
        message: 'Questa è una notifica informativa di test.',
        priority: 'Normal' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'info',
          tags: ['test', 'info']
        }
      },
      warning: {
        id: `test-warning-${Date.now()}`,
        profileId,
        type: 'System' as any,
        title: 'Test Avviso',
        message: 'Questa è una notifica di avviso di test.',
        priority: 'High' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'warning',
          tags: ['test', 'warning']
        }
      }
    };

    showNotificationToast(testNotifications[type]);
  }, [profileId, showNotificationToast]);

  return {
    // Stato
    preferences,
    isUIBlocked,

    // Azioni
    showNotificationToast,
    updatePreferences,
    testNotification,

    // Utilità
    canShowNotification: (notification: Notification) => {
      if (!respectPreferences || !preferences) return true;
      return shouldShowNotification(notification, preferences);
    }
  };
};

// Hook semplificato per l'uso comune
export const useToastNotifications = (profileId?: string) => {
  return useNotificationToastIntegration({
    profileId,
    autoShowNewNotifications: true,
    respectPreferences: true
  });
};

export default useNotificationToastIntegration;