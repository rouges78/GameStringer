/**
 * Trova e traduce le 5 entries vuote nel translation_cache.json master
 */
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, 'esoteric_ebb_strings', 'ink_strings', 'translated', 'translation_cache.json');
const raw = fs.readFileSync(CACHE, 'utf-8');

const empty = [];
const lines = raw.split('\n');
for (const line of lines) {
  const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
  if (m && (!m[2] || m[2].length < 3)) {
    empty.push({ key: m[1], val: m[2], line });
  }
}

console.log(`Entries vuote trovate: ${empty.length}\n`);
for (const e of empty) {
  console.log(`EN: "${e.key}"`);
  console.log(`VAL: "${e.val}"`);
  console.log();
}
