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
import { applyPatch, fitToByteLength, type BinaryString } from '@/lib/patchers/binary-string-patcher';

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
