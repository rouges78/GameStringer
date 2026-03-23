const fs = require('fs');
const path = require('path');

const dataDir = 'D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data';

// Read sharedassets0 and look for actual readable Ink JSON content
const fpath = path.join(dataDir, 'sharedassets0.assets');
const buf = fs.readFileSync(fpath);

// Search for inkVersion in the raw bytes to find Ink JSON blobs
const searchStr = 'inkVersion';
const searchBuf = Buffer.from(searchStr, 'utf-8');

let positions = [];
let offset = 0;
while (offset < buf.length) {
  const idx = buf.indexOf(searchBuf, offset);
  if (idx === -1) break;
  positions.push(idx);
  offset = idx + 1;
}

console.log(`Found ${positions.length} inkVersion occurrences in sharedassets0.assets`);

// For the first one, extract surrounding context
if (positions.length > 0) {
  const pos = positions[0];
  // Go back to find the start of the JSON blob
  let start = pos;
  while (start > 0 && buf[start] !== 0x7B) { // { character
    start--;
    if (pos - start > 5000) break;
  }
  
  // Read forward from the { to get some content
  const sample = buf.slice(start, start + 500).toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '.');
  console.log(`\nInk JSON blob at offset ${start}:`);
  console.log(sample);
  
  // Check if there's a "^" pattern nearby
  const caretSearch = buf.indexOf(Buffer.from('"^'), pos);
  if (caretSearch > 0 && caretSearch < pos + 10000) {
    const caretSample = buf.slice(caretSearch, caretSearch + 200).toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '.');
    console.log(`\nFirst caret text after inkVersion (offset ${caretSearch}):`);
    console.log(caretSample);
  }
}

// Also check level1 for readable content
const level1 = path.join(dataDir, 'level1');
const buf2 = fs.readFileSync(level1);
const idx2 = buf2.indexOf(Buffer.from('inkVersion'));
if (idx2 > 0) {
  let start2 = idx2;
  while (start2 > 0 && buf2[start2] !== 0x7B) { start2--; if (idx2 - start2 > 5000) break; }
  const sample2 = buf2.slice(start2, start2 + 500).toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '.');
  console.log(`\n\nlevel1 Ink blob at offset ${start2}:`);
  console.log(sample2);
} else {
  console.log('\nlevel1: no inkVersion found');
  
  // Search for common English game text
  const gameTexts = ['goblin', 'whisper', 'zealot', 'cleric', 'strength', 'Vision'];
  for (const txt of gameTexts) {
    const tidx = buf2.indexOf(Buffer.from(txt, 'utf-8'));
    if (tidx > 0) {
      const context = buf2.slice(Math.max(0, tidx - 50), tidx + 100).toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '.');
      console.log(`\nFound "${txt}" in level1 at offset ${tidx}:`);
      console.log(context);
      break;
    }
  }
}
