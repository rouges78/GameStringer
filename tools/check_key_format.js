const fs = require('fs');
const path = require('path');

const gsDir = 'D:/SteamLibrary/steamapps/common/Esoteric Ebb/Esoteric Ebb_Data/_gamestringer';
const strings = JSON.parse(fs.readFileSync(path.join(gsDir, 'extracted_strings.json'), 'utf-8'));
const trans = JSON.parse(fs.readFileSync(path.join(gsDir, 'translations.json'), 'utf-8'));
const tKeys = Object.keys(trans);

// Mostra primi 5 extracted e primi 5 trans keys con i primi 80 chars
console.log('=== EXTRACTED STRINGS (prime 5) ===');
for (let i = 0; i < 5; i++) {
  console.log(`  [${i}] len=${strings[i].length} "${strings[i].substring(0, 120)}"`);
}

console.log('\n=== TRANSLATION KEYS (prime 5) ===');
for (let i = 0; i < 5; i++) {
  console.log(`  [${i}] len=${tKeys[i].length} "${tKeys[i].substring(0, 120)}"`);
}

// Cerca un extracted string nei trans keys con vari metodi
console.log('\n=== MATCH ANALYSIS ===');
const sample = strings[0];
console.log(`Extracted[0]: "${sample.substring(0, 80)}..."`);

// Exact
console.log(`  Exact match: ${!!trans[sample]}`);

// Trimmed
const trimmed = sample.trim();
console.log(`  Trimmed match: ${!!trans[trimmed]}`);

// Con spazio davanti/dopo
console.log(`  " "+key match: ${!!trans[' ' + sample]}`);
console.log(`  key+" " match: ${!!trans[sample + ' ']}`);
console.log(`  " "+key+" " match: ${!!trans[' ' + sample + ' ']}`);

// Cerca substring
let partialHits = 0;
const sampleWords = sample.substring(0, 40);
for (const tk of tKeys) {
  if (tk.includes(sampleWords)) {
    console.log(`  PARTIAL HIT in trans key: "${tk.substring(0, 120)}..."`);
    partialHits++;
    if (partialHits >= 3) break;
  }
}
if (partialHits === 0) {
  console.log('  No partial hits found');
  // Try reverse: look for trans keys in extracted
  let reverseHits = 0;
  for (const tk of tKeys.slice(0, 100)) {
    const tkClean = tk.replace(/^[\s"]+|[\s"]+$/g, '');
    for (const s of strings.slice(0, 100)) {
      if (s === tkClean || s.includes(tkClean.substring(0, 30))) {
        console.log(`  REVERSE HIT:`);
        console.log(`    trans key: "${tk.substring(0, 80)}..."`);
        console.log(`    extracted: "${s.substring(0, 80)}..."`);
        reverseHits++;
        if (reverseHits >= 3) break;
      }
    }
    if (reverseHits >= 3) break;
  }
}

// Check: le chiavi trans hanno quote extra?
console.log('\n=== KEY FORMAT CHECK ===');
const hasQuoteKeys = tKeys.filter(k => k.startsWith('"') || k.startsWith("'")).length;
const hasSpaceKeys = tKeys.filter(k => k.startsWith(' ')).length;
console.log(`Keys starting with ": ${hasQuoteKeys}`);
console.log(`Keys starting with space: ${hasSpaceKeys}`);
console.log(`Keys starting with letter: ${tKeys.filter(k => /^[A-Za-z]/.test(k)).length}`);
console.log(`Keys starting with <: ${tKeys.filter(k => k.startsWith('<')).length}`);
