/**
 * Danganronpa WAD Text Extractor
 * 
 * Estrae TUTTO il testo dal WAD in formato JSON traducibile da GameStringer.
 * 
 * Tipi di testo estratti:
 * 1. PAK Type 1 (BOM entries) — testo puro (nomi, descrizioni, UI)
 * 2. PAK Type 2 (.lin entries) — dialoghi con CLT tags
 * 3. Standalone .lin files — dialoghi con CLT tags
 * 
 * Output: JSON array con { file, index, original, context, type }
 * Compatibile con GameStringer per traduzione AI/manuale.
 * 
 * Uso: node extract-wad-text.mjs [wad-path] [output-path]
 */

import { readFileSync, openSync, readSync, closeSync, writeFileSync } from 'fs';
import { basename } from 'path';

// ========== WAD PARSING ==========

function parseWad(path) {
  const fd = openSync(path, 'r');
  let pos = 0;
  const magic = Buffer.alloc(4); readSync(fd, magic, 0, 4, pos); pos += 4;
  if (magic.toString('ascii') !== 'AGAR') {
    throw new Error('Not a valid WAD file (missing AGAR magic)');
  }
  pos += 8; // version
  const extraSzBuf = Buffer.alloc(4); readSync(fd, extraSzBuf, 0, 4, pos); pos += 4;
  const extraHeaderSize = extraSzBuf.readUInt32LE(0);
  if (extraHeaderSize > 0) pos += extraHeaderSize;

  const fcBuf = Buffer.alloc(4); readSync(fd, fcBuf, 0, 4, pos); pos += 4;
  const fileCount = fcBuf.readUInt32LE(0);
  const entries = [];
  for (let i = 0; i < fileCount; i++) {
    const nl = Buffer.alloc(4); readSync(fd, nl, 0, 4, pos); pos += 4;
    const nameLen = nl.readUInt32LE(0);
    const nb = Buffer.alloc(nameLen); readSync(fd, nb, 0, nameLen, pos); pos += nameLen;
    const mb = Buffer.alloc(16); readSync(fd, mb, 0, 16, pos); pos += 16;
    entries.push({
      name: nb.toString('ascii'),
      size: Number(mb.readBigUInt64LE(0)),
      offset: Number(mb.readBigUInt64LE(8))
    });
  }

  // Skip dir table to find dataStart
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
  return { fd, entries, dataStart };
}

function readFileData(fd, dataStart, entry) {
  const buf = Buffer.alloc(entry.size);
  readSync(fd, buf, 0, entry.size, dataStart + entry.offset);
  return buf;
}

// ========== TEXT DECODING ==========

function decodeUTF16LE(buf, start, end) {
  let text = '';
  for (let j = start; j < end - 1; j += 2) {
    const c = buf[j] | (buf[j+1] << 8);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  return text;
}

function stripCLT(text) {
  return text.replace(/<CLT[^>]*>/g, '').replace(/\n/g, ' ').trim();
}

function isReadableText(text) {
  if (text.length < 2) return false;
  // Must have at least some ASCII letters
  const letters = text.replace(/<CLT[^>]*>/g, '').replace(/[^a-zA-Z]/g, '');
  return letters.length >= 2;
}

// ========== LIN TEXT EXTRACTION ==========

function extractLinText(linData, fileName, results) {
  if (linData.length < 16) return;
  const linType = linData.readUInt32LE(0);
  if (linType !== 1 && linType !== 2) return;
  const textBlockOffset = linData.readUInt32LE(8);
  if (textBlockOffset >= linData.length || textBlockOffset < 12) return;
  const textBlock = linData.subarray(textBlockOffset);
  if (textBlock.length < 8) return;
  const textEntryCount = textBlock.readUInt32LE(0);
  if (textEntryCount === 0 || textEntryCount > 5000) return;
  const headerSize = 4 + textEntryCount * 4;
  if (headerSize >= textBlock.length) return;

  for (let i = 0; i < textEntryCount; i++) {
    const off = textBlock.readUInt32LE(4 + i * 4);
    if (off >= textBlock.length) return;
    const end = (i + 1 < textEntryCount) ? textBlock.readUInt32LE(4 + (i+1) * 4) : textBlock.length;
    const entry = textBlock.subarray(off, end);
    if (entry.length < 4) continue;

    const hasBOM = entry[0] === 0xFF && entry[1] === 0xFE;
    const textStart = hasBOM ? 2 : 0;
    const rawText = decodeUTF16LE(entry, textStart, entry.length);
    if (!rawText || rawText.length < 2) continue;

    const cleanText = stripCLT(rawText);
    if (!isReadableText(cleanText)) continue;

    // Detect CLT context (color tags = character dialogue, narration, etc.)
    const hasCLT = /<CLT[^>]*>/.test(rawText);
    
    results.push({
      file: fileName,
      index: i,
      original: cleanText,
      raw: rawText !== cleanText ? rawText : undefined,
      type: 'dialogue',
      context: hasCLT ? 'dialogue_clt' : 'dialogue'
    });
  }
}

// ========== PAK TEXT EXTRACTION ==========

function extractPakText(pakData, fileName, results) {
  if (pakData.length < 8) return;
  const fileCount = pakData.readUInt32LE(0);
  const headerSize = 4 + fileCount * 4;
  if (fileCount === 0 || fileCount > 10000 || headerSize >= pakData.length) return;

  const offsets = [];
  for (let i = 0; i < fileCount; i++) {
    const off = pakData.readUInt32LE(4 + i * 4);
    if (off >= pakData.length) return;
    offsets.push(off);
  }

  for (let i = 0; i < fileCount; i++) {
    const start = offsets[i];
    const end = (i + 1 < fileCount) ? offsets[i + 1] : pakData.length;
    const entry = pakData.subarray(start, end);
    if (entry.length < 4) continue;

    // Check if entry is a .lin file
    if (entry.length >= 16) {
      const possibleType = entry.readUInt32LE(0);
      const possibleTextOff = entry.length >= 12 ? entry.readUInt32LE(8) : 0;
      if ((possibleType === 1 || possibleType === 2) &&
          possibleTextOff > 12 && possibleTextOff < entry.length) {
        // .lin entry inside PAK
        extractLinText(entry, `${fileName}[${i}]`, results);
        continue;
      }
    }

    // Check if entry is pure text (BOM)
    if (entry[0] === 0xFF && entry[1] === 0xFE) {
      const rawText = decodeUTF16LE(entry, 2, entry.length);
      if (!rawText || rawText.length < 2) continue;
      const cleanText = stripCLT(rawText);
      if (!isReadableText(cleanText)) continue;

      results.push({
        file: fileName,
        index: i,
        original: cleanText,
        raw: rawText !== cleanText ? rawText : undefined,
        type: 'text',
        context: 'pak_entry'
      });
    }
  }
}

// ============================================================
const wadPath = process.argv[2];
const outputPath = process.argv[3] || 'extracted_text.json';

if (!wadPath) {
  console.log('Uso: node extract-wad-text.mjs <wad-path> [output-path]');
  console.log('');
  console.log('Esempio:');
  console.log('  node extract-wad-text.mjs "C:\\...\\dr1_data_us.wad" extracted.json');
  process.exit(1);
}

console.log('📖 Danganronpa WAD Text Extractor');
console.log('='.repeat(50));
console.log(`   WAD: ${basename(wadPath)}`);

// Parse WAD
console.log('📦 Parsing WAD...');
const wad = parseWad(wadPath);
console.log(`   ${wad.entries.length} file totali`);

// Find script files
const scriptFiles = wad.entries.filter(e =>
  e.name.includes('/script/') && (e.name.endsWith('.pak') || e.name.endsWith('.lin'))
);
console.log(`   ${scriptFiles.length} file script`);

// Extract text
console.log('🔍 Estrazione testo...');
const results = [];
let processed = 0;

for (const entry of scriptFiles) {
  const data = readFileData(wad.fd, wad.dataStart, entry);

  if (entry.name.endsWith('.pak')) {
    extractPakText(data, entry.name, results);
  } else if (entry.name.endsWith('.lin')) {
    extractLinText(data, entry.name, results);
  }

  processed++;
  if (processed % 200 === 0) {
    process.stdout.write(`\r   ${processed}/${scriptFiles.length} file | ${results.length} stringhe`);
  }
}
closeSync(wad.fd);
console.log(`\r   ${processed}/${scriptFiles.length} file | ${results.length} stringhe estratte`);

// Deduplicate by original text
const uniqueMap = new Map();
for (const r of results) {
  if (!uniqueMap.has(r.original)) {
    uniqueMap.set(r.original, r);
  } else {
    // Keep the one with more context
    const existing = uniqueMap.get(r.original);
    if (!existing.raw && r.raw) uniqueMap.set(r.original, r);
  }
}
const unique = [...uniqueMap.values()];

// Sort by file, then index
unique.sort((a, b) => a.file.localeCompare(b.file) || a.index - b.index);

// Stats
const dialogueCount = unique.filter(r => r.type === 'dialogue').length;
const textCount = unique.filter(r => r.type === 'text').length;
const withCLT = unique.filter(r => r.raw).length;

console.log('');
console.log('📊 Statistiche:');
console.log(`   Stringhe totali estratte: ${results.length}`);
console.log(`   Stringhe uniche: ${unique.length}`);
console.log(`   Dialoghi (.lin): ${dialogueCount}`);
console.log(`   Testo (PAK BOM): ${textCount}`);
console.log(`   Con tag CLT: ${withCLT}`);

// Export as GameStringer-compatible JSON
const output = unique.map(r => ({
  original: r.original,
  translated: '',
  file: r.file,
  index: r.index,
  type: r.type,
  context: r.context,
  ...(r.raw ? { raw: r.raw } : {})
}));

writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
const fileSizeMB = (Buffer.byteLength(JSON.stringify(output, null, 2)) / (1024*1024)).toFixed(1);
console.log('');
console.log(`💾 Esportato: ${outputPath} (${fileSizeMB} MB)`);
console.log(`   ${unique.length} stringhe pronte per la traduzione`);
console.log('');
console.log('📝 Prossimi passi:');
console.log('   1. Importa in GameStringer per traduzione AI/manuale');
console.log('   2. Compila il campo "translated" per ogni stringa');
console.log('   3. Usa patch-wad-v14.mjs per applicare le traduzioni');
