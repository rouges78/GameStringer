/**
 * Danganronpa WAD Repacker v1
 * 
 * Ricostruisce dr1_data_us.wad sostituendo i .lin tradotti.
 * Formato AGAR: header(20) + entries[name_len(4) + name + size(8) + offset(8)] + data
 * 
 * Usa streaming I/O per gestire il WAD da 1.2 GB.
 */

import { readFileSync, writeFileSync, openSync, readSync, closeSync, createWriteStream, existsSync, copyFileSync, statSync, renameSync } from 'fs';
import { join, basename } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
const WAD_NEW = join(GAME_PATH, 'dr1_data_us.wad.new');
const SCRIPT_DIR = join(GAME_PATH, 'Dr1', 'data', 'us', 'script');

console.log('🎮 Danganronpa WAD Repacker v1');
console.log('='.repeat(50));

// 1. Backup WAD originale
if (!existsSync(WAD_BACKUP)) {
  console.log('💾 Backup WAD originale (1.2 GB)...');
  copyFileSync(WAD_PATH, WAD_BACKUP);
  console.log('   Backup completato');
} else {
  console.log('💾 Backup WAD già esistente');
}

// Usa il backup come sorgente (per patch pulita)
const srcWad = WAD_BACKUP;

// 2. Parse WAD header
console.log('📖 Parsing WAD header...');
const fd = openSync(srcWad, 'r');

const headerBuf = Buffer.alloc(20);
readSync(fd, headerBuf, 0, 20, 0);
const magic = headerBuf.toString('ascii', 0, 4);
const version = headerBuf.readUInt32LE(4);
const flags1 = headerBuf.readUInt32LE(8);
const flags2 = headerBuf.readUInt32LE(12);
const fileCount = headerBuf.readUInt32LE(16);

console.log(`   AGAR v${version} | ${fileCount} file`);

// Read all entries
const entries = [];
let pos = 20;

for (let i = 0; i < fileCount; i++) {
  const nlBuf = Buffer.alloc(4);
  readSync(fd, nlBuf, 0, 4, pos); pos += 4;
  const nameLen = nlBuf.readUInt32LE(0);
  
  if (nameLen > 512 || nameLen === 0) {
    console.error(`   ERRORE: nameLen=${nameLen} alla entry ${i}`);
    break;
  }
  
  const nameBuf = Buffer.alloc(nameLen);
  readSync(fd, nameBuf, 0, nameLen, pos); pos += nameLen;
  const name = nameBuf.toString('ascii');
  
  const metaBuf = Buffer.alloc(16);
  readSync(fd, metaBuf, 0, 16, pos); pos += 16;
  const size = Number(metaBuf.readBigUInt64LE(0));
  const offset = Number(metaBuf.readBigUInt64LE(8));
  
  entries.push({ name, nameLen, size, offset, idx: i });
}

const headerEnd = pos; // Fine della entry table
console.log(`   ${entries.length} entry lette, header size: ${headerEnd} bytes`);

// 3. Determina quali file sostituire con versioni tradotte
let replacedCount = 0;
const replacements = new Map(); // idx -> { newSize, filePath }

for (const entry of entries) {
  if (!entry.name.endsWith('.lin')) continue;
  
  // Il nome nel WAD è "Dr1/data/us/script/e00_002_000.lin"
  // Il file tradotto su disco è "Dr1/data/us/script/e00_002_000.lin" (sotto GAME_PATH)
  const loosePath = join(GAME_PATH, entry.name.replace(/\//g, '\\'));
  
  if (!existsSync(loosePath)) continue;
  
  const looseSize = statSync(loosePath).size;
  
  // Solo se il file è diverso dall'originale (è stato tradotto)
  if (looseSize !== entry.size) {
    replacements.set(entry.idx, { newSize: looseSize, filePath: loosePath });
    replacedCount++;
  }
}

console.log(`   ${replacedCount} file .lin tradotti da inserire nel WAD`);

if (replacedCount === 0) {
  console.log('⚠️  Nessun file tradotto trovato! Verifica che il rebuilder v4 abbia modificato i file.');
  closeSync(fd);
  process.exit(1);
}

// 4. Calcola nuovi offset
// L'header (entry table) rimane della stessa dimensione perché i nomi non cambiano.
// I dati vengono scritti sequenzialmente dopo l'header.
console.log('📐 Calcolo nuovi offset...');

// Offset nel WAD sono RELATIVI alla fine dell'header (inizio sezione dati)
let relativeOffset = 0;
const newEntries = entries.map(e => {
  const replacement = replacements.get(e.idx);
  const newSize = replacement ? replacement.newSize : e.size;
  const newOffset = relativeOffset;
  relativeOffset += newSize;
  return { ...e, newSize, newOffset };
});

const newWadSize = headerEnd + relativeOffset;
console.log(`   Nuovo WAD: ${(newWadSize / (1024*1024)).toFixed(1)} MB (originale: ${(statSync(srcWad).size / (1024*1024)).toFixed(1)} MB)`);

// 5. Scrivi nuovo WAD
console.log('📝 Scrittura nuovo WAD...');
const ws = createWriteStream(WAD_NEW);

// Write AGAR header (20 bytes)
const newHeader = Buffer.alloc(20);
newHeader.write('AGAR', 0, 4, 'ascii');
newHeader.writeUInt32LE(version, 4);
newHeader.writeUInt32LE(flags1, 8);
newHeader.writeUInt32LE(flags2, 12);
newHeader.writeUInt32LE(fileCount, 16);
ws.write(newHeader);

// Write entry table with updated sizes and offsets
for (const e of newEntries) {
  const nlBuf = Buffer.alloc(4);
  nlBuf.writeUInt32LE(e.nameLen, 0);
  ws.write(nlBuf);
  
  ws.write(Buffer.from(e.name, 'ascii'));
  
  const metaBuf = Buffer.alloc(16);
  metaBuf.writeBigUInt64LE(BigInt(e.newSize), 0);
  metaBuf.writeBigUInt64LE(BigInt(e.newOffset), 8);
  ws.write(metaBuf);
}

// Write file data
let written = 0;
const CHUNK = 4 * 1024 * 1024; // 4 MB chunk per lettura

for (let i = 0; i < newEntries.length; i++) {
  const e = newEntries[i];
  const replacement = replacements.get(e.idx);
  
  if (replacement) {
    // Scrivi file tradotto da disco
    const data = readFileSync(replacement.filePath);
    ws.write(data);
  } else {
    // Copia dati originali dal WAD sorgente (offset è relativo a fine header)
    let remaining = e.size;
    let readPos = e.offset + headerEnd;
    
    while (remaining > 0) {
      const toRead = Math.min(remaining, CHUNK);
      const chunk = Buffer.alloc(toRead);
      readSync(fd, chunk, 0, toRead, readPos);
      ws.write(chunk);
      readPos += toRead;
      remaining -= toRead;
    }
  }
  
  written++;
  if (written % 500 === 0) {
    const pct = ((written / newEntries.length) * 100).toFixed(0);
    process.stdout.write(`\r   ${pct}% (${written}/${newEntries.length} file)`);
  }
}

// Attendi completamento scrittura
await new Promise((resolve, reject) => {
  ws.on('finish', resolve);
  ws.on('error', reject);
  ws.end();
});

closeSync(fd);

console.log(`\r   100% (${newEntries.length}/${newEntries.length} file)`);
console.log('');

// 6. Sostituisci WAD originale con il nuovo
console.log('🔄 Sostituzione WAD...');
renameSync(WAD_NEW, WAD_PATH);
console.log('');
console.log('='.repeat(50));
console.log(`✅ WAD RICOSTRUITO`);
console.log(`   ${replacedCount} file .lin tradotti inseriti`);
console.log(`   Dimensione: ${(newWadSize / (1024*1024)).toFixed(1)} MB`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
console.log('');
console.log('Per ripristinare:');
console.log(`   copy "${WAD_BACKUP}" "${WAD_PATH}"`);
