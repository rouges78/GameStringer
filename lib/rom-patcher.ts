/**
 * ROM Patcher - Applica patch IPS/BPS a file ROM
 * 
 * Sostituto integrato per tool esterni (Lunar IPS, Floating IPS, etc.)
 * Supporta i formati standard della scena romhacking:
 * - IPS (International Patching System) - classico, max 16MB
 * - BPS (Beat Patching System) - moderno, qualsiasi dimensione, con checksum CRC32
 */

const IPS_MAGIC = 'PATCH';
const IPS_EOF = 'EOF';
const BPS_MAGIC = 'BPS1';

export interface PatchResult {
  success: boolean;
  output?: Uint8Array;
  outputSize: number;
  format: 'ips' | 'bps';
  recordsApplied: number;
  error?: string;
}

export interface PatchInfo {
  format: 'ips' | 'bps' | 'unknown';
  valid: boolean;
  size: number;
  targetSize?: number;
  sourceCrc?: string;
  targetCrc?: string;
}

/**
 * Identifica formato e info base di una patch
 */
export function identifyPatch(data: Uint8Array): PatchInfo {
  if (data.length < 8) return { format: 'unknown', valid: false, size: data.length };

  const magic4 = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const magic5 = magic4 + String.fromCharCode(data[4]);

  if (magic5 === IPS_MAGIC) {
    return { format: 'ips', valid: true, size: data.length };
  }

  if (magic4 === BPS_MAGIC) {
    try {
      let pos = 4;
      const src = readBpsVlq(data, pos); pos = src.newPos;
      const tgt = readBpsVlq(data, pos); pos = tgt.newPos;
      const srcCrc = data.length >= 12 ? ((data[data.length - 12]) | (data[data.length - 11] << 8) | (data[data.length - 10] << 16) | (data[data.length - 9] << 24)) >>> 0 : undefined;
      const tgtCrc = data.length >= 8 ? ((data[data.length - 8]) | (data[data.length - 7] << 8) | (data[data.length - 6] << 16) | (data[data.length - 5] << 24)) >>> 0 : undefined;
      return {
        format: 'bps', valid: true, size: data.length,
        targetSize: tgt.value,
        sourceCrc: srcCrc !== undefined ? srcCrc.toString(16).padStart(8, '0') : undefined,
        targetCrc: tgtCrc !== undefined ? tgtCrc.toString(16).padStart(8, '0') : undefined,
      };
    } catch {
      return { format: 'bps', valid: false, size: data.length };
    }
  }

  return { format: 'unknown', valid: false, size: data.length };
}

// ============================================================================
// IPS PATCHER
// ============================================================================

/**
 * Applica una patch IPS a una ROM.
 * Formato: PATCH + record [offset(3B) + size(2B) + data | RLE] + EOF
 */
export function applyIPS(romData: Uint8Array, patchData: Uint8Array): PatchResult {
  try {
    const magic = String.fromCharCode(...patchData.slice(0, 5));
    if (magic !== IPS_MAGIC) {
      return { success: false, outputSize: 0, format: 'ips', recordsApplied: 0, error: 'File non e una patch IPS valida' };
    }
    let pos = 5;

    let output = new Uint8Array(Math.max(romData.length, 16 * 1024 * 1024));
    output.set(romData);
    let maxWritten = romData.length;
    let records = 0;

    while (pos + 3 <= patchData.length) {
      const eofCheck = String.fromCharCode(patchData[pos], patchData[pos + 1], patchData[pos + 2]);
      if (eofCheck === IPS_EOF) break;

      const offset = (patchData[pos] << 16) | (patchData[pos + 1] << 8) | patchData[pos + 2];
      pos += 3;
      if (pos + 2 > patchData.length) break;

      const size = (patchData[pos] << 8) | patchData[pos + 1];
      pos += 2;

      if (size === 0) {
        // RLE
        if (pos + 3 > patchData.length) break;
        const rleSize = (patchData[pos] << 8) | patchData[pos + 1];
        pos += 2;
        const rleByte = patchData[pos];
        pos += 1;

        const needed = offset + rleSize;
        if (needed > output.length) {
          const newOut = new Uint8Array(needed + 4096);
          newOut.set(output);
          output = newOut;
        }
        output.fill(rleByte, offset, offset + rleSize);
        maxWritten = Math.max(maxWritten, offset + rleSize);
      } else {
        if (pos + size > patchData.length) break;
        const needed = offset + size;
        if (needed > output.length) {
          const newOut = new Uint8Array(needed + 4096);
          newOut.set(output);
          output = newOut;
        }
        output.set(patchData.slice(pos, pos + size), offset);
        pos += size;
        maxWritten = Math.max(maxWritten, offset + size);
      }
      records++;
    }

    const trimmed = output.slice(0, maxWritten);
    return { success: true, output: trimmed, outputSize: maxWritten, format: 'ips', recordsApplied: records };
  } catch (err: any) {
    return { success: false, outputSize: 0, format: 'ips', recordsApplied: 0, error: err.message };
  }
}

// ============================================================================
// BPS PATCHER
// ============================================================================

function readBpsVlq(data: Uint8Array, pos: number): { value: number; newPos: number } {
  let result = 0;
  let shift = 1;
  let offset = pos;
  while (true) {
    if (offset >= data.length) throw new Error('BPS VLQ overflow');
    const byte = data[offset++];
    result += (byte & 0x7f) * shift;
    if (byte & 0x80) break;
    shift <<= 7;
    result += shift;
  }
  return { value: result, newPos: offset };
}

function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Applica una patch BPS a una ROM.
 * Formato: BPS1 + sourceSize(VLQ) + targetSize(VLQ) + metaSize(VLQ) + meta + actions + checksums
 */
export function applyBPS(romData: Uint8Array, patchData: Uint8Array): PatchResult {
  try {
    const magic = String.fromCharCode(patchData[0], patchData[1], patchData[2], patchData[3]);
    if (magic !== BPS_MAGIC) {
      return { success: false, outputSize: 0, format: 'bps', recordsApplied: 0, error: 'File non e una patch BPS valida' };
    }

    // Verifica CRC32 della patch stessa
    const patchCrcStored = ((patchData[patchData.length - 4]) | (patchData[patchData.length - 3] << 8) |
      (patchData[patchData.length - 2] << 16) | (patchData[patchData.length - 1] << 24)) >>> 0;
    const patchCrcCalc = crc32(patchData.slice(0, patchData.length - 4));
    if (patchCrcStored !== patchCrcCalc) {
      return { success: false, outputSize: 0, format: 'bps', recordsApplied: 0, error: 'CRC32 patch corrotta' };
    }

    let pos = 4;
    const srcSize = readBpsVlq(patchData, pos); pos = srcSize.newPos;
    const tgtSize = readBpsVlq(patchData, pos); pos = tgtSize.newPos;
    const metaSize = readBpsVlq(patchData, pos); pos = metaSize.newPos;
    pos += metaSize.value; // skip metadata

    // Verifica CRC32 sorgente
    const srcCrcStored = ((patchData[patchData.length - 12]) | (patchData[patchData.length - 11] << 8) |
      (patchData[patchData.length - 10] << 16) | (patchData[patchData.length - 9] << 24)) >>> 0;
    const srcCrcCalc = crc32(romData);
    if (srcCrcStored !== srcCrcCalc) {
      console.warn(`[BPS] CRC32 sorgente non corrisponde: atteso ${srcCrcStored.toString(16)}, calcolato ${srcCrcCalc.toString(16)}`);
      // Non bloccare: potrebbe essere una ROM con header diverso
    }

    const output = new Uint8Array(tgtSize.value);
    let outputOffset = 0;
    let sourceRelOffset = 0;
    let targetRelOffset = 0;
    let records = 0;
    const endPos = patchData.length - 12; // 3x CRC32 alla fine

    while (pos < endPos) {
      const action = readBpsVlq(patchData, pos); pos = action.newPos;
      const length = (action.value >> 2) + 1;
      const command = action.value & 3;

      switch (command) {
        case 0: // SourceRead
          for (let i = 0; i < length; i++) {
            output[outputOffset] = romData[outputOffset] || 0;
            outputOffset++;
          }
          break;

        case 1: // TargetWrite
          for (let i = 0; i < length; i++) {
            if (pos >= endPos) break;
            output[outputOffset++] = patchData[pos++];
          }
          break;

        case 2: { // SourceCopy
          const rel = readBpsVlq(patchData, pos); pos = rel.newPos;
          sourceRelOffset += (rel.value & 1 ? -(rel.value >> 1) : (rel.value >> 1));
          for (let i = 0; i < length; i++) {
            output[outputOffset++] = romData[sourceRelOffset++] || 0;
          }
          break;
        }

        case 3: { // TargetCopy
          const rel = readBpsVlq(patchData, pos); pos = rel.newPos;
          targetRelOffset += (rel.value & 1 ? -(rel.value >> 1) : (rel.value >> 1));
          for (let i = 0; i < length; i++) {
            output[outputOffset++] = output[targetRelOffset++];
          }
          break;
        }
      }
      records++;
    }

    // Verifica CRC32 output
    const tgtCrcStored = ((patchData[patchData.length - 8]) | (patchData[patchData.length - 7] << 8) |
      (patchData[patchData.length - 6] << 16) | (patchData[patchData.length - 5] << 24)) >>> 0;
    const tgtCrcCalc = crc32(output);
    if (tgtCrcStored !== tgtCrcCalc) {
      console.warn(`[BPS] CRC32 output non corrisponde: atteso ${tgtCrcStored.toString(16)}, calcolato ${tgtCrcCalc.toString(16)}`);
    }

    return { success: true, output, outputSize: output.length, format: 'bps', recordsApplied: records };
  } catch (err: any) {
    return { success: false, outputSize: 0, format: 'bps', recordsApplied: 0, error: err.message };
  }
}

/**
 * Applica automaticamente una patch (IPS o BPS) a una ROM.
 * Rileva il formato dalla patch e chiama il patcher corretto.
 */
export function applyPatch(romData: Uint8Array, patchData: Uint8Array): PatchResult {
  const info = identifyPatch(patchData);
  if (info.format === 'ips') return applyIPS(romData, patchData);
  if (info.format === 'bps') return applyBPS(romData, patchData);
  return { success: false, outputSize: 0, format: 'ips', recordsApplied: 0, error: 'Formato patch non riconosciuto (supportati: IPS, BPS)' };
}
