// Unity Localization Package Support
// Native parsing di StringTable, Addressables catalog e Smart Strings

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface SmartToken {
  tokenType: string;  // "literal" | "variable" | "formatter" | "plural" | "nested"
  raw: string;
  inner?: string;
}

export interface StringTableEntry {
  keyId: number;
  keyName: string;
  value: string;
  isSmart: boolean;
  smartTokens: SmartToken[];
  metadata?: string;
  // Frontend-only fields
  translated?: string;
  translationStatus?: 'pending' | 'translated' | 'validated' | 'error';
  validationErrors?: string[];
}

export interface StringTableInfo {
  tableName: string;
  tableId: string;
  locale: string;
  localeName: string;
  entries: StringTableEntry[];
  bundlePath: string;
  assetPath: string;
}

export interface AddressablesCatalog {
  locales: string[];
  tables: CatalogTableRef[];
  bundles: CatalogBundleRef[];
}

export interface CatalogTableRef {
  tableName: string;
  locale: string;
  bundleFilename: string;
  internalId: string;
}

export interface CatalogBundleRef {
  internalId: string;
  bundlePath: string;
  dependencies: string[];
}

export interface SmartStringValidation {
  valid: boolean;
  missingTokens: string[];
  extraTokens: string[];
  warnings: string[];
}

export interface TranslatedEntry {
  keyId: number;
  translated: string;
}

export interface PatchResult {
  success: boolean;
  outputPath: string;
  entriesPatched: number;
  message: string;
}

export interface TranslateOptions {
  provider?: string;
  model?: string;
  preserveSmartStrings?: boolean;
  batchSize?: number;
  context?: string;
}

// ═══════════════════════════════════════════════════════════════════
// LOCALE MAP
// ═══════════════════════════════════════════════════════════════════

/** Full locale code → display name map */
export const SUPPORTED_LOCALES: Record<string, string> = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  'zh-CN': '中文(简体)',
  'zh-TW': '中文(繁體)',
  ar: 'العربية',
  pl: 'Polski',
  nl: 'Nederlands',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  nb: 'Norsk Bokmål',
  tr: 'Türkçe',
  cs: 'Čeština',
  hu: 'Magyar',
  ro: 'Română',
  el: 'Ελληνικά',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  uk: 'Українська',
  hi: 'हिन्दी',
};

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMAND WRAPPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Invoke a Tauri backend command.
 * Uses dynamic import so this module can be loaded in SSR / test contexts
 * without crashing when `@tauri-apps/api` is unavailable.
 */
async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMAND WRAPPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse an Addressables catalog.json to discover locales, table refs and bundles.
 */
export async function loadAddressablesCatalog(catalogPath: string): Promise<AddressablesCatalog> {
  return invokeCommand<AddressablesCatalog>('parse_addressables_catalog', { catalogPath });
}

/**
 * Detect all StringTable bundles in a folder (recursive).
 * Useful when the user points at a StreamingAssets or build output folder.
 */
export async function detectStringTables(folderPath: string): Promise<StringTableInfo[]> {
  return invokeCommand<StringTableInfo[]>('detect_string_tables_in_folder', { folderPath });
}

/**
 * Extract entries from a single AssetBundle that contains a StringTable.
 * Returns one StringTableInfo per locale table found in the bundle.
 */
export async function extractStringTable(bundlePath: string): Promise<StringTableInfo[]> {
  return invokeCommand<StringTableInfo[]>('extract_string_table', { bundlePath });
}

/**
 * Build a patched AssetBundle by replacing translated entries.
 * The Rust side copies the original bundle, swaps serialized values and writes outputPath.
 */
export async function buildPatchedBundle(
  originalBundle: string,
  translations: TranslatedEntry[],
  outputPath: string,
): Promise<PatchResult> {
  return invokeCommand<PatchResult>('build_patched_bundle', {
    originalBundle,
    translations,
    outputPath,
  });
}

/**
 * Validate that a translated Smart String preserves all variable/formatter tokens.
 * Delegates to the Rust parser for an authoritative check.
 */
export async function validateSmartTranslation(
  original: string,
  translated: string,
): Promise<SmartStringValidation> {
  return invokeCommand<SmartStringValidation>('validate_smart_string_translation', {
    original,
    translated,
  });
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT-SIDE SMART STRING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick check: does the text contain un-escaped `{...}` patterns?
 * Escaped braces `\{` are ignored.
 */
export function isSmartString(text: string): boolean {
  // Match `{` that is NOT preceded by `\`
  return /(?<!\\)\{[^}]+\}/.test(text);
}

/**
 * Client-side tokenizer that mirrors the Rust smart-string parser.
 *
 * Token types:
 *   literal    – plain translatable text between tokens
 *   variable   – {variableName}
 *   formatter  – {variableName:FormatterName(...)}
 *   plural     – {variableName:plural:...}
 *   nested     – {variableName:{nestedRef}}
 */
export function extractSmartTokens(text: string): SmartToken[] {
  const tokens: SmartToken[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Find next un-escaped opening brace
    const braceIdx = findUnescapedBrace(text, pos);

    // Everything before the brace is a literal
    if (braceIdx === -1) {
      const literal = text.slice(pos);
      if (literal.length > 0) {
        tokens.push({ tokenType: 'literal', raw: literal });
      }
      break;
    }

    if (braceIdx > pos) {
      tokens.push({ tokenType: 'literal', raw: text.slice(pos, braceIdx) });
    }

    // Find matching closing brace (respects nesting)
    const closeIdx = findMatchingClose(text, braceIdx);
    if (closeIdx === -1) {
      // Unbalanced brace – treat rest as literal
      tokens.push({ tokenType: 'literal', raw: text.slice(braceIdx) });
      break;
    }

    const raw = text.slice(braceIdx, closeIdx + 1);
    const inner = text.slice(braceIdx + 1, closeIdx);

    tokens.push({ tokenType: classifyToken(inner), raw, inner });
    pos = closeIdx + 1;
  }

  return tokens;
}

/** Find index of next `{` that is not escaped with `\`. Returns -1 if none. */
function findUnescapedBrace(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{' && (i === 0 || text[i - 1] !== '\\')) {
      return i;
    }
  }
  return -1;
}

/** Find matching `}` respecting nested `{...}`. */
function findMatchingClose(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '\\') {
      i++; // skip escaped char
      continue;
    }
    if (text[i] === '{') depth++;
    if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Classify the content between braces into a token type. */
function classifyToken(inner: string): string {
  if (inner.includes('{')) return 'nested';
  if (/:plural:/i.test(inner)) return 'plural';
  if (inner.includes(':')) return 'formatter';
  return 'variable';
}

/**
 * Reconstruct a Smart String: keeps variable/formatter/plural/nested tokens
 * in place, replaces literal tokens with translated text.
 *
 * @param tokens   – original token list from extractSmartTokens
 * @param translatedLiterals – translations for the literal tokens, in order
 */
export function rebuildSmartString(tokens: SmartToken[], translatedLiterals: string[]): string {
  let litIdx = 0;
  return tokens
    .map((t) => {
      if (t.tokenType === 'literal') {
        return litIdx < translatedLiterals.length ? translatedLiterals[litIdx++] : t.raw;
      }
      // Non-literal tokens are preserved verbatim
      return t.raw;
    })
    .join('');
}

/**
 * Extract only the translatable literal portions from a Smart String.
 * Useful for sending just the prose to the translation engine.
 */
export function getSmartStringLiterals(text: string): string[] {
  return extractSmartTokens(text)
    .filter((t) => t.tokenType === 'literal')
    .map((t) => t.raw);
}

// ═══════════════════════════════════════════════════════════════════
// TRANSLATION ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Translate an entire StringTable into the target locale.
 *
 * Strategy:
 *  - Plain entries are batched together for efficient bulk translation.
 *  - Smart-string entries are decomposed: only literal fragments are sent
 *    to the translation engine, then reassembled preserving tokens.
 *  - All smart translations are validated against the original token set.
 *
 * Returns a new StringTableInfo with `translated` and `translationStatus`
 * fields populated on each entry.
 */
export async function translateStringTable(
  table: StringTableInfo,
  targetLocale: string,
  options?: TranslateOptions,
): Promise<StringTableInfo> {
  const { translateWithFallback } = await import('@/lib/ai-translate-direct');

  const batchSize = options?.batchSize ?? 20;
  const preserveSmart = options?.preserveSmartStrings ?? true;

  // Deep-clone entries so we don't mutate the original
  const entries: StringTableEntry[] = table.entries.map((e) => ({ ...e }));

  // Split into plain vs smart
  const plainEntries = entries.filter((e) => !e.isSmart);
  const smartEntries = entries.filter((e) => e.isSmart);

  // ── Plain entries: batch translate ──────────────────────────
  for (let i = 0; i < plainEntries.length; i += batchSize) {
    const batch = plainEntries.slice(i, i + batchSize);
    const texts = batch.map((e) => e.value);

    try {
      const result = await translateWithFallback({
        texts,
        sourceLanguage: table.locale,
        targetLanguage: targetLocale,
        context: options?.context,
        provider: options?.provider,
        model: options?.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const translated = result.translations ?? result.results ?? [];
      batch.forEach((entry, idx) => {
        entry.translated = translated[idx] ?? '';
        entry.translationStatus = translated[idx] ? 'translated' : 'error';
      });
    } catch (err) {
      batch.forEach((entry) => {
        entry.translationStatus = 'error';
        entry.validationErrors = [(err as Error).message];
      });
    }
  }

  // ── Smart entries: decompose, translate literals, reassemble ─
  if (preserveSmart) {
    for (let i = 0; i < smartEntries.length; i += batchSize) {
      const batch = smartEntries.slice(i, i + batchSize);

      // Collect all literal fragments across the batch
      const batchTokens = batch.map((e) => extractSmartTokens(e.value));
      const allLiterals: string[] = [];
      const literalCounts: number[] = [];

      batchTokens.forEach((tokens) => {
        const lits = tokens.filter((t) => t.tokenType === 'literal').map((t) => t.raw);
        allLiterals.push(...lits);
        literalCounts.push(lits.length);
      });

      // Translate all literals in one batch call
      let translatedLiterals: string[] = [];
      try {
        if (allLiterals.length > 0) {
          const result = await translateWithFallback({
            texts: allLiterals,
            sourceLanguage: table.locale,
            targetLanguage: targetLocale,
            context: options?.context,
            provider: options?.provider,
            model: options?.model,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

          translatedLiterals = result.translations ?? result.results ?? [];
        }
      } catch (err) {
        batch.forEach((entry) => {
          entry.translationStatus = 'error';
          entry.validationErrors = [(err as Error).message];
        });
        continue;
      }

      // Reassemble each entry with its translated literals
      let litOffset = 0;
      batch.forEach((entry, batchIdx) => {
        const count = literalCounts[batchIdx];
        const entryLiterals = translatedLiterals.slice(litOffset, litOffset + count);
        litOffset += count;

        entry.translated = rebuildSmartString(batchTokens[batchIdx], entryLiterals);
        entry.translationStatus = 'translated';
      });

      // Validate smart translations
      for (const entry of batch) {
        if (entry.translated && entry.translationStatus === 'translated') {
          try {
            const validation = await validateSmartTranslation(entry.value, entry.translated);
            if (!validation.valid) {
              entry.translationStatus = 'error';
              entry.validationErrors = [
                ...validation.missingTokens.map((t) => `Missing token: ${t}`),
                ...validation.extraTokens.map((t) => `Extra token: ${t}`),
                ...validation.warnings,
              ];
            } else if (validation.warnings.length > 0) {
              entry.translationStatus = 'validated';
              entry.validationErrors = validation.warnings;
            } else {
              entry.translationStatus = 'validated';
            }
          } catch {
            // Validation backend unavailable – keep as 'translated'
          }
        }
      }
    }
  } else {
    // No smart-string preservation – translate as plain text
    for (let i = 0; i < smartEntries.length; i += batchSize) {
      const batch = smartEntries.slice(i, i + batchSize);
      const texts = batch.map((e) => e.value);
      try {
        const result = await translateWithFallback({
          texts,
          sourceLanguage: table.locale,
          targetLanguage: targetLocale,
          context: options?.context,
          provider: options?.provider,
          model: options?.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
        const translated = result.translations ?? result.results ?? [];
        batch.forEach((entry, idx) => {
          entry.translated = translated[idx] ?? '';
          entry.translationStatus = translated[idx] ? 'translated' : 'error';
        });
      } catch (err) {
        batch.forEach((entry) => {
          entry.translationStatus = 'error';
          entry.validationErrors = [(err as Error).message];
        });
      }
    }
  }

  return { ...table, entries };
}

/**
 * Validate all translated Smart Strings in a table.
 * Returns one SmartStringValidation per entry (in order).
 */
export async function validateAllTranslations(
  table: StringTableInfo,
): Promise<SmartStringValidation[]> {
  const results: SmartStringValidation[] = [];

  for (const entry of table.entries) {
    if (!entry.isSmart || !entry.translated) {
      results.push({ valid: true, missingTokens: [], extraTokens: [], warnings: [] });
      continue;
    }
    try {
      results.push(await validateSmartTranslation(entry.value, entry.translated));
    } catch {
      results.push({
        valid: false,
        missingTokens: [],
        extraTokens: [],
        warnings: ['Validation backend unavailable'],
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Export a StringTable as CSV: key, original, translated.
 * Handles quoting for fields that contain commas or newlines.
 */
export function exportTableToCSV(table: StringTableInfo): string {
  const rows: string[] = ['key,original,translated'];

  for (const entry of table.entries) {
    rows.push(
      [
        csvEscape(entry.keyName),
        csvEscape(entry.value),
        csvEscape(entry.translated ?? ''),
      ].join(','),
    );
  }

  return rows.join('\n');
}

/** Escape a CSV field: wrap in quotes if it contains comma, quote or newline. */
function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Import translations from a CSV string.
 * Matches rows to entries by key name and populates `translated` + `translationStatus`.
 * Unmatched CSV rows are silently skipped.
 */
export function importTranslationsFromCSV(csv: string, table: StringTableInfo): StringTableInfo {
  const lines = parseCSVLines(csv);
  if (lines.length === 0) return table;

  // Build lookup by keyName
  const entryMap = new Map<string, StringTableEntry>();
  const entries = table.entries.map((e) => ({ ...e }));
  entries.forEach((e) => entryMap.set(e.keyName, e));

  // Skip header if present
  const startIdx = lines[0]?.[0]?.toLowerCase() === 'key' ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const [key, , translated] = lines[i];
    const entry = entryMap.get(key);
    if (entry && translated != null && translated.length > 0) {
      entry.translated = translated;
      entry.translationStatus = 'translated';
    }
  }

  return { ...table, entries };
}

/** Minimal CSV line parser that handles quoted fields with commas/newlines. */
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
          i++; // skip escaped quote
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
        if (ch === '\r') i++; // skip \n of \r\n
      } else {
        field += ch;
      }
    }
  }

  // Push last field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    results.push(current);
  }

  return results;
}

/**
 * Export a StringTable as JSON with full metadata.
 * Useful for backup / external tool integration.
 */
export function exportTableToJSON(table: StringTableInfo): string {
  return JSON.stringify(
    {
      tableName: table.tableName,
      tableId: table.tableId,
      locale: table.locale,
      localeName: table.localeName,
      bundlePath: table.bundlePath,
      assetPath: table.assetPath,
      exportedAt: new Date().toISOString(),
      entryCount: table.entries.length,
      entries: table.entries.map((e) => ({
        keyId: e.keyId,
        keyName: e.keyName,
        value: e.value,
        translated: e.translated ?? null,
        isSmart: e.isSmart,
        translationStatus: e.translationStatus ?? null,
        metadata: e.metadata ?? null,
      })),
    },
    null,
    2,
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOCALE HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Map a locale code to its human-readable display name.
 * Falls back to the code itself if not found in SUPPORTED_LOCALES.
 */
export function getLocaleDisplayName(code: string): string {
  return SUPPORTED_LOCALES[code] ?? SUPPORTED_LOCALES[code.split('-')[0]] ?? code;
}
