/**
 * Cerca testi originali delle traduzioni dentro il WAD per capire dove patchare.
 */
import { readFileSync, openSync, readSync, closeSync, statSync } from 'fs';

const GAME = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const WAD = GAME + '\\dr1_data_us.wad.backup';
const TRANS = GAME + '\\GameStringer_Translation\\translations.json';

const translations = JSON.parse(readFileSync(TRANS, 'utf8'));
const samples = translations.filter(t => t.original && t.original.length > 20).slice(0, 10);

const fd = openSync(WAD, 'r');
const wadSize = statSync(WAD).size;
const CHUNK = 20 * 1024 * 1024;

// Parse WAD entries to identify which file contains found text
const hdr = Buffer.alloc(20);
readSync(fd, hdr, 0, 20, 0);
const fileCount = hdr.readUInt32LE(16);
let pos = 20;
const entries = [];
for (let i = 0; i < fileCount; i++) {
  const nl = Buffer.alloc(4); readSync(fd, nl, 0, 4, pos); pos += 4;
  const nameLen = nl.readUInt32LE(0);
  const nb = Buffer.alloc(nameLen); readSync(fd, nb, 0, nameLen, pos); pos += nameLen;
  const mb = Buffer.alloc(16); readSync(fd, mb, 0, 16, pos); pos += 16;
  entries.push({ name: nb.toString('ascii'), size: Number(mb.readBigUInt64LE(0)), offset: Number(mb.readBigUInt64LE(8)) });
}
const headerEnd = pos;

function findEntry(absPos) {
  for (const e of entries) {
    const start = headerEnd + e.offset;
    const end = start + e.size;
    if (absPos >= start && absPos < end) return e.name;
  }
  return 'unknown';
}

for (const s of samples) {
  const searchText = s.original.substring(0, Math.min(20, s.original.length));
  
  const searchLE = Buffer.alloc(searchText.length * 2);
  const searchBE = Buffer.alloc(searchText.length * 2);
  for (let i = 0; i < searchText.length; i++) {
    const c = searchText.charCodeAt(i);
    searchLE[i*2] = c & 0xFF; searchLE[i*2+1] = (c >> 8) & 0xFF;
    searchBE[i*2] = (c >> 8) & 0xFF; searchBE[i*2+1] = c & 0xFF;
  }
  
  let found = false;
  for (let off = 0; off < wadSize && !found; off += CHUNK - 40) {
    const readSize = Math.min(CHUNK, wadSize - off);
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, off);
    
    let idx = buf.indexOf(searchLE);
    if (idx >= 0) {
      const absPos = off + idx;
      const entry = findEntry(absPos);
      console.log(`LE "${searchText}" -> ${entry} (from ${s.file})`);
      found = true;
    }
    idx = buf.indexOf(searchBE);
    if (idx >= 0) {
      const absPos = off + idx;
      const entry = findEntry(absPos);
      console.log(`BE "${searchText}" -> ${entry} (from ${s.file})`);
      found = true;
    }
  }
  if (!found) console.log(`NOT FOUND: "${searchText}" (from ${s.file})`);
}

closeSync(fd);
