/**
 * Test per la garanzia "solo diff" (redistribution-guard): un pack deve
 * contenere traduzioni, non testo originale del gioco.
 */

import { describe, it, expect } from 'vitest';
import { checkRedistribution } from '@/lib/redistribution-guard';
import type { GspackData, GspackFile, GspackGlossaryEntry } from '@/lib/gspack-manager';

function file(over: Partial<GspackFile>): GspackFile {
  return {
    path: over.path || 'a.json',
    originalPath: over.originalPath || 'a.json',
    content: over.content ?? '',
    format: over.format || 'json',
    stringCount: over.stringCount ?? 0,
    translatedCount: over.translatedCount ?? 0,
  };
}

function pack(files: GspackFile[], glossary: GspackGlossaryEntry[] = []): GspackData {
  return {
    manifest: { translation: {} } as unknown as GspackData['manifest'],
    files,
    glossary,
    notes: '',
  };
}

describe('checkRedistribution', () => {
  it('pack legittimo (alta % tradotta, contenuto normale) → ok', () => {
    const v = checkRedistribution(pack([
      file({ path: 'dialog.json', stringCount: 200, translatedCount: 190, content: 'x'.repeat(120_000) }),
    ]));
    expect(v.severity).toBe('ok');
    expect(v.flagged).toBe(false);
  });

  it('pack quasi non tradotto → block (per lo più originale)', () => {
    const v = checkRedistribution(pack([
      file({ path: 'dump.json', stringCount: 500, translatedCount: 20, content: 'x'.repeat(300_000) }),
    ]));
    expect(v.severity).toBe('block');
    expect(v.reasons.some(r => r.code === 'low-translation')).toBe(true);
  });

  it('glossario verbatim → segnalato', () => {
    const gloss: GspackGlossaryEntry[] = Array.from({ length: 20 }, (_, i) => ({
      source: `Term number ${i}`,
      target: `Term number ${i}`, // identico all'originale
    }));
    const v = checkRedistribution(
      pack([file({ path: 'ok.json', stringCount: 100, translatedCount: 90, content: 'x'.repeat(50_000) })], gloss)
    );
    expect(v.reasons.some(r => r.code === 'verbatim-glossary')).toBe(true);
    expect(v.flagged).toBe(true);
  });

  it('contenuto source-heavy (troppi byte per stringa tradotta) → segnalato', () => {
    const v = checkRedistribution(pack([
      file({ path: 'big.json', stringCount: 100, translatedCount: 90, content: 'x'.repeat(2_000_000) }),
    ]));
    expect(v.reasons.some(r => r.code === 'source-heavy-content')).toBe(true);
  });

  it('pack troppo piccolo → non giudicato (ok)', () => {
    const v = checkRedistribution(pack([
      file({ path: 'tiny.json', stringCount: 5, translatedCount: 0, content: 'x'.repeat(10_000) }),
    ]));
    expect(v.severity).toBe('ok');
  });

  it('più segnali insieme → block', () => {
    const gloss: GspackGlossaryEntry[] = Array.from({ length: 20 }, () => ({ source: 'Hello world', target: 'Hello world' }));
    const v = checkRedistribution(
      pack([file({ path: 'x.json', stringCount: 400, translatedCount: 30, content: 'x'.repeat(400_000) })], gloss)
    );
    expect(v.severity).toBe('block');
    expect(v.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
