/**
 * Unreal Engine .pak File Parser
 * 
 * Supports reading and extracting localization files (.locres, .locmeta)
 * from Unreal Engine .pak archives.
 * 
 * PAK format overview:
 * - Footer at end of file (magic, version, index offset/size, hash)
 * - Index contains file entries (name, offset, size, compressed size, hash)
 * - Files may be compressed (zlib) or uncompressed
 * - .locres files contain the actual translation strings
 * 
 * .locres format (UE4/UE5):
 * - Magic: 0x0E14DA7A
 * - Version byte
 * - String table with namespace/key/value entries
 */

// ─── PAK Types ───────────────────────────────────────────────

export interface PakInfo {
  version: number;
  indexOffset: number;
  indexSize: number;
  indexHash: Uint8Array;
  mountPoint: string;
  fileCount: number;
  entries: PakEntry[];
}

export interface PakEntry {
  filename: string;
  offset: number;
  size: number;
  uncompressedSize: number;
  compressionMethod: number;
  hash: Uint8Array;
  isEncrypted: boolean;
}

export interface LocresData {
  version: number;
  namespaces: LocresNamespace[];
  totalStrings: number;
}

export interface LocresNamespace {
  namespace: string;
  entries: LocresEntry[];
}

export interface LocresEntry {
  key: string;
  value: string;
  hash: number;
}

export interface PakLocalizationFile {
  pakPath: string;
  entryPath: string;
  language: string;
  data: LocresData;
}

// ─── PAK Footer Constants ────────────────────────────────────

const PAK_MAGIC = 0x5A6F12E1;
const LOCRES_MAGIC = 0x0E14DA7A;

// PAK versions
const PAK_V1 = 1;  // UE4.0-4.2
const PAK_V2 = 2;  // UE4.3-4.15
const PAK_V3 = 3;  // UE4.16-4.19
const PAK_V4 = 4;  // UE4.20
const PAK_V7 = 7;  // UE4.22+
const PAK_V8 = 8;  // UE4.23+
const PAK_V9 = 9;  // UE4.25+
const PAK_V11 = 11; // UE5.0+

// Footer sizes per version
function getFooterSize(version: number): number {
  if (version >= PAK_V11) return 225;
  if (version >= PAK_V9) return 226;
  if (version >= PAK_V8) return 225;
  if (version >= PAK_V4) return 221;
  return 204;
}

// ─── Buffer Helpers ──────────────────────────────────────────

class BinaryReader {
  private view: DataView;
  private pos: number;

  constructor(buffer: ArrayBuffer, offset: number = 0) {
    this.view = new DataView(buffer);
    this.pos = offset;
  }

  get position(): number { return this.pos; }
  set position(v: number) { this.pos = v; }

  readUint8(): number {
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  readInt32(): number {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readUint32(): number {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readInt64(): number {
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getInt32(this.pos + 4, true);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  readUint64(): number {
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getUint32(this.pos + 4, true);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  readBytes(count: number): Uint8Array {
    const arr = new Uint8Array(this.view.buffer, this.pos, count);
    this.pos += count;
    return new Uint8Array(arr);
  }

  readFString(): string {
    const len = this.readInt32();
    if (len === 0) return '';
    
    const isUnicode = len < 0;
    const actualLen = isUnicode ? -len : len;
    
    if (isUnicode) {
      const chars: string[] = [];
      for (let i = 0; i < actualLen - 1; i++) {
        chars.push(String.fromCharCode(this.view.getUint16(this.pos, true)));
        this.pos += 2;
      }
      this.pos += 2; // null terminator
      return chars.join('');
    } else {
      const bytes = this.readBytes(actualLen);
      // Remove null terminator
      const textBytes = bytes.slice(0, actualLen - 1);
      return new TextDecoder('utf-8').decode(textBytes);
    }
  }

  canRead(bytes: number): boolean {
    return this.pos + bytes <= this.view.byteLength;
  }
}

// ─── PAK Parser ──────────────────────────────────────────────

/**
 * Read PAK footer to get basic info
 */
export function readPakFooter(buffer: ArrayBuffer): PakInfo | null {
  const view = new DataView(buffer);
  const size = buffer.byteLength;

  // Try different footer sizes (versions)
  for (const version of [PAK_V11, PAK_V9, PAK_V8, PAK_V7, PAK_V4, PAK_V3, PAK_V2, PAK_V1]) {
    const footerSize = getFooterSize(version);
    if (size < footerSize) continue;

    const footerOffset = size - footerSize;
    
    // Check magic at expected position
    // Footer layout: ... encryption_guid(16) | encrypted_flag(1) | magic(4) | version(4) | index_offset(8) | index_size(8) | hash(20)
    // The exact layout varies by version, but magic is typically near the start of footer
    
    // Try reading magic at different positions within the footer
    for (const magicOff of [footerOffset, footerOffset + 17, footerOffset + 1]) {
      if (magicOff + 44 > size) continue;
      
      const magic = view.getUint32(magicOff, true);
      if (magic === PAK_MAGIC) {
        const pakVersion = view.getInt32(magicOff + 4, true);
        const indexOffset = readUint64LE(view, magicOff + 8);
        const indexSize = readUint64LE(view, magicOff + 16);

        return {
          version: pakVersion,
          indexOffset,
          indexSize,
          indexHash: new Uint8Array(buffer, magicOff + 24, 20),
          mountPoint: '',
          fileCount: 0,
          entries: [],
        };
      }
    }
  }

  return null;
}

function readUint64LE(view: DataView, offset: number): number {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return hi * 0x100000000 + lo;
}

/**
 * List all files in a PAK archive
 */
export function listPakFiles(buffer: ArrayBuffer): PakEntry[] {
  const info = readPakFooter(buffer);
  if (!info) return [];

  try {
    const reader = new BinaryReader(buffer, info.indexOffset);
    const mountPoint = reader.readFString();
    const fileCount = reader.readInt32();

    const entries: PakEntry[] = [];
    for (let i = 0; i < fileCount; i++) {
      if (!reader.canRead(4)) break;
      
      const filename = reader.readFString();
      const offset = reader.readInt64();
      const size = reader.readInt64();
      const uncompressedSize = reader.readInt64();
      const compressionMethod = reader.readInt32();
      const hash = reader.readBytes(20);
      
      if (info.version >= PAK_V3) {
        reader.readUint32(); // compression block count
      }
      
      const isEncrypted = reader.readUint8() !== 0;

      entries.push({
        filename: mountPoint + filename,
        offset,
        size,
        uncompressedSize,
        compressionMethod,
        hash,
        isEncrypted,
      });
    }

    return entries;
  } catch (e: unknown) {
    clientLogger.error('[PakParser] Error reading index:', e);
    return [];
  }
}

/**
 * Find localization files in PAK entries
 */
export function findLocresFiles(entries: PakEntry[]): PakEntry[] {
  return entries.filter(e => 
    e.filename.endsWith('.locres') && 
    !e.isEncrypted &&
    e.compressionMethod === 0
  );
}

/**
 * Detect language from .locres path
 * Typical paths: Content/Localization/Game/en/Game.locres
 */
export function detectLanguageFromPath(path: string): string {
  const langPatterns = [
    /\/([a-z]{2}(-[A-Z]{2})?)\/[^/]+\.locres$/,
    /\/Localization\/[^/]+\/([a-z]{2}(-[A-Z]{2})?)\//,
  ];
  
  for (const pattern of langPatterns) {
    const match = path.match(pattern);
    if (match) return match[1];
  }
  return 'unknown';
}

// ─── .locres Parser ──────────────────────────────────────────

/**
 * Parse a .locres file buffer into structured data
 */
export function parseLocres(buffer: ArrayBuffer): LocresData | null {
  const reader = new BinaryReader(buffer);

  // Check magic
  const magic = reader.readUint32();
  if (magic !== LOCRES_MAGIC) {
    clientLogger.error(`[LocresParser] Invalid magic: 0x${magic.toString(16)}`);
    return null;
  }

  const version = reader.readUint8();
  
  // Read string table (version >= 2)
  let stringTable: string[] = [];
  if (version >= 2) {
    const localizedStringArrayOffset = reader.readInt64();
    
    // Save position, jump to string array
    const savedPos = reader.position;
    reader.position = Number(localizedStringArrayOffset);
    
    const stringCount = reader.readInt32();
    stringTable = [];
    for (let i = 0; i < stringCount; i++) {
      stringTable.push(reader.readFString());
    }
    
    reader.position = savedPos;
  }

  // Read namespaces
  if (version >= 2) {
    // Skip current file entries count
    reader.readInt32();
  }

  const namespaceCount = reader.readInt32();
  const namespaces: LocresNamespace[] = [];
  let totalStrings = 0;

  for (let i = 0; i < namespaceCount; i++) {
    if (!reader.canRead(8)) break;

    let namespaceName: string;
    if (version >= 2) {
      const hash = reader.readUint32();
      namespaceName = reader.readFString();
    } else {
      namespaceName = reader.readFString();
    }

    const keyCount = reader.readInt32();
    const entries: LocresEntry[] = [];

    for (let j = 0; j < keyCount; j++) {
      if (!reader.canRead(8)) break;

      let key: string;
      let strHash: number;
      
      if (version >= 2) {
        strHash = reader.readUint32();
        key = reader.readFString();
      } else {
        key = reader.readFString();
        strHash = 0;
      }

      reader.readUint32(); // source string hash

      let value: string;
      if (version >= 2) {
        const stringIndex = reader.readInt32();
        value = stringIndex >= 0 && stringIndex < stringTable.length
          ? stringTable[stringIndex]
          : '';
      } else {
        value = reader.readFString();
      }

      entries.push({ key, value, hash: strHash });
    }

    totalStrings += entries.length;
    namespaces.push({ namespace: namespaceName, entries });
  }

  return { version, namespaces, totalStrings };
}

// ─── .locres Writer ──────────────────────────────────────────

/**
 * Build a .locres buffer from structured data
 * Outputs version 0 format (simplest, most compatible)
 */
export function buildLocres(data: LocresData): ArrayBuffer {
  // Calculate total size
  let size = 5; // magic(4) + version(1)

  // Namespace count
  size += 4;
  
  for (const ns of data.namespaces) {
    size += 4 + ns.namespace.length + 1; // FString: len + chars + null
    size += 4; // key count

    for (const entry of ns.entries) {
      size += 4 + entry.key.length + 1; // key FString
      size += 4; // source string hash
      size += 4 + entry.value.length + 1; // value FString
    }
  }

  const buffer = new ArrayBuffer(size + 1024); // extra padding
  const view = new DataView(buffer);
  let pos = 0;

  // Magic
  view.setUint32(pos, LOCRES_MAGIC, true);
  pos += 4;

  // Version 0 (simplest)
  view.setUint8(pos, 0);
  pos += 1;

  // Namespace count
  view.setInt32(pos, data.namespaces.length, true);
  pos += 4;

  for (const ns of data.namespaces) {
    // Namespace FString
    pos = writeFString(view, pos, ns.namespace);
    
    // Key count
    view.setInt32(pos, ns.entries.length, true);
    pos += 4;

    for (const entry of ns.entries) {
      // Key FString
      pos = writeFString(view, pos, entry.key);
      // Source string hash
      view.setUint32(pos, entry.hash, true);
      pos += 4;
      // Value FString
      pos = writeFString(view, pos, entry.value);
    }
  }

  return buffer.slice(0, pos);
}

function writeFString(view: DataView, pos: number, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  view.setInt32(pos, bytes.length + 1, true); // +1 for null terminator
  pos += 4;
  
  for (let i = 0; i < bytes.length; i++) {
    view.setUint8(pos + i, bytes[i]);
  }
  pos += bytes.length;
  view.setUint8(pos, 0); // null terminator
  pos += 1;
  
  return pos;
}

// ─── High-level API ──────────────────────────────────────────

/**
 * Scan a .pak file and extract all localization data
 */
export async function scanPakForLocalizations(pakBuffer: ArrayBuffer): Promise<PakLocalizationFile[]> {
  const entries = listPakFiles(pakBuffer);
  const locresEntries = findLocresFiles(entries);
  
  const results: PakLocalizationFile[] = [];
  
  for (const entry of locresEntries) {
    const offset = entry.offset;
    const size = entry.uncompressedSize || entry.size;
    
    // Skip the per-entry header (varies by version, typically 53-57 bytes)
    // The actual file data starts after the entry header
    const entryHeaderSize = 53;
    const dataStart = offset + entryHeaderSize;
    
    if (dataStart + size <= pakBuffer.byteLength) {
      const fileBuffer = pakBuffer.slice(dataStart, dataStart + size);
      const locresData = parseLocres(fileBuffer);
      
      if (locresData) {
        results.push({
          pakPath: '',
          entryPath: entry.filename,
          language: detectLanguageFromPath(entry.filename),
          data: locresData,
        });
      }
    }
  }
  
  return results;
}

/**
 * Extract translatable strings from .locres data
 */
export function extractStringsFromLocres(data: LocresData): { key: string; namespace: string; value: string }[] {
  const strings: { key: string; namespace: string; value: string }[] = [];
  
  for (const ns of data.namespaces) {
    for (const entry of ns.entries) {
      if (entry.value && entry.value.trim().length > 0) {
        strings.push({
          key: entry.key,
          namespace: ns.namespace,
          value: entry.value,
        });
      }
    }
  }
  
  return strings;
}

/**
 * Apply translations to .locres data (returns new copy)
 */
export function applyTranslationsToLocres(
  data: LocresData,
  translations: Record<string, string>
): LocresData {
  const newData: LocresData = {
    ...data,
    namespaces: data.namespaces.map(ns => ({
      ...ns,
      entries: ns.entries.map(entry => {
        const key = `${ns.namespace}::${entry.key}`;
        const simpleKey = entry.key;
        const translation = translations[key] || translations[simpleKey] || translations[entry.value];
        
        return translation
          ? { ...entry, value: translation }
          : entry;
      }),
    })),
  };
  
  return newData;
}

// ─── Supported Languages ─────────────────────────────────────

export const UE_LANGUAGES: Record<string, string> = {
  'ar': 'Arabic',
  'de': 'German',
  'en': 'English',
  'es': 'Spanish',
  'es-419': 'Spanish (Latin America)',
  'fr': 'French',
  'hi': 'Hindi',
  'id': 'Indonesian',
  'it': 'Italian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'nl': 'Dutch',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)',
  'ru': 'Russian',
  'sv': 'Swedish',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'vi': 'Vietnamese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
};
