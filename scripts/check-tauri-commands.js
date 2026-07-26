#!/usr/bin/env node
/**
 * Guard anti `invoke` nel vuoto.
 *
 * TypeScript non sa quali comandi esistano lato Rust: un `invoke('nome_sbagliato')`
 * compila senza un lamento e fallisce solo a runtime, di solito dentro un catch che
 * scrive nel log — cioè un pulsante morto e muto. È così che il pulsante Sfoglia
 * dell'iniettore universale è rimasto rotto per mesi (vedi
 * docs/maintenance/2026-07-25-comandi-tauri-mancanti.md).
 *
 * Questo script confronta i comandi invocati dal frontend con quelli REGISTRATI
 * nel `generate_handler!` di src-tauri/src/main.rs, e li divide in due categorie
 * ben diverse fra loro:
 *
 *   MANCANTE      — nessuna funzione con quel nome esiste lato Rust. Va scritta.
 *   NON REGISTRATO— la funzione `#[tauri::command]` esiste ma non è nel
 *                   generate_handler!, quindi il frontend riceve comunque
 *                   "command not found". Una riga di fix, ma invisibile a occhio.
 *
 * Il secondo caso è il motivo per cui non basta confrontare con le funzioni
 * definite: un comando definito e non registrato è rotto esattamente quanto uno
 * che non esiste.
 *
 * Funziona a "ratchet" come il gate i18n: la baseline versionata
 * (scripts/.tauri-commands-baseline.json) elenca i rotti noti e già tracciati;
 * lo script fallisce (exit 1) solo se compare qualcosa di NUOVO, oppure se una
 * voce di baseline è stata risolta senza aggiornare il file (così la baseline
 * non marcisce).
 *
 * Uso:
 *   node scripts/check-tauri-commands.js            # verifica vs baseline
 *   node scripts/check-tauri-commands.js --update   # riscrive la baseline
 *   node scripts/check-tauri-commands.js --report   # elenco esteso, con i call-site
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOTS = ['app', 'components', 'lib', 'hooks', 'src'];
const RUST_ROOT = path.join(ROOT, 'src-tauri', 'src');
const MAIN_RS = path.join(RUST_ROOT, 'main.rs');
const BASELINE_FILE = path.join(__dirname, '.tauri-commands-baseline.json');

const FRONTEND_EXTS = new Set(['.ts', '.tsx']);
const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', 'out', 'target', '.git',
  '__tests__', '__mocks__', 'e2e', 'tests', 'test',
]);
const SKIP_FILE = /\.(test|spec|d)\.tsx?$/;

// Wrapper che inoltrano a invoke() mantenendo il nome del comando come 1° argomento.
// safeInvoke: lib/tauri-wrapper.ts · invokeCmd: helper locali in alcuni componenti.
const INVOKERS = ['invoke', 'safeInvoke', 'invokeCmd'];

/** File .ts/.tsx sotto le radici del frontend, esclusi test e cartelle generate. */
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
    } else if (FRONTEND_EXTS.has(path.extname(e.name)) && !SKIP_FILE.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function walkRust(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walkRust(full, out);
    } else if (e.name.endsWith('.rs')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Comandi registrati nel generate_handler!.
 * Il blocco è lungo ~1000 righe e contiene path completi
 * (`commands::steam::get_steam_games`): conta solo il segmento finale, che è il
 * nome con cui il frontend invoca. Il blocco viene chiuso contando le parentesi
 * quadre, non cercando la prima `])` — dentro ci sono commenti e cfg.
 */
function registeredCommands() {
  const src = fs.readFileSync(MAIN_RS, 'utf8');
  const start = src.indexOf('generate_handler![');
  if (start === -1) {
    console.error('✖ generate_handler! non trovato in src-tauri/src/main.rs — script da aggiornare.');
    process.exit(2);
  }
  let i = src.indexOf('[', start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const block = src.slice(src.indexOf('[', start) + 1, end === -1 ? src.length : end);
  const names = new Set();
  for (const raw of block.split(',')) {
    // via i commenti di riga, poi tieni l'ultimo segmento del path
    const line = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!line) continue;
    const m = line.match(/([A-Za-z_][A-Za-z_0-9]*)\s*$/);
    if (m) names.add(m[1]);
  }
  return names;
}

/**
 * Funzioni annotate come comando: sia `#[tauri::command]` sia la forma breve
 * `#[command]` (cercare solo la prima dà ~190 falsi negativi). Fra l'attributo e
 * la firma possono esserci altri attributi e `async`/`pub`.
 */
function definedCommands() {
  const defined = new Map(); // nome -> file
  for (const file of walkRust(RUST_ROOT)) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /#\[(?:tauri::)?command[^\]]*\]([\s\S]{0,400}?)fn\s+([a-z_][a-z_0-9]*)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      // fra attributo e fn devono esserci solo altri attributi/modificatori,
      // altrimenti abbiamo agganciato una fn che non è quella annotata
      const between = m[1];
      if (/[;{}]/.test(between)) continue;
      if (!defined.has(m[2])) defined.set(m[2], path.relative(ROOT, file));
    }
  }
  return defined;
}

/** Comandi invocati dal frontend, con i call-site. Solo nomi letterali. */
function invokedCommands() {
  const invoked = new Map(); // nome -> [call-site]
  const invokers = INVOKERS.join('|');
  // invoke('x') · invoke<T>("x") · await safeInvoke(`x`) — generics e spazi opzionali.
  // I template literal con interpolazione (`${...}`) non hanno un nome statico:
  // vengono ignorati di proposito e contati a parte.
  const re = new RegExp(
    `\\b(?:${invokers})\\s*(?:<[^()]*?>)?\\s*\\(\\s*(['"\`])([a-z_][a-z_0-9]*)\\1`,
    'g'
  );
  const dynamicRe = new RegExp(`\\b(?:${invokers})\\s*(?:<[^()]*?>)?\\s*\\(\\s*\`[^\`]*\\$\\{`, 'g');
  let dynamic = 0;

  for (const root of FRONTEND_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      const src = fs.readFileSync(file, 'utf8');
      if (!/invoke/i.test(src)) continue;
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      let m;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        if (!invoked.has(m[2])) invoked.set(m[2], []);
        invoked.get(m[2]).push(`${rel}:${line}`);
      }
      dynamic += (src.match(dynamicRe) || []).length;
    }
  }
  return { invoked, dynamic };
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const report = args.includes('--report');

  const registered = registeredCommands();
  const defined = definedCommands();
  const { invoked, dynamic } = invokedCommands();

  const broken = [];
  for (const [name, sites] of [...invoked].sort()) {
    if (registered.has(name)) continue;
    broken.push({
      command: name,
      kind: defined.has(name) ? 'non-registrato' : 'mancante',
      where: defined.get(name) || null,
      sites,
    });
  }

  console.log(
    `Comandi: ${registered.size} registrati · ${defined.size} definiti · ` +
    `${invoked.size} invocati dal frontend${dynamic ? ` (+${dynamic} invoke dinamici, non verificabili)` : ''}`
  );

  const baseline = fs.existsSync(BASELINE_FILE)
    ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    : { known: {} };
  const known = baseline.known || {};

  if (update) {
    const next = { known: {} };
    for (const b of broken) {
      next.known[b.command] = known[b.command] || `${b.kind} — da triagiare`;
    }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 2) + '\n');
    console.log(`✔ baseline aggiornata: ${broken.length} rotti noti`);
    return;
  }

  const nuovi = broken.filter((b) => !(b.command in known));
  const risolti = Object.keys(known).filter((c) => !broken.some((b) => b.command === c));

  if (report || nuovi.length) {
    const list = report ? broken : nuovi;
    for (const b of list) {
      const tag = b.command in known ? 'noto' : 'NUOVO';
      console.log(`\n  [${tag}] ${b.command} — ${b.kind}${b.where ? ` (definito in ${b.where})` : ''}`);
      for (const s of b.sites.slice(0, 5)) console.log(`      ${s}`);
      if (b.sites.length > 5) console.log(`      … e altri ${b.sites.length - 5}`);
      if (known[b.command]) console.log(`      nota: ${known[b.command]}`);
    }
  }

  if (nuovi.length) {
    console.error(
      `\n✖ ${nuovi.length} comando/i invocato/i che il backend non risolve.\n` +
      `  "mancante" = va scritto lato Rust. "non-registrato" = manca la riga nel\n` +
      `  generate_handler! di src-tauri/src/main.rs (fix di una riga).\n` +
      `  Se è debito accettato consapevolmente: node scripts/check-tauri-commands.js --update`
    );
    process.exit(1);
  }

  if (risolti.length) {
    console.error(
      `\n✖ baseline non aggiornata: ${risolti.length} voce/i risolta/e (${risolti.join(', ')}).\n` +
      `  Esegui: node scripts/check-tauri-commands.js --update`
    );
    process.exit(1);
  }

  console.log(`✔ nessun invoke nel vuoto oltre ai ${Object.keys(known).length} rotti già tracciati`);
}

main();
