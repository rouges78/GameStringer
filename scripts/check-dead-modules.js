#!/usr/bin/env node
/**
 * Guard anti moduli morti.
 *
 * Un file che nessuno importa costa due volte: la prima quando lo mantieni credendolo
 * vivo, la seconda quando ti fa credere che una funzione esista già. Il 25/07 sono state
 * corrette sei righe in `components/notifications/notification-provider.tsx` (562 righe),
 * mentre `components/providers.tsx` porta il commento «Rimosso NotificationProvider per
 * semplificare»: lavoro speso su un file non montato. Il 26/07 lo stesso fenomeno è
 * emerso lato Rust — tre moduli mai dichiarati in mod.rs, quindi mai compilati
 * (docs/maintenance/2026-07-26-moduli-rust-orfani.md).
 *
 * Lo script costruisce il grafo degli import di app/, components/, lib/, hooks/ e segna
 * i file che nessuno raggiunge. Funziona a ratchet come il gate i18n e quello dei comandi
 * Tauri: la baseline versionata (scripts/.dead-modules-baseline.json) elenca i morti noti,
 * e la CI fallisce se ne compare uno NUOVO — oppure se una voce di baseline è stata
 * risolta (file cancellato o ricollegato) senza aggiornare il file, perché una baseline
 * che non viene mantenuta smette di dire il vero.
 *
 * LIMITI, da conoscere prima di cancellare qualcosa:
 *
 *  - Un import costruito a runtime (`import(`@/components/${name}`)`, un registry che
 *    mappa stringhe a componenti) NON è risolvibile staticamente. Per questo ogni voce
 *    riporta `mentioned`: quante volte il suo percorso appare come testo altrove nel
 *    progetto. `mentioned > 0` significa «verifica a mano prima di toccare».
 *  - Gli entry point di Next (page/layout/route/...) sono esclusi: li carica il framework.
 *  - Questo script dice «nessuno lo importa», non «è inutile». La domanda da farsi resta
 *    quella del 26/07: la funzione che promette esiste già altrove? Se sì si cancella;
 *    se no, forse va collegata.
 *
 * Uso:
 *   node scripts/check-dead-modules.js            # verifica vs baseline
 *   node scripts/check-dead-modules.js --update   # riscrive la baseline
 *   node scripts/check-dead-modules.js --report    # elenco completo, ordinato per righe
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, '.dead-modules-baseline.json');

// Cartelle in cui cerchiamo i moduli morti.
const TARGET_ROOTS = ['app', 'components', 'lib', 'hooks'];
// Cartelle che possono *importare* (anche solo per tenere in vita un modulo).
const SOURCE_ROOTS = [...TARGET_ROOTS, 'scripts', 'src', 'e2e', '__tests__'];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'out', 'target', '.git', 'coverage']);
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const TARGET_EXT = new Set(['.ts', '.tsx']);
const SKIP_FILE = /\.(test|spec|d)\.(ts|tsx|js|jsx)$/;

// Caricati dal framework, non da un import.
const NEXT_ENTRY = /^app\/(.*\/)?(page|layout|template|loading|error|not-found|global-error|route|default|sitemap|robots|manifest|opengraph-image|icon|apple-icon)\.(ts|tsx)$/;
const ROOT_ENTRY = /^(middleware|instrumentation)\.ts$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full, out);
    } else if (!SKIP_FILE.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const stripExt = (f) => f.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const report = args.includes('--report');

  // 1. raccogli i file
  const sources = [];
  for (const r of SOURCE_ROOTS) {
    for (const f of walk(path.join(ROOT, r))) {
      if (SOURCE_EXT.has(path.extname(f))) sources.push(rel(f));
    }
  }
  // config alla radice: possono importare da lib/ (tailwind, next, vitest…)
  for (const f of fs.readdirSync(ROOT)) {
    if (SOURCE_EXT.has(path.extname(f)) && !SKIP_FILE.test(f)) sources.push(f);
  }
  const targets = sources.filter(
    (f) => TARGET_EXT.has(path.extname(f)) && TARGET_ROOTS.some((r) => f.startsWith(r + '/'))
  );

  const body = new Map();
  for (const f of sources) {
    try {
      body.set(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
    } catch {
      body.set(f, '');
    }
  }

  // 2. import risolvibili staticamente: `from '…'`, `import('…')`, `require('…')`
  const reached = new Set();
  const IMPORT_RE = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const f of sources) {
    const src = body.get(f);
    // NB: il filtro deve accettare anche `export { X } from './y'`, altrimenti i barrel
    // di puro re-export (che non contengono la parola "import") vengono saltati e tutto
    // ciò che ri-esportano risulta falsamente morto — è capitato con components/forum.
    if (!src.includes('from') && !src.includes('require')) continue;
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(src)) !== null) {
      let spec = m[1];
      if (spec.startsWith('@/')) spec = spec.slice(2);
      else if (spec.startsWith('.')) spec = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec));
      else continue; // pacchetto npm
      spec = stripExt(spec);
      reached.add(spec);
      reached.add(spec + '/index'); // import di cartella → il suo barrel
    }
  }

  // 3. menzioni testuali: cattura i registry e gli import costruiti a runtime
  const blob = [...body.values()].join('\n');
  const mentions = (f) => {
    const key = stripExt(f);
    // Conta le occorrenze del percorso come testo, meno la definizione stessa.
    // Il carattere successivo deve chiudere il path: senza questo controllo,
    // lib/social/community-hub verrebbe "trovato" 11 volte dentro le citazioni di
    // community-hub-service e community-hub-backend, che sono altri file.
    let n = 0, i = 0;
    while ((i = blob.indexOf(key, i)) !== -1) {
      const after = blob[i + key.length];
      if (!after || !/[A-Za-z0-9_-]/.test(after)) n++;
      i += key.length;
    }
    return Math.max(0, n - 1);
  };

  const dead = [];
  for (const f of targets) {
    if (NEXT_ENTRY.test(f) || ROOT_ENTRY.test(f)) continue;
    const key = stripExt(f);
    if (reached.has(key)) continue;
    if (key.endsWith('/index') && reached.has(key.slice(0, -'/index'.length))) continue;
    dead.push({
      module: f,
      lines: body.get(f).split('\n').length,
      mentioned: mentions(f),
    });
  }
  dead.sort((a, b) => b.lines - a.lines);
  const totalLines = dead.reduce((s, d) => s + d.lines, 0);

  console.log(
    `Moduli: ${targets.length} analizzati · ${dead.length} non raggiunti da nessun import ` +
    `(${totalLines.toLocaleString('it-IT')} righe)`
  );

  const baseline = fs.existsSync(BASELINE_FILE)
    ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    : { known: {} };
  const known = baseline.known || {};

  if (update) {
    const next = { known: {} };
    for (const d of dead) {
      next.known[d.module] =
        known[d.module] ||
        `${d.lines} righe${d.mentioned ? ` · citato ${d.mentioned}× come testo: verificare i registry prima di toccarlo` : ''}`;
    }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 2) + '\n');
    console.log(`✔ baseline aggiornata: ${dead.length} moduli morti noti`);
    return;
  }

  const nuovi = dead.filter((d) => !(d.module in known));
  const risolti = Object.keys(known).filter((m) => !dead.some((d) => d.module === m));

  for (const d of report ? dead : nuovi) {
    const tag = d.module in known ? 'noto ' : 'NUOVO';
    console.log(
      `  [${tag}] ${d.module} (${d.lines} righe${d.mentioned ? `, citato ${d.mentioned}× come testo` : ''})`
    );
  }

  if (nuovi.length) {
    console.error(
      `\n✖ ${nuovi.length} modulo/i che nessuno importa.\n` +
      `  Se è nuovo codice non ancora collegato, collegalo. Se è morto, cancellalo.\n` +
      `  Se è raggiunto da un import dinamico che l'analisi statica non vede:\n` +
      `  node scripts/check-dead-modules.js --update`
    );
    process.exit(1);
  }

  if (risolti.length) {
    console.error(
      `\n✖ baseline non aggiornata: ${risolti.length} voce/i risolta/e ` +
      `(${risolti.slice(0, 5).join(', ')}${risolti.length > 5 ? `, +${risolti.length - 5}` : ''}).\n` +
      `  Esegui: node scripts/check-dead-modules.js --update`
    );
    process.exit(1);
  }

  console.log(`✔ nessun modulo morto nuovo oltre ai ${Object.keys(known).length} già tracciati`);
}

main();
