/**
 * Danganronpa WAD Patcher v9 — Full Rebuild + Normalizzazione \n↔spazio
 * 
 * Strategia:
 * 1. Per ogni file nel WAD, crea copia normalizzata (UTF-16 \n → spazio)
 * 2. Cerca testi originali nella copia normalizzata (match esatto)
 * 3. Sostituisce nel buffer originale, ESPANDENDO se necessario
 * 4. Ricostruisce il WAD con offset aggiornati
 * 
 * Zero troncamenti.
 */

import { readFileSync, openSync, readSync, closeSync, existsSync, 
         statSync, createWriteStream, renameSync, unlinkSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
const WAD_NEW = join(GAME_PATH, 'dr1_data_us.wad.new');
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

function toUTF16BE(str) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    buf[i*2] = (c >> 8) & 0xFF;
    buf[i*2+1] = c & 0xFF;
  }
  return buf;
}

/** Normalizza buffer: sostituisci \n (0x0A) con spazio (0x20) in UTF-16LE */
function normalizeLE(buf) {
  const norm = Buffer.from(buf);
  for (let i = 0; i < norm.length - 1; i += 2) {
    if (norm[i] === 0x0A && norm[i+1] === 0x00) {
      norm[i] = 0x20; // space
    }
  }
  return norm;
}

/** Normalizza buffer: sostituisci \n con spazio in UTF-16BE */
function normalizeBE(buf) {
  const norm = Buffer.from(buf);
  for (let i = 0; i < norm.length - 1; i += 2) {
    if (norm[i] === 0x00 && norm[i+1] === 0x0A) {
      norm[i+1] = 0x20; // space
    }
  }
  return norm;
}

/**
 * Trova e sostituisce tutte le occorrenze nel buffer, permettendo espansione.
 * Usa il buffer normalizzato per cercare, ma opera sull'originale.
 * Restituisce { newBuf, count } o null.
 */
function findAndReplace(data, normData, searchBuf, replaceBuf) {
  const positions = [];
  let idx = normData.indexOf(searchBuf, 0);
  while (idx >= 0) {
    positions.push(idx);
    idx = normData.indexOf(searchBuf, idx + searchBuf.length);
  }
  
  if (positions.length === 0) return null;
  
  // Ricostruisci il buffer con sostituzioni
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

console.log('🎮 Danganronpa WAD Patcher v9 (rebuild + normalize)');
console.log('='.repeat(55));

// 1. Carica traduzioni
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const transMap = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!transMap.has(t.original)) transMap.set(t.original, t.translated);
}
// Ordina per lunghezza decrescente (stringhe più lunghe prima per evitare match parziali)
const sortedEntries = [...transMap.entries()].sort((a, b) => b[0].length - a[0].length);
console.log(`   ${sortedEntries.length} stringhe uniche`);

// Prepara pattern di ricerca
const searchPatternsLE = sortedEntries.map(([orig, trans]) => ({
  searchLE: toUTF16LE(orig),
  replaceLE: toUTF16LE(trans),
  original: orig,
}));
const searchPatternsBE = sortedEntries.map(([orig, trans]) => ({
  searchBE: toUTF16BE(orig),
  replaceBE: toUTF16BE(trans),
  original: orig,
}));

// 2. Parse WAD backup
console.log('📦 Parsing WAD backup...');
const fd = openSync(WAD_BACKUP, 'r');
const hdr = Buffer.alloc(20); readSync(fd, hdr, 0, 20, 0);
const version = hdr.readUInt32LE(4);
const flags1 = hdr.readUInt32LE(8);
const flags2 = hdr.readUInt32LE(12);
const fileCount = hdr.readUInt32LE(16);

let pos = 20;
const wadEntries = [];
for (let i = 0; i < fileCount; i++) {
  const nl = Buffer.alloc(4); readSync(fd, nl, 0, 4, pos); pos += 4;
  const nameLen = nl.readUInt32LE(0);
  const nb = Buffer.alloc(nameLen); readSync(fd, nb, 0, nameLen, pos); pos += nameLen;
  const mb = Buffer.alloc(16); readSync(fd, mb, 0, 16, pos); pos += 16;
  wadEntries.push({ 
    name: nb.toString('ascii'), nameLen,
    size: Number(mb.readBigUInt64LE(0)), 
    offset: Number(mb.readBigUInt64LE(8))
  });
}
const headerEnd = pos;
console.log(`   ${fileCount} file, headerEnd=${headerEnd}`);

// 3. Leggi e patcha ogni file
console.log('🔧 Patching...');
const newFileDatas = [];
let totalPatched = 0, totalExpanded = 0, filesModified = 0;

for (let i = 0; i < wadEntries.length; i++) {
  const entry = wadEntries[i];
  const absOffset = headerEnd + entry.offset;
  let data = Buffer.alloc(entry.size);
  readSync(fd, data, 0, entry.size, absOffset);
  
  const isScript = entry.name.includes('/script/') && 
    (entry.name.endsWith('.pak') || entry.name.endsWith('.lin'));
  
  if (isScript && entry.size > 4) {
    let modified = false;
    
    // Crea copie normalizzate
    let normLE = normalizeLE(data);
    let normBE = normalizeBE(data);
    
    // Prova ogni pattern
    for (const p of searchPatternsLE) {
      const result = findAndReplace(data, normLE, p.searchLE, p.replaceLE);
      if (result) {
        if (result.newBuf.length > data.length) totalExpanded++;
        data = result.newBuf;
        normLE = normalizeLE(data); // Ricalcola normalizzazione
        totalPatched += result.count;
        modified = true;
      }
    }
    
    // Prova BE
    normBE = normalizeBE(data);
    for (const p of searchPatternsBE) {
      const result = findAndReplace(data, normBE, p.searchBE, p.replaceBE);
      if (result) {
        if (result.newBuf.length > data.length) totalExpanded++;
        data = result.newBuf;
        normBE = normalizeBE(data);
        totalPatched += result.count;
        modified = true;
      }
    }
    
    if (modified) filesModified++;
  }
  
  newFileDatas.push(data);
  
  if ((i + 1) % 100 === 0) {
    process.stdout.write(`\r   ${i+1}/${wadEntries.length} | ${totalPatched} match | ${totalExpanded} espansi`);
  }
}

// Leggi dati extra alla fine del WAD originale (63KB di metadata)
let origDataEnd = 0;
for (const e of wadEntries) {
  const end = e.offset + e.size;
  if (end > origDataEnd) origDataEnd = end;
}
const origAbsDataEnd = headerEnd + origDataEnd;
const origWadSize = statSync(WAD_BACKUP).size;
const extraSize = origWadSize - origAbsDataEnd;
let extraData = null;
if (extraSize > 0) {
  extraData = Buffer.alloc(extraSize);
  readSync(fd, extraData, 0, extraSize, origAbsDataEnd);
  console.log(`\n   📎 ${extraSize} bytes di dati extra preservati`);
}

closeSync(fd);
console.log(`\r   ${wadEntries.length}/${wadEntries.length} | ${totalPatched} match | ${totalExpanded} espansi`);

// 4. Ricostruisci WAD
console.log('📝 Ricostruzione WAD...');
const ws = createWriteStream(WAD_NEW);

// Header
const newHdr = Buffer.alloc(20);
newHdr.write('AGAR', 0, 4, 'ascii');
newHdr.writeUInt32LE(version, 4);
newHdr.writeUInt32LE(flags1, 8);
newHdr.writeUInt32LE(flags2, 12);
newHdr.writeUInt32LE(fileCount, 16);
ws.write(newHdr);

// Calcola offset
let relOffset = 0;
for (let i = 0; i < wadEntries.length; i++) {
  const e = wadEntries[i];
  const nl = Buffer.alloc(4);
  nl.writeUInt32LE(e.nameLen, 0);
  ws.write(nl);
  ws.write(Buffer.from(e.name, 'ascii'));
  const mb = Buffer.alloc(16);
  mb.writeBigUInt64LE(BigInt(newFileDatas[i].length), 0);
  mb.writeBigUInt64LE(BigInt(relOffset), 8);
  ws.write(mb);
  relOffset += newFileDatas[i].length;
}

// Scrivi dati
for (let i = 0; i < wadEntries.length; i++) {
  ws.write(newFileDatas[i]);
  if ((i + 1) % 500 === 0) {
    process.stdout.write(`\r   ${i+1}/${wadEntries.length} scritti`);
  }
}

// Appendi dati extra (trailing metadata dal WAD originale)
if (extraData) {
  ws.write(extraData);
  console.log(`\n   📎 Dati extra (${extraSize} bytes) scritti alla fine del WAD`);
}

await new Promise((resolve, reject) => {
  ws.on('finish', resolve);
  ws.on('error', reject);
  ws.end();
});

console.log(`\r   ${wadEntries.length}/${wadEntries.length} scritti`);

// 5. Sostituisci WAD
if (existsSync(WAD_PATH)) unlinkSync(WAD_PATH);
renameSync(WAD_NEW, WAD_PATH);

const newSize = statSync(WAD_PATH).size;
const oldSize = statSync(WAD_BACKUP).size;
const delta = ((newSize - oldSize) / 1024).toFixed(0);

console.log('');
console.log('='.repeat(55));
console.log(`✅ WAD RICOSTRUITO v9`);
console.log(`   File modificati: ${filesModified}`);
console.log(`   Stringhe sostituite: ${totalPatched}`);
console.log(`   File espansi: ${totalExpanded}`);
console.log(`   Troncamenti: 0`);
console.log(`   WAD: ${(newSize / (1024*1024)).toFixed(1)} MB (delta: ${delta} KB)`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam!');
