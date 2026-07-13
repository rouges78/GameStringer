'use client';

/**
 * Crash / error reporting — opt-in (settings.privacy.crashReports, default OFF).
 *
 * Quando l'utente attiva l'opzione, gli errori reali (crash di finestra,
 * promise non gestite, ErrorBoundary React, fallimenti di pipeline) vengono
 * inviati in forma ANONIMA e SANITIZZATA alla tabella `crash_reports`:
 * ogni fallimento nel mondo reale diventa una issue con contesto, invece di
 * morire in silenzio sul PC dell'utente.
 *
 * Privacy (stesso modello di compat-telemetry):
 * - messaggi e stack passano da sanitizeCrashText(): percorsi → basename,
 *   niente email, token, API key o query string;
 * - lo stack tiene solo i primi frame, troncati;
 * - contributor_id solo se loggato alla community, altrimenti null;
 * - dedup client (stessa firma max 3 volte/sessione) + dedup e rate limit
 *   server-side (trigger crash_reports_guard).
 *
 * Fail-open: il reporting non deve MAI aggravare un crash. Tutto è avvolto in
 * try/catch, gli invii falliti finiscono in una coda localStorage riprovata poi.
 */

import { getSupabase, getCurrentUser } from '@/lib/social/community-hub-backend';
import { clientLogger } from './client-logger';
import { classifyCompatError } from './compat-telemetry';

// ── Types ──────────────────────────────────────────────────

export type CrashArea = 'window' | 'promise' | 'react-widget' | 'react-app' | 'pipeline' | 'other';

export interface CrashReportInput {
  error: unknown;
  area: CrashArea;
  engine?: string | null;
  gameKey?: string | null;
}

// ── Opt-in gate ────────────────────────────────────────────

const SETTINGS_KEY = 'gameStringerSettings';

export function isCrashReportingEnabled(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return settings?.privacy?.crashReports === true;
  } catch {
    return false;
  }
}

// ── Sanitizzazione ─────────────────────────────────────────

/**
 * Rimuove dai testi tutto ciò che può identificare l'utente o la sua macchina:
 * percorsi (Windows e POSIX) → solo basename, email, token/chiavi, query string.
 */
export function sanitizeCrashText(input: string): string {
  let s = String(input || '');
  // Percorsi Windows (C:\Users\Nome\...\file.ext) e UNC → basename
  s = s.replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*([^\\/:*?"<>|\r\n]+)/g, '<path>/$1');
  s = s.replace(/\\\\[^\s\\]+(?:\\[^\s\\]+)+/g, '<path>');
  // Percorsi POSIX (/home/nome/.../file) → basename (evita di toccare "a/b" brevi)
  s = s.replace(/(?:\/[\w.@~+-]+){2,}\/([\w.@~+-]+)/g, '<path>/$1');
  // Email
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');
  // URL: via query string e credenziali
  s = s.replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1');
  s = s.replace(/https?:\/\/[^\s/@"']+@/g, 'https://<cred>@');
  // Token comuni (sk-..., Bearer ..., JWT, stringhe esadecimali/base64 lunghe)
  s = s.replace(/\b(sk|pk|rk|key|token)[-_][A-Za-z0-9_-]{12,}/gi, '<token>');
  s = s.replace(/\bBearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer <token>');
  s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}/g, '<jwt>');
  s = s.replace(/\b[A-Fa-f0-9]{32,}\b/g, '<hex>');
  return s;
}

/** Stack ridotto: primi frame, testo sanitizzato, cap 2000 char. */
function sanitizeStack(stack: string | undefined): string | null {
  if (!stack) return null;
  const lines = stack.split('\n').slice(0, 12).map(l => sanitizeCrashText(l.trim()));
  return lines.join('\n').slice(0, 2000) || null;
}

/** Firma stabile per raggruppare occorrenze dello stesso difetto. */
export function crashSignature(category: string, message: string, stack?: string): string {
  const topFrame = (stack || '').split('\n').find(l => l.trim().startsWith('at ')) || '';
  const normMsg = sanitizeCrashText(message).toLowerCase().replace(/\d+/g, 'N').slice(0, 160);
  const input = `${category}|${sanitizeCrashText(topFrame).slice(0, 120)}|${normMsg}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Ambiente ───────────────────────────────────────────────

function detectOS(): 'windows' | 'macos' | 'linux' | null {
  try {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
    if (ua.includes('linux')) return 'linux';
  } catch { /* ignore */ }
  return null;
}

let _appVersion: string | null | undefined;
async function getAppVersion(): Promise<string | null> {
  if (_appVersion !== undefined) return _appVersion;
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    _appVersion = (await getVersion()) || null;
  } catch {
    _appVersion = null;
  }
  return _appVersion;
}

// ── Invio con coda offline ─────────────────────────────────

const QUEUE_KEY = 'gs-crash-queue';
const QUEUE_MAX = 30;
const MAX_PER_SIGNATURE_PER_SESSION = 3;
const sessionCounts = new Map<string, number>();

type CrashRow = {
  signature: string;
  category: string;
  area: CrashArea;
  message: string | null;
  stack: string | null;
  engine: string | null;
  game_key: string | null;
  app_version: string | null;
  os: string | null;
  contributor_id: string | null;
};

function readQueue(): CrashRow[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: CrashRow[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-QUEUE_MAX)));
  } catch { /* storage pieno: drop */ }
}

async function insertRows(rows: CrashRow[]): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('crash_reports').insert(rows);
  if (error) throw error;
}

export async function flushCrashQueue(): Promise<void> {
  if (!isCrashReportingEnabled()) return;
  const queued = readQueue();
  if (!queued.length) return;
  try {
    await insertRows(queued);
    writeQueue([]);
  } catch { /* ancora offline: la coda resta */ }
}

/**
 * Riporta un errore. Fire-and-forget e fail-open: chiamare sempre come
 * `void reportCrash(...)` — non lancia mai.
 */
export async function reportCrash(input: CrashReportInput): Promise<void> {
  try {
    if (!isCrashReportingEnabled()) return;
    const err = input.error;
    const message = err instanceof Error ? err.message : String(err ?? 'unknown');
    const stack = err instanceof Error ? err.stack : undefined;
    const category = classifyCompatError(err);
    const signature = crashSignature(category, message, stack);

    const count = sessionCounts.get(signature) || 0;
    if (count >= MAX_PER_SIGNATURE_PER_SESSION) return;
    sessionCounts.set(signature, count + 1);

    let contributorId: string | null = null;
    try {
      const user = await getCurrentUser();
      contributorId = user?.id ?? null;
    } catch { /* anonimo */ }

    const row: CrashRow = {
      signature,
      category,
      area: input.area,
      message: sanitizeCrashText(message).slice(0, 300) || null,
      stack: sanitizeStack(stack),
      engine: input.engine ? String(input.engine).slice(0, 60) : null,
      game_key: input.gameKey ? String(input.gameKey).slice(0, 120) : null,
      app_version: await getAppVersion(),
      os: detectOS(),
      contributor_id: contributorId,
    };

    try {
      await flushCrashQueue();
      await insertRows([row]);
      clientLogger.debug('[crash] report sent', { signature, area: row.area });
    } catch (e) {
      writeQueue([...readQueue(), row]);
      clientLogger.debug('[crash] report queued (offline?)', { signature, error: e });
    }
  } catch { /* fail-open: mai aggravare un crash */ }
}

// ── Handler globali ────────────────────────────────────────

let installed = false;

/**
 * Installa (una sola volta) gli handler per errori di finestra e promise non
 * gestite. Chiamato da SettingsBootGate all'avvio; il gate opt-in viene
 * comunque ricontrollato a ogni report, quindi è sicuro installarli sempre.
 */
export function installGlobalCrashHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    // Ignora gli errori opachi di script cross-origin ("Script error.")
    if (!event.error && !event.message) return;
    void reportCrash({ error: event.error ?? new Error(String(event.message)), area: 'window' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    void reportCrash({ error: event.reason, area: 'promise' });
  });
}
