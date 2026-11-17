/**
 * applyTranslations (lib/subtitle-parser.ts). Prima una riga tornata '' (traduzione
 * fallita) diventava `translatedText = entry.text`: il sorgente spacciato per
 * tradotto (spunta verde nella lista) e la modifica manuale precedente persa.
 */
import { describe, it, expect } from 'vitest';
import { applyTranslations, serializeSubtitles, type SubtitleFile } from '@/lib/subtitle-parser';

function makeFile(): SubtitleFile {
  return {
    format: 'srt',
    entries: [
      { id: 1, startTime: '00:00:01,000', endTime: '00:00:02,000', startMs: 1000, endMs: 2000, text: 'Hello' },
      { id: 2, startTime: '00:00:03,000', endTime: '00:00:04,500', startMs: 3000, endMs: 4500, text: 'Goodbye' },
      { id: 3, startTime: '00:00:05,000', endTime: '00:00:06,000', startMs: 5000, endMs: 6000, text: 'Again', translatedText: 'Ancora (a mano)' },
    ],
  };
}

describe('applyTranslations', () => {
  it('una riga fallita (\'\') resta non tradotta, non diventa il sorgente', () => {
    const out = applyTranslations(makeFile(), ['Ciao', '', '']);
    expect(out.entries[0].translatedText).toBe('Ciao');
    expect(out.entries[1].translatedText).toBeUndefined();
  });

  it('una riga fallita non cancella la modifica manuale precedente', () => {
    const out = applyTranslations(makeFile(), ['Ciao', '', '']);
    expect(out.entries[2].translatedText).toBe('Ancora (a mano)');
  });

  it('una nuova traduzione sostituisce la precedente', () => {
    const out = applyTranslations(makeFile(), ['Ciao', 'Arrivederci', 'Di nuovo']);
    expect(out.entries.map(e => e.translatedText)).toEqual(['Ciao', 'Arrivederci', 'Di nuovo']);
  });

  it('array più corto: le righe mancanti restano come erano', () => {
    const out = applyTranslations(makeFile(), ['Ciao']);
    expect(out.entries[1].translatedText).toBeUndefined();
    expect(out.entries[2].translatedText).toBe('Ancora (a mano)');
  });

  it('l\'export tiene il testo originale e i tempi della riga non tradotta', () => {
    const out = applyTranslations(makeFile(), ['Ciao', '', '']);
    const srt = serializeSubtitles(out, 'srt');
    expect(srt).toContain('1\n00:00:01,000 --> 00:00:02,000\nCiao');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:04,500\nGoodbye');
    expect(srt).toContain('3\n00:00:05,000 --> 00:00:06,000\nAncora (a mano)');
  });
});
