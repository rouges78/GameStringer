// Extract ONLY player-visible UI strings from the game assets
// Strategy: search for strings that appear in screenshots and known UI elements
const fs = require('fs');
const path = require('path');

const dataDir = 'D:\\SteamLibrary\\steamapps\\common\\Esoteric Ebb\\Esoteric Ebb_Data';

// Known UI strings from the game (from screenshots + typical RPG UI)
const knownUIStrings = [
  // Main Menu
  'New Game', 'Load', 'Options', 'Credits', 'Exit', 'Continue',
  // Settings - Dialogs
  'Dialogs', 'Dialog Text Size', 'Dialog Fonts', 'UI Size', 'Colorblind Mode',
  // Settings - Visuals  
  'Visuals', 'Quality', 'Display Mode', 'Resolution', 'Refresh Cap',
  'Borderless', 'Fullscreen', 'Windowed', 'High', 'Medium', 'Low', 'Ultra',
  // Settings - Audio
  'Audio', 'Master Volume', 'Music Volume', 'Ambient Volume', 'World Volume', 
  'Voice Volume', 'UI Volume', 'Reset Settings',
  // Character Creation
  'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma',
  'Proficient', 'Proficiencies', 'Randomize', 'Return', 'Pre-Built',
  'Background Focus', 'Punching Bag', 'Lore', 'Uses', 'Role',
  // Stats
  'Hit Points', 'Armor Class', 'Speed', 'Initiative', 'Level', 'Experience',
  'Saving Throw', 'Saving Throws', 'Attack', 'Damage', 'Spell', 'Spells',
  'Health', 'Defense', 'Skills', 'Abilities', 'Inventory', 'Equipment',
  // Combat/Gameplay
  'Attack', 'Defend', 'Cast', 'Use', 'Rest', 'Wait', 'Move', 'Talk', 'Examine',
  'Pick Up', 'Drop', 'Trade', 'Buy', 'Sell', 'Steal', 'Persuade', 'Intimidate',
  // UI Labels
  'Journal', 'Map', 'Quest', 'Quests', 'Party', 'Character', 'Characters',
  'Save Game', 'Load Game', 'Quick Save', 'Quick Load', 'Auto Save',
  'Difficulty', 'Easy', 'Normal', 'Hard', 'Very Hard',
  // Common RPG
  'Gold', 'Silver', 'Copper', 'Weight', 'Encumbrance',
  'Proficiency Bonus', 'Modifier', 'Score', 'Check', 'Roll', 'Dice',
  'Advantage', 'Disadvantage', 'Success', 'Failure', 'Critical',
  'Wizard', 'Cleric', 'Fighter', 'Rogue', 'Ranger', 'Paladin', 'Bard',
  'Sorcerer', 'Warlock', 'Druid', 'Monk', 'Barbarian',
  // Dice  
  'Dice Check', 'Dice Checks',
  // Game specific from screenshots
  'Album Release', 'CAUGHT_STEALING',
  'Which font should I choose?',
  'Averia Serif',
  'Huge', 'Off', 'On',
];

// Read ALL files and find which strings actually exist
const files = [];
for (let i = 0; i <= 24; i++) {
  const lf = path.join(dataDir, `level${i}`);
  const bf = lf + '.backup';
  if (fs.existsSync(bf)) files.push({ name: `level${i}`, path: bf });
  else if (fs.existsSync(lf)) files.push({ name: `level${i}`, path: lf });
  
  const sf = path.join(dataDir, `sharedassets${i}.assets`);
  const sbf = sf + '.backup';
  if (fs.existsSync(sbf)) files.push({ name: `sharedassets${i}.assets`, path: sbf });
  else if (fs.existsSync(sf)) files.push({ name: `sharedassets${i}.assets`, path: sf });
}

// Also search resources.assets
const rf = path.join(dataDir, 'resources.assets');
if (fs.existsSync(rf)) files.push({ name: 'resources.assets', path: rf });

console.log(`Files to search: ${files.length}`);

// For each file, search for all known strings AND extract longer English text
const foundStrings = new Map(); // string -> [files where found]
const longStrings = new Map(); // longer strings found in assets

for (const file of files) {
  const buf = fs.readFileSync(file.path);
  
  // Search known strings
  for (const uiStr of knownUIStrings) {
    const searchBuf = Buffer.from(uiStr, 'utf-8');
    if (buf.includes(searchBuf)) {
      if (!foundStrings.has(uiStr)) foundStrings.set(uiStr, []);
      foundStrings.get(uiStr).push(file.name);
    }
  }
  
  // Also extract Unity length-prefixed strings that look like game text
  // Unity string format: [4-byte length LE] [UTF8 data] [padding to 4-byte alignment]
  let offset = 0;
  while (offset < buf.length - 8) {
    const len = buf.readUInt32LE(offset);
    // Only check reasonable lengths for UI strings (3-500 chars)
    if (len >= 3 && len <= 500 && offset + 4 + len <= buf.length) {
      // Check byte before length - often 0x00 for string fields
      const strBytes = buf.slice(offset + 4, offset + 4 + len);
      const str = strBytes.toString('utf-8');
      
      // Validate: mostly ASCII printable, contains English words
      const printableRatio = str.split('').filter(c => {
        const code = c.charCodeAt(0);
        return code >= 32 && code < 127;
      }).length / str.length;
      
      if (printableRatio > 0.9 && /[A-Z][a-z]/.test(str) && str.includes(' ')) {
        // Check it's not a path or technical string
        if (!str.includes('/') && !str.includes('\\') && !str.includes('{') && 
            !str.includes('event:') && !str.includes('guid:') &&
            !str.startsWith('m_') && !/^[a-z]+[A-Z]/.test(str) &&
            !/\.(png|jpg|wav|mp3|ogg|fbx|shader|mat|prefab|asset)/.test(str)) {
          // Looks like game text
          if (!longStrings.has(str)) longStrings.set(str, []);
          if (!longStrings.get(str).includes(file.name)) {
            longStrings.get(str).push(file.name);
          }
        }
      }
    }
    offset += 4; // step by 4 for alignment
  }
  
  process.stdout.write(`  ${file.name}\r`);
}

console.log(`\n\nKnown UI strings found: ${foundStrings.size}/${knownUIStrings.length}`);

// Show found
console.log('\n--- Found UI strings ---');
for (const [str, files] of foundStrings) {
  console.log(`  "${str}" -> ${files.slice(0, 3).join(', ')}`);
}

// Show not found
const notFound = knownUIStrings.filter(s => !foundStrings.has(s));
console.log(`\n--- NOT found (${notFound.length}) ---`);
notFound.forEach(s => console.log(`  "${s}"`));

// Show extracted long strings (filter more)
console.log(`\n--- Extracted game text (${longStrings.size} unique) ---`);
const gameText = [];
for (const [str, files] of longStrings) {
  // Final filter: must look like player-visible text
  if (str.length >= 10 && str.length <= 300 && 
      /[a-zA-Z]{3,}/.test(str) &&
      !str.match(/^[A-Z_]{5,}$/) && // not constants
      !str.match(/^\d/) && // not starting with numbers
      str.split(' ').length >= 2) { // at least 2 words
    gameText.push(str);
  }
}

console.log(`Filtered game text: ${gameText.length}`);
gameText.slice(0, 30).forEach(s => console.log(`  "${s.substring(0, 100)}"`));

// Save combined results
const outputPath = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\level_strings\\ui_strings_final.json';
const combined = {};

// Add known found strings
for (const [str] of foundStrings) {
  combined[str] = '';
}

// Add extracted game text
for (const str of gameText) {
  combined[str] = '';
}

fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2), 'utf-8');
console.log(`\nSalvato: ${outputPath} (${Object.keys(combined).length} stringhe)`);
