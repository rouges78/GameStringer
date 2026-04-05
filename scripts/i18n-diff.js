#!/usr/bin/env node
// Genera patch di chiavi mancanti per ogni locale rispetto a it.json (reference)
// Output: scripts/i18n-patches/<lang>.missing.json con struttura:
//   { "path.to.key": { "it": "valore italiano", "en": "english value" }, ... }
// Produce anche <lang>.extra.json con le chiavi obsolete da rimuovere.

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'lib', 'i18n', 'locales');
const OUT_DIR = path.join(__dirname, 'i18n-patches');
const REF = 'it';

function flatten(obj, prefix = '', out = {}) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, full, out);
    } else {
      out[full] = v;
    }
  }
  return out;
}

function load(lang) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'));
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const ref = flatten(load(REF));
const en = flatten(load('en'));
const refKeys = new Set(Object.keys(ref));

const languages = fs.readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => path.basename(f, '.json'))
  .filter(l => l !== REF);

const summary = [];

for (const lang of languages) {
  const langFlat = flatten(load(lang));
  const langKeys = new Set(Object.keys(langFlat));

  // Missing: in ref but not in lang
  const missing = {};
  for (const k of refKeys) {
    if (!langKeys.has(k)) {
      missing[k] = { it: ref[k], en: en[k] ?? null };
    }
  }

  // Extra: in lang but not in ref (obsolete, to remove)
  const extra = [];
  for (const k of langKeys) {
    if (!refKeys.has(k)) extra.push(k);
  }

  fs.writeFileSync(path.join(OUT_DIR, `${lang}.missing.json`), JSON.stringify(missing, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `${lang}.extra.json`), JSON.stringify(extra, null, 2));

  summary.push({ lang, missing: Object.keys(missing).length, extra: extra.length });
}

console.log('lang  missing  extra');
for (const s of summary) {
  console.log(s.lang.padEnd(5), String(s.missing).padStart(7), String(s.extra).padStart(6));
}
console.log(`\nPatches written to: ${OUT_DIR}`);
