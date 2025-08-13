import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationType, NotificationPriority } from '@/types/notifications';

// Mock delle dipendenze
vi.mock('@/lib/profile-auth', () => ({
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

// Mock Tauri API
const mockTauriInvoke = vi.fn();
Object.defineProperty(window, '__TAURI__', {
  value: {
    tauri: {
      invoke: mockTauriInvoke
    },
    event: {
      listen: vi.fn(() => Promise.resolve(() => {})),
      emit: vi.fn()
    }
  }
});

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

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock profile auth
    (require('@/lib/profile-auth').useProfileAuth as any).mockReturnValue({
      currentProfile: mockProfile
    });

    // Mock localStorage
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockNotifications));
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});

    // Mock Tauri responses
    mockTauriInvoke.mockResolvedValue({
      success: true,
      data: mockNotifications
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with empty state when no profile', () => {
      (require('@/lib/profile-auth').useProfileAuth as any).mockReturnValue({
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

      // Clear the initial call
      localStorageMock.getItem.mockClear();

      // Advance timers to trigger refresh
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should have called getItem again for refresh
      expect(localStorageMock.getItem).toHaveBeenCalled();
    });

    it('should not auto refresh when disabled', async () => {
      const { result } = renderHook(() => 
        useNotifications({ autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications);
      });

      // Clear the initial call
      localStorageMock.getItem.mockClear();

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should not have called getItem again
      expect(localStorageMock.getItem).not.toHaveBeenCalled();
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
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.error).toBe('Storage error');
        expect(result.current.notifications).toEqual([]);
      });
    });
  });

  describe('Pagination', () => {
    it('should load more notifications', async () => {
      const { result } = renderHook(() => useNotifications());

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

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify([...mockNotifications, ...moreNotifications]));

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
      (require('@/lib/profile-auth').useProfileAuth as any).mockReturnValue({
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
      (require('@/lib/profile-auth').useProfileAuth as any).mockReturnValue({
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

      localStorageMock.getItem.mockReturnValue(JSON.stringify(newProfileNotifications));

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