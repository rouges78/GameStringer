/**
 * Gridly-Compatible CSV Export/Import
 *
 * Gridly format: ID | source_text | context | lang1 | lang2 | lang3 ...
 * Each language gets its own column. This is the de facto standard
 * for professional localization tools (Gridly, Lokalise, Crowdin).
 *
 * Export: generates a CSV with columns for each target language
 * Import: parses Gridly CSV and maps columns to translations
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface GridlyEntry {
  id: string;
  source: string;
  context?: string;
  notes?: string;
  translations: Record<string, string>; // langCode → translated text
}

export interface GridlyExportOptions {
  entries: GridlyEntry[];
  sourceLanguage: string;
  targetLanguages: string[];
  includeContext?: boolean;
  includeNotes?: boolean;
  includeEmpty?: boolean;
  delimiter?: ',' | ';' | '\t';
}

export interface GridlyImportResult {
  entries: GridlyEntry[];
  sourceLanguage: string;
  detectedLanguages: string[];
  totalRows: number;
  errors: string[];
}

// ── Language Labels ────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  en: 'English', it: 'Italian', de: 'German', fr: 'French', es: 'Spanish',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  pl: 'Polish', nl: 'Dutch', tr: 'Turkish', ar: 'Arabic', th: 'Thai',
  vi: 'Vietnamese', hi: 'Hindi', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian',
  bg: 'Bulgarian', uk: 'Ukrainian', sv: 'Swedish', da: 'Danish', no: 'Norwegian',
  fi: 'Finnish', el: 'Greek', he: 'Hebrew', id: 'Indonesian',
  'pt-br': 'Portuguese (Brazil)', 'zh-tw': 'Chinese (Traditional)',
  'es-la': 'Spanish (Latin America)',
};

function getLangLabel(code: string): string {
  return LANG_LABELS[code.toLowerCase()] || code.toUpperCase();
}

// ── CSV Escaping ───────────────────────────────────────────────────────

function escapeCsvField(value: string, delimiter: string): string {
  if (!value) return '';
  // Escape if contains delimiter, quotes, or newlines
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ── Export ──────────────────────────────────────────────────────────────

/**
 * Export translations to Gridly-compatible CSV format.
 * Columns: string_id | source_text | [context] | [notes] | lang1 | lang2 | ...
 */
export function exportToGridlyCsv(options: GridlyExportOptions): string {
  const {
    entries,
    sourceLanguage,
    targetLanguages,
    includeContext = true,
    includeNotes = false,
    includeEmpty = false,
    delimiter = ',',
  } = options;

  // Build header
  const headers = ['string_id', `source_${sourceLanguage}`];
  if (includeContext) headers.push('context');
  if (includeNotes) headers.push('notes');
  for (const lang of targetLanguages) {
    headers.push(`target_${lang}`);
  }

  const lines: string[] = [headers.map(h => escapeCsvField(h, delimiter)).join(delimiter)];

  for (const entry of entries) {
    // Skip empty translations if not requested
    if (!includeEmpty) {
      const hasAnyTranslation = targetLanguages.some(l => entry.translations[l]?.trim());
      if (!hasAnyTranslation && !entry.source?.trim()) continue;
    }

    const row = [
      escapeCsvField(entry.id, delimiter),
      escapeCsvField(entry.source, delimiter),
    ];
    if (includeContext) row.push(escapeCsvField(entry.context || '', delimiter));
    if (includeNotes) row.push(escapeCsvField(entry.notes || '', delimiter));
    for (const lang of targetLanguages) {
      row.push(escapeCsvField(entry.translations[lang] || '', delimiter));
    }
    lines.push(row.join(delimiter));
  }

  return lines.join('\n');
}

/**
 * Export to Gridly CSV and return as downloadable Blob
 */
export function exportToGridlyBlob(options: GridlyExportOptions): Blob {
  const csv = exportToGridlyCsv(options);
  // UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  return new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
}

// ── Import ─────────────────────────────────────────────────────────────

/**
 * Auto-detect delimiter from CSV content
 */
function detectDelimiter(firstLine: string): ',' | ';' | '\t' {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/**
 * Detect language codes from column headers.
 * Supports formats: target_it, it, Italian, source_en, etc.
 */
function detectLangFromHeader(header: string): { lang: string; isSource: boolean } | null {
  const h = header.trim().toLowerCase();

  // target_XX or source_XX format
  const targetMatch = h.match(/^target[_-](\w+)$/);
  if (targetMatch) return { lang: targetMatch[1], isSource: false };
  const sourceMatch = h.match(/^source[_-](\w+)$/);
  if (sourceMatch) return { lang: sourceMatch[1], isSource: true };

  // Just a language code (2-5 chars)
  if (/^[a-z]{2}(-[a-z]{2,4})?$/.test(h) && h !== 'id') {
    return { lang: h, isSource: false };
  }

  // Full language name
  for (const [code, name] of Object.entries(LANG_LABELS)) {
    if (name.toLowerCase() === h) return { lang: code, isSource: false };
  }

  return null;
}

/**
 * Import a Gridly-compatible CSV file.
 * Auto-detects delimiter, language columns, and source/target structure.
 */
export function importFromGridlyCsv(csvContent: string): GridlyImportResult {
  const errors: string[] = [];
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    return { entries: [], sourceLanguage: 'en', detectedLanguages: [], totalRows: 0, errors: ['File vuoto o senza dati'] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);

  // Detect column roles
  let idColumn = -1;
  let contextColumn = -1;
  let notesColumn = -1;
  let sourceColumn = -1;
  let sourceLang = 'en';
  const langColumns: Array<{ index: number; lang: string }> = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();

    if (h === 'string_id' || h === 'id' || h === 'key' || h === 'record_id') {
      idColumn = i;
      continue;
    }
    if (h === 'context' || h === 'description') {
      contextColumn = i;
      continue;
    }
    if (h === 'notes' || h === 'comment' || h === 'translator_notes') {
      notesColumn = i;
      continue;
    }

    const langInfo = detectLangFromHeader(headers[i]);
    if (langInfo) {
      if (langInfo.isSource) {
        sourceColumn = i;
        sourceLang = langInfo.lang;
      } else {
        langColumns.push({ index: i, lang: langInfo.lang });
      }
      continue;
    }

    // Fallback: first unrecognized text column is source
    if (sourceColumn === -1 && idColumn !== -1) {
      sourceColumn = i;
    }
  }

  // Validate
  if (idColumn === -1) {
    // Use first column as ID
    idColumn = 0;
    errors.push('Colonna ID non trovata, uso prima colonna');
  }
  if (sourceColumn === -1 && langColumns.length > 0) {
    // First lang column becomes source
    sourceColumn = langColumns[0].index;
    sourceLang = langColumns[0].lang;
    langColumns.shift();
  }

  const entries: GridlyEntry[] = [];
  for (let row = 1; row < lines.length; row++) {
    const fields = parseCsvLine(lines[row], delimiter);
    if (fields.length < 2) continue;

    const id = fields[idColumn]?.trim() || `row_${row}`;
    const source = sourceColumn >= 0 ? (fields[sourceColumn]?.trim() || '') : '';

    const translations: Record<string, string> = {};
    for (const lc of langColumns) {
      const val = fields[lc.index]?.trim() || '';
      if (val) translations[lc.lang] = val;
    }

    entries.push({
      id,
      source,
      context: contextColumn >= 0 ? fields[contextColumn]?.trim() : undefined,
      notes: notesColumn >= 0 ? fields[notesColumn]?.trim() : undefined,
      translations,
    });
  }

  return {
    entries,
    sourceLanguage: sourceLang,
    detectedLanguages: langColumns.map(lc => lc.lang),
    totalRows: entries.length,
    errors,
  };
}

// ── Conversion helpers ─────────────────────────────────────────────────

/**
 * Convert simple TranslationEntry[] (single target) to GridlyEntry[]
 */
export function translationEntriesToGridly(
  entries: Array<{ id: string; source: string; target: string; context?: string; notes?: string }>,
  targetLang: string
): GridlyEntry[] {
  return entries.map(e => ({
    id: e.id,
    source: e.source,
    context: e.context,
    notes: e.notes,
    translations: { [targetLang]: e.target },
  }));
}

/**
 * Convert GridlyEntry[] back to simple entries for a specific target language
 */
export function gridlyToTranslationEntries(
  entries: GridlyEntry[],
  targetLang: string
): Array<{ id: string; source: string; target: string; context?: string; notes?: string }> {
  return entries.map(e => ({
    id: e.id,
    source: e.source,
    target: e.translations[targetLang] || '',
    context: e.context,
    notes: e.notes,
  }));
}

/**
 * Generate filename for Gridly export
 */
export function getGridlyFileName(gameName: string, sourceLang: string, targetLangs: string[]): string {
  const sanitized = gameName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
  const langs = targetLangs.join('-');
  return `${sanitized}_gridly_${sourceLang}_${langs}.csv`;
}
