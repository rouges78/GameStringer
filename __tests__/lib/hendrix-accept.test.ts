/**
 * acceptOfflineTranslation — validazione+riparazione del batch offline Hendrix.
 *
 * Prima: se il modello perdeva un control code la stringa veniva scartata e
 * ritentata per sempre. Ora l'auto-fix deterministico del guard prova a
 * ripararla; si scarta solo se nemmeno il fix ripristina i codici.
 */
import { describe, it, expect } from 'vitest';
import { acceptOfflineTranslation } from '@/lib/hendrix-translate';

describe('acceptOfflineTranslation', () => {
  it('accetta una traduzione con i codici intatti', () => {
    expect(
      acceptOfflineTranslation('\\C[3]Danger!\\C[0] HP: \\V[1]', '\\C[3]Pericolo!\\C[0] PV: \\V[1]')
    ).toBe('\\C[3]Pericolo!\\C[0] PV: \\V[1]');
  });

  it('scarta output vuoto o [ERRORE]', () => {
    expect(acceptOfflineTranslation('Hello', '')).toBeNull();
    expect(acceptOfflineTranslation('Hello', '[ERRORE] timeout')).toBeNull();
  });

  it('ripara una traduzione che ha perso un control code (append)', () => {
    const r = acceptOfflineTranslation('Gained %1 gold \\I[5]', 'Ottenuto %1 oro');
    expect(r).toBe('Ottenuto %1 oro \\I[5]');
  });

  it('ripara un token alterato con restore posizionale', () => {
    // Il modello ha trasformato {ITEM} in {OGGETTO}: stesso numero di token,
    // identità diversa → restore posizionale dal sorgente.
    const r = acceptOfflineTranslation('Use {ITEM} now', 'Usa {OGGETTO} adesso');
    expect(r).toBe('Usa {ITEM} adesso');
  });

  it('scarta se nemmeno il fix ripristina i codici', () => {
    // Il guard non cancella token inventati: l'output ha un codice ESTRANEO in
    // più che il fix non rimuove → codeKey diversa → scarto (retry al resume).
    const r = acceptOfflineTranslation('Plain text', 'Testo \\V[9] con codice inventato');
    expect(r).toBeNull();
  });

  it('accetta riordino dei codici richiesto dalla lingua', () => {
    // codeKey ordina i token: il riordino legittimo non causa scarto.
    const r = acceptOfflineTranslation('\\N[1] found \\I[7]', '\\I[7] trovato da \\N[1]');
    expect(r).toBe('\\I[7] trovato da \\N[1]');
  });
});
