/**
 * Danganronpa LIN Rebuilder v4
 * 
 * RICOSTRUISCE i file .lin da zero con testo tradotto completo.
 * I file .lin sono loose (non in PAK/WAD), quindi possiamo cambiare la dimensione.
 * 
 * Formato: UTF-16 (BE/LE auto-detect) con ÿ (U+00FF) come delimitatore entry.
 * Ogni entry dopo ÿ ha un byte FE+XX di controllo dove XX è la prima lettera.
 * Il testo interno usa \n come line-wrap visivo.
 * 
 * Approccio: parse raw entries → match per indice → sostituisci testo → ricostruisci file.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const SCRIPT_DIR = join(GAME_PATH, 'Dr1', 'data', 'us', 'script');
const BACKUP_DIR = join(GAME_PATH, 'GameStringer_Translation', 'backup_lin');
const TRANSLATIONS_FILE = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');
const LINE_WIDTH = 40; // Caratteri per riga nel text box del gioco

/** Auto-detect UTF-16 endianness */
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

/** Read UTF-16 char */
function readChar(buf, pos, enc) {
  if (pos + 1 >= buf.length) return 0;
  return enc === 'BE' ? (buf[pos] << 8) | buf[pos+1] : buf[pos] | (buf[pos+1] << 8);
}

/** Decode buffer region to string */
function decodeRegion(buf, start, end, enc) {
  let s = '';
  for (let i = start; i < end - 1; i += 2) {
    const c = readChar(buf, i, enc);
    s += String.fromCharCode(c);
  }
  return s;
}

/** Encode string to UTF-16 buffer */
function encodeUTF16(str, enc) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (enc === 'BE') {
      buf[i*2] = (c >> 8) & 0xFF;
      buf[i*2+1] = c & 0xFF;
    } else {
      buf[i*2] = c & 0xFF;
      buf[i*2+1] = (c >> 8) & 0xFF;
    }
  }
  return buf;
}

/** Pulisci testo entry come fa l'estrazione Rust */
function cleanEntry(raw) {
  let text = raw.replace(/^\n+|\r+/g, '');
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

/** Passa filtro estrazione? */
function passesFilter(text) {
  return text.length >= 3 && text.length <= 2000 && /[a-zA-Z]/.test(text);
}

/** Word-wrap testo italiano per il text box del gioco */
function wordWrap(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line.length + word.length + 1 > maxWidth && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * Ricostruisce un entry con testo tradotto, preservando il formato binario.
 * - Mantiene il FE+XX control byte con la nuova prima lettera
 * - Aggiunge line-wrap \n come l'originale
 */
function buildTranslatedEntry(originalRaw, translatedText) {
  // Trim leading newlines dall'originale
  let prefix = '';
  let i = 0;
  while (i < originalRaw.length && (originalRaw[i] === '\n' || originalRaw[i] === '\r')) {
    prefix += originalRaw[i];
    i++;
  }
  
  // Check se c'è un FE+XX / FF+XX control byte
  let hasControlByte = false;
  if (i < originalRaw.length) {
    const c = originalRaw.charCodeAt(i);
    if (c >= 0xFE00 && c <= 0xFFFF) {
      hasControlByte = true;
    }
  }
  
  // Word-wrap il testo tradotto
  const wrapped = wordWrap(translatedText, LINE_WIDTH);
  
  // Ricostruisci: prefix + [control byte con nuova prima lettera] + testo wrapped
  let result = prefix;
  
  if (hasControlByte && wrapped.length > 0) {
    // Crea nuovo control byte FE+XX dove XX è la prima lettera della traduzione
    const firstChar = wrapped.charCodeAt(0);
    if (firstChar >= 0x20 && firstChar <= 0x7E) {
      result += String.fromCharCode(0xFE00 | firstChar);
      result += wrapped.substring(1);
    } else {
      result += wrapped;
    }
  } else {
    result += wrapped;
  }
  
  return result;
}

console.log('🎮 Danganronpa LIN Rebuilder v4 (full rebuild)');
console.log('='.repeat(50));

// 1. Carica traduzioni
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

// 2. Backup e ripristino
mkdirSync(BACKUP_DIR, { recursive: true });
let backedUp = 0, restored = 0;
for (const linFile of byFile.keys()) {
  const src = join(SCRIPT_DIR, linFile);
  const bak = join(BACKUP_DIR, linFile);
  if (existsSync(src) && !existsSync(bak)) { copyFileSync(src, bak); backedUp++; }
  if (existsSync(bak)) { copyFileSync(bak, src); restored++; }
}
console.log(`💾 ${backedUp} nuovi backup, ${restored} ripristinati`);

// 3. Ricostruisci file LIN
let totalPatched = 0, filesPatched = 0, filesSkipped = 0, processed = 0;

for (const [linFile, indexMap] of byFile) {
  processed++;
  const bakPath = join(BACKUP_DIR, linFile);
  const linPath = join(SCRIPT_DIR, linFile);
  
  if (!existsSync(bakPath)) { filesSkipped++; continue; }
  
  const buf = readFileSync(bakPath);
  if (buf.length < 4) { filesSkipped++; continue; }
  
  const enc = detectEncoding(buf);
  
  // Decode intero file come stringa Unicode
  const fullText = decodeRegion(buf, 0, buf.length, enc);
  
  // Split per ÿ (U+00FF)
  const rawEntries = fullText.split('\u00FF');
  
  if (rawEntries.length <= 1) { filesSkipped++; continue; }
  
  // Mappa entry a indici filtrati (stessa logica dell'estrazione Rust)
  let filteredIndex = 0;
  let fileModified = false;
  const newEntries = [];
  
  for (let e = 0; e < rawEntries.length; e++) {
    const raw = rawEntries[e];
    const cleaned = cleanEntry(raw);
    
    if (passesFilter(cleaned)) {
      // Questa entry ha un indice nell'estrazione
      const translation = indexMap.get(filteredIndex);
      
      if (translation) {
        // Sostituisci con testo tradotto
        const rebuilt = buildTranslatedEntry(raw, translation.translated);
        newEntries.push(rebuilt);
        totalPatched++;
        fileModified = true;
      } else {
        newEntries.push(raw); // Nessuna traduzione, mantieni originale
      }
      filteredIndex++;
    } else {
      newEntries.push(raw); // Entry non filtrata, mantieni com'è
    }
  }
  
  if (fileModified) {
    // Ricostruisci file: unisci con ÿ e ricodifica in UTF-16
    const newText = newEntries.join('\u00FF');
    const newBuf = encodeUTF16(newText, enc);
    writeFileSync(linPath, newBuf);
    filesPatched++;
  }
  
  if (processed % 100 === 0) {
    const pct = ((processed / byFile.size) * 100).toFixed(0);
    process.stdout.write(`\r   ${pct}% | ${filesPatched} file | ${totalPatched} stringhe`);
  }
}

console.log('');
console.log('='.repeat(50));
console.log(`✅ REBUILD COMPLETATO`);
console.log(`   File ricostruiti: ${filesPatched}/${byFile.size} (${filesSkipped} skippati)`);
console.log(`   Stringhe tradotte: ${totalPatched} (ZERO troncate!)`);
console.log('');
console.log('🎮 Avvia Danganronpa su Steam per testare!');
console.log('');
console.log('Per ripristinare gli originali:');
console.log(`   xcopy /Y /E "${BACKUP_DIR}\\*" "${SCRIPT_DIR}\\"`);
