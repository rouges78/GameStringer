import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotifications } from '@/hooks/use-notifications';
// ⚠️ Vedi la nota in use-notifications.test.ts: l'hook vive in
// `profile-auth-context.ts` dal 15/08/2026, non più in `profile-auth.tsx`.
import { useProfileAuth } from '@/lib/auth/profile-auth-context';

// Mock delle dipendenze
vi.mock('@/lib/auth/profile-auth-context', () => ({
  useProfileAuth: vi.fn()
}));

// L'API Tauri è già mockata (non-configurabile) in src/test/setup.ts:
// riusiamo le sue vi.fn() invece di ridefinire la property su window.
const tauriApi = (window as unknown as {
  __TAURI__: {
    tauri: { invoke: ReturnType<typeof vi.fn> };
    event: { listen: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };
  };
}).__TAURI__;

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
    vi.mocked(useProfileAuth).mockReturnValue({
      currentProfile: mockProfile
    });

    // Mock localStorage
    localStorageMock.getItem.mockReturnValue(JSON.stringify([]));

    // Backend Tauri: risposta vuota di default e unlisten valido,
    // altrimenti il cleanup dell'hook esplode allo smontaggio.
    tauriApi.tauri.invoke.mockResolvedValue({ success: true, data: [] });
    tauriApi.event.listen.mockImplementation(() => Promise.resolve(() => {}));
  });

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
