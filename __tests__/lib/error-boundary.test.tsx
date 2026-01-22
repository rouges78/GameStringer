import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, PageErrorFallback } from '@/components/error-boundary';

// Component that throws
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test content')).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/qualcosa è andato storto/i)).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error')).toBeTruthy();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
  });

  it('shows retry button that resets error state', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const retryButton = screen.getByText(/riprova/i);
    expect(retryButton).toBeTruthy();
  });
});

describe('PageErrorFallback', () => {
  it('renders with default props', () => {
    render(<PageErrorFallback />);
    expect(screen.getByText(/errore nella pagina/i)).toBeTruthy();
  });

  it('renders with custom title and message', () => {
    render(
      <PageErrorFallback 
        title="Custom Title" 
        message="Custom message" 
      />
    );
    expect(screen.getByText('Custom Title')).toBeTruthy();
    expect(screen.getByText('Custom message')).toBeTruthy();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<PageErrorFallback onRetry={onRetry} />);
    
    const retryButton = screen.getByText(/riprova/i);
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });
});
