import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';
import { TutorialOverlay } from '@/components/tutorial/tutorial-overlay';
import { TutorialMenu } from '@/components/tutorial/tutorial-menu';
import { useTutorialTrigger } from '@/hooks/use-tutorial-trigger';
import { dashboardTutorial } from '@/lib/tutorial-configs';

// Mock dependencies
vi.mock('@/lib/utils/database', () => ({
  TutorialDatabase: {
    updateProgress: vi.fn(),
    markTutorialSkipped: vi.fn(),
    getUserProgress: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/lib/utils/ux-enhancements', () => ({
  createSystemEvent: vi.fn(),
  elementExists: vi.fn().mockReturnValue(true),
  getElementPosition: vi.fn().mockReturnValue({
    top: 100,
    left: 100,
    width: 200,
    height: 50
  }),
  scrollToElement: vi.fn(),
  prefersReducedMotion: vi.fn().mockReturnValue(false),
  LocalStorage: {
    get: vi.fn().mockReturnValue(false),
    set: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/'
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Test component that integrates tutorial system
function IntegratedTutorialApp() {
  const { startSpecificTutorial } = useTutorialTrigger({ autoStart: false });

  return (
    <TutorialProvider userId="test-user">
      <div>
        <h1>GameStringer Dashboard</h1>
        <TutorialMenu userId="test-user" />
        <TutorialOverlay />
        
        {/* Mock elements that tutorials target */}
        <aside data-testid="sidebar">Sidebar</aside>
        <a href="/library" data-testid="library-link">Library</a>
        <a href="/injekt-translator" data-testid="translator-link">Neural Translator</a>
        <a href="/editor" data-testid="editor-link">Editor</a>
        <a href="/patches" data-testid="patches-link">Patches</a>
        <a href="/settings" data-testid="settings-link">Settings</a>
        <div data-testid="system-status">System Status</div>
        
        <button onClick={() => startSpecificTutorial('dashboard-intro')}>
          Start Dashboard Tutorial
        </button>
      </div>
    </TutorialProvider>
  );
}

describe('Tutorial System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock DOM elements for tutorial targets
    document.body.innerHTML = `
      <div id="root">
        <aside></aside>
        <a href="/library"></a>
        <a href="/injekt-translator"></a>
        <a href="/editor"></a>
        <a href="/patches"></a>
        <a href="/settings"></a>
        <div data-testid="system-status"></div>
      </div>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('should render tutorial system components without errors', () => {
    render(<IntegratedTutorialApp />);
    
    expect(screen.getByText('GameStringer Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Start Dashboard Tutorial')).toBeInTheDocument();
  });

  it('should start tutorial and show overlay', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    // Should show tutorial overlay elements
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });
  });

  it('should navigate through tutorial steps', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Find and click next button
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    });
  });

  it('should show tutorial menu with available tutorials', () => {
    render(<IntegratedTutorialApp />);
    
    // Tutorial menu should be present
    const tutorialButton = screen.getByRole('button', { name: /tutorials/i });
    expect(tutorialButton).toBeInTheDocument();
  });

  it('should handle tutorial completion', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    // Navigate to last step (simulate)
    for (let i = 0; i < dashboardTutorial.steps.length - 1; i++) {
      const nextButton = screen.getByText(i === dashboardTutorial.steps.length - 2 ? 'Complete' : 'Next');
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        const stepText = `Step ${i + 2} of ${dashboardTutorial.steps.length}`;
        if (i < dashboardTutorial.steps.length - 2) {
          expect(screen.getByText(stepText)).toBeInTheDocument();
        }
      });
    }
    
    // Tutorial should be completed and overlay hidden
    await waitFor(() => {
      expect(screen.queryByText(/Step \d+ of \d+/)).not.toBeInTheDocument();
    });
  });

  it('should handle tutorial skip functionality', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Skip tutorial
    const skipButton = screen.getByText('Skip Tutorial');
    fireEvent.click(skipButton);
    
    // Tutorial should be hidden
    await waitFor(() => {
      expect(screen.queryByText(/Step \d+ of \d+/)).not.toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Test right arrow key navigation
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    });

    // Test left arrow key navigation
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Test escape key to skip
    fireEvent.keyDown(document, { key: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByText(/Step \d+ of \d+/)).not.toBeInTheDocument();
    });
  });

  it('should show progress bar correctly', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Progress bar should be visible and show correct progress
    const progressElements = screen.getAllByText(/Step \d+ of \d+/);
    expect(progressElements.length).toBeGreaterThan(0);
  });

  it('should handle tutorial restart', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial and advance
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Advance to step 2
    fireEvent.click(screen.getByText('Next'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    });

    // Skip tutorial to end it
    fireEvent.click(screen.getByText('Skip Tutorial'));
    
    // Restart tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });
  });

  it('should handle missing tutorial targets gracefully', async () => {
    // Remove some target elements
    document.querySelector('aside')?.remove();
    
    render(<IntegratedTutorialApp />);
    
    // Start tutorial - should not crash even with missing targets
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Should be able to navigate even with missing targets
    fireEvent.click(screen.getByText('Next'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    });
  });

  it('should prevent multiple tutorials from running simultaneously', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start first tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Try to start another tutorial - should not work
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    // Should still be on step 1 of the original tutorial
    expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
  });

  it('should handle window resize during tutorial', async () => {
    render(<IntegratedTutorialApp />);
    
    // Start tutorial
    fireEvent.click(screen.getByText('Start Dashboard Tutorial'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    });

    // Simulate window resize
    fireEvent(window, new Event('resize'));
    
    // Tutorial should still be visible and functional
    expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    
    // Should still be able to navigate
    fireEvent.click(screen.getByText('Next'));
    
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    });
  });
});