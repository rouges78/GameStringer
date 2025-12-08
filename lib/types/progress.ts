// Progress Indicators Types
export interface ProgressState {
  operations: Map<string, OperationProgress>;
  startOperation: (id: string, config: ProgressConfig) => void;
  updateProgress: (id: string, progress: number, status?: string) => void;
  completeOperation: (id: string, result?: any) => void;
  failOperation: (id: string, error: Error) => void;
  cancelOperation: (id: string) => void;
  getOperation: (id: string) => OperationProgress | undefined;
}

export interface OperationProgress {
  id: string;
  title: string;
  description?: string;
  progress: number; // 0-100
  status: string;
  startTime: Date;
  estimatedEndTime?: Date;
  canMinimize: boolean;
  canCancel: boolean;
  error?: Error;
  result?: any;
  isBackground?: boolean;
}

export interface ProgressConfig {
  title: string;
  description?: string;
  canMinimize?: boolean;
  canCancel?: boolean;
  estimatedDuration?: number; // in milliseconds
  isBackground?: boolean;
  onCancel?: () => void;
  onComplete?: (result?: any) => void;
  onError?: (error: Error) => void;
}

export interface ProgressUpdate {
  operationId: string;
  progress: number;
  status?: string;
  estimatedTimeRemaining?: number;
  data?: any;
}

export type ProgressEventType = 
  | 'operation_started'
  | 'operation_updated'
  | 'operation_completed'
  | 'operation_failed'
  | 'operation_cancelled';

export interface ProgressEvent {
  type: ProgressEventType;
  operationId: string;
  timestamp: Date;
  data?: any;
}

export interface ProgressNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  progress?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  autoHide?: boolean;
  duration?: number;
}