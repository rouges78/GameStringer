#!/usr/bin/env node
/**
 * Gate: dipendenze in package.json che nessuno importa.
 *
 * PERCHÉ ESISTE — il 03/08/2026 ne sono state rimosse **20 in un colpo solo**
 * (commit edee1368): 18 mai importate più i loro @types. Il problema non era
 * rimuoverle, era che si erano accumulate senza che nessuno se ne accorgesse.
 * Una pulizia una tantum senza un gate è una pulizia che si dovrà rifare.
 *
 * ⚠️ IL PUNTO DELICATO, e il motivo per cui questo gate NON cancella niente da
 * solo: una dipendenza può essere usata **senza mai comparire in un import**.
 * Misurato oggi, i due soli "orfani" trovati erano entrambi falsi positivi:
 *   · `autoprefixer` — caricato per NOME da postcss.config.js
 *   · `@types/archiver` — tipi che usa tsc, mai importati esplicitamente
 * Rimuoverli avrebbe rotto la build CSS e il typecheck, con un errore che non
 * assomiglia per niente alla causa.
 *
 * Quindi il gate dice «nessuno la importa», NON «è inutile» — la stessa
 * distinzione del gate dei moduli morti. L'allowlist qui sotto elenca gli usi
 * impliciti CON IL MOTIVO: senza il motivo, fra sei mesi nessuno saprà se una
 * voce è ancora legittima o è un residuo che copre un problema vero.
 *
 * USO:
 *   node scripts/check-orphan-deps.js             # verifica (esce 1 se trova orfani)
 *   node scripts/check-orphan-deps.js --report    # elenca senza fallire
 */
const fs = require('fs');
const path = require('path');

/** Usi impliciti: caricate per nome da un config, o tipi risolti da tsc. */
const USI_IMPLICITI = {
  'autoprefixer': 'plugin PostCSS, caricato per nome da postcss.config.js',
  'postcss-nesting': 'plugin PostCSS, caricato per nome da postcss.config.js',
  'tailwindcss': 'plugin PostCSS + preset, caricato per nome',
  'postcss': 'motore CSS, invocato da Next senza import nel sorgente',
};

const ESTENSIONI = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SALTA = new Set(['node_modules', '.next', '.git', 'dist', 'out', 'target', 'coverage']);

function leggiSorgente(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SALTA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) leggiSorgente(p, acc);
    else if (ESTENSIONI.has(path.extname(e.name))) acc.push(fs.readFileSync(p, 'utf8'));
  }
  return acc;
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dipendenze = Object.keys(pkg.dependencies || {});
const sorgente = leggiSorgente('.').join('\n');

const orfane = [];
for (const dep of dipendenze) {
  // I pacchetti @types/x si usano attraverso `x`: si considerano vivi se il
  // pacchetto che tipizzano è importato (altrimenti sarebbero SEMPRE orfani).
  const nomeDaCercare = dep.startsWith('@types/')
    ? dep.slice(7).replace('__', '/')
    : dep;
  const esc = nomeDaCercare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usato = new RegExp(`['"\`]${esc}(/|['"\`])`).test(sorgente);
  if (!usato && !USI_IMPLICITI[dep]) orfane.push(dep);
}

const soloReport = process.argv.includes('--report');
console.log(`Dipendenze runtime: ${dipendenze.length} · usi impliciti dichiarati: ${Object.keys(USI_IMPLICITI).length}`);

if (orfane.length === 0) {
  console.log('✅ Nessuna dipendenza orfana.');
  process.exit(0);
}

console.log(`\n⚠️ ${orfane.length} dipendenza/e che nessun file importa:`);
orfane.forEach(d => console.log(`  - ${d}`));
console.log(`
Prima di rimuoverle, controlla che non siano usate IMPLICITAMENTE:
  · caricate per nome da un file di configurazione (postcss, eslint, tailwind…)
  · richieste come peer da un altro pacchetto
  · usate solo negli script di build o in CI
Se l'uso è implicito e legittimo, aggiungila a USI_IMPLICITI in questo file
CON IL MOTIVO. Se è davvero morta: npm remove <pacchetto>.`);

process.exit(soloReport ? 0 : 1);
