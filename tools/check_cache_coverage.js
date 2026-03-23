/**
 * Verifica quante entries "da ri-tradurre" sono già presenti
 * nel translation_cache.json (pulite)
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'esoteric_ebb_strings', 'ink_strings');
const NEEDS = JSON.parse(fs.readFileSync(path.join(BASE, 'needs_retranslation.json'), 'utf-8'));

// Carica translation_cache
const cacheRaw = fs.readFileSync(path.join(BASE, 'translated', 'translation_cache.json'), 'utf-8');
const cacheMap = new Map();
for (const line of cacheRaw.split('\n')) {
  const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
  if (m) cacheMap.set(m[1], m[2]);
}

// Carica ink_cache
const inkCacheRaw = fs.readFileSync(path.join(BASE, 'translated', 'ink_cache.json'), 'utf-8');
const inkCacheMap = new Map();
for (const line of inkCacheRaw.split('\n')) {
  const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
  if (m) inkCacheMap.set(m[1], m[2]);
}

console.log(`translation_cache.json: ${cacheMap.size} entries`);
console.log(`ink_cache.json: ${inkCacheMap.size} entries`);
console.log(`Entries da ri-tradurre: ${NEEDS.length}`);
console.log();

let foundInCache = 0;
let foundInInkCache = 0;
let notFound = 0;
const stillMissing = [];
const recovered = {};

for (const key of NEEDS) {
  // Cerca prima in translation_cache
  const val1 = cacheMap.get(key);
  if (val1 && val1.length > 5 && !/<\|im_/.test(val1)) {
    foundInCache++;
    recovered[key] = val1;
    continue;
  }
  
  // Cerca in ink_cache
  const val2 = inkCacheMap.get(key);
  if (val2 && val2.length > 5 && !/<\|im_/.test(val2)) {
    foundInInkCache++;
    recovered[key] = val2;
    continue;
  }
  
  notFound++;
  stillMissing.push(key);
}

console.log(`Recuperate da translation_cache: ${foundInCache}`);
console.log(`Recuperate da ink_cache: ${foundInInkCache}`);
console.log(`TOTALE recuperate: ${foundInCache + foundInInkCache}`);
console.log(`Ancora mancanti: ${notFound}`);

// Merge le recuperate nel file cleaned
const cleanedPath = path.join(BASE, 'translate_progress_cleaned.json');
const cleanedObj = JSON.parse(fs.readFileSync(cleanedPath, 'utf-8'));

let merged = 0;
for (const [key, val] of Object.entries(recovered)) {
  if (!cleanedObj[key]) {
    cleanedObj[key] = val;
    merged++;
  }
}

fs.writeFileSync(cleanedPath, JSON.stringify(cleanedObj, null, 2), 'utf-8');
console.log(`\nMerged ${merged} traduzioni recuperate in translate_progress_cleaned.json`);
console.log(`Totale entries nel file pulito: ${Object.keys(cleanedObj).length}`);

// Aggiorna needs_retranslation
fs.writeFileSync(
  path.join(BASE, 'needs_retranslation.json'), 
  JSON.stringify(stillMissing, null, 2), 
  'utf-8'
);
console.log(`Aggiornato needs_retranslation.json: ${stillMissing.length} entries`);

// Mostra campione mancanti
if (stillMissing.length > 0) {
  console.log('\n--- Campione entries ancora mancanti ---');
  for (let i = 0; i < Math.min(5, stillMissing.length); i++) {
    console.log(`  ${i+1}. "${stillMissing[i].substring(0, 100)}"`);
  }
}
