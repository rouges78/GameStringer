'use client';

/**
 * Translation Memory Network — Federated TM sharing via Supabase.
 *
 * When a user translates a game, high-quality translations (confidence > 0.8,
 * verified or high usage) are anonymized and contributed to a global pool.
 * The next user translating the same game gets pre-filled suggestions.
 *
 * Privacy-first:
 * - Only translation text is shared, no user data
 * - Opt-in only (user must explicitly enable sharing)
 * - Source text is hashed for lookup (original not stored on server)
 * - Game-scoped: entries are sharded by game + language pair
 *
 * Architecture:
 * - Local TM: lib/translation-memory.ts (existing, unchanged)
 * - Network TM: this file (new layer on top)
 * - Storage: Supabase `shared_tm` table
 * - Sync: pull on demand, push after translation completes
 */

import { getSupabase, getCurrentUser } from './community-hub-backend';
import { clientLogger } from './client-logger';

// ── Types ──────────────────────────────────────────────────

export interface SharedTMEntry {
  id?: string;
  sourceHash: string;         // Hash of source text (privacy: original not stored)
  sourceText: string;         // Source text (needed for fuzzy matching)
  targetText: string;         // Translated text
  sourceLanguage: string;
  targetLanguage: string;
  gameAppId?: number;         // Steam AppID for game scoping
  gameName?: string;          // Game name fallback
  context?: string;           // UI, Dialog, Item, etc.
  confidence: number;         // 0-1 quality score
  verified: boolean;          // Human-reviewed
  contributorCount: number;   // How many users contributed this same translation
  usageCount: number;         // How many times downloaded/used
  createdAt?: string;
  updatedAt?: string;
}

export interface TMNetworkStats {
  totalEntries: number;
  totalGames: number;
  totalLanguagePairs: number;
  topGames: Array<{ gameName: string; entryCount: number }>;
  recentContributions: number;
}

export interface TMPullResult {
  entries: SharedTMEntry[];
  gameName: string;
  languagePair: string;
  fromCache: boolean;
}

export interface TMPushResult {
  pushed: number;
  merged: number;
  skipped: number;
}

export interface TMNetworkConfig {
  enabled: boolean;
  autoContribute: boolean;    // Auto-push after translation
  minConfidence: number;      // Min confidence to contribute (default 0.8)
  minUsageCount: number;      // Min local usage to contribute (default 2)
  pullOnTranslate: boolean;   // Auto-pull suggestions before translating
}

// ── Config ─────────────────────────────────────────────────

const CONFIG_KEY = 'gs_tm_network_config';

const DEFAULT_CONFIG: TMNetworkConfig = {
  enabled: false,             // Opt-in by default
  autoContribute: true,
  minConfidence: 0.8,
  minUsageCount: 2,
  pullOnTranslate: true,
};

export function getTMNetworkConfig(): TMNetworkConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export function setTMNetworkConfig(config: Partial<TMNetworkConfig>): void {
  const current = getTMNetworkConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
}

// ── Hash ───────────────────────────────────────────────────

function hashSourceText(text: string, sourceLang: string, targetLang: string): string {
  // Normalize: lowercase, trim, collapse whitespace, standardize quotes/dashes
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-');

  const input = `${normalized}|${sourceLang}|${targetLang}`;

  // Simple but effective hash for dedup
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Pull: Get shared TM entries for a game ─────────────────

// Local cache to avoid repeated pulls
const pullCache = new Map<string, { entries: SharedTMEntry[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Pull shared translation memory entries for a specific game + language pair.
 * Returns entries contributed by the community.
 */
export async function pullSharedTM(
  gameName: string,
  sourceLanguage: string,
  targetLanguage: string,
  gameAppId?: number,
): Promise<TMPullResult> {
  const config = getTMNetworkConfig();
  if (!config.enabled) {
    return { entries: [], gameName, languagePair: `${sourceLanguage}→${targetLanguage}`, fromCache: false };
  }

  const cacheKey = `${gameAppId || gameName}:${sourceLanguage}:${targetLanguage}`;

  // Check cache
  const cached = pullCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { entries: cached.entries, gameName, languagePair: `${sourceLanguage}→${targetLanguage}`, fromCache: true };
  }

  try {
    const supabase = await getSupabase();

    let query = supabase
      .from('shared_tm')
      .select('*')
      .eq('source_language', sourceLanguage)
      .eq('target_language', targetLanguage)
      .gte('confidence', 0.7)
      .order('contributor_count', { ascending: false })
      .limit(500);

    if (gameAppId) {
      query = query.eq('game_app_id', gameAppId);
    } else {
      query = query.ilike('game_name', gameName);
    }

    const { data, error } = await query;
    if (error) {
      clientLogger.warn('TM Network pull failed:', error.message);
      return { entries: [], gameName, languagePair: `${sourceLanguage}→${targetLanguage}`, fromCache: false };
    }

    const entries: SharedTMEntry[] = (data || []).map(mapSharedTMRow);

    // Update cache
    pullCache.set(cacheKey, { entries, timestamp: Date.now() });

    clientLogger.info(`TM Network: pulled ${entries.length} entries for ${gameName}`, 'TM_NETWORK');

    return { entries, gameName, languagePair: `${sourceLanguage}→${targetLanguage}`, fromCache: false };

  } catch (err: unknown) {
    clientLogger.error('TM Network pull error:', err);
    return { entries: [], gameName, languagePair: `${sourceLanguage}→${targetLanguage}`, fromCache: false };
  }
}

// ── Push: Contribute local TM entries to the network ───────

/**
 * Push high-quality local translations to the shared network.
 * Only entries meeting confidence + usage thresholds are contributed.
 * Entries are deduplicated server-side via source_hash UPSERT.
 */
export async function pushToSharedTM(
  entries: Array<{
    sourceText: string;
    targetText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
    verified: boolean;
    usageCount: number;
    context?: string;
    gameAppId?: number;
    gameName?: string;
  }>
): Promise<TMPushResult> {
  const config = getTMNetworkConfig();
  if (!config.enabled || !config.autoContribute) {
    return { pushed: 0, merged: 0, skipped: entries.length };
  }

  // Filter: only high-quality entries
  const qualified = entries.filter(e =>
    e.confidence >= config.minConfidence &&
    e.usageCount >= config.minUsageCount &&
    e.targetText.trim().length > 0 &&
    e.sourceText.trim() !== e.targetText.trim() // Skip unchanged
  );

  if (qualified.length === 0) {
    return { pushed: 0, merged: 0, skipped: entries.length };
  }

  try {
    const supabase = await getSupabase();
    const user = await getCurrentUser();

    let pushed = 0;
    let merged = 0;
    const batchSize = 50;

    for (let i = 0; i < qualified.length; i += batchSize) {
      const batch = qualified.slice(i, i + batchSize);
      const rows = batch.map(e => ({
        source_hash: hashSourceText(e.sourceText, e.sourceLanguage, e.targetLanguage),
        source_text: e.sourceText,
        target_text: e.targetText,
        source_language: e.sourceLanguage,
        target_language: e.targetLanguage,
        game_app_id: e.gameAppId,
        game_name: e.gameName,
        context: e.context,
        confidence: e.confidence,
        verified: e.verified,
        contributor_id: user?.id || null,
      }));

      // UPSERT: if source_hash exists, merge (increment contributor_count, update if higher confidence)
      const { data, error } = await supabase
        .from('shared_tm')
        .upsert(rows, {
          onConflict: 'source_hash',
          ignoreDuplicates: false,
        })
        .select('id');

      if (error) {
        clientLogger.warn(`TM Network push batch failed:`, error.message);
        continue;
      }

      pushed += data?.length || 0;
    }

    // Increment contributor counts for merged entries
    merged = qualified.length - pushed;

    clientLogger.info(`TM Network: pushed ${pushed} new, ${merged} merged`, 'TM_NETWORK');

    return { pushed, merged, skipped: entries.length - qualified.length };

  } catch (err: unknown) {
    clientLogger.error('TM Network push error:', err);
    return { pushed: 0, merged: 0, skipped: entries.length };
  }
}

// ── Lookup: Find shared translations for specific texts ────

/**
 * Look up shared translations for a batch of source texts.
 * Returns a map of sourceText → bestTranslation for exact matches.
 */
export async function lookupSharedTM(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
  gameAppId?: number,
): Promise<Map<string, SharedTMEntry>> {
  const config = getTMNetworkConfig();
  if (!config.enabled || texts.length === 0) {
    return new Map();
  }

  try {
    const supabase = await getSupabase();

    // Hash all texts for lookup
    const hashes = texts.map(t => hashSourceText(t, sourceLanguage, targetLanguage));

    const { data, error } = await supabase
      .from('shared_tm')
      .select('*')
      .in('source_hash', hashes)
      .gte('confidence', 0.7);

    if (error || !data) return new Map();

    const result = new Map<string, SharedTMEntry>();
    for (const row of data) {
      const entry = mapSharedTMRow(row);
      // Use source_text to map back (hash collision unlikely but possible)
      const matchingText = texts.find(t =>
        hashSourceText(t, sourceLanguage, targetLanguage) === entry.sourceHash
      );
      if (matchingText && !result.has(matchingText)) {
        result.set(matchingText, entry);
      }
    }

    return result;

  } catch (err: unknown) {
    clientLogger.error('TM Network lookup error:', err);
    return new Map();
  }
}

// ── Stats ──────────────────────────────────────────────────

export async function getNetworkStats(): Promise<TMNetworkStats | null> {
  try {
    const supabase = await getSupabase();

    const { count: totalEntries } = await supabase
      .from('shared_tm')
      .select('*', { count: 'exact', head: true });

    const { data: gameStats } = await supabase
      .from('shared_tm')
      .select('game_name')
      .not('game_name', 'is', null)
      .limit(1000);

    const gameCounts = new Map<string, number>();
    for (const row of gameStats || []) {
      const name = (row as { game_name: string }).game_name;
      gameCounts.set(name, (gameCounts.get(name) || 0) + 1);
    }

    const topGames = Array.from(gameCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([gameName, entryCount]) => ({ gameName, entryCount }));

    return {
      totalEntries: totalEntries || 0,
      totalGames: gameCounts.size,
      totalLanguagePairs: 0, // Simplified
      topGames,
      recentContributions: 0,
    };

  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────

function mapSharedTMRow(row: Record<string, unknown>): SharedTMEntry {
  return {
    id: row.id as string,
    sourceHash: row.source_hash as string,
    sourceText: row.source_text as string,
    targetText: row.target_text as string,
    sourceLanguage: row.source_language as string,
    targetLanguage: row.target_language as string,
    gameAppId: row.game_app_id as number | undefined,
    gameName: row.game_name as string | undefined,
    context: row.context as string | undefined,
    confidence: (row.confidence as number) || 0,
    verified: (row.verified as boolean) || false,
    contributorCount: (row.contributor_count as number) || 1,
    usageCount: (row.usage_count as number) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
