#!/usr/bin/env node
/**
 * Sonda in SOLA LETTURA delle risorse Sierra SCI (RESOURCE.MAP + RESOURCE.00x).
 *
 * Perché esiste (05/08/2026, Leisure Suit Larry 3): prima di progettare un
 * traduttore per i giochi Sierra bisogna sapere COSA c'è davvero dentro —
 * quante risorse, di che tipo, quante compresse e con quale metodo, e dove
 * stanno i testi (risorse TEXT separate o stringhe dentro gli SCRIPT).
 * È la lezione di American Arcadia: le ipotesi sul formato cadono alla prova,
 * quindi si misura prima di scrivere una riga di writer.
 *
 * Uso:  node scripts/sci-resource-probe.js "<cartella del gioco>" [--dump <dir>]
 *       --dump  estrae le risorse NON compresse di testo in una cartella
 *
 * Non modifica NULLA nel gioco.
 */
const fs = require('fs');
const path = require('path');

// ── tipi risorsa SCI0/SCI1 ──────────────────────────────────────────────────
const TIPI = ['view', 'pic', 'script', 'text', 'sound', 'memory', 'vocab', 'font',
  'cursor', 'patch', 'bitmap', 'palette', 'cdaudio', 'audio', 'sync', 'message',
  'map', 'heap', 'audio36', 'sync36', 'xlate', 'robot', 'vmd', 'chunk', 'animation'];
const nomeTipo = t => TIPI[t] || `tipo${t}`;

// Metodi di compressione SCI0 (dal header di ogni risorsa)
const METODI = { 0: 'nessuna', 1: 'LZW', 2: 'Huffman(COMP3)', 3: 'LZW1', 4: 'LZW-view' };
const nomeMetodo = m => METODI[m] || `metodo${m}`;

const argv = process.argv.slice(2);
const gameDir = argv.find(a => !a.startsWith('--'));
const dumpIdx = argv.indexOf('--dump');
const dumpDir = dumpIdx >= 0 ? argv[dumpIdx + 1] : null;

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/sci-resource-probe.js "<cartella del gioco>" [--dump <dir>]');
  process.exit(2);
}

// ── trova i file, senza assumere il case (DOS = maiuscolo, Linux sensibile) ──
function trova(nome) {
  const voci = fs.readdirSync(gameDir);
  const hit = voci.find(v => v.toLowerCase() === nome.toLowerCase());
  return hit ? path.join(gameDir, hit) : null;
}
function trovaVolumi() {
  return fs.readdirSync(gameDir)
    .filter(v => /^resource\.\d{3}$/i.test(v))
    .sort()
    .map(v => ({ nome: v, num: parseInt(v.slice(-3), 10), path: path.join(gameDir, v) }));
}

const mapPath = trova('RESOURCE.MAP');
if (!mapPath) {
  console.error('❌ RESOURCE.MAP non trovato: questa cartella non sembra un gioco SCI.');
  process.exit(1);
}
const volumi = trovaVolumi();

console.log(`📂 ${gameDir}`);
console.log(`   RESOURCE.MAP: ${fs.statSync(mapPath).size} byte · volumi: ${volumi.map(v => v.nome).join(', ') || 'NESSUNO'}`);

// ── parsing della MAP ───────────────────────────────────────────────────────
// SCI0: entry da 6 byte, terminate da FF FF FF FF FF FF
//   u16: bit 11-15 = tipo, bit 0-10 = numero
//   u32: bit 26-31 = volume, bit 0-25 = offset
// SCI1: mappa a sezioni per tipo (header di 3 byte per tipo). Riconosciamo la
// variante provando prima SCI0 e verificando che gli offset stiano nei volumi.
const map = fs.readFileSync(mapPath);

function parseSci0(buf) {
  const risorse = [];
  for (let p = 0; p + 6 <= buf.length; p += 6) {
    const w = buf.readUInt16LE(p);
    if (w === 0xffff) break; // terminatore
    const d = buf.readUInt32LE(p + 2);
    risorse.push({
      tipo: (w >> 11) & 0x1f,
      numero: w & 0x7ff,
      volume: (d >> 26) & 0x3f,
      offset: d & 0x3ffffff,
    });
  }
  return risorse;
}

function plausibile(risorse) {
  if (risorse.length < 10) return false;
  const perVol = new Map(volumi.map(v => [v.num, fs.statSync(v.path).size]));
  let dentro = 0;
  for (const r of risorse) {
    const size = perVol.get(r.volume);
    if (size != null && r.offset < size) dentro++;
  }
  return dentro / risorse.length > 0.9; // 90% degli offset dentro un volume vero
}

let risorse = parseSci0(map);
let variante = 'SCI0 (entry 6 byte)';
if (!plausibile(risorse)) {
  console.log('   ⚠️ Il parsing SCI0 non regge (offset fuori dai volumi): probabile SCI1+ a sezioni.');
  console.log('      Questa sonda gestisce per ora solo SCI0 — fermo qui invece di dare numeri falsi.');
  process.exit(1);
}

console.log(`\n✅ Mappa letta come ${variante}: ${risorse.length} risorse`);

// ── conteggio per tipo ──────────────────────────────────────────────────────
const perTipo = new Map();
for (const r of risorse) {
  const k = nomeTipo(r.tipo);
  perTipo.set(k, (perTipo.get(k) || 0) + 1);
}
console.log('\n📊 Risorse per tipo:');
for (const [k, n] of [...perTipo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k.padEnd(10)} ${String(n).padStart(4)}`);
}

// ── header delle risorse: dimensioni e COMPRESSIONE ─────────────────────────
// Header SCI0 nel volume: u16 id · u16 compressedSize · u16 decompressedSize · u16 metodo
const fdVol = new Map();
for (const v of volumi) { try { fdVol.set(v.num, fs.openSync(v.path, 'r')); } catch { /* volume assente */ } }

function leggiHeader(r) {
  const fd = fdVol.get(r.volume);
  if (fd == null) return null;
  const b = Buffer.alloc(8);
  try { fs.readSync(fd, b, 0, 8, r.offset); } catch { return null; }
  return {
    id: b.readUInt16LE(0),
    compresso: b.readUInt16LE(2),
    decompresso: b.readUInt16LE(4),
    metodo: b.readUInt16LE(6),
    dataOffset: r.offset + 8,
  };
}

const compressione = new Map();
let headerLetti = 0, headerRotti = 0;
for (const r of risorse) {
  const h = leggiHeader(r);
  if (!h) { headerRotti++; continue; }
  r.header = h;
  headerLetti++;
  const k = nomeMetodo(h.metodo);
  compressione.set(k, (compressione.get(k) || 0) + 1);
}

console.log(`\n🗜️  Compressione (${headerLetti} header letti, ${headerRotti} non leggibili):`);
for (const [k, n] of [...compressione.entries()].sort((a, b) => b[1] - a[1])) {
  const pct = (n / headerLetti * 100).toFixed(0);
  console.log(`   ${k.padEnd(16)} ${String(n).padStart(4)}  (${pct}%)`);
}

// ── i TESTI: dove sono e sono leggibili? ────────────────────────────────────
const IDX_TEXT = TIPI.indexOf('text');
const IDX_SCRIPT = TIPI.indexOf('script');
const IDX_MESSAGE = TIPI.indexOf('message');
const IDX_FONT = TIPI.indexOf('font');

function leggiDati(r) {
  const fd = fdVol.get(r.volume);
  if (fd == null || !r.header) return null;
  const n = r.header.compresso;
  if (!n || n > 0x10000) return null;
  const b = Buffer.alloc(n);
  try { fs.readSync(fd, b, 0, n, r.header.dataOffset); } catch { return null; }
  return b;
}

/** Stringhe ASCII stampabili terminate da NUL — il formato dei TEXT SCI0. */
function stringheDa(buf) {
  const out = [];
  let cur = '';
  for (const byte of buf) {
    if (byte === 0) {
      if (cur.length >= 4 && /[a-zA-Z]{3}/.test(cur)) out.push(cur);
      cur = '';
    } else if (byte >= 0x20 && byte < 0x7f) {
      cur += String.fromCharCode(byte);
    } else {
      if (cur.length >= 4 && /[a-zA-Z]{3}/.test(cur)) out.push(cur);
      cur = '';
    }
  }
  if (cur.length >= 4 && /[a-zA-Z]{3}/.test(cur)) out.push(cur);
  return out;
}

for (const [etichetta, idx] of [['TEXT', IDX_TEXT], ['MESSAGE', IDX_MESSAGE], ['SCRIPT', IDX_SCRIPT]]) {
  const lista = risorse.filter(r => r.tipo === idx && r.header);
  if (!lista.length) { console.log(`\n📄 ${etichetta}: nessuna risorsa`); continue; }

  const nonCompresse = lista.filter(r => r.header.metodo === 0);
  console.log(`\n📄 ${etichetta}: ${lista.length} risorse · ${nonCompresse.length} NON compresse (leggibili subito)`);

  // Campione di testo vero da quelle non compresse — prova di effetto
  let mostrate = 0;
  for (const r of nonCompresse) {
    if (mostrate >= 3) break;
    const dati = leggiDati(r);
    if (!dati) continue;
    const str = stringheDa(dati).filter(s => s.length > 12 && / /.test(s));
    if (!str.length) continue;
    console.log(`   ${etichetta.toLowerCase()}.${String(r.numero).padStart(3, '0')} (${r.header.decompresso} byte, ${str.length} stringhe):`);
    for (const s of str.slice(0, 3)) console.log(`      “${s.length > 88 ? s.slice(0, 88) + '…' : s}”`);
    mostrate++;
  }
  if (mostrate === 0 && nonCompresse.length) {
    console.log('   ⚠️ Nessun testo leggibile nelle non compresse: i testi stanno nelle compresse.');
  }

  if (dumpDir && nonCompresse.length) {
    const dest = path.join(dumpDir, etichetta.toLowerCase());
    fs.mkdirSync(dest, { recursive: true });
    let n = 0;
    for (const r of nonCompresse) {
      const dati = leggiDati(r);
      if (dati) { fs.writeFileSync(path.join(dest, `${String(r.numero).padStart(3, '0')}.bin`), dati); n++; }
    }
    console.log(`   💾 ${n} risorse scritte in ${dest}/`);
  }
}

// ── font: serve per decidere gli accenti ────────────────────────────────────
const font = risorse.filter(r => r.tipo === IDX_FONT);
console.log(`\n🔤 FONT: ${font.length} risorse` + (font.length ? ` (numeri: ${font.map(f => f.numero).join(', ')})` : ''));
console.log('   Servirà per decidere gli accenti: un font SCI dichiara il numero di caratteri,');
console.log('   e se si ferma a 127 gli accenti italiani non esistono e vanno aggiunti.');

// ── verdetto onesto ─────────────────────────────────────────────────────────
const testiTot = risorse.filter(r => r.tipo === IDX_TEXT || r.tipo === IDX_MESSAGE).length;
const compresseTesti = risorse.filter(r => (r.tipo === IDX_TEXT || r.tipo === IDX_MESSAGE) && r.header && r.header.metodo !== 0).length;

console.log('\n══ VERDETTO ══');
if (testiTot === 0) {
  console.log('⚠️ Nessuna risorsa TEXT/MESSAGE: i dialoghi stanno DENTRO gli SCRIPT (tipico SCI0 primissimi).');
  console.log('   La traduzione richiede di patchare le stringhe dentro le risorse script — più delicato.');
} else if (compresseTesti === 0) {
  console.log(`✅ ${testiTot} risorse di testo, TUTTE non compresse: si leggono e si riscrivono senza decoder.`);
} else {
  console.log(`⚠️ ${testiTot} risorse di testo, di cui ${compresseTesti} COMPRESSE: serve il decoder (LZW/Huffman SCI).`);
}
for (const fd of fdVol.values()) fs.closeSync(fd);
