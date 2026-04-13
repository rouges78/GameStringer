// Universal PO Export/Import Service
// Provides a format-agnostic PO/POT generation and parsing layer
// that works across all 14+ supported game engines.
//
// Two modes of operation:
// 1. Tauri backend (file system) — calls Rust commands via invoke
// 2. Client-side (browser) — pure JS PO generation for download blobs

// ═══════════════════════════════════════════════════════════════════
// TYPES (mirror Rust structs)
// ═══════════════════════════════════════════════════════════════════

export interface PoEntry {
  msgctxt: string | null
  msgid: string
  msgstr: string
  reference: string | null
  extracted_comment: string | null
  translator_comment: string | null
  flags: string[]
}

export interface PotEntry {
  msgctxt: string | null
  msgid: string
  reference: string | null
  extracted_comment: string | null
}

export interface PoMetadata {
  project_name: string
  language: string
  source_language: string
  game_engine: string
  generator: string
}

export interface PoParseResult {
  entries: PoEntry[]
  metadata: PoMetadata
  stats: PoStats
}

export interface PoStats {
  total: number
  translated: number
  untranslated: number
  fuzzy: number
}

export interface PoMergeResult {
  entries_kept: number
  entries_added: number
  entries_removed: number
  entries_fuzzy: number
  output_path: string
}

// ═══════════════════════════════════════════════════════════════════
// GENERIC STRING ENTRY
// ═══════════════════════════════════════════════════════════════════

/**
 * A format-agnostic translation string that any game engine
 * can convert to/from. Acts as the bridge between engine-specific
 * formats and PO entries.
 */
export interface GenericStringEntry {
  /** Unique ID within the file (engine-specific key, index, hash, etc.) */
  id: string
  /** Original source text */
  source: string
  /** Translated text (empty string if untranslated) */
  translation: string
  /** Disambiguation context — becomes msgctxt in PO */
  context?: string
  /** File/record reference — becomes #: in PO */
  reference?: string
  /** Auto-extracted comment — becomes #. in PO */
  comment?: string
}

// ═══════════════════════════════════════════════════════════════════
// FORMAT CONVERTER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/** A loosely-typed record whose values can be used as strings via || chains. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

/**
 * Each supported game engine provides a converter that transforms
 * its native string data to/from GenericStringEntry.
 */
export interface FormatConverter {
  engineName: string
  /** Convert engine-specific entries to generic format */
  toGeneric: (data: AnyRecord[]) => GenericStringEntry[]
  /** Apply generic entries back to engine-specific format */
  fromGeneric: (entries: GenericStringEntry[], originalData: AnyRecord[]) => AnyRecord[]
  /** Build a PO msgctxt from an engine-specific entry */
  contextBuilder: (entry: AnyRecord) => string
  /** Build a PO #: reference from an engine-specific entry */
  referenceBuilder: (entry: AnyRecord) => string
}

// ═══════════════════════════════════════════════════════════════════
// PRE-BUILT CONVERTERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Registry of format converters for each supported game engine.
 * Each converter knows how to map its native data structures
 * to GenericStringEntry and back.
 */
export const CONVERTERS: Record<string, FormatConverter> = {
  bethesda: {
    engineName: 'Bethesda (TES/Fallout)',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.editorId || e.formId || String(e.index),
        source: e.source || e.value || '',
        translation: e.translated || '',
        context: `${e.recordType || 'UNKNOWN'}:${e.formId || ''}:${e.fieldType || 'FULL'}`,
        reference: e.pluginName ? `${e.pluginName}:${e.formId || ''}` : undefined,
        comment: e.editorId ? `EditorID: ${e.editorId}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? o.translated })),
    contextBuilder: (e) => `${e.recordType || 'UNKNOWN'}:${e.formId || ''}:${e.fieldType || 'FULL'}`,
    referenceBuilder: (e) => `${e.pluginName || 'unknown'}:${e.formId || ''}`,
  },

  unity: {
    engineName: 'Unity (Text Assets)',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.key || e.name || String(e.index),
        source: e.value || e.text || '',
        translation: e.translated || '',
        context: e.key || e.name || undefined,
        reference: e.assetPath || e.file || undefined,
        comment: e.metadata || undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.key || e.name || '',
    referenceBuilder: (e) => e.assetPath || e.file || '',
  },

  'unity-localization': {
    engineName: 'Unity Localization Package',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.keyName || String(e.keyId),
        source: e.value || '',
        translation: e.translated || '',
        context: `${e.tableName || 'table'}:${e.keyName || e.keyId}`,
        reference: e.bundlePath || undefined,
        comment: e.isSmart ? `Smart String — ${e.metadata || ''}` : e.metadata || undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => `${e.tableName || 'table'}:${e.keyName || e.keyId}`,
    referenceBuilder: (e) => e.bundlePath || '',
  },

  unreal: {
    engineName: 'Unreal Engine',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.key || String(e.index),
        source: e.source || e.value || '',
        translation: e.translation || e.translated || '',
        context: e.namespace ? `${e.namespace}:${e.key}` : e.key,
        reference: e.file || e.manifest || undefined,
        comment: e.metadata || undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translation: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => (e.namespace ? `${e.namespace}:${e.key}` : e.key || ''),
    referenceBuilder: (e) => e.file || e.manifest || '',
  },

  rpgmaker: {
    engineName: 'RPG Maker',
    toGeneric: (data) =>
      data.map((e) => ({
        id: `${e.file || 'data'}:${e.index ?? e.id ?? 0}`,
        source: e.original || e.text || '',
        translation: e.translated || '',
        context: e.context || undefined,
        reference: `${e.file || 'data'}:${e.index ?? 0}`,
        comment: e.speaker ? `Speaker: ${e.speaker}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.context || `${e.file}:${e.index}`,
    referenceBuilder: (e) => `${e.file || 'data'}:${e.index ?? 0}`,
  },

  renpy: {
    engineName: "Ren'Py",
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.identifier || e.id || `${e.label}:${e.lineNumber}`,
        source: e.original || e.text || '',
        translation: e.translated || '',
        context: e.identifier || undefined,
        reference: `${e.file || 'script'}:${e.lineNumber ?? 0}`,
        comment: e.speaker ? `Speaker: ${e.speaker}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.identifier || `${e.label}:${e.lineNumber}`,
    referenceBuilder: (e) => `${e.file || 'script'}:${e.lineNumber ?? 0}`,
  },

  godot: {
    engineName: 'Godot Engine',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.key || e.msgid || String(e.index),
        source: e.value || e.msgid || '',
        translation: e.translated || e.msgstr || '',
        context: e.key || undefined,
        reference: e.file || e.scene || undefined,
        comment: e.comment || undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.key || '',
    referenceBuilder: (e) => e.file || e.scene || '',
  },

  danganronpa: {
    engineName: 'Danganronpa',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.context || String(e.index),
        source: e.msgid || e.original || '',
        translation: e.msgstr || e.translated || '',
        context: e.context || undefined,
        reference: e.file || undefined,
        comment: e.speaker ? `Speaker: ${e.speaker}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, msgstr: entries[i]?.translation ?? '', translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.context || '',
    referenceBuilder: (e) => e.file || '',
  },

  wolfrpg: {
    engineName: 'Wolf RPG Editor',
    toGeneric: (data) =>
      data.map((e) => ({
        id: `${e.database || 'db'}:${e.table || 0}:${e.index ?? 0}`,
        source: e.original || e.text || '',
        translation: e.translated || '',
        context: `${e.database || 'db'}:${e.table || 0}:${e.field || ''}`,
        reference: `${e.database || 'db'}:${e.table || 0}:${e.index ?? 0}`,
        comment: e.fieldName ? `Field: ${e.fieldName}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => `${e.database}:${e.table}:${e.field || ''}`,
    referenceBuilder: (e) => `${e.database}:${e.table}:${e.index}`,
  },

  gamemaker: {
    engineName: 'GameMaker',
    toGeneric: (data) =>
      data.map((e) => ({
        id: String(e.index ?? e.id),
        source: e.value || e.text || '',
        translation: e.translated || '',
        context: e.name || undefined,
        reference: `STRG:${e.index ?? e.id ?? 0}`,
        comment: e.usage || undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.name || `STRG:${e.index}`,
    referenceBuilder: (e) => `STRG:${e.index ?? e.id ?? 0}`,
  },

  telltale: {
    engineName: 'Telltale Games',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.dialogId || e.id || String(e.index),
        source: e.text || e.original || '',
        translation: e.translated || '',
        context: e.dialogId || undefined,
        reference: e.file || e.scene || undefined,
        comment: e.speaker ? `Speaker: ${e.speaker}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.dialogId || e.id || '',
    referenceBuilder: (e) => e.file || e.scene || '',
  },

  tyranoscript: {
    engineName: 'TyranoScript',
    toGeneric: (data) =>
      data.map((e) => ({
        id: `${e.file || 'script'}:${e.line ?? e.index ?? 0}`,
        source: e.original || e.text || '',
        translation: e.translated || '',
        context: e.tag || undefined,
        reference: `${e.file || 'script'}:${e.line ?? 0}`,
        comment: e.speaker ? `Speaker: ${e.speaker}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.tag || `${e.file}:${e.line}`,
    referenceBuilder: (e) => `${e.file || 'script'}:${e.line ?? 0}`,
  },

  visionaire: {
    engineName: 'Visionaire Studio',
    toGeneric: (data) =>
      data.map((e) => ({
        id: e.nodePath || e.id || String(e.index),
        source: e.value || e.text || '',
        translation: e.translated || '',
        context: e.nodePath || undefined,
        reference: e.nodePath || undefined,
        comment: e.nodeType ? `Type: ${e.nodeType}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => e.nodePath || '',
    referenceBuilder: (e) => e.nodePath || '',
  },

  cri: {
    engineName: 'CRI Middleware',
    toGeneric: (data) =>
      data.map((e) => ({
        id: `${e.speaker || 'narrator'}:${e.index ?? 0}`,
        source: e.text || e.original || '',
        translation: e.translated || '',
        context: e.speaker ? `${e.speaker}:${e.index ?? 0}` : undefined,
        reference: e.file || e.cuesheet || undefined,
        comment: e.speaker ? `Speaker: ${e.speaker}` : undefined,
      })),
    fromGeneric: (entries, original) =>
      original.map((o, i) => ({ ...o, translated: entries[i]?.translation ?? '' })),
    contextBuilder: (e) => `${e.speaker || 'narrator'}:${e.index ?? 0}`,
    referenceBuilder: (e) => e.file || e.cuesheet || '',
  },
}

// ═══════════════════════════════════════════════════════════════════
// TAURI COMMAND WRAPPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Invoke a Tauri backend command.
 * Dynamic import so this module works in SSR/test contexts.
 */
async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

// ═══════════════════════════════════════════════════════════════════
// TAURI-BACKED FUNCTIONS (file system operations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Export generic entries as a .po file via the Rust backend.
 * Returns the output file path on success.
 */
export async function exportToPO(
  entries: GenericStringEntry[],
  metadata: PoMetadata,
  outputPath: string
): Promise<string> {
  const poEntries: PoEntry[] = entries.map(genericToPoEntry)
  return invokeCommand<string>('generate_po_file', {
    entries: poEntries,
    metadata,
    outputPath,
  })
}

/**
 * Export generic entries as a .pot (template) file via the Rust backend.
 * All translations are stripped — this is the "source" template.
 */
export async function exportToPOT(
  entries: GenericStringEntry[],
  metadata: PoMetadata,
  outputPath: string
): Promise<string> {
  const potEntries: PotEntry[] = entries.map((e) => ({
    msgctxt: e.context || null,
    msgid: e.source,
    reference: e.reference || null,
    extracted_comment: e.comment || null,
  }))
  return invokeCommand<string>('generate_pot_file', {
    entries: potEntries,
    metadata,
    outputPath,
  })
}

/**
 * Import translations from a .po file via the Rust backend.
 * Returns parsed entries in generic format along with metadata and stats.
 */
export async function importFromPO(
  poPath: string
): Promise<{ entries: GenericStringEntry[]; metadata: PoMetadata; stats: PoStats }> {
  const result = await invokeCommand<PoParseResult>('parse_po_file', { poPath })
  const generic: GenericStringEntry[] = result.entries.map(poEntryToGeneric)
  return { entries: generic, metadata: result.metadata, stats: result.stats }
}

/**
 * Merge existing translations (.po) with an updated source template (.pot).
 */
export async function mergeWithPO(
  potPath: string,
  poPath: string,
  outputPath: string
): Promise<PoMergeResult> {
  return invokeCommand<PoMergeResult>('merge_po_translations', {
    potPath,
    poPath,
    outputPath,
  })
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT-SIDE PO GENERATION (pure JS, no Tauri required)
// ═══════════════════════════════════════════════════════════════════

/**
 * Escape a string for inclusion in a PO file.
 * Handles backslashes, quotes, newlines, tabs, and carriage returns.
 */
function escapePoString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
}

/**
 * Unescape a PO-format string back to its raw value.
 */
function unescapePoString(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const next = s[i + 1]
      if (next === 'n') { out += '\n'; i++ }
      else if (next === 't') { out += '\t'; i++ }
      else if (next === 'r') { out += '\r'; i++ }
      else if (next === '"') { out += '"'; i++ }
      else if (next === '\\') { out += '\\'; i++ }
      else { out += s[i] }
    } else {
      out += s[i]
    }
  }
  return out
}

/**
 * Format a PO keyword + value, using multi-line form when the
 * escaped string contains \n sequences.
 */
function formatPoValue(keyword: string, value: string): string {
  const escaped = escapePoString(value)

  if (escaped.includes('\\n')) {
    const segments = escaped.split('\\n')
    const lines: string[] = [`${keyword} ""`]
    for (let i = 0; i < segments.length; i++) {
      if (i < segments.length - 1) {
        lines.push(`"${segments[i]}\\n"`)
      } else if (segments[i].length > 0) {
        lines.push(`"${segments[i]}"`)
      }
    }
    return lines.join('\n')
  }

  return `${keyword} "${escaped}"`
}

/**
 * Build the standard PO file header block.
 */
function buildHeader(metadata: PoMetadata, isPot: boolean): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + '+0000'
  const revision = isPot ? 'YEAR-MO-DA HO:MI+ZONE' : now
  const lang = isPot ? '' : metadata.language

  return [
    `# Translation file for ${metadata.project_name}`,
    `# Generated by ${metadata.generator}`,
    '#',
    'msgid ""',
    'msgstr ""',
    `"Project-Id-Version: ${metadata.project_name}\\n"`,
    `"Report-Msgid-Bugs-To: \\n"`,
    `"POT-Creation-Date: ${now}\\n"`,
    `"PO-Revision-Date: ${revision}\\n"`,
    `"Last-Translator: GameStringer User\\n"`,
    `"Language-Team: \\n"`,
    `"Language: ${lang}\\n"`,
    `"MIME-Version: 1.0\\n"`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"X-Generator: ${metadata.generator}\\n"`,
    `"X-Game-Engine: ${metadata.game_engine}\\n"`,
  ].join('\n')
}

/**
 * Serialize a single PO entry to its text representation.
 */
function serializeEntry(entry: PoEntry): string {
  const lines: string[] = []

  if (entry.translator_comment) {
    for (const line of entry.translator_comment.split('\n')) {
      lines.push(`# ${line}`)
    }
  }
  if (entry.extracted_comment) {
    for (const line of entry.extracted_comment.split('\n')) {
      lines.push(`#. ${line}`)
    }
  }
  if (entry.reference) {
    lines.push(`#: ${entry.reference}`)
  }
  if (entry.flags.length > 0) {
    lines.push(`#, ${entry.flags.join(', ')}`)
  }
  if (entry.msgctxt) {
    lines.push(formatPoValue('msgctxt', entry.msgctxt))
  }
  lines.push(formatPoValue('msgid', entry.msgid))
  lines.push(formatPoValue('msgstr', entry.msgstr))

  return lines.join('\n')
}

/**
 * Generate a complete PO file as a string (client-side, no Tauri).
 * Suitable for creating a Blob download in the browser.
 */
export function generatePOString(
  entries: GenericStringEntry[],
  metadata: PoMetadata
): string {
  const parts: string[] = [buildHeader(metadata, false)]

  for (const entry of entries) {
    parts.push(serializeEntry(genericToPoEntry(entry)))
  }

  return parts.join('\n\n') + '\n'
}

/**
 * Parse a PO file string (client-side, no Tauri).
 * Returns generic entries and translation statistics.
 */
export function parsePOString(
  content: string
): { entries: GenericStringEntry[]; stats: PoStats } {
  const { entries } = parsePoContent(content)
  const generic = entries.map(poEntryToGeneric)
  const stats = computeStats(entries)
  return { entries: generic, stats }
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT-SIDE PARSER (state machine)
// ═══════════════════════════════════════════════════════════════════

type ParseField = 'none' | 'msgctxt' | 'msgid' | 'msgstr'

interface ParsedPo {
  entries: PoEntry[]
  headerParsed: boolean
}

/**
 * Core PO parser — works on raw text, returns PoEntry array.
 * Handles multi-line strings, all comment types, and the header entry.
 */
function parsePoContent(content: string): ParsedPo {
  const entries: PoEntry[] = []
  const lines = content.split('\n')
  let isFirst = true

  // Current entry being built
  let msgctxt: string | null = null
  let msgid = ''
  let msgstr = ''
  let reference: string | null = null
  let extractedComment: string | null = null
  let translatorComment: string | null = null
  let flags: string[] = []
  let field: ParseField = 'none'
  let hasContent = false

  function flush() {
    if (!hasContent) return

    // Skip header entry (empty msgid as first entry)
    if (isFirst && msgid === '') {
      isFirst = false
      reset()
      return
    }
    isFirst = false

    entries.push({
      msgctxt,
      msgid,
      msgstr,
      reference,
      extracted_comment: extractedComment,
      translator_comment: translatorComment,
      flags: [...flags],
    })
    reset()
  }

  function reset() {
    msgctxt = null
    msgid = ''
    msgstr = ''
    reference = null
    extractedComment = null
    translatorComment = null
    flags = []
    field = 'none'
    hasContent = false
  }

  function appendContinuation(text: string) {
    if (field === 'msgctxt') msgctxt = (msgctxt || '') + text
    else if (field === 'msgid') msgid += text
    else if (field === 'msgstr') msgstr += text
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line === '') {
      flush()
      continue
    }

    // Comment lines
    if (line.startsWith('#. ')) {
      const text = line.slice(3)
      extractedComment = extractedComment ? `${extractedComment}\n${text}` : text
      hasContent = true
      continue
    }
    if (line.startsWith('#: ')) {
      reference = line.slice(3)
      hasContent = true
      continue
    }
    if (line.startsWith('#, ')) {
      flags = line.slice(3).split(',').map((f) => f.trim())
      hasContent = true
      continue
    }
    if (line.startsWith('# ') || line === '#') {
      const text = line.length > 2 ? line.slice(2) : ''
      translatorComment = translatorComment ? `${translatorComment}\n${text}` : text
      hasContent = true
      continue
    }

    // Keyword lines
    if (line.startsWith('msgctxt ')) {
      field = 'msgctxt'
      hasContent = true
      const q = extractQuoted(line.slice(8))
      if (q !== null) msgctxt = q
      continue
    }
    if (line.startsWith('msgid ')) {
      field = 'msgid'
      hasContent = true
      const q = extractQuoted(line.slice(6))
      if (q !== null) msgid = q
      continue
    }
    if (line.startsWith('msgstr ')) {
      field = 'msgstr'
      hasContent = true
      const q = extractQuoted(line.slice(7))
      if (q !== null) msgstr = q
      continue
    }

    // Continuation line (bare quoted string)
    const q = extractQuoted(line)
    if (q !== null) {
      appendContinuation(q)
      hasContent = true
    }
  }

  // Flush last entry
  flush()

  return { entries, headerParsed: true }
}

/**
 * Extract the content of a quoted string, e.g. `"hello"` -> `hello` (unescaped).
 * Returns null if the line is not a valid quoted string.
 */
function extractQuoted(s: string): string | null {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return unescapePoString(t.slice(1, -1))
  }
  return null
}

/**
 * Compute translation statistics from a set of PO entries.
 */
function computeStats(entries: PoEntry[]): PoStats {
  let translated = 0
  let untranslated = 0
  let fuzzy = 0

  for (const e of entries) {
    if (e.flags.includes('fuzzy')) {
      fuzzy++
    } else if (!e.msgstr || e.msgstr === '') {
      untranslated++
    } else {
      translated++
    }
  }

  return { total: entries.length, translated, untranslated, fuzzy }
}

// ═══════════════════════════════════════════════════════════════════
// CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Convert a GenericStringEntry to a PoEntry. */
function genericToPoEntry(e: GenericStringEntry): PoEntry {
  return {
    msgctxt: e.context || null,
    msgid: e.source,
    msgstr: e.translation,
    reference: e.reference || null,
    extracted_comment: e.comment || null,
    translator_comment: null,
    flags: [],
  }
}

/** Convert a PoEntry back to a GenericStringEntry. */
function poEntryToGeneric(e: PoEntry): GenericStringEntry {
  return {
    id: e.msgctxt || e.reference || e.msgid.slice(0, 64),
    source: e.msgid,
    translation: e.msgstr,
    context: e.msgctxt || undefined,
    reference: e.reference || undefined,
    comment: e.extracted_comment || undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC CONVERSION UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert engine-specific entries to GenericStringEntry using the
 * appropriate format converter. Falls back to a passthrough
 * if the engine is not recognized.
 */
export function entriesToGeneric(
  entries: AnyRecord[],
  engine: string
): GenericStringEntry[] {
  const converter = CONVERTERS[engine]
  if (converter) {
    return converter.toGeneric(entries)
  }

  // Fallback: attempt a best-effort mapping from common field names
  return entries.map((e, i) => ({
    id: e.id || e.key || e.name || String(i),
    source: e.source || e.original || e.value || e.text || e.msgid || '',
    translation: e.translation || e.translated || e.msgstr || '',
    context: e.context || e.msgctxt || undefined,
    reference: e.reference || e.file || undefined,
    comment: e.comment || e.note || undefined,
  }))
}

/**
 * Apply GenericStringEntry translations back to engine-specific format.
 * Requires the original entries so structural data is preserved.
 */
export function genericToEntries(
  generic: GenericStringEntry[],
  engine: string,
  originalEntries: AnyRecord[]
): AnyRecord[] {
  const converter = CONVERTERS[engine]
  if (converter) {
    return converter.fromGeneric(generic, originalEntries)
  }

  // Fallback: set the 'translated' field on each original entry
  return originalEntries.map((o, i) => ({
    ...o,
    translated: generic[i]?.translation ?? '',
  }))
}
