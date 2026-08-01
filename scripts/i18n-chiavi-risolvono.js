#!/usr/bin/env node
/**
 * Verifica che ogni `t('ns.key')` usato nel codice ESISTA nei locale.
 *
 * PERCHÉ — una chiave mancante è PEGGIO di una stringa hardcoded: l'utente non
 * vede il testo sbagliato, vede la chiave grezza (`libraryFilters.reset`).
 * È già successo nel forum coi nomi delle categorie. Il gate anti-hardcoded
 * conta le stringhe letterali ma non si accorge di questo: sostituire una
 * stringa con una `t()` che non risolve fa SCENDERE il conteggio e sembra un
 * miglioramento — la stessa forma del "100% con 0 errori".
 *
 * Controlla contro `it.json` (riferimento) e riporta a parte le chiavi che
 * esistono in it ma mancano in altre lingue (lì l'utente vedrà il fallback).
 *
 * Uso:
 *   node scripts/i18n-chiavi-risolvono.js                # tutto app/ e components/
 *   node scripts/i18n-chiavi-risolvono.js file1 file2    # solo alcuni file
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'lib', 'i18n', 'locales');
const ROOTS = ['app', 'components', 'lib', 'hooks'];
const EXTS = new Set(['.tsx', '.ts']);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, out);
    } else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
}

function chiaviDi(obj, prefisso = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj || {})) {
    const full = prefisso ? `${prefisso}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) chiaviDi(v, full, out);
    else out.add(full);
  }
  return out;
}

const locali = {};
for (const f of fs.readdirSync(LOCALES_DIR).filter((x) => x.endsWith('.json'))) {
  const lang = path.basename(f, '.json');
  locali[lang] = chiaviDi(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf8')));
}
const rif = locali['it'];
if (!rif) { console.error('it.json non trovato'); process.exit(2); }

const argFiles = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let files = [];
if (argFiles.length) {
  files = argFiles.map((f) => path.isAbsolute(f) ? f : path.join(ROOT, f));
} else {
  for (const r of ROOTS) walk(path.join(ROOT, r), files);
}

// t('ns.key') / t("ns.key") — solo chiavi letterali (le dinamiche non si verificano).
const RE = /\bt\(\s*['"]([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)+)['"]\s*[,)]/g;

const mancanti = new Map();   // chiave → [file:riga]
const parziali = new Map();   // chiave → [lingue mancanti]
let totaleUsi = 0;
const viste = new Set();

for (const f of files) {
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const righe = src.split('\n');
  righe.forEach((riga, i) => {
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(riga))) {
      const chiave = m[1];
      totaleUsi++;
      viste.add(chiave);
      if (!rif.has(chiave)) {
        const dove = `${path.relative(ROOT, f)}:${i + 1}`;
        if (!mancanti.has(chiave)) mancanti.set(chiave, []);
        mancanti.get(chiave).push(dove);
      }
    }
  });
}

for (const chiave of viste) {
  if (!rif.has(chiave)) continue;
  const senza = Object.entries(locali)
    .filter(([, set]) => !set.has(chiave))
    .map(([l]) => l);
  if (senza.length) parziali.set(chiave, senza);
}

console.log(`File analizzati : ${files.length}`);
console.log(`Usi di t()      : ${totaleUsi}  (chiavi distinte: ${viste.size})`);
console.log(`Chiavi it.json  : ${rif.size}`);
console.log('');

if (mancanti.size) {
  console.error(`❌ ${mancanti.size} chiavi NON esistono in it.json — l'utente vedrebbe la chiave grezza:`);
  for (const [k, dove] of [...mancanti].slice(0, 40)) {
    console.error(`   ${k}   ← ${dove.slice(0, 3).join(', ')}${dove.length > 3 ? ` (+${dove.length - 3})` : ''}`);
  }
  if (mancanti.size > 40) console.error(`   …e altre ${mancanti.size - 40}`);
} else {
  console.log('✅ Tutte le chiavi usate esistono in it.json.');
}

if (parziali.size) {
  console.log(`\n⚠️ ${parziali.size} chiavi esistono in it ma MANCANO in altre lingue (lì scatta il fallback):`);
  for (const [k, langs] of [...parziali].slice(0, 20)) {
    console.log(`   ${k}   manca in: ${langs.join(', ')}`);
  }
  if (parziali.size > 20) console.log(`   …e altre ${parziali.size - 20}`);
}

process.exitCode = mancanti.size ? 1 : 0;
