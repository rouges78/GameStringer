/**
 * Benchmark aggregator — classifiche di qualità per provider × coppia lingua × genere.
 *
 * Task ROADMAP `bench-quality`: i QA score 0–100 già calcolati su ogni run
 * vengono aggregati (localmente e, opt-in, in forma anonima sul cloud) per
 * produrre classifiche "per IT→JA su JRPG il migliore è X". Due usi:
 *   1. Auto-Select DATA-DRIVEN: riordina la chain dei provider in base ai dati.
 *   2. Benchmark pubblico (marketing): stesse aggregazioni, viste condivise.
 *
 * Il cuore è PURO e testabile: usa l'algoritmo di Welford (media + varianza
 * incrementali, nessun campione grezzo da conservare) e classifica con un
 * LOWER BOUND di confidenza (media − z·errore standard), così un provider con
 * pochi campioni ma media alta non scavalca ingiustamente uno ben testato.
 */

/** Statistica incrementale per una chiave (Welford). */
export interface BenchStat {
  /** Numero di campioni. */
  n: number;
  /** Media dei QA score (0–100). */
  mean: number;
  /** Somma degli scarti quadratici (per la varianza). */
  m2: number;
}

/** Aggregato: chiave `provider|src>tgt|genre` → statistica. */
export type BenchAggregate = Record<string, BenchStat>;

export interface BenchSample {
  provider: string;
  sourceLang: string;
  targetLang: string;
  /** Genere del gioco (es. 'jrpg', 'visualnovel'); 'any' se sconosciuto. */
  genre?: string | null;
  /** QA score 0–100. */
  score: number;
}

export interface RankOptions {
  sourceLang: string;
  targetLang: string;
  genre?: string | null;
  /** Sotto questa soglia il provider è "non confidente" (default 5). */
  minSamples?: number;
  /** z del lower bound (default 1.28 ≈ 80% one-sided). */
  z?: number;
}

export interface ProviderRank {
  provider: string;
  mean: number;
  count: number;
  stddev: number;
  /** Punteggio conservativo usato per l'ordinamento (media − z·SE). */
  lowerBound: number;
  /** True se ha abbastanza campioni da essere considerato affidabile. */
  confident: boolean;
}

const clampScore = (s: number): number => Math.max(0, Math.min(100, s));
const norm = (s: string): string => (s || '').toLowerCase().trim();

/** Chiave di aggregazione stabile. */
export function benchKey(provider: string, sourceLang: string, targetLang: string, genre?: string | null): string {
  return `${norm(provider)}|${norm(sourceLang)}>${norm(targetLang)}|${norm(genre || 'any') || 'any'}`;
}

/** Inserisce un campione nell'aggregato (Welford), ritornando lo stesso oggetto mutato. */
export function addSample(agg: BenchAggregate, sample: BenchSample): BenchAggregate {
  const key = benchKey(sample.provider, sample.sourceLang, sample.targetLang, sample.genre);
  const score = clampScore(sample.score);
  const cur = agg[key] || { n: 0, mean: 0, m2: 0 };
  const n = cur.n + 1;
  const delta = score - cur.mean;
  const mean = cur.mean + delta / n;
  const m2 = cur.m2 + delta * (score - mean);
  agg[key] = { n, mean, m2 };
  return agg;
}

/** Deviazione standard campionaria da una BenchStat. */
export function stddevOf(stat: BenchStat): number {
  if (stat.n < 2) return 0;
  const variance = stat.m2 / (stat.n - 1);
  return variance > 0 ? Math.sqrt(variance) : 0;
}

/**
 * Lower bound di confidenza (conservativo). Con pochissimi campioni la
 * deviazione è sconosciuta: usa una PRIOR (25 su scala 0–100) così i provider
 * con 1 solo campione non dominano la classifica.
 */
export function confidenceLowerBound(stat: BenchStat, z = 1.28): number {
  if (stat.n <= 0) return 0;
  const sd = stat.n >= 2 ? stddevOf(stat) : 25;
  const se = sd / Math.sqrt(stat.n);
  return stat.mean - z * se;
}

/**
 * Classifica i provider per una coppia lingua+genere, dal migliore al peggiore.
 * Ordina per lower bound di confidenza, poi per numero di campioni.
 */
export function rankProviders(agg: BenchAggregate, opts: RankOptions): ProviderRank[] {
  const minSamples = opts.minSamples ?? 5;
  const z = opts.z ?? 1.28;
  const suffix = `|${norm(opts.sourceLang)}>${norm(opts.targetLang)}|${norm(opts.genre || 'any') || 'any'}`;

  const ranks: ProviderRank[] = [];
  for (const [key, stat] of Object.entries(agg)) {
    if (!key.endsWith(suffix)) continue;
    const provider = key.slice(0, key.length - suffix.length);
    ranks.push({
      provider,
      mean: stat.mean,
      count: stat.n,
      stddev: stddevOf(stat),
      lowerBound: confidenceLowerBound(stat, z),
      confident: stat.n >= minSamples,
    });
  }

  ranks.sort((a, b) => {
    if (a.confident !== b.confident) return a.confident ? -1 : 1;
    if (b.lowerBound !== a.lowerBound) return b.lowerBound - a.lowerBound;
    return b.count - a.count;
  });
  return ranks;
}

/**
 * Riordina la chain dei provider in modo DATA-DRIVEN: i provider "confidenti"
 * (abbastanza campioni) salgono secondo il lower bound; gli altri mantengono
 * l'ordine originale, subito dopo. Ordinamento stabile (nessun provider perso).
 */
export function recommendChainOrder(
  chain: string[],
  agg: BenchAggregate,
  opts: RankOptions
): string[] {
  const rankByProvider = new Map<string, ProviderRank>();
  for (const r of rankProviders(agg, opts)) rankByProvider.set(norm(r.provider), r);

  return chain
    .map((provider, index) => ({ provider, index, rank: rankByProvider.get(norm(provider)) }))
    .sort((a, b) => {
      const ac = a.rank?.confident ?? false;
      const bc = b.rank?.confident ?? false;
      if (ac !== bc) return ac ? -1 : 1;         // confidenti prima
      if (ac && bc) {
        const diff = (b.rank!.lowerBound) - (a.rank!.lowerBound);
        if (diff !== 0) return diff;             // migliore lower bound prima
      }
      return a.index - b.index;                  // altrimenti stabile
    })
    .map((x) => x.provider);
}
