#!/usr/bin/env node
/**
 * gm-strg-probe.js — sonda READ-ONLY sul chunk STRG di un data.win GameMaker.
 *
 * Contesto (06/08/2026): la telemetria mostra patch "success" seguita da boot
 * "failure" su Deltarune (1.14.0 e 1.15.0) e MareQuest (1.15.0). L'ipotesi
 * "glifi non riordinati" è SMENTITA dalla misura: il tag remoto v1.15.0
 * (b6805197, 24/07) non contiene alcun codice glifi. Il sospettato vero è
 * rebuild_same_size in gamemaker_patcher.rs, che riscrive l'INTERO chunk STRG
 * (count + tabella puntatori + dati) sopra queste assunzioni MAI misurate:
 *
 *   A. i dati stringa iniziano ESATTAMENTE a strg_data + 4 + count*4;
 *   B. extract_strings cattura TUTTE le entry della tabella (una entry
 *      scartata → count e tabella riscritti più corti → tutto slitta);
 *   C. le entry sono contigue e ordinate, senza padding di allineamento;
 *   D. ri-encodare in UTF-8 la String decodificata (read_gm_string fa
 *      detection Windows-1252/Shift-JIS) restituisce i byte originali.
 *
 * Questa sonda misura A-D e SIMULA il rebuild identità (zero traduzioni):
 * se anche un solo byte del chunk STRG cambia senza aver tradotto nulla,
 * la corruzione è dimostrata — è la prova d'effetto, non il conteggio.
 *
 * Uso:  node scripts/gm-strg-probe.js "C:\percorso\del\gioco\data.win"
 * Solo lettura: non scrive MAI sul file.
 */

const fs = require('fs');

function die(msg) { console.error('ERRORE: ' + msg); process.exit(1); }

const file = process.argv[2];
if (!file) die('uso: node scripts/gm-strg-probe.js <data.win>');
if (!fs.existsSync(file)) die('file non trovato: ' + file);

const data = fs.readFileSync(file);
console.log(`File: ${file} (${data.length.toLocaleString()} byte)`);

// ── parse IFF: FORM + chunk ──────────────────────────────────────────────
if (data.length < 8 || data.toString('latin1', 0, 4) !== 'FORM') die('non è un data.win (manca FORM)');
const formSize = data.readUInt32LE(4);
const chunks = [];
let pos = 8;
const end = Math.min(8 + formSize, data.length);
while (pos + 8 <= end) {
  const name = data.toString('latin1', pos, pos + 4);
  const size = data.readUInt32LE(pos + 4);
  chunks.push({ name, size, dataOffset: pos + 8 });
  pos += 8 + size;
}
console.log(`Chunk: ${chunks.map(c => c.name).join(' ')}`);

const strg = chunks.find(c => c.name === 'STRG');
if (!strg) die('chunk STRG non trovato');
console.log(`\nSTRG: offset dati ${strg.dataOffset}, size ${strg.size.toLocaleString()}`);

// ── tabella puntatori ────────────────────────────────────────────────────
const count = data.readUInt32LE(strg.dataOffset);
const tableStart = strg.dataOffset + 4;
const tableEnd = tableStart + count * 4;
console.log(`Entry dichiarate: ${count.toLocaleString()}`);

const ptrs = [];
for (let i = 0; i < count; i++) ptrs.push(data.readUInt32LE(tableStart + i * 4));

// ── ASSUNZIONE A: prima entry subito dopo la tabella? ────────────────────
const firstPtr = ptrs.length ? ptrs[0] : 0;
const deltaA = firstPtr - tableEnd;
console.log(`\n[A] fine tabella=${tableEnd}, prima entry=${firstPtr}, delta=${deltaA} ` +
  (deltaA === 0 ? '✅ nessun padding' : `⛔ ${deltaA} byte di scarto: la base del rebuild è SBAGLIATA`));

// ── ASSUNZIONE B: il filtro Rust scarterebbe entry? ──────────────────────
const skipped = ptrs.filter(p => p + 4 > data.length).length;
console.log(`[B] entry che extract_strings scarterebbe (ptr+4 > filesize): ${skipped} ` +
  (skipped === 0 ? '✅' : '⛔ count e tabella verrebbero riscritti più corti: slittamento totale'));

// ── ASSUNZIONE C: contiguità, ordine, padding tra entry ──────────────────
let unsorted = 0, gapTotal = 0, gapEntries = 0, overlap = 0, badNull = 0;
const gapSamples = [];
for (let i = 0; i < count; i++) {
  const p = ptrs[i];
  if (p + 4 > data.length) continue;
  const len = data.readUInt32LE(p);
  const entryEnd = p + 4 + len + 1; // len + chars + null
  if (p + 4 + len < data.length && data[p + 4 + len] !== 0) badNull++;
  if (i + 1 < count) {
    if (ptrs[i + 1] < p) unsorted++;
    const gap = ptrs[i + 1] - entryEnd;
    if (gap > 0) { gapEntries++; gapTotal += gap; if (gapSamples.length < 5) gapSamples.push({ i, gap }); }
    if (gap < 0) overlap++;
  }
}
console.log(`[C] entry fuori ordine: ${unsorted} · con padding dopo: ${gapEntries} (tot ${gapTotal} byte)` +
  (gapSamples.length ? ` es. ${gapSamples.map(s => `#${s.i}+${s.gap}`).join(' ')}` : '') +
  ` · sovrapposte: ${overlap} · null mancanti: ${badNull} ` +
  (unsorted === 0 && overlap === 0 ? '✅ layout sequenziale' : '⛔'));

// ── ASSUNZIONE D: round-trip encoding ────────────────────────────────────
// read_gm_string decodifica (UTF-8 o fallback 1252) e il rebuild ri-encoda in
// UTF-8: contiamo le entry i cui byte NON sono UTF-8 valido (il round-trip ne
// cambierebbe lunghezza e contenuto anche senza traduzione).
let nonUtf8 = 0, nonAscii = 0;
for (let i = 0; i < count; i++) {
  const p = ptrs[i];
  if (p + 4 > data.length) continue;
  const len = data.readUInt32LE(p);
  const raw = data.subarray(p + 4, Math.min(p + 4 + len, data.length));
  if (raw.some(b => b >= 0x80)) {
    nonAscii++;
    try { new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch { nonUtf8++; }
  }
}
console.log(`[D] entry con byte non-ASCII: ${nonAscii} · di cui NON UTF-8 valido (round-trip distruttivo): ${nonUtf8} ` +
  (nonUtf8 === 0 ? '✅' : '⛔ il rebuild le riscriverebbe diverse anche senza tradurre'));

// ── PROVA D'EFFETTO: simulazione rebuild identità (zero traduzioni) ──────
// Replica fedele di rebuild_same_size con translations = nessuna.
(function identityRebuild() {
  const strgDataOffset = strg.dataOffset;
  const oldStrgSize = strg.size;
  // extract_strings: solo entry con ptr+4 <= filesize (come il Rust)
  const entries = [];
  for (let i = 0; i < count; i++) {
    const p = ptrs[i];
    if (p + 4 > data.length) continue;
    const len = data.readUInt32LE(p);
    const raw = data.subarray(p + 4, Math.min(p + 4 + len, data.length));
    // read_gm_string → String → as_bytes(): se UTF-8 valido i byte restano,
    // altrimenti il Rust fa detection/lossy: qui usiamo lossy UTF-8 come proxy.
    let bytes;
    try { new TextDecoder('utf-8', { fatal: true }).decode(raw); bytes = Buffer.from(raw); }
    catch { bytes = Buffer.from(raw.toString('utf8'), 'utf8'); } // lossy
    entries.push({ dataOffset: p, bytes });
  }
  const n = entries.length;
  const tableSize = 4 + n * 4;
  const base = strgDataOffset + tableSize;
  const available = oldStrgSize - tableSize;
  const buf = [];
  const newPtrs = [];
  let truncated = 0, zeroed = 0;
  for (let i = 0; i < n; i++) {
    const nextRel = i + 1 < n ? entries[i + 1].dataOffset - base : available;
    const space = nextRel - buf.length;
    if (space < 5) {
      zeroed++;
      newPtrs.push(base + buf.length);
      buf.push(0, 0, 0, 0, 0);
      while (buf.length < nextRel) buf.push(0);
      continue;
    }
    let text = entries[i].bytes;
    if (text.length > space - 5) { truncated++; text = text.subarray(0, space - 5); }
    newPtrs.push(base + buf.length);
    const lenB = Buffer.alloc(4); lenB.writeUInt32LE(text.length);
    buf.push(...lenB, ...text, 0);
    while (buf.length < nextRel) buf.push(0);
  }
  const body = Buffer.from(buf.slice(0, available));
  const padded = Buffer.concat([body, Buffer.alloc(Math.max(0, available - body.length))]);
  const newStrg = Buffer.alloc(oldStrgSize);
  newStrg.writeUInt32LE(n, 0);
  for (let i = 0; i < n; i++) newStrg.writeUInt32LE(newPtrs[i], 4 + i * 4);
  padded.copy(newStrg, tableSize);

  const original = data.subarray(strgDataOffset, strgDataOffset + oldStrgSize);
  let diff = 0, firstDiff = -1;
  for (let i = 0; i < oldStrgSize; i++) {
    if (original[i] !== newStrg[i]) { diff++; if (firstDiff < 0) firstDiff = i; }
  }
  console.log(`\n[PROVA D'EFFETTO] rebuild identità (zero traduzioni):`);
  console.log(`  entry ricostruite ${n}/${count} · troncate ${truncated} · azzerate ${zeroed}`);
  if (diff === 0) {
    console.log('  ✅ chunk BYTE-IDENTICO: su questo file il writer è innocuo da fermo');
  } else {
    console.log(`  ⛔ ${diff.toLocaleString()} byte DIVERSI su ${oldStrgSize.toLocaleString()} ` +
      `(primo a offset relativo ${firstDiff}${firstDiff < tableSize ? ', DENTRO count/tabella puntatori' : ''})`);
    console.log('  → il patcher CORROMPE il data.win anche senza tradurre nulla: causa boot failure plausibile');
  }
})();

// ── CENSIMENTO FILTRO RELEASE ────────────────────────────────────────────
// Replica ESATTA di is_translatable al tag remoto v1.15.0 (b6805197): sono le
// stringhe che la release manda all'AI e riscrive nel data.win. Il rebuild
// identità sopra è innocuo, quindi il sospetto si sposta QUI: un letterale
// portante (chiave GML, nome risorsa, parola confrontata con ==) tradotto in
// cirillico rompe il gioco senza corrompere il file.
function isTranslatableRelease(s0) {
  const s = s0.trim();
  if (s.length < 3) return false;
  if (s !== '' && !isNaN(Number(s))) return false;                    // numero puro
  if (s.includes('/') || s.includes('\\')) return false;              // path
  const lower = s.toLowerCase();
  for (const ext of ['.ogg','.wav','.mp3','.png','.jpg','.gif','.bmp','.json','.csv','.xml','.ini','.txt','.gml','.yy','.yyp'])
    if (lower.endsWith(ext)) return false;
  if (s.startsWith('.') && s.length < 10) return false;
  if (s.startsWith('#') && s.length <= 9 && [...s.slice(1)].every(c => /[0-9a-fA-F]/.test(c))) return false;
  if (![...s].some(c => /\p{L}/u.test(c))) return false;              // nessuna lettera
  if (s.length > 5000) return false;
  if (s.includes('var ') && s.includes(';')) return false;
  if (s.includes('function(') || s.includes('if (') || s.includes('while (')) return false;
  if (s.includes('&&') || s.includes('||') || s.includes('!=')) return false;
  if (s.includes('global.') || s.includes('self.') || s.includes('other.')) return false;
  if (lower.startsWith('@@') || lower.startsWith('$$')) return false;
  const prefixes = ['gml_','scr_','obj_','spr_','snd_','rm_','bg_','fnt_','tl_','seq_','ds_','ev_','__',
    's_','scard_','shaus_','smenu_','smap_','shud_','ssumm_','nes_','sfx_','ost_','voc_','ness_','char_',
    'menu_','menut_','audiogroup_','pattern_','cardgod_','sprite','sound','font','path','timeline','object','room',
    'vk_','mb_','cr_','os_','gp_','buffer_'];
  for (const p of prefixes) if (lower.startsWith(p)) return false;
  if (!s.includes(' ')) {
    if (s.includes('_')) return false;
    const ch = [...s];
    for (let i = 1; i < ch.length; i++)
      if (ch[i-1] === ch[i-1].toLowerCase() && ch[i-1] !== ch[i-1].toUpperCase() &&
          ch[i] === ch[i].toUpperCase() && ch[i] !== ch[i].toLowerCase()) return false; // camelCase
    for (const p of ['new_','combat_','select_','theme_','terminal_'])
      if (lower.startsWith(p)) return false;
    return true;
  }
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.every(w => w.includes('_'))) return false;
  return true;
}

(function censimentoFiltro() {
  const pass = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const p = ptrs[i];
    if (p + 4 > data.length) continue;
    const len = data.readUInt32LE(p);
    if (len === 0 || len > 5001) continue;
    const s = data.toString('utf8', p + 4, Math.min(p + 4 + len, data.length));
    if (isTranslatableRelease(s)) { pass.push(s); if (!seen.has(s)) seen.add(s); }
  }
  const singole = pass.filter(s => !s.trim().includes(' '));
  const singoleUniche = [...new Set(singole)];
  // Le più sospette: parole singole corte e minuscole — la firma tipica di
  // chiavi/letterali GML confrontati con == ("left", "main", "idle"...).
  const sospette = singoleUniche.filter(s => s.length <= 12 && s === s.toLowerCase()).sort();
  console.log(`\n[FILTRO RELEASE] stringhe che la 1.15.0 manderebbe all'AI e riscriverebbe:`);
  console.log(`  totali ${pass.length.toLocaleString()} (uniche ${seen.size.toLocaleString()}) · parole singole senza spazi ${singole.length.toLocaleString()} (uniche ${singoleUniche.length.toLocaleString()})`);
  console.log(`  SOSPETTE (singole, ≤12 char, tutte minuscole — probabili letterali GML): ${sospette.length}`);
  console.log('  ' + sospette.slice(0, 60).join(' · ') + (sospette.length > 60 ? ' …' : ''));
  if (process.argv.includes('--dump')) {
    const out = 'gm-strg-translatable.txt';
    fs.writeFileSync(out, [...seen].sort().join('\n'));
    console.log(`  elenco completo (uniche) scritto in ${out}`);
  } else {
    console.log('  (rilancia con --dump per scrivere l\'elenco completo in gm-strg-translatable.txt)');
  }
})();

console.log('\nNota: sonda di sola lettura; il data.win non è stato toccato.');
