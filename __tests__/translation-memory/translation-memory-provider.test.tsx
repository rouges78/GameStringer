import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranslationMemoryProvider, useTranslationMemory } from '@/components/translation-memory/translation-memory-provider';
import type { TranslationMemoryEntry, GlossaryEntry } from '@/lib/types/translation-memory';

// Mock the database utilities
vi.mock('@/lib/utils/database', () => ({
  TranslationMemoryDatabase: {
    addEntry: vi.fn(),
    searchEntries: vi.fn(),
    incrementUsage: vi.fn()
  },
  GlossaryDatabase: {
    addTerm: vi.fn(),
    searchTerms: vi.fn()
  },
  DatabaseMaintenance: {
    getMemoryStats: vi.fn()
  }
}));

// Mock the fuzzy search utilities
vi.mock('@/lib/utils/fuzzy-search', () => ({
  fuzzySearchMemory: vi.fn(),
  findExactMatches: vi.fn()
}));

// Test component that uses the hook
function TestComponent() {
  const {
    addMemoryEntry,
    searchMemory,
    getExactMatches,
    incrementUsage,
    addGlossaryTerm,
    searchGlossary,
    getStats,
    isLoading,
    error
  } = useTranslationMemory();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button
        data-testid="add-memory"
        onClick={() => addMemoryEntry({
          sourceText: 'Hello',
          targetText: 'Hola',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: 0.9
        })}
      >
        Add Memory Entry
      </button>
      <button
        data-testid="search-memory"
        onClick={() => searchMemory('Hello', 'en', 'es')}
      >
        Search Memory
      </button>
      <button
        data-testid="get-exact"
        onClick={() => getExactMatches('Hello', 'en', 'es')}
      >
        Get Exact Matches
      </button>
      <button
        data-testid="increment-usage"
        onClick={() => incrementUsage('entry-1')}
      >
        Increment Usage
      </button>
      <button
        data-testid="add-glossary"
        onClick={() => addGlossaryTerm({
          term: 'Hello',
          translation: 'Hola',
          sourceLanguage: 'en',
          targetLanguage: 'es'
        })}
      >
        Add Glossary Term
      </button>
      <button
        data-testid="search-glossary"
        onClick={() => searchGlossary('Hello', 'en', 'es')}
      >
        Search Glossary
      </button>
      <button
        data-testid="get-stats"
        onClick={() => getStats()}
      >
        Get Stats
      </button>
    </div>
  );
}

describe('TranslationMemoryProvider', () => {
  const { TranslationMemoryDatabase, GlossaryDatabase, DatabaseMaintenance } = await import('@/lib/utils/database');
  const { fuzzySearchMemory, findExactMatches } = await import('@/lib/utils/fuzzy-search');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should provide translation memory context', () => {
    render(
      <TranslationMemoryProvider>
        <TestComponent />
      </TranslationMemoryProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTranslationMemory must be used within a TranslationMemoryProvider');
    
    consoleSpy.mockRestore();
  });

  describe('addMemoryEntry', () => {
    it('should add memory entry successfully', async () => {
      const mockAddEntry = vi.mocked(TranslationMemoryDatabase.addEntry);
      mockAddEntry.mockResolvedValue('entry-1');

      render(
        <TranslationMemoryProvider projectId="project-1" gameId="game-1">
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const addButton = screen.getByTestId('add-memory');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith({
          sourceText: 'Hello',
          targetText: 'Hola',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: 0.9,
          projectId: 'project-1',
          gameId: 'game-1',
          usageCount: 1
        });
      });
    });

    it('should handle add memory entry error', async () => {
      const mockAddEntry = vi.mocked(TranslationMemoryDatabase.addEntry);
      mockAddEntry.mockRejectedValue(new Error('Database error'));

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const addButton = screen.getByTestId('add-memory');
      
      await expect(async () => {
        await userEvent.click(addButton);
        await waitFor(() => {
          expect(screen.getByTestId('error')).toHaveTextContent('Database error');
        });
      }).rejects.toThrow('Database error');
    });
  });

  describe('searchMemory', () => {
    it('should search memory with fuzzy matching', async () => {
      const mockSearchEntries = vi.mocked(TranslationMemoryDatabase.searchEntries);
      const mockFuzzySearch = vi.mocked(fuzzySearchMemory);
      
      const mockEntries: TranslationMemoryEntry[] = [{
        id: 'entry-1',
        sourceText: 'Hello',
        targetText: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9,
        usageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const mockSuggestions = [{
        id: 'entry-1',
        sourceText: 'Hello',
        targetText: 'Hola',
        confidence: 0.9,
        similarity: 1,
        usageCount: 1,
        lastUsed: new Date(),
        type: 'exact' as const
      }];

      mockSearchEntries.mockResolvedValue(mockEntries);
      mockFuzzySearch.mockReturnValue(mockSuggestions);

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const searchButton = screen.getByTestId('search-memory');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockSearchEntries).toHaveBeenCalledWith('Hello', 'en', 'es', undefined, 20);
        expect(mockFuzzySearch).toHaveBeenCalledWith('Hello', mockEntries, expect.objectContaining({
          threshold: 0.6,
          maxResults: 10,
          includeContext: true,
          preferRecent: false
        }));
      });
    });

    it('should handle search memory error', async () => {
      const mockSearchEntries = vi.mocked(TranslationMemoryDatabase.searchEntries);
      mockSearchEntries.mockRejectedValue(new Error('Search error'));

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const searchButton = screen.getByTestId('search-memory');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Search error');
      });
    });
  });

  describe('getExactMatches', () => {
    it('should get exact matches', async () => {
      const mockSearchEntries = vi.mocked(TranslationMemoryDatabase.searchEntries);
      const mockFindExactMatches = vi.mocked(findExactMatches);
      
      const mockEntries: TranslationMemoryEntry[] = [{
        id: 'entry-1',
        sourceText: 'Hello',
        targetText: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.9,
        usageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const mockMatches = [{
        id: 'entry-1',
        sourceText: 'Hello',
        targetText: 'Hola',
        confidence: 0.9,
        similarity: 1,
        usageCount: 1,
        lastUsed: new Date(),
        type: 'exact' as const
      }];

      mockSearchEntries.mockResolvedValue(mockEntries);
      mockFindExactMatches.mockReturnValue(mockMatches);

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const exactButton = screen.getByTestId('get-exact');
      await userEvent.click(exactButton);

      await waitFor(() => {
        expect(mockSearchEntries).toHaveBeenCalledWith('Hello', 'en', 'es', undefined, 5);
        expect(mockFindExactMatches).toHaveBeenCalledWith('Hello', mockEntries, undefined);
      });
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      const mockIncrementUsage = vi.mocked(TranslationMemoryDatabase.incrementUsage);
      mockIncrementUsage.mockResolvedValue();

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const incrementButton = screen.getByTestId('increment-usage');
      await userEvent.click(incrementButton);

      await waitFor(() => {
        expect(mockIncrementUsage).toHaveBeenCalledWith('entry-1');
      });
    });

    it('should handle increment usage error silently', async () => {
      const mockIncrementUsage = vi.mocked(TranslationMemoryDatabase.incrementUsage);
      mockIncrementUsage.mockRejectedValue(new Error('Increment error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const incrementButton = screen.getByTestId('increment-usage');
      await userEvent.click(incrementButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to increment usage:', expect.any(Error));
      });

      // Should not set error state for usage tracking failures
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      
      consoleSpy.mockRestore();
    });
  });

  describe('addGlossaryTerm', () => {
    it('should add glossary term successfully', async () => {
      const mockAddTerm = vi.mocked(GlossaryDatabase.addTerm);
      mockAddTerm.mockResolvedValue('term-1');

      render(
        <TranslationMemoryProvider projectId="project-1">
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const addButton = screen.getByTestId('add-glossary');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(mockAddTerm).toHaveBeenCalledWith({
          term: 'Hello',
          translation: 'Hola',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          project: 'project-1',
          approved: false
        });
      });
    });
  });

  describe('searchGlossary', () => {
    it('should search glossary terms', async () => {
      const mockSearchTerms = vi.mocked(GlossaryDatabase.searchTerms);
      
      const mockTerms: GlossaryEntry[] = [{
        id: 'term-1',
        term: 'Hello',
        translation: 'Hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      mockSearchTerms.mockResolvedValue(mockTerms);

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const searchButton = screen.getByTestId('search-glossary');
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockSearchTerms).toHaveBeenCalledWith('Hello', 'en', 'es', undefined);
      });
    });
  });

  describe('getStats', () => {
    it('should get memory statistics', async () => {
      const mockGetMemoryStats = vi.mocked(DatabaseMaintenance.getMemoryStats);
      mockGetMemoryStats.mockResolvedValue({
        totalEntries: 100,
        totalGlossaryTerms: 50,
        totalProjects: 5
      });

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const statsButton = screen.getByTestId('get-stats');
      await userEvent.click(statsButton);

      await waitFor(() => {
        expect(mockGetMemoryStats).toHaveBeenCalled();
      });
    });

    it('should handle stats error gracefully', async () => {
      const mockGetMemoryStats = vi.mocked(DatabaseMaintenance.getMemoryStats);
      mockGetMemoryStats.mockRejectedValue(new Error('Stats error'));

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const statsButton = screen.getByTestId('get-stats');
      await userEvent.click(statsButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Stats error');
      });
    });
  });

  describe('loading states', () => {
    it('should show loading state during operations', async () => {
      const mockAddEntry = vi.mocked(TranslationMemoryDatabase.addEntry);
      
      // Create a promise that we can control
      let resolvePromise: (value: string) => void;
      const controlledPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      
      mockAddEntry.mockReturnValue(controlledPromise);

      render(
        <TranslationMemoryProvider>
          <TestComponent />
        </TranslationMemoryProvider>
      );

      const addButton = screen.getByTestId('add-memory');
      await userEvent.click(addButton);

      // Should show loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Resolve the promise
      act(() => {
        resolvePromise!('entry-1');
      });

      // Should stop loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });
  });
});