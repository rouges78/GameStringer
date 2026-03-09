/**
 * 📦 Patch Generator — Genera patch di traduzione pronte per distribuzione
 * 
 * Supporta:
 * 1. ZIP con file tradotti (universale, funziona ovunque)
 * 2. Struttura file per xdelta/IPS (l'utente applica con tool esterno)
 * 3. README automatico con istruzioni di installazione
 * 4. Manifest JSON con metadata della traduzione
 * 
 * Workflow:
 * 1. Riceve file originali + traduzioni
 * 2. Applica le traduzioni nei file (sostituendo le stringhe)
 * 3. Genera ZIP con file tradotti + README + manifest
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PatchInput {
  /** Nome del file originale (percorso relativo) */
  filename: string;
  /** Contenuto originale del file */
  originalContent: string;
  /** Stringhe tradotte: chiave → traduzione */
  translations: Map<string, string>;
  /** Formato del file (per sapere come riscriverlo) */
  format: string;
}

export interface PatchFile {
  /** Percorso relativo del file nella patch */
  path: string;
  /** Contenuto del file tradotto */
  content: string;
  /** Tipo: translated, readme, manifest, changelog */
  type: 'translated' | 'readme' | 'manifest' | 'changelog';
}

export interface PatchManifest {
  name: string;
  version: string;
  gameTitle: string;
  sourceLanguage: string;
  targetLanguage: string;
  translator: string;
  description: string;
  createdAt: string;
  tool: string;
  toolVersion: string;
  fileCount: number;
  stringCount: number;
  translatedCount: number;
  qualityScore: number;
  files: Array<{
    path: string;
    format: string;
    stringCount: number;
    translatedCount: number;
  }>;
}

export interface PatchOptions {
  /** Nome del progetto di traduzione */
  projectName: string;
  /** Titolo del gioco */
  gameTitle: string;
  /** Lingua sorgente */
  sourceLanguage: string;
  /** Lingua target */
  targetLanguage: string;
  /** Nome del traduttore/team */
  translator: string;
  /** Versione della patch */
  version: string;
  /** Descrizione (opzionale) */
  description?: string;
  /** Genera README */
  includeReadme?: boolean;
  /** Genera manifest JSON */
  includeManifest?: boolean;
  /** Genera changelog */
  includeChangelog?: boolean;
  /** Score medio di qualità */
  qualityScore?: number;
  /** Note aggiuntive per il README */
  readmeNotes?: string;
}

export interface PatchResult {
  /** File generati */
  files: PatchFile[];
  /** Manifest */
  manifest: PatchManifest;
  /** Blob ZIP (se generato) */
  zipBlob?: Blob;
  /** Stats */
  stats: {
    totalFiles: number;
    totalStrings: number;
    translatedStrings: number;
    coveragePercent: number;
  };
}

// ============================================================================
// CORE — Applica traduzioni ai file
// ============================================================================

/**
 * Applica le traduzioni al contenuto di un file, rispettando il formato
 */
export function applyTranslations(
  content: string,
  translations: Map<string, string>,
  format: string,
): string {
  switch (format) {
    case 'json':
      return applyToJSON(content, translations);
    case 'csv':
      return applyToCSV(content, translations);
    case 'ini':
    case 'properties':
      return applyToINI(content, translations);
    case 'po':
      return applyToPO(content, translations);
    case 'xml':
    case 'resx':
    case 'xliff':
      return applyToXML(content, translations, format);
    case 'strings':
      return applyToStrings(content, translations);
    case 'yaml':
      return applyToYAML(content, translations);
    case 'rpy':
      // Per Ren'Py NON modifichiamo l'originale — le traduzioni vanno in game/tl/<lang>/
      return content;
    default:
      return applyGeneric(content, translations);
  }
}

function applyToJSON(content: string, translations: Map<string, string>): string {
  try {
    const obj = JSON.parse(content);
    applyToObject(obj, translations, '');
    return JSON.stringify(obj, null, 2);
  } catch {
    // Fallback: sostituzione testuale
    return applyGeneric(content, translations);
  }
}

function applyToObject(obj: any, translations: Map<string, string>, prefix: string): void {
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'string') {
      // Cerca per chiave completa o per valore
      const byKey = translations.get(fullKey);
      const byValue = translations.get(obj[key]);
      if (byKey !== undefined) {
        obj[key] = byKey;
      } else if (byValue !== undefined) {
        obj[key] = byValue;
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      applyToObject(obj[key], translations, fullKey);
    }
  }
}

function applyToCSV(content: string, translations: Map<string, string>): string {
  const lines = content.split('\n');
  return lines.map((line, i) => {
    if (i === 0) return line; // Header
    const parts = line.split(',');
    if (parts.length >= 2) {
      const key = parts[0].replace(/^"|"$/g, '').trim();
      const translated = translations.get(key);
      if (translated !== undefined) {
        parts[1] = `"${translated.replace(/"/g, '""')}"`;
        return parts.join(',');
      }
    }
    return line;
  }).join('\n');
}

function applyToINI(content: string, translations: Map<string, string>): string {
  return content.split('\n').map(line => {
    const match = line.match(/^(\s*)([\w.]+)\s*=\s*(.*)$/);
    if (match) {
      const [, indent, key, _value] = match;
      const translated = translations.get(key);
      if (translated !== undefined) {
        return `${indent}${key}=${translated}`;
      }
    }
    return line;
  }).join('\n');
}

function applyToPO(content: string, translations: Map<string, string>): string {
  const entries = content.split(/\n\n+/);
  return entries.map(entry => {
    const msgidMatch = entry.match(/msgid\s+"(.+?)"/);
    if (msgidMatch) {
      const key = msgidMatch[1];
      const translated = translations.get(key);
      if (translated !== undefined) {
        return entry.replace(/msgstr\s+".*?"/, `msgstr "${translated.replace(/"/g, '\\"')}"`);
      }
    }
    return entry;
  }).join('\n\n');
}

function applyToXML(content: string, translations: Map<string, string>, format: string): string {
  let result = content;
  for (const [key, value] of translations) {
    // Cerca pattern comuni in XML di localizzazione
    // <string name="key">valore</string>
    const patterns = [
      new RegExp(`(<[^>]*name=["']${escapeRegex(key)}["'][^>]*>)([^<]*)(</[^>]+>)`, 'g'),
      new RegExp(`(<data\\s+name=["']${escapeRegex(key)}["'][^>]*>\\s*<value>)([^<]*)(</value>)`, 'g'),
      new RegExp(`(<target[^>]*>)${escapeRegex(key)}(</target>)`, 'g'),
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, `$1${escapeXML(value)}$3`);
    }
  }
  return result;
}

function applyToStrings(content: string, translations: Map<string, string>): string {
  return content.split('\n').map(line => {
    const match = line.match(/^(\s*"(.+?)"\s*=\s*")(.+?)(";\s*)$/);
    if (match) {
      const [, prefix, key, _value, suffix] = match;
      const translated = translations.get(key);
      if (translated !== undefined) {
        return `${prefix}${translated.replace(/"/g, '\\"')}${suffix}`;
      }
    }
    return line;
  }).join('\n');
}

function applyToYAML(content: string, translations: Map<string, string>): string {
  return content.split('\n').map(line => {
    const match = line.match(/^(\s*)([\w.]+)\s*:\s*["']?(.+?)["']?\s*$/);
    if (match) {
      const [, indent, key, _value] = match;
      const translated = translations.get(key);
      if (translated !== undefined) {
        const needsQuote = /[:#{}[\],&*?|>!%@`]/.test(translated) || translated.includes('"');
        const val = needsQuote ? `"${translated.replace(/"/g, '\\"')}"` : translated;
        return `${indent}${key}: ${val}`;
      }
    }
    return line;
  }).join('\n');
}

/**
 * Genera un file di traduzione Ren'Py nativo (game/tl/<lang>/<file>.rpy)
 * Usa il formato old/new di Ren'Py per non modificare i file originali.
 */
function generateRenpyTranslationFile(
  filename: string,
  translations: Map<string, string>,
  targetLanguage: string,
): string {
  const lines: string[] = [
    `# Ren'Py Translation File — ${targetLanguage}`,
    `# Original: ${filename}`,
    `# Generated by GameStringer`,
    '',
    `translate ${targetLanguage} strings:`,
    '',
  ];

  for (const [original, translated] of translations) {
    if (!translated || translated === original) continue;
    // Escape virgolette per Ren'Py
    const escOrig = original.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escTrans = translated.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`    old "${escOrig}"`);
    lines.push(`    new "${escTrans}"`);
    lines.push('');
  }

  return lines.join('\n');
}

function applyGeneric(content: string, translations: Map<string, string>): string {
  let result = content;
  // Ordina per lunghezza decrescente per evitare sostituzioni parziali
  const sorted = [...translations.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [original, translated] of sorted) {
    if (!original || !translated || original === translated) continue;
    const escaped = escapeRegex(original);
    // Sostituisci SOLO dentro virgolette (singole o doppie) — protegge chiavi dizionario,
    // nomi variabili, identificatori di codice che non devono essere tradotti
    const quotedDouble = new RegExp(`"([^"]*?)${escaped}([^"]*?)"`, 'g');
    const quotedSingle = new RegExp(`'([^']*?)${escaped}([^']*?)'`, 'g');
    result = result.replace(quotedDouble, (match, pre, post) => `"${pre}${translated}${post}"`);
    result = result.replace(quotedSingle, (match, pre, post) => `'${pre}${translated}${post}'`);
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================================
// README GENERATOR
// ============================================================================

function generateReadme(manifest: PatchManifest, options: PatchOptions): string {
  const langNames: Record<string, string> = {
    it: 'Italiano', en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español',
    pt: 'Português', ja: '日本語', ko: '한국어', zh: '中文', ru: 'Русский',
    'pt-br': 'Português (Brasil)', 'zh-tw': '繁體中文',
  };

  const targetName = langNames[options.targetLanguage] || options.targetLanguage;
  const sourceName = langNames[options.sourceLanguage] || options.sourceLanguage;

  const lines: string[] = [
    `# ${options.gameTitle} — Traduzione ${targetName}`,
    '',
    `**Versione:** ${options.version}`,
    `**Traduttore:** ${options.translator}`,
    `**Data:** ${new Date().toLocaleDateString('it-IT')}`,
    `**Lingue:** ${sourceName} → ${targetName}`,
    `**Stringhe tradotte:** ${manifest.translatedCount}/${manifest.stringCount} (${Math.round(manifest.translatedCount / Math.max(manifest.stringCount, 1) * 100)}%)`,
    '',
  ];

  if (options.description) {
    lines.push(`## Descrizione`, '', options.description, '');
  }

  if (manifest.qualityScore > 0) {
    lines.push(`## Qualità`, '', `Score medio QA: **${manifest.qualityScore}%**`, '');
    if (manifest.qualityScore >= 80) {
      lines.push('La traduzione ha superato i controlli di qualità automatici con un punteggio eccellente.', '');
    } else if (manifest.qualityScore >= 60) {
      lines.push('La traduzione ha un buon punteggio di qualità. Alcune stringhe potrebbero necessitare di revisione.', '');
    } else {
      lines.push('La traduzione potrebbe contenere errori. Si consiglia una revisione manuale.', '');
    }
  }

  lines.push(
    '## Installazione',
    '',
    '### Metodo 1: Copia diretta',
    '1. Estrai questo archivio ZIP',
    '2. Copia i file tradotti nella cartella del gioco, sovrascrivendo gli originali',
    '3. **IMPORTANTE:** Fai un backup dei file originali prima di sovrascrivere!',
    '',
    '### Metodo 2: xdelta (se disponibile)',
    '1. Scarica xdelta (https://github.com/jmacd/xdelta)',
    '2. Applica la patch: `xdelta3 -d -s file_originale file.xdelta file_tradotto`',
    '',
  );

  lines.push(
    '## File inclusi',
    '',
    '| File | Formato | Stringhe |',
    '|------|---------|----------|',
  );
  for (const file of manifest.files) {
    lines.push(`| \`${file.path}\` | ${file.format} | ${file.translatedCount}/${file.stringCount} |`);
  }
  lines.push('');

  if (options.readmeNotes) {
    lines.push('## Note', '', options.readmeNotes, '');
  }

  lines.push(
    '## Crediti',
    '',
    `Traduzione realizzata con **GameStringer** — AI-powered game translation tool.`,
    '',
    '---',
    `*Generato automaticamente da GameStringer v2.0*`,
  );

  return lines.join('\n');
}

// ============================================================================
// PATCH GENERATOR
// ============================================================================

/**
 * Genera una patch di traduzione completa
 */
export function generatePatch(
  inputs: PatchInput[],
  options: PatchOptions,
): PatchResult {
  const files: PatchFile[] = [];
  let totalStrings = 0;
  let translatedStrings = 0;
  const manifestFiles: PatchManifest['files'] = [];

  // Applica traduzioni a ogni file
  for (const input of inputs) {
    // Per Ren'Py: genera file tl/ nativo invece di modificare l'originale
    if (input.format === 'rpy') {
      const renpyLang = options.targetLanguage || 'italian';
      // Determina il path relativo nel gioco: game/tl/<lang>/<filename>
      const baseName = input.filename.replace(/.*[/\\]/, '');
      const tlPath = `game/tl/${renpyLang}/${baseName}`;
      const tlContent = generateRenpyTranslationFile(baseName, input.translations, renpyLang);
      files.push({
        path: tlPath,
        content: tlContent,
        type: 'translated',
      });
    } else {
      const translatedContent = applyTranslations(
        input.originalContent,
        input.translations,
        input.format,
      );
      files.push({
        path: input.filename,
        content: translatedContent,
        type: 'translated',
      });
    }

    const stringCount = input.translations.size;
    const translated = [...input.translations.values()].filter(v => v && v.trim().length > 0).length;
    totalStrings += stringCount;
    translatedStrings += translated;

    manifestFiles.push({
      path: input.filename,
      format: input.format,
      stringCount,
      translatedCount: translated,
    });
  }

  // Manifest
  const manifest: PatchManifest = {
    name: options.projectName,
    version: options.version,
    gameTitle: options.gameTitle,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    translator: options.translator,
    description: options.description || '',
    createdAt: new Date().toISOString(),
    tool: 'GameStringer',
    toolVersion: '2.0.0',
    fileCount: inputs.length,
    stringCount: totalStrings,
    translatedCount: translatedStrings,
    qualityScore: options.qualityScore || 0,
    files: manifestFiles,
  };

  if (options.includeManifest !== false) {
    files.push({
      path: 'translation-manifest.json',
      content: JSON.stringify(manifest, null, 2),
      type: 'manifest',
    });
  }

  // README
  if (options.includeReadme !== false) {
    files.push({
      path: 'README.md',
      content: generateReadme(manifest, options),
      type: 'readme',
    });
  }

  return {
    files,
    manifest,
    stats: {
      totalFiles: inputs.length,
      totalStrings,
      translatedStrings,
      coveragePercent: totalStrings > 0 ? Math.round(translatedStrings / totalStrings * 100) : 0,
    },
  };
}

// ============================================================================
// ZIP GENERATION (browser-compatible con JSZip-like inline)
// ============================================================================

/**
 * Genera un Blob ZIP dai file della patch.
 * Usa una implementazione ZIP minimale inline (nessuna dipendenza esterna).
 */
export async function generateZipBlob(files: PatchFile[]): Promise<Blob> {
  // Implementazione ZIP minimale (Store, no compression — sufficiente per file testo)
  const localFileHeaders: Uint8Array[] = [];
  const centralDirectoryEntries: Uint8Array[] = [];
  let offset = 0;

  const encoder = new TextEncoder();

  for (const file of files) {
    const filenameBytes = encoder.encode(file.path);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const now = new Date();

    // DOS date/time
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    // Local file header (30 + filename + content)
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);  // signature
    localView.setUint16(4, 20, true);           // version needed
    localView.setUint16(6, 0, true);            // flags
    localView.setUint16(8, 0, true);            // compression (store)
    localView.setUint16(10, dosTime, true);     // mod time
    localView.setUint16(12, dosDate, true);     // mod date
    localView.setUint32(14, crc, true);         // crc32
    localView.setUint32(18, contentBytes.length, true);  // compressed size
    localView.setUint32(22, contentBytes.length, true);  // uncompressed size
    localView.setUint16(26, filenameBytes.length, true); // filename length
    localView.setUint16(28, 0, true);           // extra field length
    localHeader.set(filenameBytes, 30);

    localFileHeaders.push(localHeader);
    localFileHeaders.push(contentBytes);

    // Central directory entry
    const centralEntry = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralEntry.buffer);

    centralView.setUint32(0, 0x02014b50, true);  // signature
    centralView.setUint16(4, 20, true);           // version made by
    centralView.setUint16(6, 20, true);           // version needed
    centralView.setUint16(8, 0, true);            // flags
    centralView.setUint16(10, 0, true);           // compression
    centralView.setUint16(12, dosTime, true);     // mod time
    centralView.setUint16(14, dosDate, true);     // mod date
    centralView.setUint32(16, crc, true);         // crc32
    centralView.setUint32(20, contentBytes.length, true);  // compressed
    centralView.setUint32(24, contentBytes.length, true);  // uncompressed
    centralView.setUint16(28, filenameBytes.length, true); // filename length
    centralView.setUint16(30, 0, true);           // extra field length
    centralView.setUint16(32, 0, true);           // comment length
    centralView.setUint16(34, 0, true);           // disk start
    centralView.setUint16(36, 0, true);           // internal attrs
    centralView.setUint32(38, 0, true);           // external attrs
    centralView.setUint32(42, offset, true);      // local header offset
    centralEntry.set(filenameBytes, 46);

    centralDirectoryEntries.push(centralEntry);

    offset += localHeader.length + contentBytes.length;
  }

  // End of central directory
  const centralDirSize = centralDirectoryEntries.reduce((s, e) => s + e.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);                          // signature
  endView.setUint16(4, 0, true);                                    // disk number
  endView.setUint16(6, 0, true);                                    // disk with central dir
  endView.setUint16(8, files.length, true);                          // entries on disk
  endView.setUint16(10, files.length, true);                         // total entries
  endView.setUint32(12, centralDirSize, true);                       // central dir size
  endView.setUint32(16, offset, true);                               // central dir offset
  endView.setUint16(20, 0, true);                                   // comment length

  const parts: BlobPart[] = [
    ...localFileHeaders.map(b => b.buffer as ArrayBuffer),
    ...centralDirectoryEntries.map(b => b.buffer as ArrayBuffer),
    endRecord.buffer as ArrayBuffer,
  ];
  return new Blob(parts, { type: 'application/zip' });
}

// CRC32 lookup table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================================
// DOWNLOAD HELPER
// ============================================================================

/**
 * Scarica un Blob come file nel browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
