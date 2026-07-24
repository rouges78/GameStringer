/**
 * 🚦 Patch Hub — infra caching + throttling client-side.
 *
 * Due responsabilità, entrambe puramente infrastrutturali (nessun testo
 * user-facing, nessuna dipendenza sulla UI):
 *
 * 1. CACHE IN-MEMORY CON TTL per i READ del Patch Hub (searchPacks / liste /
 *    stats / leaderboard). Riduce i round-trip verso Supabase quando l'utente
 *    naviga avanti/indietro tra le tab. Fail-open: se il loader fallisce non
 *    scrive nulla e rilancia, così il chiamante mantiene il suo fallback locale.
 *    Si invalida dopo ogni scrittura (publish/download) via invalidateHubCache().
 *
 * 2. THROTTLE DELLE SCRITTURE (publish/report): un min-interval per azione,
 *    persistito in localStorage (o in memoria fuori dal browser), che impedisce
 *    invii ripetuti troppo ravvicinati e alleggerisce il carico/abuso sul
 *    backend condiviso. Complementare al rate-limiter LOCALE al processo
 *    (lib/rate-limiter.ts, middleware.ts): quello copre le route Next locali,
 *    questo copre le chiamate DIRETTE a Supabase che non passano dal middleware.
 *
 * Nota: il vero enforcement anti-abuso è lato server (vedi la migration
 * supabase/migrations/*_patch_hub_rate_limit.sql). Questo modulo è la prima
 * linea client-side, best-effort e aggirabile: non sostituisce il server.
 */

// ─── TTL CACHE ─────────────────────────────────────────────────────

/** TTL di default per le liste del Patch Hub (60s). */
export const HUB_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  /** generazione con cui è stata scritta: se non coincide, è invalidata. */
  gen: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();
let cacheGeneration = 0;
const CACHE_MAX_ENTRIES = 128;

/** Costruisce una chiave stabile per una lista a partire da un oggetto filtri. */
export function hubCacheKey(prefix: string, payload: unknown): string {
  let body = '';
  try {
    body = JSON.stringify(payload, Object.keys((payload as object) || {}).sort());
  } catch {
    // payload non serializzabile → chiave "unica" così non si sporca la cache
    body = String(Date.now()) + ':' + Math.random().toString(36).slice(2);
  }
  return `${prefix}:${body}`;
}

/**
 * Esegue `loader()` passando per la cache TTL. Fail-open:
 * - hit valido → ritorna il valore cachato senza chiamare il loader;
 * - miss/scaduto → chiama il loader, memorizza il risultato e lo ritorna;
 * - loader che lancia → NON scrive nulla e RILANCIA (il chiamante gestisce il
 *   fallback come oggi).
 */
export async function withHubCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = HUB_CACHE_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = cacheStore.get(key);
  if (hit && hit.gen === cacheGeneration && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = await loader();

  // Semplice cap LRU-ish: se piena, elimina la entry più vecchia.
  if (cacheStore.size >= CACHE_MAX_ENTRIES) {
    const oldest = cacheStore.keys().next().value;
    if (oldest !== undefined) cacheStore.delete(oldest);
  }
  cacheStore.set(key, { value, expiresAt: now + Math.max(0, ttlMs), gen: cacheGeneration });
  return value;
}

/**
 * Invalida TUTTA la cache delle liste (da chiamare dopo publish/download o
 * qualsiasi scrittura che possa cambiare i risultati). Bump di generazione:
 * O(1), le vecchie entry non verranno più considerate valide.
 */
export function invalidateHubCache(): void {
  cacheGeneration++;
  // Svuota subito per liberare memoria; non è strettamente necessario grazie
  // al confronto di generazione, ma evita di trattenere payload grandi.
  cacheStore.clear();
}

// ─── WRITE THROTTLE (min-interval per azione) ──────────────────────

/** Intervalli minimi consigliati tra due scritture della stessa azione. */
export const HUB_THROTTLE_MS = {
  /** Pubblicazione di un pack sul Patch Hub. */
  publish: 15_000,
  /** Segnalazione (report) di un pack. */
  report: 10_000,
} as const;

export interface ThrottleResult {
  /** true se l'azione può procedere adesso. */
  allowed: boolean;
  /** ms mancanti prima che l'azione sia di nuovo consentita (0 se allowed). */
  retryAfterMs: number;
}

const THROTTLE_PREFIX = 'gs-hub-throttle:';
const throttleMemory = new Map<string, number>();

function readLastTs(action: string): number {
  const key = THROTTLE_PREFIX + action;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    /* storage non disponibile → memoria */
  }
  return throttleMemory.get(key) || 0;
}

function writeLastTs(action: string, ts: number): void {
  const key = THROTTLE_PREFIX + action;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(ts));
      return;
    }
  } catch {
    /* storage pieno/negato → memoria */
  }
  throttleMemory.set(key, ts);
}

/**
 * Verifica se `action` è consentita rispettando `minIntervalMs` dall'ultima
 * esecuzione riuscita. NON registra il tentativo: chiamare markThrottledAction()
 * solo DOPO che la scrittura è andata a buon fine, così un errore di rete non
 * "consuma" la finestra.
 *
 * Fail-open: qualsiasi problema interno ritorna { allowed: true }.
 */
export function checkThrottle(action: string, minIntervalMs: number): ThrottleResult {
  try {
    const last = readLastTs(action);
    const elapsed = Date.now() - last;
    if (last > 0 && elapsed < minIntervalMs) {
      return { allowed: false, retryAfterMs: minIntervalMs - elapsed };
    }
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
}

/** Registra l'istante dell'ultima azione riuscita (avvia la finestra di throttle). */
export function markThrottledAction(action: string): void {
  try {
    writeLastTs(action, Date.now());
  } catch {
    /* fail-open */
  }
}
