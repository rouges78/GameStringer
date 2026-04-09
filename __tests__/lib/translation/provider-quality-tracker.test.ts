import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordProviderQuality,
  applyQualityHistory,
} from '@/lib/translation/provider-quality-tracker';

describe('Provider Quality Tracker', () => {
  // Note: the tracker uses module-level state. Tests run in sequence.

  describe('recordProviderQuality', () => {
    it('should record success without throwing', () => {
      expect(() => {
        recordProviderQuality('openai', 'it', 0.1, true);
      }).not.toThrow();
    });

    it('should record failure without throwing', () => {
      expect(() => {
        recordProviderQuality('gemini', 'ja', 0.8, false);
      }).not.toThrow();
    });

    it('should accumulate multiple records', () => {
      for (let i = 0; i < 5; i++) {
        recordProviderQuality('test-provider-acc', 'en', 0.05, true);
      }
      // The provider should now have history
      const chain = applyQualityHistory(['test-provider-acc', 'other'], 'en');
      expect(chain).toContain('test-provider-acc');
    });
  });

  describe('applyQualityHistory', () => {
    it('should return the same providers', () => {
      const chain = ['providerA', 'providerB', 'providerC'];
      const result = applyQualityHistory(chain, 'it');
      expect(result).toHaveLength(3);
      expect(result).toContain('providerA');
      expect(result).toContain('providerB');
      expect(result).toContain('providerC');
    });

    it('should not modify original array', () => {
      const chain = ['a', 'b', 'c'];
      const original = [...chain];
      applyQualityHistory(chain, 'de');
      expect(chain).toEqual(original);
    });

    it('should promote high-success providers', () => {
      // Record many successes for provider-good
      for (let i = 0; i < 10; i++) {
        recordProviderQuality('provider-good', 'fr', 0.02, true);
      }
      // Record many failures for provider-bad
      for (let i = 0; i < 10; i++) {
        recordProviderQuality('provider-bad', 'fr', 0.9, false);
      }

      const result = applyQualityHistory(['provider-bad', 'provider-good'], 'fr');
      // provider-good should be ranked higher (first)
      expect(result[0]).toBe('provider-good');
    });

    it('should not reorder with insufficient data', () => {
      const chain = ['new-a', 'new-b'];
      // Only 1 record each (below threshold of 3)
      recordProviderQuality('new-a', 'ko', 0.5, false);
      recordProviderQuality('new-b', 'ko', 0.1, true);

      const result = applyQualityHistory(chain, 'ko');
      // Should maintain original order with insufficient data
      expect(result).toEqual(chain);
    });
  });
});
