/**
 * Canonical list of translation TARGET languages — single source of truth.
 *
 * Shape `{ code, name (native), flag (emoji) }`, consumed by the translation
 * UIs (auto-translate wizard, subtitle/batch/texture/manga/emulator/OCR tools).
 * This is the UNION of all the per-screen lists that used to be duplicated, so
 * no screen loses an option: add a language here once and it shows up everywhere.
 *
 * NOTE: backend support (NLLB codes, provider affinity, name maps) lives in
 * ./language-mappings.ts — keep the two in sync when adding a language.
 */
export interface TargetLanguage {
  code: string;
  name: string;
  flag: string;
}

/**
 * Percorso dell'SVG bandiera per un codice lingua, o null se sconosciuto.
 * PERCHÉ SVG e non emoji: su Windows le emoji bandiera NON esistono nei font
 * di sistema — WebView2 mostra le due lettere (🇮🇹 → «IT»), quindi le card
 * mostravano «IT EN → IT». Gli SVG stanno in public/flags/<code>.svg
 * (estratti da flag-icons, MIT — licenza accanto ai file), uno per ogni
 * lingua di QUESTA lista: aggiungendo una lingua, aggiungere anche l'SVG.
 */
export function langFlagSrc(code: string): string | null {
  const c = (code || '').toLowerCase();
  return TARGET_LANGUAGES.some(l => l.code === c) ? `/flags/${c}.svg` : null;
}

export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'pt-br', name: 'Português (BR)', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'bg', name: 'Български', flag: '🇧🇬' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文 (简)', flag: '🇨🇳' },
  { code: 'zh-tw', name: '中文 (繁)', flag: '🇹🇼' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];
