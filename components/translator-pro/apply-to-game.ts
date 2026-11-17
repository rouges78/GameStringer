/**
 * Pure helpers for Translator Pro "Applica al gioco".
 */

/** One translated file and what actually happened to it on disk. */
export interface ApplyOutcome {
  file: string;
  status: 'written' | 'failed' | 'skipped';
  detail: string;
}

/**
 * Name of the new language file next to the game's source language file.
 * Mirrors the naming in apply_translation_file (src-tauri/src/commands/unity_patcher.rs),
 * so the page can write the same path through save_file_with_backup and keep a backup
 * when that file already exists.
 */
export function localizationTargetFilename(
  sourceFilename: string | undefined,
  format: string,
  targetLanguage: string,
): string {
  const lang2 = targetLanguage.slice(0, 2);
  if (sourceFilename) {
    if (sourceFilename.includes('en-US')) {
      return sourceFilename.split('en-US').join(`${lang2}-${lang2.toUpperCase()}`);
    }
    if (sourceFilename.includes('en_US')) {
      return sourceFilename.split('en_US').join(`${lang2}_${lang2.toUpperCase()}`);
    }
    if (sourceFilename.toLowerCase().includes('english')) {
      return sourceFilename.toLowerCase().split('english').join(targetLanguage);
    }
  }
  return `${targetLanguage}.${format}`;
}

/** True for paths that point at a real place on disk (C:\..., \\server\..., /...). */
export function isAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/');
}

function escapeXUnity(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/=/g, '\\=');
}

/**
 * XUnity.AutoTranslator dictionary lines (original=translation) built from the
 * translated strings, not from the raw file contents: a JSON or CSV file has no
 * "original=translation" lines to copy.
 */
export function buildXUnityDictionary(
  items: ReadonlyArray<{ sourceText: string; translatedText: string }>,
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { sourceText, translatedText } of items) {
    if (!sourceText || !translatedText || sourceText === translatedText) continue;
    const original = escapeXUnity(sourceText);
    if (seen.has(original)) continue;
    seen.add(original);
    lines.push(`${original}=${escapeXUnity(translatedText)}`);
  }
  return lines;
}
