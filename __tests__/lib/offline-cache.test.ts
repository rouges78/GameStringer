import { describe, it, expect, beforeEach, vi } from 'vitest';
import { offlineCache } from '@/lib/offline-cache';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('offlineCache', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('get/set', () => {
    it('returns null for uncached translation', () => {
      const result = offlineCache.get('hello', 'en', 'it');
      expect(result).toBeNull();
    });

    it('caches and retrieves translation', () => {
      offlineCache.set('hello', 'ciao', 'en', 'it');
      const result = offlineCache.get('hello', 'en', 'it');
      expect(result).toBe('ciao');
    });

    it('distinguishes between language pairs', () => {
      offlineCache.set('hello', 'ciao', 'en', 'it');
      offlineCache.set('hello', 'hola', 'en', 'es');
      
      expect(offlineCache.get('hello', 'en', 'it')).toBe('ciao');
      expect(offlineCache.get('hello', 'en', 'es')).toBe('hola');
    });
  });

  describe('setMany', () => {
    it('caches multiple translations', () => {
      offlineCache.setMany([
        { source: 'hello', target: 'ciao', sourceLang: 'en', targetLang: 'it' },
        { source: 'world', target: 'mondo', sourceLang: 'en', targetLang: 'it' },
      ]);
      
      expect(offlineCache.get('hello', 'en', 'it')).toBe('ciao');
      expect(offlineCache.get('world', 'en', 'it')).toBe('mondo');
    });
  });

  describe('getStats', () => {
    it('returns cache statistics', () => {
      offlineCache.set('test', 'prova', 'en', 'it');
      const stats = offlineCache.getStats();
      
      expect(stats.entries).toBe(1);
      expect(stats.size).toMatch(/KB|MB/);
    });
  });

  describe('clear', () => {
    it('removes all cached translations', () => {
      offlineCache.set('hello', 'ciao', 'en', 'it');
      offlineCache.clear();
      
      expect(offlineCache.get('hello', 'en', 'it')).toBeNull();
    });
  });

  describe('export/import', () => {
    it('exports cache data', () => {
      offlineCache.set('hello', 'ciao', 'en', 'it');
      const exported = offlineCache.export();
      
      expect(exported).toContain('hello');
      expect(exported).toContain('ciao');
    });

    it('imports cache data', () => {
      offlineCache.set('hello', 'ciao', 'en', 'it');
      const exported = offlineCache.export();
      
      offlineCache.clear();
      expect(offlineCache.get('hello', 'en', 'it')).toBeNull();
      
      const success = offlineCache.import(exported);
      expect(success).toBe(true);
      expect(offlineCache.get('hello', 'en', 'it')).toBe('ciao');
    });

    it('rejects invalid import data', () => {
      const success = offlineCache.import('invalid json');
      expect(success).toBe(false);
    });
  });

  describe('isOnline', () => {
    it('returns navigator.onLine value', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      expect(offlineCache.isOnline()).toBe(true);
    });
  });
});
