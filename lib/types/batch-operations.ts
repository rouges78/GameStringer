export interface BatchSelection {
  selectedItems: Set<string>;
  selectAll: () => void;
  selectNone: () => void;
  toggleItem: (id: string) => void;
  toggleAll: (items: string[]) => void;
  isSelected: (id: string) => boolean;
  hasSelection: boolean;
  selectedCount: number;
}

export interface BatchOperation {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  action: (items: string[]) => Promise<BatchResult>;
  requiresConfirmation: boolean;
  description?: string;
  disabled?: boolean;
}

export interface BatchResult {
  operationId: string;
  totalItems: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    itemId: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  duration: number;
  completedAt: Date;
}

export interface BatchOperationConfig {
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onProgress?: (progress: number, status: string) => void;
  onItemComplete?: (itemId: string, result: any) => void;
  onItemError?: (itemId: string, error: Error) => void;
}

export interface BatchSelectionState {
  selectedItems: Set<string>;
  availableItems: string[];
  operations: BatchOperation[];
}

// Base batch item type
export interface BatchItem {
  id: string;
  data: Record<string, any>;
}

// Translation batch item type
export interface TranslationBatchItem extends BatchItem {
  id: string;
  data: {
    sourceText?: string;
    targetText?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    status?: string;
    gameId?: string;
    filePath?: string;
    format?: string;
    overwrite?: boolean;
    [key: string]: any;
  };
}

// Translation-specific batch operations
export interface TranslationBatchOperations {
  batchTranslate: BatchOperation;
  batchExport: BatchOperation;
  batchImport: BatchOperation;
  batchStatusUpdate: BatchOperation;
  batchDelete: BatchOperation;
}

export type BatchOperationType = 
  | 'translate'
  | 'export'
  | 'import'
  | 'status_update'
  | 'delete'
  | 'approve'
  | 'reject';

export interface BatchOperationStatus {
  id: string;
  type: BatchOperationType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}