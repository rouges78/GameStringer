'use client';

/**
 * Benchmark store — persistenza LOCALE dell'aggregato qualità (Auto-Select
 * data-driven anche tra sessioni). Il cuore statistico è in
 * `benchmark-aggregator` (puro); qui si aggiunge solo il layer localStorage.
 *
 * L'invio opt-in al cloud è separato in `lib/benchmark-telemetry.ts`.
 */

import {
  addSample,
  rankProviders,
  recommendChainOrder,
  type BenchAggregate,
  type BenchSample,
  type ProviderRank,
} from './benchmark-aggregator';

const AGG_KEY = 'gs-benchmark-agg';
/** Cap difensivo sul numero di chiavi salvate (prune delle meno campionate). */
const MAX_KEYS = 2000;

function load(): BenchAggregate {
  try {
    const v = JSON.parse(localStorage.getItem(AGG_KEY) || '{}');
    return v && typeof v === 'object' ? (v as BenchAggregate) : {};
  } catch {
    return {};
  }
}

function save(agg: BenchAggregate): void {
  try {
    const keys = Object.keys(agg);
    if (keys.length > MAX_KEYS) {
      // Elimina le chiavi con meno campioni (meno informative).
      const sorted = keys.sort((a, b) => (agg[a]?.n || 0) - (agg[b]?.n || 0));
      for (const k of sorted.slice(0, keys.length - MAX_KEYS)) delete agg[k];
    }
    localStorage.setItem(AGG_KEY, JSON.stringify(agg));
  } catch {
    /* storage pieno: ignora */
  }
}

/** Registra un QA score (0–100) per provider/coppia lingua/genere nell'aggregato locale. */
export function recordQaSample(sample: BenchSample): void {
  try {
    if (typeof window === 'undefined') return;
    if (!(typeof sample.score === 'number' && sample.score >= 0)) return;
    if (!sample.provider || !sample.targetLang) return;
    const agg = load();
    addSample(agg, sample);
    save(agg);
  } catch {
    /* fail-open */
  }
}

/** Classifica locale dei provider per la coppia lingua+genere. */
export function getBenchmarkRanking(
  sourceLang: string,
  targetLang: string,
  genre?: string | null
): ProviderRank[] {
  try {
    return rankProviders(load(), { sourceLang, targetLang, genre });
  } catch {
    return [];
  }
}

/** Riordina la chain dei provider in base ai dati locali (Auto-Select data-driven). */
export function applyBenchmarkOrder(
  chain: string[],
  sourceLang: string,
  targetLang: string,
  genre?: string | null
): string[] {
  try {
    if (typeof window === 'undefined' || chain.length <= 1) return chain;
    return recommendChainOrder(chain, load(), { sourceLang, targetLang, genre });
  } catch {
    return chain;
  }
}
