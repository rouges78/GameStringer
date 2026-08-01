#!/usr/bin/env node
/**
 * Unisce i file `scripts/_i18n_nuove_*.json` prodotti dalla bonifica i18n
 * dentro i 12 locale di `lib/i18n/locales/`.
 *
 * PERCHÉ ESISTE: la bonifica gira a lotti paralleli. Se ogni lotto scrivesse
 * direttamente sui locale, l'ultimo a salvare cancellerebbe il lavoro degli
 * altri (12 file condivisi, scritture concorrenti). I lotti quindi depositano
 * le chiavi in JSON separati e la fusione avviene QUI, una volta sola.
 *
 * REGOLE (prudenti per costruzione):
 *  - non sovrascrive MAI una chiave già presente in un locale: la salta e la
 *    riporta come "conflitto". Una traduzione esistente e revisionata vale più
 *    di una appena generata.
 *  - fallisce se un JSON di lotto non ha le stesse chiavi in tutte le lingue
 *    (una lingua mancante = testo che sparisce in quella lingua a runtime).
 *  - `--dry` mostra cosa farebbe senza scrivere niente.
 *
 * Uso:
 *   node scripts/i18n-merge-nuove.js --dry
 *   node scripts/i18n-merge-nuove.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'lib', 'i18n', 'locales');
const DRY = process.argv.includes('--dry');

const lotti = fs.readdirSync(__dirname)
  .filter((f) => /^_i18n_nuove_.*\.json$/.test(f))
  .sort();

if (!lotti.length) {
  console.log('Nessun file _i18n_nuove_*.json da unire.');
  process.exit(0);
}

const localeFiles = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
const lingueDisponibili = localeFiles.map((f) => path.basename(f, '.json'));
console.log(`Lingue nei locale: ${lingueDisponibili.join(', ')}`);
console.log(`Lotti trovati: ${lotti.join(', ')}\n`);

// ── Carica e valida i lotti ────────────────────────────────────────────────
const perLingua = {}; // lingua → { namespace → { chiave → valore } }
let errori = 0;

for (const nome of lotti) {
  const p = path.join(__dirname, nome);
  let dati;
  try {
    dati = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`✗ ${nome}: JSON non valido — ${e.message}`);
    errori++;
    continue;
  }

  // Insieme di chiavi "ns.key" per lingua, per verificare che siano allineate.
  const chiaviPerLingua = {};
  for (const [lang, nsObj] of Object.entries(dati)) {
    const set = new Set();
    for (const [ns, kv] of Object.entries(nsObj || {})) {
      for (const k of Object.keys(kv || {})) set.add(`${ns}.${k}`);
    }
    chiaviPerLingua[lang] = set;
  }
  const lingue = Object.keys(chiaviPerLingua);
  const riferimento = chiaviPerLingua['it'] || chiaviPerLingua[lingue[0]];
  for (const lang of lingue) {
    const mancanti = [...riferimento].filter((k) => !chiaviPerLingua[lang].has(k));
    if (mancanti.length) {
      console.error(`✗ ${nome}: la lingua "${lang}" non ha ${mancanti.length} chiavi (es. ${mancanti.slice(0, 3).join(', ')})`);
      errori++;
    }
  }
  // Lingue presenti nei locale ma assenti nel lotto: testo che resterebbe vuoto.
  const assenti = lingueDisponibili.filter((l) => !lingue.includes(l));
  if (assenti.length) {
    console.error(`✗ ${nome}: mancano del tutto le lingue: ${assenti.join(', ')}`);
    errori++;
  }

  for (const [lang, nsObj] of Object.entries(dati)) {
    perLingua[lang] = perLingua[lang] || {};
    for (const [ns, kv] of Object.entries(nsObj || {})) {
      perLingua[lang][ns] = perLingua[lang][ns] || {};
      Object.assign(perLingua[lang][ns], kv);
    }
  }
}

if (errori) {
  console.error(`\n${errori} problema/i nei lotti: NON unisco niente. Correggi e rilancia.`);
  process.exit(1);
}

// ── Fusione ────────────────────────────────────────────────────────────────
let aggiunte = 0;
const conflitti = [];

for (const lang of lingueDisponibili) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
  const nuove = perLingua[lang];
  if (!nuove) {
    console.error(`✗ nessun dato per la lingua "${lang}"`);
    process.exit(1);
  }

  let nAgg = 0;
  for (const [ns, kv] of Object.entries(nuove)) {
    locale[ns] = locale[ns] || {};
    for (const [k, v] of Object.entries(kv)) {
      if (Object.prototype.hasOwnProperty.call(locale[ns], k)) {
        if (locale[ns][k] !== v) conflitti.push(`${lang}: ${ns}.${k}`);
        continue; // non sovrascrivere mai
      }
      locale[ns][k] = v;
      nAgg++;
    }
  }
  aggiunte += nAgg;
  if (!DRY) {
    fs.writeFileSync(file, JSON.stringify(locale, null, 2) + '\n', 'utf8');
  }
  console.log(`  ${lang}: +${nAgg} chiavi`);
}

console.log(`\n${DRY ? '[DRY] ' : ''}Totale chiavi aggiunte: ${aggiunte}`);
if (conflitti.length) {
  console.log(`\n⚠️ ${conflitti.length} chiavi esistevano già con valore diverso — LASCIATE come stavano:`);
  for (const c of conflitti.slice(0, 20)) console.log(`   ${c}`);
  if (conflitti.length > 20) console.log(`   …e altre ${conflitti.length - 20}`);
}
if (DRY) console.log('\nNiente scritto. Rilancia senza --dry per applicare.');
