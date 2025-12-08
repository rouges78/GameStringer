import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemorySuggestions } from '@/components/translation-memory/memory-suggestions';
import { TranslationMemoryProvider } from '@/components/translation-memory/translation-memory-provider';
import type { MemorySuggestion, GlossaryEntry } from '@/lib/types/translation-memory';

// Mock the translation memory hook
const mockUseTranslationMemory = {
  searchMemory: vi.fn(),
  getExactMatches: vi.fn(),
  searchGlossary: vi.fn(),
  incrementUsage: vi.fn(),
  isLoading: false
};

vi.mock('@/components/translation-memory/translation-memory-provider', async () => {
  const actual = await vi.importActual('@/components/translation-memory/translation-memory-provider');
  return {
    ...actual,
    useTranslationMemory: () => mockUseTranslationMemory
  };
});

// Mock the fuzzy search utilities
vi.mock('@/lib/utils/fuzzy-search', () => ({
  highlightMatches: vi.fn((text: string, query: string) => [
    { text, isMatch: text.toLowerCase().includes(query.toLowerCase()) }
  ])
}));

describe('MemorySuggestions', () => {
  const defaultProps = {
    sourceText: 'Hello world',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    projectId: 'project-1'
  };

  const mockSuggestions: MemorySuggestion[] = [
    {
      id: 'suggestion-1',
      sourceText: 'Hello world',
      targetText: 'Hola mundo',
      confidence: 0.95,
      similarity: 1.0,
      usageCount: 10,
      lastUsed: new Date(),
      type: 'exact'
    },
    {
      id: 'suggestion-2',
      sourceText: 'Hello there',
      targetText: 'Hola ahí',
      confidence: 0.8,
      similarity: 0.7,
      usageCount: 5,
      lastUsed: new Date(),
      type: 'fuzzy'
    }
  ];

  const mockGlossaryTerms: GlossaryEntry[] = [
    {
      id: 'term-1',
      term: 'Hello',
      translation: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      approved: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTranslationMemory.searchMemory.mockResolvedValue(mockSuggestions);
    mockUseTranslationMemory.getExactMatches.mockResolvedValue([mockSuggestions[0]]);
    mockUseTranslationMemory.searchGlossary.mockResolvedValue(mockGlossaryTerms);
    mockUseTranslationMemory.incrementUsage.mockResolvedValue();
  });

  it('should render empty state for short text', () => {
    render(<MemorySuggestions {...defaultProps} sourceText="Hi" />);
    
    expect(screen.getByText('Enter text to see translation suggestions')).toBeInTheDocument();
  });

  it('should search for suggestions when text is provided', async () => {
    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(mockUseTranslationMemory.searchMemory).toHaveBeenCalledWith(
        'Hello world',
        'en',
        'es',
        expect.objectContaining({
          threshold: 0.3,
          maxResults: 5,
          projectId: 'project-1',
          includeContext: true,
          preferRecent: true
        })
      );
    });
  });

  it('should display memory suggestions', async () => {
    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Translation Memory')).toBeInTheDocument();
      expect(screen.getByText('Hola mundo')).toBeInTheDocument();
      expect(screen.getByText('Hola ahí')).toBeInTheDocument();
    });
  });

  it('should show exact match badge for exact matches', async () => {
    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Exact Match')).toBeInTheDocument();
    });
  });

  it('should show similarity percentage for fuzzy matches', async () => {
    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('70% Similar')).toBeInTheDocument();
    });
  });

  it('should display confidence scores', async () => {
    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Excellent')).toBeInTheDocument(); // 95% confidence
      expect(screen.getByText('Good')).toBeInTheDocument(); // 80% confidence
    });
  });

  it('should show usage count', async () => {
    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('10 uses')).toBeInTheDocument();
      expect(screen.getByText('5 uses')).toBeInTheDocument();
    });
  });

  it('should call onSuggestionApply when Apply button is clicked', async () => {
    const mockOnApply = vi.fn();
    render(<MemorySuggestions {...defaultProps} onSuggestionApply={mockOnApply} />);

    await waitFor(() => {
      expect(screen.getAllByText('Apply')).toHaveLength(2);
    });

    const applyButtons = screen.getAllByText('Apply');
    await userEvent.click(applyButtons[0]);

    await waitFor(() => {
      expect(mockOnApply).toHaveBeenCalledWith('Hola mundo');
      expect(mockUseTranslationMemory.incrementUsage).toHaveBeenCalledWith('suggestion-1');
    });
  });

  it('should call onSuggestionSelect when suggestion is selected', async () => {
    const mockOnSelect = vi.fn();
    render(<MemorySuggestions {...defaultProps} onSuggestionSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText('Apply')).toHaveLength(2);
    });

    const applyButtons = screen.getAllByText('Apply');
    await userEvent.click(applyButtons[0]);

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'suggestion-1',
          targetText: 'Hola mundo'
        }),
        'memory'
      );
    });
  });

  it('should display glossary terms when enabled', async () => {
    render(<MemorySuggestions {...defaultProps} showGlossary={true} />);

    await waitFor(() => {
      expect(screen.getByText('Glossary Terms')).toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hola')).toBeInTheDocument();
    });
  });

  it('should not display glossary when disabled', async () => {
    render(<MemorySuggestions {...defaultProps} showGlossary={false} />);

    await waitFor(() => {
      expect(screen.queryByText('Glossary Terms')).not.toBeInTheDocument();
    });
  });

  it('should show approved badge for approved glossary terms', async () => {
    render(<MemorySuggestions {...defaultProps} showGlossary={true} />);

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });
  });

  it('should handle glossary term selection', async () => {
    const mockOnApply = vi.fn();
    render(<MemorySuggestions {...defaultProps} showGlossary={true} onSuggestionApply={mockOnApply} />);

    await waitFor(() => {
      expect(screen.getByText('Use')).toBeInTheDocument();
    });

    const useButton = screen.getByText('Use');
    await userEvent.click(useButton);

    expect(mockOnApply).toHaveBeenCalledWith('Hola');
  });

  it('should respect maxSuggestions limit', async () => {
    const manySuggestions = Array.from({ length: 10 }, (_, i) => ({
      ...mockSuggestions[0],
      id: `suggestion-${i}`,
      targetText: `Translation ${i}`
    }));

    mockUseTranslationMemory.searchMemory.mockResolvedValue(manySuggestions);

    render(<MemorySuggestions {...defaultProps} maxSuggestions={3} />);

    await waitFor(() => {
      expect(mockUseTranslationMemory.searchMemory).toHaveBeenCalledWith(
        'Hello world',
        'en',
        'es',
        expect.objectContaining({
          maxResults: 3
        })
      );
    });
  });

  it('should respect minConfidence threshold', async () => {
    render(<MemorySuggestions {...defaultProps} minConfidence={0.8} />);

    await waitFor(() => {
      expect(mockUseTranslationMemory.searchMemory).toHaveBeenCalledWith(
        'Hello world',
        'en',
        'es',
        expect.objectContaining({
          threshold: 0.8
        })
      );
    });
  });

  it('should show manual search button when autoSearch is disabled', () => {
    render(<MemorySuggestions {...defaultProps} autoSearch={false} />);

    expect(screen.getByText('Search Suggestions')).toBeInTheDocument();
  });

  it('should trigger manual search when button is clicked', async () => {
    render(<MemorySuggestions {...defaultProps} autoSearch={false} />);

    const searchButton = screen.getByText('Search Suggestions');
    await userEvent.click(searchButton);

    expect(mockUseTranslationMemory.searchMemory).toHaveBeenCalled();
  });

  it('should show loading state during search', async () => {
    mockUseTranslationMemory.isLoading = true;
    
    render(<MemorySuggestions {...defaultProps} autoSearch={false} />);

    const searchButton = screen.getByText('Search Suggestions');
    expect(searchButton).toBeDisabled();
  });

  it('should show no results message when no suggestions found', async () => {
    mockUseTranslationMemory.searchMemory.mockResolvedValue([]);
    mockUseTranslationMemory.getExactMatches.mockResolvedValue([]);
    mockUseTranslationMemory.searchGlossary.mockResolvedValue([]);

    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No translation memory matches found')).toBeInTheDocument();
    });
  });

  it('should handle search errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseTranslationMemory.searchMemory.mockRejectedValue(new Error('Search failed'));

    render(<MemorySuggestions {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to search suggestions:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should debounce auto-search', async () => {
    const { rerender } = render(<MemorySuggestions {...defaultProps} sourceText="H" />);

    // Change text multiple times quickly
    rerender(<MemorySuggestions {...defaultProps} sourceText="He" />);
    rerender(<MemorySuggestions {...defaultProps} sourceText="Hel" />);
    rerender(<MemorySuggestions {...defaultProps} sourceText="Hell" />);
    rerender(<MemorySuggestions {...defaultProps} sourceText="Hello" />);

    // Should only search once after debounce delay
    await waitFor(() => {
      expect(mockUseTranslationMemory.searchMemory).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });
  });
});