const fs = require('fs');

// Check if specific game strings exist in the ink CSV
const csvPath = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\ink_strings\\translated\\ink_translations.csv';
const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');

const testStrings = [
  "You don't tell me what to do",
  "goblin sneakily leans",
  "Lady Sageleaf",
  "STRENGTH measures your natural",
  "Which font should I choose",
  "Averia Serif",
  "New Game",
  "Options",
  "Credits",
];

console.log('=== Ricerca stringhe nel CSV ink_translations ===');
for (const test of testStrings) {
  let found = false;
  for (const line of lines) {
    if (line.includes(test)) {
      found = true;
      console.log(`"${test}" -> TROVATA: ${line.substring(0, 120)}`);
      break;
    }
  }
  if (!found) console.log(`"${test}" -> NON TROVATA nel CSV`);
}

// Also check: how is the caret text stored vs what we see in the file?
console.log('\n=== Esempio di caret text nel CSV ===');
let caretExamples = 0;
for (const line of lines) {
  if (caretExamples >= 3) break;
  if (line.length > 20 && !line.startsWith('ENGLISH')) {
    console.log(`  ${line.substring(0, 150)}`);
    caretExamples++;
  }
}

// Now check: what does "Lady Sageleaf" look like in the actual level1 file?
console.log('\n=== Contesto "Lady Sageleaf" in level1 ===');
const level1 = fs.readFileSync('D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data\\level1');
const str = level1.toString('utf-8');
const idx = str.indexOf('Lady Sageleaf');
if (idx > 0) {
  // Show context around it
  const before = str.substring(Math.max(0, idx - 100), idx).replace(/[^\x20-\x7E]/g, '·');
  const after = str.substring(idx, idx + 200).replace(/[^\x20-\x7E]/g, '·');
  console.log(`  ...${before}${after}...`);
}

// Check sharedassets0 for "goblin sneakily"  
console.log('\n=== Contesto "goblin sneakily" in sharedassets0 ===');
const sa0 = fs.readFileSync('D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data\\sharedassets0.assets');
const sa0str = sa0.toString('utf-8');
const idx2 = sa0str.indexOf('goblin sneakily');
if (idx2 > 0) {
  const before2 = sa0str.substring(Math.max(0, idx2 - 100), idx2).replace(/[^\x20-\x7E]/g, '·');
  const after2 = sa0str.substring(idx2, idx2 + 200).replace(/[^\x20-\x7E]/g, '·');
  console.log(`  ...${before2}${after2}...`);
}
