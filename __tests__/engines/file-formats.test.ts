/**
 * Corpus fixture engine — formati di localizzazione (lib/file-parsers.ts).
 *
 * Ogni fixture in __tests__/fixtures/engines/formats/ è un mini-catalogo
 * realistico. I test coprono l'intero ciclo del patcher file-based:
 * rileva formato → estrai stringhe → applica traduzioni → riscrivi →
 * ri-estrai e verifica. Se un parser regredisce, questi test lo dicono
 * al commit, non al primo utente.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectFormat, parseFile, writeFile,
  type FileFormat, type ParseResult,
} from '@/lib/file-parsers';

const FIXTURES = join(__dirname, '..', 'fixtures', 'engines', 'formats');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf-8');

interface Case {
  file: string;
  format: FileFormat;
  minStrings: number;
  /** una stringa sorgente che DEVE essere estratta */
  mustContain: string;
}

const CASES: Case[] = [
  // NB semantica value: PO → msgstr (se presente); XLIFF → target || source.
  { file: 'sample.po', format: 'po', minStrings: 3, mustContain: 'Non passerai, {player}!' },
  { file: 'sample.xliff', format: 'xliff', minStrings: 3, mustContain: "Inizia l'avventura" },
  { file: 'sample.resx', format: 'resx', minStrings: 3, mustContain: 'You won the battle!' },
  { file: 'sample.strings', format: 'strings', minStrings: 3, mustContain: 'Critical hit!' },
  { file: 'sample.json', format: 'json', minStrings: 5, mustContain: 'Hello, traveler.' },
  { file: 'sample.ini', format: 'ini', minStrings: 3, mustContain: 'You are victorious!' },
  { file: 'sample.properties', format: 'properties', minStrings: 3, mustContain: 'Victory!' },
  // CSV a 3 colonne: value = colonna traduzione
  { file: 'sample.csv', format: 'csv', minStrings: 3, mustContain: 'Inizia partita' },
];

describe.each(CASES)('formato $format ($file)', ({ file, format, minStrings, mustContain }) => {
  const content = read(file);

  it('viene rilevato correttamente', () => {
    expect(detectFormat(content, file)).toBe(format);
  });

  it(`estrae almeno ${minStrings} stringhe, inclusa quella attesa`, () => {
    const result = parseFile(content, file);
    expect(result.strings.length).toBeGreaterThanOrEqual(minStrings);
    const values = result.strings.map(s => s.value);
    expect(values).toContain(mustContain);
    // Nessuna stringa estratta deve essere vuota
    for (const s of result.strings) {
      expect(s.key.length).toBeGreaterThan(0);
    }
  });

  it('round-trip: scrivi con traduzioni → ri-estrai → traduzioni presenti', () => {
    const result: ParseResult = parseFile(content, file);
    const translations = new Map<string, string>();
    // Traduci ogni stringa con un marcatore deterministico
    for (const s of result.strings) {
      translations.set(s.key, `[IT] ${s.value}`);
    }
    const rewritten = writeFile(result, translations);
    expect(rewritten.length).toBeGreaterThan(0);

    const reparsed = parseFile(rewritten, file);
    expect(reparsed.strings.length).toBeGreaterThanOrEqual(minStrings);
    const reValues = reparsed.strings.map(s => s.value);
    expect(reValues).toContain(`[IT] ${mustContain}`);
  });
});

describe('placeholder e caratteri speciali', () => {
  it('i placeholder {var} sopravvivono al round-trip PO', () => {
    const result = parseFile(read('sample.po'), 'sample.po');
    const withPlaceholder = result.strings.find(s => s.value.includes('{player}'));
    expect(withPlaceholder).toBeDefined();
    const translations = new Map([[withPlaceholder!.key, 'Non passerai, {player}!']]);
    const rewritten = writeFile(result, translations);
    expect(rewritten).toContain('{player}');
  });
});
