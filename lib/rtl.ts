/**
 * RTL (Right-to-Left) Support
 * Lingue RTL supportate e utility per direzione testo
 */

/** Lingue con scrittura da destra a sinistra */
export const RTL_LANGUAGES = new Set([
  'ar',  // Arabo
  'he',  // Ebraico
  'fa',  // Persiano (Farsi)
  'ur',  // Urdu
  'yi',  // Yiddish
  'ps',  // Pashto
  'sd',  // Sindhi
  'ug',  // Uiguro
  'ku',  // Curdo (Sorani)
]);

/** Ritorna 'rtl' o 'ltr' in base al codice lingua */
export function getTextDirection(langCode: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(langCode.toLowerCase().split('-')[0]) ? 'rtl' : 'ltr';
}

/** Ritorna true se la lingua è RTL */
export function isRtlLanguage(langCode: string): boolean {
  return RTL_LANGUAGES.has(langCode.toLowerCase().split('-')[0]);
}

/**
 * Applica dir="rtl" o dir="ltr" all'elemento <html>.
 * Chiamare quando cambia la lingua dell'interfaccia.
 */
export function applyDocumentDirection(langCode: string): void {
  if (typeof document === 'undefined') return;
  const dir = getTextDirection(langCode);
  document.documentElement.dir = dir;
  document.documentElement.lang = langCode;
}
