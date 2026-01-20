import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateEstimatedTimeRemaining,
  calculateProgressRate,
  ProgressSmoother,
  formatDuration,
  formatProgress,
  calculateBatchProgress,
  estimateBatchTimeRemaining,
  createProgressUpdate,
  validateProgress,
  calculateOverallProgress,
  ProgressEasing
} from '@/lib/utils/progress-calculations';

describe('Progress Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateEstimatedTimeRemaining', () => {
    it('should calculate correct time remaining', () => {
      const startTime = new Date(Date.now() - 10000); // 10 secondi fa
      const currentProgress = 25; // 25% completato
      
      const remaining = calculateEstimatedTimeRemaining(startTime, currentProgress);
      
      // Dovrebbe essere circa 30 secondi (10s per 25% = 40s totali - 10s trascorsi)
      expect(remaining).toBeCloseTo(30000, -2); // Tolleranza di 100ms
    });

    it('should return 0 for zero progress', () => {
      const startTime = new Date(Date.now() - 5000);
      const remaining = calculateEstimatedTimeRemaining(startTime, 0);
      
      expect(remaining).toBe(0);
    });

    it('should return 0 for completed progress', () => {
      const startTime = new Date(Date.now() - 5000);
      const remaining = calculateEstimatedTimeRemaining(startTime, 100);
      
      expect(remaining).toBeLessThanOrEqual(0);
    });
  });

  describe('calculateProgressRate', () => {
    it('should calculate correct progress rate', () => {
      const startTime = new Date(Date.now() - 10000); // 10 secondi fa
      const currentProgress = 50; // 50% completato
      
      const rate = calculateProgressRate(startTime, currentProgress);
      
      // Rate dovrebbe essere 50 / 10000 = 0.005 progress per millisecondo
      expect(rate).toBeCloseTo(0.005, 6);
    });

    it('should return 0 for zero elapsed time', () => {
      const startTime = new Date();
      const rate = calculateProgressRate(startTime, 25);
      
      expect(rate).toBe(0);
    });
  });

  describe('ProgressSmoother', () => {
    it('should smooth progress updates', () => {
      const smoother = new ProgressSmoother(0.5);
      
      const first = smoother.smooth(10);
      expect(first).toBe(5); // (0 + 0.5 * (10 - 0)) = 5
      
      const second = smoother.smooth(20);
      expect(second).toBe(12.5); // (5 + 0.5 * (20 - 5)) = 12.5
      
      const third = smoother.smooth(30);
      expect(third).toBe(21.25); // (12.5 + 0.5 * (30 - 12.5)) = 21.25
    });

    it('should reset smoothing', () => {
      const smoother = new ProgressSmoother(0.3);
      
      smoother.smooth(50);
      smoother.reset();
      
      const afterReset = smoother.smooth(25);
      expect(afterReset).toBe(7.5); // (0 + 0.3 * (25 - 0)) = 7.5
    });

    it('should handle large time gaps', () => {
      vi.useFakeTimers();
      
      const smoother = new ProgressSmoother(0.5);
      smoother.smooth(10);
      
      // Avanza il tempo di più di 1 secondo
      vi.advanceTimersByTime(2000);
      
      const result = smoother.smooth(50);
      expect(result).toBe(50); // Non dovrebbe essere smoothed per gap temporali grandi
      
      vi.useRealTimers();
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('< 1s');
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(3665000)).toBe('1h 1m');
    });
  });

  describe('formatProgress', () => {
    it('should format progress percentage', () => {
      expect(formatProgress(25.6789)).toBe('25.7%');
      expect(formatProgress(100)).toBe('100.0%');
      expect(formatProgress(0)).toBe('0.0%');
      expect(formatProgress(25.6789, 2)).toBe('25.68%');
    });

    it('should clamp values to valid range', () => {
      expect(formatProgress(-10)).toBe('0.0%');
      expect(formatProgress(150)).toBe('100.0%');
    });
  });

  describe('calculateBatchProgress', () => {
    it('should calculate batch progress correctly', () => {
      const result = calculateBatchProgress(100, 25, 5);
      
      expect(result.totalItems).toBe(100);
      expect(result.completedItems).toBe(25);
      expect(result.failedItems).toBe(5);
      expect(result.progress).toBe(30); // (25 + 5) / 100 * 100
    });

    it('should handle zero total items', () => {
      const result = calculateBatchProgress(0, 0, 0);
      
      expect(result.progress).toBe(0);
    });
  });

  describe('estimateBatchTimeRemaining', () => {
    it('should estimate time using completed items', () => {
      const startTime = new Date(Date.now() - 10000); // 10 secondi fa
      const remaining = estimateBatchTimeRemaining(startTime, 100, 25);
      
      // 25 items in 10s = 400ms per item
      // 75 items remaining = 30s
      expect(remaining).toBeCloseTo(30000, -2);
    });

    it('should use average duration when no items completed', () => {
      const startTime = new Date();
      const remaining = estimateBatchTimeRemaining(startTime, 100, 0, 1000);
      
      expect(remaining).toBe(100000); // 100 items * 1000ms
    });

    it('should return 0 when no completed items and no average', () => {
      const startTime = new Date();
      const remaining = estimateBatchTimeRemaining(startTime, 100, 0);
      
      expect(remaining).toBe(0);
    });
  });

  describe('createProgressUpdate', () => {
    it('should create progress update with calculated values', () => {
      const startTime = new Date(Date.now() - 5000);
      const update = createProgressUpdate('op1', 50, 'Half done', startTime, { test: true });
      
      expect(update.operationId).toBe('op1');
      expect(update.progress).toBe(50);
      expect(update.status).toBe('Half done');
      expect(update.data).toEqual({ test: true });
      expect(update.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    it('should handle missing optional parameters', () => {
      const update = createProgressUpdate('op1', 25);
      
      expect(update.operationId).toBe('op1');
      expect(update.progress).toBe(25);
      expect(update.status).toBeUndefined();
      expect(update.estimatedTimeRemaining).toBeUndefined();
    });
  });

  describe('validateProgress', () => {
    it('should validate and clamp progress values', () => {
      expect(validateProgress(50)).toBe(50);
      expect(validateProgress(-10)).toBe(0);
      expect(validateProgress(150)).toBe(100);
      expect(validateProgress(NaN)).toBe(0);
      expect(validateProgress('invalid' as any)).toBe(0);
    });
  });

  describe('calculateOverallProgress', () => {
    it('should calculate weighted average progress', () => {
      const operations = [
        { progress: 100, weight: 1 },
        { progress: 50, weight: 2 },
        { progress: 0, weight: 1 }
      ];
      
      const overall = calculateOverallProgress(operations);
      
      // (100*1 + 50*2 + 0*1) / (1+2+1) = 200/4 = 50
      expect(overall).toBe(50);
    });

    it('should handle equal weights when not specified', () => {
      const operations = [
        { progress: 100 },
        { progress: 50 },
        { progress: 0 }
      ];
      
      const overall = calculateOverallProgress(operations);
      
      // (100 + 50 + 0) / 3 = 50
      expect(overall).toBe(50);
    });

    it('should return 0 for empty operations', () => {
      const overall = calculateOverallProgress([]);
      expect(overall).toBe(0);
    });
  });

  describe('ProgressEasing', () => {
    it('should provide linear easing', () => {
      expect(ProgressEasing.linear(0)).toBe(0);
      expect(ProgressEasing.linear(0.5)).toBe(0.5);
      expect(ProgressEasing.linear(1)).toBe(1);
    });

    it('should provide easeInOut easing', () => {
      expect(ProgressEasing.easeInOut(0)).toBe(0);
      expect(ProgressEasing.easeInOut(1)).toBe(1);
      
      const midpoint = ProgressEasing.easeInOut(0.5);
      expect(midpoint).toBeCloseTo(0.5, 1);
    });

    it('should provide easeOut easing', () => {
      expect(ProgressEasing.easeOut(0)).toBe(0);
      expect(ProgressEasing.easeOut(1)).toBe(1);
      
      // easeOut dovrebbe essere più veloce all'inizio
      const quarter = ProgressEasing.easeOut(0.25);
      expect(quarter).toBeGreaterThan(0.25);
    });

    it('should provide bounce easing', () => {
      expect(ProgressEasing.bounce(0)).toBe(0);
      expect(ProgressEasing.bounce(1)).toBeCloseTo(1, 2);
      
      // Bounce dovrebbe avere valori non lineari
      const result = ProgressEasing.bounce(0.5);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });
});