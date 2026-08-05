#!/usr/bin/env node
/**
 * Estrae i TESTI dalle risorse Sierra SCI0 (RESOURCE.MAP + RESOURCE.00x),
 * decomprimendo LZW/Huffman. Sola lettura: non tocca il gioco.
 *
 * Contesto (05/08/2026, Leisure Suit Larry 3): la sonda ha misurato 985
 * risorse, 163 di tipo TEXT, e l'88% compresso LZW + 9% Huffman — quindi
 * senza decoder non si legge nulla.
 *
 * FORMATO DI UNA RISORSA TEXT SCI0: stringhe ASCII terminate da NUL, una di
 * seguito all'altra. L'indice della stringa dentro la risorsa è ciò che lo
 * script del gioco usa per richiamarla (Print text, N) — quindi la coppia
 * (numero risorsa, indice) è la CHIAVE della traduzione.
 *
 * Uso:
 *   node scripts/sci-extract-texts.js "<cartella gioco>" [--out estratti-larry3]
 *   --raw   salva anche i .bin decompressi (per ispezione)
 *
 * Prova di effetto: un decoder sbagliato non «fallisce», produce spazzatura.
 * Perciò lo script stampa frasi vere e misura la percentuale di byte ASCII
 * stampabili: se scende, il decoder sta mentendo.
 */
const fs = require('fs');
const path = require('path');
const { decomprimi } = require('./lib/sci-decompress');

const TIPI = ['view', 'pic', 'script', 'text', 'sound', 'memory', 'vocab', 'font',
  'cursor', 'patch', 'bitmap', 'palette', 'cdaudio', 'audio', 'sync', 'message'];
const IDX_TEXT = TIPI.indexOf('text');

const argv = process.argv.slice(2);
const gameDir = argv.find(a => !a.startsWith('--'));
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const outDir = opt('out', 'estratti-larry3');
const salvaRaw = argv.includes('--raw');

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/sci-extract-texts.js "<cartella gioco>" [--out dir] [--raw]');
  process.exit(2);
}

const trova = (nome) => {
  const hit = fs.readdirSync(gameDir).find(v => v.toLowerCase() === nome.toLowerCase());
  return hit ? path.join(gameDir, hit) : null;
};
const volumi = fs.readdirSync(gameDir)
  .filter(v => /^resource\.\d{3}$/i.test(v))
  .map(v => ({ num: parseInt(v.slice(-3), 10), path: path.join(gameDir, v) }));

const mapPath = trova('RESOURCE.MAP');
if (!mapPath) { console.error('❌ RESOURCE.MAP non trovato.'); process.exit(1); }

// ── mappa SCI0, CON dedup ───────────────────────────────────────────────────
// La mappa può contenere più entry per la stessa risorsa (versioni aggiornate
// accodate). Nella sonda text.021 compariva 3 volte: senza dedup i conteggi
// mentono. Regola SCI: vince la PRIMA occorrenza trovata nella mappa.
const map = fs.readFileSync(mapPath);
const tutte = [];
for (let p = 0; p + 6 <= map.length; p += 6) {
  const w = map.readUInt16LE(p);
  if (w === 0xffff) break;
  const d = map.readUInt32LE(p + 2);
  tutte.push({ tipo: (w >> 11) & 0x1f, numero: w & 0x7ff, volume: (d >> 26) & 0x3f, offset: d & 0x3ffffff });
}
const viste = new Set();
const risorse = [];
let duplicati = 0;
for (const r of tutte) {
  const k = `${r.tipo}:${r.numero}`;
  if (viste.has(k)) { duplicati++; continue; }
  viste.add(k);
  risorse.push(r);
}
console.log(`📖 Mappa: ${tutte.length} entry · ${risorse.length} risorse uniche · ${duplicati} duplicate (versioni accodate)`);

// ── lettura + decompressione delle TEXT ─────────────────────────────────────
const fdVol = new Map();
for (const v of volumi) fdVol.set(v.num, fs.openSync(v.path, 'r'));

function leggiRisorsa(r) {
  const fd = fdVol.get(r.volume);
  if (fd == null) return null;
  const h = Buffer.alloc(8);
  fs.readSync(fd, h, 0, 8, r.offset);
  const compresso = h.readUInt16LE(2);
  const decompresso = h.readUInt16LE(4);
  const metodo = h.readUInt16LE(6);
  if (!compresso || compresso > 0x20000 || !decompresso || decompresso > 0x20000) return null;
  const src = Buffer.alloc(compresso);
  fs.readSync(fd, src, 0, compresso, r.offset + 8);
  return { src, decompresso, metodo };
}

/** Stringhe NUL-terminate: è il formato delle risorse TEXT SCI0. */
function stringheDa(buf) {
  const out = [];
  let cur = [];
  for (const b of buf) {
    if (b === 0) { if (cur.length) out.push(Buffer.from(cur).toString('latin1')); cur = []; }
    else cur.push(b);
  }
  if (cur.length) out.push(Buffer.from(cur).toString('latin1'));
  return out;
}

const testi = risorse.filter(r => r.tipo === IDX_TEXT).sort((a, b) => a.numero - b.numero);
console.log(`📄 Risorse TEXT uniche: ${testi.length}`);

const risultato = {};   // "text.NNN" → [stringhe]
let okRis = 0, koRis = 0, totStr = 0, byteTot = 0, byteAscii = 0;
const errori = new Map();

for (const r of testi) {
  const raw = leggiRisorsa(r);
  if (!raw) { koRis++; errori.set('header illeggibile', (errori.get('header illeggibile') || 0) + 1); continue; }
  let dec;
  try {
    dec = decomprimi(raw.src, raw.decompresso, raw.metodo);
  } catch (e) {
    koRis++;
    const k = e.message.split('(')[0].trim();
    errori.set(k, (errori.get(k) || 0) + 1);
    continue;
  }
  const dati = dec.dati.subarray(0, dec.scritti);

  // Misura di onestà: quanta parte è ASCII stampabile? Un decoder rotto crolla.
  for (const b of dati) { byteTot++; if ((b >= 0x20 && b < 0x7f) || b === 0 || b === 0x0a || b === 0x0d) byteAscii++; }

  const str = stringheDa(dati);
  risultato[`text.${String(r.numero).padStart(3, '0')}`] = str;
  totStr += str.length;
  okRis++;

  if (salvaRaw) {
    const d = path.join(outDir, 'raw');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, `text.${String(r.numero).padStart(3, '0')}.bin`), dati);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'testi-estratti.json');
fs.writeFileSync(outFile, JSON.stringify(risultato, null, 1));

// ── verdetto ────────────────────────────────────────────────────────────────
const pctAscii = byteTot ? (byteAscii / byteTot * 100) : 0;
console.log(`\n📊 ${okRis} risorse decompresse, ${koRis} fallite · ${totStr} stringhe · ASCII stampabile: ${pctAscii.toFixed(1)}%`);
if (errori.size) {
  console.log('   Errori:');
  for (const [k, n] of errori) console.log(`   · ${k}: ${n}`);
}

// Campione: la prova che conta
console.log('\n🔎 Campione di testo (se è spazzatura, il decoder è sbagliato):');
let mostrate = 0;
for (const [nome, str] of Object.entries(risultato)) {
  if (mostrate >= 5) break;
  const buone = str.filter(s => s.length > 15 && / /.test(s) && /[a-zA-Z]{3}/.test(s));
  if (!buone.length) continue;
  console.log(`   ${nome} (${str.length} stringhe):`);
  for (const s of buone.slice(0, 2)) console.log(`      “${s.length > 92 ? s.slice(0, 92) + '…' : s}”`);
  mostrate++;
}

console.log(`\n✍️  ${outFile}`);
if (pctAscii > 95 && mostrate > 0) {
  console.log('✅ VERDETTO: decompressione RIUSCITA — testo leggibile, decoder confermato sul campo.');
} else if (mostrate > 0) {
  console.log(`⚠️ VERDETTO: qualcosa si legge ma l'ASCII è solo ${pctAscii.toFixed(1)}% — parte delle risorse esce sporca, guardare prima di tradurre.`);
} else {
  console.log('❌ VERDETTO: nessun testo leggibile — il decoder NON funziona. Non fidarsi dei conteggi qui sopra.');
}
for (const fd of fdVol.values()) fs.closeSync(fd);
