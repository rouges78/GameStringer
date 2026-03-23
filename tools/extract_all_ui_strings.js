// Extract ALL UI/text strings from level and sharedassets files
// These are direct string fields in Unity assets (TextMeshPro, UI.Text, etc.)
// NOT Ink JSON blobs (those are handled by InjectInk)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dataDir = 'D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data';
const outputPath = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\level_strings\\all_ui_strings.json';

// Load existing ink translations to exclude already-translated Ink text
const inkCsv = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\ink_strings\\translated\\ink_translations.csv';
const inkKeys = new Set();
if (fs.existsSync(inkCsv)) {
  const lines = fs.readFileSync(inkCsv, 'utf-8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const comma = lines[i].indexOf(',');
    if (comma > 0) {
      let key = lines[i].substring(0, comma).replace(/^"|"$/g, '').replace(/""/g, '"');
      inkKeys.add(key.trim());
    }
  }
  console.log(`Ink keys loaded: ${inkKeys.size} (to exclude)`);
}

// We'll use a simpler approach: search raw bytes for readable strings
// that look like game UI text (not code, not paths, not Ink JSON)
const allStrings = new Map(); // value -> {files: [], count: 0}

function extractReadableStrings(buf, fname) {
  // Find null-terminated or length-prefixed strings
  // Unity stores strings as: 4-byte length + UTF8 data + padding
  let offset = 0;
  const found = [];
  
  while (offset < buf.length - 4) {
    // Try reading as Unity string: length prefix
    const len = buf.readUInt32LE(offset);
    
    // Reasonable string length (5 to 2000 chars)
    if (len >= 5 && len <= 2000 && offset + 4 + len <= buf.length) {
      const strBytes = buf.slice(offset + 4, offset + 4 + len);
      
      // Check if it's valid UTF-8 text
      const str = strBytes.toString('utf-8');
      
      // Must have mostly printable ASCII
      const printable = str.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127).length;
      
      if (printable / str.length > 0.85) {
        // Filter criteria for UI strings
        if (isGameUIString(str)) {
          found.push(str);
        }
      }
    }
    offset++;
  }
  
  return found;
}

function isGameUIString(s) {
  // Skip if it's an Ink JSON blob
  if (s.includes('inkVersion') || s.includes('"^->":')) return false;
  
  // Skip paths, code, technical strings
  if (s.startsWith('Assets/') || s.startsWith('Packages/')) return false;
  if (s.includes('UnityEngine') || s.includes('.shader') || s.includes('.mat')) return false;
  if (s.includes('.prefab') || s.includes('.asset') || s.includes('guid:')) return false;
  if (s.includes('.cs') || s.includes('.dll') || s.includes('namespace')) return false;
  if (s.match(/^[a-f0-9\-]{20,}$/)) return false; // GUIDs
  if (s.match(/^[0-9.]+$/)) return false; // pure numbers
  if (s.startsWith('http') || s.startsWith('www.')) return false;
  
  // Must contain at least 3 letters
  if (!(s.match(/[a-zA-Z]{3,}/))) return false;
  
  // Skip very technical/internal names
  if (s.match(/^m_[A-Z]/) || s.startsWith('_') || s.match(/^[A-Z][a-z]+[A-Z]/)) return false;
  
  // Keep if it has spaces (natural language) or is a short label
  const hasSpaces = s.includes(' ');
  const isLabel = s.length <= 30 && s.match(/^[A-Z][a-z]/);
  
  return hasSpaces || isLabel;
}

// Process all files
const files = [];
for (let i = 0; i <= 24; i++) {
  files.push(`level${i}`);
  files.push(`sharedassets${i}.assets`);
}
// Also resources.assets
files.push('resources.assets');

let totalFound = 0;

for (const fname of files) {
  const fpath = path.join(dataDir, fname);
  // Use backup if exists (original unmodified)
  const bpath = fpath + '.backup';
  const sourcePath = fs.existsSync(bpath) ? bpath : fpath;
  if (!fs.existsSync(sourcePath)) continue;
  
  const buf = fs.readFileSync(sourcePath);
  const content = buf.toString('utf-8');
  
  // Simple approach: find all substrings that look like UI text
  // Search for common UI patterns
  const uiPatterns = [
    // Known UI strings from screenshots
    'New Game', 'Load', 'Options', 'Credits', 'Exit',
    'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma',
    'Proficient', 'Proficiencies', 'Randomize',
    'Background Focus', 'Punching Bag', 'Return', 'Pre-Built',
    'Lore', 'Uses', 'Role',
    'Master Volume', 'Music Volume', 'Ambient Volume', 'World Volume', 'Voice Volume', 'UI Volume',
    'Dialog Text Size', 'Dialog Fonts', 'UI Size', 'Colorblind Mode',
    'Quality', 'Display Mode', 'Resolution', 'Refresh Cap',
    'Borderless', 'Fullscreen', 'Windowed',
    'Reset Settings', 'Visuals', 'Audio', 'Dialogs',
    'Averia Serif',
  ];
  
  // Find these in the content
  for (const pat of uiPatterns) {
    if (content.includes(pat)) {
      if (!allStrings.has(pat)) {
        allStrings.set(pat, { files: [], count: 0 });
      }
      allStrings.get(pat).files.push(fname);
      allStrings.get(pat).count++;
    }
  }
  
  // Also extract length-prefixed strings that look like English text
  // More targeted: look for strings between null bytes
  const regex = /[\x20-\x7E]{5,500}/g;
  let match;
  const seenInFile = new Set();
  while ((match = regex.exec(content)) !== null) {
    const s = match[0].trim();
    if (s.length < 5) continue;
    if (seenInFile.has(s)) continue;
    seenInFile.add(s);
    
    if (isGameUIString(s) && !inkKeys.has(s)) {
      // Additional filter: must look like actual UI/game text
      const isEnglish = s.match(/[a-zA-Z]/) && !s.match(/^[{}\[\]]/);
      if (isEnglish) {
        if (!allStrings.has(s)) {
          allStrings.set(s, { files: [], count: 0 });
        }
        if (!allStrings.get(s).files.includes(fname)) {
          allStrings.get(s).files.push(fname);
        }
        allStrings.get(s).count++;
        totalFound++;
      }
    }
  }
  
  process.stdout.write(`${fname}: ${seenInFile.size} raw strings\r`);
}

console.log(`\nTotal unique UI strings: ${allStrings.size}`);

// Categorize
const categories = {
  menu: [],
  stats: [],
  settings: [],
  gameplay: [],
  descriptions: [],
  other: [],
};

for (const [str, info] of allStrings) {
  const lower = str.toLowerCase();
  if (['new game','load','save','options','credits','exit','continue','return','quit'].some(m => lower.includes(m))) {
    categories.menu.push(str);
  } else if (['strength','dexterity','constitution','intelligence','wisdom','charisma','proficient','hit points'].some(m => lower.includes(m))) {
    categories.stats.push(str);
  } else if (['volume','resolution','display','quality','refresh','colorblind','borderless','fullscreen','vsync'].some(m => lower.includes(m))) {
    categories.settings.push(str);
  } else if (str.length > 80) {
    categories.descriptions.push(str);
  } else {
    categories.other.push(str);
  }
}

console.log('\nCategorie:');
for (const [cat, items] of Object.entries(categories)) {
  console.log(`  ${cat}: ${items.length}`);
  items.slice(0, 3).forEach(s => console.log(`    "${s.substring(0, 80)}"`));
}

// Save all as JSON for translation
const output = {};
for (const [str] of allStrings) {
  output[str] = ''; // empty = needs translation
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`\nSalvato: ${outputPath} (${allStrings.size} stringhe)`);
