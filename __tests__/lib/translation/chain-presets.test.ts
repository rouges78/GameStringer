import { describe, it, expect } from 'vitest';
import {
  CHAIN_PRESETS,
  setChainPreset,
  getChainPreset,
  getActiveChainPreset,
} from '@/lib/translation/chain-presets';
import type { ChainPreset, ChainPresetInfo } from '@/lib/translation/chain-presets';

// Mock dependencies
import { vi } from 'vitest';
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Chain Presets', () => {
  describe('CHAIN_PRESETS', () => {
    it('should define all preset tiers', () => {
      const ids = CHAIN_PRESETS.map(p => p.id);
      expect(ids).toContain('free');
      expect(ids).toContain('economy');
      expect(ids).toContain('balanced');
      expect(ids).toContain('quality');
      expect(ids).toContain('max_quality');
      expect(ids).toContain('auto');
    });

    it('each preset should have required fields', () => {
      for (const preset of CHAIN_PRESETS) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(Array.isArray(preset.providers)).toBe(true);
        // 'auto' preset may have empty providers (built dynamically)
        if (preset.id !== 'auto') {
          expect(preset.providers.length).toBeGreaterThan(0);
        }
      }
    });

    it('free preset should only contain free providers', () => {
      const freePreset = CHAIN_PRESETS.find(p => p.id === 'free');
      expect(freePreset).toBeDefined();
      // Free preset should NOT contain paid providers like 'openai', 'anthropic'
      expect(freePreset!.providers).not.toContain('openai');
      expect(freePreset!.providers).not.toContain('anthropic');
    });

    it('max_quality preset should include premium providers', () => {
      const maxQuality = CHAIN_PRESETS.find(p => p.id === 'max_quality');
      expect(maxQuality).toBeDefined();
      // Should include at least one premium provider
      const hasPremium = maxQuality!.providers.some(p =>
        ['openai', 'anthropic', 'gemini', 'gpt5', 'claude'].includes(p)
      );
      expect(hasPremium).toBe(true);
    });
  });

  describe('setChainPreset / getChainPreset', () => {
    it('should set and get preset', () => {
      setChainPreset('economy');
      expect(getChainPreset()).toBe('economy');
    });

    it('should return a string preset', () => {
      setChainPreset('balanced');
      const preset = getChainPreset();
      expect(typeof preset).toBe('string');
      expect(preset).toBe('balanced');
    });

    it('should accept all valid presets', () => {
      const validPresets: ChainPreset[] = ['free', 'economy', 'balanced', 'quality', 'max_quality', 'auto'];
      for (const p of validPresets) {
        setChainPreset(p);
        expect(getChainPreset()).toBe(p);
      }
    });
  });

  describe('getActiveChainPreset', () => {
    it('should return the current preset string', () => {
      setChainPreset('balanced');
      const active = getActiveChainPreset();
      expect(active).toBe('balanced');
    });

    it('should reflect changes from setChainPreset', () => {
      setChainPreset('free');
      expect(getActiveChainPreset()).toBe('free');
      setChainPreset('quality');
      expect(getActiveChainPreset()).toBe('quality');
    });
  });
});
