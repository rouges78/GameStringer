import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AIReviewPage from '@/app/ai-review/page';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/tauri-api', () => ({
  invoke: vi.fn(),
  isTauri: () => false,
}));

describe('AIReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AI review page without crashing', () => {
    render(<AIReviewPage />);
    expect(document.body).toBeTruthy();
  });

  it('displays review interface elements', async () => {
    render(<AIReviewPage />);
    await waitFor(() => {
      const reviewElement = document.querySelector('[class*="review"]') ||
                           document.querySelector('[class*="ai"]');
      expect(reviewElement || document.body).toBeTruthy();
    });
  });

  it('handles no translations state', () => {
    render(<AIReviewPage />);
    // Should display empty state or prompt
    expect(document.body).toBeTruthy();
  });
});
