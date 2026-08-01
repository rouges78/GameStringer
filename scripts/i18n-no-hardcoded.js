#!/usr/bin/env node
/**
 * Guard anti testo hardcoded (regola: nessuna stringa user-facing hardcoded).
 *
 * Scansiona app/ e components/ con l'AST di TypeScript e conta le stringhe
 * user-facing NON passate da t(): testo JSX, attributi (placeholder/title/
 * aria-label/alt/label) e messaggi (toast/alert/confirm).
 *
 * Funziona a "ratchet": confronta il totale con una baseline versionata
 * (scripts/.i18n-baseline.json). Fallisce (exit 1) se il totale AUMENTA →
 * impedisce di introdurre nuove stringhe hardcoded. Man mano che si bonifica,
 * aggiornare la baseline con:  node scripts/i18n-no-hardcoded.js --update
 *
 * Uso:
 *   node scripts/i18n-no-hardcoded.js            # verifica vs baseline
 *   node scripts/i18n-no-hardcoded.js --update   # salva il conteggio attuale come baseline
 *   node scripts/i18n-no-hardcoded.js --report   # elenca i file peggiori
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROOTS = ['app', 'components'];
const EXTS = new Set(['.tsx', '.ts']);
const ATTR = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'tooltip', 'description']);
const CALLS = new Set(['success', 'error', 'info', 'warning', 'message', 'loading', 'alert', 'confirm']);
// Oggetti che NON mostrano nulla all'utente: i loro .error/.info/.warn sono
// messaggi di diagnostica, non testo da tradurre. Contarli gonfiava la baseline
// di 179 voci su 1355 (misurato 01/08/2026: clientLogger 171, console 8) e
// faceva fallire la CI per un log aggiunto in un catch.
// ⚠️ L'esclusione è per NOME DELL'OGGETTO, non per percorso del file: un filtro
// sul path è esattamente ciò che ha reso cieco il gate a11y il 31/07.
// `toast` NON è qui e resta contato: quello sì che l'utente lo legge.
const LOGGERS = new Set(['clientLogger', 'console', 'logger', 'log']);
const BASELINE_FILE = path.join(__dirname, '.i18n-baseline.json');

const hasLetter = (s) => /[A-Za-zÀ-ÿ]/.test(s);
const meaningful = (s) => {
  const t = s.trim();
  return t.length >= 2 && hasLetter(t) && /[A-Za-zÀ-ÿ].*[A-Za-zÀ-ÿ]/.test(t) && !/^[A-Z0-9_]+$/.test(t);
};

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
  let total = 0;
  const perFile = {};
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if ((sf.parseDiagnostics || []).length) continue;
    let n = 0;
    const visit = (node) => {
      if (node.kind === ts.SyntaxKind.JsxText) {
        if (meaningful(node.text)) n++;
      } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        if (ATTR.has(node.name.getText()) && meaningful(node.initializer.text)) n++;
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        // radice della catena: clientLogger.error(...) → "clientLogger"
        const radice = node.expression.expression.getText().split(/[.([]/)[0].trim();
        if (!LOGGERS.has(radice)
          && CALLS.has(node.expression.name.getText()) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && meaningful(node.arguments[0].text)) n++;
      } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const m = node.expression.getText();
        if ((m === 'alert' || m === 'confirm') && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && meaningful(node.arguments[0].text)) n++;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (n) { perFile[path.relative(ROOT, f)] = n; total += n; }
  }
  return { total, perFile, scanned: files.length };
}

const arg = process.argv[2] || '';
const { total, perFile, scanned } = scan();

if (arg === '--report') {
  const list = Object.entries(perFile).sort((a, b) => b[1] - a[1]);
  console.log(`File scansionati: ${scanned} — totale hardcoded: ${total}`);
  for (const [f, n] of list.slice(0, 40)) console.log(`  ${String(n).padStart(4)}  ${f}`);
  process.exit(0);
}

if (arg === '--update') {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ total }, null, 2) + '\n');
  console.log(`Baseline aggiornata: ${total} stringhe hardcoded.`);
  process.exit(0);
}

let baseline = Infinity;
if (fs.existsSync(BASELINE_FILE)) {
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).total; } catch {}
}

if (baseline === Infinity) {
  console.log(`Nessuna baseline. Totale attuale: ${total}. Crea la baseline con: node scripts/i18n-no-hardcoded.js --update`);
  process.exit(0);
}

if (total > baseline) {
  console.error(`❌ Testo hardcoded AUMENTATO: ${total} > baseline ${baseline} (+${total - baseline}).`);
  console.error(`   Usa t()/i18n per le nuove stringhe. Dettagli: node scripts/i18n-no-hardcoded.js --report`);
  process.exit(1);
}

if (total < baseline) {
  console.log(`✅ Hardcoded diminuito: ${total} < baseline ${baseline}. Aggiorna la baseline: node scripts/i18n-no-hardcoded.js --update`);
  process.exit(0);
}

console.log(`✅ Nessuna nuova stringa hardcoded (totale ${total} = baseline).`);
process.exit(0);
