/**
 * Danganronpa WAD Content Patcher v8
 * 
 * Come v7 ma RICOSTRUISCE il WAD permettendo espansione dei file.
 * Nessun troncamento — le traduzioni italiane vengono inserite per intero.
 * 
 * Approccio:
 * 1. Ripristina WAD da backup
 * 2. Legge ogni file dal WAD originale
 * 3. Per i file script: cerca e sostituisce testo (espandendo se necessario)
 * 4. Ricostruisce il WAD con offset ricalcolati
 */

import { readFileSync, openSync, readSync, writeSync, closeSync, copyFileSync, 
         existsSync, statSync, createWriteStream } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
const WAD_NEW = join(GAME_PATH, 'dr1_data_us.wad.new');
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');

function toUTF16(str, enc) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (enc === 'LE') { buf[i*2] = c & 0xFF; buf[i*2+1] = (c >> 8) & 0xFF; }
    else { buf[i*2] = (c >> 8) & 0xFF; buf[i*2+1] = c & 0xFF; }
  }
  return buf;
}

/**
 * Sostituisce tutte le occorrenze di searchBuf con replaceBuf nel buffer data.
 * PERMETTE espansione — restituisce un nuovo buffer.
 */
function replaceAllInBuffer(data, searchBuf, replaceBuf) {
  const parts = [];
  let lastEnd = 0;
  let idx = data.indexOf(searchBuf, 0);
  
  while (idx >= 0) {
    parts.push(data.subarray(lastEnd, idx));
    parts.push(replaceBuf);
    lastEnd = idx + searchBuf.length;
    idx = data.indexOf(searchBuf, lastEnd);
  }
  
  if (parts.length === 0) return null; // Nessuna sostituzione
  
  parts.push(data.subarray(lastEnd));
  return Buffer.concat(parts);
}

console.log('🎮 Danganronpa WAD Patcher v8 (full rebuild, no truncation)');
console.log('='.repeat(55));

// 1. Carica traduzioni
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const transMap = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!transMap.has(t.original)) transMap.set(t.original, t.translated);
}
// Ordina per lunghezza decrescente (sostituisci prima le stringhe più lunghe)
const searchEntries = [...transMap.entries()]
  .sort((a, b) => b[0].length - a[0].length);
console.log(`   ${searchEntries.length} stringhe uniche`);

// 2. Parse WAD originale (usa sempre il backup come sorgente)
console.log('📦 Parsing WAD backup...');
const fd = openSync(WAD_BACKUP, 'r');
const hdr = Buffer.alloc(20); readSync(fd, hdr, 0, 20, 0);
const magic = hdr.toString('ascii', 0, 4);
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
    name: nb.toString('ascii'), 
    nameLen,
    size: Number(mb.readBigUInt64LE(0)), 
    offset: Number(mb.readBigUInt64LE(8)),
    idx: i 
  });
}
const headerEnd = pos;
console.log(`   ${fileCount} file, headerEnd=${headerEnd}`);

// 3. Leggi e patcha ogni file
console.log('🔧 Patching file script...');
const newFileDatas = new Array(wadEntries.length);
let totalPatched = 0, filesPatched = 0, expanded = 0;

for (let i = 0; i < wadEntries.length; i++) {
  const entry = wadEntries[i];
  const absOffset = headerEnd + entry.offset;
  let data = Buffer.alloc(entry.size);
  readSync(fd, data, 0, entry.size, absOffset);
  
  const isScript = entry.name.includes('/script/') && 
    (entry.name.endsWith('.pak') || entry.name.endsWith('.lin'));
  
  if (isScript) {
    let modified = false;
    
    for (const [orig, trans] of searchEntries) {
      // Cerca come UTF-16LE
      const searchBuf = toUTF16(orig, 'LE');
      const replaceBuf = toUTF16(trans, 'LE');
      
      let result = replaceAllInBuffer(data, searchBuf, replaceBuf);
      if (result) {
        if (result.length > data.length) expanded++;
        data = result;
        totalPatched++;
        modified = true;
        continue;
      }
      
      // Prova UTF-16BE
      const searchBufBE = toUTF16(orig, 'BE');
      const replaceBufBE = toUTF16(trans, 'BE');
      result = replaceAllInBuffer(data, searchBufBE, replaceBufBE);
      if (result) {
        if (result.length > data.length) expanded++;
        data = result;
        totalPatched++;
        modified = true;
      }
    }
    
    if (modified) filesPatched++;
  }
  
  newFileDatas[i] = data;
  
  if ((i + 1) % 200 === 0) {
    process.stdout.write(`\r   ${i+1}/${wadEntries.length} | ${totalPatched} patchate | ${expanded} espanse`);
  }
}

closeSync(fd);
console.log(`\r   ${wadEntries.length}/${wadEntries.length} | ${totalPatched} patchate | ${expanded} espanse`);

// 4. Ricostruisci WAD con offset ricalcolati
console.log('📝 Ricostruzione WAD...');
const ws = createWriteStream(WAD_NEW);

// AGAR header
const newHdr = Buffer.alloc(20);
newHdr.write('AGAR', 0, 4, 'ascii');
newHdr.writeUInt32LE(version, 4);
newHdr.writeUInt32LE(flags1, 8);
newHdr.writeUInt32LE(flags2, 12);
newHdr.writeUInt32LE(fileCount, 16);
ws.write(newHdr);

// Calcola nuovi offset (relativi alla fine dell'header)
let relOffset = 0;
const newOffsets = [];
const newSizes = [];
for (let i = 0; i < wadEntries.length; i++) {
  newOffsets.push(relOffset);
  newSizes.push(newFileDatas[i].length);
  relOffset += newFileDatas[i].length;
}

// Scrivi entry table
for (let i = 0; i < wadEntries.length; i++) {
  const e = wadEntries[i];
  const nl = Buffer.alloc(4);
  nl.writeUInt32LE(e.nameLen, 0);
  ws.write(nl);
  ws.write(Buffer.from(e.name, 'ascii'));
  const mb = Buffer.alloc(16);
  mb.writeBigUInt64LE(BigInt(newSizes[i]), 0);
  mb.writeBigUInt64LE(BigInt(newOffsets[i]), 8);
  ws.write(mb);
}

// Scrivi dati file
let written = 0;
for (let i = 0; i < wadEntries.length; i++) {
  ws.write(newFileDatas[i]);
  written++;
  if (written % 500 === 0) {
    process.stdout.write(`\r   ${written}/${wadEntries.length} file scritti`);
  }
}

await new Promise((resolve, reject) => {
  ws.on('finish', resolve);
  ws.on('error', reject);
  ws.end();
});

console.log(`\r   ${wadEntries.length}/${wadEntries.length} file scritti`);

// 5. Sostituisci WAD
const { renameSync, unlinkSync } = await import('fs');
if (existsSync(WAD_PATH)) unlinkSync(WAD_PATH);
renameSync(WAD_NEW, WAD_PATH);

const newSize = statSync(WAD_PATH).size;
const oldSize = statSync(WAD_BACKUP).size;

console.log('');
console.log('='.repeat(55));
console.log(`✅ WAD RICOSTRUITO v8`);
console.log(`   File modificati: ${filesPatched}`);
console.log(`   Stringhe sostituite: ${totalPatched}`);
console.log(`   File espansi: ${expanded}`);
console.log(`   Troncamenti: 0`);
console.log(`   Dimensione: ${(newSize / (1024*1024)).toFixed(1)} MB (era ${(oldSize / (1024*1024)).toFixed(1)} MB)`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
