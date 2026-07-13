/**
 * Corpus fixture engine — sottotitoli (lib/subtitle-parser.ts).
 *
 * Fixture SRT/VTT/ASS realistiche. Il contratto critico del Subtitle
 * Translator è: i TEMPI non si toccano mai, si traduce solo il testo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseSubtitles, detectFormat, serializeSubtitles,
  extractTexts, applyTranslations,
} from '@/lib/subtitle-parser';

const FIXTURES = join(__dirname, '..', 'fixtures', 'engines', 'subtitles');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf-8');

const CASES = [
  { file: 'sample.srt', format: 'srt' as const, cues: 3 },
  { file: 'sample.vtt', format: 'vtt' as const, cues: 2 },
  { file: 'sample.ass', format: 'ass' as const, cues: 2 },
];

describe.each(CASES)('sottotitoli $format ($file)', ({ file, format, cues }) => {
  const content = read(file);

  it('viene rilevato e parsato', () => {
    expect(detectFormat(content)).toBe(format);
    const parsed = parseSubtitles(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.entries.length).toBe(cues);
  });

  it('estrae i testi con la prima battuta attesa', () => {
    const parsed = parseSubtitles(content)!;
    const texts = extractTexts(parsed);
    expect(texts[0]).toContain('Welcome to the kingdom of Eldoria');
  });

  it('traduzione: i tempi restano identici, il testo cambia', () => {
    const parsed = parseSubtitles(content)!;
    const originalTimes = parsed.entries.map(c => [c.startMs, c.endMs]);
    const texts = extractTexts(parsed);
    const translated = applyTranslations(parsed, texts.map(t => `[IT] ${t}`));

    expect(translated.entries.map(c => [c.startMs, c.endMs])).toEqual(originalTimes);

    // Round-trip: serializza e ri-parsa nello stesso formato
    const serialized = serializeSubtitles(translated, format);
    expect(serialized).toContain('[IT]');
    const reparsed = parseSubtitles(serialized, format);
    expect(reparsed).not.toBeNull();
    expect(reparsed!.entries.length).toBe(cues);
    expect(reparsed!.entries.map(c => [c.startMs, c.endMs])).toEqual(originalTimes);
    expect(extractTexts(reparsed!)[0]).toContain('[IT]');
  });
});

describe('robustezza', () => {
  it('contenuto non-sottotitolo → null, senza lanciare', () => {
    expect(parseSubtitles('questo non è un sottotitolo')).toBeNull();
  });
});
