// Translation Memory & Glossary Types
export interface TranslationMemoryEntry {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  confidence: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  projectId?: string;
  gameId?: string;
  filePath?: string;
  tags?: string[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  definition?: string;
  category?: string;
  project?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  approved?: boolean;
  notes?: string;
}

export interface TranslationMemoryDatabase {
  entries: TranslationMemoryEntry[];
  glossary: GlossaryEntry[];
  projects: TranslationProject[];
  metadata: {
    version: string;
    lastUpdated: Date;
    totalEntries: number;
    totalGlossaryTerms: number;
  };
}

export interface TranslationProject {
  id: string;
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguages: string[];
  glossaryIds: string[];
  createdAt: Date;
  updatedAt: Date;
  settings: {
    autoSuggest: boolean;
    fuzzyThreshold: number; // 0-1
    maxSuggestions: number;
    requireApproval: boolean;
  };
}

export interface MemorySuggestion {
  id: string;
  sourceText: string;
  targetText: string;
  confidence: number; // 0-1
  similarity: number; // 0-1
  context?: string;
  usageCount: number;
  lastUsed: Date;
  type: 'exact' | 'fuzzy' | 'glossary';
}

export interface FuzzySearchOptions {
  threshold: number; // 0-1, minimum similarity score
  maxResults: number;
  includeContext: boolean;
  preferRecent: boolean;
  projectId?: string;
  gameId?: string;
}

export interface TranslationMemoryStats {
  totalEntries: number;
  entriesByLanguagePair: Record<string, number>;
  averageConfidence: number;
  mostUsedEntries: TranslationMemoryEntry[];
  recentEntries: TranslationMemoryEntry[];
  glossaryTerms: number;
  projects: number;
}

export interface GlossarySearchResult {
  term: GlossaryEntry;
  matches: Array<{
    text: string;
    position: number;
    length: number;
  }>;
}

export type TranslationMemoryEventType = 
  | 'entry_added'
  | 'entry_updated'
  | 'entry_used'
  | 'glossary_term_added'
  | 'glossary_term_updated'
  | 'project_created'
  | 'project_updated';

export interface TranslationMemoryEvent {
  type: TranslationMemoryEventType;
  entryId?: string;
  projectId?: string;
  timestamp: Date;
  userId?: string;
  data?: any;
}