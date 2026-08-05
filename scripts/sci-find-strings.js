#!/usr/bin/env node
/**
 * Cerca una stringa in TUTTE le risorse SCI (decomprimendole) e dice in quale
 * tipo di risorsa vive. Sola lettura.
 *
 * Perché (05/08/2026, Larry 3 tradotto): dopo aver tradotto le 134 risorse TEXT
 * il gioco parla italiano, ma menu e cornici restano in inglese — «You say…»,
 * «Save Now!», «This game paused.», il menu File/Action/Speed/Sound. Prima di
 * decidere come tradurli bisogna sapere DOVE sono: in SCRIPT (embedded nel
 * bytecode: delicato, la lunghezza potrebbe non essere libera), in VOCAB, o
 * addirittura dentro l'eseguibile SCIV.EXE (fuori dalla portata delle patch).
 * Cercare invece di supporre: è la lezione di American Arcadia.
 *
 * Uso:
 *   node scripts/sci-find-strings.js "<gioco>" "Save Now" "You say" ...
 *   (senza argomenti cerca l'elenco predefinito dei menu di Larry 3)
 */
const fs = require('fs');
const path = require('path');
const { decomprimi } = require('./lib/sci-decompress');

const TIPI = ['view', 'pic', 'script', 'text', 'sound', 'memory', 'vocab', 'font',
  'cursor', 'patch', 'bitmap', 'palette', 'cdaudio', 'audio', 'sync', 'message'];

const argv = process.argv.slice(2);
const gameDir = argv[0];
const cerca = argv.slice(1).length ? argv.slice(1)
  : ['Save Now', 'You say', 'says...', 'This game paused', 'Boss Key', 'Expletive',
     'Retype', 'Screw it', 'Stop your whining', 'Inventory', 'Speed', 'Sound'];

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/sci-find-strings.js "<cartella gioco>" [stringa ...]');
  process.exit(2);
}

const trova = (n) => {
  const h = fs.readdirSync(gameDir).find(v => v.toLowerCase() === n.toLowerCase());
  return h ? path.join(gameDir, h) : null;
};
const mapPath = trova('RESOURCE.MAP');
if (!mapPath) { console.error('❌ RESOURCE.MAP non trovato.'); process.exit(1); }
const volumi = fs.readdirSync(gameDir).filter(v => /^resource\.\d{3}$/i.test(v))
  .map(v => ({ num: parseInt(v.slice(-3), 10), path: path.join(gameDir, v) }));

const map = fs.readFileSync(mapPath);
const viste = new Set(), risorse = [];
for (let p = 0; p + 6 <= map.length; p += 6) {
  const w = map.readUInt16LE(p);
  if (w === 0xffff) break;
  const d = map.readUInt32LE(p + 2);
  const tipo = (w >> 11) & 0x1f, numero = w & 0x7ff, k = `${tipo}:${numero}`;
  if (viste.has(k)) continue;             // dedup: la mappa ha versioni accodate
  viste.add(k);
  risorse.push({ tipo, numero, volume: (d >> 26) & 0x3f, offset: d & 0x3ffffff });
}

const fdVol = new Map();
for (const v of volumi) fdVol.set(v.num, fs.openSync(v.path, 'r'));

const trovate = new Map();   // stringa → [dove]
let esaminate = 0, illeggibili = 0;

for (const r of risorse) {
  const fd = fdVol.get(r.volume);
  if (fd == null) { illeggibili++; continue; }
  const h = Buffer.alloc(8);
  try { fs.readSync(fd, h, 0, 8, r.offset); } catch { illeggibili++; continue; }
  const comp = h.readUInt16LE(2), dec = h.readUInt16LE(4), met = h.readUInt16LE(6);
  if (!comp || !dec || comp > 0x20000 || dec > 0x20000) { illeggibili++; continue; }
  const src = Buffer.alloc(comp);
  try { fs.readSync(fd, src, 0, comp, r.offset + 8); } catch { illeggibili++; continue; }
  let dati;
  try { dati = decomprimi(src, dec, met).dati; } catch { illeggibili++; continue; }
  esaminate++;

  const testo = dati.toString('latin1');
  for (const q of cerca) {
    if (!testo.includes(q)) continue;
    const nome = `${TIPI[r.tipo] || 'tipo' + r.tipo}.${String(r.numero).padStart(3, '0')}`;
    if (!trovate.has(q)) trovate.set(q, []);
    trovate.get(q).push(nome);
  }
}

console.log(`🔎 ${esaminate} risorse esaminate (${illeggibili} non leggibili) · ${cerca.length} stringhe cercate\n`);

const perTipo = new Map();
for (const [q, dove] of trovate) {
  console.log(`   «${q}» → ${dove.slice(0, 6).join(', ')}${dove.length > 6 ? ` … (+${dove.length - 6})` : ''}`);
  for (const d of dove) {
    const t = d.split('.')[0];
    perTipo.set(t, (perTipo.get(t) || 0) + 1);
  }
}

const nonTrovate = cerca.filter(q => !trovate.has(q));
if (nonTrovate.length) {
  console.log(`\n   NON trovate in nessuna risorsa: ${nonTrovate.map(q => `«${q}»`).join(', ')}`);
  console.log('   → stanno nell\'ESEGUIBILE (SCIV.EXE) o nell\'interprete: fuori dalla portata delle patch risorsa.');
}

console.log('\n══ VERDETTO ══');
if (!trovate.size) {
  console.log('⛔ Nessuna delle stringhe cercate è in una risorsa: sono nell\'eseguibile.');
  console.log('   Tradurle richiede di patchare SCIV.EXE — possibile ma solo a parità di lunghezza,');
  console.log('   e va deciso a parte (rischio più alto delle patch risorsa, che sono reversibili).');
} else {
  for (const [t, n] of perTipo) console.log(`   ${n} occorrenze in risorse di tipo ${t.toUpperCase()}`);
  if (perTipo.has('script')) {
    console.log('\n   ⚠️ Le stringhe negli SCRIPT sono dentro il bytecode: si possono riscrivere,');
    console.log('   ma la risorsa va ricostruita per intero e gli offset interni potrebbero dipendere');
    console.log('   dalla lunghezza. Prima di tradurne 100, provarne UNA col marcatore.');
  }
}
for (const fd of fdVol.values()) fs.closeSync(fd);
