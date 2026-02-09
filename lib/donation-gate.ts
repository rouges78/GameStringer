/**
 * Soft paywall / donation gate
 * Gratis fino a FREE_TRANSLATION_LIMIT stringhe, poi chiede donazione.
 * L'utente può sbloccare con "Ho donato" (honor system) o codice supporter.
 */

const FREE_TRANSLATION_LIMIT = 500;
const STORAGE_KEY = 'gameStringer_translationCount';
const SUPPORTER_KEY = 'gameStringer_supporter';

/** Ottieni il conteggio totale di stringhe tradotte */
export function getTranslationCount(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

/** Incrementa il conteggio di stringhe tradotte */
export function addTranslationCount(count: number): number {
  const current = getTranslationCount();
  const newCount = current + count;
  try {
    localStorage.setItem(STORAGE_KEY, String(newCount));
  } catch {}
  return newCount;
}

/** Controlla se l'utente è supporter (ha sbloccato) */
export function isSupporter(): boolean {
  try {
    return localStorage.getItem(SUPPORTER_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Sblocca come supporter */
export function unlockSupporter(): void {
  try {
    localStorage.setItem(SUPPORTER_KEY, 'true');
  } catch {}
}

/** Reset supporter status (per debug) */
export function resetSupporter(): void {
  try {
    localStorage.removeItem(SUPPORTER_KEY);
  } catch {}
}

/** Controlla se può tradurre (sotto il limite o supporter) */
export function canTranslate(): { allowed: boolean; count: number; limit: number; remaining: number } {
  const count = getTranslationCount();
  const supporter = isSupporter();
  const remaining = Math.max(0, FREE_TRANSLATION_LIMIT - count);
  
  return {
    allowed: supporter || count < FREE_TRANSLATION_LIMIT,
    count,
    limit: FREE_TRANSLATION_LIMIT,
    remaining: supporter ? Infinity : remaining,
  };
}

/** Limite gratuito */
export const FREE_LIMIT = FREE_TRANSLATION_LIMIT;
