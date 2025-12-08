'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
// Rimossa dipendenza da useProfileAuth per evitare dipendenza circolare
import { NotificationToastProvider } from './notification-toast-provider';
import { 
  Notification, 
  NotificationPreferences, 
  UseNotificationsReturn,
  NotificationType,
  NotificationPriority 
} from '@/types/notifications';

interface NotificationContextType extends UseNotificationsReturn {
  preferences: NotificationPreferences | null;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<boolean>;
  isPreferencesLoading: boolean;
  preferencesError: string | null;
  
  // Metodi di convenienza per toast
  showSuccessNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  showErrorNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  showInfoNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  showWarningNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  
  // Gestione eventi sistema
  handleSystemEvent: (eventType: string, data: any) => Promise<void>;
  handleProfileEvent: (eventType: string, profileId: string, data?: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
  options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
    enableRealTime?: boolean;
    maxNotifications?: number;
    enableSystemEvents?: boolean;
    enableProfileEvents?: boolean;
  };
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  options = {}
}) => {
  // Otteniamo il profilo corrente direttamente dagli hook esistenti
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const initializationRef = useRef(false);
  const systemEventListenersRef = useRef<Array<() => void>>([]);

  const {
    autoRefresh = true,
    refreshInterval = 30000,
    enableRealTime = true,
    maxNotifications = 100,
    enableSystemEvents = true,
    enableProfileEvents = true
  } = options;

  // Hook per gestione notifiche
  const notificationsHook = useNotifications({
    autoRefresh,
    refreshInterval,
    enableRealTime,
    maxNotifications
  });

  // Hook per gestione preferenze
  const {
    preferences,
    updatePreferences,
    isLoading: isPreferencesLoading,
    error: preferencesError
  } = useNotificationPreferences();

  // Metodi di convenienza per creare notifiche con toast
  const showSuccessNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.PROFILE,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.NORMAL,
      icon: '✅',
      metadata: {
        source: 'user-action',
        category: 'success',
        tags: ['success', 'user']
      }
    });
  };

  const showErrorNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.SECURITY,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.HIGH,
      icon: '❌',
      metadata: {
        source: 'error-handler',
        category: 'error',
        tags: ['error', 'system']
      }
    });
  };

  const showInfoNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.SYSTEM,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.NORMAL,
      icon: 'ℹ️',
      metadata: {
        source: 'system-info',
        category: 'info',
        tags: ['info', 'system']
      }
    });
  };

  const showWarningNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.SYSTEM,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.HIGH,
      icon: '⚠️',
      metadata: {
        source: 'system-warning',
        category: 'warning',
        tags: ['warning', 'system']
      }
    });
  };

  // Gestione eventi sistema
  const handleSystemEvent = async (eventType: string, data: any): Promise<void> => {
    if (!enableSystemEvents || !currentProfileId) return;

    try {
      switch (eventType) {
        case 'app-update-available':
          await showInfoNotification(
            'Aggiornamento Disponibile',
            `Nuova versione ${data.version} disponibile per il download`,
            '/settings/updates'
          );
          break;

        case 'app-update-downloaded':
          await showSuccessNotification(
            'Aggiornamento Scaricato',
            'Riavvia l\'applicazione per applicare l\'aggiornamento',
            '/settings/updates'
          );
          break;

        case 'system-error':
          await showErrorNotification(
            'Errore di Sistema',
            data.message || 'Si è verificato un errore di sistema',
            data.actionUrl
          );
          break;

        case 'maintenance-mode':
          await showWarningNotification(
            'Modalità Manutenzione',
            'Il sistema entrerà in modalità manutenzione tra 5 minuti',
            '/settings'
          );
          break;

        case 'backup-completed':
          await showSuccessNotification(
            'Backup Completato',
            'Il backup dei dati è stato completato con successo'
          );
          break;

        case 'backup-failed':
          await showErrorNotification(
            'Backup Fallito',
            'Errore durante il backup dei dati. Controlla le impostazioni.',
            '/settings/backup'
          );
          break;

        case 'storage-warning':
          await showWarningNotification(
            'Spazio di Archiviazione',
            'Lo spazio di archiviazione è quasi esaurito',
            '/settings/storage'
          );
          break;

        case 'network-error':
          await showErrorNotification(
            'Errore di Rete',
            'Problemi di connessione rilevati. Alcune funzionalità potrebbero non essere disponibili'
          );
          break;

        default:
          console.log('Evento sistema non gestito:', eventType, data);
      }
    } catch (error) {
      console.error('Errore nella gestione evento sistema:', error);
    }
  };

  // Gestione eventi profilo
  const handleProfileEvent = async (eventType: string, profileId: string, data?: any): Promise<void> => {
    if (!enableProfileEvents || !currentProfileId || profileId !== currentProfileId) return;

    try {
      switch (eventType) {
        case 'profile-created':
          await showSuccessNotification(
            'Benvenuto!',
            'Il tuo profilo è stato creato con successo. Inizia configurando le tue preferenze.',
            '/settings/profile'
          );
          break;

        case 'profile-authenticated':
          await showSuccessNotification(
            'Accesso Effettuato',
            'Benvenuto nel tuo profilo GameStringer'
          );
          break;

        case 'profile-locked':
          await showErrorNotification(
            'Profilo Bloccato',
            'Il profilo è stato bloccato per troppi tentativi di accesso falliti',
            '/auth/unlock'
          );
          break;

        case 'profile-unlocked':
          await showSuccessNotification(
            'Profilo Sbloccato',
            'Il tuo profilo è stato sbloccato con successo'
          );
          break;

        case 'credential-added':
          await showSuccessNotification(
            'Credenziali Aggiunte',
            `Credenziali per ${data?.store || 'store'} aggiunte con successo`,
            '/settings/stores'
          );
          break;

        case 'credential-error':
          await showErrorNotification(
            'Errore Credenziali',
            `Errore nelle credenziali per ${data?.store || 'store'}. Verifica le impostazioni.`,
            '/settings/stores'
          );
          break;

        case 'settings-updated':
          await showSuccessNotification(
            'Impostazioni Aggiornate',
            'Le tue impostazioni sono state salvate con successo'
          );
          break;

        case 'backup-created':
          await showSuccessNotification(
            'Backup Profilo',
            'Backup del profilo creato con successo'
          );
          break;

        case 'backup-restored':
          await showSuccessNotification(
            'Profilo Ripristinato',
            'Il profilo è stato ripristinato dal backup'
          );
          break;

        case 'migration-completed':
          await showSuccessNotification(
            'Migrazione Completata',
            'I dati del profilo sono stati migrati alla nuova versione'
          );
          break;

        case 'security-alert':
          await showWarningNotification(
            'Avviso di Sicurezza',
            data?.message || 'Rilevata attività sospetta sul profilo',
            '/settings/security'
          );
          break;

        default:
          console.log('Evento profilo non gestito:', eventType, profileId, data);
      }
    } catch (error) {
      console.error('Errore nella gestione evento profilo:', error);
    }
  };

  // Rileva il profilo corrente da eventi globali
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent) => {
      const profileId = event.detail?.profileId || event.detail?.id;
      setCurrentProfileId(profileId);
    };

    // Ascolta eventi di cambio profilo
    window.addEventListener('profile-changed', handleProfileChange as EventListener);
    window.addEventListener('profile-authenticated', handleProfileChange as EventListener);
    
    // Prova a ottenere il profilo corrente dal localStorage
    const savedProfile = localStorage.getItem('currentProfileId');
    if (savedProfile) {
      setCurrentProfileId(savedProfile);
    }

    return () => {
      window.removeEventListener('profile-changed', handleProfileChange as EventListener);
      window.removeEventListener('profile-authenticated', handleProfileChange as EventListener);
    };
  }, []);

  // Inizializzazione sistema notifiche
  useEffect(() => {
    if (!currentProfileId || initializationRef.current) return;

    const initializeNotificationSystem = async () => {
      try {
        console.log('Inizializzazione sistema notifiche per profilo:', currentProfileId);

        // Inizializza il sistema di notifiche Tauri se disponibile
        if (typeof window !== 'undefined') {
          const tauri = (window as any).__TAURI__;
          const invoke = tauri?.tauri?.invoke as undefined | ((cmd: string, args?: any) => Promise<any>);
          if (invoke) {
            try {
              await invoke('initialize_notification_system', {
                profile_id: currentProfileId
              });
              console.log('Sistema notifiche Tauri inizializzato');
            } catch (error) {
              console.warn('Errore inizializzazione sistema notifiche Tauri:', error);
            }
          }
        }

        // Mostra notifica di benvenuto se è un nuovo profilo
        const isNewProfile = localStorage.getItem(`profile_${currentProfileId}_welcomed`) !== 'true';
        if (isNewProfile) {
          setTimeout(async () => {
            await showInfoNotification(
              'Sistema Notifiche Attivo',
              'Il sistema di notifiche è ora attivo per questo profilo'
            );
            localStorage.setItem(`profile_${currentProfileId}_welcomed`, 'true');
          }, 1000);
        }

        initializationRef.current = true;
      } catch (error) {
        console.error('Errore nell\'inizializzazione sistema notifiche:', error);
      }
    };

    initializeNotificationSystem();

    return () => {
      initializationRef.current = false;
    };
  }, [currentProfileId]);

  // Setup event listeners per eventi sistema e profilo
  useEffect(() => {
    if (!enableSystemEvents && !enableProfileEvents) return;

    const cleanup: Array<() => void> = [];

    // Event listeners per eventi sistema
    if (enableSystemEvents) {
      const handleSystemEventWrapper = (event: CustomEvent) => {
        handleSystemEvent(event.type.replace('system-', ''), event.detail);
      };

      // Lista eventi sistema da ascoltare
      const systemEvents = [
        'system-app-update-available',
        'system-app-update-downloaded',
        'system-error',
        'system-maintenance-mode',
        'system-backup-completed',
        'system-backup-failed',
        'system-storage-warning',
        'system-network-error'
      ];

      systemEvents.forEach(eventType => {
        window.addEventListener(eventType, handleSystemEventWrapper as EventListener);
        cleanup.push(() => {
          window.removeEventListener(eventType, handleSystemEventWrapper as EventListener);
        });
      });
    }

    // Event listeners per eventi profilo
    if (enableProfileEvents) {
      const handleProfileEventWrapper = (event: CustomEvent) => {
        const { profileId, ...data } = event.detail;
        handleProfileEvent(event.type.replace('profile-', ''), profileId, data);
      };

      // Lista eventi profilo da ascoltare
      const profileEvents = [
        'profile-created',
        'profile-authenticated',
        'profile-locked',
        'profile-unlocked',
        'profile-credential-added',
        'profile-credential-error',
        'profile-settings-updated',
        'profile-backup-created',
        'profile-backup-restored',
        'profile-migration-completed',
        'profile-security-alert'
      ];

      profileEvents.forEach(eventType => {
        window.addEventListener(eventType, handleProfileEventWrapper as EventListener);
        cleanup.push(() => {
          window.removeEventListener(eventType, handleProfileEventWrapper as EventListener);
        });
      });
    }

    // Setup Tauri event listeners se disponibili
    if (typeof window !== 'undefined') {
      const tauri = (window as any).__TAURI__;
      const event = tauri?.event;

      if (event?.listen) {
        const setupTauriEventListeners = async () => {
          try {
            if (enableSystemEvents) {
              const unlistenSystem = await event.listen('system-event', (event: any) => {
                handleSystemEvent(event.payload.type, event.payload.data);
              });
              cleanup.push(unlistenSystem);
            }

            if (enableProfileEvents) {
              const unlistenProfile = await event.listen('profile-event', (event: any) => {
                handleProfileEvent(event.payload.type, event.payload.profileId, event.payload.data);
              });
              cleanup.push(unlistenProfile);
            }
          } catch (error) {
            console.warn('Errore nel setup Tauri event listeners:', error);
          }
        };

        setupTauriEventListeners();
      }
    }

    systemEventListenersRef.current = cleanup;

    return () => {
      cleanup.forEach(fn => fn());
      systemEventListenersRef.current = [];
    };
  }, [enableSystemEvents, enableProfileEvents, currentProfileId]);

  // Cleanup generale
  useEffect(() => {
    return () => {
      // Cleanup sistema notifiche quando il provider viene smontato
      if (typeof window !== 'undefined') {
        const tauri = (window as any).__TAURI__;
        const invoke = tauri?.tauri?.invoke as undefined | ((cmd: string, args?: any) => Promise<any>);
        if (invoke) {
          invoke('cleanup_notification_system').catch((error: any) => {
            console.warn('Errore nel cleanup sistema notifiche:', error);
          });
        }
      }

      // Cleanup event listeners
      systemEventListenersRef.current.forEach(fn => fn());
    };
  }, []);

  const contextValue: NotificationContextType = {
    ...notificationsHook,
    preferences,
    updatePreferences,
    isPreferencesLoading,
    preferencesError,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification,
    showWarningNotification,
    handleSystemEvent,
    handleProfileEvent
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      <NotificationToastProvider
        maxToasts={5}
        position="top-right"
        autoHideDuration={5000}
      >
        {children}
      </NotificationToastProvider>
    </NotificationContext.Provider>
  );
};

// Hook per utilizzare il sistema di notifiche completo
export const useNotificationSystem = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationSystem deve essere utilizzato all\'interno di NotificationProvider');
  }
  return context;
};

// Hook semplificato per compatibilità
export const useNotificationActions = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    // Fallback se il provider non è disponibile
    return {
      showSuccess: (title: string, message: string) => console.log('Success:', title, message),
      showError: (title: string, message: string) => console.log('Error:', title, message),
      showInfo: (title: string, message: string) => console.log('Info:', title, message),
      showWarning: (title: string, message: string) => console.log('Warning:', title, message)
    };
  }
  
  return {
    showSuccess: context.showSuccessNotification,
    showError: context.showErrorNotification,
    showInfo: context.showInfoNotification,
    showWarning: context.showWarningNotification
  };
};

export default NotificationProvider;