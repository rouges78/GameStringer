/**
 * Verifica deep: cerca le entries mancanti nei cache usando match parziale
 * (le chiavi nel progress potrebbero essere troncate vs quelle nei cache)
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'esoteric_ebb_strings', 'ink_strings');
const NEEDS = JSON.parse(fs.readFileSync(path.join(BASE, 'needs_retranslation.json'), 'utf-8'));

// Carica ink_cache come oggetto (è più grande, più chance di match)
const inkRaw = fs.readFileSync(path.join(BASE, 'translated', 'ink_cache.json'), 'utf-8');
const inkKeys = [];
const inkMap = new Map();
for (const line of inkRaw.split('\n')) {
  const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
  if (m) {
    inkKeys.push(m[1]);
    inkMap.set(m[1], m[2]);
  }
}

// Carica anche translation_cache
const tcRaw = fs.readFileSync(path.join(BASE, 'translated', 'translation_cache.json'), 'utf-8');
const tcMap = new Map();
for (const line of tcRaw.split('\n')) {
  const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
  if (m) tcMap.set(m[1], m[2]);
}

console.log(`ink_cache: ${inkMap.size} keys`);
console.log(`translation_cache: ${tcMap.size} keys`);
console.log(`needs_retranslation: ${NEEDS.length} entries`);

// Prova match esatto, poi parziale (primi 50 char della chiave)
let exactMatch = 0;
let partialMatch = 0;
let noMatch = 0;
const recovered = {};
const stillMissing = [];

for (const key of NEEDS) {
  // Exact
  if (inkMap.has(key)) {
    const v = inkMap.get(key);
    if (v && v.length > 5 && !/<\|im_/.test(v)) {
      exactMatch++;
      recovered[key] = v;
      continue;
    }
  }
  if (tcMap.has(key)) {
    const v = tcMap.get(key);
    if (v && v.length > 5 && !/<\|im_/.test(v)) {
      exactMatch++;
      recovered[key] = v;
      continue;
    }
  }
  
  // Partial match (primi 40 char)
  const prefix = key.substring(0, 40);
  let found = false;
  for (const [ik, iv] of inkMap) {
    if (ik.startsWith(prefix) && iv && iv.length > 5 && !/<\|im_/.test(iv)) {
      partialMatch++;
      recovered[key] = iv;
      found = true;
      break;
    }
  }
  if (found) continue;
  
  for (const [tk, tv] of tcMap) {
    if (tk.startsWith(prefix) && tv && tv.length > 5 && !/<\|im_/.test(tv)) {
      partialMatch++;
      recovered[key] = tv;
      found = true;
      break;
    }
  }
  if (found) continue;
  
  noMatch++;
  stillMissing.push(key);
}

console.log(`\nRisultati:`);
console.log(`  Match esatto:   ${exactMatch}`);
console.log(`  Match parziale: ${partialMatch}`);
console.log(`  Non trovate:    ${noMatch}`);

// Merge nel cleaned
const cleanedPath = path.join(BASE, 'translate_progress_cleaned.json');
const cleanedObj = JSON.parse(fs.readFileSync(cleanedPath, 'utf-8'));
let merged = 0;
for (const [key, val] of Object.entries(recovered)) {
  if (!cleanedObj[key]) {
    cleanedObj[key] = val;
    merged++;
  }
}

const totalClean = Object.keys(cleanedObj).length;
fs.writeFileSync(cleanedPath, JSON.stringify(cleanedObj, null, 2), 'utf-8');
fs.writeFileSync(path.join(BASE, 'needs_retranslation.json'), JSON.stringify(stillMissing, null, 2), 'utf-8');

console.log(`\nMerged: ${merged} recuperate`);
console.log(`File pulito finale: ${totalClean} entries`);
console.log(`Ancora mancanti: ${stillMissing.length}`);

// Statistiche finali
const totalOriginal = 4547;
const pct = ((totalClean / totalOriginal) * 100).toFixed(1);
console.log(`\n=== STATO FINALE ===`);
console.log(`Tradotte: ${totalClean}/${totalOriginal} (${pct}%)`);
console.log(`Da ri-tradurre: ${stillMissing.length} (${((stillMissing.length/totalOriginal)*100).toFixed(1)}%)`);

// Campione mancanti
if (stillMissing.length > 0 && stillMissing.length <= 20) {
  console.log('\n--- Tutte le entries mancanti ---');
  stillMissing.forEach((s, i) => console.log(`  ${i+1}. "${s.substring(0, 120)}"`));
} else if (stillMissing.length > 20) {
  console.log('\n--- Prime 10 entries mancanti ---');
  stillMissing.slice(0, 10).forEach((s, i) => console.log(`  ${i+1}. "${s.substring(0, 120)}"`));
}
