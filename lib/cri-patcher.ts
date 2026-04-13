// CRI Middleware Patcher — Service Layer
// Supporto per giochi CRI: Persona, Yakuza/LAD, Tales of, Dragon Ball, Danganronpa V3 PC

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CriGameInfo {
  game_type: string;
  game_name: string;
  game_path: string;
  cpk_files: CpkFileInfo[];
  text_file_patterns: string[];
}

export interface CpkFileInfo {
  path: string;
  size: number;
  file_count: number;
}

export interface CpkEntry {
  path: string;
  size: number;
  extract_size: number;
  compressed: boolean;
  id: number;
}

export interface CriTextFile {
  internal_path: string;
  data: number[];
  encoding: string;
  format_hint: string;
}

export interface CriStringEntry {
  index: number;
  key: string;
  value: string;
  context: string;
  speaker: string;
  // Frontend-only fields
  translated?: string;
  translationStatus?: 'pending' | 'translated' | 'validated' | 'error';
  validationErrors?: string[];
}

export interface CriFilePatch {
  internal_path: string;
  data: number[];
}

export interface CriTranslateOptions {
  provider?: string;
  model?: string;
  batchSize?: number;
  context?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CRI GAME PROFILES
// ═══════════════════════════════════════════════════════════════════

export interface CriGameProfile {
  id: string;
  name: string;
  textPatterns: string[];
  description: string;
  encoding: string;
  notes: string;
}

export const CRI_GAME_PROFILES: Record<string, CriGameProfile> = {
  persona5royal: {
    id: 'persona5royal',
    name: 'Persona 5 Royal',
    textPatterns: ['*.bmd', '*.msg', '*.ftd', '*.bf'],
    description: 'Atlus JRPG — file BMD/MSG con tabella speaker, codici di controllo 0xF1+',
    encoding: 'shift-jis',
    notes: 'I file BMD contengono dialoghi con nomi speaker separati. data_e.cpk contiene testi English.',
  },
  persona4golden: {
    id: 'persona4golden',
    name: 'Persona 4 Golden',
    textPatterns: ['*.bmd', '*.msg', '*.ftd'],
    description: 'Atlus JRPG — struttura simile a P5R, formato MSG/BMD legacy',
    encoding: 'shift-jis',
    notes: 'Versione PC usa data.cpk e data_e.cpk separati.',
  },
  persona3: {
    id: 'persona3',
    name: 'Persona 3 Reload / Portable',
    textPatterns: ['*.bmd', '*.msg', '*.ftd'],
    description: 'Atlus JRPG — Reload usa asset modernizzati, Portable è PSP-era',
    encoding: 'utf-8',
    notes: 'Reload potrebbe usare formati UE4 invece di CRI puro.',
  },
  yakuza0: {
    id: 'yakuza0',
    name: 'Yakuza 0',
    textPatterns: ['*.json', '*.xml', '*.msg', '*.gmd'],
    description: 'SEGA/RGG Studio — file .par (PAR = CPK con estensione diversa)',
    encoding: 'utf-8',
    notes: 'I file .par sono archivi CRI. Testi in JSON/XML dentro auth_w64_e.par.',
  },
  yakuzakiwami: {
    id: 'yakuzakiwami',
    name: 'Yakuza Kiwami',
    textPatterns: ['*.json', '*.xml', '*.msg', '*.gmd'],
    description: 'SEGA/RGG Studio — struttura simile a Yakuza 0',
    encoding: 'utf-8',
    notes: 'Kiwami 1 e 2 condividono la struttura PAR.',
  },
  yakuzalad: {
    id: 'yakuzalad',
    name: 'Like a Dragon (Yakuza 7+)',
    textPatterns: ['*.json', '*.xml', '*.msg'],
    description: 'SEGA/RGG Studio — serie moderna, file JSON localizzati',
    encoding: 'utf-8',
    notes: 'Usa struttura più moderna con JSON. LAD: Infinite Wealth potrebbe usare UE5.',
  },
  talesofarise: {
    id: 'talesofarise',
    name: 'Tales of Arise',
    textPatterns: ['*.txt', '*.json', '*.scp', '*.tss'],
    description: 'Bandai Namco — CPK con script dialogici .scp/.tss',
    encoding: 'utf-8',
    notes: 'Arise usa UE4 ma i testi CRI sono ancora in CPK.',
  },
  talesofberseria: {
    id: 'talesofberseria',
    name: 'Tales of Berseria',
    textPatterns: ['*.txt', '*.json', '*.scp', '*.tss'],
    description: 'Bandai Namco — engine proprietario con CPK',
    encoding: 'utf-8',
    notes: 'Script TSS contengono dialoghi con metadata speaker.',
  },
  talesofvesperia: {
    id: 'talesofvesperia',
    name: 'Tales of Vesperia DE',
    textPatterns: ['*.txt', '*.json', '*.scp'],
    description: 'Bandai Namco — remaster con CPK originali',
    encoding: 'shift-jis',
    notes: 'Versione JP usa Shift-JIS, versione EN è UTF-8.',
  },
  danganronpav3: {
    id: 'danganronpav3',
    name: 'Danganronpa V3',
    textPatterns: ['*.txt', '*.json', '*.stx'],
    description: 'Spike Chunsoft — V3 PC usa CPK (diverso da DR1/DR2 che usano PAK)',
    encoding: 'utf-8',
    notes: 'File STX contengono dialoghi strutturati. partition_data_win.cpk è il main.',
  },
  dragonballxenoverse2: {
    id: 'dragonballxenoverse2',
    name: 'Dragon Ball Xenoverse 2',
    textPatterns: ['*.msg', '*.xml', '*.json'],
    description: 'Bandai Namco/Dimps — CPK con file MSG per dialoghi',
    encoding: 'utf-8',
    notes: 'MSG usa formato proprietario diverso da Persona.',
  },
  dragonballfighterz: {
    id: 'dragonballfighterz',
    name: 'Dragon Ball FighterZ',
    textPatterns: ['*.msg', '*.json'],
    description: 'Arc System Works — UE4 + CRI per audio/cutscene',
    encoding: 'utf-8',
    notes: 'Testi principali in UE4 .locres, CRI usato per media.',
  },
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

/** Rileva il tipo di gioco CRI e i file CPK presenti */
export async function detectCriGame(gamePath: string): Promise<CriGameInfo> {
  return invokeCommand<CriGameInfo>('detect_cri_game', { gamePath });
}

/** Lista il contenuto di un file CPK */
export async function listCpkContents(cpkPath: string): Promise<CpkEntry[]> {
  return invokeCommand<CpkEntry[]>('list_cpk_contents', { cpkPath });
}

/** Estrae file di testo dal CPK corrispondenti ai pattern */
export async function extractTextFilesFromCpk(
  cpkPath: string,
  patterns: string[],
): Promise<CriTextFile[]> {
  return invokeCommand<CriTextFile[]>('extract_text_files_from_cpk', { cpkPath, patterns });
}

/** Parsa un file di testo estratto in stringhe strutturate */
export async function parseCriTextFile(
  data: number[],
  format: string,
): Promise<CriStringEntry[]> {
  return invokeCommand<CriStringEntry[]>('parse_cri_text_file', { data, format });
}

/** Costruisce un CPK patchato con file modificati */
export async function buildPatchedCpk(
  originalCpk: string,
  patches: CriFilePatch[],
  outputPath: string,
): Promise<string> {
  return invokeCommand<string>('build_patched_cpk', { originalCpk, patches, outputPath });
}

// ═══════════════════════════════════════════════════════════════════
// TRANSLATION ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Traduce un array di CriStringEntry con contesto speaker.
 * Raggruppa per speaker per dare contesto migliore all'AI.
 */
export async function translateCriEntries(
  entries: CriStringEntry[],
  options: CriTranslateOptions,
): Promise<CriStringEntry[]> {
  const { translateWithFallback } = await import('@/lib/ai-translate-direct');

  const batchSize = options.batchSize ?? 20;
  const result = entries.map((e) => ({ ...e }));

  // Raggruppa per speaker per dare contesto
  const bySpeaker = new Map<string, number[]>();
  result.forEach((entry, idx) => {
    const speaker = entry.speaker || '__narrator__';
    if (!bySpeaker.has(speaker)) bySpeaker.set(speaker, []);
    bySpeaker.get(speaker)!.push(idx);
  });

  for (const [speaker, indices] of bySpeaker) {
    const speakerContext = speaker !== '__narrator__'
      ? `Parlante: ${speaker}. `
      : '';
    const fullContext = `${speakerContext}${options.context ?? 'Traduzione dialoghi videogioco'}`;

    for (let i = 0; i < indices.length; i += batchSize) {
      const batchIndices = indices.slice(i, i + batchSize);
      const texts = batchIndices.map((idx) => result[idx].value);

      try {
        const translateResult = await translateWithFallback({
          texts,
          sourceLanguage: options.sourceLanguage ?? 'ja',
          targetLanguage: options.targetLanguage ?? 'it',
          context: fullContext,
          provider: options.provider,
          model: options.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const translated = translateResult.translations ?? (translateResult as unknown as Record<string, string[]>).results ?? [];
        batchIndices.forEach((entryIdx, batchIdx) => {
          result[entryIdx].translated = translated[batchIdx] ?? '';
          result[entryIdx].translationStatus = translated[batchIdx] ? 'translated' : 'error';
        });
      } catch (err: unknown) {
        batchIndices.forEach((entryIdx) => {
          result[entryIdx].translationStatus = 'error';
          result[entryIdx].validationErrors = [(err as Error).message];
        });
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT — CSV
// ═══════════════════════════════════════════════════════════════════

/** Esporta le entry CRI come CSV */
export function exportToCSV(entries: CriStringEntry[]): string {
  const rows: string[] = ['index,key,speaker,value,translated,context'];

  for (const entry of entries) {
    rows.push(
      [
        String(entry.index),
        csvEscape(entry.key),
        csvEscape(entry.speaker),
        csvEscape(entry.value),
        csvEscape(entry.translated ?? ''),
        csvEscape(entry.context),
      ].join(','),
    );
  }

  return rows.join('\n');
}

/** Importa traduzioni da CSV */
export function importFromCSV(csv: string, entries: CriStringEntry[]): CriStringEntry[] {
  const lines = parseCSVLines(csv);
  if (lines.length === 0) return entries;

  const result = entries.map((e) => ({ ...e }));
  const entryMap = new Map<string, CriStringEntry>();
  result.forEach((e) => entryMap.set(e.key, e));

  const startIdx = lines[0]?.[0]?.toLowerCase() === 'index' ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i];
    // Formato: index, key, speaker, value, translated, context
    const key = cols[1];
    const translated = cols[4];
    const entry = entryMap.get(key);
    if (entry && translated != null && translated.length > 0) {
      entry.translated = translated;
      entry.translationStatus = 'translated';
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT — PO (gettext)
// ═══════════════════════════════════════════════════════════════════

/** Esporta le entry CRI come file PO (gettext) */
export function exportToPO(entries: CriStringEntry[], locale: string): string {
  const lines: string[] = [
    '# CRI Middleware Translation',
    '# Generated by GameStringer',
    'msgid ""',
    'msgstr ""',
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"Language: ${locale}\\n"`,
    '',
  ];

  for (const entry of entries) {
    lines.push('');
    lines.push(`#. ${entry.context}`);
    if (entry.speaker) {
      lines.push(`#. Speaker: ${entry.speaker}`);
    }
    lines.push(`msgctxt "${poEscape(entry.key)}"`);
    lines.push(`msgid "${poEscape(entry.value)}"`);
    lines.push(`msgstr "${poEscape(entry.translated ?? '')}"`);
  }

  return lines.join('\n');
}

/** Importa traduzioni da file PO */
export function importFromPO(po: string, entries: CriStringEntry[]): CriStringEntry[] {
  const result = entries.map((e) => ({ ...e }));
  const entryMap = new Map<string, CriStringEntry>();
  result.forEach((e) => entryMap.set(e.key, e));

  const blocks = po.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    let msgctxt = '';
    let msgstr = '';
    let inMsgstr = false;

    for (const line of lines) {
      if (line.startsWith('msgctxt ')) {
        msgctxt = poUnescape(line.slice(9, -1));
        inMsgstr = false;
      } else if (line.startsWith('msgstr ')) {
        msgstr = poUnescape(line.slice(8, -1));
        inMsgstr = true;
      } else if (inMsgstr && line.startsWith('"')) {
        msgstr += poUnescape(line.slice(1, -1));
      } else {
        inMsgstr = false;
      }
    }

    if (msgctxt && msgstr) {
      const entry = entryMap.get(msgctxt);
      if (entry) {
        entry.translated = msgstr;
        entry.translationStatus = 'translated';
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// ENCODING DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Rileva la codifica di un array di byte lato client */
export function detectEncoding(data: number[]): string {
  if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) return 'utf-16le';
  if (data.length >= 2 && data[0] === 0xFE && data[1] === 0xFF) return 'utf-16be';
  if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) return 'utf-8-bom';

  // Check if valid UTF-8
  let i = 0;
  let isUtf8 = true;
  while (i < data.length) {
    const b = data[i];
    if (b < 0x80) { i++; continue; }
    let needed = 0;
    if ((b & 0xE0) === 0xC0) needed = 1;
    else if ((b & 0xF0) === 0xE0) needed = 2;
    else if ((b & 0xF8) === 0xF0) needed = 3;
    else { isUtf8 = false; break; }
    for (let j = 0; j < needed; j++) {
      i++;
      if (i >= data.length || (data[i] & 0xC0) !== 0x80) { isUtf8 = false; break; }
    }
    if (!isUtf8) break;
    i++;
  }

  return isUtf8 ? 'utf-8' : 'shift-jis';
}

/** Suggerisci il profilo gioco basandosi sul game_type rilevato */
export function getGameProfile(gameType: string): CriGameProfile | null {
  return CRI_GAME_PROFILES[gameType] ?? null;
}

/** Formatta dimensione file */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

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

function poEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function poUnescape(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
