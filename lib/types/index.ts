// Export all UX enhancement types
// Re-export all types
export * from './tutorial';
export * from './batch';
export * from './progress';
export * from './translation-memory';

// Common utility types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  tutorial: {
    showHints: boolean;
    autoAdvance: boolean;
    skipAnimations: boolean;
  };
  batch: {
    maxConcurrency: number;
    confirmDestructiveActions: boolean;
    showDetailedProgress: boolean;
  };
  progress: {
    showNotifications: boolean;
    autoMinimize: boolean;
    soundEnabled: boolean;
  };
  translationMemory: {
    autoSuggest: boolean;
    fuzzyThreshold: number;
    maxSuggestions: number;
    showConfidence: boolean;
  };
}

export interface SystemEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  data?: any;
  source: 'tutorial' | 'batch' | 'progress' | 'memory';
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
  userMessage?: string;
}