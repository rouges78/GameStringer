import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  blockProvider,
  isProviderBlocked,
  resetProviderBlocks,
  FREE_PROVIDERS,
  LANG_SENSITIVE_PROVIDERS,
} from '@/lib/translation/provider-blocking';

// Mock clientLogger
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Provider Blocking System', () => {
  beforeEach(() => {
    resetProviderBlocks();
  });

  describe('blockProvider (permanent)', () => {
    it('should permanently block a provider', () => {
      blockProvider('openai', true);
      expect(isProviderBlocked('openai')).toBe(true);
    });

    it('should keep provider blocked until reset', () => {
      blockProvider('anthropic', true);
      expect(isProviderBlocked('anthropic')).toBe(true);
      // Still blocked after time passes
      expect(isProviderBlocked('anthropic')).toBe(true);
    });
  });

  describe('blockProvider (cooldown)', () => {
    it('should temporarily block a provider', () => {
      blockProvider('gemini', false);
      expect(isProviderBlocked('gemini')).toBe(true);
    });

    it('should unblock after cooldown expires', () => {
      vi.useFakeTimers();
      blockProvider('openai', false);
      expect(isProviderBlocked('openai')).toBe(true);

      // Advance past cooldown (30s for paid providers)
      vi.advanceTimersByTime(31000);
      expect(isProviderBlocked('openai')).toBe(false);
      vi.useRealTimers();
    });

    it('should escalate cooldown on repeated failures', () => {
      vi.useFakeTimers();
      // First failure: base cooldown
      blockProvider('openai', false);
      vi.advanceTimersByTime(31000);
      expect(isProviderBlocked('openai')).toBe(false);

      // Second failure: 3x cooldown (90s)
      blockProvider('openai', false);
      vi.advanceTimersByTime(31000); // Only 31s passed
      expect(isProviderBlocked('openai')).toBe(true);
      vi.advanceTimersByTime(60000); // Total 91s
      expect(isProviderBlocked('openai')).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('resetProviderBlocks', () => {
    it('should clear all blocks and cooldowns', () => {
      blockProvider('openai', true);
      blockProvider('gemini', false);
      expect(isProviderBlocked('openai')).toBe(true);
      expect(isProviderBlocked('gemini')).toBe(true);

      resetProviderBlocks();
      expect(isProviderBlocked('openai')).toBe(false);
      expect(isProviderBlocked('gemini')).toBe(false);
    });
  });

  describe('isProviderBlocked', () => {
    it('should return false for non-blocked providers', () => {
      expect(isProviderBlocked('deepseek')).toBe(false);
    });
  });

  describe('FREE_PROVIDERS', () => {
    it('should include known free providers', () => {
      expect(FREE_PROVIDERS.has('mymemory')).toBe(true);
      expect(FREE_PROVIDERS.has('lingva')).toBe(true);
      expect(FREE_PROVIDERS.has('ollama')).toBe(true);
    });

    it('should not include paid providers', () => {
      expect(FREE_PROVIDERS.has('openai')).toBe(false);
      expect(FREE_PROVIDERS.has('anthropic')).toBe(false);
    });
  });

  describe('LANG_SENSITIVE_PROVIDERS', () => {
    it('should include web API providers', () => {
      expect(LANG_SENSITIVE_PROVIDERS.has('mymemory')).toBe(true);
      expect(LANG_SENSITIVE_PROVIDERS.has('lingva')).toBe(true);
    });
  });
});
