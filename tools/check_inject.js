const fs = require('fs');
const path = require('path');

const dataDir = 'D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data';

// Check a few assets files for Ink content
const files = ['sharedassets0.assets', 'level0', 'level1'];

for (const fname of files) {
  const fpath = path.join(dataDir, fname);
  if (!fs.existsSync(fpath)) { console.log(fname, ': NOT FOUND'); continue; }
  
  const buf = fs.readFileSync(fpath);
  const str = buf.toString('latin1');
  
  const hasInk = str.includes('inkVersion');
  const caretCount = (str.match(/"?\^/g) || []).length;
  
  // Find first caret string sample
  const idx = str.indexOf('"^');
  let sample = '';
  if (idx > 0) {
    sample = str.substring(idx, idx + 120).replace(/[^\x20-\x7E]/g, '.');
  }
  
  // Check if any Italian words are present
  const italianWords = ['della', 'nella', 'questo', 'quella', 'anche', 'essere', 'perch'];
  const hasItalian = italianWords.some(w => str.includes(w));
  
  console.log(`${fname}: size=${buf.length}, inkVersion=${hasInk}, carets=${caretCount}, hasItalian=${hasItalian}`);
  if (sample) console.log(`  sample: ${sample}`);
}

// Also check if backup differs from current
const f1 = path.join(dataDir, 'level1');
const f1b = f1 + '.backup';
if (fs.existsSync(f1) && fs.existsSync(f1b)) {
  const s1 = fs.statSync(f1).size;
  const s2 = fs.statSync(f1b).size;
  console.log(`\nlevel1: current=${s1} backup=${s2} same=${s1===s2}`);
}
