import { describe, it, expect } from 'vitest';
import {
  LANG_NAMES,
  NLLB_LANG_MAP,
  LANG_TO_CODE,
  LANG_PROVIDER_AFFINITY,
  normalizeLangCode,
} from '@/lib/translation/language-mappings';

describe('LANG_NAMES', () => {
  it('should contain all major languages', () => {
    expect(LANG_NAMES['en']).toBe('English');
    expect(LANG_NAMES['it']).toBe('Italian');
    expect(LANG_NAMES['ja']).toBe('Japanese');
    expect(LANG_NAMES['zh']).toBe('Chinese');
    expect(LANG_NAMES['ko']).toBe('Korean');
    expect(LANG_NAMES['de']).toBe('German');
    expect(LANG_NAMES['fr']).toBe('French');
    expect(LANG_NAMES['es']).toBe('Spanish');
    expect(LANG_NAMES['ru']).toBe('Russian');
    expect(LANG_NAMES['pt']).toBe('Portuguese');
  });

  it('should support Chinese variants', () => {
    expect(LANG_NAMES['zh-Hans']).toBe('Simplified Chinese');
    expect(LANG_NAMES['zh-Hant']).toBe('Traditional Chinese');
  });
});

describe('NLLB_LANG_MAP', () => {
  it('should map ISO codes to NLLB format', () => {
    expect(NLLB_LANG_MAP['en']).toBe('eng_Latn');
    expect(NLLB_LANG_MAP['it']).toBe('ita_Latn');
    expect(NLLB_LANG_MAP['ja']).toBe('jpn_Jpan');
    expect(NLLB_LANG_MAP['ru']).toBe('rus_Cyrl');
    expect(NLLB_LANG_MAP['ar']).toBe('arb_Arab');
  });

  it('should use correct script identifiers', () => {
    // Latin script languages
    expect(NLLB_LANG_MAP['fr']).toMatch(/_Latn$/);
    expect(NLLB_LANG_MAP['de']).toMatch(/_Latn$/);
    // Cyrillic script languages
    expect(NLLB_LANG_MAP['ru']).toMatch(/_Cyrl$/);
    expect(NLLB_LANG_MAP['bg']).toMatch(/_Cyrl$/);
  });
});

describe('LANG_TO_CODE', () => {
  it('should map language names to ISO codes', () => {
    expect(LANG_TO_CODE['Italian']).toBe('it');
    expect(LANG_TO_CODE['English']).toBe('en');
    expect(LANG_TO_CODE['Japanese']).toBe('ja');
  });
});

describe('normalizeLangCode', () => {
  it('should normalize to uppercase', () => {
    expect(normalizeLangCode('en')).toBe('EN');
    expect(normalizeLangCode('it')).toBe('IT');
  });

  it('should strip regional variants', () => {
    expect(normalizeLangCode('zh-Hans')).toBe('ZH');
    expect(normalizeLangCode('pt-BR')).toBe('PT');
  });

  it('should handle empty string', () => {
    expect(normalizeLangCode('')).toBe('');
  });

  it('should resolve full language names', () => {
    expect(normalizeLangCode('Italian')).toBe('IT');
    expect(normalizeLangCode('Japanese')).toBe('JA');
  });
});

describe('LANG_PROVIDER_AFFINITY', () => {
  it('should have affinity rankings for Japanese', () => {
    expect(LANG_PROVIDER_AFFINITY['JA']).toBeDefined();
    expect(Array.isArray(LANG_PROVIDER_AFFINITY['JA'])).toBe(true);
    expect(LANG_PROVIDER_AFFINITY['JA'].length).toBeGreaterThan(0);
  });

  it('should have affinity rankings for major CJK languages', () => {
    expect(LANG_PROVIDER_AFFINITY['JA']).toBeDefined();
    expect(LANG_PROVIDER_AFFINITY['KO']).toBeDefined();
    expect(LANG_PROVIDER_AFFINITY['ZH']).toBeDefined();
  });

  it('should have affinity rankings for European languages', () => {
    expect(LANG_PROVIDER_AFFINITY['IT']).toBeDefined();
    expect(LANG_PROVIDER_AFFINITY['DE']).toBeDefined();
    expect(LANG_PROVIDER_AFFINITY['FR']).toBeDefined();
  });
});
