/**
 * Danganronpa WAD Patcher v10 — In-Place + Normalizzazione
 * 
 * Combina:
 * - Normalizzazione \n↔spazio da v9 (più match)
 * - Patching IN-PLACE da v7 (zero crash, nessun rebuild WAD)
 * 
 * Troncamento inevitabile per testi più lunghi, ma il gioco funziona.
 */

import { readFileSync, openSync, readSync, writeSync, closeSync, 
         copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
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

/** Normalizza: \n(0x0A) → spazio(0x20) in UTF-16LE */
function normalizeLE(buf) {
  const norm = Buffer.from(buf);
  for (let i = 0; i < norm.length - 1; i += 2) {
    if (norm[i] === 0x0A && norm[i+1] === 0x00) norm[i] = 0x20;
  }
  return norm;
}

/** Normalizza: \n → spazio in UTF-16BE */
function normalizeBE(buf) {
  const norm = Buffer.from(buf);
  for (let i = 0; i < norm.length - 1; i += 2) {
    if (norm[i] === 0x00 && norm[i+1] === 0x0A) norm[i+1] = 0x20;
  }
  return norm;
}

/**
 * Cerca nel buffer normalizzato, sostituisce IN-PLACE nell'originale.
 * Se traduzione più lunga → tronca.
 * Se più corta → pad con null.
 */
function findAndPatchInPlace(data, normData, searchBuf, replaceBuf) {
  let count = 0;
  let truncated = 0;
  let idx = normData.indexOf(searchBuf, 0);
  
  while (idx >= 0) {
    const matchLen = searchBuf.length;
    
    if (replaceBuf.length <= matchLen) {
      // Traduzione più corta o uguale: scrivi + pad null
      replaceBuf.copy(data, idx, 0, replaceBuf.length);
      if (replaceBuf.length < matchLen) {
        data.fill(0, idx + replaceBuf.length, idx + matchLen);
      }
    } else {
      // Traduzione più lunga: tronca
      replaceBuf.copy(data, idx, 0, matchLen);
      truncated++;
    }
    
    // Aggiorna anche il buffer normalizzato per evitare ri-match
    if (replaceBuf.length <= matchLen) {
      replaceBuf.copy(normData, idx, 0, replaceBuf.length);
      if (replaceBuf.length < matchLen) {
        normData.fill(0, idx + replaceBuf.length, idx + matchLen);
      }
    } else {
      replaceBuf.copy(normData, idx, 0, matchLen);
    }
    
    count++;
    idx = normData.indexOf(searchBuf, idx + matchLen);
  }
  
  return count > 0 ? { count, truncated } : null;
}

console.log('🎮 Danganronpa WAD Patcher v10 (in-place + normalize)');
console.log('='.repeat(55));

// 1. Ripristina WAD da backup
if (!existsSync(WAD_BACKUP)) {
  console.log('💾 Backup WAD...');
  copyFileSync(WAD_PATH, WAD_BACKUP);
} else {
  console.log('💾 Ripristino WAD da backup...');
  copyFileSync(WAD_BACKUP, WAD_PATH);
}

// 2. Carica traduzioni
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const transMap = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!transMap.has(t.original)) transMap.set(t.original, t.translated);
}
const sorted = [...transMap.entries()].sort((a, b) => b[0].length - a[0].length);
console.log(`   ${sorted.length} stringhe uniche`);

// Prepara pattern
const patternsLE = sorted.map(([o, t]) => ({ search: toUTF16LE(o), replace: toUTF16LE(t) }));
const patternsBE = sorted.map(([o, t]) => ({ search: toUTF16BE(o), replace: toUTF16BE(t) }));

// 3. Parse WAD
const fd = openSync(WAD_PATH, 'r+');
const hdr = Buffer.alloc(20); readSync(fd, hdr, 0, 20, 0);
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
    size: Number(mb.readBigUInt64LE(0)), 
    offset: Number(mb.readBigUInt64LE(8)) 
  });
}
const headerEnd = pos;

const scriptEntries = wadEntries.filter(e => 
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);
console.log(`📦 ${scriptEntries.length} file script`);

// 4. Patch in-place
let totalPatched = 0, totalTruncated = 0, filesModified = 0, scanned = 0;

for (const entry of scriptEntries) {
  scanned++;
  const absOffset = headerEnd + entry.offset;
  const data = Buffer.alloc(entry.size);
  readSync(fd, data, 0, entry.size, absOffset);
  
  let modified = false;
  
  // Normalizza per matching
  const normLE = normalizeLE(data);
  
  for (const p of patternsLE) {
    const result = findAndPatchInPlace(data, normLE, p.search, p.replace);
    if (result) {
      totalPatched += result.count;
      totalTruncated += result.truncated;
      modified = true;
    }
  }
  
  // Prova BE
  const normBE = normalizeBE(data);
  for (const p of patternsBE) {
    const result = findAndPatchInPlace(data, normBE, p.search, p.replace);
    if (result) {
      totalPatched += result.count;
      totalTruncated += result.truncated;
      modified = true;
    }
  }
  
  if (modified) {
    // Scrivi dati patchati ALLA STESSA POSIZIONE (in-place, no resize)
    writeSync(fd, data, 0, entry.size, absOffset);
    filesModified++;
  }
  
  if (scanned % 100 === 0) {
    process.stdout.write(`\r   ${scanned}/${scriptEntries.length} | ${totalPatched} patchate | ${totalTruncated} troncate`);
  }
}

closeSync(fd);

console.log(`\r   ${scriptEntries.length}/${scriptEntries.length} | ${totalPatched} patchate | ${totalTruncated} troncate`);
console.log('');
console.log('='.repeat(55));
console.log(`✅ WAD PATCHATO IN-PLACE v10`);
console.log(`   File modificati: ${filesModified}`);
console.log(`   Stringhe: ${totalPatched} patchate`);
console.log(`   Troncate: ${totalTruncated} (${Math.round(totalTruncated / totalPatched * 100)}%)`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam!');
