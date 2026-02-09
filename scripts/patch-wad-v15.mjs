/**
 * Danganronpa WAD Patcher v15 — All-Ice Base + GameStringer Override
 * 
 * Strategia:
 * 1. Usa il WAD All-Ice come BASE COMPLETA (626 MB, 2000 file, tutto italiano)
 * 2. Legge i file script dal main WAD originale (inglese)
 * 3. Applica le traduzioni GameStringer dove disponibili
 * 4. Dove GameStringer ha traduzioni → usa la nostra versione
 * 5. Dove NON le ha → mantiene la versione All-Ice (già in italiano)
 * 6. Risultato: 100% italiano (All-Ice base + GameStringer custom)
 */

import { readFileSync, openSync, readSync, closeSync, existsSync,
         statSync, createWriteStream, copyFileSync, renameSync, unlinkSync, writeSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const KB_WAD_PATH = join(GAME_PATH, 'dr1_data_keyboard_us.wad');
const KB_WAD_BACKUP = join(GAME_PATH, 'dr1_data_keyboard_us.wad.backup');
const KB_WAD_NEW = join(GAME_PATH, 'dr1_data_keyboard_us.wad.new');
const MAIN_WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad.backup');
const ALLICE_WAD = 'C:\\Users\\rouges\\Downloads\\DR1 - PATCH ITA - STEAM [All-Ice Team]\\DR1 - PATCH ITA - STEAM [All-Ice Team]\\dr1_data_keyboard_us.wad';
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');

// ========== HELPERS ==========

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

function decodeUTF16LE(buf, start, end) {
  let text = '';
  for (let j = start; j < end - 1; j += 2) {
    const c = buf[j] | (buf[j+1] << 8);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  return text;
}

function wordWrap(text, maxChars = 52) {
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

// ========== WAD PARSING ==========

function parseWad(path) {
  const fd = openSync(path, 'r');
  let pos = 0;
  const magic = Buffer.alloc(4); readSync(fd, magic, 0, 4, pos); pos += 4;
  const ver0 = Buffer.alloc(4); readSync(fd, ver0, 0, 4, pos); pos += 4;
  const ver1 = Buffer.alloc(4); readSync(fd, ver1, 0, 4, pos); pos += 4;
  const extraSzBuf = Buffer.alloc(4); readSync(fd, extraSzBuf, 0, 4, pos); pos += 4;
  const extraHeaderSize = extraSzBuf.readUInt32LE(0);
  if (extraHeaderSize > 0) pos += extraHeaderSize;
  const headerEnd = pos; // where file count starts

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

  // Read dir table raw bytes
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

  return { fd, entries, dataStart, dirTableRaw, dirCount, headerEnd };
}

function readFileData(fd, dataStart, entry) {
  const buf = Buffer.alloc(entry.size);
  readSync(fd, buf, 0, entry.size, dataStart + entry.offset);
  return buf;
}

// ========== LIN PATCHING (string-level with CLT strip) ==========

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

  const origOffsets = [];
  for (let i = 0; i < textEntryCount; i++) {
    const off = textBlock.readUInt32LE(4 + i * 4);
    if (off >= textBlock.length) return { data: linData, count: 0 };
    origOffsets.push(off);
  }

  let totalCount = 0;
  let anyModified = false;
  const textEntries = [];

  for (let i = 0; i < textEntryCount; i++) {
    const start = origOffsets[i];
    const end = (i + 1 < textEntryCount) ? origOffsets[i + 1] : textBlock.length;
    let entry = Buffer.from(textBlock.subarray(start, end));
    let entryMatched = false;

    if (entry.length >= 4 && normalizedMap) {
      const hasBOM = entry[0] === 0xFF && entry[1] === 0xFE;
      const textStart = hasBOM ? 2 : 0;
      const rawText = decodeUTF16LE(entry, textStart, entry.length);

      if (rawText.length >= 3) {
        const cleanText = rawText.replace(/<CLT[^>]*>/g, '').replace(/\n/g, ' ').trim();
        const translated = normalizedMap.get(cleanText);
        if (translated) {
          const leadingMatch = rawText.match(/^(<CLT[^>]*>)/);
          const trailingMatch = rawText.match(/(<CLT>)\s*$/);
          let newText = '';
          if (leadingMatch) newText += leadingMatch[1];
          newText += wordWrap(translated);
          if (trailingMatch) newText += trailingMatch[1];
          newText += '\n';
          const parts = [];
          if (hasBOM) parts.push(Buffer.from([0xFF, 0xFE]));
          parts.push(toUTF16LE(newText));
          parts.push(Buffer.from([0x00, 0x00]));
          entry = Buffer.concat(parts);
          totalCount++;
          anyModified = true;
          entryMatched = true;
        }
      }
    }

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
  const commandSection = linData.subarray(0, textBlockOffset);
  return { data: Buffer.concat([commandSection, newTextBlock]), count: totalCount };
}

// ========== PAK PATCHING ==========

function patchPakContent(data, searchPatterns, normalizedMap) {
  let totalCount = 0;
  if (data.length < 8) return { data, count: 0 };
  const fileCount = data.readUInt32LE(0);
  const headerSize = 4 + fileCount * 4;
  if (fileCount === 0 || fileCount > 10000 || headerSize >= data.length) return { data, count: 0 };

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
      const possibleType = entry.readUInt32LE(0);
      const possibleTextOff = entry.length >= 12 ? entry.readUInt32LE(8) : 0;
      if ((possibleType === 1 || possibleType === 2) &&
          possibleTextOff > 12 && possibleTextOff < entry.length) {
        const result = patchLinData(entry, searchPatterns, normalizedMap);
        if (result.count > 0) {
          entry = result.data;
          totalCount += result.count;
          anyModified = true;
        }
      } else if (entry[0] === 0xFF && entry[1] === 0xFE) {
        for (const p of searchPatterns) {
          const normEntry = normalizeLE(entry);
          const result = replaceInBuffer(entry, normEntry, p.search, p.replace);
          if (result) { entry = result.newBuf; totalCount += result.count; anyModified = true; }
        }
      }
    } else if (entry.length >= 4 && entry[0] === 0xFF && entry[1] === 0xFE) {
      for (const p of searchPatterns) {
        const normEntry = normalizeLE(entry);
        const result = replaceInBuffer(entry, normEntry, p.search, p.replace);
        if (result) { entry = result.newBuf; totalCount += result.count; anyModified = true; }
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

// ============================================================
console.log('🎮 Danganronpa WAD Patcher v15 (All-Ice Base + GameStringer Override)');
console.log('='.repeat(60));

// 1. Backup
if (!existsSync(KB_WAD_BACKUP)) {
  console.log('💾 Backup keyboard WAD...');
  copyFileSync(KB_WAD_PATH, KB_WAD_BACKUP);
}

// 2. Load translations
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const transMap = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!transMap.has(t.original)) transMap.set(t.original, t.translated);
}
const sorted = [...transMap.entries()].sort((a, b) => b[0].length - a[0].length);
const searchPatterns = sorted.map(([o, t]) => ({ search: toUTF16LE(o), replace: toUTF16LE(t) }));
const normalizedMap = new Map();
for (const [original, translated] of transMap) {
  const normalized = original.replace(/\n/g, ' ').trim();
  if (!normalizedMap.has(normalized)) normalizedMap.set(normalized, translated);
}
console.log(`   ${sorted.length} stringhe GameStringer`);

// 3. Parse All-Ice WAD (base completa italiana)
console.log('📦 Parsing All-Ice WAD (base italiana)...');
const alliceWad = parseWad(ALLICE_WAD);
console.log(`   ${alliceWad.entries.length} file (${(statSync(ALLICE_WAD).size / (1024*1024)).toFixed(0)} MB)`);

// 4. Parse main WAD (sorgente testo inglese)
console.log('📦 Parsing main WAD (sorgente inglese)...');
const mainWad = parseWad(MAIN_WAD_PATH);
console.log(`   ${mainWad.entries.length} file`);

// 5. Patch script files from main WAD with GameStringer translations
console.log('🔧 Patching script con traduzioni GameStringer...');
const scriptFiles = mainWad.entries.filter(e =>
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);

const patchedScripts = new Map(); // name → patched data
let totalPatched = 0, filesModified = 0;

for (let i = 0; i < scriptFiles.length; i++) {
  const entry = scriptFiles[i];
  const origData = readFileData(mainWad.fd, mainWad.dataStart, entry);

  let result;
  if (entry.name.endsWith('.pak')) {
    result = patchPakContent(origData, searchPatterns, normalizedMap);
  } else {
    result = patchLinData(origData, searchPatterns, normalizedMap);
  }

  if (result.count > 0) {
    patchedScripts.set(entry.name, result.data);
    totalPatched += result.count;
    filesModified++;
  }

  if ((i + 1) % 500 === 0) {
    process.stdout.write(`\r   ${i+1}/${scriptFiles.length} | ${totalPatched} match | ${filesModified} file modificati`);
  }
}
closeSync(mainWad.fd);
console.log(`\r   ${scriptFiles.length} analizzati | ${totalPatched} match | ${filesModified} file con traduzioni GameStringer`);

// 6. Build file list: All-Ice base + GameStringer overrides
console.log('📝 Costruzione file list...');
const alliceMap = new Map();
for (const e of alliceWad.entries) {
  alliceMap.set(e.name, e);
}

// File list = All-Ice files, but swap script files where we have patches
const finalFiles = [];
let gsOverrides = 0;
let alliceKept = 0;

for (const alliceEntry of alliceWad.entries) {
  if (patchedScripts.has(alliceEntry.name)) {
    // Use GameStringer patched version instead of All-Ice
    const patchedData = patchedScripts.get(alliceEntry.name);
    finalFiles.push({ name: alliceEntry.name, data: patchedData, source: 'gs' });
    gsOverrides++;
  } else {
    // Keep All-Ice version (read from WAD on demand)
    finalFiles.push({ name: alliceEntry.name, alliceEntry, source: 'allice' });
    alliceKept++;
  }
}

// Add any script files that are in main WAD but NOT in All-Ice WAD
// (with GameStringer translations applied)
for (const [name, data] of patchedScripts) {
  if (!alliceMap.has(name)) {
    finalFiles.push({ name, data, source: 'gs-new' });
    gsOverrides++;
  }
}

console.log(`   ${finalFiles.length} file totali`);
console.log(`   ${gsOverrides} con traduzioni GameStringer`);
console.log(`   ${alliceKept} da All-Ice (italiano originale)`);

// 7. Write new keyboard WAD (streaming to handle 626+ MB)
console.log('💾 Scrittura nuovo keyboard WAD (streaming)...');

// Calculate sizes first
const fileSizes = [];
for (const f of finalFiles) {
  if (f.data) {
    fileSizes.push(f.data.length);
  } else {
    fileSizes.push(f.alliceEntry.size);
  }
}

// Open output file with sync writes for reliability
const outFd = openSync(KB_WAD_NEW, 'w');
let writePos = 0;

function syncWrite(buf) {
  writeSync(outFd, buf, 0, buf.length, writePos);
  writePos += buf.length;
}

// AGAR header
syncWrite(Buffer.from('AGAR'));
const verBuf = Buffer.alloc(12);
verBuf.writeUInt32LE(1, 0);
verBuf.writeUInt32LE(1, 4);
verBuf.writeUInt32LE(0, 8);
syncWrite(verBuf);

// File count
const fcBuf = Buffer.alloc(4);
fcBuf.writeUInt32LE(finalFiles.length, 0);
syncWrite(fcBuf);

// File entries with offsets
let relOffset = 0;
for (let i = 0; i < finalFiles.length; i++) {
  const f = finalFiles[i];
  const nameBuf = Buffer.from(f.name, 'ascii');
  const nl = Buffer.alloc(4);
  nl.writeUInt32LE(nameBuf.length, 0);
  syncWrite(nl);
  syncWrite(nameBuf);
  const mb = Buffer.alloc(16);
  mb.writeBigUInt64LE(BigInt(fileSizes[i]), 0);
  mb.writeBigUInt64LE(BigInt(relOffset), 8);
  syncWrite(mb);
  relOffset += fileSizes[i];
}

// Directory table from All-Ice (proven correct)
syncWrite(alliceWad.dirTableRaw);

// File data (streaming: read one file at a time from All-Ice WAD)
let written = 0;
for (let i = 0; i < finalFiles.length; i++) {
  const f = finalFiles[i];
  if (f.data) {
    syncWrite(f.data);
  } else {
    // Read from All-Ice WAD
    const data = readFileData(alliceWad.fd, alliceWad.dataStart, f.alliceEntry);
    syncWrite(data);
  }
  written++;
  if (written % 200 === 0) {
    const mb = (writePos / (1024 * 1024)).toFixed(0);
    process.stdout.write(`\r   ${written}/${finalFiles.length} file (${mb} MB)`);
  }
}
closeSync(alliceWad.fd);
closeSync(outFd);

const finalMB = (writePos / (1024 * 1024)).toFixed(1);
console.log(`\r   ${finalFiles.length}/${finalFiles.length} file (${finalMB} MB)            `);

// 8. Replace keyboard WAD
if (existsSync(KB_WAD_PATH)) unlinkSync(KB_WAD_PATH);
renameSync(KB_WAD_NEW, KB_WAD_PATH);

console.log('');
console.log('='.repeat(60));
console.log('✅ KEYBOARD WAD PATCHATO v15 (All-Ice + GameStringer)');
console.log(`   File totali: ${finalFiles.length}`);
console.log(`   All-Ice italiano: ${alliceKept} file`);
console.log(`   GameStringer override: ${gsOverrides} file (${totalPatched} stringhe)`);
console.log(`   WAD finale: ${finalMB} MB`);
console.log('');
console.log('🎮 Avvia Danganronpa → Seleziona "Keyboard and Mouse" in Control Hints!');
console.log('   Tutto il testo sarà in italiano (All-Ice base + tue traduzioni)');
