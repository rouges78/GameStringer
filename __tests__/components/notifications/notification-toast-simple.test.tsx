import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('NotificationToast - Simple Tests', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('should render close button', () => {
    render(
      <NotificationToast
        notification={mockNotification}
        onDismiss={mockOnDismiss}
      />
    );

    const closeButton = screen.getByRole('button', { name: /chiudi notifica/i });
    expect(closeButton).toBeInTheDocument();
  });
});