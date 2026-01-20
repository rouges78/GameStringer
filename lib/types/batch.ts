// Batch Operations Types
export interface BatchSelection {
  selectedItems: Set<string>;
  selectAll: () => void;
  selectNone: () => void;
  toggleItem: (id: string) => void;
  isSelected: (id: string) => boolean;
  getSelectedCount: () => number;
  getSelectedItems: () => string[];
}

export interface BatchOperation {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: (items: string[]) => Promise<BatchResult>;
  requiresConfirmation: boolean;
  maxConcurrency?: number;
  estimatedTimePerItem?: number; // in milliseconds
}

export interface BatchResult {
  operationId: string;
  totalItems: number;
  successCount: number;
  failureCount: number;
  results: BatchItemResult[];
  duration: number;
  completedAt: Date;
  summary?: string;
}

export interface BatchItemResult {
  itemId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
}

export interface BatchOperationConfig {
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  timeoutMs: number;
  onProgress?: (progress: BatchProgress) => void;
  onItemComplete?: (result: BatchItemResult) => void;
}

export interface BatchProgress {
  operationId: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
  progress: number; // 0-100
}

export type BatchOperationStatus = 
  | 'idle' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface BatchOperationState {
  id: string;
  status: BatchOperationStatus;
  progress: BatchProgress;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
}