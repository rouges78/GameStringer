// Fuzzy Search Utilities for Translation Memory
import type { TranslationMemoryEntry, MemorySuggestion, FuzzySearchOptions } from '@/lib/types/translation-memory';

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Jaccard similarity for word-based comparison
 */
export function jaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Enhanced similarity calculation combining multiple metrics
 */
export function enhancedSimilarity(str1: string, str2: string): number {
  const levenshteinSim = calculateSimilarity(str1, str2);
  const jaccardSim = jaccardSimilarity(str1, str2);
  
  // Weight Levenshtein more for character-level similarity
  // Weight Jaccard more for word-level similarity
  return (levenshteinSim * 0.7) + (jaccardSim * 0.3);
}

/**
 * Search translation memory entries with fuzzy matching
 */
export function fuzzySearchMemory(
  query: string,
  entries: TranslationMemoryEntry[],
  options: FuzzySearchOptions
): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  for (const entry of entries) {
    // Skip if project filter doesn't match
    if (options.projectId && entry.projectId !== options.projectId) {
      continue;
    }

    // Skip if game filter doesn't match
    if (options.gameId && entry.gameId !== options.gameId) {
      continue;
    }

    const similarity = enhancedSimilarity(query, entry.sourceText);
    
    if (similarity >= options.threshold) {
      suggestions.push({
        id: entry.id,
        sourceText: entry.sourceText,
        targetText: entry.targetText,
        confidence: entry.confidence,
        similarity,
        context: options.includeContext ? entry.context : undefined,
        usageCount: entry.usageCount,
        lastUsed: entry.updatedAt,
        type: similarity === 1 ? 'exact' : 'fuzzy'
      });
    }
  }

  // Sort by similarity (desc), then by usage count (desc), then by recency
  suggestions.sort((a, b) => {
    if (a.similarity !== b.similarity) {
      return b.similarity - a.similarity;
    }
    
    if (options.preferRecent) {
      return b.lastUsed.getTime() - a.lastUsed.getTime();
    }
    
    return b.usageCount - a.usageCount;
  });

  return suggestions.slice(0, options.maxResults);
}

/**
 * Find exact matches in translation memory
 */
export function findExactMatches(
  query: string,
  entries: TranslationMemoryEntry[],
  projectId?: string
): MemorySuggestion[] {
  return entries
    .filter(entry => {
      if (projectId && entry.projectId !== projectId) return false;
      return entry.sourceText.toLowerCase() === query.toLowerCase();
    })
    .map(entry => ({
      id: entry.id,
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      confidence: entry.confidence,
      similarity: 1,
      context: entry.context,
      usageCount: entry.usageCount,
      lastUsed: entry.updatedAt,
      type: 'exact' as const
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Highlight matching parts in text for UI display
 */
export function highlightMatches(text: string, query: string): Array<{
  text: string;
  isMatch: boolean;
}> {
  if (!query.trim()) {
    return [{ text, isMatch: false }];
  }

  const queryWords = query.toLowerCase().split(/\s+/);
  const words = text.split(/(\s+)/);
  
  return words.map(word => ({
    text: word,
    isMatch: queryWords.some(qWord => 
      word.toLowerCase().includes(qWord) && qWord.length > 2
    )
  }));
}

/**
 * Extract context around a match for better understanding
 */
export function extractContext(
  fullText: string,
  matchText: string,
  contextLength: number = 50
): string {
  const index = fullText.toLowerCase().indexOf(matchText.toLowerCase());
  if (index === -1) return '';

  const start = Math.max(0, index - contextLength);
  const end = Math.min(fullText.length, index + matchText.length + contextLength);
  
  let context = fullText.substring(start, end);
  
  if (start > 0) context = '...' + context;
  if (end < fullText.length) context = context + '...';
  
  return context;
}