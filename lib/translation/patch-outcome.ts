/**
 * Esito di una run di traduzione: la regola in un posto solo.
 *
 * PERCHÉ ESISTE (15/08/2026)
 * Fino a ieri l'esito che finiva nella telemetria di compatibilità derivava da
 * `successRate`, che è la frazione di STADI del workflow completati. Un
 * workflow può completare tutti i suoi stadi — rilevamento, estrazione,
 * traduzione, patch — e non scrivere una sola riga dentro il gioco. Il
 * risultato era un database che certificava «riuscito» in 12 report su 12
 * senza una singola stringa a dimostrarlo, e un utente che leggeva
 * «completata al 100% con 0 errori» davanti a un gioco ancora in inglese.
 *
 * La regola nuova guarda le stringhe SCRITTE, non gli stadi finiti.
 *
 * Sta qui e non dentro il componente perché una regola che decide cosa
 * finisce nel database va potuta provare senza montare una pagina.
 */

export type PatchOutcome = 'success' | 'partial' | 'failure';

export interface PatchCounts {
  /** Stringhe trovate nel gioco. `undefined` = il client non le manda. */
  totalStrings?: number;
  /** Stringhe tradotte in memoria. NON è prova che il gioco sia cambiato. */
  translatedStrings?: number;
  /** Stringhe scritte davvero nei file di gioco: l'unica prova d'effetto. */
  injectedStrings?: number;
  /** true = hook a runtime (XUnity, gs-hook): zero stringhe scritte è CORRETTO. */
  runtimeTranslation?: boolean;
  /** Frazione di stadi completati. Usata solo come ripiego, mai come prova. */
  successRate?: number;
}

export interface PatchVerdict {
  outcome: PatchOutcome;
  /**
   * Numeri da mandare alla telemetria. `null` significa «non misurato» ed è un
   * fatto diverso da 0 («misurato, ed è zero»): la vista pubblica conta come
   * provate solo le run con un totale > 0, quindi mandare 0 al posto di null
   * riporterebbe indietro esattamente il difetto che questa regola chiude.
   */
  stringsTotal: number | null;
  stringsTranslated: number | null;
  /** true quando i conteggi ci sono e sono credibili. */
  measured: boolean;
}

/**
 * Decide l'esito di una run a partire dai conteggi reali.
 *
 * Le regole, in ordine:
 *  1. Traduzione a runtime → 'success' se il loader è a posto, ma SENZA
 *     conteggi: la prova non è quante stringhe sono state scritte (nessuna, ed
 *     è giusto così) ma il boot-check successivo.
 *  2. Conteggi assenti (client vecchio) → si ricade su `successRate`, ma i
 *     numeri restano `null`: non si dichiara provato ciò che non è misurato.
 *  3. Zero stringhe scritte → 'failure'. Non «parziale»: il gioco non è
 *     cambiato, e tutti gli stadi verdi del mondo non lo cambiano.
 *  4. Meno dell'80% scritto → 'partial'.
 *  5. Altrimenti → 'success'.
 */
export function decidePatchOutcome(c: PatchCounts): PatchVerdict {
  if (c.runtimeTranslation === true) {
    return { outcome: 'success', stringsTotal: null, stringsTranslated: null, measured: false };
  }

  const measured = typeof c.totalStrings === 'number' && typeof c.injectedStrings === 'number';
  if (!measured) {
    const rate = typeof c.successRate === 'number' ? c.successRate : 0;
    return {
      outcome: rate >= 0.8 ? 'success' : 'partial',
      stringsTotal: null,
      stringsTranslated: null,
      measured: false,
    };
  }

  const total = c.totalStrings as number;
  const injected = c.injectedStrings as number;

  let outcome: PatchOutcome;
  if (injected === 0) {
    outcome = 'failure';
  } else if (total > 0 && injected < total * 0.8) {
    outcome = 'partial';
  } else {
    outcome = 'success';
  }

  return { outcome, stringsTotal: total, stringsTranslated: injected, measured: true };
}
