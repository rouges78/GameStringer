/**
 * Danganronpa WAD Content Patcher v7
 * 
 * Miglioramenti rispetto a v6:
 * - Cerca sia UTF-16LE che UTF-16BE
 * - Gestisce \n ↔ spazio (l'estrazione convertiva \n in spazi)
 * - Cerca anche senza la prima lettera (mangiata da FE+XX nell'estrazione)
 * - Cerca frammenti se il testo completo non è trovato
 */

import { readFileSync, openSync, readSync, writeSync, closeSync, copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
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
 * Cerca testo nel buffer, ignorando differenze \n vs spazio.
 * Restituisce l'indice di inizio o -1.
 */
function fuzzyFind(data, searchText, enc, startFrom) {
  // Prova prima match esatto
  const exact = toUTF16(searchText, enc);
  let idx = data.indexOf(exact, startFrom);
  if (idx >= 0) return { idx, matchLen: exact.length, type: 'exact' };
  
  // Prova con la prima lettera rimossa (FE+XX nell'estrazione la "mangia")
  if (searchText.length > 5) {
    const noFirst = toUTF16(searchText.substring(1), enc);
    idx = data.indexOf(noFirst, startFrom);
    if (idx >= 0) {
      // Verifica: 2 bytes prima dovrebbe essere un FE+XX char
      if (idx >= 2) {
        const prevChar = enc === 'LE' 
          ? data[idx-2] | (data[idx-1] << 8)
          : (data[idx-2] << 8) | data[idx-1];
        if (prevChar >= 0xFE00 && prevChar <= 0xFFFF) {
          return { idx: idx - 2, matchLen: noFirst.length + 2, type: 'noFirst' };
        }
      }
      // Anche senza FE+XX, il match è buono
      return { idx, matchLen: noFirst.length, type: 'noFirst-noFE' };
    }
  }
  
  // Prova: sostituisci spazi con \n nelle varie posizioni
  // Cerca le prime parole (prima di un possibile \n)
  const words = searchText.split(' ');
  if (words.length >= 3) {
    // Prova con le prime 3+ parole
    for (let w = Math.min(words.length, 6); w >= 3; w--) {
      const prefix = words.slice(0, w).join(' ');
      const prefixBuf = toUTF16(prefix, enc);
      idx = data.indexOf(prefixBuf, startFrom);
      if (idx >= 0) {
        // Trovato inizio! Ora verifica il resto con \n al posto degli spazi
        // Calcola lunghezza totale del testo originale nel buffer
        // (potrebbe avere \n al posto di spazi)
        let origLen = 0;
        let matchPos = idx;
        let fullMatch = true;
        
        for (let wi = 0; wi < words.length; wi++) {
          const word = words[wi];
          const wordBuf = toUTF16(word, enc);
          
          // Check se la word matcha alla posizione corrente
          if (matchPos + wordBuf.length > data.length) { fullMatch = false; break; }
          if (!data.subarray(matchPos, matchPos + wordBuf.length).equals(wordBuf)) {
            // Prova senza prima lettera per la prima word
            if (wi === 0 && matchPos >= 2) {
              // skip
            }
            fullMatch = false; 
            break; 
          }
          matchPos += wordBuf.length;
          
          // Dopo ogni word (tranne l'ultima), aspettati spazio o \n
          if (wi < words.length - 1 && matchPos + 1 < data.length) {
            const sep = enc === 'LE' 
              ? data[matchPos] | (data[matchPos+1] << 8)
              : (data[matchPos] << 8) | data[matchPos+1];
            if (sep === 0x20 || sep === 0x0A) {
              matchPos += 2;
            } else {
              fullMatch = false; break;
            }
          }
        }
        
        if (fullMatch) {
          return { idx, matchLen: matchPos - idx, type: 'fuzzy' };
        }
      }
    }
  }
  
  return null;
}

console.log('🎮 Danganronpa WAD Content Patcher v7 (fuzzy)');
console.log('='.repeat(50));

// 1. Ripristina WAD
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
console.log(`   ${transMap.size} stringhe uniche`);

// Ordina per lunghezza decrescente
const searchEntries = [...transMap.entries()]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([orig, trans]) => ({ original: orig, translated: trans }));

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
  wadEntries.push({ name: nb.toString('ascii'), size: Number(mb.readBigUInt64LE(0)), offset: Number(mb.readBigUInt64LE(8)) });
}
const headerEnd = pos;

const textEntries = wadEntries.filter(e => 
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);
console.log(`📦 ${textEntries.length} file script nel WAD`);

// 4. Patch
let totalPatched = 0, totalTruncated = 0, filesPatched = 0, scanned = 0;
const notFound = [];

// Per ogni file script, cerca tutte le traduzioni
for (const entry of textEntries) {
  scanned++;
  const absOffset = headerEnd + entry.offset;
  const data = Buffer.alloc(entry.size);
  readSync(fd, data, 0, entry.size, absOffset);
  
  let modified = false;
  
  for (const se of searchEntries) {
    // Prova LE poi BE
    for (const enc of ['LE', 'BE']) {
      const result = fuzzyFind(data, se.original, enc, 0);
      if (!result) continue;
      
      const { idx, matchLen } = result;
      
      // Scrivi traduzione
      const transBuf = toUTF16(se.translated, enc);
      
      if (transBuf.length <= matchLen) {
        transBuf.copy(data, idx, 0, transBuf.length);
        if (transBuf.length < matchLen) {
          data.fill(0, idx + transBuf.length, idx + matchLen);
        }
      } else {
        transBuf.copy(data, idx, 0, matchLen);
        totalTruncated++;
      }
      
      totalPatched++;
      modified = true;
      break; // Trovato in un encoding, non serve cercare nell'altro
    }
  }
  
  if (modified) {
    writeSync(fd, data, 0, entry.size, absOffset);
    filesPatched++;
  }
  
  if (scanned % 100 === 0) {
    process.stdout.write(`\r   ${scanned}/${textEntries.length} | ${totalPatched} patchate`);
  }
}

closeSync(fd);

console.log(`\r   ${scanned}/${textEntries.length} file scansionati`);
console.log('');
console.log('='.repeat(50));
console.log(`✅ WAD PATCHATO v7 (fuzzy content-based)`);
console.log(`   File modificati: ${filesPatched}`);
console.log(`   Stringhe: ${totalPatched} sostituite, ${totalTruncated} troncate`);
console.log(`   Non trovate: ${transMap.size - totalPatched}`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
console.log('');
console.log('Per ripristinare:');
console.log(`   copy "${WAD_BACKUP}" "${WAD_PATH}"`);
