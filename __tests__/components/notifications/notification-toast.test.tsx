import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import NotificationToast from '@/components/notifications/notification-toast';
import { Notification, NotificationType, NotificationPriority } from '@/types/notifications';

// Mock delle dipendenze
vi.mock('@/lib/notification-accessibility', () => ({
  announceToScreenReader: vi.fn(),
  createNotificationAnnouncement: vi.fn(() => 'Test announcement'),
  announceDismissal: vi.fn(),
  getPriorityText: vi.fn(() => 'Normal'),
  getTypeText: vi.fn(() => 'System'),
  getIconAriaLabel: vi.fn(() => 'System notification'),
  createHelpText: vi.fn(() => 'Help text'),
  prefersReducedMotion: vi.fn(() => false)
}));

vi.mock('@/lib/ui-interference-detector', () => ({
  useUIInterferenceDetector: vi.fn(() => ({
    hasInterferences: false,
    hasHighPriorityInterferences: false,
    getOptimalToastPosition: vi.fn(() => ({ x: 100, y: 100 }))
  }))
}));

vi.mock('@/components/notifications/dynamic-toast-positioner', () => ({
  useDynamicToastPositioner: vi.fn(() => ({
    registerToast: vi.fn(),
    unregisterToast: vi.fn()
  }))
}));

vi.mock('@/lib/intelligent-timing-manager', () => ({
  useIntelligentTiming: vi.fn(() => ({
    scheduleAutoDismiss: vi.fn(),
    cancelAutoDismiss: vi.fn()
  }))
}));

// Mock notification di test
const mockNotification: Notification = {
  id: 'test-notification-1',
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
  }
};

describe('NotificationToast', () => {
  const mockOnDismiss = vi.fn();
  const mockOnAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render notification with title and message', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('This is a test notification message')).toBeInTheDocument();
    });

    it('should render with correct ARIA attributes', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(toast).toHaveAttribute('aria-atomic', 'true');
      expect(toast).toHaveAttribute('tabIndex', '0');
    });

    it('should render urgent notifications with assertive aria-live', () => {
      const urgentNotification = {
        ...mockNotification,
        priority: NotificationPriority.URGENT
      };

      render(
        <NotificationToast
          notification={urgentNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'assertive');
    });

    it('should render close button with correct aria-label', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const closeButton = screen.getByRole('button', { name: /chiudi notifica/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should render action button when actionUrl is provided', () => {
      const notificationWithAction = {
        ...mockNotification,
        actionUrl: '/test-action'
      };

      render(
        <NotificationToast
          notification={notificationWithAction}
          onDismiss={mockOnDismiss}
          onAction={mockOnAction}
        />
      );

      const actionButton = screen.getByRole('button', { name: /visualizza dettagli/i });
      expect(actionButton).toBeInTheDocument();
    });

    it('should render progress bar for non-urgent notifications', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
          autoHideDuration={5000}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should not render progress bar for urgent notifications', () => {
      const urgentNotification = {
        ...mockNotification,
        priority: NotificationPriority.URGENT
      };

      render(
        <NotificationToast
          notification={urgentNotification}
          onDismiss={mockOnDismiss}
          autoHideDuration={5000}
        />
      );

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should render category badge when metadata.category is provided', () => {
      const notificationWithCategory = {
        ...mockNotification,
        metadata: {
          ...mockNotification.metadata,
          category: 'Important'
        }
      };

      render(
        <NotificationToast
          notification={notificationWithCategory}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('Important')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onDismiss when close button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const closeButton = screen.getByRole('button', { name: /chiudi notifica/i });
      await user.click(closeButton);

      // Aspetta l'animazione di uscita
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockOnDismiss).toHaveBeenCalledWith(mockNotification.id);
    });

    it('should call onAction when action button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const notificationWithAction = {
        ...mockNotification,
        actionUrl: '/test-action'
      };

      render(
        <NotificationToast
          notification={notificationWithAction}
          onDismiss={mockOnDismiss}
          onAction={mockOnAction}
        />
      );

      const actionButton = screen.getByRole('button', { name: /visualizza dettagli/i });
      await user.click(actionButton);

      expect(mockOnAction).toHaveBeenCalledWith(mockNotification.id, 'navigate');
    });

    it('should dismiss on Escape key press', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      toast.focus();
      await user.keyboard('{Escape}');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockOnDismiss).toHaveBeenCalledWith(mockNotification.id);
    });

    it('should trigger action on Enter key press when actionUrl exists', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const notificationWithAction = {
        ...mockNotification,
        actionUrl: '/test-action'
      };

      render(
        <NotificationToast
          notification={notificationWithAction}
          onDismiss={mockOnDismiss}
          onAction={mockOnAction}
        />
      );

      const toast = screen.getByRole('alert');
      toast.focus();
      await user.keyboard('{Enter}');

      expect(mockOnAction).toHaveBeenCalledWith(mockNotification.id, 'navigate');
    });
  });

  describe('Auto-hide Behavior', () => {
    it('should auto-hide after specified duration', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
          autoHideDuration={3000}
        />
      );

      // Avanza il timer per mostrare il toast
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Avanza il timer per l'auto-hide + animazione
      act(() => {
        vi.advanceTimersByTime(3300);
      });

      expect(mockOnDismiss).toHaveBeenCalledWith(mockNotification.id);
    });

    it('should not auto-hide urgent notifications', () => {
      const urgentNotification = {
        ...mockNotification,
        priority: NotificationPriority.URGENT
      };

      render(
        <NotificationToast
          notification={urgentNotification}
          onDismiss={mockOnDismiss}
          autoHideDuration={3000}
        />
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });

    it('should not auto-hide when autoHideDuration is 0', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
          autoHideDuration={0}
        />
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Priority Styling', () => {
    it('should apply correct styles for urgent priority', () => {
      const urgentNotification = {
        ...mockNotification,
        priority: NotificationPriority.URGENT
      };

      render(
        <NotificationToast
          notification={urgentNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast.querySelector('.border-l-red-500')).toBeInTheDocument();
    });

    it('should apply correct styles for high priority', () => {
      const highNotification = {
        ...mockNotification,
        priority: NotificationPriority.HIGH
      };

      render(
        <NotificationToast
          notification={highNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast.querySelector('.border-l-orange-500')).toBeInTheDocument();
    });

    it('should apply correct styles for normal priority', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast.querySelector('.border-l-blue-500')).toBeInTheDocument();
    });

    it('should apply correct styles for low priority', () => {
      const lowNotification = {
        ...mockNotification,
        priority: NotificationPriority.LOW
      };

      render(
        <NotificationToast
          notification={lowNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast.querySelector('.border-l-gray-500')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should announce notification to screen readers', () => {
      const { announceToScreenReader, createNotificationAnnouncement } = require('@/lib/notification-accessibility');

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(createNotificationAnnouncement).toHaveBeenCalledWith(
        mockNotification.title,
        mockNotification.message,
        mockNotification.type,
        mockNotification.priority
      );
      expect(announceToScreenReader).toHaveBeenCalled();
    });

    it('should announce dismissal to screen readers', async () => {
      const { announceDismissal } = require('@/lib/notification-accessibility');
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const closeButton = screen.getByRole('button', { name: /chiudi notifica/i });
      await user.click(closeButton);

      expect(announceDismissal).toHaveBeenCalledWith(mockNotification.title);
    });

    it('should have proper focus management', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('tabIndex', '0');
      
      toast.focus();
      expect(toast).toHaveFocus();
    });
  });

  describe('Dynamic Positioning', () => {
    it('should use dynamic positioning when enabled', () => {
      const { useDynamicToastPositioner } = require('@/components/notifications/dynamic-toast-positioner');
      const mockRegisterToast = vi.fn();
      const mockUnregisterToast = vi.fn();

      useDynamicToastPositioner.mockReturnValue({
        registerToast: mockRegisterToast,
        unregisterToast: mockUnregisterToast
      });

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
          enableDynamicPositioning={true}
        />
      );

      expect(mockRegisterToast).toHaveBeenCalledWith(
        mockNotification.id,
        expect.any(HTMLElement),
        'normal'
      );
    });

    it('should use custom position when provided', () => {
      const customPosition = { x: 200, y: 300 };

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
          customPosition={customPosition}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast).toHaveStyle({
        left: '200px',
        top: '300px'
      });
    });
  });

  describe('Icon Handling', () => {
    it('should render custom icon when provided', () => {
      const notificationWithIcon = {
        ...mockNotification,
        icon: '/test-icon.png'
      };

      render(
        <NotificationToast
          notification={notificationWithIcon}
          onDismiss={mockOnDismiss}
        />
      );

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('src', '/test-icon.png');
    });

    it('should fallback to default icon when custom icon fails to load', () => {
      const notificationWithIcon = {
        ...mockNotification,
        icon: '/invalid-icon.png'
      };

      render(
        <NotificationToast
          notification={notificationWithIcon}
          onDismiss={mockOnDismiss}
        />
      );

      const icon = screen.getByRole('img');
      fireEvent.error(icon);

      // Verifica che l'icona predefinita sia visibile
      expect(screen.getByLabelText(/system notification/i)).toBeInTheDocument();
    });
  });

  describe('Animation States', () => {
    it('should handle animation states correctly', () => {
      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      const toast = screen.getByRole('alert');

      // Inizialmente dovrebbe essere nascosto
      expect(toast).toHaveClass('opacity-0');

      // Dopo il delay dovrebbe essere visibile
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(toast).toHaveClass('opacity-100');
    });

    it('should respect reduced motion preferences', () => {
      const { prefersReducedMotion } = require('@/lib/notification-accessibility');
      prefersReducedMotion.mockReturnValue(true);

      render(
        <NotificationToast
          notification={mockNotification}
          onDismiss={mockOnDismiss}
        />
      );

      // Verifica che le animazioni siano ridotte quando l'utente lo preferisce
      expect(prefersReducedMotion).toHaveBeenCalled();
    });
  });
});