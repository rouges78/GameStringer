'use client';

/**
 * Compatibility telemetry — the "ProtonDB of translations".
 *
 * Opt-in only (settings.privacy.compatTelemetry, default OFF). When enabled,
 * each translation run automatically reports the outcome per pipeline step
 * (scan → detect → extract → translate → patch), plus an optional user-confirmed
 * 'boot' step ("does the game start with the translation?") collected by the
 * CompatCard banner in the game detail page.
 *
 * Privacy model (mirrors lib/tm-network.ts):
 * - No file paths, no usernames, no free-text error messages — errors are
 *   reduced to a short category code by classifyCompatError().
 * - contributor_id only when the user is logged into the community, else null.
 * - Insert-only table; public reads happen through the aggregated
 *   compat_game_summary view (per game + target language).
 *
 * Fail-open: telemetry must NEVER break a translation run. Every network call
 * is wrapped; failures land in a small localStorage queue retried later.
 */

import { getSupabase, getCurrentUser } from '@/lib/social/community-hub-backend';
import { clientLogger } from './client-logger';

// ── Types ──────────────────────────────────────────────────

export type CompatStep = 'scan' | 'detect' | 'extract' | 'translate' | 'patch' | 'boot';
export type CompatResult = 'success' | 'partial' | 'failure';

export interface CompatGameRef {
  /** Cross-user stable key: Steam AppID when available, else name slug. */
  key: string;
  appId?: number | null;
  name: string;
  store?: string | null;
  buildId?: string | null;
}

export interface CompatReportInput {
  runId: string;
  game: CompatGameRef;
  engine?: string | null;
  step: CompatStep;
  result: CompatResult;
  stringsTotal?: number | null;
  stringsTranslated?: number | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  provider?: string | null;
  errorCategory?: string | null;
}

export interface CompatLangSummary {
  targetLang: string | null;
  runs: number;
  okRuns: number;
  bootOkRuns: number;
  bootFailRuns: number;
  knownTesters: number;
  lastReportAt: string | null;
  lastAppVersion: string | null;
}

export interface CompatSummary {
  gameKey: string;
  runs: number;
  okRuns: number;
  bootOkRuns: number;
  bootFailRuns: number;
  byLang: CompatLangSummary[];
}

export interface PendingBootCheck {
  runId: string;
  gameKey: string;
  gameName: string;
  targetLang?: string | null;
  engine?: string | null;
  createdAt: number;
}

// ── Opt-in gate ────────────────────────────────────────────

const SETTINGS_KEY = 'gameStringerSettings';

export function isCompatTelemetryEnabled(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return settings?.privacy?.compatTelemetry === true;
  } catch {
    return false;
  }
}

// ── Game key & environment helpers ─────────────────────────

/** Stable cross-user key for a game: AppID when numeric, else a name slug. */
export function compatGameKey(appId: number | string | null | undefined, name: string): string {
  const n = typeof appId === 'string' ? parseInt(appId, 10) : appId;
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return String(n);
  const slug = (name || 'unknown')
    .toLowerCase()
    .trim()
    .replace(/[™®©]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return `g:${slug || 'unknown'}`;
}

export function newCompatRunId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Very old WebViews: RFC4122-ish fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

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

/**
 * Reduce an arbitrary error to a short category code. NEVER send raw messages:
 * they can contain file paths, user names, API keys in URLs, etc.
 */
export function classifyCompatError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (!msg) return 'unknown';
  if (/denuvo|vmprotect|drm|anti-?cheat|battleye|easy ?anti|vanguard/.test(msg)) return 'drm';
  if (/no (translatable )?strings|nessuna stringa|0 strings|empty extraction/.test(msg)) return 'no_strings';
  if (/encoding|shift[-_]?jis|utf-?(8|16)|mojibake|charset/.test(msg)) return 'encoding';
  if (/permission|access is denied|accesso negato|eacces|eperm/.test(msg)) return 'permissions';
  if (/network|fetch|timeout|timed? out|econn|enotfound|socket|offline/.test(msg)) return 'network';
  if (/rate limit|429|quota|insufficient_quota/.test(msg)) return 'rate_limit';
  if (/api key|apikey|401|403|unauthorized|invalid[_ ]key/.test(msg)) return 'auth';
  if (/ollama|lm studio|model not found|pull/.test(msg)) return 'local_model';
  if (/backup/.test(msg)) return 'backup';
  if (/patch|write|apply/.test(msg)) return 'patch_write';
  if (/parse|unexpected token|invalid (json|xml)|corrupt/.test(msg)) return 'parse';
  if (/unsupported|not supported|engine sconosciuto|unknown engine/.test(msg)) return 'unsupported';
  return 'other';
}

// ── Sender with offline queue ──────────────────────────────

const QUEUE_KEY = 'gs-compat-queue';
const QUEUE_MAX = 50;
/** Dedup within the session: one (runId, step, result) triple goes out once. */
const sentThisSession = new Set<string>();

type CompatRow = {
  run_id: string;
  game_key: string;
  game_app_id: number | null;
  game_name: string;
  store: string | null;
  build_id: string | null;
  engine: string | null;
  step: CompatStep;
  result: CompatResult;
  strings_total: number | null;
  strings_translated: number | null;
  source_lang: string | null;
  target_lang: string | null;
  provider: string | null;
  app_version: string | null;
  os: string | null;
  error_category: string | null;
  contributor_id: string | null;
};

const clip = (s: string | null | undefined, max: number): string | null =>
  s == null ? null : String(s).slice(0, max) || null;

async function buildRow(input: CompatReportInput): Promise<CompatRow> {
  let contributorId: string | null = null;
  try {
    const user = await getCurrentUser();
    contributorId = user?.id ?? null;
  } catch { /* anonymous */ }
  const intOrNull = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  return {
    run_id: input.runId,
    game_key: clip(input.game.key, 120) || 'g:unknown',
    game_app_id: intOrNull(input.game.appId ?? null),
    game_name: clip(input.game.name, 200) || 'Unknown',
    store: clip(input.game.store, 30),
    build_id: clip(input.game.buildId, 40),
    engine: clip(input.engine, 60),
    step: input.step,
    result: input.result,
    strings_total: intOrNull(input.stringsTotal),
    strings_translated: intOrNull(input.stringsTranslated),
    source_lang: clip(input.sourceLang, 10),
    target_lang: clip(input.targetLang, 10),
    provider: clip(input.provider, 40),
    app_version: clip(await getAppVersion(), 20),
    os: detectOS(),
    error_category: clip(input.errorCategory, 40),
    contributor_id: contributorId,
  };
}

function readQueue(): CompatRow[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: CompatRow[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-QUEUE_MAX)));
  } catch { /* storage full: drop */ }
}

async function insertRows(rows: CompatRow[]): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('compat_reports').insert(rows);
  if (error) throw error;
  return true;
}

/** Retry queued reports (best-effort, called opportunistically). */
export async function flushCompatQueue(): Promise<void> {
  if (!isCompatTelemetryEnabled()) return;
  const queued = readQueue();
  if (!queued.length) return;
  try {
    await insertRows(queued);
    writeQueue([]);
    clientLogger.info('[compat] flushed queued reports', { count: queued.length });
  } catch { /* still offline: keep queue */ }
}

/**
 * Report a pipeline step outcome. Fire-and-forget and fail-open by design:
 * call it with `void reportCompatStep(...)` — it never throws.
 */
export async function reportCompatStep(input: CompatReportInput): Promise<void> {
  try {
    if (!isCompatTelemetryEnabled()) return;
    const dedupKey = `${input.runId}:${input.step}:${input.result}`;
    if (sentThisSession.has(dedupKey)) return;
    sentThisSession.add(dedupKey);
    const row = await buildRow(input);
    try {
      await flushCompatQueue();
      await insertRows([row]);
      clientLogger.debug('[compat] report sent', { step: row.step, result: row.result, game: row.game_key });
    } catch (e) {
      writeQueue([...readQueue(), row]);
      clientLogger.debug('[compat] report queued (offline?)', { step: row.step, error: e });
    }
  } catch (e) {
    clientLogger.debug('[compat] report skipped', { error: e });
  }
}

// ── Pending boot confirmation ("does the game start?") ─────

const PENDING_BOOT_KEY = 'gs-compat-pending-boot';

function readPending(): Record<string, PendingBootCheck> {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_BOOT_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function writePending(map: Record<string, PendingBootCheck>): void {
  try {
    localStorage.setItem(PENDING_BOOT_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/** Called after a successful patch: arms the boot-confirmation banner. */
export function setPendingBootCheck(check: Omit<PendingBootCheck, 'createdAt'>): void {
  if (!isCompatTelemetryEnabled()) return;
  const map = readPending();
  map[check.gameKey] = { ...check, createdAt: Date.now() };
  writePending(map);
}

const PENDING_TTL_MS = 30 * 24 * 3600_000; // stale after 30 days

export function getPendingBootCheck(gameKey: string): PendingBootCheck | null {
  const map = readPending();
  const p = map[gameKey];
  if (!p) return null;
  if (Date.now() - p.createdAt > PENDING_TTL_MS) {
    delete map[gameKey];
    writePending(map);
    return null;
  }
  return p;
}

/** Resolve the banner: 'yes' / 'no' send a boot report, 'skip' just dismisses. */
export async function resolvePendingBootCheck(
  gameKey: string,
  answer: 'yes' | 'no' | 'skip',
  game: CompatGameRef,
): Promise<void> {
  const pending = getPendingBootCheck(gameKey);
  const map = readPending();
  delete map[gameKey];
  writePending(map);
  if (!pending || answer === 'skip') return;
  await reportCompatStep({
    runId: pending.runId,
    game,
    engine: pending.engine,
    step: 'boot',
    result: answer === 'yes' ? 'success' : 'failure',
    targetLang: pending.targetLang,
  });
}

// ── Public summary (for the badge) ─────────────────────────

const summaryCache = new Map<string, { data: CompatSummary | null; ts: number }>();
const SUMMARY_TTL_MS = 5 * 60_000;

export async function fetchCompatSummary(gameKey: string): Promise<CompatSummary | null> {
  const cached = summaryCache.get(gameKey);
  if (cached && Date.now() - cached.ts < SUMMARY_TTL_MS) return cached.data;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('compat_game_summary')
      .select('*')
      .eq('game_key', gameKey);
    if (error) throw error;
    if (!data || data.length === 0) {
      summaryCache.set(gameKey, { data: null, ts: Date.now() });
      return null;
    }
    const byLang: CompatLangSummary[] = data.map((r: Record<string, unknown>) => ({
      targetLang: (r.target_lang as string) ?? null,
      runs: Number(r.runs) || 0,
      okRuns: Number(r.ok_runs) || 0,
      bootOkRuns: Number(r.boot_ok_runs) || 0,
      bootFailRuns: Number(r.boot_fail_runs) || 0,
      knownTesters: Number(r.known_testers) || 0,
      lastReportAt: (r.last_report_at as string) ?? null,
      lastAppVersion: (r.last_app_version as string) ?? null,
    }));
    const sum = (f: (l: CompatLangSummary) => number) => byLang.reduce((a, l) => a + f(l), 0);
    const result: CompatSummary = {
      gameKey,
      runs: sum(l => l.runs),
      okRuns: sum(l => l.okRuns),
      bootOkRuns: sum(l => l.bootOkRuns),
      bootFailRuns: sum(l => l.bootFailRuns),
      byLang,
    };
    summaryCache.set(gameKey, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    clientLogger.debug('[compat] summary fetch failed', { gameKey, error: e });
    return null;
  }
}
