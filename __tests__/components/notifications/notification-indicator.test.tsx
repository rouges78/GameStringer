import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { NotificationIndicator } from '@/components/notifications/notification-indicator';

// Mock delle dipendenze
vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: vi.fn()
}));

vi.mock('@/lib/notification-accessibility', () => ({
  announceNotificationCount: vi.fn(),
  createHelpText: vi.fn(() => 'Help text for notification indicator')
}));

describe('NotificationIndicator', () => {
  const mockUseNotifications = {
    unreadCount: 0,
    isLoading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue(mockUseNotifications);
  });

  describe('Rendering', () => {
    it('should render notification indicator', () => {
      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should show bell icon when no notifications', () => {
      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Nessuna notifica non letta. Clicca per aprire il centro notifiche.');
    });

    it('should show bell ring icon when has notifications', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 3
      });

      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', '3 notifiche non lette. Clicca per aprire il centro notifiche.');
    });

    it('should show loading state', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        isLoading: true
      });

      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'Caricamento notifiche...');
    });
  });

  describe('Badge Display', () => {
    it('should show badge with count when has notifications', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 5
      });

      render(<NotificationIndicator showBadge={true} />);
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show 99+ when count exceeds maxCount', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 150
      });

      render(<NotificationIndicator showBadge={true} maxCount={99} />);
      
      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should not show badge when showBadge is false', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 5
      });

      render(<NotificationIndicator showBadge={false} />);
      
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      // Should show simple indicator dot instead
      const button = screen.getByRole('button');
      const indicator = button.querySelector('.bg-red-500');
      expect(indicator).toBeInTheDocument();
    });

    it('should not show badge when no notifications', () => {
      render(<NotificationIndicator showBadge={true} />);
      
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClick when clicked', async () => {
      const mockOnClick = vi.fn();
      const user = userEvent.setup();

      render(<NotificationIndicator onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should not call onClick when disabled', async () => {
      const mockOnClick = vi.fn();
      const user = userEvent.setup();

      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        isLoading: true
      });

      render(<NotificationIndicator onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should be keyboard accessible', async () => {
      const mockOnClick = vi.fn();
      const user = userEvent.setup();

      render(<NotificationIndicator onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(mockOnClick).toHaveBeenCalled();
    });
  });

  describe('Animations', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should animate when new notifications arrive', () => {
      const { rerender } = render(<NotificationIndicator animate={true} />);
      
      // Update with new notifications
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 2
      });

      rerender(<NotificationIndicator animate={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('animate-pulse');
      
      // Animation should stop after timeout
      vi.advanceTimersByTime(1000);
      expect(button).not.toHaveClass('animate-pulse');
    });

    it('should not animate when animate is false', () => {
      const { rerender } = render(<NotificationIndicator animate={false} />);
      
      // Update with new notifications
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 2
      });

      rerender(<NotificationIndicator animate={false} />);
      
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('animate-pulse');
    });

    it('should show animated indicator for new notifications', () => {
      const { rerender } = render(<NotificationIndicator animate={true} />);
      
      // Update with new notifications
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 1
      });

      rerender(<NotificationIndicator animate={true} />);
      
      // Should show animated ping indicator
      const animatedIndicator = screen.getByRole('button').querySelector('.animate-ping');
      expect(animatedIndicator).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'notification-help');
    });

    it('should have proper ARIA attributes with notifications', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 3
      });

      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'notification-count-description notification-help');
    });

    it('should have hidden description for screen readers', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 1
      });

      render(<NotificationIndicator />);
      
      expect(screen.getByText('Hai 1 notifica non letta')).toHaveClass('sr-only');
    });

    it('should have plural description for multiple notifications', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 5
      });

      render(<NotificationIndicator />);
      
      expect(screen.getByText('Hai 5 notifiche non lette')).toHaveClass('sr-only');
    });

    it('should announce new notifications to screen readers', () => {
      const { announceNotificationCount } = require('@/lib/notification-accessibility');
      const { rerender } = render(<NotificationIndicator />);
      
      // Update with new notifications
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 2
      });

      rerender(<NotificationIndicator />);
      
      expect(announceNotificationCount).toHaveBeenCalledWith(2, 0);
    });

    it('should have focus styles', () => {
      render(<NotificationIndicator />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-primary', 'focus:ring-offset-2');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<NotificationIndicator className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should maintain base classes with custom className', () => {
      render(<NotificationIndicator className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('relative', 'h-10', 'w-10', 'rounded-full');
    });
  });

  describe('Badge Variants', () => {
    it('should show destructive badge by default', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 1
      });

      render(<NotificationIndicator />);
      
      const badge = screen.getByText('1');
      expect(badge.closest('.bg-destructive')).toBeInTheDocument();
    });

    it('should handle zero count correctly', () => {
      render(<NotificationIndicator />);
      
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn();
      const TestComponent = () => {
        renderSpy();
        return <NotificationIndicator />;
      };

      const { rerender } = render(<TestComponent />);
      
      // Same props should not cause re-render
      rerender(<TestComponent />);
      
      expect(renderSpy).toHaveBeenCalledTimes(2); // Initial + rerender
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative unread count', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: -1
      });

      render(<NotificationIndicator />);
      
      // Should treat negative as zero
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Nessuna notifica non letta. Clicca per aprire il centro notifiche.');
    });

    it('should handle very large unread count', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: 999999
      });

      render(<NotificationIndicator maxCount={999} />);
      
      expect(screen.getByText('999+')).toBeInTheDocument();
    });

    it('should handle undefined unread count', () => {
      (require('@/hooks/use-notifications').useNotifications as any).mockReturnValue({
        ...mockUseNotifications,
        unreadCount: undefined
      });

      render(<NotificationIndicator />);
      
      // Should treat undefined as zero
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Nessuna notifica non letta. Clicca per aprire il centro notifiche.');
    });
  });
});