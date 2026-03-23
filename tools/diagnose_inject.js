const fs = require('fs');
const path = require('path');

const dataDir = 'D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data';

// 1. Check if backups exist and if current files = backups (meaning files were restored)
console.log('=== 1. STATO FILE ===');
const testFiles = ['level1', 'sharedassets0.assets'];
for (const fname of testFiles) {
  const fpath = path.join(dataDir, fname);
  const bpath = fpath + '.backup';
  if (!fs.existsSync(fpath)) { console.log(`${fname}: NON ESISTE`); continue; }
  const fsize = fs.statSync(fpath).size;
  const bsize = fs.existsSync(bpath) ? fs.statSync(bpath).size : 0;
  console.log(`${fname}: current=${fsize} backup=${bsize} same=${fsize===bsize}`);
}

// 2. Search for a known English string in level files
console.log('\n=== 2. STRINGHE EN NEI FILE ===');
const testStrings = [
  'You don\'t tell me what to do',
  'goblin sneakily leans',
  'Lady Sageleaf',
  'STRENGTH measures your natural',
  'Which font should I choose'
];

for (const fname of ['level0', 'level1', 'level2', 'sharedassets0.assets']) {
  const fpath = path.join(dataDir, fname);
  if (!fs.existsSync(fpath)) continue;
  const buf = fs.readFileSync(fpath);
  const content = buf.toString('utf-8');
  
  let found = [];
  for (const s of testStrings) {
    if (content.includes(s)) found.push(s.substring(0, 30));
  }
  if (found.length > 0) {
    console.log(`${fname}: trovate ${found.length} stringhe EN`);
    found.forEach(f => console.log(`  - "${f}"`));
  }
}

// 3. Load translations and check how many keys match in level1
console.log('\n=== 3. MATCH TRADUZIONI vs FILE ===');
const transPath = path.join(dataDir, '_gamestringer', 'translations.json');
if (fs.existsSync(transPath)) {
  const trans = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
  const keys = Object.keys(trans);
  console.log(`Traduzioni caricate: ${keys.length}`);
  
  // Check level1
  const level1 = fs.readFileSync(path.join(dataDir, 'level1'), 'utf-8');
  let matchCount = 0;
  let sampleMatches = [];
  for (const key of keys) {
    if (key.length > 15 && level1.includes(key)) {
      matchCount++;
      if (sampleMatches.length < 3) sampleMatches.push({ en: key.substring(0, 60), it: trans[key].substring(0, 60) });
    }
  }
  console.log(`level1: ${matchCount} chiavi trovate nel file`);
  sampleMatches.forEach(m => console.log(`  EN: "${m.en}"\n  IT: "${m.it}"`));
  
  // Check sharedassets0 (Ink JSON blobs)
  const sa0 = fs.readFileSync(path.join(dataDir, 'sharedassets0.assets'), 'utf-8');
  let sa0Match = 0;
  for (const key of keys) {
    if (key.length > 15 && sa0.includes(key)) sa0Match++;
  }
  console.log(`sharedassets0: ${sa0Match} chiavi trovate nel file`);
} else {
  console.log('translations.json NON TROVATO');
}

// 4. Check the ink CSV translations
console.log('\n=== 4. INK CSV vs FILE ===');
const inkCsv = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\ink_strings\\translated\\ink_translations.csv';
if (fs.existsSync(inkCsv)) {
  const lines = fs.readFileSync(inkCsv, 'utf-8').split('\n');
  // Parse first 5 entries
  console.log(`ink_translations.csv: ${lines.length} righe`);
  for (let i = 1; i < Math.min(4, lines.length); i++) {
    console.log(`  Riga ${i}: ${lines[i].substring(0, 100)}`);
  }
}
