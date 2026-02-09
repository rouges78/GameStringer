/**
 * Danganronpa LIN Binary Patcher v3
 * 
 * DR1 .lin files sono testo UTF-16 (BE o LE) con ÿ (U+00FF) come delimitatore entry.
 * L'estrazione Rust: split per ÿ → pulisci (join \n, rimuovi CLT, recupera FE+XX) → filtra → indice sequenziale.
 * 
 * Questo patcher:
 * 1. Legge il binario originale da backup
 * 2. Auto-detect encoding (BE/LE)
 * 3. Trova posizioni byte dei delimitatori ÿ nel binario
 * 4. Mappa entry a traduzioni per indice
 * 5. Sostituisce il contenuto testuale in-place (stesso byte length)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const SCRIPT_DIR = join(GAME_PATH, 'Dr1', 'data', 'us', 'script');
const BACKUP_DIR = join(GAME_PATH, 'GameStringer_Translation', 'backup_lin');
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');

/** Auto-detect UTF-16 endianness: 'BE' or 'LE' */
function detectEncoding(buf) {
  if (buf.length < 2) return 'BE';
  if (buf[0] === 0xFF && buf[1] === 0xFE) return 'LE';
  if (buf[0] === 0xFE && buf[1] === 0xFF) return 'BE';
  
  let beScore = 0, leScore = 0;
  const check = Math.min(buf.length, 40);
  for (let i = 0; i < check - 1; i += 2) {
    if (buf[i] === 0x00 && buf[i+1] >= 0x20 && buf[i+1] <= 0x7E) beScore++;
    if (buf[i+1] === 0x00 && buf[i] >= 0x20 && buf[i] <= 0x7E) leScore++;
  }
  return beScore >= leScore ? 'BE' : 'LE';
}

/** Read a UTF-16 char at byte position */
function readChar(buf, pos, enc) {
  if (pos + 1 >= buf.length) return 0;
  return enc === 'BE' 
    ? (buf[pos] << 8) | buf[pos+1]
    : buf[pos] | (buf[pos+1] << 8);
}

/** Write a UTF-16 char at byte position */
function writeChar(buf, pos, charCode, enc) {
  if (pos + 1 >= buf.length) return;
  if (enc === 'BE') {
    buf[pos] = (charCode >> 8) & 0xFF;
    buf[pos+1] = charCode & 0xFF;
  } else {
    buf[pos] = charCode & 0xFF;
    buf[pos+1] = (charCode >> 8) & 0xFF;
  }
}

/**
 * Find all ÿ (U+00FF) delimiter positions in the binary.
 * Returns byte offsets of each ÿ character.
 */
function findDelimiters(buf, enc) {
  const positions = [];
  for (let i = 0; i < buf.length - 1; i += 2) {
    const c = readChar(buf, i, enc);
    if (c === 0x00FF) positions.push(i);
  }
  return positions;
}

/**
 * Extract text from a byte region, cleaning it the same way as Rust extraction.
 * Returns cleaned text for index matching.
 */
function extractEntryText(buf, start, end, enc) {
  let text = '';
  for (let i = start; i < end - 1; i += 2) {
    const c = readChar(buf, i, enc);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  
  // Trim leading control chars
  text = text.replace(/^[\n\r]+/, '');
  if (!text) return '';
  
  // Recover first letter from FE+XX or FF+XX control byte
  let result = '';
  const first = text.charCodeAt(0);
  if (first >= 0xFE00 && first <= 0xFEFF) {
    const recovered = first & 0xFF;
    if (recovered >= 0x20 && recovered <= 0x7E) result += String.fromCharCode(recovered);
    text = text.substring(1);
  } else if (first >= 0xFF00 && first <= 0xFFFF) {
    const recovered = first & 0xFF;
    if (recovered >= 0x20 && recovered <= 0x7E) result += String.fromCharCode(recovered);
    text = text.substring(1);
  }
  result += text;
  
  // Join internal newlines with spaces (same as Rust extraction)
  result = result.split('\n').map(l => l.trim()).filter(l => l).join(' ');
  
  // Remove CLT tags
  result = result.replace(/<CLT[^>]*>/g, '').replace(/<\/CLT>/g, '');
  
  // Truncate at 3+ consecutive non-Latin chars
  let nonLatinStreak = 0;
  for (let i = 0; i < result.length; i++) {
    const c = result.charCodeAt(i);
    const isLatin = (c >= 0x20 && c <= 0x7E) || (c >= 0x00C0 && c <= 0x024F);
    if (isLatin) { nonLatinStreak = 0; }
    else { nonLatinStreak++; if (nonLatinStreak >= 3) { result = result.substring(0, Math.max(0, i - 2)); break; } }
  }
  
  return result.trim();
}

/**
 * Check if extracted text passes the same filter as Rust extraction.
 */
function passesFilter(text) {
  if (text.length < 3 || text.length > 2000) return false;
  return /[a-zA-Z]/.test(text);
}

console.log('🎮 Danganronpa LIN Patcher v3 (ÿ delimiter)');
console.log('='.repeat(50));

// 1. Carica traduzioni raggruppate per file + line_index
console.log('📖 Caricamento traduzioni...');
const translations = JSON.parse(readFileSync(TRANSLATIONS_FILE, 'utf8'));
const byFile = new Map();
for (const t of translations) {
  if (!t.original || !t.translated || t.original === t.translated || t.original.length < 3) continue;
  if (!byFile.has(t.file)) byFile.set(t.file, new Map());
  byFile.get(t.file).set(t.line_index, t);
}
const totalEntries = [...byFile.values()].reduce((s, m) => s + m.size, 0);
console.log(`   ${totalEntries} stringhe in ${byFile.size} file LIN`);

// 2. Ripristina backup prima di patchare (patch pulita)
mkdirSync(BACKUP_DIR, { recursive: true });
let backedUp = 0, restored = 0;
for (const linFile of byFile.keys()) {
  const src = join(SCRIPT_DIR, linFile);
  const bak = join(BACKUP_DIR, linFile);
  if (existsSync(src) && !existsSync(bak)) { copyFileSync(src, bak); backedUp++; }
  if (existsSync(bak)) { copyFileSync(bak, src); restored++; }
}
console.log(`💾 Backup: ${backedUp} nuovi, ${restored} ripristinati per patch pulita`);

// 3. Patch file LIN
let totalPatched = 0, totalTruncated = 0, filesPatched = 0, filesSkipped = 0, processed = 0;

for (const [linFile, indexMap] of byFile) {
  processed++;
  const linPath = join(SCRIPT_DIR, linFile);
  if (!existsSync(linPath)) { filesSkipped++; continue; }

  const buf = readFileSync(linPath);
  if (buf.length < 4) { filesSkipped++; continue; }
  
  const enc = detectEncoding(buf);
  const delimiters = findDelimiters(buf, enc);
  
  if (delimiters.length === 0) { filesSkipped++; continue; }
  
  // Build entry regions: between consecutive ÿ delimiters
  // Entry 0: from first ÿ+2 to second ÿ (or first ÿ to end if only one)
  // Region before first ÿ might also contain text
  const regions = [];
  
  // Text before first delimiter
  if (delimiters[0] > 0) {
    regions.push({ start: 0, end: delimiters[0] });
  }
  
  // Text after each delimiter
  for (let i = 0; i < delimiters.length; i++) {
    const start = delimiters[i] + 2; // Skip the ÿ char (2 bytes)
    const end = (i + 1 < delimiters.length) ? delimiters[i + 1] : buf.length;
    if (start < end) regions.push({ start, end });
  }
  
  // Extract text from each region and filter (same as Rust)
  let entryIndex = 0;
  let fileModified = false;
  
  for (const region of regions) {
    const text = extractEntryText(buf, region.start, region.end, enc);
    if (!passesFilter(text)) continue;
    
    const entry = indexMap.get(entryIndex);
    entryIndex++;
    if (!entry) continue;
    
    // Verify: cleaned text should match original (fuzzy)
    // Write translated text into the region, starting after any FE+XX control byte
    let writeStart = region.start;
    
    // Skip past leading \n\r bytes
    while (writeStart < region.end - 1) {
      const c = readChar(buf, writeStart, enc);
      if (c === 0x0A || c === 0x0D) { writeStart += 2; continue; }
      break;
    }
    
    // Skip FE+XX / FF+XX control byte (first char recovered separately)
    if (writeStart < region.end - 1) {
      const c = readChar(buf, writeStart, enc);
      if ((c >= 0xFE00 && c <= 0xFFFF)) {
        writeStart += 2;
      }
    }
    
    // Available byte space for text
    const availableBytes = region.end - writeStart;
    const translated = entry.translated;
    const maxChars = Math.floor(availableBytes / 2);
    const textToWrite = translated.length > maxChars 
      ? translated.substring(0, maxChars) 
      : translated;
    
    if (translated.length > maxChars) totalTruncated++;
    
    // Write translated text char by char
    let pos = writeStart;
    for (let i = 0; i < textToWrite.length && pos < region.end - 1; i++) {
      writeChar(buf, pos, textToWrite.charCodeAt(i), enc);
      pos += 2;
    }
    
    // Pad remaining with null bytes
    while (pos < region.end - 1) {
      writeChar(buf, pos, 0, enc);
      pos += 2;
    }
    
    totalPatched++;
    fileModified = true;
  }
  
  if (fileModified) {
    writeFileSync(linPath, buf);
    filesPatched++;
  }
  
  if (processed % 100 === 0) {
    const pct = ((processed / byFile.size) * 100).toFixed(0);
    process.stdout.write(`\r   ${pct}% | ${filesPatched} file | ${totalPatched} stringhe`);
  }
}

console.log('');
console.log('='.repeat(50));
console.log(`✅ PATCH COMPLETATA`);
console.log(`   File patchati: ${filesPatched}/${byFile.size} (${filesSkipped} skippati)`);
console.log(`   Stringhe: ${totalPatched} patchate, ${totalTruncated} troncate`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
console.log('');
console.log('Per ripristinare gli originali:');
console.log(`   xcopy /Y /E "${BACKUP_DIR}\\*" "${SCRIPT_DIR}\\"`);
