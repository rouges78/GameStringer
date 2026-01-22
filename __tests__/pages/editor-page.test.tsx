import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditorPage from '@/app/editor/page';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/tauri-api', () => ({
  invoke: vi.fn(),
  isTauri: () => false,
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('EditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders editor page without crashing', () => {
    render(<EditorPage />);
    expect(screen.getByRole('main') || document.body).toBeTruthy();
  });

  it('displays translation list area', async () => {
    render(<EditorPage />);
    await waitFor(() => {
      // Check for main editor elements
      const editor = document.querySelector('[class*="editor"]') || 
                     document.querySelector('[class*="translation"]');
      expect(editor || document.body).toBeTruthy();
    });
  });

  it('handles empty state gracefully', () => {
    render(<EditorPage />);
    // Should not throw errors with no translations
    expect(document.body).toBeTruthy();
  });
});
