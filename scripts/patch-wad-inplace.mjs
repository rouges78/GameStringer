/**
 * Danganronpa WAD In-Place Patcher v5
 * 
 * Patcha il WAD DIRETTAMENTE senza cambiare dimensioni file né offset.
 * Per ogni .lin entry nel WAD:
 *   1. Legge i dati originali
 *   2. Trova le regioni testo delimitate da ÿ
 *   3. Sostituisce il testo in-place (stessa lunghezza byte, pad con null)
 *   4. Scrive i dati modificati alla stessa posizione nel WAD
 * 
 * ZERO rischio di corruzione strutturale.
 */

import { readFileSync, writeFileSync, openSync, readSync, writeSync, closeSync, copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD_PATH = join(GAME_PATH, 'dr1_data_us.wad');
const WAD_BACKUP = join(GAME_PATH, 'dr1_data_us.wad.backup');
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');

/** Read UTF-16BE char */
function readCharBE(buf, pos) {
  if (pos + 1 >= buf.length) return 0;
  return (buf[pos] << 8) | buf[pos + 1];
}

/** Write UTF-16BE char */
function writeCharBE(buf, pos, code) {
  if (pos + 1 >= buf.length) return;
  buf[pos] = (code >> 8) & 0xFF;
  buf[pos + 1] = code & 0xFF;
}

/** Auto-detect encoding */
function detectEnc(buf) {
  if (buf.length < 2) return 'BE';
  if (buf[0] === 0xFF && buf[1] === 0xFE) return 'LE';
  if (buf[0] === 0xFE && buf[1] === 0xFF) return 'BE';
  let be = 0, le = 0;
  for (let i = 0; i < Math.min(buf.length, 40) - 1; i += 2) {
    if (buf[i] === 0x00 && buf[i+1] >= 0x20 && buf[i+1] <= 0x7E) be++;
    if (buf[i+1] === 0x00 && buf[i] >= 0x20 && buf[i] <= 0x7E) le++;
  }
  return be >= le ? 'BE' : 'LE';
}

function readChar(buf, pos, enc) {
  if (pos + 1 >= buf.length) return 0;
  return enc === 'BE' ? (buf[pos] << 8) | buf[pos+1] : buf[pos] | (buf[pos+1] << 8);
}

function writeChar(buf, pos, code, enc) {
  if (pos + 1 >= buf.length) return;
  if (enc === 'BE') { buf[pos] = (code >> 8) & 0xFF; buf[pos+1] = code & 0xFF; }
  else { buf[pos] = code & 0xFF; buf[pos+1] = (code >> 8) & 0xFF; }
}

/** Pulisci testo entry come l'estrazione Rust */
function cleanEntry(buf, start, end, enc) {
  let text = '';
  for (let i = start; i < end - 1; i += 2) {
    const c = readChar(buf, i, enc);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  text = text.replace(/^[\n\r]+/, '');
  if (!text) return '';
  
  let result = '';
  const first = text.charCodeAt(0);
  if (first >= 0xFE00 && first <= 0xFFFF) {
    const recovered = first & 0xFF;
    if (recovered >= 0x20 && recovered <= 0x7E) result += String.fromCharCode(recovered);
    text = text.substring(1);
  }
  result += text;
  result = result.split('\n').map(l => l.trim()).filter(l => l).join(' ');
  result = result.replace(/<CLT[^>]*>/g, '').replace(/<\/CLT>/g, '');
  
  let nonLatinStreak = 0;
  for (let i = 0; i < result.length; i++) {
    const c = result.charCodeAt(i);
    const isLatin = (c >= 0x20 && c <= 0x7E) || (c >= 0x00C0 && c <= 0x024F);
    if (isLatin) nonLatinStreak = 0;
    else { nonLatinStreak++; if (nonLatinStreak >= 3) { result = result.substring(0, Math.max(0, i - 2)); break; } }
  }
  return result.trim();
}

function passesFilter(text) {
  return text.length >= 3 && text.length <= 2000 && /[a-zA-Z]/.test(text);
}

console.log('🎮 Danganronpa WAD In-Place Patcher v5');
console.log('='.repeat(50));

// 1. Backup
if (!existsSync(WAD_BACKUP)) {
  console.log('💾 Backup WAD originale...');
  copyFileSync(WAD_PATH, WAD_BACKUP);
} else {
  console.log('💾 Ripristino WAD da backup...');
  copyFileSync(WAD_BACKUP, WAD_PATH);
}
console.log('   OK');

// 2. Carica traduzioni
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const byFile = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!byFile.has(t.file)) byFile.set(t.file, new Map());
  byFile.get(t.file).set(t.line_index, t);
}
console.log(`   ${[...byFile.values()].reduce((s, m) => s + m.size, 0)} stringhe in ${byFile.size} file`);

// 3. Parse WAD header
console.log('📦 Parsing WAD...');
const fd = openSync(WAD_PATH, 'r+'); // Read+Write

const headerBuf = Buffer.alloc(20);
readSync(fd, headerBuf, 0, 20, 0);
const fileCount = headerBuf.readUInt32LE(16);

let pos = 20;
const wadEntries = [];
for (let i = 0; i < fileCount; i++) {
  const nlBuf = Buffer.alloc(4);
  readSync(fd, nlBuf, 0, 4, pos); pos += 4;
  const nameLen = nlBuf.readUInt32LE(0);
  const nameBuf = Buffer.alloc(nameLen);
  readSync(fd, nameBuf, 0, nameLen, pos); pos += nameLen;
  const name = nameBuf.toString('ascii');
  const metaBuf = Buffer.alloc(16);
  readSync(fd, metaBuf, 0, 16, pos); pos += 16;
  const size = Number(metaBuf.readBigUInt64LE(0));
  const offset = Number(metaBuf.readBigUInt64LE(8));
  wadEntries.push({ name, size, offset });
}
const headerEnd = pos;
console.log(`   ${fileCount} file, headerEnd=${headerEnd}`);

// 4. Patch ogni .lin entry in-place
let totalPatched = 0, totalTruncated = 0, filesPatched = 0, processed = 0;

for (const entry of wadEntries) {
  if (!entry.name.endsWith('.lin')) continue;
  
  // Il nome è "Dr1/data/us/script/e00_002_000.lin", il file key è "e00_002_000.lin"
  const fileName = entry.name.split('/').pop();
  const indexMap = byFile.get(fileName);
  if (!indexMap) continue;
  
  processed++;
  
  // Leggi dati originali dal WAD
  const absOffset = headerEnd + entry.offset;
  const dataBuf = Buffer.alloc(entry.size);
  readSync(fd, dataBuf, 0, entry.size, absOffset);
  
  const enc = detectEnc(dataBuf);
  
  // Trova delimitatori ÿ
  const delimiters = [];
  for (let i = 0; i < dataBuf.length - 1; i += 2) {
    const c = readChar(dataBuf, i, enc);
    if (c === 0x00FF) delimiters.push(i);
  }
  
  if (delimiters.length === 0) continue;
  
  // Build regions
  const regions = [];
  if (delimiters[0] > 0) regions.push({ start: 0, end: delimiters[0] });
  for (let i = 0; i < delimiters.length; i++) {
    const start = delimiters[i] + 2;
    const end = (i + 1 < delimiters.length) ? delimiters[i + 1] : dataBuf.length;
    if (start < end) regions.push({ start, end });
  }
  
  // Match entries e patch
  let entryIndex = 0;
  let fileModified = false;
  
  for (const region of regions) {
    const text = cleanEntry(dataBuf, region.start, region.end, enc);
    if (!passesFilter(text)) continue;
    
    const translation = indexMap.get(entryIndex);
    entryIndex++;
    if (!translation) continue;
    
    // Trova dove scrivere: dopo leading \n\r e FE+XX control byte
    let writeStart = region.start;
    
    // Skip \n\r
    while (writeStart < region.end - 1) {
      const c = readChar(dataBuf, writeStart, enc);
      if (c === 0x0A || c === 0x0D) { writeStart += 2; continue; }
      break;
    }
    
    // Gestisci FE+XX control byte
    let hasControlByte = false;
    if (writeStart < region.end - 1) {
      const c = readChar(dataBuf, writeStart, enc);
      if (c >= 0xFE00 && c <= 0xFFFF) {
        hasControlByte = true;
        // Aggiorna il control byte con la prima lettera della traduzione
        const firstChar = translation.translated.charCodeAt(0);
        if (firstChar >= 0x20 && firstChar <= 0x7E) {
          writeChar(dataBuf, writeStart, 0xFE00 | firstChar, enc);
        }
        writeStart += 2;
      }
    }
    
    // Spazio disponibile per il testo
    const availableChars = Math.floor((region.end - writeStart) / 2);
    const translated = translation.translated;
    
    // Se la traduzione inizia con la stessa lettera del control byte, skippa
    let textToWrite = translated;
    if (hasControlByte && textToWrite.length > 0) {
      textToWrite = textToWrite.substring(1); // Prima lettera è nel FE+XX
    }
    
    if (textToWrite.length > availableChars) {
      textToWrite = textToWrite.substring(0, availableChars);
      totalTruncated++;
    }
    
    // Scrivi testo tradotto
    let wpos = writeStart;
    for (let i = 0; i < textToWrite.length && wpos < region.end - 1; i++) {
      writeChar(dataBuf, wpos, textToWrite.charCodeAt(i), enc);
      wpos += 2;
    }
    
    // Pad con null
    while (wpos < region.end - 1) {
      writeChar(dataBuf, wpos, 0, enc);
      wpos += 2;
    }
    
    totalPatched++;
    fileModified = true;
  }
  
  if (fileModified) {
    // Scrivi dati patchati alla stessa posizione nel WAD
    writeSync(fd, dataBuf, 0, entry.size, absOffset);
    filesPatched++;
  }
  
  if (processed % 100 === 0) {
    process.stdout.write(`\r   ${processed} file | ${totalPatched} stringhe patchate`);
  }
}

closeSync(fd);

console.log(`\r   ${processed} file processati`);
console.log('');
console.log('='.repeat(50));
console.log(`✅ WAD PATCHATO IN-PLACE`);
console.log(`   File patchati: ${filesPatched}`);
console.log(`   Stringhe: ${totalPatched} patchate, ${totalTruncated} troncate`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
console.log('');
console.log('Per ripristinare:');
console.log(`   copy "${WAD_BACKUP}" "${WAD_PATH}"`);
