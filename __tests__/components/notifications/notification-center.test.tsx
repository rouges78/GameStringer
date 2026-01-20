import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { Notification, NotificationType, NotificationPriority } from '@/types/notifications';

// Mock delle dipendenze
vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: vi.fn()
}));

vi.mock('@/hooks/use-keyboard-navigation', () => ({
  useKeyboardNavigation: vi.fn(() => ({
    focusManager: {
      focusNotificationCenter: vi.fn(),
      restoreFocus: vi.fn(),
      focusSearch: vi.fn()
    }
  })),
  useNotificationListNavigation: vi.fn()
}));

vi.mock('@/lib/notification-accessibility', () => ({
  announceFilterChange: vi.fn(),
  announceSearchResults: vi.fn(),
  announceBatchOperation: vi.fn()
}));

vi.mock('./keyboard-shortcuts-help', () => ({
  KeyboardShortcutsHelp: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="keyboard-help" onClick={onClose}>Keyboard Help</div> : null
}));

// Mock notification di test
const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: `notif-${Math.random().toString(36).substring(2, 11)}`,
  profileId: 'test-profile',
  type: NotificationType.SYSTEM,
  title: 'Test Notification',
  message: 'This is a test notification message',
  priority: NotificationPriority.NORMAL,
  createdAt: new Date().toISOString(),
  metadata: {
    source: 'test',
    category: 'test',
    tags: []
  },
  ...overrides
});

const mockNotifications: Notification[] = [
  createMockNotification({
    id: 'notif-1',
    title: 'System Update',
    type: NotificationType.SYSTEM,
    priority: NotificationPriority.HIGH
  }),
  createMockNotification({
    id: 'notif-2',
    title: 'Profile Created',
    type: NotificationType.PROFILE,
    priority: NotificationPriority.NORMAL,
    readAt: new Date().toISOString()
  }),
  createMockNotification({
    id: 'notif-3',
    title: 'Security Alert',
    type: NotificationType.SECURITY,
    priority: NotificationPriority.URGENT
  })
];

describe('NotificationCenter', () => {
  const mockUseNotifications = {
    notifications: mockNotifications,
    unreadCount: 2,
    isLoading: false,
    markAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
    refreshNotifications: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue(mockUseNotifications);
  });

  describe('Rendering', () => {
    it('should render notification center when open', () => {
      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Notifiche')).toBeInTheDocument();
      expect(screen.getByText('2 nuove')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<NotificationCenter isOpen={false} onClose={vi.fn()} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render all notifications', () => {
      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText('System Update')).toBeInTheDocument();
      expect(screen.getByText('Profile Created')).toBeInTheDocument();
      expect(screen.getByText('Security Alert')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        isLoading: true,
        notifications: []
      });

      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
    });

    it('should show empty state when no notifications', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        notifications: [],
        unreadCount: 0
      });

      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByText('Nessuna notifica')).toBeInTheDocument();
      expect(screen.getByText('Le tue notifiche appariranno qui')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should close when clicking outside', async () => {
      const mockOnClose = vi.fn();
      const user = userEvent.setup();

      render(<NotificationCenter isOpen={true} onClose={mockOnClose} />);
      
      const backdrop = screen.getByRole('dialog').parentElement;
      await user.click(backdrop!);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close when clicking close button', async () => {
      const mockOnClose = vi.fn();
      const user = userEvent.setup();

      render(<NotificationCenter isOpen={true} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Centro notifiche');
    });

    it('should have proper heading structure', () => {
      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      expect(screen.getByRole('heading', { name: 'Notifiche' })).toBeInTheDocument();
    });

    it('should have accessible search input', () => {
      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      
      const searchInput = screen.getByRole('textbox', { name: /cerca nelle notifiche/i });
      expect(searchInput).toHaveAttribute('aria-describedby', 'search-help');
    });
  });
});