/**
 * Corpus fixture engine — copertura font (lib/font-coverage.ts).
 *
 * Le fixture sono subset REALI di DejaVuSans (fonttools):
 * - latin-only.ttf   → solo latino: per ru/el/ja deve risultare scoperto (□□□)
 * - latin-cyr-el.ttf → latino + cirillico + greco: copre ru/el, NON ja/zh/ko
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseFontCoverage, coverageForScript, analyzeFontForLanguage, scriptsForLanguage,
} from '@/lib/font-coverage';

const FIXTURES = join(__dirname, '..', 'fixtures', 'engines', 'fonts');
function load(name: string): ArrayBuffer {
  const buf = readFileSync(join(FIXTURES, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('parseFontCoverage', () => {
  it('parsa un TTF reale e trova i glifi latini', () => {
    const font = parseFontCoverage(load('latin-only.ttf'));
    expect(font).not.toBeNull();
    expect(font!.hasGlyph('A'.codePointAt(0)!)).toBe(true);
    expect(font!.hasGlyph('z'.codePointAt(0)!)).toBe(true);
    expect(font!.hasGlyph('è'.codePointAt(0)!)).toBe(true);
  });

  it('riconosce i glifi ASSENTI (cirillico/greco/kana nel font solo-latino)', () => {
    const font = parseFontCoverage(load('latin-only.ttf'));
    expect(font!.hasGlyph('Я'.codePointAt(0)!)).toBe(false);
    expect(font!.hasGlyph('Ω'.codePointAt(0)!)).toBe(false);
    expect(font!.hasGlyph('あ'.codePointAt(0)!)).toBe(false);
    expect(font!.hasGlyph(0x4e00)).toBe(false); // 一 (CJK)
  });

  it('input non-font → null, senza lanciare', () => {
    expect(parseFontCoverage(new TextEncoder().encode('not a font').buffer as ArrayBuffer)).toBeNull();
    expect(parseFontCoverage(new ArrayBuffer(4))).toBeNull();
  });
});

describe('coverageForScript', () => {
  it('latin-only: latino ≥95%, cirillico ~0%', () => {
    const font = parseFontCoverage(load('latin-only.ttf'))!;
    expect(coverageForScript(font, 'latin').percent).toBeGreaterThanOrEqual(95);
    const cyr = coverageForScript(font, 'cyrillic');
    expect(cyr.percent).toBeLessThan(10);
    expect(cyr.missingSamples.length).toBeGreaterThan(0);
  });

  it('latin-cyr-el: cirillico e greco coperti, hangul no', () => {
    const font = parseFontCoverage(load('latin-cyr-el.ttf'))!;
    expect(coverageForScript(font, 'cyrillic').percent).toBeGreaterThanOrEqual(95);
    expect(coverageForScript(font, 'greek').percent).toBeGreaterThanOrEqual(95);
    expect(coverageForScript(font, 'hangul').percent).toBe(0);
  });
});

describe('analyzeFontForLanguage', () => {
  it('russo su font solo-latino → NOT ok (□□□ previsti)', () => {
    const report = analyzeFontForLanguage(load('latin-only.ttf'), 'ru');
    expect(report).not.toBeNull();
    expect(report!.ok).toBe(false);
    const cyr = report!.byScript.find(s => s.script === 'cyrillic');
    expect(cyr!.percent).toBeLessThan(10);
  });

  it('russo e greco su font latin-cyr-el → ok', () => {
    expect(analyzeFontForLanguage(load('latin-cyr-el.ttf'), 'ru')!.ok).toBe(true);
    expect(analyzeFontForLanguage(load('latin-cyr-el.ttf'), 'el')!.ok).toBe(true);
  });

  it('giapponese su font latin-cyr-el → NOT ok', () => {
    expect(analyzeFontForLanguage(load('latin-cyr-el.ttf'), 'ja')!.ok).toBe(false);
  });
});

describe('scriptsForLanguage', () => {
  it.each([
    ['it', ['latinExt', 'latin']],
    ['ru-RU', ['cyrillic', 'latin']],
    ['ja', ['hiragana', 'katakana', 'cjk', 'latin']],
    ['zh_CN', ['cjk', 'latin']],
    ['ko', ['hangul', 'latin']],
    ['el', ['greek', 'latin']],
    ['vi', ['vietnamese', 'latinExt', 'latin']],
  ])('%s → %j', (lang, expected) => {
    expect(scriptsForLanguage(lang as string)).toEqual(expected);
  });
});
