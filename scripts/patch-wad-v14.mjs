/**
 * Danganronpa WAD Patcher v14 — Keyboard WAD + LIN Text Section Rebuild
 * 
 * Approccio All-Ice Team + fix corruzione .lin:
 * 1. Keyboard WAD con font italiano (accenti supportati)
 * 2. Ricostruisce il text section dei .lin (come PAK offset rebuild)
 * 3. Directory table copiata dal WAD All-Ice (garantita corretta)
 * 4. PAK Type 1 (BOM entries): free-size replacement + PAK rebuild
 * 5. PAK Type 2 (.lin entries): LIN text section rebuild
 * 6. Standalone .lin: LIN text section rebuild
 */

import { readFileSync, openSync, readSync, closeSync, existsSync,
         statSync, createWriteStream, copyFileSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const KB_WAD_PATH = join(GAME_PATH, 'dr1_data_keyboard_us.wad');
const KB_WAD_BACKUP = join(GAME_PATH, 'dr1_data_keyboard_us.wad.backup');
const KB_WAD_NEW = join(GAME_PATH, 'dr1_data_keyboard_us.wad.new');
const MAIN_WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad.backup');
const ALLICE_WAD = 'C:\\Users\\rouges\\Downloads\\DR1 - PATCH ITA - STEAM [All-Ice Team]\\DR1 - PATCH ITA - STEAM [All-Ice Team]\\dr1_data_keyboard_us.wad';
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');

function toUTF16LE(str) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    buf[i*2] = c & 0xFF;
    buf[i*2+1] = (c >> 8) & 0xFF;
  }
  return buf;
}

function normalizeLE(buf) {
  const norm = Buffer.from(buf);
  for (let i = 0; i < norm.length - 1; i += 2) {
    if (norm[i] === 0x0A && norm[i+1] === 0x00) norm[i] = 0x20;
  }
  return norm;
}

function replaceInBuffer(data, normData, searchBuf, replaceBuf) {
  const positions = [];
  let idx = normData.indexOf(searchBuf, 0);
  while (idx >= 0) {
    positions.push(idx);
    idx = normData.indexOf(searchBuf, idx + searchBuf.length);
  }
  if (positions.length === 0) return null;
  const parts = [];
  let lastEnd = 0;
  for (const pos of positions) {
    parts.push(data.subarray(lastEnd, pos));
    parts.push(replaceBuf);
    lastEnd = pos + searchBuf.length;
  }
  parts.push(data.subarray(lastEnd));
  return { newBuf: Buffer.concat(parts), count: positions.length };
}

/**
 * Parse WAD file header, entries, dir table
 */
function parseWad(path) {
  const fd = openSync(path, 'r');
  let pos = 0;
  const magic = Buffer.alloc(4); readSync(fd, magic, 0, 4, pos); pos += 4;
  const ver0 = Buffer.alloc(4); readSync(fd, ver0, 0, 4, pos); pos += 4;
  const ver1 = Buffer.alloc(4); readSync(fd, ver1, 0, 4, pos); pos += 4;
  const extraSzBuf = Buffer.alloc(4); readSync(fd, extraSzBuf, 0, 4, pos); pos += 4;
  const extraHeaderSize = extraSzBuf.readUInt32LE(0);
  if (extraHeaderSize > 0) pos += extraHeaderSize;

  const fcBuf = Buffer.alloc(4); readSync(fd, fcBuf, 0, 4, pos); pos += 4;
  const fileCount = fcBuf.readUInt32LE(0);
  const entries = [];
  for (let i = 0; i < fileCount; i++) {
    const nl = Buffer.alloc(4); readSync(fd, nl, 0, 4, pos); pos += 4;
    const nameLen = nl.readUInt32LE(0);
    const nb = Buffer.alloc(nameLen); readSync(fd, nb, 0, nameLen, pos); pos += nameLen;
    const mb = Buffer.alloc(16); readSync(fd, mb, 0, 16, pos); pos += 16;
    entries.push({
      name: nb.toString('ascii'), nameLen,
      size: Number(mb.readBigUInt64LE(0)),
      offset: Number(mb.readBigUInt64LE(8))
    });
  }
  const afterFileEntries = pos;

  // Read dir table raw
  const dcBuf = Buffer.alloc(4); readSync(fd, dcBuf, 0, 4, pos); pos += 4;
  const dirCount = dcBuf.readUInt32LE(0);
  for (let d = 0; d < dirCount; d++) {
    const nl = Buffer.alloc(4); readSync(fd, nl, 0, 4, pos); pos += 4;
    pos += nl.readUInt32LE(0);
    const ec = Buffer.alloc(4); readSync(fd, ec, 0, 4, pos); pos += 4;
    for (let e = 0; e < ec.readUInt32LE(0); e++) {
      const enl = Buffer.alloc(4); readSync(fd, enl, 0, 4, pos); pos += 4;
      pos += enl.readUInt32LE(0) + 1;
    }
  }
  const dataStart = pos;
  const dirTableRaw = Buffer.alloc(dataStart - afterFileEntries);
  readSync(fd, dirTableRaw, 0, dirTableRaw.length, afterFileEntries);

  return { fd, entries, dataStart, dirTableRaw, dirCount };
}

function readFileData(fd, dataStart, entry) {
  const buf = Buffer.alloc(entry.size);
  readSync(fd, buf, 0, entry.size, dataStart + entry.offset);
  return buf;
}

// ========== WORD WRAP ==========

/**
 * Word-wrap testo italiano a ~52 caratteri per riga.
 * Il gioco di Danganronpa usa \n per i ritorni a capo nel text box.
 */
function wordWrap(text, maxChars = 52) {
  // Don't wrap if already short enough or has manual line breaks
  if (text.length <= maxChars) return text;
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxChars && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.join('\n');
}

// ========== UTF-16LE DECODE ==========

function decodeUTF16LE(buf, start, end) {
  let text = '';
  for (let j = start; j < end - 1; j += 2) {
    const c = buf[j] | (buf[j+1] << 8);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  return text;
}

// ========== LIN TEXT SECTION REBUILD ==========

/**
 * Ricostruisce il text section di un file .lin dopo modifica del testo.
 * Usa string-level matching con CLT tag stripping per trovare le traduzioni.
 * 
 * Formato .lin Type 2:
 *   Header: type(u32) + hdrBlockSize(u32) + textBlockOffset(u32) + ...
 *   Commands: opcodes fino a textBlockOffset
 *   Text Section (a textBlockOffset):
 *     textEntryCount(u32) + offsets[count](u32) + text entries (BOM + UTF-16LE + null)
 */
function patchLinData(linData, searchPatterns, normalizedMap) {
  if (linData.length < 16) return { data: linData, count: 0 };
  
  const linType = linData.readUInt32LE(0);
  if (linType !== 1 && linType !== 2) return { data: linData, count: 0 };
  
  const textBlockOffset = linData.readUInt32LE(8);
  if (textBlockOffset >= linData.length || textBlockOffset < 12) return { data: linData, count: 0 };
  
  const textBlock = linData.subarray(textBlockOffset);
  if (textBlock.length < 8) return { data: linData, count: 0 };
  
  const textEntryCount = textBlock.readUInt32LE(0);
  if (textEntryCount === 0 || textEntryCount > 5000) return { data: linData, count: 0 };
  
  const headerSize = 4 + textEntryCount * 4;
  if (headerSize >= textBlock.length) return { data: linData, count: 0 };
  
  // Read text entry offsets (relative to start of text block)
  const origOffsets = [];
  for (let i = 0; i < textEntryCount; i++) {
    const off = textBlock.readUInt32LE(4 + i * 4);
    if (off >= textBlock.length) return { data: linData, count: 0 };
    origOffsets.push(off);
  }
  
  // Extract and patch text entries using STRING-LEVEL matching
  let totalCount = 0;
  let anyModified = false;
  const textEntries = [];
  
  for (let i = 0; i < textEntryCount; i++) {
    const start = origOffsets[i];
    const end = (i + 1 < textEntryCount) ? origOffsets[i + 1] : textBlock.length;
    let entry = Buffer.from(textBlock.subarray(start, end));
    
    let entryMatched = false;
    
    if (entry.length >= 4 && normalizedMap) {
      // Decode text entry
      const hasBOM = entry[0] === 0xFF && entry[1] === 0xFE;
      const textStart = hasBOM ? 2 : 0;
      const rawText = decodeUTF16LE(entry, textStart, entry.length);
      
      if (rawText.length >= 3) {
        // Strip CLT tags and normalize for matching
        const cleanText = rawText.replace(/<CLT[^>]*>/g, '').replace(/\n/g, ' ').trim();
        
        // Look up translation
        const translated = normalizedMap.get(cleanText);
        if (translated) {
          // Extract leading/trailing CLT tags from original
          const leadingMatch = rawText.match(/^(<CLT[^>]*>)/);
          const trailingMatch = rawText.match(/(<CLT>)\s*$/);
          
          // Build replacement with CLT wrapper + word-wrapped Italian text
          let newText = '';
          if (leadingMatch) newText += leadingMatch[1];
          newText += wordWrap(translated);
          if (trailingMatch) newText += trailingMatch[1];
          newText += '\n'; // trailing newline as in original
          
          // Re-encode to UTF-16LE with BOM and null terminator
          const parts = [];
          if (hasBOM) parts.push(Buffer.from([0xFF, 0xFE]));
          parts.push(toUTF16LE(newText));
          parts.push(Buffer.from([0x00, 0x00])); // null terminator
          entry = Buffer.concat(parts);
          totalCount++;
          anyModified = true;
          entryMatched = true;
        }
      }
    }
    
    // Fallback: byte-level matching for entries not matched by string-level
    if (!entryMatched && entry.length >= 4) {
      for (const p of searchPatterns) {
        const normEntry = normalizeLE(entry);
        const result = replaceInBuffer(entry, normEntry, p.search, p.replace);
        if (result) {
          entry = result.newBuf;
          totalCount += result.count;
          anyModified = true;
        }
      }
    }
    
    textEntries.push(entry);
  }
  
  if (!anyModified) return { data: linData, count: 0 };
  
  // Rebuild text section with new offsets
  const newHeaderSize = 4 + textEntryCount * 4;
  let totalTextSize = newHeaderSize;
  for (const e of textEntries) totalTextSize += e.length;
  
  const newTextBlock = Buffer.alloc(totalTextSize);
  newTextBlock.writeUInt32LE(textEntryCount, 0);
  let curOff = newHeaderSize;
  for (let i = 0; i < textEntryCount; i++) {
    newTextBlock.writeUInt32LE(curOff, 4 + i * 4);
    textEntries[i].copy(newTextBlock, curOff);
    curOff += textEntries[i].length;
  }
  
  // Rebuild complete .lin: command section + new text section
  const commandSection = linData.subarray(0, textBlockOffset);
  const newLin = Buffer.concat([commandSection, newTextBlock]);
  
  return { data: newLin, count: totalCount };
}

// ========== PAK PATCHING ==========

/**
 * Patcha un PAK file. Per ogni entry:
 * - Se è un .lin (header type 1 o 2): usa patchLinData per rebuild corretto
 * - Se ha BOM (text entry puro): replace libero
 * - Altrimenti: replace solo a dimensione fissa
 * Poi ricostruisce gli offset del PAK.
 */
function patchPakContent(data, searchPatterns, normalizedMap) {
  let totalCount = 0;
  if (data.length < 8) return { data, count: 0 };
  
  const fileCount = data.readUInt32LE(0);
  const headerSize = 4 + fileCount * 4;
  if (fileCount === 0 || fileCount > 10000 || headerSize >= data.length) {
    return { data, count: 0 };
  }

  const offsets = [];
  for (let i = 0; i < fileCount; i++) {
    const off = data.readUInt32LE(4 + i * 4);
    if (off >= data.length) return { data, count: 0 };
    offsets.push(off);
  }

  const entries = [];
  let anyModified = false;
  
  for (let i = 0; i < fileCount; i++) {
    const start = offsets[i];
    const end = (i + 1 < fileCount) ? offsets[i + 1] : data.length;
    let entry = Buffer.from(data.subarray(start, end));
    
    if (entry.length >= 16) {
      // Check if this entry is a .lin file (Type 1 or 2)
      const possibleType = entry.readUInt32LE(0);
      const possibleTextOff = entry.length >= 12 ? entry.readUInt32LE(8) : 0;
      
      if ((possibleType === 1 || possibleType === 2) && 
          possibleTextOff > 12 && possibleTextOff < entry.length) {
        // This looks like a .lin file — use proper LIN text section rebuild
        const result = patchLinData(entry, searchPatterns, normalizedMap);
        if (result.count > 0) {
          entry = result.data;
          totalCount += result.count;
          anyModified = true;
        }
      } else if (entry[0] === 0xFF && entry[1] === 0xFE) {
        // BOM entry (pure text) — free-size replace
        for (const p of searchPatterns) {
          const normEntry = normalizeLE(entry);
          const result = replaceInBuffer(entry, normEntry, p.search, p.replace);
          if (result) {
            entry = result.newBuf;
            totalCount += result.count;
            anyModified = true;
          }
        }
      }
      // Other entry types: skip (binary data, images, etc.)
    } else if (entry.length >= 4 && entry[0] === 0xFF && entry[1] === 0xFE) {
      // Small BOM entry
      for (const p of searchPatterns) {
        const normEntry = normalizeLE(entry);
        const result = replaceInBuffer(entry, normEntry, p.search, p.replace);
        if (result) {
          entry = result.newBuf;
          totalCount += result.count;
          anyModified = true;
        }
      }
    }
    
    entries.push(entry);
  }

  if (anyModified) {
    const newHeaderSize = 4 + fileCount * 4;
    let totalSize = newHeaderSize;
    for (const e of entries) totalSize += e.length;
    const newPak = Buffer.alloc(totalSize);
    newPak.writeUInt32LE(fileCount, 0);
    let curOff = newHeaderSize;
    for (let i = 0; i < fileCount; i++) {
      newPak.writeUInt32LE(curOff, 4 + i * 4);
      entries[i].copy(newPak, curOff);
      curOff += entries[i].length;
    }
    return { data: newPak, count: totalCount };
  }
  return { data, count: 0 };
}

/**
 * Patcha un file .lin standalone
 */
function patchStandaloneLin(data, searchPatterns, normalizedMap) {
  return patchLinData(data, searchPatterns, normalizedMap);
}

// ============================================================
console.log('🎮 Danganronpa WAD Patcher v14 (keyboard WAD + LIN rebuild)');
console.log('='.repeat(55));

// 1. Backup keyboard WAD
if (!existsSync(KB_WAD_BACKUP)) {
  console.log('💾 Backup keyboard WAD...');
  copyFileSync(KB_WAD_PATH, KB_WAD_BACKUP);
}

// 2. Load translations (WITH accents — Italian font supports them!)
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const transMap = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!transMap.has(t.original)) transMap.set(t.original, t.translated);
}
const sorted = [...transMap.entries()].sort((a, b) => b[0].length - a[0].length);
const searchPatterns = sorted.map(([o, t]) => ({ search: toUTF16LE(o), replace: toUTF16LE(t) }));
console.log(`   ${sorted.length} stringhe uniche (accenti preservati!)`);

// Build normalized lookup map for CLT-stripped .lin matching
const normalizedMap = new Map();
for (const [original, translated] of transMap) {
  const normalized = original.replace(/\n/g, ' ').trim();
  if (!normalizedMap.has(normalized)) normalizedMap.set(normalized, translated);
}
console.log(`   ${normalizedMap.size} stringhe normalizzate per matching .lin`);

// 3. Parse main WAD
console.log('📦 Parsing main WAD...');
const mainWad = parseWad(MAIN_WAD_PATH);
console.log(`   ${mainWad.entries.length} file, dataStart=${mainWad.dataStart}`);

// 4. Parse keyboard WAD
console.log('📦 Parsing keyboard WAD originale...');
const kbWad = parseWad(KB_WAD_BACKUP);
console.log(`   ${kbWad.entries.length} file originali`);

// 5. Extract font from All-Ice WAD
console.log('🔤 Estrazione font italiano da All-Ice Team...');
const alliceWad = parseWad(ALLICE_WAD);
const fontEntries = alliceWad.entries.filter(e => e.name.includes('/font/'));
const fontFiles = [];
for (const fe of fontEntries) {
  const data = readFileData(alliceWad.fd, alliceWad.dataStart, fe);
  fontFiles.push({ name: fe.name, data });
  console.log(`   Font: ${fe.name} (${(data.length / 1024).toFixed(0)} KB)`);
}
// Also get the All-Ice directory table (proven to work with ~2000 files)
const alliceDirTable = alliceWad.dirTableRaw;
console.log(`   Dir table All-Ice: ${alliceDirTable.length} bytes (${alliceWad.dirCount} dirs)`);
closeSync(alliceWad.fd);

// 6. Read original keyboard WAD files
console.log('📂 Lettura file keyboard originali...');
const kbOriginalFiles = [];
for (const entry of kbWad.entries) {
  const data = readFileData(kbWad.fd, kbWad.dataStart, entry);
  kbOriginalFiles.push({ name: entry.name, data });
}
closeSync(kbWad.fd);

// 7. Read and patch script files from main WAD
console.log('🔧 Patching script dal main WAD (con LIN rebuild)...');
const scriptFiles = mainWad.entries.filter(e => 
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);

let totalPatched = 0, filesModified = 0, pakRebuilt = 0, linRebuilt = 0;
const patchedScriptFiles = [];

for (let i = 0; i < scriptFiles.length; i++) {
  const entry = scriptFiles[i];
  const origData = readFileData(mainWad.fd, mainWad.dataStart, entry);
  
  let result;
  if (entry.name.endsWith('.pak')) {
    result = patchPakContent(origData, searchPatterns, normalizedMap);
    if (result.count > 0 && result.data.length !== origData.length) pakRebuilt++;
  } else {
    result = patchStandaloneLin(origData, searchPatterns, normalizedMap);
    if (result.count > 0) linRebuilt++;
  }
  
  if (result.count > 0) {
    totalPatched += result.count;
    filesModified++;
  }
  
  patchedScriptFiles.push({ name: entry.name, data: result.data });
  
  if ((i + 1) % 200 === 0) {
    process.stdout.write(`\r   ${i+1}/${scriptFiles.length} | ${totalPatched} match | ${linRebuilt} LIN rebuild`);
  }
}
closeSync(mainWad.fd);
console.log(`\r   ${scriptFiles.length}/${scriptFiles.length} | ${totalPatched} match | ${pakRebuilt} PAK + ${linRebuilt} LIN rebuild`);

// 8. Combine all files
console.log('📝 Costruzione nuovo keyboard WAD...');
const allFiles = new Map();

for (const f of kbOriginalFiles) allFiles.set(f.name, f.data);
for (const f of patchedScriptFiles) allFiles.set(f.name, f.data);
for (const f of fontFiles) allFiles.set(f.name, f.data);

const fileList = [...allFiles.entries()].map(([name, data]) => ({ name, data }));
console.log(`   ${fileList.length} file totali`);

// 9. Write new keyboard WAD
const ws = createWriteStream(KB_WAD_NEW);

// AGAR header (same as original)
ws.write(Buffer.from('AGAR'));
const verBuf = Buffer.alloc(12);
verBuf.writeUInt32LE(1, 0);
verBuf.writeUInt32LE(1, 4);
verBuf.writeUInt32LE(0, 8);
ws.write(verBuf);

// File count
const fcOut = Buffer.alloc(4);
fcOut.writeUInt32LE(fileList.length, 0);
ws.write(fcOut);

// File entries with calculated offsets
let relOffset = 0;
for (const f of fileList) {
  const nameBuf = Buffer.from(f.name, 'ascii');
  const nl = Buffer.alloc(4);
  nl.writeUInt32LE(nameBuf.length, 0);
  ws.write(nl);
  ws.write(nameBuf);
  const mb = Buffer.alloc(16);
  mb.writeBigUInt64LE(BigInt(f.data.length), 0);
  mb.writeBigUInt64LE(BigInt(relOffset), 8);
  ws.write(mb);
  relOffset += f.data.length;
}

// Directory table from All-Ice (proven correct structure)
ws.write(alliceDirTable);

// File data
let written = 0;
for (const f of fileList) {
  ws.write(f.data);
  written++;
  if (written % 500 === 0) {
    process.stdout.write(`\r   ${written}/${fileList.length} file scritti`);
  }
}

await new Promise((resolve, reject) => {
  ws.on('finish', resolve);
  ws.on('error', reject);
  ws.end();
});
console.log(`\r   ${fileList.length}/${fileList.length} file scritti`);

// 10. Replace keyboard WAD
if (existsSync(KB_WAD_PATH)) unlinkSync(KB_WAD_PATH);
renameSync(KB_WAD_NEW, KB_WAD_PATH);

const newSize = statSync(KB_WAD_PATH).size;
const oldSize = statSync(KB_WAD_BACKUP).size;

console.log('');
console.log('='.repeat(55));
console.log(`✅ KEYBOARD WAD PATCHATO v14`);
console.log(`   File totali: ${fileList.length}`);
console.log(`   Script patchati: ${filesModified}`);
console.log(`   Stringhe sostituite: ${totalPatched}`);
console.log(`   PAK ricostruiti: ${pakRebuilt}`);
console.log(`   LIN ricostruiti: ${linRebuilt}`);
console.log(`   Font italiano: ${fontFiles.length} file da All-Ice`);
console.log(`   Dir table: All-Ice (${alliceDirTable.length} bytes, ${alliceWad.dirCount} dirs)`);
console.log(`   WAD: ${(newSize / (1024*1024)).toFixed(1)} MB (era ${(oldSize / (1024*1024)).toFixed(1)} MB)`);
console.log('');
console.log('🎮 Avvia Danganronpa → Seleziona "Keyboard and Mouse" in Control Hints!');
