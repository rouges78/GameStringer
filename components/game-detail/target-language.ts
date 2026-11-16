import { getCountryCode } from '@/components/ui/language-flags';

/** Lingue rilevate dai file più quelle dello store, senza ripetizioni. */
export function mergeGameLanguages(detected: string[], fromStore: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const l of [...detected, ...fromStore]) {
    const key = getCountryCode(l) ?? l.trim().toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); merged.push(l.trim()); }
  }
  return merged;
}

/**
 * Il gioco ha già la lingua di destinazione?
 *
 * Le tabelle di localizzazione Unity stanno dentro data.unity3d, dove la
 * scansione dei file non arriva: le loro lingue le porta il piano.
 */
export function hasTargetLanguage(languages: string[], targetLang: string, unityLocLanguages: string[] = []): boolean {
  const targetCc = (getCountryCode(targetLang) ?? targetLang).toUpperCase();
  return languages.some(l => (getCountryCode(l) ?? '').toUpperCase() === targetCc)
    || unityLocLanguages.includes(targetLang.toLowerCase().split('-')[0]);
}
