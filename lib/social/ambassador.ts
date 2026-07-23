/**
 * Selezione "Ambassador in evidenza" (traduttore in evidenza).
 *
 * Criteri PUBBLICI e AUTOMATICI per evitare favoritismi (rischio segnalato in ROADMAP):
 * l'ambassador è scelto solo dai dati della leaderboard, combinando REACH (download)
 * e QUALITÀ (rating medio). Nessuna curatela manuale.
 *
 * Formula trasparente:
 *   ambassadorScore = totalDownloads × qualityFactor
 *   qualityFactor   = avgRating > 0 ? (avgRating / 5) : 0.5   // 0.5 = neutro se non valutato
 *
 * Eleggibilità: almeno 1 pack pubblicato e almeno 1 download (niente profili vuoti).
 * Tie-break: rating medio più alto → poi reputazione → poi username (stabile).
 *
 * La logica è pura e testabile: nessuna dipendenza da rete o DOM.
 */

import type { LeaderboardEntry } from './community-hub-backend';

/** Fattore qualità 0..1 dal rating medio (0.5 neutro se il pack non ha ancora voti). */
export function qualityFactor(avgRating: number): number {
  if (!Number.isFinite(avgRating) || avgRating <= 0) return 0.5;
  const clamped = Math.max(0, Math.min(5, avgRating));
  return clamped / 5;
}

/** Punteggio ambassador: reach pesato per la qualità. */
export function ambassadorScore(entry: Pick<LeaderboardEntry, 'totalDownloads' | 'avgRating'>): number {
  const downloads = Number(entry.totalDownloads) || 0;
  return downloads * qualityFactor(entry.avgRating);
}

/** True se il traduttore è eleggibile (ha pubblicato ed è stato scaricato). */
export function isEligibleAmbassador(entry: LeaderboardEntry): boolean {
  return (Number(entry.publishedPacks) || 0) >= 1 && (Number(entry.totalDownloads) || 0) >= 1;
}

/**
 * Sceglie l'ambassador in evidenza dalla leaderboard, o null se nessuno è eleggibile.
 * Deterministico a parità di dati (tie-break stabile su username).
 */
export function pickAmbassador(leaders: readonly LeaderboardEntry[] | null | undefined): LeaderboardEntry | null {
  if (!leaders || leaders.length === 0) return null;
  const eligible = leaders.filter(isEligibleAmbassador);
  if (eligible.length === 0) return null;

  return eligible.reduce((best, cur) => {
    const bs = ambassadorScore(best);
    const cs = ambassadorScore(cur);
    if (cs !== bs) return cs > bs ? cur : best;
    // tie-break: rating, poi reputazione, poi username (stabile e prevedibile)
    if ((cur.avgRating || 0) !== (best.avgRating || 0)) return (cur.avgRating || 0) > (best.avgRating || 0) ? cur : best;
    if ((cur.reputation || 0) !== (best.reputation || 0)) return (cur.reputation || 0) > (best.reputation || 0) ? cur : best;
    return cur.username < best.username ? cur : best;
  });
}
