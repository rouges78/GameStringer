#!/usr/bin/env node
// Applica una patch tradotta a un locale.
//
// La patch è un JSON piatto { "path.to.key": "valore tradotto", ... }
// Lo script la fonde nel file lib/i18n/locales/<lang>.json ricreando
// la struttura nested, rimuove le chiavi obsolete indicate in
// scripts/i18n-patches/<lang>.extra.json e salva il risultato.
//
// Uso: node scripts/i18n-apply.js <lang> <patch-file.json> [--no-prune]

const fs = require('fs');
const path = require('path');

const [, , lang, patchFile, ...flags] = process.argv;
if (!lang || !patchFile) {
  console.error('Usage: node scripts/i18n-apply.js <lang> <patch-file.json> [--no-prune]');
  process.exit(1);
}
const prune = !flags.includes('--no-prune');

const LOCALES_DIR = path.join(__dirname, '..', 'lib', 'i18n', 'locales');
const PATCH_DIR = path.join(__dirname, 'i18n-patches');
const localePath = path.join(LOCALES_DIR, `${lang}.json`);

const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));

function setNested(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function deleteNested(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null) return;
    cur = cur[p];
  }
  delete cur[parts[parts.length - 1]];
  // Pulisce oggetti nested diventati vuoti
  let cur2 = obj;
  const stack = [];
  for (let i = 0; i < parts.length - 1; i++) {
    stack.push([cur2, parts[i]]);
    cur2 = cur2[parts[i]];
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const [parent, key] = stack[i];
    if (parent[key] && typeof parent[key] === 'object' && Object.keys(parent[key]).length === 0) {
      delete parent[key];
    } else break;
  }
}

let added = 0;
for (const [keyPath, value] of Object.entries(patch)) {
  setNested(locale, keyPath, value);
  added++;
}

let removed = 0;
if (prune) {
  const extraPath = path.join(PATCH_DIR, `${lang}.extra.json`);
  if (fs.existsSync(extraPath)) {
    const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
    for (const k of extra) {
      deleteNested(locale, k);
      removed++;
    }
  }
}

fs.writeFileSync(localePath, JSON.stringify(locale, null, 2) + '\n');
console.log(`${lang}: +${added} keys, -${removed} obsolete`);
