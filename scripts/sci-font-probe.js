#!/usr/bin/env node
/**
 * Sonda dei FONT Sierra SCI — sola lettura.
 *
 * Serve a rispondere a UNA domanda con una misura invece che con un'ipotesi:
 * il font del gioco arriva oltre il carattere 127? Se sì, «è à ù» si scrivono
 * e basta. Se no, o si iniettano i glifi (come per il cirillico di Deltarune,
 * ADR-005) oppure si scrive «perche'» — ma la scelta va fatta DOPO aver
 * guardato, non prima (lezione American Arcadia).
 *
 * FORMATO FONT SCI0 (risorsa tipo 7), dopo la decompressione:
 *   u16 lowChar/padding · u16 numChars · u16 heightMax
 *   u16 charOffset[numChars]      ← offset di ogni carattere dentro la risorsa
 *   per ogni carattere: u8 width · u8 height · bitmap (righe da ceil(w/8) byte)
 *
 * Uso:  node scripts/sci-font-probe.js "<cartella gioco>" [--render N]
 *       --render N  disegna a caratteri ASCII i glifi del font N (per vedere
 *                   con gli occhi cosa c'è davvero oltre il 127)
 */
const fs = require('fs');
const path = require('path');
const { decomprimi } = require('./lib/sci-decompress');

const TIPO_FONT = 7;

const argv = process.argv.slice(2);
const gameDir = argv.find(a => !a.startsWith('--'));
const rIdx = argv.indexOf('--render');
const renderFont = rIdx >= 0 ? parseInt(argv[rIdx + 1], 10) : null;

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/sci-font-probe.js "<cartella gioco>" [--render N]');
  process.exit(2);
}

const trova = (nome) => {
  const hit = fs.readdirSync(gameDir).find(v => v.toLowerCase() === nome.toLowerCase());
  return hit ? path.join(gameDir, hit) : null;
};
const mapPath = trova('RESOURCE.MAP');
if (!mapPath) { console.error('❌ RESOURCE.MAP non trovato.'); process.exit(1); }
const volumi = fs.readdirSync(gameDir)
  .filter(v => /^resource\.\d{3}$/i.test(v))
  .map(v => ({ num: parseInt(v.slice(-3), 10), path: path.join(gameDir, v) }));

// ── mappa con dedup (233 duplicati su Larry 3: senza dedup si contano font finti) ──
const map = fs.readFileSync(mapPath);
const viste = new Set();
const font = [];
for (let p = 0; p + 6 <= map.length; p += 6) {
  const w = map.readUInt16LE(p);
  if (w === 0xffff) break;
  const d = map.readUInt32LE(p + 2);
  const tipo = (w >> 11) & 0x1f, numero = w & 0x7ff;
  const k = `${tipo}:${numero}`;
  if (viste.has(k)) continue;
  viste.add(k);
  if (tipo === TIPO_FONT) font.push({ numero, volume: (d >> 26) & 0x3f, offset: d & 0x3ffffff });
}

const fdVol = new Map();
for (const v of volumi) fdVol.set(v.num, fs.openSync(v.path, 'r'));

function leggiRisorsa(r) {
  const fd = fdVol.get(r.volume);
  if (fd == null) return null;
  const h = Buffer.alloc(8);
  fs.readSync(fd, h, 0, 8, r.offset);
  const compresso = h.readUInt16LE(2), decompresso = h.readUInt16LE(4), metodo = h.readUInt16LE(6);
  if (!compresso || !decompresso || compresso > 0x20000 || decompresso > 0x20000) return null;
  const src = Buffer.alloc(compresso);
  fs.readSync(fd, src, 0, compresso, r.offset + 8);
  try {
    const d = decomprimi(src, decompresso, metodo);
    return { dati: d.dati.subarray(0, d.scritti), metodo };
  } catch (e) { return { errore: e.message }; }
}

function parseFont(buf) {
  if (buf.length < 6) return null;
  const numChars = buf.readUInt16LE(2);
  const heightMax = buf.readUInt16LE(4);
  if (numChars === 0 || numChars > 512) return null; // valore implausibile: non fingere
  const offsets = [];
  for (let i = 0; i < numChars; i++) {
    const p = 6 + i * 2;
    if (p + 2 > buf.length) return null;
    offsets.push(buf.readUInt16LE(p));
  }
  const glifi = offsets.map((off) => {
    if (off + 2 > buf.length) return null;
    const w = buf[off], h = buf[off + 1];
    if (w > 64 || h > 64) return null;
    return { off, w, h };
  });
  return { numChars, heightMax, glifi, buf };
}

/** Un glifo "vuoto" (larghezza 0 o tutti bit spenti) NON è un carattere disponibile. */
function glifoVuoto(f, g) {
  if (!g || g.w === 0 || g.h === 0) return true;
  const perRiga = Math.ceil(g.w / 8);
  for (let y = 0; y < g.h; y++) {
    for (let b = 0; b < perRiga; b++) {
      const idx = g.off + 2 + y * perRiga + b;
      if (idx < f.buf.length && f.buf[idx] !== 0) return false;
    }
  }
  return true;
}

/**
 * Righe completamente vuote SOPRA il disegno di un glifo.
 * Serve a sapere se c'è posto per l'accento senza ridisegnare la lettera:
 * se una vocale ha ≥2 righe libere in cima, «à» si genera dalla «a».
 */
function righeLibereSopra(f, g) {
  if (!g || !g.w || !g.h) return null;
  const perRiga = Math.ceil(g.w / 8);
  let libere = 0;
  for (let y = 0; y < g.h; y++) {
    let vuota = true;
    for (let b = 0; b < perRiga; b++) {
      const idx = g.off + 2 + y * perRiga + b;
      if (idx < f.buf.length && f.buf[idx] !== 0) { vuota = false; break; }
    }
    if (vuota) libere++; else break;
  }
  return libere;
}

/** Misura lo spazio per gli accenti sulle vocali minuscole e maiuscole. */
function analisiSpazioAccenti(f) {
  const vocali = { a: 97, e: 101, i: 105, o: 111, u: 117, A: 65, E: 69, I: 73, O: 79, U: 85 };
  const out = [];
  for (const [ch, code] of Object.entries(vocali)) {
    if (code >= f.numChars) continue;
    const g = f.glifi[code];
    const libere = righeLibereSopra(f, g);
    if (libere == null) continue;
    out.push({ ch, libere, w: g.w, h: g.h });
  }
  return out;
}

function disegna(f, code) {
  const g = f.glifi[code];
  if (!g) { console.log(`   [${code}] glifo assente`); return; }
  const perRiga = Math.ceil(g.w / 8);
  console.log(`   [${code}] ${String.fromCharCode(code)}  ${g.w}x${g.h}`);
  for (let y = 0; y < g.h; y++) {
    let riga = '      ';
    for (let x = 0; x < g.w; x++) {
      const byte = f.buf[g.off + 2 + y * perRiga + (x >> 3)] || 0;
      riga += (byte & (0x80 >> (x & 7))) ? '█' : '·';
    }
    console.log(riga);
  }
}

// ── caratteri che servono all'italiano ──────────────────────────────────────
const ACCENTI = { 'à': 224, 'è': 232, 'é': 233, 'ì': 236, 'ò': 242, 'ù': 249, 'À': 192, 'È': 200 };
// Nella codepage 437 del DOS gli stessi suoni stanno altrove:
const CP437 = { 'à': 133, 'è': 138, 'é': 130, 'ì': 141, 'ò': 149, 'ù': 151 };

console.log(`📂 ${gameDir}`);
console.log(`🔤 Risorse FONT uniche: ${font.length} (numeri: ${font.map(f => f.numero).join(', ')})\n`);

let qualcunoOltre127 = false;
const spazioPerFont = [];
for (const r of font.sort((a, b) => a.numero - b.numero)) {
  const res = leggiRisorsa(r);
  if (!res || res.errore) { console.log(`font.${r.numero}: ⛔ non leggibile (${res?.errore || 'header'})`); continue; }
  const f = parseFont(res.dati);
  if (!f) { console.log(`font.${r.numero}: ⛔ header font non riconosciuto (${res.dati.length} byte)`); continue; }

  const pieni = f.glifi.filter((g, i) => i >= 32 && !glifoVuoto(f, g)).length;
  const oltre127 = f.numChars > 128;
  let accentiPieni = 0;
  const dettaglio = [];
  if (oltre127) {
    for (const [ch, code] of Object.entries(ACCENTI)) {
      if (code < f.numChars && !glifoVuoto(f, f.glifi[code])) { accentiPieni++; dettaglio.push(`${ch}=latin1:${code}`); }
    }
    for (const [ch, code] of Object.entries(CP437)) {
      if (code < f.numChars && !glifoVuoto(f, f.glifi[code])) dettaglio.push(`${ch}=cp437:${code}`);
    }
  }
  if (oltre127) qualcunoOltre127 = true;

  console.log(`font.${String(r.numero).padStart(3, '0')}: ${f.numChars} caratteri · altezza max ${f.heightMax} · ${pieni} glifi disegnati`);
  console.log(`   oltre il 127: ${oltre127 ? `SÌ (fino a ${f.numChars - 1})` : 'NO — solo ASCII'}`);
  if (dettaglio.length) console.log(`   accenti PRESENTI: ${dettaglio.join(' · ')}`);
  else if (oltre127) console.log('   accenti: slot esistenti ma VUOTI (glifi da disegnare)');

  // ── spazio per l'accento ────────────────────────────────────────────────
  // ⚠️ CORREZIONE 05/08/2026: la prima versione faceva il minimo su TUTTE le
  // vocali e dichiarava «zero righe libere» per colpa della «i», che ha 0
  // perché ha il PUNTINO. Ma la «ì» si ottiene SOSTITUENDO il puntino con
  // l'accento: non le serve spazio. Un minimo che mescola casi diversi è un
  // numero che mente. Ora la «i» è contata a parte.
  const sp = analisiSpazioAccenti(f);
  if (sp.length) {
    const min = sp.filter(v => v.ch === v.ch.toLowerCase());
    const mai = sp.filter(v => v.ch === v.ch.toUpperCase());
    const minSenzaI = min.filter(v => v.ch !== 'i');
    const iMin = min.find(v => v.ch === 'i');
    const peggioreMin = minSenzaI.length ? Math.min(...minSenzaI.map(v => v.libere)) : 0;
    const peggioreMai = mai.length ? Math.min(...mai.map(v => v.libere)) : 0;

    console.log(`   spazio sopra le vocali: minuscole ${min.map(v => `${v.ch}:${v.libere}`).join(' ')} · maiuscole ${mai.map(v => `${v.ch}:${v.libere}`).join(' ')}`);
    const vMin = peggioreMin >= 2 ? `✅ à è ò ù generabili (${peggioreMin} righe libere)`
      : peggioreMin === 1 ? '⚠️ à è ò ù con accento a 1 pixel (stretto ma leggibile)'
      : '⛔ à è ò ù non generabili senza alzare il glifo';
    const vI = iMin ? (iMin.libere >= 1 ? ' · ì: ok' : ' · ì: si sostituisce il puntino (non serve spazio)') : '';
    const vMai = mai.length ? (peggioreMai >= 2 ? ' · maiuscole accentate ok'
      : ` · maiuscole accentate NO (${peggioreMai} righe) → usare E'`) : '';
    console.log(`   → ${vMin}${vI}${vMai}`);
    spazioPerFont.push({ font: r.numero, min: peggioreMin, mai: peggioreMai, h: f.heightMax });
  }

  if (renderFont === r.numero) {
    console.log(`\n   ── glifi del font ${r.numero} ──`);
    for (const code of [65, 97, 224, 232, 133, 138]) {
      if (code < f.numChars) disegna(f, code);
    }
  }
}

console.log('\n══ VERDETTO ══');
if (!font.length) {
  console.log('❌ Nessun font trovato: impossibile decidere sugli accenti.');
} else if (!qualcunoOltre127) {
  console.log('⛔ Nessun font arriva oltre il carattere 127: «è à ù» NON esistono nel gioco.');
  const okMin = spazioPerFont.filter(s => s.min >= 2);
  const okMai = spazioPerFont.filter(s => s.mai >= 2);
  console.log(`   MINUSCOLE accentate (à è ò ù): generabili in ${okMin.length}/${spazioPerFont.length} font` +
    (okMin.length ? ` — ${okMin.map(s => `font.${s.font}`).join(', ')}` : ''));
  console.log(`   MAIUSCOLE accentate (À È):     generabili in ${okMai.length}/${spazioPerFont.length} font` +
    (okMai.length < spazioPerFont.length ? " — dove non entrano si scrive E' (convenzione tipografica corretta)" : ''));
  console.log('   ì: si ottiene sostituendo il puntino, non richiede spazio.');
  console.log('\n   Vie possibili: (a) senza accenti («perche\'», «e\'») — sicuro e subito;');
  console.log('                  (b) iniezione dei glifi + patch della risorsa font (canale .FON già provato):');
  console.log('                      minuscole accentate vere, È scritto E\'.');
} else {
  console.log('✅ Almeno un font supera il 127: gli accenti sono possibili.');
  console.log('   Verificare quali slot sono DISEGNATI (sopra) e con quale codifica il gioco li mappa');
  console.log('   — scrivere il byte giusto (latin1 vs cp437) è la differenza fra «è» e un glifo a caso.');
}
for (const fd of fdVol.values()) fs.closeSync(fd);
