import { describe, it, expect } from 'vitest';
import { mergeGameLanguages, hasTargetLanguage } from '@/components/game-detail/target-language';

/**
 * La regola dietro l'etichetta «Italiano: già presente» della scheda gioco.
 * Dal 16/11/2026 la usa anche String it!, per avvisare prima di partire:
 * etichetta e avviso devono rispondere allo stesso modo, quindi la regola
 * sta in un posto solo.
 */
describe('mergeGameLanguages', () => {
  it('unisce file e store senza ripetere la stessa lingua', () => {
    expect(mergeGameLanguages(['English', 'Italian'], ['english', 'French'])).toEqual(['English', 'Italian', 'French']);
  });

  it('senza lingue dà una lista vuota', () => {
    expect(mergeGameLanguages([], [])).toEqual([]);
  });
});

describe('hasTargetLanguage', () => {
  it('trova la lingua di destinazione tra quelle del gioco', () => {
    expect(hasTargetLanguage(['English', 'Italian'], 'it')).toBe(true);
  });

  it('non la trova se il gioco non ce l\'ha', () => {
    expect(hasTargetLanguage(['English', 'Japanese'], 'it')).toBe(false);
  });

  it('non scambia lo spagnolo latinoamericano per italiano', () => {
    // Il caso M.O.L.E dell'11/08/2026: bandiere simili, lingue diverse.
    expect(hasTargetLanguage(['English', 'Spanish - Latin America'], 'it')).toBe(false);
  });

  it('conta le tabelle di localizzazione Unity, che la scansione dei file non vede', () => {
    expect(hasTargetLanguage(['English'], 'it', ['en', 'it'])).toBe(true);
    expect(hasTargetLanguage(['English'], 'it-IT', ['it'])).toBe(true);
    expect(hasTargetLanguage(['English'], 'it', ['en', 'fr'])).toBe(false);
  });
});
