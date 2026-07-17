'use client';

/**
 * Benchmark telemetry — invio opt-in dei QA score per costruire il benchmark
 * pubblico dei provider ("per IT→JA su JRPG il migliore è X").
 *
 * Rispecchia il modello di `lib/compat-telemetry.ts`:
 * - Opt-in (settings.privacy.benchmarkTelemetry, default OFF).
 * - Anonimo: nessun percorso, nessun nome gioco, nessun testo tradotto —
 *   solo provider, coppia lingua, genere e il punteggio 0–100 già calcolato.
 * - contributor_id solo se loggato alla community, altrimenti null.
 * - Tabella insert-only; le letture pubbliche passano dalla vista aggregata
 *   benchmark_provider_summary.
 * - Fail-open: non deve MAI rompere una traduzione. Coda offline in localStorage.
 */

import { getSupabase, getCurrentUser } from '@/lib/social/community-hub-backend';
import { clientLogger } from './client-logger';

const SETTINGS_KEY = 'gameStringerSettings';
const QUEUE_KEY = 'gs-benchmark-queue';
const QUEUE_MAX = 100;

export function isBenchmarkTelemetryEnabled(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return settings?.privacy?.benchmarkTelemetry === true;
  } catch {
    return false;
  }
}

export interface BenchmarkTelemetryInput {
  provider: string;
  sourceLang?: string | null;
  targetLang?: string | null;
  genre?: string | null;
  score: number; // 0–100
  engine?: string | null;
}

type BenchmarkRow = {
  sample_id: string;
  provider: string;
  source_lang: string | null;
  target_lang: string | null;
  genre: string | null;
  qa_score: number;
  engine: string | null;
  app_version: string | null;
  os: 'windows' | 'macos' | 'linux' | null;
  contributor_id: string | null;
};

export interface BenchmarkRankingRow {
  provider: string;
  sourceLang: string | null;
  targetLang: string | null;
  genre: string;
  samples: number;
  avgScore: number;
  stddevScore: number;
  minScore: number;
  maxScore: number;
  knownContributors: number;
  lastReportAt: string | null;
}

// ── helpers ────────────────────────────────────────────────

function newSampleId(): string {
  try {
    return crypto.randomUUID();
  } catch {
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

const clip = (s: string | null | undefined, max: number): string | null =>
  s == null ? null : String(s).slice(0, max).toLowerCase() || null;

function readQueue(): BenchmarkRow[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: BenchmarkRow[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-QUEUE_MAX)));
  } catch { /* storage full: drop */ }
}

async function buildRow(input: BenchmarkTelemetryInput): Promise<BenchmarkRow> {
  let contributorId: string | null = null;
  try {
    const user = await getCurrentUser();
    contributorId = user?.id ?? null;
  } catch { /* anonymous */ }
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  return {
    sample_id: newSampleId(),
    provider: (clip(input.provider, 40) || 'unknown'),
    source_lang: clip(input.sourceLang, 10),
    target_lang: clip(input.targetLang, 10),
    genre: clip(input.genre, 30),
    qa_score: score,
    engine: clip(input.engine, 60),
    app_version: clip(await getAppVersion(), 20),
    os: detectOS(),
    contributor_id: contributorId,
  };
}

async function insertRows(rows: BenchmarkRow[]): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('benchmark_reports').insert(rows);
  if (error) throw error;
}

/** Ritenta i report in coda (best-effort). */
export async function flushBenchmarkQueue(): Promise<void> {
  if (!isBenchmarkTelemetryEnabled()) return;
  const queued = readQueue();
  if (!queued.length) return;
  try {
    await insertRows(queued);
    writeQueue([]);
  } catch { /* still offline */ }
}

/**
 * Invia un campione di qualità. Fire-and-forget e fail-open: chiamalo con
 * `void reportBenchmarkSample(...)`, non lancia mai.
 */
export async function reportBenchmarkSample(input: BenchmarkTelemetryInput): Promise<void> {
  try {
    if (!isBenchmarkTelemetryEnabled()) return;
    if (!input.provider || !(input.score >= 0)) return;
    const row = await buildRow(input);
    try {
      await flushBenchmarkQueue();
      await insertRows([row]);
    } catch {
      writeQueue([...readQueue(), row]);
    }
  } catch (e) {
    clientLogger.debug('[benchmark] report skipped', { error: e });
  }
}

// ── Public rankings (dalla vista aggregata) ────────────────

const rankCache = new Map<string, { data: BenchmarkRankingRow[]; ts: number }>();
const RANK_TTL_MS = 10 * 60_000;

/**
 * Scarica la classifica pubblica dei provider per una coppia lingua (+genere
 * opzionale) dalla vista aggregata. Cache 10 min. Fail-safe: [] se offline.
 */
export async function fetchBenchmarkRankings(
  targetLang: string,
  sourceLang?: string | null,
  genre?: string | null
): Promise<BenchmarkRankingRow[]> {
  const cacheKey = `${sourceLang || ''}>${targetLang}|${genre || 'any'}`;
  const cached = rankCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RANK_TTL_MS) return cached.data;
  try {
    const supabase = await getSupabase();
    let q = supabase
      .from('benchmark_provider_summary')
      .select('*')
      .eq('target_lang', (targetLang || '').toLowerCase());
    if (sourceLang) q = q.eq('source_lang', sourceLang.toLowerCase());
    if (genre) q = q.eq('genre', genre.toLowerCase());
    const { data, error } = await q;
    if (error) throw error;
    const rows: BenchmarkRankingRow[] = ((data as Record<string, unknown>[]) || []).map((r) => ({
      provider: String(r.provider),
      sourceLang: (r.source_lang as string) ?? null,
      targetLang: (r.target_lang as string) ?? null,
      genre: (r.genre as string) ?? 'any',
      samples: Number(r.samples) || 0,
      avgScore: Number(r.avg_score) || 0,
      stddevScore: Number(r.stddev_score) || 0,
      minScore: Number(r.min_score) || 0,
      maxScore: Number(r.max_score) || 0,
      knownContributors: Number(r.known_contributors) || 0,
      lastReportAt: (r.last_report_at as string) ?? null,
    }));
    rankCache.set(cacheKey, { data: rows, ts: Date.now() });
    return rows;
  } catch (e) {
    clientLogger.debug('[benchmark] rankings fetch failed', { error: e });
    return [];
  }
}
