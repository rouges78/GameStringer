import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotifications } from '@/hooks/use-notifications';
// ⚠️ Il percorso conta: `useProfileAuth` è stato estratto da `profile-auth.tsx`
// a `profile-auth-context.ts` il 15/08/2026 (commit 9ee126d5, per riabilitare
// Fast Refresh). Il mock qui sotto è rimasto puntato al modulo vecchio, che non
// esporta più l'hook: il mock creava un modulo fantasma, quello VERO girava
// davvero, e 35 test sono diventati rossi senza che nessuno li guardasse.
// Se sposti di nuovo l'hook, sposta anche questo import e il vi.mock.
import { useProfileAuth } from '@/lib/auth/profile-auth-context';
import { NotificationType, NotificationPriority } from '@/types/notifications';

// Mock delle dipendenze
vi.mock('@/lib/auth/profile-auth-context', () => ({
  useProfileAuth: vi.fn()
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock Tauri API: window.__TAURI__ è già definito (non-configurabile) in
// src/test/setup.ts, quindi riusiamo le sue vi.fn() invece di ridefinire
// la property su window (Object.defineProperty lancerebbe TypeError).
const tauriApi = (window as unknown as {
  __TAURI__: {
    tauri: { invoke: ReturnType<typeof vi.fn> };
    event: { listen: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };
  };
}).__TAURI__;
const mockTauriInvoke = tauriApi.tauri.invoke;

// Mock profile
const mockProfile = {
  id: 'test-profile-id',
  name: 'Test Profile',
  isActive: true
};

// Mock notifications
const mockNotifications = [
  {
    id: 'notif-1',
    profileId: 'test-profile-id',
    type: NotificationType.SYSTEM,
    title: 'System Update',
    message: 'System has been updated',
    priority: NotificationPriority.NORMAL,
    createdAt: new Date().toISOString(),
    metadata: {
      source: 'system',
      category: 'update',
      tags: []
    }
  },
  {
    id: 'notif-2',
    profileId: 'test-profile-id',
    type: NotificationType.PROFILE,
    title: 'Profile Created',
    message: 'New profile has been created',
    priority: NotificationPriority.LOW,
    createdAt: new Date().toISOString(),
    readAt: new Date().toISOString(),
    metadata: {
      source: 'profile',
      category: 'creation',
      tags: []
    }
  }
];

// Notifica restituita dal backend mock per 'create_notification'
const createdNotification = {
  id: 'notif-created',
  profileId: 'test-profile-id',
  type: NotificationType.SECURITY,
  title: 'Security Alert',
  message: 'Suspicious activity detected',
  priority: NotificationPriority.HIGH,
  createdAt: new Date().toISOString(),
  metadata: {
    source: 'security',
    category: 'alert',
    tags: []
  }
};

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // shouldAdvanceTime: i fake timer avanzano anche col tempo reale, così
    // waitFor (che sotto vitest non rileva i fake timer) continua a fare polling
    // mentre vi.advanceTimersByTime resta deterministico nei test dei timer.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock profile auth
    vi.mocked(useProfileAuth).mockReturnValue({
      currentProfile: mockProfile
    });

    // Mock Tauri: l'hook usa il backend Tauri (sempre presente su window nei
    // test, vedi setup), NON il fallback localStorage. Default per comando.
    tauriApi.event.listen.mockImplementation(() => Promise.resolve(() => {}));
    mockTauriInvoke.mockImplementation((cmd: unknown) => {
      switch (cmd) {
        case 'get_notifications':
          return Promise.resolve({ success: true, data: mockNotifications });
        case 'get_unread_notifications_count':
          return Promise.resolve({
            success: true,
            data: mockNotifications.filter(n => !n.readAt).length
          });
        case 'create_notification':
          return Promise.resolve({ success: true, data: createdNotification });
        case 'mark_multiple_notifications_as_read':
        case 'mark_all_notifications_as_read':
          return Promise.resolve({ success: true, data: 1 });
        default:
          return Promise.resolve({ success: true, data: null });
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with empty state when no profile', () => {
      vi.mocked(useProfileAuth).mockReturnValue({
        currentProfile: null
      });

      const { result } = renderHook(() => useNotifications());

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should load notifications when profile is available', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
        expect(result.current.unreadCount).toBe(1); // Only one unread
      });
    });

    it('should handle loading state', () => {
      const { result } = renderHook(() => useNotifications());

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    it('should create notification successfully', async () => {
      // Real-time attivo (default): l'eco dell'evento 'notification-created'
      // emesso da createNotification viene riconosciuta come duplicato dal
      // listener dell'hook, quindi il badge sale di 1, non di 2
      // (regressione: doppio conteggio di unreadCount).
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const newNotificationRequest = {
        type: NotificationType.SECURITY,
        title: 'Security Alert',
        message: 'Suspicious activity detected',
        priority: NotificationPriority.HIGH
      };

      let createResult: boolean;
      await act(async () => {
        createResult = await result.current.createNotification(newNotificationRequest);
      });

      expect(createResult!).toBe(true);
      expect(result.current.notifications.length).toBe(3);
      expect(result.current.notifications.filter(n => n.id === createdNotification.id)).toHaveLength(1);
      expect(result.current.unreadCount).toBe(2);
    });

    it('should mark notification as read', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      let markResult: boolean;
      await act(async () => {
        markResult = await result.current.markAsRead('notif-1');
      });

      expect(markResult!).toBe(true);
      expect(result.current.unreadCount).toBe(0);
      
      const updatedNotification = result.current.notifications.find(n => n.id === 'notif-1');
      expect(updatedNotification?.readAt).toBeDefined();
    });

    it('should delete notification', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Dopo la delete l'hook ricarica dal backend: il mock deve riflettere
      // l'avvenuta eliminazione.
      mockTauriInvoke.mockImplementation((cmd: unknown) =>
        cmd === 'get_notifications'
          ? Promise.resolve({ success: true, data: mockNotifications.filter(n => n.id !== 'notif-1') })
          : Promise.resolve({ success: true, data: true })
      );

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteNotification('notif-1');
      });

      expect(deleteResult!).toBe(true);
      expect(result.current.notifications.length).toBe(1);
      expect(result.current.notifications.find(n => n.id === 'notif-1')).toBeUndefined();
    });

    it('should clear all notifications', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Dopo la pulizia l'hook ricarica dal backend: ora non ci sono notifiche.
      mockTauriInvoke.mockImplementation((cmd: unknown) =>
        cmd === 'get_notifications'
          ? Promise.resolve({ success: true, data: [] })
          : Promise.resolve({ success: true, data: 2 })
      );

      let clearResult: boolean;
      await act(async () => {
        clearResult = await result.current.clearAllNotifications();
      });

      expect(clearResult!).toBe(true);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('Batch Operations', () => {
    it('should mark multiple notifications as read', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      let markedCount: number;
      await act(async () => {
        markedCount = await result.current.markMultipleAsRead(['notif-1', 'notif-2']);
      });

      expect(markedCount!).toBe(1); // Only notif-1 was unread
      expect(result.current.unreadCount).toBe(0);
    });

    it('should mark all notifications as read', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      let markedCount: number;
      await act(async () => {
        markedCount = await result.current.markAllAsRead();
      });

      expect(markedCount!).toBe(1); // Only one was unread
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('Filtering and Search', () => {
    it('should filter notifications by type', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const systemNotifications = result.current.getNotificationsByType(NotificationType.SYSTEM);
      expect(systemNotifications).toHaveLength(1);
      expect(systemNotifications[0].type).toBe(NotificationType.SYSTEM);
    });

    it('should filter notifications by priority', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const normalNotifications = result.current.getNotificationsByPriority(NotificationPriority.NORMAL);
      expect(normalNotifications).toHaveLength(1);
      expect(normalNotifications[0].priority).toBe(NotificationPriority.NORMAL);
    });

    it('should get unread notifications', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const unreadNotifications = result.current.getUnreadNotifications();
      expect(unreadNotifications).toHaveLength(1);
      expect(unreadNotifications[0].readAt).toBeUndefined();
    });

    it('should search notifications', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const searchResults = result.current.searchNotifications('System');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toContain('System');
    });

    it('should filter notifications with custom predicate', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const filteredNotifications = result.current.filterNotifications(
        (notification) => notification.priority === NotificationPriority.LOW
      );
      expect(filteredNotifications).toHaveLength(1);
      expect(filteredNotifications[0].priority).toBe(NotificationPriority.LOW);
    });
  });

  describe('Utility Functions', () => {
    it('should check if has unread notifications', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      expect(result.current.hasUnreadNotifications()).toBe(true);

      // Mark all as read
      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.hasUnreadNotifications()).toBe(false);
    });

    it('should get notification by id', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const notification = result.current.getNotificationById('notif-1');
      expect(notification).toBeDefined();
      expect(notification?.id).toBe('notif-1');

      const nonExistent = result.current.getNotificationById('non-existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should get notification statistics', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      const stats = result.current.getNotificationStats();
      expect(stats.total).toBe(2);
      expect(stats.unread).toBe(1);
      expect(stats.byType[NotificationType.SYSTEM]).toBe(1);
      expect(stats.byType[NotificationType.PROFILE]).toBe(1);
      expect(stats.byPriority[NotificationPriority.NORMAL]).toBe(1);
      expect(stats.byPriority[NotificationPriority.LOW]).toBe(1);
      expect(stats.lastUpdated).toBeDefined();
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time notification events', async () => {
      const { result } = renderHook(() => useNotifications({ enableRealTime: true }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Simulate new notification event
      const newNotification = {
        id: 'notif-3',
        profileId: 'test-profile-id',
        type: NotificationType.GAME,
        title: 'Game Update',
        message: 'New game available',
        priority: NotificationPriority.NORMAL,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'game',
          category: 'update',
          tags: []
        }
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('notification-created', {
          detail: newNotification
        }));
      });

      expect(result.current.notifications).toHaveLength(3);
      expect(result.current.unreadCount).toBe(2);
    });

    it('should ignore duplicate notification-created events', async () => {
      const { result } = renderHook(() => useNotifications({ enableRealTime: true }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Stesso evento due volte nello stesso tick: il secondo arriva prima che
      // React abbia processato gli updater del primo, quindi la dedup deve
      // essere sincrona e coprire anche unreadCount, non solo la lista
      act(() => {
        window.dispatchEvent(new CustomEvent('notification-created', {
          detail: createdNotification
        }));
        window.dispatchEvent(new CustomEvent('notification-created', {
          detail: createdNotification
        }));
      });

      expect(result.current.notifications).toHaveLength(3);
      expect(result.current.unreadCount).toBe(2);
    });

    it('should not double-decrement unreadCount on the markAsRead echo', async () => {
      const { result } = renderHook(() => useNotifications({ enableRealTime: true }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Porta unreadCount a 2: con una sola non letta un eventuale doppio
      // decremento verrebbe mascherato dal clamp Math.max(0, ...)
      act(() => {
        window.dispatchEvent(new CustomEvent('notification-created', {
          detail: createdNotification
        }));
      });
      expect(result.current.unreadCount).toBe(2);

      // markAsRead applica l'update ottimistico E emette 'notification-read':
      // l'eco ri-processata dal listener non deve decrementare una seconda volta
      let markResult: boolean;
      await act(async () => {
        markResult = await result.current.markAsRead('notif-1');
      });

      expect(markResult!).toBe(true);
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.notifications.find(n => n.id === 'notif-1')?.readAt).toBeDefined();
    });

    it('should handle notification read events', async () => {
      const { result } = renderHook(() => useNotifications({ enableRealTime: true }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      act(() => {
        window.dispatchEvent(new CustomEvent('notification-read', {
          detail: { notificationId: 'notif-1', profileId: 'test-profile-id' }
        }));
      });

      const updatedNotification = result.current.notifications.find(n => n.id === 'notif-1');
      expect(updatedNotification?.readAt).toBeDefined();
      expect(result.current.unreadCount).toBe(0);
    });

    it('should handle notification deleted events', async () => {
      const { result } = renderHook(() => useNotifications({ enableRealTime: true }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      act(() => {
        window.dispatchEvent(new CustomEvent('notification-deleted', {
          detail: { notificationId: 'notif-1', profileId: 'test-profile-id' }
        }));
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications.find(n => n.id === 'notif-1')).toBeUndefined();
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('Auto Refresh', () => {
    it('should auto refresh when enabled', async () => {
      const { result } = renderHook(() => 
        useNotifications({ autoRefresh: true, refreshInterval: 1000 })
      );

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Clear the initial calls
      mockTauriInvoke.mockClear();

      // Advance timers to trigger refresh
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should have polled the unread count again for refresh
      expect(mockTauriInvoke).toHaveBeenCalledWith('get_unread_notifications_count', {
        profile_id: 'test-profile-id'
      });
    });

    it('should not auto refresh when disabled', async () => {
      const { result } = renderHook(() => 
        useNotifications({ autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Clear the initial calls
      mockTauriInvoke.mockClear();

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should not have polled the backend again
      expect(mockTauriInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle create notification errors', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Mock error
      mockTauriInvoke.mockRejectedValueOnce(new Error('Create failed'));

      const newNotificationRequest = {
        type: NotificationType.SECURITY,
        title: 'Security Alert',
        message: 'Suspicious activity detected',
        priority: NotificationPriority.HIGH
      };

      let createResult: boolean;
      await act(async () => {
        createResult = await result.current.createNotification(newNotificationRequest);
      });

      expect(createResult!).toBe(false);
      expect(result.current.error).toBe('Create failed');
    });

    it('should handle mark as read errors with rollback', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Mock error after optimistic update
      mockTauriInvoke.mockRejectedValueOnce(new Error('Mark read failed'));

      const initialUnreadCount = result.current.unreadCount;

      let markResult: boolean;
      await act(async () => {
        markResult = await result.current.markAsRead('notif-1');
      });

      expect(markResult!).toBe(false);
      expect(result.current.error).toBe('Mark read failed');
      // Should rollback optimistic update
      expect(result.current.unreadCount).toBe(initialUnreadCount);
    });

    it('should handle load notifications errors', async () => {
      // Mock error from the start
      mockTauriInvoke.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.error).toBe('Storage error');
        expect(result.current.notifications).toEqual([]);
      });
    });
  });

  describe('Pagination', () => {
    it('should load more notifications', async () => {
      // maxNotifications = 2: il primo caricamento riempie il limite,
      // così hasMore resta true e loadMoreNotifications non esce subito.
      const { result } = renderHook(() => useNotifications({ maxNotifications: 2 }));

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Mock more notifications
      const moreNotifications = [
        {
          id: 'notif-3',
          profileId: 'test-profile-id',
          type: NotificationType.GAME,
          title: 'Game Update',
          message: 'New game available',
          priority: NotificationPriority.NORMAL,
          createdAt: new Date().toISOString(),
          metadata: {
            source: 'game',
            category: 'update',
            tags: []
          }
        }
      ];

      mockTauriInvoke.mockImplementation((cmd: unknown) =>
        cmd === 'get_notifications'
          ? Promise.resolve({ success: true, data: [...mockNotifications, ...moreNotifications] })
          : Promise.resolve({ success: true, data: 1 })
      );

      await act(async () => {
        await result.current.loadMoreNotifications();
      });

      expect(result.current.notifications.length).toBeGreaterThan(2);
    });

    it('should handle hasMore state correctly', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasMore).toBeDefined();
      });
    });
  });

  describe('Profile Changes', () => {
    it('should clear notifications when profile changes to null', async () => {
      const { result, rerender } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Change profile to null
      vi.mocked(useProfileAuth).mockReturnValue({
        currentProfile: null
      });

      rerender();

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it('should load new notifications when profile changes', async () => {
      const { result, rerender } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Change to different profile
      const newProfile = { ...mockProfile, id: 'new-profile-id' };
      vi.mocked(useProfileAuth).mockReturnValue({
        currentProfile: newProfile
      });

      const newProfileNotifications = [
        {
          id: 'new-notif-1',
          profileId: 'new-profile-id',
          type: NotificationType.PROFILE,
          title: 'Welcome',
          message: 'Welcome to new profile',
          priority: NotificationPriority.NORMAL,
          createdAt: new Date().toISOString(),
          metadata: {
            source: 'profile',
            category: 'welcome',
            tags: []
          }
        }
      ];

      mockTauriInvoke.mockImplementation((cmd: unknown) =>
        cmd === 'get_notifications'
          ? Promise.resolve({ success: true, data: newProfileNotifications })
          : Promise.resolve({ success: true, data: 0 })
      );

      rerender();

      await waitFor(() => {
        expect(result.current.notifications).toEqual(newProfileNotifications);
      });
    });
  });

  describe('Memory Management', () => {
    it('should cleanup timers on unmount', () => {
      const { unmount } = renderHook(() => 
        useNotifications({ autoRefresh: true, refreshInterval: 1000 })
      );

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => 
        useNotifications({ enableRealTime: true })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});
