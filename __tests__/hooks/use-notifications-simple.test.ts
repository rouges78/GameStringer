import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotifications } from '@/hooks/use-notifications';

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

// Mock profile
const mockProfile = {
  id: 'test-profile-id',
  name: 'Test Profile',
  isActive: true
};

describe('useNotifications - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock profile auth
    (require('@/lib/profile-auth').useProfileAuth as any).mockReturnValue({
      currentProfile: mockProfile
    });

    // Mock localStorage
    localStorageMock.getItem.mockReturnValue(JSON.stringify([]));
  });

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

  it('should provide all expected functions', () => {
    const { result } = renderHook(() => useNotifications());

    expect(typeof result.current.createNotification).toBe('function');
    expect(typeof result.current.markAsRead).toBe('function');
    expect(typeof result.current.deleteNotification).toBe('function');
    expect(typeof result.current.clearAllNotifications).toBe('function');
    expect(typeof result.current.refreshNotifications).toBe('function');
    expect(typeof result.current.getNotificationsByType).toBe('function');
    expect(typeof result.current.getUnreadNotifications).toBe('function');
    expect(typeof result.current.hasUnreadNotifications).toBe('function');
  });
});