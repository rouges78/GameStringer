import { safeSetItem, safeGetItem } from './safe-storage';

const PLUGINS_KEY = 'installed_plugins';

/**
 * Tipi di plugin supportati
 */
export type PluginType = 'format' | 'translator' | 'exporter' | 'importer';

/**
 * Definizione di un plugin
 */
export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description: string;
  author: string;
  enabled: boolean;
  config?: Record<string, any>;
}

/**
 * Plugin per parser di formati file
 */
export interface FormatPlugin extends PluginDefinition {
  type: 'format';
  extensions: string[];
  parse: (content: string) => ParsedContent;
  serialize: (content: ParsedContent) => string;
  validate?: (content: string) => ValidationResult;
}

/**
 * Contenuto parsato generico
 */
export interface ParsedContent {
  entries: TranslationEntry[];
  metadata?: Record<string, any>;
}

/**
 * Singola entry di traduzione
 */
export interface TranslationEntry {
  key: string;
  source: string;
  target?: string;
  context?: string;
  line?: number;
  metadata?: Record<string, any>;
}

/**
 * Risultato validazione
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Registry dei plugin
 */
class PluginRegistry {
  private plugins: Map<string, PluginDefinition> = new Map();
  private formatParsers: Map<string, FormatPlugin> = new Map();
  
  constructor() {
    this.loadInstalledPlugins();
    this.registerBuiltinPlugins();
  }
  
  /**
   * Carica plugin installati da storage
   */
  private loadInstalledPlugins(): void {
    const saved = safeGetItem<PluginDefinition[]>(PLUGINS_KEY);
    if (saved) {
      saved.forEach(plugin => {
        this.plugins.set(plugin.id, plugin);
      });
    }
  }
  
  /**
   * Salva plugin installati
   */
  private savePlugins(): void {
    const plugins = Array.from(this.plugins.values());
    safeSetItem(PLUGINS_KEY, plugins);
  }
  
  /**
   * Registra plugin builtin
   */
  private registerBuiltinPlugins(): void {
    // JSON Plugin
    this.registerFormatPlugin({
      id: 'builtin-json',
      name: 'JSON Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file JSON standard',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.json'],
      parse: parseJSON,
      serialize: serializeJSON,
      validate: validateJSON,
    });
    
    // PO/POT Plugin (gettext)
    this.registerFormatPlugin({
      id: 'builtin-po',
      name: 'PO/POT Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file gettext PO/POT',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.po', '.pot'],
      parse: parsePO,
      serialize: serializePO,
    });
    
    // RESX Plugin (.NET)
    this.registerFormatPlugin({
      id: 'builtin-resx',
      name: 'RESX Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file .NET RESX',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.resx', '.resw'],
      parse: parseRESX,
      serialize: serializeRESX,
    });
    
    // CSV Plugin
    this.registerFormatPlugin({
      id: 'builtin-csv',
      name: 'CSV Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file CSV',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.csv', '.tsv'],
      parse: parseCSV,
      serialize: serializeCSV,
    });
    
    // XLIFF Plugin
    this.registerFormatPlugin({
      id: 'builtin-xliff',
      name: 'XLIFF Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file XLIFF 1.2/2.0',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.xlf', '.xliff'],
      parse: parseXLIFF,
      serialize: serializeXLIFF,
    });
    
    // Unity YAML Plugin
    this.registerFormatPlugin({
      id: 'builtin-unity-yaml',
      name: 'Unity YAML Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file Unity YAML localization',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.asset', '.unity'],
      parse: parseUnityYAML,
      serialize: serializeUnityYAML,
    });
    
    // Unreal Locres Plugin
    this.registerFormatPlugin({
      id: 'builtin-unreal-locres',
      name: 'Unreal Locres Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file Unreal Engine .locres',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.locres'],
      parse: parseLocres,
      serialize: serializeLocres,
    });
    
    // RPG Maker Plugin
    this.registerFormatPlugin({
      id: 'builtin-rpgmaker',
      name: 'RPG Maker Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file RPG Maker MV/MZ JSON',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.json'],
      parse: parseRPGMaker,
      serialize: serializeRPGMaker,
    });
    
    // Telltale Plugin
    this.registerFormatPlugin({
      id: 'builtin-telltale',
      name: 'Telltale Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file Telltale Games (.langdb, .landb)',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.langdb', '.landb', '.dlog'],
      parse: parseTelltale,
      serialize: serializeTelltale,
    });
    
    // Godot Plugin
    this.registerFormatPlugin({
      id: 'builtin-godot',
      name: 'Godot Parser',
      version: '1.0.0',
      type: 'format',
      description: 'Parser per file Godot Engine (.tres, .tscn, .cfg, .translation)',
      author: 'GameStringer',
      enabled: true,
      extensions: ['.tres', '.tscn', '.cfg', '.translation'],
      parse: parseGodot,
      serialize: serializeGodot,
    });
    
    // Ren'Py Plugin
    this.registerFormatPlugin({
      id: 'builtin-renpy',
      name: "Ren'Py Parser",
      version: '1.0.0',
      type: 'format',
      description: "Parser per file Ren'Py (.rpy, .rpyc)",
      author: 'GameStringer',
      enabled: true,
      extensions: ['.rpy'],
      parse: parseRenpy,
      serialize: serializeRenpy,
    });
  }
  
  /**
   * Registra un plugin formato
   */
  registerFormatPlugin(plugin: FormatPlugin): void {
    this.plugins.set(plugin.id, plugin);
    
    // Registra per ogni estensione
    plugin.extensions.forEach(ext => {
      this.formatParsers.set(ext.toLowerCase(), plugin);
    });
    
    this.savePlugins();
  }
  
  /**
   * Ottiene un plugin per estensione file
   */
  getParserForExtension(extension: string): FormatPlugin | null {
    const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    return this.formatParsers.get(ext) || null;
  }
  
  /**
   * Lista tutti i plugin
   */
  listPlugins(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Lista plugin per tipo
   */
  listPluginsByType(type: PluginType): PluginDefinition[] {
    return this.listPlugins().filter(p => p.type === type);
  }
  
  /**
   * Abilita/disabilita un plugin
   */
  togglePlugin(pluginId: string, enabled: boolean): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = enabled;
      this.savePlugins();
    }
  }
  
  /**
   * Rimuove un plugin (solo non-builtin)
   */
  removePlugin(pluginId: string): boolean {
    if (pluginId.startsWith('builtin-')) {
      return false;
    }
    
    const plugin = this.plugins.get(pluginId);
    if (plugin && plugin.type === 'format') {
      const formatPlugin = plugin as FormatPlugin;
      formatPlugin.extensions.forEach(ext => {
        this.formatParsers.delete(ext.toLowerCase());
      });
    }
    
    this.plugins.delete(pluginId);
    this.savePlugins();
    return true;
  }
  
  /**
   * Ottiene estensioni supportate
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.formatParsers.keys());
  }
}

// Singleton
export const pluginRegistry = new PluginRegistry();

// ============================================
// PARSER IMPLEMENTATIONS
// ============================================

function parseJSON(content: string): ParsedContent {
  const data = JSON.parse(content);
  const entries: TranslationEntry[] = [];
  
  function extractStrings(obj: any, prefix: string = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        entries.push({ key: fullKey, source: value });
      } else if (typeof value === 'object' && value !== null) {
        extractStrings(value, fullKey);
      }
    }
  }
  
  extractStrings(data);
  return { entries, metadata: { format: 'json' } };
}

function serializeJSON(content: ParsedContent): string {
  const result: Record<string, any> = {};
  
  for (const entry of content.entries) {
    const keys = entry.key.split('.');
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = entry.target || entry.source;
  }
  
  return JSON.stringify(result, null, 2);
}

function validateJSON(content: string): ValidationResult {
  try {
    JSON.parse(content);
    return { valid: true, errors: [], warnings: [] };
  } catch (e: any) {
    return { valid: false, errors: [e.message], warnings: [] };
  }
}

function parsePO(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  const lines = content.split('\n');
  
  let currentEntry: Partial<TranslationEntry> = {};
  let currentField = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#. ')) {
      currentEntry.context = line.slice(3);
    } else if (line.startsWith('msgid "')) {
      currentEntry.source = line.slice(7, -1);
      currentField = 'source';
    } else if (line.startsWith('msgstr "')) {
      currentEntry.target = line.slice(8, -1);
      currentField = 'target';
    } else if (line.startsWith('"') && line.endsWith('"')) {
      const value = line.slice(1, -1);
      if (currentField === 'source') {
        currentEntry.source = (currentEntry.source || '') + value;
      } else if (currentField === 'target') {
        currentEntry.target = (currentEntry.target || '') + value;
      }
    } else if (line === '' && currentEntry.source) {
      currentEntry.key = `msgid_${entries.length}`;
      currentEntry.line = i;
      entries.push(currentEntry as TranslationEntry);
      currentEntry = {};
      currentField = '';
    }
  }
  
  // Last entry
  if (currentEntry.source) {
    currentEntry.key = `msgid_${entries.length}`;
    entries.push(currentEntry as TranslationEntry);
  }
  
  return { entries, metadata: { format: 'po' } };
}

function serializePO(content: ParsedContent): string {
  let result = '# Generated by GameStringer\n\n';
  
  for (const entry of content.entries) {
    if (entry.context) {
      result += `#. ${entry.context}\n`;
    }
    result += `msgid "${entry.source}"\n`;
    result += `msgstr "${entry.target || ''}"\n\n`;
  }
  
  return result;
}

function parseRESX(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  const dataRegex = /<data name="([^"]+)"[^>]*>\s*<value>([^<]*)<\/value>/g;
  
  let match;
  while ((match = dataRegex.exec(content)) !== null) {
    entries.push({
      key: match[1],
      source: match[2],
    });
  }
  
  return { entries, metadata: { format: 'resx' } };
}

function serializeRESX(content: ParsedContent): string {
  let result = '<?xml version="1.0" encoding="utf-8"?>\n<root>\n';
  
  for (const entry of content.entries) {
    result += `  <data name="${entry.key}" xml:space="preserve">\n`;
    result += `    <value>${entry.target || entry.source}</value>\n`;
    result += `  </data>\n`;
  }
  
  result += '</root>';
  return result;
}

function parseCSV(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  const lines = content.split('\n');
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (doesn't handle quoted fields with commas)
    const parts = line.split(/[,\t]/);
    if (parts.length >= 2) {
      entries.push({
        key: parts[0].replace(/^["']|["']$/g, ''),
        source: parts[1].replace(/^["']|["']$/g, ''),
        target: parts[2]?.replace(/^["']|["']$/g, ''),
        line: i,
      });
    }
  }
  
  return { entries, metadata: { format: 'csv' } };
}

function serializeCSV(content: ParsedContent): string {
  let result = 'key,source,target\n';
  
  for (const entry of content.entries) {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    result += `${escape(entry.key)},${escape(entry.source)},${escape(entry.target || '')}\n`;
  }
  
  return result;
}

function parseXLIFF(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  const unitRegex = /<trans-unit id="([^"]+)"[^>]*>\s*<source>([^<]*)<\/source>\s*(?:<target>([^<]*)<\/target>)?/g;
  
  let match;
  while ((match = unitRegex.exec(content)) !== null) {
    entries.push({
      key: match[1],
      source: match[2],
      target: match[3],
    });
  }
  
  return { entries, metadata: { format: 'xliff' } };
}

function serializeXLIFF(content: ParsedContent): string {
  let result = '<?xml version="1.0" encoding="UTF-8"?>\n';
  result += '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n';
  result += '  <file source-language="en" target-language="it">\n';
  result += '    <body>\n';
  
  for (const entry of content.entries) {
    result += `      <trans-unit id="${entry.key}">\n`;
    result += `        <source>${entry.source}</source>\n`;
    result += `        <target>${entry.target || ''}</target>\n`;
    result += `      </trans-unit>\n`;
  }
  
  result += '    </body>\n  </file>\n</xliff>';
  return result;
}

function parseUnityYAML(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  // Simplified Unity YAML parsing
  const stringRegex = /m_Text:\s*["']?([^"'\n]+)["']?/g;
  
  let match;
  let index = 0;
  while ((match = stringRegex.exec(content)) !== null) {
    entries.push({
      key: `unity_text_${index++}`,
      source: match[1],
    });
  }
  
  return { entries, metadata: { format: 'unity-yaml' } };
}

function serializeUnityYAML(content: ParsedContent): string {
  // Unity YAML serialization would need the original structure
  // This is a simplified placeholder
  return content.entries.map(e => `m_Text: "${e.target || e.source}"`).join('\n');
}

function parseLocres(content: string): ParsedContent {
  // Locres is binary, this would need proper binary parsing
  // Placeholder for text extraction
  const entries: TranslationEntry[] = [];
  return { entries, metadata: { format: 'locres', note: 'Binary format - use UnrealLocres tool' } };
}

function serializeLocres(content: ParsedContent): string {
  return '';
}

function parseRPGMaker(content: string): ParsedContent {
  const data = JSON.parse(content);
  const entries: TranslationEntry[] = [];
  
  // RPG Maker specific structures
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (item && item.name) {
        entries.push({ key: `${index}.name`, source: item.name });
      }
      if (item && item.description) {
        entries.push({ key: `${index}.description`, source: item.description });
      }
      if (item && item.message1) {
        entries.push({ key: `${index}.message1`, source: item.message1 });
      }
      if (item && item.message2) {
        entries.push({ key: `${index}.message2`, source: item.message2 });
      }
    });
  }
  
  return { entries, metadata: { format: 'rpgmaker' } };
}

function serializeRPGMaker(content: ParsedContent): string {
  // Would need original structure to properly serialize
  return JSON.stringify(content.entries, null, 2);
}

// Telltale Games Parser (.langdb, .landb, .dlog)
function parseTelltale(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  
  // Telltale langdb files can be:
  // 1. Binary format (need hex parsing)
  // 2. Text-based prop files
  // 3. JSON-like structures
  
  // Try JSON first
  try {
    const data = JSON.parse(content);
    if (typeof data === 'object') {
      const extractStrings = (obj: any, prefix = ''): void => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' && value.length > 0) {
            entries.push({ key: prefix ? `${prefix}.${key}` : key, source: value });
          } else if (typeof value === 'object' && value !== null) {
            extractStrings(value, prefix ? `${prefix}.${key}` : key);
          }
        }
      };
      extractStrings(data);
    }
  } catch {
    // Not JSON, try text patterns
    
    // Pattern 1: Key=Value pairs
    const keyValueRegex = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"$/gm;
    let match;
    while ((match = keyValueRegex.exec(content)) !== null) {
      entries.push({ key: match[1], source: match[2] });
    }
    
    // Pattern 2: Telltale prop format
    const propRegex = /String\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
    while ((match = propRegex.exec(content)) !== null) {
      entries.push({ key: match[1], source: match[2] });
    }
    
    // Pattern 3: Dialog lines (dlog)
    const dialogRegex = /^([A-Z_]+):\s*(.+)$/gm;
    while ((match = dialogRegex.exec(content)) !== null) {
      entries.push({ key: match[1], source: match[2] });
    }
  }
  
  return { 
    entries, 
    metadata: { 
      format: 'telltale',
      engine: 'Telltale Tool',
      note: 'Giochi Telltale (Walking Dead, Wolf Among Us, Batman, etc.)'
    } 
  };
}

function serializeTelltale(content: ParsedContent): string {
  // Output as key=value format
  return content.entries
    .map(e => `${e.key}="${e.target || e.source}"`)
    .join('\n');
}

// ============================================
// GODOT ENGINE PARSER (.tres, .tscn, .cfg, .translation)
// ============================================

function parseGodot(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  
  // Pattern 1: Godot .translation file (gettext-like)
  // msgid "Hello"
  // msgstr "Ciao"
  const gettextRegex = /msgid\s+"([^"]+)"\s*\nmsgstr\s+"([^"]*)"/g;
  let match;
  while ((match = gettextRegex.exec(content)) !== null) {
    if (match[1]) {
      entries.push({ key: match[1], source: match[1], target: match[2] || undefined });
    }
  }
  
  // Pattern 2: Godot .cfg / .tres key=value
  // text = "Hello World"
  // dialog_text = "Some text"
  const keyValueRegex = /^(\w+)\s*=\s*"([^"]+)"/gm;
  while ((match = keyValueRegex.exec(content)) !== null) {
    const key = match[1].toLowerCase();
    if (key.includes('text') || key.includes('dialog') || key.includes('message') || key.includes('name') || key.includes('description')) {
      entries.push({ key: match[1], source: match[2] });
    }
  }
  
  // Pattern 3: Godot .tscn inline text
  // [node name="Label" type="Label"]
  // text = "Button Text"
  const tscnTextRegex = /text\s*=\s*"([^"]+)"/g;
  while ((match = tscnTextRegex.exec(content)) !== null) {
    const existing = entries.find(e => e.source === match[1]);
    if (!existing && match[1].length > 1) {
      entries.push({ key: `text_${entries.length}`, source: match[1] });
    }
  }
  
  // Pattern 4: tr() function calls
  // tr("Hello")
  const trRegex = /tr\s*\(\s*"([^"]+)"\s*\)/g;
  while ((match = trRegex.exec(content)) !== null) {
    const existing = entries.find(e => e.source === match[1]);
    if (!existing) {
      entries.push({ key: match[1], source: match[1] });
    }
  }
  
  return {
    entries,
    metadata: {
      format: 'godot',
      engine: 'Godot Engine',
      note: 'Giochi Godot Engine 3.x/4.x'
    }
  };
}

function serializeGodot(content: ParsedContent): string {
  // Output as Godot .translation (gettext-like)
  return content.entries
    .map(e => `msgid "${e.source}"\nmsgstr "${e.target || ''}"`)
    .join('\n\n');
}

// ============================================
// REN'PY PARSER (.rpy)
// ============================================

function parseRenpy(content: string): ParsedContent {
  const entries: TranslationEntry[] = [];
  
  // Pattern 1: Dialog lines
  // e "Hello, how are you?"
  // narrator "This is narration"
  const dialogRegex = /^\s*(\w+)\s+"([^"]+)"/gm;
  let match;
  while ((match = dialogRegex.exec(content)) !== null) {
    const speaker = match[1];
    const text = match[2];
    // Skip keywords
    if (!['if', 'elif', 'else', 'while', 'for', 'return', 'pass', 'jump', 'call', 'scene', 'show', 'hide', 'with', 'play', 'stop', 'queue'].includes(speaker)) {
      entries.push({ 
        key: `${speaker}_${entries.length}`, 
        source: text,
        context: `Speaker: ${speaker}`
      });
    }
  }
  
  // Pattern 2: Menu choices
  // "Choice 1":
  // "Choice 2":
  const menuRegex = /^\s*"([^"]+)":\s*$/gm;
  while ((match = menuRegex.exec(content)) !== null) {
    entries.push({ 
      key: `menu_${entries.length}`, 
      source: match[1],
      context: 'Menu choice'
    });
  }
  
  // Pattern 3: Translate blocks
  // translate italian start_chapter:
  //     e "Translated text"
  const translateBlockRegex = /translate\s+\w+\s+(\w+):/g;
  while ((match = translateBlockRegex.exec(content)) !== null) {
    // Mark that this file has translations
  }
  
  // Pattern 4: String definitions
  // define e = Character("Eileen")
  const characterRegex = /define\s+\w+\s*=\s*Character\s*\(\s*"([^"]+)"/g;
  while ((match = characterRegex.exec(content)) !== null) {
    entries.push({
      key: `character_${entries.length}`,
      source: match[1],
      context: 'Character name'
    });
  }
  
  return {
    entries,
    metadata: {
      format: 'renpy',
      engine: "Ren'Py",
      note: "Visual novel Ren'Py Engine"
    }
  };
}

function serializeRenpy(content: ParsedContent): string {
  // Output as Ren'Py translation strings file
  let output = "# Ren'Py Translation File\n# Generated by GameStringer\n\n";
  
  for (const entry of content.entries) {
    const translated = entry.target || entry.source;
    if (entry.context?.includes('Speaker:')) {
      const speaker = entry.context.replace('Speaker: ', '');
      output += `    ${speaker} "${translated}"\n`;
    } else if (entry.context === 'Menu choice') {
      output += `    "${translated}":\n`;
    } else {
      output += `# ${entry.key}\n    "${translated}"\n`;
    }
  }
  
  return output;
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Parse un file usando il plugin appropriato
 */
export function parseFile(content: string, extension: string): ParsedContent | null {
  const parser = pluginRegistry.getParserForExtension(extension);
  if (!parser || !parser.enabled) return null;
  
  try {
    return parser.parse(content);
  } catch (error) {
    console.error(`Errore parsing ${extension}:`, error);
    return null;
  }
}

/**
 * Serializza contenuto nel formato specificato
 */
export function serializeContent(content: ParsedContent, extension: string): string | null {
  const parser = pluginRegistry.getParserForExtension(extension);
  if (!parser || !parser.enabled) return null;
  
  try {
    return parser.serialize(content);
  } catch (error) {
    console.error(`Errore serializzazione ${extension}:`, error);
    return null;
  }
}

/**
 * Valida un file
 */
export function validateFile(content: string, extension: string): ValidationResult {
  const parser = pluginRegistry.getParserForExtension(extension);
  if (!parser || !parser.enabled) {
    return { valid: false, errors: ['Formato non supportato'], warnings: [] };
  }
  
  if (parser.validate) {
    return parser.validate(content);
  }
  
  // Prova a parsare per validare
  try {
    parser.parse(content);
    return { valid: true, errors: [], warnings: [] };
  } catch (e: any) {
    return { valid: false, errors: [e.message], warnings: [] };
  }
}
