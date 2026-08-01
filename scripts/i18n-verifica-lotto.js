#!/usr/bin/env node
/**
 * Verifica di sanità sui file appena bonificati per l'i18n.
 *
 * PERCHÉ — `scripts/i18n-no-hardcoded.js` SALTA i file con errori di parsing
 * (`if (sf.parseDiagnostics.length) continue`). Un JSX rotto da una sostituzione
 * sbagliata farebbe quindi SCENDERE il conteggio e sembrerebbe un miglioramento:
 * la stessa forma del "100% con 0 errori". Qui i file rotti sono un ERRORE, non
 * un file saltato.
 *
 * Controlla, per ogni file indicato:
 *   1. che parsi (nessun parseDiagnostic) — altrimenti il gate è cieco su di lui
 *   2. che se usa `t(` abbia l'import e l'hook `useTranslation`
 *   3. che non siano rimaste graffe JSX evidentemente sbilanciate
 *   4. quante stringhe hardcoded restano (con la stessa logica del gate)
 *
 * Uso: node scripts/i18n-verifica-lotto.js file1.tsx file2.tsx ...
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ATTR = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'tooltip', 'description']);
const CALLS = new Set(['success', 'error', 'info', 'warning', 'message', 'loading', 'alert', 'confirm']);
const LOGGERS = new Set(['clientLogger', 'console', 'logger', 'log']);

const hasLetter = (s) => /[A-Za-zÀ-ÿ]/.test(s);
const meaningful = (s) => {
  const t = s.trim();
  return t.length >= 2 && hasLetter(t) && /[A-Za-zÀ-ÿ].*[A-Za-zÀ-ÿ]/.test(t) && !/^[A-Z0-9_]+$/.test(t);
};

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Uso: node scripts/i18n-verifica-lotto.js <file...>');
  process.exit(2);
}

let problemi = 0;

for (const rel of files) {
  const f = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  const nome = path.relative(ROOT, f);
  if (!fs.existsSync(f)) {
    console.log(`✗ ${nome}: NON ESISTE`);
    problemi++;
    continue;
  }
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true,
    f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const diag = sf.parseDiagnostics || [];
  if (diag.length) {
    console.log(`✗ ${nome}: ${diag.length} ERRORI DI SINTASSI — il gate lo salterebbe in silenzio!`);
    for (const d of diag.slice(0, 3)) {
      const pos = sf.getLineAndCharacterOfPosition(d.start || 0);
      console.log(`    riga ${pos.line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
    problemi++;
    continue;
  }

  const usaT = /\bt\(\s*['"]/.test(src);
  const haImport = /useTranslation/.test(src);
  const haHook = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useTranslation\(\)/.test(src);

  let hardcoded = 0;
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      if (meaningful(node.text)) hardcoded++;
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (ATTR.has(node.name.getText()) && meaningful(node.initializer.text)) hardcoded++;
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const radice = node.expression.expression.getText().split(/[.([]/)[0].trim();
      if (!LOGGERS.has(radice) && CALLS.has(node.expression.name.getText())
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
        && meaningful(node.arguments[0].text)) hardcoded++;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const note = [];
  if (usaT && !haImport) { note.push('USA t() SENZA import useTranslation'); problemi++; }
  if (usaT && !haHook) note.push('t() usato ma hook non trovato con la regex (verifica a mano)');

  const stato = note.length ? '⚠️' : '✓';
  console.log(`${stato} ${nome}`);
  console.log(`    parse OK · hardcoded residui: ${hardcoded}${note.length ? ' · ' + note.join(' · ') : ''}`);
}

console.log('');
if (problemi) {
  console.log(`❌ ${problemi} file con problemi.`);
  process.exitCode = 1;
} else {
  console.log('✅ Tutti i file parsano e hanno t() correttamente cablato.');
}
