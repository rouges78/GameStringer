import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TutorialProvider, useTutorial } from '@/components/tutorial/tutorial-provider';
import { TutorialConfig } from '@/lib/types/tutorial';
import { TutorialDatabase } from '@/lib/utils/database';

// Mock dependencies
vi.mock('@/lib/utils/database', () => ({
  TutorialDatabase: {
    updateProgress: vi.fn(),
    markTutorialSkipped: vi.fn(),
    getUserProgress: vi.fn()
  }
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Test tutorial configuration
const mockTutorial: TutorialConfig = {
  id: 'test-tutorial',
  name: 'Test Tutorial',
  description: 'A test tutorial',
  canSkip: true,
  showProgress: true,
  steps: [
    {
      id: 'step-1',
      title: 'Step 1',
      description: 'First step',
      target: '#test-element',
      position: 'bottom'
    },
    {
      id: 'step-2',
      title: 'Step 2',
      description: 'Second step',
      target: '#test-element-2',
      position: 'top',
      optional: true
    },
    {
      id: 'step-3',
      title: 'Step 3',
      description: 'Final step',
      target: '#test-element-3',
      position: 'right',
      validation: () => true
    }
  ]
};

// Test component that uses the tutorial context
function TestComponent() {
  const {
    state,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    skipStep,
    completeTutorial,
    restartTutorial,
    setCurrentStep,
    isStepValid
  } = useTutorial();

  return (
    <div>
      <div data-testid="tutorial-active">{state.isActive.toString()}</div>
      <div data-testid="current-step">{state.currentStep}</div>
      <div data-testid="total-steps">{state.steps.length}</div>
      <div data-testid="completed">{state.completed.toString()}</div>
      <div data-testid="can-skip">{state.canSkip.toString()}</div>
      <div data-testid="tutorial-id">{state.tutorialId}</div>
      <div data-testid="step-valid">{isStepValid().toString()}</div>
      
      <button onClick={() => startTutorial(mockTutorial)}>Start Tutorial</button>
      <button onClick={nextStep}>Next Step</button>
      <button onClick={previousStep}>Previous Step</button>
      <button onClick={skipTutorial}>Skip Tutorial</button>
      <button onClick={skipStep}>Skip Step</button>
      <button onClick={completeTutorial}>Complete Tutorial</button>
      <button onClick={restartTutorial}>Restart Tutorial</button>
      <button onClick={() => setCurrentStep(1)}>Set Step 1</button>
    </div>
  );
}

describe('TutorialProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide initial tutorial state', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('false');
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');
    expect(screen.getByTestId('total-steps')).toHaveTextContent('0');
    expect(screen.getByTestId('completed')).toHaveTextContent('false');
    expect(screen.getByTestId('can-skip')).toHaveTextContent('true');
    expect(screen.getByTestId('tutorial-id')).toHaveTextContent('');
  });

  it('should start tutorial correctly', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Start Tutorial'));

    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('true');
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');
    expect(screen.getByTestId('total-steps')).toHaveTextContent('3');
    expect(screen.getByTestId('tutorial-id')).toHaveTextContent('test-tutorial');
    expect(screen.getByTestId('can-skip')).toHaveTextContent('true');
  });

  it('should navigate through tutorial steps', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial
    fireEvent.click(screen.getByText('Start Tutorial'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');

    // Next step
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('1');

    // Previous step
    fireEvent.click(screen.getByText('Previous Step'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');

    // Set specific step
    fireEvent.click(screen.getByText('Set Step 1'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('1');
  });

  it('should complete tutorial on last step', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial and go to last step
    fireEvent.click(screen.getByText('Start Tutorial'));
    fireEvent.click(screen.getByText('Set Step 1'));
    fireEvent.click(screen.getByText('Next Step')); // Go to step 2 (last step)
    
    expect(screen.getByTestId('current-step')).toHaveTextContent('2');
    expect(screen.getByTestId('completed')).toHaveTextContent('false');

    // Complete tutorial by going to next step from last step
    fireEvent.click(screen.getByText('Next Step'));
    
    expect(screen.getByTestId('completed')).toHaveTextContent('true');
    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('false');
  });

  it('should skip tutorial', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial
    fireEvent.click(screen.getByText('Start Tutorial'));
    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('true');

    // Skip tutorial
    fireEvent.click(screen.getByText('Skip Tutorial'));
    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('false');
    expect(screen.getByTestId('completed')).toHaveTextContent('false');
  });

  it('should skip optional steps', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial and go to optional step (step 1)
    fireEvent.click(screen.getByText('Start Tutorial'));
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('1');

    // Skip optional step
    fireEvent.click(screen.getByText('Skip Step'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('2');
  });

  it('should restart tutorial', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial and advance
    fireEvent.click(screen.getByText('Start Tutorial'));
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('1');

    // Restart tutorial
    fireEvent.click(screen.getByText('Restart Tutorial'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');
    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('true');
    expect(screen.getByTestId('completed')).toHaveTextContent('false');
  });

  it('should validate steps correctly', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial
    fireEvent.click(screen.getByText('Start Tutorial'));
    
    // Steps without validation should be valid
    expect(screen.getByTestId('step-valid')).toHaveTextContent('true');

    // Go to step with validation (step 2)
    fireEvent.click(screen.getByText('Set Step 1'));
    fireEvent.click(screen.getByText('Next Step'));
    expect(screen.getByTestId('step-valid')).toHaveTextContent('true');
  });

  it('should save progress to database when userId provided', async () => {
    const mockUpdateProgress = vi.mocked(TutorialDatabase.updateProgress);
    
    render(
      <TutorialProvider userId="test-user">
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial
    fireEvent.click(screen.getByText('Start Tutorial'));
    
    // Advance step
    fireEvent.click(screen.getByText('Next Step'));

    await waitFor(() => {
      expect(mockUpdateProgress).toHaveBeenCalledWith(
        'test-user',
        'test-tutorial',
        1,
        false
      );
    });
  });

  it('should mark tutorial as skipped in database', async () => {
    const mockMarkSkipped = vi.mocked(TutorialDatabase.markTutorialSkipped);
    
    render(
      <TutorialProvider userId="test-user">
        <TestComponent />
      </TutorialProvider>
    );

    // Start and skip tutorial
    fireEvent.click(screen.getByText('Start Tutorial'));
    fireEvent.click(screen.getByText('Skip Tutorial'));

    await waitFor(() => {
      expect(mockMarkSkipped).toHaveBeenCalledWith('test-user', 'test-tutorial');
    });
  });

  it('should handle keyboard navigation', () => {
    render(
      <TutorialProvider>
        <TestComponent />
      </TutorialProvider>
    );

    // Start tutorial
    fireEvent.click(screen.getByText('Start Tutorial'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');

    // Test right arrow key
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByTestId('current-step')).toHaveTextContent('1');

    // Test left arrow key
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByTestId('current-step')).toHaveTextContent('0');

    // Test Enter key
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByTestId('current-step')).toHaveTextContent('1');

    // Test Escape key (skip tutorial)
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('tutorial-active')).toHaveTextContent('false');
  });

  it('should load user progress on mount', async () => {
    const mockGetUserProgress = vi.mocked(TutorialDatabase.getUserProgress);
    mockGetUserProgress.mockResolvedValue({
      userId: 'test-user',
      completedTutorials: ['other-tutorial'],
      preferences: {
        showHints: true,
        autoAdvance: false,
        skipAnimations: true
      }
    });

    render(
      <TutorialProvider userId="test-user">
        <TestComponent />
      </TutorialProvider>
    );

    await waitFor(() => {
      expect(mockGetUserProgress).toHaveBeenCalledWith('test-user');
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTutorial must be used within a TutorialProvider');

    consoleSpy.mockRestore();
  });
});