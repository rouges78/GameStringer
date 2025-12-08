'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import {
  Notification,
  NotificationFilter,
  CreateNotificationRequest,
  UseNotificationsReturn,
  NotificationResponse,
  NotificationType,
  NotificationPriority
} from '@/types/notifications';

export const useNotifications = (options?: {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealTime?: boolean;
  maxNotifications?: number;
}): UseNotificationsReturn => {
  const { currentProfile } = useProfileAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs per gestire cleanup e polling
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersRef = useRef<Array<() => void>>([]);

  // Opzioni con valori predefiniti
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 secondi
    enableRealTime = true,
    maxNotifications = 100
  } = options || {};

  // Carica notifiche dal backend con supporto avanzato
  const loadNotifications = useCallback(async (
    filter: NotificationFilter = {},
    options: { append?: boolean; silent?: boolean } = {}
  ) => {
    if (!currentProfile) return;

    if (!options.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Applica limite massimo se non specificato
      const finalFilter = {
        ...filter,
        limit: filter.limit || maxNotifications
      };

      // Prova prima con Tauri API
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        // Mappa il filtro in snake_case per il backend Rust
        const snakeCaseFilter: any = {
          notification_type: (finalFilter as any).type ?? undefined,
          priority: finalFilter.priority ?? undefined,
          unread_only: (finalFilter as any).unreadOnly ?? undefined,
          category: finalFilter.category ?? undefined,
          limit: finalFilter.limit ?? undefined,
          offset: finalFilter.offset ?? undefined
        };
        const result: NotificationResponse<Notification[]> = await invoke('get_notifications', {
          profile_id: currentProfile.id,
          filter: snakeCaseFilter
        });

        if (result.success && result.data) {
          const newNotifications = result.data;

          if (options.append) {
            setNotifications(prev => {
              // Evita duplicati
              const existingIds = new Set(prev.map(n => n.id));
              const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
              return [...prev, ...uniqueNew];
            });
          } else {
            setNotifications(newNotifications);
          }

          // Calcola notifiche non lette
          const unread = newNotifications.filter(n => !n.readAt).length;
          if (!options.append) {
            setUnreadCount(unread);
          }

          // Controlla se ci sono più notifiche
          setHasMore(newNotifications.length === (finalFilter.limit || maxNotifications));
          setLastUpdated(new Date());
        } else {
          throw new Error(result.error || 'Errore nel caricamento notifiche');
        }
      } else {
        // Fallback per sviluppo - usa localStorage con simulazione realistica
        const storageKey = `notifications_${currentProfile.id}`;
        const stored = localStorage.getItem(storageKey);
        let storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];

        // Applica filtri
        if (finalFilter.unreadOnly) {
          storedNotifications = storedNotifications.filter(n => !n.readAt);
        }
        if (finalFilter.type) {
          storedNotifications = storedNotifications.filter(n => n.type === finalFilter.type);
        }
        if (finalFilter.priority) {
          storedNotifications = storedNotifications.filter(n => n.priority === finalFilter.priority);
        }

        // Applica paginazione
        const offset = finalFilter.offset || 0;
        const limit = finalFilter.limit || maxNotifications;
        const paginatedNotifications = storedNotifications.slice(offset, offset + limit);

        if (options.append) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const uniqueNew = paginatedNotifications.filter(n => !existingIds.has(n.id));
            return [...prev, ...uniqueNew];
          });
        } else {
          setNotifications(paginatedNotifications);
        }

        const unread = storedNotifications.filter(n => !n.readAt).length;
        if (!options.append) {
          setUnreadCount(unread);
        }

        setHasMore(paginatedNotifications.length === limit && (offset + limit) < storedNotifications.length);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Errore nel caricamento notifiche:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }, [currentProfile]);

  // Carica conteggio notifiche non lette con cache
  const loadUnreadCount = useCallback(async (useCache: boolean = false) => {
    if (!currentProfile) return;

    try {
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        const result: NotificationResponse<number> = await invoke('get_unread_notifications_count', {
          profile_id: currentProfile.id
        });

        if (result.success && typeof result.data === 'number') {
          setUnreadCount(result.data);
        }
      } else {
        // Fallback per sviluppo con simulazione cache
        const storageKey = `notifications_${currentProfile.id}`;
        const cacheKey = `unread_count_${currentProfile.id}`;

        if (useCache) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { count, timestamp } = JSON.parse(cached);
            // Cache valida per 10 secondi
            if (Date.now() - timestamp < 10000) {
              setUnreadCount(count);
              return;
            }
          }
        }

        const stored = localStorage.getItem(storageKey);
        const storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];
        const unread = storedNotifications.filter(n => !n.readAt).length;
        setUnreadCount(unread);

        // Salva in cache
        localStorage.setItem(cacheKey, JSON.stringify({
          count: unread,
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.error('Errore nel caricamento conteggio notifiche:', err);
    }
  }, [currentProfile]);

  // Crea una nuova notifica con ottimizzazioni
  const createNotification = useCallback(async (request: CreateNotificationRequest): Promise<boolean> => {
    if (!currentProfile) return false;

    try {
      const fullRequest = {
        ...request,
        profileId: currentProfile.id,
        priority: request.priority || NotificationPriority.NORMAL
      };

      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        // Mappa la richiesta in snake_case per il backend Rust
        const snakeCaseRequest: any = {
          profile_id: fullRequest.profileId,
          notification_type: fullRequest.type,
          title: fullRequest.title,
          message: fullRequest.message,
          icon: fullRequest.icon ?? undefined,
          action_url: fullRequest.actionUrl ?? undefined,
          priority: fullRequest.priority ?? undefined,
          expires_at: fullRequest.expiresAt ?? undefined,
          metadata: fullRequest.metadata
            ? {
                source: fullRequest.metadata.source,
                category: fullRequest.metadata.category,
                tags: fullRequest.metadata.tags,
                custom_data: (fullRequest.metadata as any).customData ?? undefined
              }
            : undefined
        };
        const result: NotificationResponse<Notification> = await invoke('create_notification', {
          request: snakeCaseRequest
        });

        if (result.success && result.data) {
          // Aggiorna lo stato locale immediatamente per UX migliore
          setNotifications(prev => [result.data!, ...prev.slice(0, maxNotifications - 1)]);
          setUnreadCount(prev => prev + 1);
          setLastUpdated(new Date());

          // Emetti evento per altri componenti
          window.dispatchEvent(new CustomEvent('notification-created', {
            detail: result.data
          }));

          return true;
        } else {
          throw new Error(result.error || 'Errore nella creazione notifica');
        }
      } else {
        // Fallback per sviluppo con simulazione realistica
        const newNotification: Notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          profileId: currentProfile.id,
          type: request.type,
          title: request.title,
          message: request.message,
          icon: request.icon,
          actionUrl: request.actionUrl,
          priority: request.priority || NotificationPriority.NORMAL,
          createdAt: new Date().toISOString(),
          metadata: request.metadata || {
            source: 'manual',
            category: 'general',
            tags: []
          }
        };

        const storageKey = `notifications_${currentProfile.id}`;
        const stored = localStorage.getItem(storageKey);
        const storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];

        storedNotifications.unshift(newNotification);
        // Mantieni solo le ultime notifiche
        if (storedNotifications.length > maxNotifications) {
          storedNotifications.splice(maxNotifications);
        }
        localStorage.setItem(storageKey, JSON.stringify(storedNotifications));

        // Aggiorna stato locale
        setNotifications(prev => [newNotification, ...prev.slice(0, maxNotifications - 1)]);
        setUnreadCount(prev => prev + 1);
        setLastUpdated(new Date());

        // Emetti evento
        window.dispatchEvent(new CustomEvent('notification-created', {
          detail: newNotification
        }));

        return true;
      }
    } catch (err) {
      console.error('Errore nella creazione notifica:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      return false;
    }
  }, [currentProfile, maxNotifications]);

  // Marca notifica come letta con aggiornamento ottimistico
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!currentProfile) return false;

    // Aggiornamento ottimistico
    const wasUnread = notifications.find(n => n.id === notificationId && !n.readAt);
    if (wasUnread) {
      setNotifications(prev => prev.map(n =>
        n.id === notificationId
          ? { ...n, readAt: new Date().toISOString() }
          : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        const result: NotificationResponse<void> = await invoke('mark_notification_as_read', {
          notification_id: notificationId,
          profile_id: currentProfile.id
        });

        if (result.success) {
          // Emetti evento per sincronizzazione
          window.dispatchEvent(new CustomEvent('notification-read', {
            detail: { notificationId, profileId: currentProfile.id }
          }));
          return true;
        } else {
          // Rollback in caso di errore
          if (wasUnread) {
            setNotifications(prev => prev.map(n =>
              n.id === notificationId
                ? { ...n, readAt: undefined }
                : n
            ));
            setUnreadCount(prev => prev + 1);
          }
          throw new Error(result.error || 'Errore nel marcare notifica come letta');
        }
      } else {
        // Fallback per sviluppo
        const storageKey = `notifications_${currentProfile.id}`;
        const stored = localStorage.getItem(storageKey);
        const storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];

        const updatedNotifications = storedNotifications.map(n =>
          n.id === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n
        );

        localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));

        // Emetti evento
        window.dispatchEvent(new CustomEvent('notification-read', {
          detail: { notificationId, profileId: currentProfile.id }
        }));

        return true;
      }
    } catch (err) {
      console.error('Errore nel marcare notifica come letta:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');

      // Rollback in caso di errore
      if (wasUnread) {
        setNotifications(prev => prev.map(n =>
          n.id === notificationId
            ? { ...n, readAt: undefined }
            : n
        ));
        setUnreadCount(prev => prev + 1);
      }

      return false;
    }
  }, [currentProfile, notifications]);

  // Elimina notifica
  const deleteNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!currentProfile) return false;

    try {
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        const result: NotificationResponse<boolean> = await invoke('delete_notification', {
          notification_id: notificationId,
          profile_id: currentProfile.id
        });

        if (result.success) {
          await loadNotifications();
          return true;
        } else {
          throw new Error(result.error || 'Errore nell\'eliminazione notifica');
        }
      } else {
        // Fallback per sviluppo
        const storageKey = `notifications_${currentProfile.id}`;
        const stored = localStorage.getItem(storageKey);
        const storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];

        const updatedNotifications = storedNotifications.filter(n => n.id !== notificationId);
        localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));

        await loadNotifications();
        return true;
      }
    } catch (err) {
      console.error('Errore nell\'eliminazione notifica:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      return false;
    }
  }, [currentProfile, loadNotifications]);

  // Pulisci tutte le notifiche
  const clearAllNotifications = useCallback(async (): Promise<boolean> => {
    if (!currentProfile) return false;

    try {
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        const result: NotificationResponse<number> = await invoke('clear_all_notifications', {
          profile_id: currentProfile.id
        });

        if (result.success) {
          await loadNotifications();
          return true;
        } else {
          throw new Error(result.error || 'Errore nella pulizia notifiche');
        }
      } else {
        // Fallback per sviluppo
        const storageKey = `notifications_${currentProfile.id}`;
        localStorage.removeItem(storageKey);
        await loadNotifications();
        return true;
      }
    } catch (err) {
      console.error('Errore nella pulizia notifiche:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      return false;
    }
  }, [currentProfile, loadNotifications]);

  // Ricarica notifiche
  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  // Carica più notifiche (per paginazione) con controllo duplicati
  const loadMoreNotifications = useCallback(async () => {
    if (!hasMore || isLoading) return;

    const filter: NotificationFilter = {
      offset: notifications.length,
      limit: 20
    };

    await loadNotifications(filter, { append: true, silent: true });
  }, [hasMore, isLoading, notifications.length, loadNotifications]);

  // Marca multiple notifiche come lette
  const markMultipleAsRead = useCallback(async (notificationIds: string[]): Promise<number> => {
    if (!currentProfile || notificationIds.length === 0) return 0;

    // Aggiornamento ottimistico
    const unreadIds = notificationIds.filter(id =>
      notifications.find(n => n.id === id && !n.readAt)
    );

    if (unreadIds.length > 0) {
      setNotifications(prev => prev.map(n =>
        unreadIds.includes(n.id)
          ? { ...n, readAt: new Date().toISOString() }
          : n
      ));
      setUnreadCount(prev => Math.max(0, prev - unreadIds.length));
    }

    try {
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        const result: NotificationResponse<number> = await invoke('mark_multiple_notifications_as_read', {
          notification_ids: notificationIds,
          profile_id: currentProfile.id
        });

        if (result.success) {
          return result.data || 0;
        } else {
          throw new Error(result.error || 'Errore nel marcare notifiche come lette');
        }
      } else {
        // Fallback per sviluppo
        const storageKey = `notifications_${currentProfile.id}`;
        const stored = localStorage.getItem(storageKey);
        const storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];

        let markedCount = 0;
        const updatedNotifications = storedNotifications.map(n => {
          if (notificationIds.includes(n.id) && !n.readAt) {
            markedCount++;
            return { ...n, readAt: new Date().toISOString() };
          }
          return n;
        });

        localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));
        return markedCount;
      }
    } catch (err) {
      console.error('Errore nel marcare notifiche come lette:', err);

      // Rollback in caso di errore
      if (unreadIds.length > 0) {
        setNotifications(prev => prev.map(n =>
          unreadIds.includes(n.id)
            ? { ...n, readAt: undefined }
            : n
        ));
        setUnreadCount(prev => prev + unreadIds.length);
      }

      return 0;
    }
  }, [currentProfile, notifications]);

  // Marca tutte le notifiche come lette
  const markAllAsRead = useCallback(async (): Promise<number> => {
    if (!currentProfile) return 0;

    const unreadNotifications = notifications.filter(n => !n.readAt);
    if (unreadNotifications.length === 0) return 0;

    // Aggiornamento ottimistico
    setNotifications(prev => prev.map(n =>
      !n.readAt ? { ...n, readAt: new Date().toISOString() } : n
    ));
    setUnreadCount(0);

    try {
      const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
      if (tauri?.tauri?.invoke) {
        const invoke = (tauri.tauri.invoke as any);
        const result: NotificationResponse<number> = await invoke('mark_all_notifications_as_read', {
          profile_id: currentProfile.id
        });

        if (result.success) {
          return result.data || 0;
        } else {
          throw new Error(result.error || 'Errore nel marcare tutte le notifiche come lette');
        }
      } else {
        // Fallback per sviluppo
        const storageKey = `notifications_${currentProfile.id}`;
        const stored = localStorage.getItem(storageKey);
        const storedNotifications: Notification[] = stored ? JSON.parse(stored) : [];

        let markedCount = 0;
        const updatedNotifications = storedNotifications.map(n => {
          if (!n.readAt) {
            markedCount++;
            return { ...n, readAt: new Date().toISOString() };
          }
          return n;
        });

        localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));
        return markedCount;
      }
    } catch (err) {
      console.error('Errore nel marcare tutte le notifiche come lette:', err);

      // Rollback in caso di errore
      setNotifications(prev => prev.map(n => {
        const wasUnread = unreadNotifications.find(un => un.id === n.id);
        return wasUnread ? { ...n, readAt: undefined } : n;
      }));
      setUnreadCount(unreadNotifications.length);

      return 0;
    }
  }, [currentProfile, notifications]);

  // Setup real-time updates e polling
  useEffect(() => {
    if (!currentProfile) {
      // Cleanup quando non c'è profilo
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(true);
      setLastUpdated(null);
      setError(null);

      // Ferma polling
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      return;
    }

    // Carica notifiche iniziali
    loadNotifications();
    loadUnreadCount();

    // Setup polling automatico se abilitato
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        loadUnreadCount(true); // Usa cache per performance
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [currentProfile, autoRefresh, refreshInterval, loadNotifications, loadUnreadCount]);

  // Setup event listeners per real-time updates
  useEffect(() => {
    if (!enableRealTime || !currentProfile) return;

    const cleanup: Array<() => void> = [];

    // Handler per nuove notifiche
    const handleNewNotification = (event: CustomEvent) => {
      const notification = event.detail;
      if (notification && notification.profileId === currentProfile.id) {
        setNotifications(prev => {
          // Evita duplicati
          if (prev.find(n => n.id === notification.id)) return prev;
          return [notification, ...prev.slice(0, maxNotifications - 1)];
        });
        setUnreadCount(prev => prev + 1);
        setLastUpdated(new Date());
      }
    };

    // Handler per notifiche lette
    const handleNotificationRead = (event: CustomEvent) => {
      const { notificationId, profileId } = event.detail;
      if (profileId === currentProfile.id) {
        setNotifications(prev => prev.map(n =>
          n.id === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    };

    // Handler per notifiche eliminate
    const handleNotificationDeleted = (event: CustomEvent) => {
      const { notificationId, profileId } = event.detail;
      if (profileId === currentProfile.id) {
        setNotifications(prev => {
          const notification = prev.find(n => n.id === notificationId);
          const newNotifications = prev.filter(n => n.id !== notificationId);

          // Aggiorna conteggio non lette se necessario
          if (notification && !notification.readAt) {
            setUnreadCount(prevCount => Math.max(0, prevCount - 1));
          }

          return newNotifications;
        });
      }
    };

    // Registra event listeners
    window.addEventListener('notification-created', handleNewNotification as EventListener);
    window.addEventListener('notification-read', handleNotificationRead as EventListener);
    window.addEventListener('notification-deleted', handleNotificationDeleted as EventListener);

    cleanup.push(() => {
      window.removeEventListener('notification-created', handleNewNotification as EventListener);
      window.removeEventListener('notification-read', handleNotificationRead as EventListener);
      window.removeEventListener('notification-deleted', handleNotificationDeleted as EventListener);
    });

    // Setup Tauri event listeners se disponibili
    const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined;
    const event = tauri?.event;
    if (event?.listen) {
      const setupTauriListeners = async () => {
        try {
          const unlistenCreated = await event.listen('notification-created', handleNewNotification);
          const unlistenRead = await event.listen('notification-read', handleNotificationRead);
          const unlistenDeleted = await event.listen('notification-deleted', handleNotificationDeleted);

          cleanup.push(unlistenCreated);
          cleanup.push(unlistenRead);
          cleanup.push(unlistenDeleted);
        } catch (err) {
          console.warn('Errore nel setup Tauri event listeners:', err);
        }
      };

      setupTauriListeners();
    }

    // Salva cleanup functions
    eventListenersRef.current = cleanup;

    return () => {
      cleanup.forEach(fn => fn());
      eventListenersRef.current = [];
    };
  }, [enableRealTime, currentProfile, maxNotifications]);

  // Cleanup generale
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      eventListenersRef.current.forEach(fn => fn());
    };
  }, []);

  // Funzioni di utilità
  const getNotificationsByType = useCallback((type: NotificationType) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  const getNotificationsByPriority = useCallback((priority: NotificationPriority) => {
    return notifications.filter(n => n.priority === priority);
  }, [notifications]);

  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.readAt);
  }, [notifications]);

  const hasUnreadNotifications = useCallback(() => {
    return unreadCount > 0;
  }, [unreadCount]);

  const getNotificationById = useCallback((id: string) => {
    return notifications.find(n => n.id === id);
  }, [notifications]);

  // Filtri avanzati
  const filterNotifications = useCallback((
    predicate: (notification: Notification) => boolean
  ) => {
    return notifications.filter(predicate);
  }, [notifications]);

  const searchNotifications = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return notifications.filter(n =>
      n.title.toLowerCase().includes(lowercaseQuery) ||
      n.message.toLowerCase().includes(lowercaseQuery) ||
      n.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }, [notifications]);

  // Statistiche
  const getNotificationStats = useCallback(() => {
    const stats = {
      total: notifications.length,
      unread: unreadCount,
      byType: {} as Record<NotificationType, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      lastUpdated
    };

    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
    });

    return stats;
  }, [notifications, unreadCount, lastUpdated]);

  return {
    // Stato base
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    lastUpdated,

    // Operazioni CRUD
    createNotification,
    markAsRead,
    deleteNotification,
    clearAllNotifications,

    // Operazioni batch
    markMultipleAsRead,
    markAllAsRead,

    // Caricamento e refresh
    refreshNotifications,
    loadMoreNotifications,

    // Funzioni di utilità
    getNotificationsByType,
    getNotificationsByPriority,
    getUnreadNotifications,
    hasUnreadNotifications,
    getNotificationById,
    filterNotifications,
    searchNotifications,
    getNotificationStats
  };
};

export default useNotifications;