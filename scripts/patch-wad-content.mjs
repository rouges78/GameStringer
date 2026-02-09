/**
 * Danganronpa WAD Content-Based Patcher v6
 * 
 * Cerca ogni testo originale (UTF-16LE) nel WAD e lo sostituisce con la traduzione.
 * I testi vivono nei file .pak dentro il WAD (non nei .lin come pensavamo).
 * 
 * Approccio:
 * 1. Ripristina WAD da backup
 * 2. Carica traduzioni e crea mappa original → translated
 * 3. Per ogni stringa originale, cerca nel WAD come UTF-16LE
 * 4. Sostituisce in-place (pad con null se più corta, tronca se più lunga)
 */

import { readFileSync, openSync, readSync, writeSync, closeSync, copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');

/** Encode string as UTF-16LE Buffer */
function toUTF16LE(str) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    buf[i*2] = c & 0xFF;
    buf[i*2+1] = (c >> 8) & 0xFF;
  }
  return buf;
}

console.log('🎮 Danganronpa WAD Content Patcher v6');
console.log('='.repeat(50));

// 1. Ripristina WAD da backup
if (!existsSync(WAD_BACKUP)) {
  console.log('💾 Backup WAD originale...');
  copyFileSync(WAD_PATH, WAD_BACKUP);
} else {
  console.log('💾 Ripristino WAD da backup...');
  copyFileSync(WAD_BACKUP, WAD_PATH);
}

// 2. Carica traduzioni
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));

// Deduplica per testo originale (stesso testo → stessa traduzione)
const transMap = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!transMap.has(t.original)) {
    transMap.set(t.original, t.translated);
  }
}
console.log(`   ${transMap.size} stringhe uniche da cercare`);

// 3. Prepara pattern di ricerca UTF-16LE
// Ordina per lunghezza decrescente (patcha prima le stringhe più lunghe per evitare match parziali)
const searchEntries = [...transMap.entries()]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([orig, trans]) => ({
    original: orig,
    translated: trans,
    searchBuf: toUTF16LE(orig),
  }));

console.log(`   Pattern ordinati per lunghezza (max: ${searchEntries[0]?.original.length} chars)`);

// 4. Parse WAD header per sapere dove sono i file
const fd = openSync(WAD_PATH, 'r+');
const hdr = Buffer.alloc(20);
readSync(fd, hdr, 0, 20, 0);
const fileCount = hdr.readUInt32LE(16);

let pos = 20;
const wadEntries = [];
for (let i = 0; i < fileCount; i++) {
  const nl = Buffer.alloc(4); readSync(fd, nl, 0, 4, pos); pos += 4;
  const nameLen = nl.readUInt32LE(0);
  const nb = Buffer.alloc(nameLen); readSync(fd, nb, 0, nameLen, pos); pos += nameLen;
  const mb = Buffer.alloc(16); readSync(fd, mb, 0, 16, pos); pos += 16;
  wadEntries.push({ name: nb.toString('ascii'), size: Number(mb.readBigUInt64LE(0)), offset: Number(mb.readBigUInt64LE(8)) });
}
const headerEnd = pos;
console.log(`📦 WAD: ${fileCount} file, headerEnd=${headerEnd}`);

// Filtra solo i file che possono contenere testo (.pak e .lin nella dir script)
const textEntries = wadEntries.filter(e => 
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);
console.log(`   ${textEntries.length} file script da scansionare`);

// 5. Per ogni file script, cerca e sostituisci
let totalPatched = 0;
let totalTruncated = 0;
let filesPatched = 0;
let filesScanned = 0;

for (const entry of textEntries) {
  filesScanned++;
  
  const absOffset = headerEnd + entry.offset;
  const data = Buffer.alloc(entry.size);
  readSync(fd, data, 0, entry.size, absOffset);
  
  let fileModified = false;
  
  for (const se of searchEntries) {
    let searchFrom = 0;
    
    while (true) {
      const idx = data.indexOf(se.searchBuf, searchFrom);
      if (idx < 0) break;
      
      // Trovato! Sostituisci con traduzione
      const transBuf = toUTF16LE(se.translated);
      const origByteLen = se.searchBuf.length;
      
      if (transBuf.length <= origByteLen) {
        // Traduzione più corta o uguale: scrivi + pad null
        transBuf.copy(data, idx, 0, transBuf.length);
        if (transBuf.length < origByteLen) {
          data.fill(0, idx + transBuf.length, idx + origByteLen);
        }
      } else {
        // Traduzione più lunga: scrivi solo quanto entra
        transBuf.copy(data, idx, 0, origByteLen);
        totalTruncated++;
      }
      
      totalPatched++;
      fileModified = true;
      searchFrom = idx + origByteLen; // Avanza oltre
    }
  }
  
  if (fileModified) {
    writeSync(fd, data, 0, entry.size, absOffset);
    filesPatched++;
  }
  
  if (filesScanned % 50 === 0) {
    process.stdout.write(`\r   ${filesScanned}/${textEntries.length} file | ${totalPatched} stringhe trovate`);
  }
}

closeSync(fd);

console.log(`\r   ${filesScanned}/${textEntries.length} file scansionati`);
console.log('');
console.log('='.repeat(50));
console.log(`✅ WAD PATCHATO (content-based)`);
console.log(`   File modificati: ${filesPatched}`);
console.log(`   Stringhe: ${totalPatched} sostituite, ${totalTruncated} troncate`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
console.log('');
console.log('Per ripristinare:');
console.log(`   copy "${WAD_BACKUP}" "${WAD_PATH}"`);
