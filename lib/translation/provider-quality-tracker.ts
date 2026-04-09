/**
 * Quality history tracking system for adaptive provider routing.
 * Records provider success/failure rates per language combination
 * and reorders provider chains based on historical performance.
 */

import { normalizeLangCode } from './language-mappings';

/** Storico qualita provider per combinazione lingua+gioco (session-level) */
const providerQualityHistory = new Map<string, { successes: number; failures: number; avgUnchangedRatio: number }>();

/** Registra risultato provider per migliorare auto-select nelle prossime chiamate */
export function recordProviderQuality(provider: string, targetLang: string, unchangedRatio: number, success: boolean) {
  const key = `${provider}:${normalizeLangCode(targetLang)}`;
  const prev = providerQualityHistory.get(key) || { successes: 0, failures: 0, avgUnchangedRatio: 0 };
  const total = prev.successes + prev.failures;
  prev.avgUnchangedRatio = total > 0 ? (prev.avgUnchangedRatio * total + unchangedRatio) / (total + 1) : unchangedRatio;
  if (success) prev.successes++; else prev.failures++;
  providerQualityHistory.set(key, prev);
}

/** Applica storico qualita per riordinare la chain (provider con molte failure scendono) */
export function applyQualityHistory(chain: string[], targetLang: string): string[] {
  const lang = normalizeLangCode(targetLang);
  return [...chain].sort((a, b) => {
    const aKey = `${a}:${lang}`;
    const bKey = `${b}:${lang}`;
    const aHist = providerQualityHistory.get(aKey);
    const bHist = providerQualityHistory.get(bKey);
    if (!aHist && !bHist) return 0;
    // Provider senza storico mantengono posizione
    if (!aHist) return 0;
    if (!bHist) return 0;
    // Score: success ratio - unchanged ratio (piu alto = meglio)
    const aTotal = aHist.successes + aHist.failures;
    const bTotal = bHist.successes + bHist.failures;
    if (aTotal < 3 || bTotal < 3) return 0; // Dati insufficienti
    const aScore = (aHist.successes / aTotal) - aHist.avgUnchangedRatio;
    const bScore = (bHist.successes / bTotal) - bHist.avgUnchangedRatio;
    return bScore - aScore; // Ordine decrescente
  });
}
