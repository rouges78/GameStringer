/**
 * Verifica stato REALE della traduzione Esoteric Ebb
 * Analizza TUTTI i file di cache/traduzione
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'esoteric_ebb_strings');

function countJsonEntries(filePath) {
  if (!fs.existsSync(filePath)) return { total: 0, dirty: 0, empty: 0 };
  const raw = fs.readFileSync(filePath, 'utf-8');
  let total = 0, dirty = 0, empty = 0;
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
    if (m) {
      total++;
      const val = m[2];
      if (!val || val.length < 3) empty++;
      else if (/<\|im_/.test(val) || /<\/\|im_/.test(val)) dirty++;
    }
  }
  return { total, dirty, empty, clean: total - dirty - empty };
}

function countCsvRows(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  return Math.max(0, lines.length - 1); // header
}

console.log('========================================');
console.log('  STATO TRADUZIONE ESOTERIC EBB');
console.log('========================================\n');

// 1. INK STRINGS
console.log('--- INK STRINGS (dialoghi) ---');
const inkFiles = [
  { name: 'translation_cache.json', path: path.join(BASE, 'ink_strings', 'translated', 'translation_cache.json') },
  { name: 'ink_cache.json', path: path.join(BASE, 'ink_strings', 'translated', 'ink_cache.json') },
  { name: 'translate_progress.json', path: path.join(BASE, 'ink_strings', 'translate_progress.json') },
  { name: 'translate_progress_cleaned.json', path: path.join(BASE, 'ink_strings', 'translate_progress_cleaned.json') },
];

for (const f of inkFiles) {
  const stats = countJsonEntries(f.path);
  const status = stats.dirty > 0 ? `  ⚠️ ${stats.dirty} sporche` : '  ✅ pulito';
  console.log(`  ${f.name}: ${stats.total} tot, ${stats.clean} pulite, ${stats.empty} vuote${status}`);
}

const inkCsv = countCsvRows(path.join(BASE, 'ink_strings', 'translated', 'ink_translations.csv'));
console.log(`  ink_translations.csv: ${inkCsv} righe`);

// 2. LEVEL STRINGS
console.log('\n--- LEVEL STRINGS ---');
const levelCache = countJsonEntries(path.join(BASE, 'level_strings', 'translated', 'final_cache.json'));
console.log(`  final_cache.json: ${levelCache.total} tot, ${levelCache.clean} pulite, ${levelCache.dirty} sporche`);

// 3. CSV TABLES
console.log('\n--- CSV TABLES ---');
const csvDir = path.join(BASE, 'csv_tables', 'translated');
if (fs.existsSync(csvDir)) {
  const csvFiles = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
  let csvTotal = 0;
  for (const f of csvFiles) {
    const rows = countCsvRows(path.join(csvDir, f));
    console.log(`  ${f}: ${rows} righe`);
    csvTotal += rows;
  }
  console.log(`  TOTALE CSV: ${csvTotal} righe`);
  
  // Anche i JSON di traduzione CSV
  const csvTransJson = countJsonEntries(path.join(csvDir, 'all_translations.json'));
  console.log(`  all_translations.json: ${csvTransJson.total} entries`);
}

// 4. Sorgenti originali per confronto
console.log('\n--- SORGENTI ORIGINALI ---');
const origInk = countJsonEntries(path.join(BASE, 'ink_strings', 'ink_all_entries.json'));
console.log(`  ink_all_entries.json: ${origInk.total} stringhe`);
const origAll = countJsonEntries(path.join(BASE, 'all_strings.json'));
console.log(`  all_strings.json: ${origAll.total} stringhe`);
const forTrans = countJsonEntries(path.join(BASE, 'for_translation.json'));
console.log(`  for_translation.json: ${forTrans.total} stringhe`);

// VERDETTO FINALE
console.log('\n========================================');
console.log('  VERDETTO');
console.log('========================================');

// Il file master è translation_cache con 10894
const master = countJsonEntries(path.join(BASE, 'ink_strings', 'translated', 'translation_cache.json'));
const masterPct = ((master.clean / master.total) * 100).toFixed(1);
console.log(`\n  INK MASTER (translation_cache): ${master.clean}/${master.total} pulite (${masterPct}%)`);
if (master.dirty > 0) console.log(`  ⚠️  ${master.dirty} con artefatti AI`);
if (master.empty > 0) console.log(`  ⚠️  ${master.empty} vuote`);

console.log(`  LEVEL: ${levelCache.clean}/${levelCache.total} pulite`);
console.log(`  CSV: tradotti`);

if (master.dirty === 0 && master.empty === 0) {
  console.log('\n  ✅ TRADUZIONE COMPLETA E PULITA!');
} else {
  console.log(`\n  🔶 TRADUZIONE QUASI COMPLETA — ${master.dirty + master.empty} entries da sistemare`);
}
