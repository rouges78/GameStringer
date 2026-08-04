/**
 * Guard degli a capo reali (04/08/2026, Greed Stays Home).
 *
 * Il gioco impagina le note lunghe con \r\n dentro le stringhe; la catena di
 * traduzione li appiattiva (misurato: 169 a capo negli originali → 45 nelle
 * traduzioni) e a schermo le frasi uscivano come un'unica riga tagliata ai
 * bordi. Gli a capo sono formattazione che il gioco interpreta: garantiti
 * come le {variabili}, con auto-fix deterministico.
 */
import { describe, it, expect } from 'vitest';
import { autoFixLineBreaks, autoFixPlaceholders, countLineBreaks } from '@/lib/ai/placeholder-guard';

const CRLF_SRC =
  'After some time wandering, you leave the village behind, \r\n' +
  'along with the treasure hidden within it.\r\n' +
  'The only thing you managed to take with you is a small bracelet.';

describe('autoFixLineBreaks', () => {
  it('ripristina gli a capo persi, in proporzione, senza spezzare parole', () => {
    const flat =
      "Dopo un po' di vagabondaggio, lasci il villaggio alle spalle, insieme al tesoro " +
      "nascosto al suo interno. L'unica cosa che sei riuscito a portare con te è un piccolo braccialetto.";
    const fixed = autoFixLineBreaks(CRLF_SRC, flat);
    expect(countLineBreaks(fixed)).toBe(2);
    expect(fixed).toContain('\r\n');                    // stile ereditato dal sorgente
    for (const line of fixed.split('\r\n')) {
      expect(line).not.toMatch(/^\s|\s$/);              // niente spazi orfani ai bordi
    }
    // Nessuna parola persa né spezzata: riappiattito, il testo è identico
    expect(fixed.replace(/\r\n/g, ' ').replace(/ +/g, ' ')).toBe(flat);
  });

  it('non tocca la traduzione che ha già tutti gli a capo', () => {
    const ok = 'riga uno\r\nriga due\r\nriga tre';
    expect(autoFixLineBreaks('one\r\ntwo\r\nthree', ok)).toBe(ok);
  });

  it('non cancella a capo in più (stessa filosofia dei token inventati)', () => {
    const extra = 'riga uno\ndue\ntre';
    expect(autoFixLineBreaks('one\ntwo', extra)).toBe(extra);
  });

  it('è un no-op se il sorgente non ha a capo', () => {
    expect(autoFixLineBreaks('hello world', 'ciao mondo')).toBe('ciao mondo');
  });

  it('è idempotente', () => {
    const flat = 'una frase abbastanza lunga da essere spezzata in tre pezzi distinti senza problemi';
    const once = autoFixLineBreaks(CRLF_SRC, flat);
    expect(autoFixLineBreaks(CRLF_SRC, once)).toBe(once);
  });

  it('eredita LF quando il sorgente usa LF', () => {
    const fixed = autoFixLineBreaks('one\ntwo', 'prima parte seconda parte');
    expect(fixed).toContain('\n');
    expect(fixed).not.toContain('\r\n');
  });
});

describe('autoFixPlaceholders — composizione', () => {
  it('ripara token E a capo in un colpo solo', () => {
    const src = 'Hello {player},\r\nyou found %d coins.';
    const bad = 'Ciao amico, hai trovato delle monete.'; // persi {player}, %d e l\'a capo
    const fixed = autoFixPlaceholders(src, bad);
    expect(fixed).toContain('{player}');
    expect(fixed).toContain('%d');
    expect(countLineBreaks(fixed)).toBeGreaterThanOrEqual(1);
  });

  it('resta un no-op puro quando è tutto a posto', () => {
    const src = 'Hi {name}';
    const good = 'Ciao {name}';
    expect(autoFixPlaceholders(src, good)).toBe(good);
  });
});
