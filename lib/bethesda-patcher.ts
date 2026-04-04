// Bethesda Engine Patcher — TypeScript Service Layer
// Supporto per BSA/BA2, STRINGS/DLSTRINGS/ILSTRINGS, ESP/ESM plugin
// Giochi: Skyrim, Fallout 4, Starfield, Oblivion, Fallout 3/NV

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface BethesdaGameInfo {
  game_type: string;
  game_name: string;
  data_path: string;
  plugins: PluginInfo[];
  string_tables: StringTableFile[];
  bsa_files: string[];
}

export interface PluginInfo {
  filename: string;
  is_master: boolean;
  size: number;
  is_localized: boolean;
}

export interface StringTableFile {
  path: string;
  language: string;
  table_type: string;
  plugin_name: string;
}

export interface BsaEntry {
  path: string;
  size: number;
  compressed: boolean;
}

export interface StringEntry {
  id: number;
  value: string;
  // Frontend-only fields
  translated?: string;
  translationStatus?: 'pending' | 'translated' | 'error';
}

export interface PluginStringEntry {
  form_id: number;
  record_type: string;
  field_name: string;
  editor_id: string;
  value: string;
  context: string;
  // Frontend-only fields
  translated?: string;
  translationStatus?: 'pending' | 'translated' | 'error';
}

export interface PatchedStringEntry {
  id: number;
  value: string;
}

// ═══════════════════════════════════════════════════════════════════
// LANGUAGE MAP
// ═══════════════════════════════════════════════════════════════════

/** Bethesda string table language names (as used in filenames) */
export const BETHESDA_LANGUAGES: Record<string, string> = {
  English: 'English',
  French: 'Fran\u00e7ais',
  German: 'Deutsch',
  Italian: 'Italiano',
  Spanish: 'Espa\u00f1ol',
  Polish: 'Polski',
  Portuguese: 'Portugu\u00eas',
  Russian: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
  Japanese: '\u65e5\u672c\u8a9e',
  Chinese: '\u4e2d\u6587',
  Czech: '\u010ce\u0161tina',
  Turkish: 'T\u00fcrk\u00e7e',
};

/** Record types with human-readable descriptions */
export const RECORD_TYPE_LABELS: Record<string, string> = {
  BOOK: 'Libri',
  NPC_: 'NPC',
  QUST: 'Missioni',
  DIAL: 'Dialoghi',
  INFO: 'Risposte Dialogo',
  WEAP: 'Armi',
  ARMO: 'Armature',
  MISC: 'Oggetti Vari',
  ALCH: 'Pozioni',
  AMMO: 'Munizioni',
  INGR: 'Ingredienti',
  KEYM: 'Chiavi',
  SCRL: 'Pergamene',
  SLGM: 'Gemme Animiche',
  SPEL: 'Incantesimi',
  MESG: 'Messaggi',
  PERK: 'Perk',
  RACE: 'Razze',
  CELL: 'Celle',
  WRLD: 'Mondi',
  FACT: 'Fazioni',
};

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMAND WRAPPER
// ═══════════════════════════════════════════════════════════════════

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMAND WRAPPERS
// ═══════════════════════════════════════════════════════════════════

/** Rileva il tipo di gioco Bethesda dalla cartella */
export async function detectBethesdaGame(gamePath: string): Promise<BethesdaGameInfo> {
  return invokeCommand<BethesdaGameInfo>('detect_bethesda_game', { gamePath });
}

/** Lista il contenuto di un archivio BSA/BA2 senza estrarre */
export async function listBsaContents(bsaPath: string): Promise<BsaEntry[]> {
  return invokeCommand<BsaEntry[]>('list_bsa_contents', { bsaPath });
}

/** Estrae e parsa un file STRINGS/DLSTRINGS/ILSTRINGS */
export async function extractStringsFile(stringsPath: string): Promise<StringEntry[]> {
  return invokeCommand<StringEntry[]>('extract_strings_file', { stringsPath });
}

/** Estrae tutte le stringhe traducibili da un plugin ESP/ESM */
export async function extractPluginStrings(pluginPath: string): Promise<PluginStringEntry[]> {
  return invokeCommand<PluginStringEntry[]>('extract_plugin_strings', { pluginPath });
}

/** Costruisce un file STRINGS/DLSTRINGS/ILSTRINGS patchato */
export async function buildPatchedStrings(
  entries: PatchedStringEntry[],
  outputPath: string,
  format: string,
): Promise<string> {
  return invokeCommand<string>('build_patched_strings', { entries, outputPath, format });
}

/** Estrae un singolo file da un archivio BSA/BA2 */
export async function extractFileFromBsa(
  bsaPath: string,
  filePath: string,
  outputPath: string,
): Promise<string> {
  return invokeCommand<string>('extract_file_from_bsa', { bsaPath, filePath, outputPath });
}

// ═══════════════════════════════════════════════════════════════════
// TRANSLATION ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════

export interface TranslateOptions {
  provider?: string;
  model?: string;
  batchSize?: number;
  context?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

/**
 * Traduce in batch le string entries usando il provider AI configurato.
 * Restituisce le entries con i campi translated e translationStatus popolati.
 */
export async function translateStringEntries(
  entries: StringEntry[],
  options?: TranslateOptions,
): Promise<StringEntry[]> {
  const { translateWithFallback } = await import('@/lib/ai-translate-direct');
  const batchSize = options?.batchSize ?? 20;
  const result = entries.map((e) => ({ ...e }));

  for (let i = 0; i < result.length; i += batchSize) {
    const batch = result.slice(i, i + batchSize);
    const texts = batch.map((e) => e.value);

    try {
      const res = await translateWithFallback({
        texts,
        sourceLanguage: options?.sourceLanguage ?? 'en',
        targetLanguage: options?.targetLanguage ?? 'it',
        context: options?.context,
        provider: options?.provider,
        model: options?.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const translated = res.translations ?? res.results ?? [];
      batch.forEach((entry, idx) => {
        entry.translated = translated[idx] ?? '';
        entry.translationStatus = translated[idx] ? 'translated' : 'error';
      });
    } catch {
      batch.forEach((entry) => {
        entry.translationStatus = 'error';
      });
    }
  }

  return result;
}

/**
 * Traduce in batch le plugin string entries con contesto record type.
 */
export async function translatePluginEntries(
  entries: PluginStringEntry[],
  options?: TranslateOptions,
): Promise<PluginStringEntry[]> {
  const { translateWithFallback } = await import('@/lib/ai-translate-direct');
  const batchSize = options?.batchSize ?? 20;
  const result = entries.map((e) => ({ ...e }));

  for (let i = 0; i < result.length; i += batchSize) {
    const batch = result.slice(i, i + batchSize);
    const texts = batch.map((e) => e.value);

    try {
      const contextStr = `Bethesda game translation. Record types: ${
        [...new Set(batch.map((e) => e.record_type))].join(', ')
      }. ${options?.context ?? ''}`;

      const res = await translateWithFallback({
        texts,
        sourceLanguage: options?.sourceLanguage ?? 'en',
        targetLanguage: options?.targetLanguage ?? 'it',
        context: contextStr,
        provider: options?.provider,
        model: options?.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const translated = res.translations ?? res.results ?? [];
      batch.forEach((entry, idx) => {
        entry.translated = translated[idx] ?? '';
        entry.translationStatus = translated[idx] ? 'translated' : 'error';
      });
    } catch {
      batch.forEach((entry) => {
        entry.translationStatus = 'error';
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT — CSV
// ═══════════════════════════════════════════════════════════════════

/** Escape a CSV field */
function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Export string entries to CSV format */
export function exportStringsToCSV(entries: StringEntry[]): string {
  const rows: string[] = ['id,original,translated'];
  for (const e of entries) {
    rows.push(
      [csvEscape(String(e.id)), csvEscape(e.value), csvEscape(e.translated ?? '')].join(','),
    );
  }
  return rows.join('\n');
}

/** Export plugin string entries to CSV format */
export function exportPluginStringsToCSV(entries: PluginStringEntry[]): string {
  const rows: string[] = ['form_id,record_type,field_name,editor_id,original,translated'];
  for (const e of entries) {
    rows.push(
      [
        csvEscape(`0x${e.form_id.toString(16).toUpperCase().padStart(8, '0')}`),
        csvEscape(e.record_type),
        csvEscape(e.field_name),
        csvEscape(e.editor_id),
        csvEscape(e.value),
        csvEscape(e.translated ?? ''),
      ].join(','),
    );
  }
  return rows.join('\n');
}

/** Import translations from CSV for string entries */
export function importStringsFromCSV(csv: string, entries: StringEntry[]): StringEntry[] {
  const lines = parseCSVLines(csv);
  if (lines.length === 0) return entries;

  const entryMap = new Map<number, StringEntry>();
  const result = entries.map((e) => ({ ...e }));
  result.forEach((e) => entryMap.set(e.id, e));

  const startIdx = lines[0]?.[0]?.toLowerCase() === 'id' ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const [idStr, , translated] = lines[i];
    const id = parseInt(idStr, 10);
    const entry = entryMap.get(id);
    if (entry && translated != null && translated.length > 0) {
      entry.translated = translated;
      entry.translationStatus = 'translated';
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT — PO (Gettext)
// ═══════════════════════════════════════════════════════════════════

/** Export string entries to PO (Gettext) format */
export function exportStringsToPO(
  entries: StringEntry[],
  pluginName: string,
  language: string,
): string {
  const header = [
    `# Bethesda String Translation`,
    `# Plugin: ${pluginName}`,
    `# Language: ${language}`,
    `# Generated by GameStringer`,
    ``,
    `msgid ""`,
    `msgstr ""`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Language: ${language}\\n"`,
    `"X-Plugin: ${pluginName}\\n"`,
    ``,
  ];

  const poEntries = entries.map((e) => {
    const msgid = poEscape(e.value);
    const msgstr = poEscape(e.translated ?? '');
    return [
      `#. ID: ${e.id}`,
      `msgctxt "${e.id}"`,
      `msgid ${msgid}`,
      `msgstr ${msgstr}`,
      ``,
    ].join('\n');
  });

  return [...header, ...poEntries].join('\n');
}

/** Export plugin string entries to PO format */
export function exportPluginStringsToPO(
  entries: PluginStringEntry[],
  pluginName: string,
  language: string,
): string {
  const header = [
    `# Bethesda Plugin String Translation`,
    `# Plugin: ${pluginName}`,
    `# Language: ${language}`,
    `# Generated by GameStringer`,
    ``,
    `msgid ""`,
    `msgstr ""`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Language: ${language}\\n"`,
    `"X-Plugin: ${pluginName}\\n"`,
    ``,
  ];

  const poEntries = entries.map((e) => {
    const formIdHex = `0x${e.form_id.toString(16).toUpperCase().padStart(8, '0')}`;
    const msgid = poEscape(e.value);
    const msgstr = poEscape(e.translated ?? '');
    return [
      `#. ${e.record_type} > ${e.field_name} [${formIdHex}]`,
      `#. Editor ID: ${e.editor_id}`,
      `msgctxt "${formIdHex}:${e.field_name}"`,
      `msgid ${msgid}`,
      `msgstr ${msgstr}`,
      ``,
    ].join('\n');
  });

  return [...header, ...poEntries].join('\n');
}

/** Import translations from PO file for string entries */
export function importStringsFromPO(po: string, entries: StringEntry[]): StringEntry[] {
  const result = entries.map((e) => ({ ...e }));
  const entryMap = new Map<number, StringEntry>();
  result.forEach((e) => entryMap.set(e.id, e));

  const blocks = po.split(/\n\n+/);
  for (const block of blocks) {
    const ctxMatch = block.match(/msgctxt\s+"(\d+)"/);
    const strMatch = block.match(/msgstr\s+((?:"[^"]*"\s*)+)/);
    if (ctxMatch && strMatch) {
      const id = parseInt(ctxMatch[1], 10);
      const translated = poUnescape(strMatch[1]);
      const entry = entryMap.get(id);
      if (entry && translated.length > 0) {
        entry.translated = translated;
        entry.translationStatus = 'translated';
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// PO FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════

function poEscape(text: string): string {
  if (text.length === 0) return '""';
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  // Split long strings into multi-line PO format
  if (escaped.length > 76) {
    const chunks: string[] = [];
    let remaining = escaped;
    while (remaining.length > 76) {
      let splitAt = remaining.lastIndexOf(' ', 76);
      if (splitAt <= 0) splitAt = 76;
      chunks.push(`"${remaining.slice(0, splitAt)}"`);
      remaining = remaining.slice(splitAt);
    }
    if (remaining.length > 0) {
      chunks.push(`"${remaining}"`);
    }
    return `""\n${chunks.join('\n')}`;
  }

  return `"${escaped}"`;
}

function poUnescape(raw: string): string {
  // Concatenate multi-line PO strings
  const parts = raw.match(/"([^"]*)"/g);
  if (!parts) return '';
  return parts
    .map((p) => p.slice(1, -1))
    .join('')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

// ═══════════════════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════════════════

function parseCSVLines(csv: string): string[][] {
  const results: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && csv[i + 1] === '\n')) {
        current.push(field);
        field = '';
        results.push(current);
        current = [];
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    results.push(current);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Get human-readable language name from Bethesda language string */
export function getLanguageDisplayName(lang: string): string {
  return BETHESDA_LANGUAGES[lang] ?? lang;
}

/** Get record type label in Italian */
export function getRecordTypeLabel(recordType: string): string {
  return RECORD_TYPE_LABELS[recordType] ?? recordType;
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Format a Form ID as hex string */
export function formatFormId(formId: number): string {
  return '0x' + formId.toString(16).toUpperCase().padStart(8, '0');
}
