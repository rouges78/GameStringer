/**
 * Advanced String Search System
 * Powerful search with filters, regex, fuzzy matching, and saved searches
 */

export interface SearchFilter {
  status?: ('pending' | 'translated' | 'reviewed' | 'approved')[];
  tags?: string[];
  hasNotes?: boolean;
  hasIssues?: boolean;
  minLength?: number;
  maxLength?: number;
  modifiedAfter?: number;
  modifiedBefore?: number;
  translatedBy?: string;
  containsPlaceholder?: boolean;
  qualityScore?: { min: number; max: number };
}

export interface SearchOptions {
  query: string;
  searchIn: ('source' | 'target' | 'notes' | 'context')[];
  matchType: 'contains' | 'exact' | 'starts' | 'ends' | 'regex' | 'fuzzy';
  caseSensitive: boolean;
  wholeWord: boolean;
  filters: SearchFilter;
}

export interface SearchResult {
  stringId: string;
  source: string;
  target: string;
  matchedIn: string[];
  matchPositions: Array<{ field: string; start: number; end: number }>;
  relevanceScore: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  options: SearchOptions;
  createdAt: number;
  lastUsed: number;
  useCount: number;
}

export interface TranslationString {
  id: string;
  source: string;
  target: string;
  status: string;
  context?: string;
  notes?: string;
  tags?: string[];
  modifiedAt?: number;
  translatedBy?: string;
  qualityScore?: number;
}

const SAVED_SEARCHES_KEY = 'gamestringer_saved_searches';
const RECENT_SEARCHES_KEY = 'gamestringer_recent_searches';

class AdvancedStringSearch {
  private savedSearches: SavedSearch[] = [];
  private recentSearches: string[] = [];
  private maxRecentSearches = 20;

  constructor() {
    this.load();
  }

  // Main search function
  search(strings: TranslationString[], options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Add to recent searches
    if (options.query) {
      this.addRecentSearch(options.query);
    }

    for (const str of strings) {
      // Apply filters first
      if (!this.matchesFilters(str, options.filters)) {
        continue;
      }

      // If no query, return all filtered results
      if (!options.query) {
        results.push({
          stringId: str.id,
          source: str.source,
          target: str.target,
          matchedIn: [],
          matchPositions: [],
          relevanceScore: 1,
        });
        continue;
      }

      // Search in specified fields
      const matchedIn: string[] = [];
      const matchPositions: Array<{ field: string; start: number; end: number }> = [];
      let totalScore = 0;

      for (const field of options.searchIn) {
        const text = this.getFieldValue(str, field);
        if (!text) continue;

        const matches = this.findMatches(text, options);
        if (matches.length > 0) {
          matchedIn.push(field);
          matches.forEach(m => {
            matchPositions.push({ field, ...m });
          });
          
          // Calculate relevance
          const fieldWeight = field === 'source' ? 1.5 : field === 'target' ? 1.3 : 1;
          totalScore += matches.length * fieldWeight;
        }
      }

      if (matchedIn.length > 0) {
        results.push({
          stringId: str.id,
          source: str.source,
          target: str.target,
          matchedIn,
          matchPositions,
          relevanceScore: totalScore,
        });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private getFieldValue(str: TranslationString, field: string): string {
    switch (field) {
      case 'source': return str.source;
      case 'target': return str.target;
      case 'notes': return str.notes || '';
      case 'context': return str.context || '';
      default: return '';
    }
  }

  private matchesFilters(str: TranslationString, filters: SearchFilter): boolean {
    // Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(str.status as unknown)) return false;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      if (!str.tags || !filters.tags.some(t => str.tags!.includes(t))) return false;
    }

    // Has notes
    if (filters.hasNotes !== undefined) {
      const hasNotes = !!(str.notes && str.notes.trim());
      if (filters.hasNotes !== hasNotes) return false;
    }

    // Length filters
    if (filters.minLength !== undefined && str.source.length < filters.minLength) return false;
    if (filters.maxLength !== undefined && str.source.length > filters.maxLength) return false;

    // Date filters
    if (filters.modifiedAfter && str.modifiedAt && str.modifiedAt < filters.modifiedAfter) return false;
    if (filters.modifiedBefore && str.modifiedAt && str.modifiedAt > filters.modifiedBefore) return false;

    // Translator filter
    if (filters.translatedBy && str.translatedBy !== filters.translatedBy) return false;

    // Placeholder filter
    if (filters.containsPlaceholder !== undefined) {
      const hasPlaceholder = /\{[^}]+\}|%[sd@]|\$\d/.test(str.source);
      if (filters.containsPlaceholder !== hasPlaceholder) return false;
    }

    // Quality score filter
    if (filters.qualityScore && str.qualityScore !== undefined) {
      if (str.qualityScore < filters.qualityScore.min || str.qualityScore > filters.qualityScore.max) {
        return false;
      }
    }

    return true;
  }

  private findMatches(text: string, options: SearchOptions): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = [];
    let query = options.query;
    let searchText = text;

    if (!options.caseSensitive) {
      query = query.toLowerCase();
      searchText = text.toLowerCase();
    }

    switch (options.matchType) {
      case 'exact':
        if (searchText === query) {
          matches.push({ start: 0, end: text.length });
        }
        break;

      case 'starts':
        if (searchText.startsWith(query)) {
          matches.push({ start: 0, end: query.length });
        }
        break;

      case 'ends':
        if (searchText.endsWith(query)) {
          matches.push({ start: text.length - query.length, end: text.length });
        }
        break;

      case 'regex':
        try {
          const flags = options.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(options.query, flags);
          let match;
          while ((match = regex.exec(text)) !== null) {
            matches.push({ start: match.index, end: match.index + match[0].length });
          }
        } catch {
          // Invalid regex, fall back to contains
          return this.findContainsMatches(searchText, query, options.wholeWord);
        }
        break;

      case 'fuzzy':
        const fuzzyScore = this.fuzzyMatch(searchText, query);
        if (fuzzyScore > 0.6) {
          // For fuzzy, we can't pinpoint exact positions
          matches.push({ start: 0, end: 0 });
        }
        break;

      case 'contains':
      default:
        return this.findContainsMatches(searchText, query, options.wholeWord);
    }

    return matches;
  }

  private findContainsMatches(
    text: string, 
    query: string, 
    wholeWord: boolean
  ): Array<{ start: number; end: number }> {
    const matches: Array<{ start: number; end: number }> = [];
    let pos = 0;

    while ((pos = text.indexOf(query, pos)) !== -1) {
      if (wholeWord) {
        const before = pos === 0 || /\W/.test(text[pos - 1]);
        const after = pos + query.length >= text.length || /\W/.test(text[pos + query.length]);
        if (before && after) {
          matches.push({ start: pos, end: pos + query.length });
        }
      } else {
        matches.push({ start: pos, end: pos + query.length });
      }
      pos++;
    }

    return matches;
  }

  private fuzzyMatch(text: string, query: string): number {
    if (query.length === 0) return 1;
    if (text.length === 0) return 0;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Check for containment first
    if (textLower.includes(queryLower)) return 1;

    // Calculate Levenshtein-based similarity
    const maxLen = Math.max(text.length, query.length);
    const distance = this.levenshteinDistance(textLower, queryLower);
    
    return 1 - (distance / maxLen);
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // Saved Searches

  saveSearch(name: string, options: SearchOptions): SavedSearch {
    const saved: SavedSearch = {
      id: `search_${Date.now()}`,
      name,
      options,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 1,
    };

    this.savedSearches.push(saved);
    this.save();
    return saved;
  }

  deleteSavedSearch(searchId: string): void {
    this.savedSearches = this.savedSearches.filter(s => s.id !== searchId);
    this.save();
  }

  useSavedSearch(searchId: string): SearchOptions | null {
    const saved = this.savedSearches.find(s => s.id === searchId);
    if (saved) {
      saved.lastUsed = Date.now();
      saved.useCount++;
      this.save();
      return saved.options;
    }
    return null;
  }

  getSavedSearches(): SavedSearch[] {
    return [...this.savedSearches].sort((a, b) => b.lastUsed - a.lastUsed);
  }

  // Recent Searches

  addRecentSearch(query: string): void {
    this.recentSearches = this.recentSearches.filter(q => q !== query);
    this.recentSearches.unshift(query);
    
    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, this.maxRecentSearches);
    }
    
    this.save();
  }

  getRecentSearches(): string[] {
    return [...this.recentSearches];
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
    this.save();
  }

  // Suggestions

  getSuggestions(partialQuery: string, strings: TranslationString[]): string[] {
    if (partialQuery.length < 2) return [];

    const suggestions = new Set<string>();
    const lower = partialQuery.toLowerCase();

    // From recent searches
    this.recentSearches.forEach(q => {
      if (q.toLowerCase().includes(lower)) {
        suggestions.add(q);
      }
    });

    // From string content (limited sample)
    const sampleSize = Math.min(strings.length, 100);
    for (let i = 0; i < sampleSize; i++) {
      const str = strings[i];
      const words = (str.source + ' ' + str.target).split(/\s+/);
      words.forEach(word => {
        if (word.length > 3 && word.toLowerCase().startsWith(lower)) {
          suggestions.add(word);
        }
      });
    }

    return Array.from(suggestions).slice(0, 10);
  }

  // Persistence

  private load(): void {
    if (typeof window === 'undefined') return;

    try {
      const savedData = localStorage.getItem(SAVED_SEARCHES_KEY);
      if (savedData) {
        this.savedSearches = JSON.parse(savedData);
      }

      const recentData = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (recentData) {
        this.recentSearches = JSON.parse(recentData);
      }
    } catch (error) {
      console.error('[AdvancedSearch] Load failed:', error);
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(this.savedSearches));
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(this.recentSearches));
    } catch (error) {
      console.error('[AdvancedSearch] Save failed:', error);
    }
  }

  // Default options
  getDefaultOptions(): SearchOptions {
    return {
      query: '',
      searchIn: ['source', 'target'],
      matchType: 'contains',
      caseSensitive: false,
      wholeWord: false,
      filters: {},
    };
  }
}

// Singleton
export const advancedSearch = new AdvancedStringSearch();

// React hook
import { useState, useCallback, useMemo } from 'react';

export function useAdvancedSearch(strings: TranslationString[]) {
  const [options, setOptions] = useState<SearchOptions>(advancedSearch.getDefaultOptions());
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    if (!options.query && Object.keys(options.filters).length === 0) {
      return null;
    }
    setIsSearching(true);
    const res = advancedSearch.search(strings, options);
    setIsSearching(false);
    return res;
  }, [strings, options]);

  const updateQuery = useCallback((query: string) => {
    setOptions(prev => ({ ...prev, query }));
  }, []);

  const updateFilters = useCallback((filters: SearchFilter) => {
    setOptions(prev => ({ ...prev, filters }));
  }, []);

  const updateOptions = useCallback((updates: Partial<SearchOptions>) => {
    setOptions(prev => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setOptions(advancedSearch.getDefaultOptions());
  }, []);

  return {
    options,
    results,
    isSearching,
    resultCount: results?.length ?? 0,
    
    updateQuery,
    updateFilters,
    updateOptions,
    reset,
    
    savedSearches: advancedSearch.getSavedSearches(),
    recentSearches: advancedSearch.getRecentSearches(),
    suggestions: advancedSearch.getSuggestions(options.query, strings),
    
    saveSearch: (name: string) => advancedSearch.saveSearch(name, options),
    loadSavedSearch: (id: string) => {
      const loaded = advancedSearch.useSavedSearch(id);
      if (loaded) setOptions(loaded);
    },
  };
}

export default advancedSearch;
