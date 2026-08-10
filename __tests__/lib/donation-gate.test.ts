/**
 * Il freno sulla richiesta di supporto.
 *
 * PERCHÉ ESISTE — fino al 10/08/2026 il conteggio delle stringhe e la richiesta
 * di donazione erano invocati da UN SOLO componente, `translation-recommendation
 * .tsx`: la pipeline che simulava la barra 0→100 e annunciava traduzioni mai
 * fatte. Si chiedeva un contributo dopo un successo inventato, e si contavano
 * stringhe mai scritte. Ora la richiesta è agganciata a `verifiedOk`, l'unico
 * verdetto con prova d'effetto — e questa è la logica che decide OGNI QUANTO
 * si può chiedere.
 *
 * È logica pura e ha un solo modo di sbagliare che conta davvero: chiedere
 * troppo spesso. Il caso «una richiesta in meno» costa zero; «una di troppo»
 * costa un utente infastidito, e gli utenti qui si contano sulle dita.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  shouldAskForSupport,
  markSupportAsked,
  unlockSupporter,
  resetSupporter,
  addTranslationCount,
  getTranslationCount,
} from '@/lib/donation-gate';

const GIORNO = 86_400_000;

/** localStorage finto: i test girano in ambiente senza DOM completo. */
function installaStorage(iniziale: Record<string, string> = {}) {
  const dati = new Map(Object.entries(iniziale));
  const fake = {
    getItem: (k: string) => (dati.has(k) ? dati.get(k)! : null),
    setItem: (k: string, v: string) => { dati.set(k, String(v)); },
    removeItem: (k: string) => { dati.delete(k); },
    clear: () => dati.clear(),
  };
  vi.stubGlobal('localStorage', fake);
  return dati;
}

beforeEach(() => { installaStorage(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('shouldAskForSupport', () => {
  it('al primo successo si può chiedere', () => {
    expect(shouldAskForSupport()).toBe(true);
  });

  it('subito dopo aver chiesto, NON si richiede', () => {
    markSupportAsked();
    expect(shouldAskForSupport()).toBe(false);
  });

  it('a 29 giorni ancora no, a 31 sì', () => {
    installaStorage({ gameStringer_supportAskedAt: String(Date.now() - 29 * GIORNO) });
    expect(shouldAskForSupport()).toBe(false);

    installaStorage({ gameStringer_supportAskedAt: String(Date.now() - 31 * GIORNO) });
    expect(shouldAskForSupport()).toBe(true);
  });

  it('a chi ha già donato non si chiede più, per quanto tempo passi', () => {
    installaStorage({ gameStringer_supportAskedAt: String(Date.now() - 400 * GIORNO) });
    unlockSupporter();
    expect(shouldAskForSupport()).toBe(false);

    // e togliendo lo stato supporter la richiesta torna possibile
    resetSupporter();
    expect(shouldAskForSupport()).toBe(true);
  });

  it('una data illeggibile NON diventa un permesso a chiedere', () => {
    for (const spazzatura of ['', 'ieri', 'NaN', '-1', '0', '{}']) {
      installaStorage({ gameStringer_supportAskedAt: spazzatura });
      expect(shouldAskForSupport(), `valore: ${JSON.stringify(spazzatura)}`).toBe(false);
    }
  });

  it('una data nel futuro (orologio spostato) non autorizza a insistere', () => {
    installaStorage({ gameStringer_supportAskedAt: String(Date.now() + 10 * GIORNO) });
    expect(shouldAskForSupport()).toBe(false);
  });

  it('se lo storage esplode si tace, invece di chiedere a ogni patch', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage negato'); },
      setItem: () => { throw new Error('storage negato'); },
      removeItem: () => { throw new Error('storage negato'); },
    });
    expect(() => shouldAskForSupport()).not.toThrow();
    expect(shouldAskForSupport()).toBe(false);
    // e marcare la richiesta non deve far cadere la UI
    expect(() => markSupportAsked()).not.toThrow();
  });
});

describe('conteggio stringhe', () => {
  it('accumula fra una traduzione e l\'altra', () => {
    expect(getTranslationCount()).toBe(0);
    addTranslationCount(1477);   // Mouthwashing, il primo gioco reale
    addTranslationCount(329);    // le righe di Danganronpa fatte finora
    expect(getTranslationCount()).toBe(1806);
  });

  it('sopravvive a uno storage rotto senza propagare l\'errore', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('negato'); },
      setItem: () => { throw new Error('negato'); },
    });
    expect(() => addTranslationCount(10)).not.toThrow();
    expect(getTranslationCount()).toBe(0);
  });
});
