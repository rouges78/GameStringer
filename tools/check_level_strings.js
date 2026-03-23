const fs = require('fs');
const path = require('path');

const dataDir = 'D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data';
const transPath = path.join(dataDir, '_gamestringer', 'translations.json');
const translations = JSON.parse(fs.readFileSync(transPath, 'utf-8'));

// Check level1 for translatable text matches
const buf = fs.readFileSync(path.join(dataDir, 'level1'));
const str = buf.toString('utf-8');

let found = 0;
let notFound = 0;
const samples = [];

for (const [eng, ita] of Object.entries(translations)) {
  if (eng.length > 10 && str.includes(eng)) {
    found++;
    if (samples.length < 5) samples.push(eng.substring(0, 80));
  }
}

console.log(`level1: ${found} translation keys found in raw file`);
samples.forEach(s => console.log(`  "${s}"`));

// Now check how many keys match across ALL level files
let totalMatches = 0;
for (let i = 0; i <= 24; i++) {
  const fpath = path.join(dataDir, `level${i}`);
  if (!fs.existsSync(fpath)) continue;
  const content = fs.readFileSync(fpath, 'utf-8');
  let matches = 0;
  for (const key of Object.keys(translations)) {
    if (key.length > 10 && content.includes(key)) matches++;
  }
  if (matches > 0) {
    console.log(`level${i}: ${matches} matches`);
    totalMatches += matches;
  }
}

// Check sharedassets too
for (let i = 0; i <= 24; i++) {
  const fpath = path.join(dataDir, `sharedassets${i}.assets`);
  if (!fs.existsSync(fpath)) continue;
  const content = fs.readFileSync(fpath, 'utf-8');
  let matches = 0;
  for (const key of Object.keys(translations)) {
    if (key.length > 10 && content.includes(key)) matches++;
  }
  if (matches > 0) {
    console.log(`sharedassets${i}.assets: ${matches} matches`);
    totalMatches += matches;
  }
}

console.log(`\nTotal matches across all files: ${totalMatches}`);
