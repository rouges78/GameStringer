#!/usr/bin/env node
/**
 * Priorità della bonifica i18n: separa le stringhe hardcoded ITALIANE dalle
 * inglesi, perché non costano uguale all'utente.
 *
 * PERCHÉ — il pubblico reale di GameStringer è in maggioranza russo, poi
 * inglese, cinese, arabo, ungherese (triage dei 64 feedback, 26/07/2026). Una
 * stringa hardcoded in INGLESE è degrado tollerabile per quasi tutti; una in
 * ITALIANO è testo incomprensibile che spunta nella UI — ed era la segnalazione
 * più frequente in assoluto (7 messaggi). Bonificare in ordine alfabetico di
 * file tratterebbe le due cose allo stesso modo: questo script dice da dove
 * partire per far sparire il difetto che gli utenti hanno davvero segnalato.
 *
 * Uso:
 *   node scripts/i18n-priorita.js              # riepilogo + file peggiori
 *   node scripts/i18n-priorita.js --elenco     # ogni stringa italiana con file:riga
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROOTS = ['app', 'components'];
const EXTS = new Set(['.tsx', '.ts']);
const ATTR = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'tooltip', 'description']);
const CALLS = new Set(['success', 'error', 'info', 'warning', 'message', 'loading', 'alert', 'confirm']);
const LOGGERS = new Set(['clientLogger', 'console', 'logger', 'log']);

const hasLetter = (s) => /[A-Za-zÀ-ÿ]/.test(s);
const meaningful = (s) => {
  const t = s.trim();
  return t.length >= 2 && hasLetter(t) && /[A-Za-zÀ-ÿ].*[A-Za-zÀ-ÿ]/.test(t) && !/^[A-Z0-9_]+$/.test(t);
};

// Riconoscimento italiano: parole funzionali e desinenze che in inglese non
// esistono. Prudente per costruzione — meglio classificare "incerta" una
// italiana che spacciare per italiana una inglese (il verdetto guida il lavoro).
const PAROLE_IT = /\b(il|lo|la|le|gli|un|una|dei|delle|degli|del|della|nel|nella|sul|sulla|con|per|non|che|più|già|anche|come|questo|questa|quando|dove|solo|tutti|tutte|sono|essere|viene|verrà|puoi|devi|serve|manca|trovato|trovati|selezionato|salvato|caricato|impostazioni|traduzione|traduzioni|gioco|giochi|file|cartella|lingua|lingue|stringhe|errore|avviso|attenzione|annulla|conferma|chiudi|apri|salva|elimina|modifica|aggiungi|cerca|nessun|nessuna|prima|dopo|adesso|ora)\b/i;
const DESINENZE_IT = /\w+(zione|zioni|mento|menti|aggio|aggi|tà|ità|ente|ando|endo|ato|ata|ati|ate|uto|uta|ire|are|ere)\b/i;
const PAROLE_EN = /\b(the|and|or|is|are|was|were|this|that|with|for|from|your|you|not|all|any|can|will|has|have|show|hide|select|selected|settings|translation|game|games|file|folder|language|string|strings|error|warning|close|open|save|delete|edit|add|search|none|loading|failed|success)\b/i;

function lingua(s) {
  const t = s.trim();
  const it = PAROLE_IT.test(t) || DESINENZE_IT.test(t);
  const en = PAROLE_EN.test(t);
  if (it && !en) return 'it';
  if (en && !it) return 'en';
  if (it && en) return 'mista';
  return 'incerta';
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, out);
    } else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
}

function scan() {
  const files = [];
  for (const r of ROOTS) {
    const d = path.join(ROOT, r);
    if (fs.existsSync(d)) walk(d, files);
  }
  const trovate = [];
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true,
      f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if ((sf.parseDiagnostics || []).length) continue;
    const rel = path.relative(ROOT, f);
    const riga = (node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const visit = (node) => {
      let testo = null; let tipo = null;
      if (node.kind === ts.SyntaxKind.JsxText) {
        if (meaningful(node.text)) { testo = node.text.trim(); tipo = 'jsx'; }
      } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        if (ATTR.has(node.name.getText()) && meaningful(node.initializer.text)) {
          testo = node.initializer.text; tipo = `attr:${node.name.getText()}`;
        }
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const radice = node.expression.expression.getText().split(/[.([]/)[0].trim();
        if (!LOGGERS.has(radice) && CALLS.has(node.expression.name.getText())
            && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
            && meaningful(node.arguments[0].text)) {
          testo = node.arguments[0].text; tipo = `${radice}.${node.expression.name.getText()}`;
        }
      }
      if (testo) trovate.push({ file: rel, riga: riga(node), tipo, testo, lingua: lingua(testo) });
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return trovate;
}

const trovate = scan();
const per = (l) => trovate.filter((t) => t.lingua === l);
const it = per('it'), en = per('en'), mista = per('mista'), incerta = per('incerta');

if (process.argv.includes('--campione')) {
  // Controllo di onestà del classificatore: mostra un campione di ogni classe.
  // Se fra le "incerte" compare italiano, il conteggio delle italiane è ottimista.
  const mostra = (nome, arr, n = 25) => {
    console.log(`\n=== ${nome} (${arr.length}) — campione di ${Math.min(n, arr.length)} ===`);
    const passo = Math.max(1, Math.floor(arr.length / n));
    for (let i = 0; i < arr.length && i / passo < n; i += passo) {
      console.log(`  ${JSON.stringify(arr[i].testo.slice(0, 70))}`);
    }
  };
  mostra('INCERTE', incerta);
  mostra('ITALIANE', it);
  mostra('INGLESI', en);
} else if (process.argv.includes('--elenco')) {
  for (const t of it) {
    console.log(`${t.file}:${t.riga}  [${t.tipo}]  ${JSON.stringify(t.testo.slice(0, 90))}`);
  }
  console.log(`\n${it.length} stringhe italiane hardcoded.`);
} else {
  console.log(`Totale hardcoded user-facing: ${trovate.length}\n`);
  console.log(`  🔴 ITALIANE  : ${it.length}\t← le vede un utente russo/inglese: è il difetto segnalato 7 volte`);
  console.log(`  🟡 miste     : ${mista.length}`);
  console.log(`  ⚪ incerte   : ${incerta.length}\t(sigle, nomi propri, testo corto)`);
  console.log(`  🟢 inglesi   : ${en.length}\t(degrado tollerabile per la maggioranza)`);
  const conta = {};
  for (const t of it) conta[t.file] = (conta[t.file] || 0) + 1;
  const top = Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log(`\nFile con più stringhe ITALIANE (da bonificare per primi):`);
  for (const [f, n] of top) console.log(`  ${String(n).padStart(3)}  ${f}`);
  console.log(`\nElenco completo: node scripts/i18n-priorita.js --elenco`);
}
