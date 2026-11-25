// Esito dell'ultima corsa di String it per un gioco, conservato tra le sessioni.
//
// Prima l'unica traccia di una corsa erano i toast: spariscono dopo pochi
// secondi e non dicono più cosa è stato tradotto, cosa no e come tornare
// indietro. Qui ogni messaggio della corsa viene anche registrato, e la scheda
// del gioco lo mostra in un pannello che resta.

export type RunLogLevel = 'success' | 'error' | 'info' | 'warning';

export interface RunLogEntry {
  level: RunLogLevel;
  message: string;
  description?: string;
  at: number;
}

export interface RunResult {
  startedAt: number;
  entries: RunLogEntry[];
}

const KEY_PREFIX = 'gs.stringit.lastRun.';
const MAX_ENTRIES = 40;

export function loadRunResult(gameKey: string): RunResult | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + gameKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunResult;
    return Array.isArray(parsed?.entries) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRunResult(gameKey: string, result: RunResult): void {
  try {
    localStorage.setItem(KEY_PREFIX + gameKey, JSON.stringify(result));
  } catch {
    // localStorage pieno o non disponibile: il pannello resta solo in memoria.
  }
}

export function appendEntry(result: RunResult, entry: RunLogEntry): RunResult {
  return { ...result, entries: [...result.entries, entry].slice(-MAX_ENTRIES) };
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

type ToastFn = (message: unknown, options?: { description?: unknown; [k: string]: unknown }) => unknown;

interface ToastLike {
  (message: unknown, options?: { description?: unknown; [k: string]: unknown }): unknown;
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
  loading: ToastFn;
  dismiss: (id?: string | number) => unknown;
}

/**
 * Un toast che, oltre a mostrarsi, passa a `record` i messaggi con un esito
 * (successo, errore, avviso, info). I `loading` restano solo a schermo.
 */
export function recordingToast<T extends object>(baseToast: T, record: (entry: RunLogEntry) => void): T {
  // Le firme di sonner sono più strette di ToastLike (messaggio ReactNode): qui
  // interessa solo inoltrare gli argomenti così come arrivano.
  const base = baseToast as unknown as ToastLike;
  const note = (level: RunLogLevel, message: unknown, options?: { description?: unknown }) => {
    const text = toText(message);
    if (!text) return;
    const description = toText(options?.description);
    record({ level, message: text, ...(description ? { description } : {}), at: Date.now() });
  };
  const wrap = (level: RunLogLevel): ToastFn => (message, options) => {
    note(level, message, options);
    return base[level](message, options);
  };
  // Il toast di sonner è anche una funzione: toast('…') = messaggio neutro.
  const plain: ToastFn = (message, options) => {
    note('info', message, options);
    return base(message, options);
  };
  return Object.assign(plain, base, {
    success: wrap('success'),
    error: wrap('error'),
    info: wrap('info'),
    warning: wrap('warning'),
  }) as unknown as T;
}
