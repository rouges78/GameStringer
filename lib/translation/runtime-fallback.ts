/**
 * Cosa fare quando la strada statica non ha tradotto il gioco.
 *
 * PERCHÉ ESISTE
 * `decidePatchOutcome` dice *com'è andata*; questo modulo dice *cosa fare
 * adesso*. Sono due domande diverse e vivevano entrambe dentro un componente
 * da 4300 righe, dove non si possono provare. Un gioco che resiste
 * all'estrazione statica non è un gioco intraducibile: c'è la strada a runtime
 * (gs-hook + pipe `GameStringerTranslator` + drain loop). Ma quella strada ha
 * precondizioni vere — Windows, DLL presenti, e soprattutto **il gioco in
 * esecuzione**, perché si inietta in un processo, non in una cartella.
 *
 * La regola sta qui, con i suoi test, e il componente la chiama.
 */

import type { PatchOutcome } from './patch-outcome';

/** Perché la strada a runtime non è percorribile. */
export type RuntimeBlocker =
  /** L'iniezione è Windows-only. */
  | 'not-windows'
  /** Le DLL gs-hook non sono nel bundle. */
  | 'hook-missing'
  /** Il gate anti-cheat vieta di toccare questo processo. */
  | 'anti-cheat'
  /** Non sappiamo quale eseguibile cercare. */
  | 'unknown-process';

export type RuntimePlan =
  /** La strada statica ha funzionato: non serve altro. */
  | { action: 'none' }
  /** Gioco in esecuzione: si può iniettare adesso. */
  | { action: 'inject'; processName: string }
  /** Tutto pronto ma il gioco è chiuso: va avviato prima. */
  | { action: 'await-launch'; processName: string }
  /** Strada a runtime preclusa. */
  | { action: 'unavailable'; blocker: RuntimeBlocker };

export interface RuntimeContext {
  /** Esito della strada statica, da `decidePatchOutcome`. */
  staticOutcome: PatchOutcome;
  /** L'iniezione esiste solo su Windows. */
  isWindows: boolean;
  /** `gs-hook.dll` presente nelle resources per l'arch giusta. */
  hookAvailable: boolean;
  /** Nome dell'eseguibile del gioco (es. `Game.exe`), se noto. */
  processName?: string | null;
  /** Il processo è vivo adesso. */
  processRunning: boolean;
  /** Il gate anti-cheat ha già detto no per questo gioco. */
  antiCheatBlocked?: boolean;
}

/**
 * Decide il passo successivo dopo la strada statica.
 *
 * L'ordine conta: i motivi *strutturali* per cui il runtime non si può fare
 * (piattaforma, DLL, anti-cheat) vengono prima di quelli *contingenti* (gioco
 * chiuso), perché a un utente si dice «qui non si può» una volta sola, mentre
 * «avvia il gioco» è un invito ad agire, e darlo quando l'azione non porterebbe
 * a niente è peggio che tacere.
 */
export function planRuntimeFallback(ctx: RuntimeContext): RuntimePlan {
  // Un successo parziale è comunque un gioco modificato: il runtime
  // sovrapposto a una patch statica mostrerebbe due traduzioni della stessa
  // riga. Si interviene solo quando la strada statica non ha inciso.
  if (ctx.staticOutcome !== 'failure') {
    return { action: 'none' };
  }

  if (!ctx.isWindows) {
    return { action: 'unavailable', blocker: 'not-windows' };
  }
  if (!ctx.hookAvailable) {
    return { action: 'unavailable', blocker: 'hook-missing' };
  }
  if (ctx.antiCheatBlocked) {
    return { action: 'unavailable', blocker: 'anti-cheat' };
  }
  if (!ctx.processName) {
    return { action: 'unavailable', blocker: 'unknown-process' };
  }

  return ctx.processRunning
    ? { action: 'inject', processName: ctx.processName }
    : { action: 'await-launch', processName: ctx.processName };
}

/**
 * Perché la strada statica non ha inciso. Cambia cosa possiamo onestamente
 * promettere, non cosa facciamo.
 */
export type FallbackCause =
  /** Il motore non espone testo nei file: la strada statica non c'è, punto. */
  | 'engine-unsupported'
  /** Questa run è fallita — magari per configurazione, magari no. */
  | 'run-failed';

/**
 * Chiave i18n del messaggio da mostrare per un piano.
 *
 * A gioco chiuso il messaggio dipende dalla causa: «questo gioco non si lascia
 * tradurre nei file» è vero quando il motore non espone testo, ed è una bugia
 * quando è appena caduto Ollama. In quel caso si offre il runtime come
 * alternativa, senza dichiarare impossibile una strada che potrebbe funzionare
 * benissimo alla prossima prova.
 */
export function runtimePlanMessageKey(
  plan: RuntimePlan,
  cause: FallbackCause = 'engine-unsupported',
): string {
  switch (plan.action) {
    case 'none':
      return '';
    case 'inject':
      return 'gameDetail.runtimeFallbackInjecting';
    case 'await-launch':
      return cause === 'engine-unsupported'
        ? 'gameDetail.runtimeFallbackAwaitLaunch'
        : 'gameDetail.runtimeFallbackAfterFailure';
    case 'unavailable':
      return `gameDetail.runtimeFallbackBlocked.${plan.blocker}`;
  }
}

// ─── Report per gioco ─────────────────────────────────────────────

export type AttemptedPath = 'static' | 'runtime';

export interface RunReport {
  gameTitle: string;
  engine: string | null;
  /** Strade tentate, in ordine. */
  attempted: AttemptedPath[];
  /** Stringhe scritte nei file di gioco (`null` = non misurato). */
  stringsInjected: number | null;
  /** Stringhe trovate (`null` = non misurato). */
  stringsTotal: number | null;
  /** Esito della strada statica. */
  staticOutcome: PatchOutcome;
  /** Piano scelto dopo la strada statica. */
  plan: RuntimePlan;
  /** Perché la strada statica non ha inciso. */
  cause: FallbackCause;
  /** Chiave i18n del passo successivo suggerito. */
  nextStepKey: string;
}

export function buildRunReport(args: {
  gameTitle: string;
  engine?: string | null;
  staticOutcome: PatchOutcome;
  stringsInjected?: number | null;
  stringsTotal?: number | null;
  plan: RuntimePlan;
  cause?: FallbackCause;
}): RunReport {
  const attempted: AttemptedPath[] = ['static'];
  if (args.plan.action === 'inject') {
    attempted.push('runtime');
  }

  const cause = args.cause ?? 'engine-unsupported';

  return {
    gameTitle: args.gameTitle,
    engine: args.engine ?? null,
    attempted,
    stringsInjected: args.stringsInjected ?? null,
    stringsTotal: args.stringsTotal ?? null,
    staticOutcome: args.staticOutcome,
    plan: args.plan,
    cause,
    nextStepKey: runtimePlanMessageKey(args.plan, cause),
  };
}

/**
 * Riassunto di una riga per la cronologia attività.
 *
 * Dice cosa è ENTRATO nel gioco, non quanti stadi sono finiti — è la stessa
 * regola per cui esiste `patch-outcome.ts`: «100% completato» con zero righe
 * scritte è la bugia che quel modulo è nato per chiudere. `null` resta
 * distinto da `0`: «non misurato» non è «misurato, ed è zero».
 */
export function summarizeRunReport(report: RunReport): string {
  const counts =
    report.stringsInjected === null || report.stringsTotal === null
      ? 'conteggi non disponibili'
      : `${report.stringsInjected}/${report.stringsTotal} stringhe scritte`;

  switch (report.plan.action) {
    case 'inject':
      return `${counts} — passato alla traduzione a runtime`;
    case 'await-launch':
      return `${counts} — traduzione a runtime pronta, avvia il gioco`;
    case 'unavailable':
      return `${counts} — runtime non disponibile (${report.plan.blocker})`;
    case 'none':
      return counts;
  }
}
