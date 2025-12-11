/**
 * 📁 File Format Parsers
 * 
 * Parser per i formati di localizzazione più comuni nei videogiochi.
 * Supporta: PO/POT, XLIFF, RESX, Strings, JSON, INI, CSV, XML
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedString {
  key: string;
  value: string;
  context?: string;
  comment?: string;
  maxLength?: number;
  metadata?: Record<string, any>;
}

export interface ParseResult {
  format: FileFormat;
  strings: ParsedString[];
  metadata: {
    language?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    projectName?: string;
    generator?: string;
    pluralForms?: string;
  };
  raw?: string;
}

export interface WriteOptions {
  preserveComments?: boolean;
  preserveMetadata?: boolean;
  encoding?: string;
}

export type FileFormat = 
  | 'po'        // GNU gettext
  | 'pot'       // GNU gettext template
  | 'xliff'     // XLIFF 1.2/2.0
  | 'resx'      // .NET Resources
  | 'strings'   // Apple Strings
  | 'json'      // JSON (various formats)
  | 'ini'       // INI files
  | 'csv'       // CSV
  | 'xml'       // Generic XML
  | 'properties' // Java Properties
  | 'yaml'      // YAML
  | 'unknown';

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Rileva il formato del file dal contenuto o estensione
 */
export function detectFormat(content: string, filename?: string): FileFormat {
  const ext = filename?.split('.').pop()?.toLowerCase();
  
  // By extension
  if (ext) {
    switch (ext) {
      case 'po': return 'po';
      case 'pot': return 'pot';
      case 'xlf':
      case 'xliff': return 'xliff';
      case 'resx': return 'resx';
      case 'strings': return 'strings';
      case 'json': return 'json';
      case 'ini': return 'ini';
      case 'csv': return 'csv';
      case 'xml': return 'xml';
      case 'properties': return 'properties';
      case 'yaml':
      case 'yml': return 'yaml';
    }
  }
  
  // By content
  const trimmed = content.trim();
  
  if (trimmed.startsWith('msgid') || trimmed.includes('\nmsgid ')) {
    return 'po';
  }
  if (trimmed.includes('<xliff') || trimmed.includes('<trans-unit')) {
    return 'xliff';
  }
  if (trimmed.includes('<root>') && trimmed.includes('<data name=')) {
    return 'resx';
  }
  if (trimmed.startsWith('"') && trimmed.includes('" = "')) {
    return 'strings';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml';
  }
  if (trimmed.includes('=') && !trimmed.includes('<')) {
    if (trimmed.includes('[') && /^\[.+\]/m.test(trimmed)) {
      return 'ini';
    }
    return 'properties';
  }
  
  return 'unknown';
}

// ============================================================================
// PO/POT PARSER (GNU gettext)
// ============================================================================

/**
 * Parse file PO/POT (GNU gettext)
 */
export function parsePO(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  // Split into entries
  const entries = content.split(/\n\n+/);
  
  for (const entry of entries) {
    const lines = entry.split('\n');
    let msgid = '';
    let msgstr = '';
    let msgctxt = '';
    let comments: string[] = [];
    let isHeader = false;
    
    for (const line of lines) {
      if (line.startsWith('#')) {
        comments.push(line.substring(1).trim());
      } else if (line.startsWith('msgctxt ')) {
        msgctxt = extractQuoted(line.substring(8));
      } else if (line.startsWith('msgid ')) {
        msgid = extractQuoted(line.substring(6));
        if (msgid === '') isHeader = true;
      } else if (line.startsWith('msgstr ')) {
        msgstr = extractQuoted(line.substring(7));
      } else if (line.startsWith('"')) {
        // Continuation line
        const quoted = extractQuoted(line);
        if (msgstr) {
          msgstr += quoted;
        } else {
          msgid += quoted;
        }
      }
    }
    
    // Parse header
    if (isHeader && msgstr) {
      const headerLines = msgstr.split('\\n');
      for (const hl of headerLines) {
        const [key, ...valueParts] = hl.split(':');
        const value = valueParts.join(':').trim();
        if (key === 'Language') metadata.language = value;
        if (key === 'Plural-Forms') metadata.pluralForms = value;
        if (key === 'Project-Id-Version') metadata.projectName = value;
        if (key === 'X-Generator') metadata.generator = value;
      }
      continue;
    }
    
    if (msgid) {
      strings.push({
        key: msgctxt ? `${msgctxt}|${msgid}` : msgid,
        value: msgstr || msgid,
        context: msgctxt || undefined,
        comment: comments.length > 0 ? comments.join('\n') : undefined
      });
    }
  }
  
  return { format: 'po', strings, metadata };
}

/**
 * Scrive file PO
 */
export function writePO(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  const lines: string[] = [];
  
  // Header
  lines.push('msgid ""');
  lines.push('msgstr ""');
  lines.push(`"Content-Type: text/plain; charset=UTF-8\\n"`);
  lines.push(`"Language: ${result.metadata.targetLanguage || 'it'}\\n"`);
  if (result.metadata.pluralForms) {
    lines.push(`"Plural-Forms: ${result.metadata.pluralForms}\\n"`);
  }
  lines.push('');
  
  // Entries
  for (const str of result.strings) {
    if (options.preserveComments && str.comment) {
      for (const c of str.comment.split('\n')) {
        lines.push(`# ${c}`);
      }
    }
    
    if (str.context) {
      lines.push(`msgctxt "${escapePoString(str.context)}"`);
    }
    
    const originalKey = str.context ? str.key.split('|')[1] : str.key;
    lines.push(`msgid "${escapePoString(originalKey)}"`);
    
    const translation = translations.get(str.key) || str.value;
    lines.push(`msgstr "${escapePoString(translation)}"`);
    lines.push('');
  }
  
  return lines.join('\n');
}

// ============================================================================
// XLIFF PARSER
// ============================================================================

/**
 * Parse file XLIFF
 */
export function parseXLIFF(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  // Extract metadata
  const srcLangMatch = content.match(/source-language="([^"]+)"/);
  const tgtLangMatch = content.match(/target-language="([^"]+)"/);
  if (srcLangMatch) metadata.sourceLanguage = srcLangMatch[1];
  if (tgtLangMatch) metadata.targetLanguage = tgtLangMatch[1];
  
  // Parse trans-units (XLIFF 1.2)
  const unitRegex = /<trans-unit[^>]*id="([^"]*)"[^>]*>[\s\S]*?<source>([^<]*)<\/source>[\s\S]*?(?:<target>([^<]*)<\/target>)?[\s\S]*?<\/trans-unit>/g;
  let match;
  
  while ((match = unitRegex.exec(content)) !== null) {
    const [, id, source, target] = match;
    strings.push({
      key: id,
      value: target || source,
      metadata: { source: decodeXML(source) }
    });
  }
  
  // Parse XLIFF 2.0 format
  if (strings.length === 0) {
    const unit2Regex = /<unit[^>]*id="([^"]*)"[^>]*>[\s\S]*?<segment>[\s\S]*?<source>([^<]*)<\/source>[\s\S]*?(?:<target>([^<]*)<\/target>)?[\s\S]*?<\/segment>[\s\S]*?<\/unit>/g;
    
    while ((match = unit2Regex.exec(content)) !== null) {
      const [, id, source, target] = match;
      strings.push({
        key: id,
        value: target || source,
        metadata: { source: decodeXML(source) }
      });
    }
  }
  
  return { format: 'xliff', strings, metadata };
}

/**
 * Scrive file XLIFF
 */
export function writeXLIFF(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  const srcLang = result.metadata.sourceLanguage || 'en';
  const tgtLang = result.metadata.targetLanguage || 'it';
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${srcLang}" target-language="${tgtLang}" datatype="plaintext" original="GameStringer">
    <body>
`;
  
  for (const str of result.strings) {
    const source = str.metadata?.source || str.value;
    const target = translations.get(str.key) || str.value;
    
    xml += `      <trans-unit id="${encodeXML(str.key)}">
        <source>${encodeXML(source)}</source>
        <target>${encodeXML(target)}</target>
      </trans-unit>
`;
  }
  
  xml += `    </body>
  </file>
</xliff>`;
  
  return xml;
}

// ============================================================================
// RESX PARSER (.NET Resources)
// ============================================================================

/**
 * Parse file RESX
 */
export function parseRESX(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  // Parse data elements
  const dataRegex = /<data\s+name="([^"]+)"[^>]*>[\s\S]*?<value>([^<]*)<\/value>[\s\S]*?(?:<comment>([^<]*)<\/comment>)?[\s\S]*?<\/data>/g;
  let match;
  
  while ((match = dataRegex.exec(content)) !== null) {
    const [, name, value, comment] = match;
    strings.push({
      key: name,
      value: decodeXML(value),
      comment: comment ? decodeXML(comment) : undefined
    });
  }
  
  return { format: 'resx', strings, metadata };
}

/**
 * Scrive file RESX
 */
export function writeRESX(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <xsd:schema id="root" xmlns="" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xsd:element name="root" msdata:IsDataSet="true">
    </xsd:element>
  </xsd:schema>
  <resheader name="resmimetype">
    <value>text/microsoft-resx</value>
  </resheader>
  <resheader name="version">
    <value>2.0</value>
  </resheader>
`;
  
  for (const str of result.strings) {
    const translation = translations.get(str.key) || str.value;
    xml += `  <data name="${encodeXML(str.key)}" xml:space="preserve">
    <value>${encodeXML(translation)}</value>`;
    
    if (options.preserveComments && str.comment) {
      xml += `
    <comment>${encodeXML(str.comment)}</comment>`;
    }
    xml += `
  </data>
`;
  }
  
  xml += '</root>';
  return xml;
}

// ============================================================================
// STRINGS PARSER (Apple)
// ============================================================================

/**
 * Parse file .strings (Apple)
 */
export function parseStrings(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  // Pattern: "key" = "value";
  const stringRegex = /(?:\/\*\s*([^*]*)\s*\*\/\s*)?"([^"\\]*(?:\\.[^"\\]*)*)"\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*;/g;
  let match;
  
  while ((match = stringRegex.exec(content)) !== null) {
    const [, comment, key, value] = match;
    strings.push({
      key: unescapeStrings(key),
      value: unescapeStrings(value),
      comment: comment?.trim()
    });
  }
  
  return { format: 'strings', strings, metadata };
}

/**
 * Scrive file .strings
 */
export function writeStrings(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  const lines: string[] = [];
  
  for (const str of result.strings) {
    if (options.preserveComments && str.comment) {
      lines.push(`/* ${str.comment} */`);
    }
    
    const translation = translations.get(str.key) || str.value;
    lines.push(`"${escapeStrings(str.key)}" = "${escapeStrings(translation)}";`);
    lines.push('');
  }
  
  return lines.join('\n');
}

// ============================================================================
// JSON PARSER
// ============================================================================

/**
 * Parse file JSON (supporta vari formati)
 */
export function parseJSON(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  // Quick validation: check if content looks like JSON
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // Not JSON, return empty result
    return { format: 'json', strings, metadata };
  }
  
  try {
    // Basic JSONC support: remove comments
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/^\s*\/\/.*$/gm, '');    // Remove line comments
      
    const data = JSON.parse(cleanContent);
    
    // Detect format and parse
    if (Array.isArray(data)) {
      // Array format: [{ key, value }, ...]
      for (const item of data) {
        if (item.key && (item.value || item.text || item.translation)) {
          strings.push({
            key: item.key || item.id,
            value: item.value || item.text || item.translation,
            context: item.context,
            comment: item.comment || item.note
          });
        }
      }
    } else if (typeof data === 'object') {
      // Object format: { key: value } or nested
      flattenJSON(data, '', strings);
    }
  } catch (e) {
    // Invalid JSON, return empty result instead of throwing
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.warn(`JSON parse error: ${errorMessage}. Content snippet: ${content.substring(0, 50)}...`);
  }
  
  return { format: 'json', strings, metadata };
}

/**
 * Appiattisce JSON annidato
 */
function flattenJSON(obj: any, prefix: string, strings: ParsedString[]): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      strings.push({ key: fullKey, value });
    } else if (typeof value === 'object' && value !== null) {
      flattenJSON(value, fullKey, strings);
    }
  }
}

/**
 * Scrive file JSON
 */
export function writeJSON(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions & { nested?: boolean } = {}
): string {
  if (options.nested) {
    // Reconstruct nested structure
    const obj: any = {};
    
    for (const str of result.strings) {
      const translation = translations.get(str.key) || str.value;
      const parts = str.key.split('.');
      let current = obj;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = translation;
    }
    
    return JSON.stringify(obj, null, 2);
  } else {
    // Flat structure
    const obj: Record<string, string> = {};
    
    for (const str of result.strings) {
      obj[str.key] = translations.get(str.key) || str.value;
    }
    
    return JSON.stringify(obj, null, 2);
  }
}

// ============================================================================
// INI PARSER
// ============================================================================

/**
 * Parse file INI
 */
export function parseINI(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  let currentSection = '';
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }
    
    // Section header
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }
    
    // Key=Value
    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      const fullKey = currentSection ? `${currentSection}.${key.trim()}` : key.trim();
      strings.push({
        key: fullKey,
        value: value.trim(),
        context: currentSection || undefined
      });
    }
  }
  
  return { format: 'ini', strings, metadata };
}

/**
 * Scrive file INI
 */
export function writeINI(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  const sections: Map<string, Array<{ key: string; value: string }>> = new Map();
  
  for (const str of result.strings) {
    const translation = translations.get(str.key) || str.value;
    const parts = str.key.split('.');
    
    if (parts.length > 1) {
      const section = parts.slice(0, -1).join('.');
      const key = parts[parts.length - 1];
      
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section)!.push({ key, value: translation });
    } else {
      if (!sections.has('')) sections.set('', []);
      sections.get('')!.push({ key: str.key, value: translation });
    }
  }
  
  const lines: string[] = [];
  
  // Global keys first
  const globalKeys = sections.get('');
  if (globalKeys) {
    for (const { key, value } of globalKeys) {
      lines.push(`${key}=${value}`);
    }
    lines.push('');
  }
  
  // Sections
  for (const [section, entries] of sections) {
    if (section === '') continue;
    
    lines.push(`[${section}]`);
    for (const { key, value } of entries) {
      lines.push(`${key}=${value}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ============================================================================
// PROPERTIES PARSER (Java)
// ============================================================================

/**
 * Parse file .properties (Java)
 */
export function parseProperties(content: string): ParseResult {
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  const lines = content.split('\n');
  let currentComment = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Comment
    if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
      currentComment = trimmed.substring(1).trim();
      continue;
    }
    
    // Skip empty
    if (!trimmed) {
      currentComment = '';
      continue;
    }
    
    // Key=Value or Key:Value
    const match = trimmed.match(/^([^=:]+)[=:](.*)$/);
    if (match) {
      const [, key, value] = match;
      strings.push({
        key: key.trim(),
        value: unescapeProperties(value.trim()),
        comment: currentComment || undefined
      });
      currentComment = '';
    }
  }
  
  return { format: 'properties', strings, metadata };
}

/**
 * Scrive file .properties
 */
export function writeProperties(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  const lines: string[] = [];
  
  for (const str of result.strings) {
    if (options.preserveComments && str.comment) {
      lines.push(`# ${str.comment}`);
    }
    
    const translation = translations.get(str.key) || str.value;
    lines.push(`${str.key}=${escapeProperties(translation)}`);
  }
  
  return lines.join('\n');
}

// ============================================================================
// CSV PARSER
// ============================================================================

/**
 * Parse file CSV
 */
export function parseCSV(content: string, options: { delimiter?: string; hasHeader?: boolean } = {}): ParseResult {
  const { delimiter = ',', hasHeader = true } = options;
  const strings: ParsedString[] = [];
  const metadata: ParseResult['metadata'] = {};
  
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { format: 'csv', strings, metadata };
  
  let startIndex = 0;
  let keyIndex = 0;
  let valueIndex = 1;
  
  if (hasHeader) {
    const headers = parseCSVLine(lines[0], delimiter);
    keyIndex = headers.findIndex(h => /^(key|id|name)$/i.test(h));
    valueIndex = headers.findIndex(h => /^(value|text|string|translation)$/i.test(h));
    
    if (keyIndex === -1) keyIndex = 0;
    if (valueIndex === -1) valueIndex = 1;
    startIndex = 1;
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length > Math.max(keyIndex, valueIndex)) {
      strings.push({
        key: cols[keyIndex],
        value: cols[valueIndex]
      });
    }
  }
  
  return { format: 'csv', strings, metadata };
}

/**
 * Parse una riga CSV
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Scrive file CSV
 */
export function writeCSV(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions & { delimiter?: string } = {}
): string {
  const { delimiter = ',' } = options;
  const lines: string[] = [];
  
  // Header
  lines.push(`key${delimiter}value`);
  
  // Data
  for (const str of result.strings) {
    const translation = translations.get(str.key) || str.value;
    lines.push(`${escapeCSVField(str.key, delimiter)}${delimiter}${escapeCSVField(translation, delimiter)}`);
  }
  
  return lines.join('\n');
}

function escapeCSVField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractQuoted(str: string): string {
  const match = str.match(/^"(.*)"$/);
  return match ? unescapePoString(match[1]) : str;
}

function escapePoString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function unescapePoString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function encodeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXML(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeStrings(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function unescapeStrings(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function escapeProperties(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/=/g, '\\=')
    .replace(/:/g, '\\:');
}

function unescapeProperties(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\=/g, '=')
    .replace(/\\:/g, ':')
    .replace(/\\\\/g, '\\');
}

// ============================================================================
// UNIFIED PARSE/WRITE FUNCTIONS
// ============================================================================

/**
 * Parse automatico basato sul formato
 */
export function parseFile(content: string, filename?: string): ParseResult {
  const format = detectFormat(content, filename);
  
  switch (format) {
    case 'po':
    case 'pot':
      return parsePO(content);
    case 'xliff':
      return parseXLIFF(content);
    case 'resx':
      return parseRESX(content);
    case 'strings':
      return parseStrings(content);
    case 'json':
      try {
        return parseJSON(content);
      } catch {
        return { format: 'json', strings: [], metadata: {} };
      }
    case 'ini':
      return parseINI(content);
    case 'properties':
      return parseProperties(content);
    case 'csv':
      return parseCSV(content);
    default:
      // Try JSON first, then INI
      try {
        return parseJSON(content);
      } catch {
        return parseINI(content);
      }
  }
}

/**
 * Write automatico basato sul formato
 */
export function writeFile(
  result: ParseResult,
  translations: Map<string, string>,
  options: WriteOptions = {}
): string {
  switch (result.format) {
    case 'po':
    case 'pot':
      return writePO(result, translations, options);
    case 'xliff':
      return writeXLIFF(result, translations, options);
    case 'resx':
      return writeRESX(result, translations, options);
    case 'strings':
      return writeStrings(result, translations, options);
    case 'json':
      return writeJSON(result, translations, options);
    case 'ini':
      return writeINI(result, translations, options);
    case 'properties':
      return writeProperties(result, translations, options);
    case 'csv':
      return writeCSV(result, translations, options);
    default:
      return writeJSON(result, translations, options);
  }
}

/**
 * Ottieni estensione file per formato
 */
export function getExtensionForFormat(format: FileFormat): string {
  const extensions: Record<FileFormat, string> = {
    po: '.po',
    pot: '.pot',
    xliff: '.xliff',
    resx: '.resx',
    strings: '.strings',
    json: '.json',
    ini: '.ini',
    csv: '.csv',
    xml: '.xml',
    properties: '.properties',
    yaml: '.yaml',
    unknown: '.txt'
  };
  return extensions[format] || '.txt';
}

/**
 * Formati supportati
 */
export const SUPPORTED_FORMATS: FileFormat[] = [
  'po', 'pot', 'xliff', 'resx', 'strings', 'json', 'ini', 'csv', 'properties'
];

/**
 * Descrizioni formati
 */
export const FORMAT_DESCRIPTIONS: Record<FileFormat, string> = {
  po: 'GNU gettext PO',
  pot: 'GNU gettext Template',
  xliff: 'XLIFF (XML Localization)',
  resx: '.NET Resources',
  strings: 'Apple Strings',
  json: 'JSON',
  ini: 'INI Configuration',
  csv: 'CSV (Comma Separated)',
  xml: 'Generic XML',
  properties: 'Java Properties',
  yaml: 'YAML',
  unknown: 'Unknown Format'
};
