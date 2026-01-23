/**
 * 🎮 Retro ROM Translation Tools
 * 
 * Supporta traduzione ROM per:
 * - NES/Famicom
 * - SNES/Super Famicom
 * - Game Boy / Game Boy Color / Game Boy Advance
 * - Sega Genesis/Mega Drive
 * - PlayStation 1
 * 
 * Funzionalità:
 * - Rilevamento encoding caratteri
 * - Table file (.tbl) parser/generator
 * - Pointer extraction/reinsertion
 * - Font injection con supporto caratteri accentati
 * - ROM expansion per testi più lunghi
 */

export interface RomInfo {
  platform: RomPlatform;
  title: string;
  region: 'NTSC-U' | 'NTSC-J' | 'PAL' | 'Unknown';
  size: number;
  headerSize: number;
  checksum?: string;
  mapper?: string; // NES mapper
  format?: string; // iNES, SMC, etc.
}

export type RomPlatform = 
  | 'nes'
  | 'snes'
  | 'gb'
  | 'gbc'
  | 'gba'
  | 'genesis'
  | 'psx'
  | 'n64'
  | 'unknown';

export interface TableEntry {
  hex: string;   // Es. "A0"
  char: string;  // Es. "A"
}

export interface TableFile {
  entries: TableEntry[];
  platform: RomPlatform;
  name: string;
  encoding: 'ascii' | 'sjis' | 'custom';
}

export interface TextBlock {
  offset: number;
  pointerOffset?: number;
  originalText: string;
  translatedText?: string;
  maxLength?: number;
  encoding: string;
}

export interface FontGlyph {
  char: string;
  width: number;
  height: number;
  data: Uint8Array;
}

export interface FontSet {
  name: string;
  platform: RomPlatform;
  glyphWidth: number;
  glyphHeight: number;
  glyphs: FontGlyph[];
  bitsPerPixel: 1 | 2 | 4 | 8;
}

// ============================================================================
// ROM DETECTION
// ============================================================================

const NES_HEADER = [0x4E, 0x45, 0x53, 0x1A]; // "NES\x1A"
const SNES_HEADER_LOROM = 0x7FC0;
const SNES_HEADER_HIROM = 0xFFC0;
const GB_HEADER_OFFSET = 0x0134;
const GBA_HEADER = [0x2E, 0x00, 0x00, 0xEA]; // ARM branch
const GENESIS_HEADER = "SEGA";
const PSX_HEADER = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // PS-X EXE

export function detectRomPlatform(data: Uint8Array): RomPlatform {
  // NES - iNES header
  if (data.length >= 16 && 
      data[0] === NES_HEADER[0] && 
      data[1] === NES_HEADER[1] && 
      data[2] === NES_HEADER[2] && 
      data[3] === NES_HEADER[3]) {
    return 'nes';
  }
  
  // Game Boy - Nintendo logo at 0x104-0x133
  if (data.length >= 0x150 && data[0x104] === 0xCE && data[0x105] === 0xED) {
    // Check for GBC
    if (data[0x143] === 0x80 || data[0x143] === 0xC0) {
      return 'gbc';
    }
    return 'gb';
  }
  
  // GBA - ROM entry point
  if (data.length >= 4 && 
      (data[3] === 0xEA || (data[0] === 0x2E && data[3] === 0xEA))) {
    // Check Nintendo logo at 0x04
    if (data.length >= 0xA0 && data[0x04] === 0x24) {
      return 'gba';
    }
  }
  
  // Genesis - "SEGA" string at various locations
  if (data.length >= 0x200) {
    const header100 = String.fromCharCode(...data.slice(0x100, 0x104));
    const header110 = String.fromCharCode(...data.slice(0x110, 0x114));
    if (header100 === GENESIS_HEADER || header110 === GENESIS_HEADER) {
      return 'genesis';
    }
  }
  
  // SNES - Check internal header
  if (data.length >= 0x10000) {
    // Try LoROM
    const loromChecksum = data[SNES_HEADER_LOROM + 0x1C] ^ data[SNES_HEADER_LOROM + 0x1E];
    const loromComplement = data[SNES_HEADER_LOROM + 0x1D] ^ data[SNES_HEADER_LOROM + 0x1F];
    if (loromChecksum === 0xFF && loromComplement === 0xFF) {
      return 'snes';
    }
    
    // Try HiROM (with 512 byte header)
    if (data.length >= 0x10200) {
      const hiromChecksum = data[SNES_HEADER_HIROM + 0x200 + 0x1C] ^ data[SNES_HEADER_HIROM + 0x200 + 0x1E];
      if (hiromChecksum === 0xFF) {
        return 'snes';
      }
    }
  }
  
  // PSX - Check for PS-X EXE
  if (data.length >= 0x800) {
    const psxHeader = String.fromCharCode(...data.slice(0, 8));
    if (psxHeader === "PS-X EXE") {
      return 'psx';
    }
  }
  
  return 'unknown';
}

export function getRomInfo(data: Uint8Array): RomInfo {
  const platform = detectRomPlatform(data);
  let title = 'Unknown';
  let region: RomInfo['region'] = 'Unknown';
  let headerSize = 0;
  let mapper: string | undefined;
  let format: string | undefined;
  
  switch (platform) {
    case 'nes':
      headerSize = 16;
      mapper = `Mapper ${((data[6] >> 4) | (data[7] & 0xF0))}`;
      format = 'iNES';
      // Title usually not in header for NES
      break;
      
    case 'snes':
      // Try to read internal title
      const titleOffset = data.length > 0x10000 ? SNES_HEADER_HIROM + 0x200 : SNES_HEADER_LOROM;
      title = String.fromCharCode(...data.slice(titleOffset, titleOffset + 21)).replace(/\0/g, '').trim();
      // Region from country code
      const country = data[titleOffset + 0x19];
      region = country === 0 || country === 1 ? 'NTSC-J' : country === 2 ? 'NTSC-U' : 'PAL';
      headerSize = data.length > 0x10000 && (data.length & 0x7FFF) === 0x200 ? 512 : 0;
      format = headerSize > 0 ? 'SMC' : 'SFC';
      break;
      
    case 'gb':
    case 'gbc':
      title = String.fromCharCode(...data.slice(GB_HEADER_OFFSET, GB_HEADER_OFFSET + 16)).replace(/\0/g, '').trim();
      const gbRegion = data[0x14A];
      region = gbRegion === 0 ? 'NTSC-J' : 'NTSC-U';
      format = platform === 'gbc' ? 'GBC' : 'GB';
      break;
      
    case 'gba':
      title = String.fromCharCode(...data.slice(0xA0, 0xAC)).replace(/\0/g, '').trim();
      const gbaRegion = String.fromCharCode(data[0xAF]);
      region = gbaRegion === 'J' ? 'NTSC-J' : gbaRegion === 'E' ? 'NTSC-U' : 'PAL';
      format = 'GBA';
      break;
      
    case 'genesis':
      title = String.fromCharCode(...data.slice(0x120, 0x150)).replace(/\0/g, '').trim();
      const genesisRegion = String.fromCharCode(...data.slice(0x1F0, 0x1F3));
      region = genesisRegion.includes('J') ? 'NTSC-J' : genesisRegion.includes('U') ? 'NTSC-U' : 'PAL';
      format = 'BIN';
      break;
      
    case 'psx':
      format = 'PS-X EXE';
      break;
  }
  
  return {
    platform,
    title,
    region,
    size: data.length,
    headerSize,
    mapper,
    format
  };
}

// ============================================================================
// TABLE FILE HANDLING
// ============================================================================

/**
 * Parse a .tbl (table) file
 * Format: HEX=CHAR (one per line)
 */
export function parseTableFile(content: string): TableFile {
  const entries: TableEntry[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
    
    const match = trimmed.match(/^([0-9A-Fa-f]+)=(.*)$/);
    if (match) {
      entries.push({
        hex: match[1].toUpperCase(),
        char: match[2]
      });
    }
  }
  
  return {
    entries,
    platform: 'unknown',
    name: 'Custom Table',
    encoding: 'custom'
  };
}

/**
 * Generate a .tbl file from entries
 */
export function generateTableFile(table: TableFile): string {
  const lines: string[] = [
    `// Table file for ${table.name}`,
    `// Platform: ${table.platform}`,
    `// Encoding: ${table.encoding}`,
    ''
  ];
  
  for (const entry of table.entries) {
    lines.push(`${entry.hex}=${entry.char}`);
  }
  
  return lines.join('\n');
}

/**
 * Generate standard ASCII table (0x20-0x7E)
 */
export function generateAsciiTable(offset: number = 0): TableFile {
  const entries: TableEntry[] = [];
  
  for (let i = 0x20; i <= 0x7E; i++) {
    const hex = (i + offset).toString(16).toUpperCase().padStart(2, '0');
    entries.push({
      hex,
      char: String.fromCharCode(i)
    });
  }
  
  return {
    entries,
    platform: 'unknown',
    name: 'ASCII Standard',
    encoding: 'ascii'
  };
}

/**
 * Generate table with Italian accented characters
 */
export function generateItalianTable(baseOffset: number = 0x80): TableFile {
  const italianChars = 'àèéìòùÀÈÉÌÒÙ';
  const entries: TableEntry[] = [];
  
  // Start with ASCII
  for (let i = 0x20; i <= 0x7E; i++) {
    entries.push({
      hex: i.toString(16).toUpperCase().padStart(2, '0'),
      char: String.fromCharCode(i)
    });
  }
  
  // Add Italian accented characters
  for (let i = 0; i < italianChars.length; i++) {
    entries.push({
      hex: (baseOffset + i).toString(16).toUpperCase().padStart(2, '0'),
      char: italianChars[i]
    });
  }
  
  return {
    entries,
    platform: 'unknown',
    name: 'ASCII + Italian',
    encoding: 'custom'
  };
}

// ============================================================================
// TEXT EXTRACTION
// ============================================================================

/**
 * Extract text from ROM using table
 */
export function extractTextWithTable(
  data: Uint8Array,
  table: TableFile,
  startOffset: number,
  endOffset: number,
  terminator: number = 0x00
): TextBlock[] {
  const blocks: TextBlock[] = [];
  const hexToChar = new Map(table.entries.map(e => [parseInt(e.hex, 16), e.char]));
  
  let currentBlock: { offset: number; chars: string[] } | null = null;
  
  for (let i = startOffset; i < endOffset && i < data.length; i++) {
    const byte = data[i];
    
    if (byte === terminator) {
      if (currentBlock && currentBlock.chars.length > 0) {
        blocks.push({
          offset: currentBlock.offset,
          originalText: currentBlock.chars.join(''),
          encoding: table.name
        });
      }
      currentBlock = null;
      continue;
    }
    
    const char = hexToChar.get(byte);
    if (char !== undefined) {
      if (!currentBlock) {
        currentBlock = { offset: i, chars: [] };
      }
      currentBlock.chars.push(char);
    } else {
      // Unknown byte - might be control code or end of text
      if (currentBlock && currentBlock.chars.length > 0) {
        blocks.push({
          offset: currentBlock.offset,
          originalText: currentBlock.chars.join(''),
          encoding: table.name
        });
      }
      currentBlock = null;
    }
  }
  
  return blocks;
}

/**
 * Find potential text regions by scanning for ASCII-like patterns
 */
export function findTextRegions(
  data: Uint8Array,
  minLength: number = 5
): Array<{ start: number; end: number; preview: string }> {
  const regions: Array<{ start: number; end: number; preview: string }> = [];
  let regionStart = -1;
  let currentText = '';
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    
    // Check if byte is printable ASCII (0x20-0x7E) or common Japanese encodings
    const isPrintable = (byte >= 0x20 && byte <= 0x7E) || 
                        (byte >= 0x80 && byte <= 0x9F) || // Shift-JIS half
                        (byte >= 0xA0 && byte <= 0xDF);   // Katakana
    
    if (isPrintable) {
      if (regionStart === -1) {
        regionStart = i;
        currentText = '';
      }
      if (byte >= 0x20 && byte <= 0x7E) {
        currentText += String.fromCharCode(byte);
      }
    } else {
      if (regionStart !== -1 && (i - regionStart) >= minLength) {
        regions.push({
          start: regionStart,
          end: i,
          preview: currentText.slice(0, 50) + (currentText.length > 50 ? '...' : '')
        });
      }
      regionStart = -1;
      currentText = '';
    }
  }
  
  return regions;
}

// ============================================================================
// TEXT INSERTION
// ============================================================================

/**
 * Convert text to bytes using table
 */
export function textToBytes(text: string, table: TableFile): Uint8Array | null {
  const charToHex = new Map(table.entries.map(e => [e.char, parseInt(e.hex, 16)]));
  const bytes: number[] = [];
  
  for (const char of text) {
    const byte = charToHex.get(char);
    if (byte === undefined) {
      console.warn(`Character '${char}' not found in table`);
      return null;
    }
    bytes.push(byte);
  }
  
  return new Uint8Array(bytes);
}

/**
 * Insert translated text at offset
 */
export function insertText(
  data: Uint8Array,
  offset: number,
  text: string,
  table: TableFile,
  maxLength?: number,
  terminator: number = 0x00
): { success: boolean; newData: Uint8Array; overflow: boolean } {
  const bytes = textToBytes(text, table);
  
  if (!bytes) {
    return { success: false, newData: data, overflow: false };
  }
  
  const overflow = maxLength !== undefined && bytes.length > maxLength;
  const actualLength = maxLength ? Math.min(bytes.length, maxLength) : bytes.length;
  
  const newData = new Uint8Array(data);
  
  for (let i = 0; i < actualLength; i++) {
    newData[offset + i] = bytes[i];
  }
  
  // Add terminator
  if (offset + actualLength < newData.length) {
    newData[offset + actualLength] = terminator;
  }
  
  // Pad with spaces if needed
  if (maxLength && actualLength < maxLength) {
    const spaceChar = table.entries.find(e => e.char === ' ');
    const spaceByte = spaceChar ? parseInt(spaceChar.hex, 16) : 0x20;
    for (let i = actualLength + 1; i < maxLength; i++) {
      newData[offset + i] = spaceByte;
    }
  }
  
  return { success: true, newData, overflow };
}

// ============================================================================
// FONT TOOLS
// ============================================================================

/**
 * Extract 1bpp font glyphs (NES style)
 */
export function extract1bppFont(
  data: Uint8Array,
  offset: number,
  glyphWidth: number,
  glyphHeight: number,
  glyphCount: number
): Uint8Array[] {
  const glyphs: Uint8Array[] = [];
  const bytesPerRow = Math.ceil(glyphWidth / 8);
  const bytesPerGlyph = bytesPerRow * glyphHeight;
  
  for (let g = 0; g < glyphCount; g++) {
    const glyph = new Uint8Array(bytesPerGlyph);
    for (let i = 0; i < bytesPerGlyph; i++) {
      glyph[i] = data[offset + g * bytesPerGlyph + i];
    }
    glyphs.push(glyph);
  }
  
  return glyphs;
}

/**
 * Convert 8x8 pixel array to 1bpp bytes
 */
export function pixelsTo1bpp(pixels: boolean[][]): Uint8Array {
  const bytes = new Uint8Array(8);
  
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      if (pixels[row]?.[col]) {
        byte |= (1 << (7 - col));
      }
    }
    bytes[row] = byte;
  }
  
  return bytes;
}

/**
 * Simple 8x8 font data for Italian accented characters
 * Returns pixel data for: àèéìòùÀÈÉÌÒÙ
 */
export function getItalianAccentGlyphs(): Map<string, boolean[][]> {
  const glyphs = new Map<string, boolean[][]>();
  
  // à - lowercase a with grave
  glyphs.set('à', [
    [false, true, false, false, false, false, false, false],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, false, false, false, false],
    [false, true, true, true, false, false, false, false],
    [false, false, false, false, true, false, false, false],
    [false, true, true, true, true, false, false, false],
    [true, false, false, false, true, false, false, false],
    [false, true, true, true, true, false, false, false],
  ]);
  
  // è - lowercase e with grave
  glyphs.set('è', [
    [false, true, false, false, false, false, false, false],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, false, false, false, false],
    [false, true, true, true, false, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, true, true, true, true, false, false, false],
    [true, false, false, false, false, false, false, false],
    [false, true, true, true, false, false, false, false],
  ]);
  
  // é - lowercase e with acute
  glyphs.set('é', [
    [false, false, false, true, false, false, false, false],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, false, false, false, false],
    [false, true, true, true, false, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, true, true, true, true, false, false, false],
    [true, false, false, false, false, false, false, false],
    [false, true, true, true, false, false, false, false],
  ]);
  
  // ì - lowercase i with grave
  glyphs.set('ì', [
    [true, false, false, false, false, false, false, false],
    [false, true, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false],
    [false, true, false, false, false, false, false, false],
    [false, true, false, false, false, false, false, false],
    [false, true, false, false, false, false, false, false],
    [false, true, false, false, false, false, false, false],
    [false, true, false, false, false, false, false, false],
  ]);
  
  // ò - lowercase o with grave
  glyphs.set('ò', [
    [false, true, false, false, false, false, false, false],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, false, false, false, false],
    [false, true, true, true, false, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, false, false, false, true, false, false, false],
    [false, true, true, true, false, false, false, false],
  ]);
  
  // ù - lowercase u with grave
  glyphs.set('ù', [
    [false, true, false, false, false, false, false, false],
    [false, false, true, false, false, false, false, false],
    [false, false, false, false, false, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, false, false, false, true, false, false, false],
    [true, false, false, false, true, false, false, false],
    [false, true, true, true, true, false, false, false],
  ]);
  
  return glyphs;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const PLATFORM_NAMES: Record<RomPlatform, string> = {
  nes: 'Nintendo Entertainment System',
  snes: 'Super Nintendo',
  gb: 'Game Boy',
  gbc: 'Game Boy Color',
  gba: 'Game Boy Advance',
  genesis: 'Sega Genesis / Mega Drive',
  psx: 'PlayStation',
  n64: 'Nintendo 64',
  unknown: 'Unknown'
};

export const PLATFORM_TOOLS: Record<RomPlatform, string[]> = {
  nes: ['NES Screen Tool', 'YY-CHR', 'Tile Layer Pro'],
  snes: ['YY-CHR', 'Tile Molester', 'WindHex'],
  gb: ['YY-CHR', 'Tile Layer Pro'],
  gbc: ['YY-CHR', 'Tile Layer Pro'],
  gba: ['YY-CHR', 'TilEd', 'VBA-M'],
  genesis: ['YY-CHR', 'Tile Molester'],
  psx: ['TIM Viewer', 'jPSXdec'],
  n64: ['N64 Texture Tool'],
  unknown: []
};
