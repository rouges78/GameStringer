/**
 * Il Binary Patcher scriveva su disco `fileBuffer` (l'originale) invece di
 * `result.patchedBuffer`, sotto un verde «Patch completata!». Questi test
 * fissano il contratto di applyPatch su cui ora poggia la pagina:
 * - la traduzione sta SOLO in patchedBuffer, il buffer passato resta intatto;
 * - success è false quando non c'è niente da scrivere (la pagina rifiuta);
 * - conta solo isTranslated: una stringa con `translated` ma senza flag non
 *   viene scritta (per questo il ramo AI della pagina deve impostarlo).
 */
import { describe, it, expect } from 'vitest';
import { applyPatch, extractStringsFromBuffer, fitToByteLength, translateStrings, type BinaryString } from '@/lib/patchers/binary-string-patcher';

const enc = new TextEncoder();
const dec = new TextDecoder();

function makeBinary(text: string, offset: number, size = 64): Uint8Array {
  const buf = new Uint8Array(size);
  buf.set(enc.encode(text), offset);
  return buf;
}

describe('applyPatch', () => {
  const original = 'Start game now';
  const offset = 10;

  it('scrive la traduzione in patchedBuffer e lascia intatto il buffer di partenza', () => {
    const buf = makeBinary(original, offset);
    const before = buf.slice();
    const translated = fitToByteLength('Inizia ora', enc.encode(original).length);
    const strings: BinaryString[] = [
      { offset, byteLen: enc.encode(original).length, original, translated, isTranslated: true },
    ];

    const result = applyPatch(buf, strings);

    expect(result.success).toBe(true);
    expect(result.patchedCount).toBe(1);
    expect(result.patchedBuffer).toBeDefined();
    const patched = result.patchedBuffer!;
    expect(dec.decode(patched.slice(offset, offset + enc.encode(original).length))).toBe(translated);
    // L'originale non è stato toccato: salvarlo significherebbe salvare il gioco non tradotto.
    expect(Array.from(buf)).toEqual(Array.from(before));
    expect(Array.from(patched)).not.toEqual(Array.from(buf));
  });

  it('success false quando nessuna stringa è da scrivere', () => {
    const buf = makeBinary(original, offset);
    const result = applyPatch(buf, [
      { offset, byteLen: enc.encode(original).length, original },
    ]);
    expect(result.success).toBe(false);
    expect(result.patchedCount).toBe(0);
  });

  it('una stringa con translated ma senza isTranslated non viene scritta', () => {
    const buf = makeBinary(original, offset);
    const translated = fitToByteLength('Inizia ora', enc.encode(original).length);
    const result = applyPatch(buf, [
      { offset, byteLen: enc.encode(original).length, original, translated },
    ]);
    expect(result.success).toBe(false);
    expect(result.skippedCount).toBe(1);
  });

  it("rifiuta (e segnala) una traduzione la cui lunghezza in byte non coincide", () => {
    const buf = makeBinary(original, offset);
    const result = applyPatch(buf, [
      { offset, byteLen: enc.encode(original).length, original, translated: 'troppo corta', isTranslated: true },
    ]);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

/**
 * Visto a schermo su DELTARUNE.exe il 17/11/2026: con «Basato su regole» EN→IT
 * la patch scriveva 3 «stringhe» che erano codice e dati. Sequenze che non sono
 * UTF-8 valido (C0 89, overlong) o che iniziano con un BOM non tornano uguali
 * dopo decodifica e ricodifica: fitToByteLength le cambiava, translateStrings
 * le marcava tradotte e applyPatch le scriveva sopra le istruzioni.
 */
describe('extractStringsFromBuffer: solo byte che tornano identici', () => {
  function roundTrip(bytes: number[]): { buf: Uint8Array; patched: Uint8Array | undefined; count: number } {
    const buf = new Uint8Array(64);
    buf.set(bytes, 8);
    const strings = translateStrings(extractStringsFromBuffer(buf), 'en', 'it');
    const result = applyPatch(buf, strings);
    return { buf, patched: result.patchedBuffer, count: result.patchedCount };
  }

  it('non tocca un frammento di codice macchina che somiglia a testo', () => {
    // «L$ SUW3» + xor eax,eax / mov [esp+..],eax: C0 89 passa per UTF-8 a 2 byte.
    const code = [...enc.encode('L$ SUW3'), 0xc0, 0x89, 0x44, 0x24];
    const { buf, patched, count } = roundTrip(code);
    expect(count).toBe(0);
    if (patched) expect(Array.from(patched)).toEqual(Array.from(buf));
  });

  it('non tocca un testo preceduto da BOM', () => {
    const xml = [0xef, 0xbb, 0xbf, ...enc.encode('<?xml version="1.0" standalone="yes"?>')];
    const { buf, patched, count } = roundTrip(xml);
    expect(count).toBe(0);
    if (patched) expect(Array.from(patched)).toEqual(Array.from(buf));
  });

  it('estrae ancora il testo UTF-8 valido con accenti', () => {
    const buf = new Uint8Array(64);
    buf.set(enc.encode('La città perduta'), 8);
    const found = extractStringsFromBuffer(buf, { filterNoise: false });
    expect(found.map(s => s.original)).toEqual(['La città perduta']);
  });
});
