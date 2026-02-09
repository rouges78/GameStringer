/**
 * Danganronpa WAD Patcher v13 — Keyboard WAD Approach
 * 
 * Stesso approccio dell'All-Ice Team:
 * 1. Prende il keyboard WAD originale (29 file, 73MB)
 * 2. Legge i file script dal main WAD e li patcha con le traduzioni
 * 3. Estrae il font italiano dal WAD All-Ice (supporto accenti è,à,ì,ù,ò)
 * 4. Costruisce un nuovo keyboard WAD con tutti i file
 * 5. Il gioco carica il keyboard WAD quando si seleziona "Keyboard and Mouse"
 */

import { readFileSync, openSync, readSync, closeSync, existsSync,
         statSync, createWriteStream, copyFileSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const KB_WAD_PATH = join(GAME_PATH, 'dr1_data_keyboard_us.wad');
const KB_WAD_BACKUP = join(GAME_PATH, 'dr1_data_keyboard_us.wad.backup');
const KB_WAD_NEW = join(GAME_PATH, 'dr1_data_keyboard_us.wad.new');
const MAIN_WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad.backup'); // usa backup del main WAD
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
 * Parse WAD completo (header + file entries + dir table)
 */
function parseWad(path) {
  const fd = openSync(path, 'r');
  let pos = 0;

  // AGAR header
  const magic = Buffer.alloc(4); readSync(fd, magic, 0, 4, pos); pos += 4;
  const ver0 = Buffer.alloc(4); readSync(fd, ver0, 0, 4, pos); pos += 4;
  const ver1 = Buffer.alloc(4); readSync(fd, ver1, 0, 4, pos); pos += 4;
  const extraSzBuf = Buffer.alloc(4); readSync(fd, extraSzBuf, 0, 4, pos); pos += 4;
  const extraHeaderSize = extraSzBuf.readUInt32LE(0);
  let extraHeader = Buffer.alloc(0);
  if (extraHeaderSize > 0) {
    extraHeader = Buffer.alloc(extraHeaderSize);
    readSync(fd, extraHeader, 0, extraHeaderSize, pos);
    pos += extraHeaderSize;
  }

  // File entries
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

  // Directory table
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

  return { fd, magic, ver0, ver1, extraSzBuf, extraHeader, extraHeaderSize, 
           fileCount, entries, afterFileEntries, dirCount, dirTableRaw, dataStart };
}

/**
 * Legge i dati di un file dal WAD
 */
function readFileData(fd, dataStart, entry) {
  const buf = Buffer.alloc(entry.size);
  readSync(fd, buf, 0, entry.size, dataStart + entry.offset);
  return buf;
}

/**
 * Patcha il contenuto di un PAK file (ricostruisce offset interni)
 */
function patchPakContent(data, searchPatterns) {
  let totalCount = 0;
  if (data.length < 8) return { data, count: 0 };
  
  const fileCount = data.readUInt32LE(0);
  const headerSize = 4 + fileCount * 4;
  if (fileCount === 0 || fileCount > 10000 || headerSize >= data.length) {
    return { data, count: 0 };
  }

  const offsets = [];
  let validPak = true;
  for (let i = 0; i < fileCount; i++) {
    const off = data.readUInt32LE(4 + i * 4);
    if (off >= data.length) { validPak = false; break; }
    offsets.push(off);
  }
  if (!validPak) return { data, count: 0 };

  const entries = [];
  let anyModified = false;
  for (let i = 0; i < fileCount; i++) {
    const start = offsets[i];
    const end = (i + 1 < fileCount) ? offsets[i + 1] : data.length;
    let entry = Buffer.from(data.subarray(start, end));
    
    if (entry.length >= 8) {
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
 * Patcha un file .lin standalone (search & replace diretto)
 */
function patchLinContent(data, searchPatterns) {
  let totalCount = 0;
  let modData = Buffer.from(data);
  for (const p of searchPatterns) {
    if (p.search.length < 10) continue;
    const normData = normalizeLE(modData);
    const result = replaceInBuffer(modData, normData, p.search, p.replace);
    if (result) {
      modData = result.newBuf;
      totalCount += result.count;
    }
  }
  return { data: modData, count: totalCount };
}

/**
 * Costruisce la directory table per il nuovo WAD
 */
function buildDirTable(fileEntries) {
  // Costruisci albero directory dai path dei file
  const dirs = new Map(); // path -> Set di {name, type}
  
  for (const entry of fileEntries) {
    const parts = entry.name.replace(/\\/g, '/').split('/');
    // Registra ogni directory nel percorso
    for (let i = 0; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/');
      const childName = parts[i];
      const isFile = (i === parts.length - 1);
      
      if (!dirs.has(dirPath)) dirs.set(dirPath, new Map());
      const dir = dirs.get(dirPath);
      if (!dir.has(childName)) {
        dir.set(childName, isFile ? 0 : 1); // 0=file, 1=directory
      }
    }
  }
  
  // Serializza
  const parts = [];
  const dirEntries = [...dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  
  // Dir count
  const dcBuf = Buffer.alloc(4);
  dcBuf.writeUInt32LE(dirEntries.length, 0);
  parts.push(dcBuf);
  
  for (const [dirPath, children] of dirEntries) {
    // Dir name
    const pathBuf = Buffer.from(dirPath, 'utf8');
    const nlBuf = Buffer.alloc(4);
    nlBuf.writeUInt32LE(pathBuf.length, 0);
    parts.push(nlBuf);
    if (pathBuf.length > 0) parts.push(pathBuf);
    
    // Entry count
    const ecBuf = Buffer.alloc(4);
    ecBuf.writeUInt32LE(children.size, 0);
    parts.push(ecBuf);
    
    // Entries
    for (const [childName, childType] of [...children.entries()].sort()) {
      const cnBuf = Buffer.from(childName, 'utf8');
      const cnlBuf = Buffer.alloc(4);
      cnlBuf.writeUInt32LE(cnBuf.length, 0);
      parts.push(cnlBuf);
      parts.push(cnBuf);
      parts.push(Buffer.from([childType]));
    }
  }
  
  return Buffer.concat(parts);
}

// ============================================================
console.log('🎮 Danganronpa WAD Patcher v13 (keyboard WAD approach)');
console.log('='.repeat(55));

// 1. Backup keyboard WAD
if (!existsSync(KB_WAD_BACKUP)) {
  console.log('💾 Backup keyboard WAD...');
  copyFileSync(KB_WAD_PATH, KB_WAD_BACKUP);
}

// 2. Carica traduzioni (CON accenti — il font All-Ice li supporta!)
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

// 3. Parse main WAD (sorgente dei file script)
console.log('📦 Parsing main WAD...');
const mainWad = parseWad(MAIN_WAD_PATH);
console.log(`   ${mainWad.fileCount} file, dataStart=${mainWad.dataStart}`);

// 4. Parse keyboard WAD originale
console.log('📦 Parsing keyboard WAD originale...');
const kbWad = parseWad(KB_WAD_BACKUP);
console.log(`   ${kbWad.fileCount} file originali`);

// 5. Estrai font dal WAD All-Ice
console.log('🔤 Estrazione font italiano da All-Ice Team...');
const alliceWad = parseWad(ALLICE_WAD);
const fontEntries = alliceWad.entries.filter(e => e.name.includes('/font/'));
const fontFiles = [];
for (const fe of fontEntries) {
  const data = readFileData(alliceWad.fd, alliceWad.dataStart, fe);
  fontFiles.push({ name: fe.name, data });
  console.log(`   Font: ${fe.name} (${(data.length / 1024).toFixed(0)} KB)`);
}
closeSync(alliceWad.fd);

// 6. Leggi file originali dal keyboard WAD
console.log('📂 Lettura file keyboard originali...');
const kbOriginalFiles = [];
for (const entry of kbWad.entries) {
  const data = readFileData(kbWad.fd, kbWad.dataStart, entry);
  kbOriginalFiles.push({ name: entry.name, data });
}
closeSync(kbWad.fd);

// 7. Leggi e patcha file script dal main WAD
console.log('🔧 Patching script dal main WAD...');
const scriptFiles = mainWad.entries.filter(e => 
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);

let totalPatched = 0, filesModified = 0, pakRebuilt = 0;
const patchedScriptFiles = [];

for (let i = 0; i < scriptFiles.length; i++) {
  const entry = scriptFiles[i];
  const origData = readFileData(mainWad.fd, mainWad.dataStart, entry);
  
  let result;
  if (entry.name.endsWith('.pak')) {
    result = patchPakContent(origData, searchPatterns);
    if (result.count > 0 && result.data.length !== origData.length) pakRebuilt++;
  } else {
    result = patchLinContent(origData, searchPatterns);
  }
  
  if (result.count > 0) {
    totalPatched += result.count;
    filesModified++;
  }
  
  // Aggiungi TUTTI i file script (anche non modificati, servono per override)
  patchedScriptFiles.push({ name: entry.name, data: result.data });
  
  if ((i + 1) % 200 === 0) {
    process.stdout.write(`\r   ${i+1}/${scriptFiles.length} | ${totalPatched} match`);
  }
}
closeSync(mainWad.fd);
console.log(`\r   ${scriptFiles.length}/${scriptFiles.length} | ${totalPatched} match | ${pakRebuilt} PAK ricostruiti`);

// 8. Combina tutti i file per il nuovo keyboard WAD
console.log('📝 Costruzione nuovo keyboard WAD...');
const allFiles = new Map();

// Prima: file originali del keyboard WAD
for (const f of kbOriginalFiles) {
  allFiles.set(f.name, f.data);
}

// Poi: file script patchati (override)
for (const f of patchedScriptFiles) {
  allFiles.set(f.name, f.data);
}

// Infine: font italiano da All-Ice
for (const f of fontFiles) {
  allFiles.set(f.name, f.data);
}

console.log(`   ${allFiles.size} file totali (${kbOriginalFiles.length} originali + ${patchedScriptFiles.length} script + ${fontFiles.length} font)`);

// 9. Scrivi nuovo keyboard WAD
const ws = createWriteStream(KB_WAD_NEW);
const fileList = [...allFiles.entries()].map(([name, data]) => ({ name, data }));

// AGAR header
ws.write(Buffer.from('AGAR'));
const verBuf = Buffer.alloc(12);
verBuf.writeUInt32LE(1, 0);  // version[0]
verBuf.writeUInt32LE(1, 4);  // version[1]
verBuf.writeUInt32LE(0, 8);  // extra_header_size
ws.write(verBuf);

// File count
const fcOut = Buffer.alloc(4);
fcOut.writeUInt32LE(fileList.length, 0);
ws.write(fcOut);

// File entries
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

// Directory table
const dirTable = buildDirTable(fileList);
ws.write(dirTable);

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

// 10. Sostituisci keyboard WAD
if (existsSync(KB_WAD_PATH)) unlinkSync(KB_WAD_PATH);
renameSync(KB_WAD_NEW, KB_WAD_PATH);

const newSize = statSync(KB_WAD_PATH).size;
const oldSize = statSync(KB_WAD_BACKUP).size;

console.log('');
console.log('='.repeat(55));
console.log(`✅ KEYBOARD WAD PATCHATO v13`);
console.log(`   File totali: ${fileList.length}`);
console.log(`   Script patchati: ${filesModified}`);
console.log(`   Stringhe sostituite: ${totalPatched}`);
console.log(`   PAK ricostruiti: ${pakRebuilt}`);
console.log(`   Font italiano: ${fontFiles.length} file da All-Ice Team`);
console.log(`   WAD: ${(newSize / (1024*1024)).toFixed(1)} MB (era ${(oldSize / (1024*1024)).toFixed(1)} MB)`);
console.log('');
console.log('🎮 Avvia Danganronpa → Seleziona "Keyboard and Mouse" in Control Hints!');
