/**
 * Il verdetto sull'EFFETTO di una traduzione: il gioco è cambiato davvero?
 *
 * Vive qui, fuori dal JSX, perché è la logica che decide che cosa l'utente
 * crede sia successo al suo gioco — ed è già stata sbagliata due volte in due
 * giorni:
 *
 *  - 28/07/2026: si verificava che i file dichiarati dai motori esistessero su
 *    disco. Ma cinque motori su sette dichiarano la CARTELLA DEL GIOCO, e
 *    report/backup/cartella traduzioni li scriviamo noi durante il run: il
 *    controllo non poteva fallire, quindi non verificava niente.
 *  - 29/07/2026: la correzione trattava come "non verificati" i percorsi rapidi
 *    che non popolavano il campo, facendo dire «il gioco è rimasto com'era»
 *    dopo una patch riuscita. Una bugia pessimistica al posto di una ottimistica.
 *
 * Origine: triage dei 64 messaggi del 26/07, voce «Tradotto al 100%, ma il
 * gioco resta in inglese» — 4 segnalazioni.
 */

import { PARTIAL_BELOW } from './patch-outcome';

export interface EffectVerification {
  /** Deliverable che pretendono di aver cambiato il gioco. */
  checked: number;
  /** Quanti reggono alla controprova su disco. */
  verified: number;
  /** Percorsi dichiarati ma assenti. */
  missing: string[];
  /** Nomi confermati, da mostrare all'utente come prova. */
  verifiedNames: string[];
  /**
   * Stringhe realmente scritte nei file del gioco.
   *
   * Opzionale, e l'assenza NON equivale a zero: "non lo so" e "non è entrato
   * niente" sono due messaggi diversi per l'utente, ed è la distinzione su cui
   * si è già sbagliato una volta.
   */
  stringsWritten?: number;
  /**
   * Stringhe trovate nel gioco. Opzionale: i percorsi che non lo misurano non
   * lo mandano, e senza totale non si può dire che un giro è incompleto.
   */
  stringsTotal?: number;
  /** Traduzione a runtime (BepInEx/XUnity): non c'è nulla da riscrivere. */
  runtimeOnly?: boolean;
}

export interface EffectVerdict {
  /** Il gioco è stato cambiato, e la controprova regge. */
  verifiedOk: boolean;
  /** Cambiato, ma qualche file dichiarato non si trova. */
  partial: boolean;
  /**
   * Cambiato e controprova a posto, ma è entrata meno dell'80% delle stringhe
   * trovate (16/11/2026: DELTARUNE al 68% usciva verde con «0 errori»).
   */
  incomplete: boolean;
  /** Non risulta che sia cambiato niente. */
  unverified: boolean;
  /** Colore del pannello. Il verde si merita, non si concede. */
  tone: 'emerald' | 'amber';
  /**
   * Vero solo quando il backend ha DETTO che le scritture sono zero — non
   * quando il dato manca. Nel primo caso si può affermare che nel gioco non è
   * entrato niente; nel secondo si può solo ammettere di non saperlo.
   */
  nothingWritten: boolean;

  // I campi seguenti sono la stessa verifica normalizzata, così chi disegna la
  // UI non deve maneggiare un oggetto opzionale (e non perde il narrowing).
  stringsWritten: number;
  /** Stringhe trovate e non scritte. `null` = totale non misurato, o runtime. */
  stringsLeft: number | null;
  runtimeOnly: boolean;
  verified: number;
  missing: string[];
  verifiedNames: string[];
}

/**
 * Il verde richiede QUATTRO cose insieme:
 *   1. una scrittura reale (`stringsWritten > 0`) oppure un loader a runtime;
 *   2. almeno un deliverable che regge la controprova (`verified > 0`);
 *   3. nessun percorso dichiarato risultato assente (`missing` vuoto);
 *   4. se il totale è noto, almeno l'80% delle stringhe scritto — la stessa
 *      soglia di `decidePatchOutcome`.
 *
 * Il conteggio del patcher è la prova PRINCIPALE; l'esistenza su disco è solo
 * una controprova. Invertire i due ruoli è esattamente l'errore del 28/07.
 */
export function effectVerdict(v: EffectVerification | undefined): EffectVerdict {
  const stringsWritten = v?.stringsWritten ?? 0;
  const runtimeOnly = v?.runtimeOnly === true;

  const wrote = stringsWritten > 0 || runtimeOnly;
  const changed = !!v && wrote && v.verified > 0;
  const partial = changed && v.missing.length > 0;

  const total = v?.stringsTotal;
  const stringsLeft =
    !runtimeOnly && typeof total === 'number' && total > 0
      ? Math.max(0, total - stringsWritten)
      : null;
  const incomplete =
    changed && !partial && stringsLeft !== null && stringsWritten < (total as number) * PARTIAL_BELOW;

  const verifiedOk = changed && !partial && !incomplete;
  const unverified = !verifiedOk && !partial && !incomplete;

  // `=== 0` e non `?? 0 === 0`: se il campo manca non sappiamo niente, e
  // spacciare l'ignoranza per una certezza negativa è come mentire al contrario.
  const nothingWritten = v?.stringsWritten === 0 && !runtimeOnly;

  return {
    verifiedOk,
    partial,
    incomplete,
    unverified,
    tone: verifiedOk ? 'emerald' : 'amber',
    nothingWritten,
    stringsWritten,
    stringsLeft,
    runtimeOnly,
    verified: v?.verified ?? 0,
    missing: v?.missing ?? [],
    verifiedNames: v?.verifiedNames ?? [],
  };
}
