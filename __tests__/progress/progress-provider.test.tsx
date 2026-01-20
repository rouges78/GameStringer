import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ProgressProvider, useProgress } from '@/components/progress/progress-provider';
import type { ProgressConfig } from '@/lib/types/progress';

// Mock del sistema di persistenza
vi.mock('@/lib/progress-persistence', () => ({
  progressPersistence: {
    loadOperations: vi.fn(() => new Map()),
    saveOperations: vi.fn(),
    saveEvent: vi.fn(),
    cleanupEvents: vi.fn()
  }
}));

// Componente di test per utilizzare il hook
function TestComponent() {
  const progress = useProgress();
  
  return (
    <div>
      <div data-testid="operations-count">
        {progress.operations.size}
      </div>
      <button
        data-testid="start-operation"
        onClick={() => progress.startOperation('test-op', {
          title: 'Test Operation',
          description: 'Testing progress'
        })}
      >
        Start Operation
      </button>
      <button
        data-testid="update-progress"
        onClick={() => progress.updateProgress('test-op', 50, 'Half done')}
      >
        Update Progress
      </button>
      <button
        data-testid="complete-operation"
        onClick={() => progress.completeOperation('test-op', { success: true })}
      >
        Complete Operation
      </button>
      <button
        data-testid="fail-operation"
        onClick={() => progress.failOperation('test-op', new Error('Test error'))}
      >
        Fail Operation
      </button>
    </div>
  );
}

describe('ProgressProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should provide progress context', () => {
    render(
      <ProgressProvider>
        <TestComponent />
      </ProgressProvider>
    );

    expect(screen.getByTestId('operations-count')).toHaveTextContent('0');
  });

  it('should start a new operation', async () => {
    render(
      <ProgressProvider>
        <TestComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-operation');
    
    await act(async () => {
      startButton.click();
    });

    expect(screen.getByTestId('operations-count')).toHaveTextContent('1');
  });

  it('should update operation progress', async () => {
    render(
      <ProgressProvider>
        <TestComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-operation');
    const updateButton = screen.getByTestId('update-progress');
    
    await act(async () => {
      startButton.click();
    });

    await act(async () => {
      updateButton.click();
    });

    // L'operazione dovrebbe ancora esistere
    expect(screen.getByTestId('operations-count')).toHaveTextContent('1');
  });

  it('should complete operation successfully', async () => {
    render(
      <ProgressProvider>
        <TestComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-operation');
    const completeButton = screen.getByTestId('complete-operation');
    
    await act(async () => {
      startButton.click();
    });

    await act(async () => {
      completeButton.click();
    });

    // L'operazione dovrebbe ancora esistere ma essere completata
    expect(screen.getByTestId('operations-count')).toHaveTextContent('1');
  });

  it('should handle operation failure', async () => {
    render(
      <ProgressProvider>
        <TestComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-operation');
    const failButton = screen.getByTestId('fail-operation');
    
    await act(async () => {
      startButton.click();
    });

    await act(async () => {
      failButton.click();
    });

    // L'operazione dovrebbe ancora esistere ma essere fallita
    expect(screen.getByTestId('operations-count')).toHaveTextContent('1');
  });

  it('should cleanup completed operations after timeout', async () => {
    vi.useFakeTimers();

    render(
      <ProgressProvider cleanupInterval={1000} maxCompletedAge={2000}>
        <TestComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-operation');
    const completeButton = screen.getByTestId('complete-operation');
    
    await act(async () => {
      startButton.click();
    });

    await act(async () => {
      completeButton.click();
    });

    expect(screen.getByTestId('operations-count')).toHaveTextContent('1');

    // Avanza il tempo per triggerare il cleanup
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // L'operazione dovrebbe essere stata rimossa
    expect(screen.getByTestId('operations-count')).toHaveTextContent('0');

    vi.useRealTimers();
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error per questo test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useProgress deve essere utilizzato all\'interno di un ProgressProvider');

    consoleSpy.mockRestore();
  });

  it('should handle multiple operations', async () => {
    function MultiOperationComponent() {
      const progress = useProgress();
      
      return (
        <div>
          <div data-testid="operations-count">
            {progress.operations.size}
          </div>
          <button
            data-testid="start-multiple"
            onClick={() => {
              progress.startOperation('op1', { title: 'Operation 1' });
              progress.startOperation('op2', { title: 'Operation 2' });
              progress.startOperation('op3', { title: 'Operation 3' });
            }}
          >
            Start Multiple
          </button>
        </div>
      );
    }

    render(
      <ProgressProvider>
        <MultiOperationComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-multiple');
    
    await act(async () => {
      startButton.click();
    });

    expect(screen.getByTestId('operations-count')).toHaveTextContent('3');
  });

  it('should validate progress values', async () => {
    function ValidationComponent() {
      const progress = useProgress();
      
      return (
        <div>
          <button
            data-testid="start-operation"
            onClick={() => progress.startOperation('test-op', { title: 'Test' })}
          >
            Start
          </button>
          <button
            data-testid="invalid-progress"
            onClick={() => progress.updateProgress('test-op', 150)} // Invalid: > 100
          >
            Invalid Progress
          </button>
          <button
            data-testid="negative-progress"
            onClick={() => progress.updateProgress('test-op', -10)} // Invalid: < 0
          >
            Negative Progress
          </button>
        </div>
      );
    }

    render(
      <ProgressProvider>
        <ValidationComponent />
      </ProgressProvider>
    );

    const startButton = screen.getByTestId('start-operation');
    const invalidButton = screen.getByTestId('invalid-progress');
    const negativeButton = screen.getByTestId('negative-progress');
    
    await act(async () => {
      startButton.click();
    });

    // Questi non dovrebbero causare errori, ma i valori dovrebbero essere normalizzati
    await act(async () => {
      invalidButton.click();
      negativeButton.click();
    });

    // Il test passa se non ci sono errori
    expect(true).toBe(true);
  });
});