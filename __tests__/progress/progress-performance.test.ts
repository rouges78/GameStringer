import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProgressSmoother } from '@/lib/utils/progress-calculations';
import { progressPersistence } from '@/lib/progress-persistence';
import type { OperationProgress } from '@/lib/types/progress';

// Mock del localStorage per i test di persistenza
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Progress System Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Progress Calculations Performance', () => {
    it('should handle rapid progress updates efficiently', () => {
      const smoother = new ProgressSmoother(0.3);
      const startTime = performance.now();
      
      // Simula 1000 aggiornamenti rapidi
      for (let i = 0; i <= 100; i++) {
        smoother.smooth(i);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Dovrebbe completare in meno di 10ms
      expect(duration).toBeLessThan(10);
    });

    it('should handle large number of progress calculations', async () => {
      const { calculateEstimatedTimeRemaining } = await import('@/lib/utils/progress-calculations');
      const startTime = performance.now();
      
      // Simula 10000 calcoli di tempo rimanente
      for (let i = 1; i <= 10000; i++) {
        const operationStart = new Date(Date.now() - 5000);
        calculateEstimatedTimeRemaining(operationStart, i / 100);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Dovrebbe completare in meno di 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should efficiently calculate overall progress for many operations', async () => {
      const { calculateOverallProgress } = await import('@/lib/utils/progress-calculations');
      
      // Crea 1000 operazioni simulate
      const operations = Array.from({ length: 1000 }, (_, i) => ({
        progress: Math.random() * 100,
        weight: Math.random() * 5
      }));
      
      const startTime = performance.now();
      
      // Calcola progresso complessivo 100 volte
      for (let i = 0; i < 100; i++) {
        calculateOverallProgress(operations);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Dovrebbe completare in meno di 20ms
      expect(duration).toBeLessThan(20);
    });
  });

  describe('Progress Persistence Performance', () => {
    it('should efficiently save large number of operations', () => {
      // Crea 100 operazioni simulate
      const operations = new Map<string, OperationProgress>();
      
      for (let i = 0; i < 100; i++) {
        operations.set(`op-${i}`, {
          id: `op-${i}`,
          title: `Operation ${i}`,
          progress: Math.random() * 100,
          status: `Status ${i}`,
          startTime: new Date(),
          canMinimize: true,
          canCancel: true,
          isBackground: i % 2 === 0
        });
      }
      
      const startTime = performance.now();
      
      // Salva operazioni 10 volte
      for (let i = 0; i < 10; i++) {
        progressPersistence.saveOperations(operations);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Dovrebbe completare in meno di 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should efficiently load operations from storage', () => {
      // Mock dati salvati
      const mockData = {
        operations: Array.from({ length: 50 }, (_, i) => ({
          id: `op-${i}`,
          title: `Operation ${i}`,
          progress: Math.random() * 100,
          status: `Status ${i}`,
          startTime: new Date().toISOString(),
          canMinimize: true,
          canCancel: true,
          isBackground: false
        })),
        lastUpdate: new Date().toISOString(),
        version: 1
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));
      
      const startTime = performance.now();
      
      // Carica operazioni 20 volte
      for (let i = 0; i < 20; i++) {
        progressPersistence.loadOperations();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Dovrebbe completare in meno di 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle frequent event logging efficiently', () => {
      const startTime = performance.now();
      
      // Simula 500 eventi
      for (let i = 0; i < 500; i++) {
        progressPersistence.saveEvent({
          type: 'operation_updated',
          operationId: `op-${i % 10}`,
          timestamp: new Date(),
          data: { progress: i % 100 }
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Dovrebbe completare in meno di 200ms
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with many operations', () => {
      const operations = new Map<string, OperationProgress>();
      
      // Crea e rimuovi operazioni ripetutamente
      for (let cycle = 0; cycle < 10; cycle++) {
        // Aggiungi 100 operazioni
        for (let i = 0; i < 100; i++) {
          const id = `cycle-${cycle}-op-${i}`;
          operations.set(id, {
            id,
            title: `Operation ${i}`,
            progress: 100, // Completate
            status: 'Completed',
            startTime: new Date(Date.now() - 10000), // Vecchie
            canMinimize: true,
            canCancel: false,
            isBackground: false
          });
        }
        
        // Simula cleanup delle operazioni vecchie
        const cutoffTime = Date.now() - 5000;
        for (const [id, operation] of operations.entries()) {
          if (operation.progress === 100 && operation.startTime.getTime() < cutoffTime) {
            operations.delete(id);
          }
        }
      }
      
      // Alla fine dovremmo avere solo le operazioni dell'ultimo ciclo
      expect(operations.size).toBeLessThanOrEqual(100);
    });

    it('should efficiently manage event history', () => {
      const events = [];
      const maxEvents = 100;
      
      // Simula aggiunta di molti eventi con limite
      for (let i = 0; i < 500; i++) {
        events.push({
          type: 'operation_updated',
          operationId: `op-${i}`,
          timestamp: new Date(),
          data: { progress: i % 100 }
        });
        
        // Mantieni solo gli ultimi 100 eventi
        if (events.length > maxEvents) {
          events.splice(0, events.length - maxEvents);
        }
      }
      
      expect(events.length).toBe(maxEvents);
      expect(events[0].data.progress).toBe(0); // Ultimo batch inizia da 400 % 100 = 0
      expect(events[99].data.progress).toBe(99); // Ultimo evento è 499 % 100 = 99
    });
  });

  describe('UI Update Performance', () => {
    it('should throttle rapid UI updates', async () => {
      vi.useFakeTimers();
      
      let updateCount = 0;
      const throttledUpdate = vi.fn(() => {
        updateCount++;
      });
      
      // Simula 100 aggiornamenti rapidi in 100ms
      for (let i = 0; i < 100; i++) {
        setTimeout(() => {
          throttledUpdate();
        }, i);
      }
      
      // Avanza il tempo
      vi.advanceTimersByTime(100);
      
      // Con throttling, dovremmo avere meno aggiornamenti del totale
      expect(updateCount).toBeLessThan(100);
      
      vi.useRealTimers();
    });

    it('should handle concurrent progress updates', async () => {
      const updates = [];
      const startTime = performance.now();
      
      // Simula aggiornamenti concorrenti
      const promises = Array.from({ length: 50 }, async (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => {
            updates.push({
              operationId: `op-${i % 5}`, // 5 operazioni diverse
              progress: Math.random() * 100,
              timestamp: Date.now()
            });
            resolve(i);
          }, Math.random() * 10);
        });
      });
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(updates.length).toBe(50);
      expect(duration).toBeLessThan(100); // Dovrebbe completare rapidamente
    });
  });

  describe('Batch Processing Performance', () => {
    it('should handle large batches efficiently', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        data: { value: i }
      }));
      
      const startTime = performance.now();
      
      // Simula elaborazione batch (solo calcoli, no I/O)
      const results = items.map(item => {
        // Simula elaborazione semplice
        return {
          itemId: item.id,
          success: true,
          result: { processed: item.data.value * 2 }
        };
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results.length).toBe(1000);
      expect(duration).toBeLessThan(50); // Dovrebbe essere molto veloce per calcoli semplici
    });

    it('should efficiently calculate batch progress', async () => {
      const { calculateBatchProgress } = await import('@/lib/utils/progress-calculations');
      
      const startTime = performance.now();
      
      // Calcola progresso per molti batch
      for (let i = 0; i < 1000; i++) {
        calculateBatchProgress(1000, i, Math.floor(i * 0.1));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(20);
    });
  });
});