// Progress Calculation Utilities
import type { ProgressUpdate, OperationProgress } from '@/lib/types/progress';
import type { BatchProgress } from '@/lib/types/batch';

/**
 * Calculate estimated time remaining based on current progress
 */
export function calculateEstimatedTimeRemaining(
  startTime: Date,
  currentProgress: number,
  totalProgress: number = 100
): number {
  if (currentProgress <= 0) return 0;
  
  const elapsedTime = Date.now() - startTime.getTime();
  const progressRatio = currentProgress / totalProgress;
  const estimatedTotalTime = elapsedTime / progressRatio;
  
  return Math.max(0, estimatedTotalTime - elapsedTime);
}

/**
 * Calculate progress rate (progress per millisecond)
 */
export function calculateProgressRate(
  startTime: Date,
  currentProgress: number
): number {
  const elapsedTime = Date.now() - startTime.getTime();
  if (elapsedTime <= 0) return 0;
  
  return currentProgress / elapsedTime;
}

/**
 * Smooth progress updates to avoid jittery UI
 */
export class ProgressSmoother {
  private lastProgress: number = 0;
  private lastUpdate: number = Date.now();
  private smoothingFactor: number;

  constructor(smoothingFactor: number = 0.3) {
    this.smoothingFactor = Math.max(0, Math.min(1, smoothingFactor));
  }

  smooth(newProgress: number): number {
    const now = Date.now();
    const timeDelta = now - this.lastUpdate;
    
    // If too much time has passed, don't smooth
    if (timeDelta > 1000) {
      this.lastProgress = newProgress;
      this.lastUpdate = now;
      return newProgress;
    }

    // Apply exponential smoothing
    const smoothedProgress = this.lastProgress + 
      this.smoothingFactor * (newProgress - this.lastProgress);
    
    this.lastProgress = smoothedProgress;
    this.lastUpdate = now;
    
    return smoothedProgress;
  }

  reset(): void {
    this.lastProgress = 0;
    this.lastUpdate = Date.now();
  }
}

/**
 * Format time duration for display
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return '< 1s';
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Format progress percentage for display
 */
export function formatProgress(progress: number, decimals: number = 1): string {
  const clamped = Math.max(0, Math.min(100, progress));
  return `${clamped.toFixed(decimals)}%`;
}

/**
 * Calculate batch operation progress
 */
export function calculateBatchProgress(
  totalItems: number,
  completedItems: number,
  failedItems: number
): BatchProgress {
  const processedItems = completedItems + failedItems;
  const progress = totalItems > 0 ? (processedItems / totalItems) * 100 : 0;

  return {
    operationId: '', // Will be set by caller
    totalItems,
    completedItems,
    failedItems,
    progress: Math.min(100, Math.max(0, progress))
  };
}

/**
 * Estimate batch operation time remaining
 */
export function estimateBatchTimeRemaining(
  startTime: Date,
  totalItems: number,
  completedItems: number,
  averageItemDuration?: number
): number {
  if (completedItems <= 0) {
    // Use average item duration if provided
    if (averageItemDuration) {
      return totalItems * averageItemDuration;
    }
    return 0;
  }

  const elapsedTime = Date.now() - startTime.getTime();
  const averageTimePerItem = elapsedTime / completedItems;
  const remainingItems = totalItems - completedItems;

  return remainingItems * averageTimePerItem;
}

/**
 * Create progress update with calculated values
 */
export function createProgressUpdate(
  operationId: string,
  progress: number,
  status?: string,
  startTime?: Date,
  data?: any
): ProgressUpdate {
  const update: ProgressUpdate = {
    operationId,
    progress: Math.max(0, Math.min(100, progress)),
    data
  };

  if (status) {
    update.status = status;
  }

  if (startTime && progress > 0) {
    update.estimatedTimeRemaining = calculateEstimatedTimeRemaining(
      startTime,
      progress
    );
  }

  return update;
}

/**
 * Validate progress value
 */
export function validateProgress(progress: number): number {
  if (typeof progress !== 'number' || isNaN(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(100, progress));
}

/**
 * Calculate overall progress from multiple sub-operations
 */
export function calculateOverallProgress(
  operations: Array<{ progress: number; weight?: number }>
): number {
  if (operations.length === 0) return 0;

  const totalWeight = operations.reduce((sum, op) => sum + (op.weight || 1), 0);
  const weightedProgress = operations.reduce(
    (sum, op) => sum + (op.progress * (op.weight || 1)),
    0
  );

  return weightedProgress / totalWeight;
}

/**
 * Progress animation easing functions
 */
export const ProgressEasing = {
  linear: (t: number): number => t,
  
  easeInOut: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  
  easeOut: (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  },
  
  bounce: (t: number): number => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }
};