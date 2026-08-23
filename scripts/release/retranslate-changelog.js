#!/usr/bin/env node
/**
 * retranslate-changelog.js — rifà SOLO le traduzioni del changelog in-app
 * per una versione già scritta nei locale, senza toccare il resto della ship.
 *
 * Nato il 06/08/2026 per la v1.16.0: la ship era partita con una API key
 * segnaposto («la-tua-chiave»), tutte le lingue erano andate in fallback e i
 * 12 locale contenevano il testo grezzo dei commit (inglese). Rilanciare
 * `npm run ship` avrebbe bumpato a 1.17.0: questo runner ripara e basta.
 *
 * Uso:
 *   export ANTHROPIC_API_KEY="..."   # o OPENAI/GEMINI/DEEPL
 *   node scripts/release/retranslate-changelog.js 1.16.0 --source=en
 *
 * --source=<lang>  lingua in cui sono OGGI le voci nei locale (default: en,
 *                  perché le voci vengono dai messaggi di commit, che sono in
 *                  inglese). Il locale della lingua sorgente riceve le voci
 *                  così come sono; tutti gli altri (italiano incluso) la
 *                  traduzione.
 *
 * Deduplica le voci identiche (i commit ripetuti producono doppioni).
 * O tutto o niente per lingua: se una lingua fallisce, il suo locale NON
 * viene toccato e il runner esce con codice 1 dichiarandolo.
 */

const path = require('path');
const fs = require('fs');
const {
  translateArray, setVersionKeys, versionKey, detectProvider, listLocaleLangs,
} = require('./translate-changelog.js');

const LOCALES_DIR = path.join(__dirname, '..', '..', 'lib', 'i18n', 'locales');

async function main() {
  const args = process.argv.slice(2);
  const version = args.find((a) => !a.startsWith('--'));
  const source = (args.find((a) => a.startsWith('--source=')) || '--source=en').split('=')[1];
  if (!version) { console.error('uso: node scripts/release/retranslate-changelog.js <versione> [--source=en]'); process.exit(1); }

  const vKey = versionKey(version);
  const provider = detectProvider();
  if (!provider) { console.error('ERRORE: nessuna API key (ANTHROPIC/OPENAI/GEMINI/DEEPL) nell\'ambiente.'); process.exit(1); }

  const srcPath = path.join(LOCALES_DIR, `${source}.json`);
  const srcJson = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const entry = srcJson.changelog && srcJson.changelog[vKey];
  if (!entry) { console.error(`ERRORE: changelog.${vKey} non trovato in ${source}.json`); process.exit(1); }

  const raw = Object.keys(entry).sort((a, b) => Number(a) - Number(b)).map((k) => entry[k]);
  const voci = [...new Set(raw)]; // dedup: i commit ripetuti producono voci doppie
  console.log(`changelog.${vKey}: ${raw.length} voci (${voci.length} dopo dedup) · sorgente=${source} · provider=${provider}`);

  const failed = [];
  const partial = [];
  for (const lang of listLocaleLangs()) {
    if (lang === source) {
      setVersionKeys(path.join(LOCALES_DIR, `${lang}.json`), vKey, voci);
      console.log(`  = ${lang} (sorgente, riscritta dedupata)`);
      continue;
    }
    const missed = [];
    const translated = await translateArray(provider, lang, voci, (i) => missed.push(i));
    if (!translated) { failed.push(lang); console.log(`  ⛔ ${lang} FALLITA — locale NON toccato`); continue; }
    setVersionKeys(path.join(LOCALES_DIR, `${lang}.json`), vKey, translated);
    // 23/08/2026: con la bisezione una lingua può tornare quasi tutta tradotta,
    // con qualche voce ancora in inglese. Stamparla ✅ nasconderebbe il buco.
    if (missed.length) {
      partial.push(lang);
      console.log(`  ⚠️  ${lang} — ${missed.length} voci rimaste in inglese: ${missed.join(', ')}`);
    } else console.log(`  ✅ ${lang}`);
  }

  if (failed.length) {
    console.error(`\nESITO: ${failed.length} lingue fallite (${failed.join(', ')}). Rilancia il runner: le lingue già tradotte verranno ritradotte, è idempotente.`);
    process.exit(1);
  }
  if (partial.length) {
    console.log(`\nESITO: tutte le lingue tradotte, ma ${partial.length} con voci rimaste in inglese (${partial.join(', ')}). Rilanciare il runner può recuperarle solo se il provider non è deterministico; altrimenti vanno scritte a mano.`);
  } else console.log('\nESITO: tutte le lingue tradotte. Verifica a campione (it e ru) prima di committare.');
}

main().catch((e) => { console.error('ERRORE: ' + e.message); process.exit(1); });
