import { describe, it, expect } from 'vitest';
import { effectVerdict, type EffectVerification } from '@/lib/translation/effect-verdict';

/**
 * Il verdetto decide che cosa l'utente crede sia successo al suo gioco.
 * Origine: triage 26/07/2026, «Tradotto al 100%, ma il gioco resta in inglese».
 *
 * Si è rotto due volte, e ciascun modo di sbagliare ha qui il suo test:
 *  - 28/07: verde concesso senza scritture reali (la verifica non poteva fallire);
 *  - 29/07: «il gioco è rimasto com'era» dopo una patch riuscita.
 */

/** Un run in cui il patcher ha scritto davvero e il file si trova. */
function scritturaReale(over: Partial<EffectVerification> = {}): EffectVerification {
  return {
    checked: 1,
    verified: 1,
    missing: [],
    verifiedNames: ['GameMaker Patch (1477 strings)'],
    stringsWritten: 1477,
    runtimeOnly: false,
    ...over,
  };
}

describe('effectVerdict', () => {
  describe('quando il gioco è stato cambiato davvero', () => {
    it('dà il verde se il patcher ha scritto e il file si trova', () => {
      const v = effectVerdict(scritturaReale());
      expect(v.verifiedOk).toBe(true);
      expect(v.tone).toBe('emerald');
      expect(v.stringsWritten).toBe(1477);
      expect(v.nothingWritten).toBe(false);
    });

    it('dà il verde alla traduzione a runtime, che per costruzione non scrive stringhe', () => {
      // BepInEx/XUnity: zero scritture è il comportamento CORRETTO. Trattarlo
      // come fallimento manderebbe l'utente a cercare un guasto inesistente.
      const v = effectVerdict({
        checked: 1, verified: 1, missing: [],
        verifiedNames: ['BepInEx + XUnity.AutoTranslator'],
        stringsWritten: 0, runtimeOnly: true,
      });
      expect(v.verifiedOk).toBe(true);
      expect(v.runtimeOnly).toBe(true);
      expect(v.nothingWritten).toBe(false);
    });
  });

  describe('il difetto del 28/07: il verde era garantito', () => {
    it('NON dà il verde se il motore dichiara il successo senza aver scritto niente', () => {
      // Era «100% con 0 errori» col gioco ancora in inglese: i file dichiarati
      // esistevano tutti — la cartella del gioco esiste sempre — ma nei file
      // non era entrato niente.
      const v = effectVerdict(scritturaReale({ stringsWritten: 0, verifiedNames: [] }));
      expect(v.verifiedOk).toBe(false);
      expect(v.tone).toBe('amber');
      expect(v.nothingWritten).toBe(true);
    });

    it('il verde non si concede mai senza una scrittura o un loader a runtime', () => {
      // L'invariante che riassume l'intera vicenda. Se un giorno cade, il
      // difetto del 28/07 è tornato: ogni caso qui sotto ha la controprova su
      // disco perfetta e nessuna scrittura reale.
      const senzaProva: EffectVerification[] = [
        { checked: 9, verified: 9, missing: [], verifiedNames: ['report', 'backup'], stringsWritten: 0 },
        { checked: 1, verified: 1, missing: [], verifiedNames: ['b'], stringsWritten: 0, runtimeOnly: false },
        { checked: 1, verified: 1, missing: [], verifiedNames: ['c'] },
      ];
      for (const c of senzaProva) {
        const v = effectVerdict(c);
        expect(v.verifiedOk, JSON.stringify(c)).toBe(false);
        expect(v.partial, JSON.stringify(c)).toBe(false);
      }
    });
  });

  describe('il difetto del 29/07: la bugia pessimistica', () => {
    it('senza dati di verifica non accusa: ammette di non sapere, non dichiara il fallimento', () => {
      const v = effectVerdict(undefined);
      expect(v.unverified).toBe(true);
      expect(v.nothingWritten).toBe(false); // non sappiamo, non "non è entrato niente"
    });

    it('un conteggio ASSENTE non vale come conteggio a zero', () => {
      // La distinzione che dà due messaggi diversi all'utente. Con `?? 0` il
      // campo mancante diventerebbe la certezza «non è entrato niente»: una
      // bugia, solo nella direzione opposta a quella del 28/07.
      const assente = effectVerdict({ checked: 1, verified: 1, missing: [], verifiedNames: ['x'] });
      const zeroDichiarato = effectVerdict(scritturaReale({ stringsWritten: 0 }));

      expect(assente.nothingWritten).toBe(false);
      expect(zeroDichiarato.nothingWritten).toBe(true);
      // Entrambi restano ambra: nessuno dei due merita il verde.
      expect(assente.tone).toBe('amber');
      expect(zeroDichiarato.tone).toBe('amber');
    });
  });

  describe('gli esiti intermedi', () => {
    it('è parziale quando ha scritto ma un file dichiarato non si trova', () => {
      const v = effectVerdict(scritturaReale({
        checked: 2, verified: 1, missing: ['C:/Games/X/data/mancante.json'],
      }));
      expect(v.partial).toBe(true);
      expect(v.verifiedOk).toBe(false);
      expect(v.missing).toHaveLength(1);
    });

    it('non dà il verde se ha scritto ma nessun deliverable regge la controprova', () => {
      // Caso reale con un solo patcher: ha scritto, ma il percorso dichiarato
      // non esiste. verified=0 esclude sia il verde sia il parziale.
      const v = effectVerdict(scritturaReale({
        verified: 0, verifiedNames: [], missing: ['C:/Games/X/data.win'],
      }));
      expect(v.verifiedOk).toBe(false);
      expect(v.partial).toBe(false);
      expect(v.unverified).toBe(true);
      // Ha scritto, quindi non è il caso «non è entrato niente».
      expect(v.nothingWritten).toBe(false);
    });

    it('nemmeno il runtime prende il verde se il loader dichiarato non si trova', () => {
      const v = effectVerdict({
        checked: 1, verified: 0, missing: ['C:/Games/X/BepInEx'],
        verifiedNames: [], stringsWritten: 0, runtimeOnly: true,
      });
      expect(v.verifiedOk).toBe(false);
      expect(v.unverified).toBe(true);
    });
  });

  describe('invarianti', () => {
    it('espone sempre campi utilizzabili, anche senza verifica', () => {
      // Serve a chi disegna la UI: niente oggetto opzionale da maneggiare.
      const v = effectVerdict(undefined);
      expect(v.stringsWritten).toBe(0);
      expect(v.runtimeOnly).toBe(false);
      expect(v.verified).toBe(0);
      expect(v.missing).toEqual([]);
      expect(v.verifiedNames).toEqual([]);
    });

    it('esattamente un esito è attivo, su casi che coprono tutti e tre i rami', () => {
      const casi: { nome: string; v: EffectVerification | undefined; atteso: 'verifiedOk' | 'partial' | 'unverified' }[] = [
        { nome: 'scrittura piena', v: scritturaReale(), atteso: 'verifiedOk' },
        { nome: 'runtime', v: { checked: 1, verified: 1, missing: [], verifiedNames: ['x'], runtimeOnly: true }, atteso: 'verifiedOk' },
        { nome: 'scritto ma un file manca', v: scritturaReale({ checked: 2, missing: ['x'] }), atteso: 'partial' },
        { nome: 'nessuna scrittura', v: scritturaReale({ stringsWritten: 0 }), atteso: 'unverified' },
        { nome: 'controprova fallita', v: scritturaReale({ verified: 0 }), atteso: 'unverified' },
        { nome: 'nessun dato', v: undefined, atteso: 'unverified' },
      ];
      for (const { nome, v, atteso } of casi) {
        const r = effectVerdict(v);
        expect([r.verifiedOk, r.partial, r.unverified].filter(Boolean), `${nome}: esiti simultanei`).toHaveLength(1);
        expect(r[atteso], `${nome}: atteso ${atteso}`).toBe(true);
      }
    });

    it('il verde è riservato al solo esito verificato', () => {
      // Non ripete l'implementazione: elenca i casi e pretende il colore.
      expect(effectVerdict(scritturaReale()).tone).toBe('emerald');
      expect(effectVerdict(scritturaReale({ checked: 2, missing: ['x'] })).tone).toBe('amber');
      expect(effectVerdict(scritturaReale({ stringsWritten: 0 })).tone).toBe('amber');
      expect(effectVerdict(undefined).tone).toBe('amber');
    });
  });
});
