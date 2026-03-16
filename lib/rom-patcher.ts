/**
 * ROM Patcher - Crea e applica patch IPS/BPS per ROM retro
 * 
 * Sostituto integrato per tool esterni (Lunar IPS, Floating IPS, etc.)
 * Supporta i formati standard della scena romhacking:
 * - IPS (International Patching System) - classico, max 16MB
 * - BPS (Beat Patching System) - moderno, qualsiasi dimensione, con checksum CRC32
 * 
 * Funzionalita:
 * - createIPS / createBPS: genera patch da ROM originale vs tradotta
 * - applyIPS / applyBPS: applica patch a ROM
 * - identifyPatch: rileva formato e info di una patch
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

// ============================================================================
// IPS CREATOR
// ============================================================================

export interface CreatePatchResult {
  success: boolean;
  patch?: Uint8Array;
  patchSize: number;
  format: 'ips' | 'bps';
  records: number;
  error?: string;
}

/**
 * Crea una patch IPS confrontando ROM originale e ROM modificata.
 * Scansiona le differenze, le raggruppa in record contigui (max 0xFFFF byte ciascuno),
 * e usa RLE encoding quando un blocco e composto da un singolo byte ripetuto.
 * Limite IPS: offset max 0xFFFFFF (16MB).
 */
export function createIPS(original: Uint8Array, modified: Uint8Array): CreatePatchResult {
  try {
    const maxLen = Math.max(original.length, modified.length);
    if (maxLen > 0xFFFFFF) {
      return { success: false, patchSize: 0, format: 'ips', records: 0,
        error: 'ROM troppo grande per IPS (max 16MB). Usa BPS.' };
    }

    const chunks: Uint8Array[] = [];
    // Magic "PATCH"
    chunks.push(new Uint8Array([0x50, 0x41, 0x54, 0x43, 0x48]));
    let records = 0;
    let i = 0;

    while (i < maxLen) {
      const origByte = i < original.length ? original[i] : 0;
      const modByte = i < modified.length ? modified[i] : 0;

      if (origByte !== modByte) {
        const startOffset = i;
        // Raccogli blocco di differenze contigue (max 0xFFFF)
        let blockEnd = i;
        let sameCount = 0;
        while (blockEnd < maxLen && (blockEnd - startOffset) < 0xFFFF) {
          const ob = blockEnd < original.length ? original[blockEnd] : 0;
          const mb = blockEnd < modified.length ? modified[blockEnd] : 0;
          if (ob === mb) {
            sameCount++;
            if (sameCount >= 6) {
              blockEnd -= sameCount;
              break;
            }
          } else {
            sameCount = 0;
          }
          blockEnd++;
        }
        if (blockEnd <= startOffset) blockEnd = startOffset + 1;
        const blockSize = blockEnd - startOffset;

        // Check RLE: tutto lo stesso byte?
        const firstByte = startOffset < modified.length ? modified[startOffset] : 0;
        let isRle = blockSize >= 3;
        if (isRle) {
          for (let j = startOffset + 1; j < startOffset + blockSize; j++) {
            const mb = j < modified.length ? modified[j] : 0;
            if (mb !== firstByte) { isRle = false; break; }
          }
        }

        // Offset (3 byte big-endian)
        const rec = isRle ? new Uint8Array(8) : new Uint8Array(5 + blockSize);
        rec[0] = (startOffset >> 16) & 0xFF;
        rec[1] = (startOffset >> 8) & 0xFF;
        rec[2] = startOffset & 0xFF;

        if (isRle) {
          // Size = 0 -> RLE
          rec[3] = 0;
          rec[4] = 0;
          rec[5] = (blockSize >> 8) & 0xFF;
          rec[6] = blockSize & 0xFF;
          rec[7] = firstByte;
        } else {
          rec[3] = (blockSize >> 8) & 0xFF;
          rec[4] = blockSize & 0xFF;
          for (let j = 0; j < blockSize; j++) {
            rec[5 + j] = (startOffset + j) < modified.length ? modified[startOffset + j] : 0;
          }
        }

        chunks.push(rec);
        records++;
        i = startOffset + blockSize;
      } else {
        i++;
      }
    }

    // EOF "EOF"
    chunks.push(new Uint8Array([0x45, 0x4F, 0x46]));

    // Truncation extension: se modified e piu corta di original
    if (modified.length < original.length) {
      const trunc = new Uint8Array(3);
      trunc[0] = (modified.length >> 16) & 0xFF;
      trunc[1] = (modified.length >> 8) & 0xFF;
      trunc[2] = modified.length & 0xFF;
      chunks.push(trunc);
    }

    // Concatena
    const totalSize = chunks.reduce((s, c) => s + c.length, 0);
    const patch = new Uint8Array(totalSize);
    let pos = 0;
    for (const c of chunks) {
      patch.set(c, pos);
      pos += c.length;
    }

    return { success: true, patch, patchSize: totalSize, format: 'ips', records };
  } catch (err: any) {
    return { success: false, patchSize: 0, format: 'ips', records: 0, error: err.message };
  }
}

// ============================================================================
// BPS CREATOR
// ============================================================================

function writeBpsVlq(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value;
  while (true) {
    let x = v & 0x7f;
    v >>= 7;
    if (v === 0) {
      bytes.push(x | 0x80);
      break;
    }
    bytes.push(x);
    v--;
  }
  return new Uint8Array(bytes);
}

function writeLe32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xFF,
    (value >> 8) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 24) & 0xFF,
  ]);
}

/**
 * Crea una patch BPS confrontando ROM originale e ROM modificata.
 * Usa SourceRead per byte uguali e TargetWrite per le differenze.
 * Include checksum CRC32 per sorgente, target e patch.
 */
export function createBPS(original: Uint8Array, modified: Uint8Array, metadata?: string): CreatePatchResult {
  try {
    const metaBytes = metadata ? new TextEncoder().encode(metadata) : new Uint8Array(0);

    const chunks: Uint8Array[] = [];
    // Magic "BPS1"
    chunks.push(new Uint8Array([0x42, 0x50, 0x53, 0x31]));
    // Source size VLQ
    chunks.push(writeBpsVlq(original.length));
    // Target size VLQ
    chunks.push(writeBpsVlq(modified.length));
    // Metadata size VLQ + metadata
    chunks.push(writeBpsVlq(metaBytes.length));
    if (metaBytes.length > 0) chunks.push(metaBytes);

    let records = 0;
    const maxLen = Math.max(original.length, modified.length);
    let i = 0;

    while (i < maxLen) {
      const origByte = i < original.length ? original[i] : 0;
      const modByte = i < modified.length ? modified[i] : 0;

      if (i < original.length && i < modified.length && origByte === modByte) {
        // SourceRead: blocco di byte uguali
        let runLen = 0;
        while (i + runLen < original.length && i + runLen < modified.length &&
               original[i + runLen] === modified[i + runLen]) {
          runLen++;
        }
        // Encode: command=0 (SourceRead), length = runLen-1, action = ((runLen-1) << 2) | 0
        chunks.push(writeBpsVlq(((runLen - 1) << 2) | 0));
        records++;
        i += runLen;
      } else {
        // TargetWrite: blocco di byte diversi
        let runLen = 0;
        while (i + runLen < maxLen) {
          const ob = (i + runLen) < original.length ? original[i + runLen] : 0;
          const mb = (i + runLen) < modified.length ? modified[i + runLen] : 0;
          if ((i + runLen) < original.length && (i + runLen) < modified.length && ob === mb) {
            // Guarda avanti: se ci sono >=4 byte uguali, interrompi il TargetWrite
            let aheadSame = 0;
            for (let k = 0; k < 8 && (i + runLen + k) < original.length && (i + runLen + k) < modified.length; k++) {
              if (original[i + runLen + k] === modified[i + runLen + k]) aheadSame++;
              else break;
            }
            if (aheadSame >= 4) break;
          }
          runLen++;
        }
        if (runLen === 0) runLen = 1;

        // Encode: command=1 (TargetWrite), action = ((runLen-1) << 2) | 1
        chunks.push(writeBpsVlq(((runLen - 1) << 2) | 1));
        // Seguito dai byte del target
        const data = new Uint8Array(runLen);
        for (let j = 0; j < runLen; j++) {
          data[j] = (i + j) < modified.length ? modified[i + j] : 0;
        }
        chunks.push(data);
        records++;
        i += runLen;
      }
    }

    // CRC32: source, target, patch
    const srcCrc = crc32(original);
    const tgtCrc = crc32(modified);

    chunks.push(writeLe32(srcCrc));
    chunks.push(writeLe32(tgtCrc));

    // Calcola dimensione patch senza il CRC della patch stessa
    const prePatchSize = chunks.reduce((s, c) => s + c.length, 0);
    const prePatch = new Uint8Array(prePatchSize);
    let pos = 0;
    for (const c of chunks) {
      prePatch.set(c, pos);
      pos += c.length;
    }

    const patchCrc = crc32(prePatch);
    const patchCrcBytes = writeLe32(patchCrc);

    // Patch finale = prePatch + patchCrc
    const patch = new Uint8Array(prePatchSize + 4);
    patch.set(prePatch);
    patch.set(patchCrcBytes, prePatchSize);

    return { success: true, patch, patchSize: patch.length, format: 'bps', records };
  } catch (err: any) {
    return { success: false, patchSize: 0, format: 'bps', records: 0, error: err.message };
  }
}

/**
 * Crea automaticamente una patch (IPS o BPS) confrontando due ROM.
 * Sceglie IPS se entrambe le ROM sono <= 16MB, altrimenti BPS.
 */
export function createPatch(
  original: Uint8Array,
  modified: Uint8Array,
  format?: 'ips' | 'bps',
  metadata?: string
): CreatePatchResult {
  const fmt = format || (Math.max(original.length, modified.length) > 0xFFFFFF ? 'bps' : 'ips');
  if (fmt === 'ips') return createIPS(original, modified);
  return createBPS(original, modified, metadata);
}
