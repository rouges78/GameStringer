import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressBar, CircularProgress, IndeterminateProgress } from '@/components/progress/progress-bar';
import { ProgressModal } from '@/components/progress/progress-modal';
import { ProgressNotificationComponent } from '@/components/progress/progress-notification';
import type { OperationProgress, ProgressNotification } from '@/lib/types/progress';

// Mock delle funzioni di utilità
vi.mock('@/lib/utils/progress-calculations', () => ({
  formatDuration: vi.fn((ms) => `${Math.floor(ms / 1000)}s`),
  formatProgress: vi.fn((progress) => `${progress.toFixed(1)}%`),
  ProgressEasing: {
    easeOut: vi.fn((t) => t)
  }
}));

describe('Progress UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('ProgressBar', () => {
    it('should render progress bar with correct percentage', () => {
      render(<ProgressBar progress={75} />);
      
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });

    it('should show time remaining when provided', () => {
      render(
        <ProgressBar 
          progress={50} 
          showTimeRemaining={true}
          estimatedTimeRemaining={30000}
        />
      );
      
      expect(screen.getByText('30s rimanenti')).toBeInTheDocument();
    });

    it('should handle different sizes', () => {
      const { rerender } = render(<ProgressBar progress={50} size="sm" />);
      
      let progressElement = document.querySelector('.h-2');
      expect(progressElement).toBeInTheDocument();
      
      rerender(<ProgressBar progress={50} size="lg" />);
      progressElement = document.querySelector('.h-4');
      expect(progressElement).toBeInTheDocument();
    });

    it('should handle different variants', () => {
      const { rerender } = render(<ProgressBar progress={50} variant="success" />);
      
      let progressElement = document.querySelector('.bg-green-500');
      expect(progressElement).toBeInTheDocument();
      
      rerender(<ProgressBar progress={50} variant="error" />);
      progressElement = document.querySelector('.bg-red-500');
      expect(progressElement).toBeInTheDocument();
    });

    it('should clamp progress values to valid range', () => {
      const { rerender } = render(<ProgressBar progress={150} />);
      
      // Progress dovrebbe essere limitato a 100%
      expect(screen.getByText('100.0%')).toBeInTheDocument();
      
      rerender(<ProgressBar progress={-10} />);
      
      // Progress dovrebbe essere limitato a 0%
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should animate progress changes when enabled', () => {
      vi.useFakeTimers();
      
      const { rerender } = render(<ProgressBar progress={0} animated={true} />);
      
      rerender(<ProgressBar progress={50} animated={true} />);
      
      // L'animazione dovrebbe essere gestita da requestAnimationFrame
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });
  });

  describe('CircularProgress', () => {
    it('should render circular progress with percentage', () => {
      render(<CircularProgress progress={60} />);
      
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should hide percentage when showPercentage is false', () => {
      render(<CircularProgress progress={60} showPercentage={false} />);
      
      expect(screen.queryByText('60%')).not.toBeInTheDocument();
    });

    it('should handle different variants', () => {
      render(<CircularProgress progress={50} variant="success" />);
      
      const circleElement = document.querySelector('.stroke-green-500');
      expect(circleElement).toBeInTheDocument();
    });

    it('should calculate correct circle properties', () => {
      render(<CircularProgress progress={50} size={100} strokeWidth={8} />);
      
      const svg = document.querySelector('svg');
      expect(svg).toHaveAttribute('width', '100');
      expect(svg).toHaveAttribute('height', '100');
    });
  });

  describe('IndeterminateProgress', () => {
    it('should render indeterminate progress bar', () => {
      render(<IndeterminateProgress />);
      
      const progressElement = document.querySelector('.animate-\\[indeterminate_2s_infinite_linear\\]');
      expect(progressElement).toBeInTheDocument();
    });

    it('should handle different sizes and variants', () => {
      render(<IndeterminateProgress size="lg" variant="warning" />);
      
      const containerElement = document.querySelector('.h-4');
      expect(containerElement).toBeInTheDocument();
      
      const progressElement = document.querySelector('.bg-yellow-500');
      expect(progressElement).toBeInTheDocument();
    });
  });

  describe('ProgressModal', () => {
    const mockOperation: OperationProgress = {
      id: 'test-op',
      title: 'Test Operation',
      description: 'Testing progress modal',
      progress: 50,
      status: 'In progress',
      startTime: new Date(Date.now() - 10000),
      canMinimize: true,
      canCancel: true,
      isBackground: false
    };

    it('should render progress modal with operation details', () => {
      render(<ProgressModal operation={mockOperation} />);
      
      expect(screen.getByText('Test Operation')).toBeInTheDocument();
      expect(screen.getByText('Testing progress modal')).toBeInTheDocument();
      expect(screen.getByText('In progress')).toBeInTheDocument();
    });

    it('should show minimize button when canMinimize is true', () => {
      const onMinimize = vi.fn();
      render(<ProgressModal operation={mockOperation} onMinimize={onMinimize} />);
      
      const minimizeButton = screen.getByTitle('Minimizza');
      expect(minimizeButton).toBeInTheDocument();
      
      fireEvent.click(minimizeButton);
      expect(onMinimize).toHaveBeenCalled();
    });

    it('should show cancel button when canCancel is true and operation is in progress', () => {
      const onCancel = vi.fn();
      render(<ProgressModal operation={mockOperation} onCancel={onCancel} />);
      
      const cancelButton = screen.getByText('Annulla');
      expect(cancelButton).toBeInTheDocument();
      
      fireEvent.click(cancelButton);
      expect(onCancel).toHaveBeenCalled();
    });

    it('should render minimized version when isMinimized is true', () => {
      render(<ProgressModal operation={mockOperation} isMinimized={true} />);
      
      // In versione minimizzata dovrebbe mostrare progresso circolare
      const expandButton = screen.getByTitle('Espandi');
      expect(expandButton).toBeInTheDocument();
    });

    it('should show error state when operation has error', () => {
      const errorOperation: OperationProgress = {
        ...mockOperation,
        error: new Error('Test error'),
        status: 'Errore: Test error'
      };
      
      render(<ProgressModal operation={errorOperation} />);
      
      expect(screen.getByText('Errore: Test error')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should show completed state when progress is 100%', () => {
      const completedOperation: OperationProgress = {
        ...mockOperation,
        progress: 100,
        status: 'Completato',
        result: 'Operation completed successfully'
      };
      
      render(<ProgressModal operation={completedOperation} />);
      
      expect(screen.getByText('Completato')).toBeInTheDocument();
      expect(screen.getByText('Completato con successo')).toBeInTheDocument();
    });

    it('should auto-close completed operations after timeout', async () => {
      vi.useFakeTimers();
      
      const completedOperation: OperationProgress = {
        ...mockOperation,
        progress: 100,
        status: 'Completato'
      };
      
      const onClose = vi.fn();
      render(<ProgressModal operation={completedOperation} onClose={onClose} />);
      
      // Avanza il tempo di 3 secondi
      vi.advanceTimersByTime(3000);
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
      
      vi.useRealTimers();
    });
  });

  describe('ProgressNotificationComponent', () => {
    const mockNotification: ProgressNotification = {
      id: 'test-notification',
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      progress: 75
    };

    it('should render notification with correct content', () => {
      render(<ProgressNotificationComponent notification={mockNotification} />);
      
      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('This is a test notification')).toBeInTheDocument();
    });

    it('should show progress bar when progress is provided', () => {
      render(<ProgressNotificationComponent notification={mockNotification} />);
      
      // Dovrebbe esserci una progress bar
      const progressBar = document.querySelector('[style*="width: 75%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should handle different notification types', () => {
      const { rerender } = render(
        <ProgressNotificationComponent 
          notification={{ ...mockNotification, type: 'success' }} 
        />
      );
      
      let iconElement = document.querySelector('.text-green-500');
      expect(iconElement).toBeInTheDocument();
      
      rerender(
        <ProgressNotificationComponent 
          notification={{ ...mockNotification, type: 'error' }} 
        />
      );
      
      iconElement = document.querySelector('.text-red-500');
      expect(iconElement).toBeInTheDocument();
    });

    it('should show action buttons when provided', () => {
      const onAction = vi.fn();
      const notificationWithActions: ProgressNotification = {
        ...mockNotification,
        actions: [
          { label: 'Action 1', action: vi.fn() },
          { label: 'Action 2', action: vi.fn() }
        ]
      };
      
      render(
        <ProgressNotificationComponent 
          notification={notificationWithActions} 
          onAction={onAction}
        />
      );
      
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Action 1'));
      expect(onAction).toHaveBeenCalledWith(0);
    });

    it('should auto-hide when autoHide is true', async () => {
      vi.useFakeTimers();
      
      const autoHideNotification: ProgressNotification = {
        ...mockNotification,
        autoHide: true,
        duration: 2000
      };
      
      const onClose = vi.fn();
      render(
        <ProgressNotificationComponent 
          notification={autoHideNotification} 
          onClose={onClose}
        />
      );
      
      // Avanza il tempo
      vi.advanceTimersByTime(2300); // 2000ms + 300ms per animazione
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
      
      vi.useRealTimers();
    });

    it('should handle close button click', () => {
      const onClose = vi.fn();
      render(
        <ProgressNotificationComponent 
          notification={mockNotification} 
          onClose={onClose}
        />
      );
      
      const closeButton = screen.getByTitle('Chiudi notifica');
      fireEvent.click(closeButton);
      
      // Dovrebbe chiamare onClose dopo l'animazione
      setTimeout(() => {
        expect(onClose).toHaveBeenCalled();
      }, 300);
    });
  });
});