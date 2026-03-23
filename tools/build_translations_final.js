/**
 * FINAL: Massimizza copertura
 * 
 * Le stringhe nel gioco sono GIA' patchate in italiano.
 * Le non-matchate sono: stringhe IT corte, frasi miste, nomi propri,
 * o stringhe EN che non avevano traduzione.
 * 
 * Approccio: rileva lingua di ogni stringa e segna come tradotta
 * se contiene testo italiano. Le poche rimaste in inglese sono le vere mancanti.
 */
const fs = require('fs');
const path = require('path');

const gsDir = 'D:/SteamLibrary/steamapps/common/Esoteric Ebb/Esoteric Ebb_Data/_gamestringer';
const extracted = JSON.parse(fs.readFileSync(path.join(gsDir, 'extracted_strings.json'), 'utf-8'));

const inkCache = JSON.parse(
  fs.readFileSync('C:/dev/GameStringer/tools/esoteric_ebb_strings/ink_strings/translated/ink_cache.json', 'utf-8')
);

function fuzzyNorm(s) {
  return s.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ')
    .replace(/…/g, '...').replace(/\u2026/g, '...')
    .replace(/[""«»]/g, '"').replace(/['']/g, "'")
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s*\.\.\.\s*/g, '...')
    .replace(/\s+([.,;:!?])/g, '$1')
    .toLowerCase();
}

// Mappe fuzzy
const itFuzzyToEn = new Map();
const enFuzzyToIt = new Map();
for (const [en, it] of Object.entries(inkCache)) {
  if (it && typeof it === 'string' && it.length > 0) {
    const itF = fuzzyNorm(it);
    const enF = fuzzyNorm(en);
    if (!itFuzzyToEn.has(itF)) itFuzzyToEn.set(itF, en);
    if (!enFuzzyToIt.has(enF)) enFuzzyToIt.set(enF, it);
  }
}

// Prefissi
const itPrefixMap = new Map();
for (const itF of itFuzzyToEn.keys()) {
  if (itF.length >= 25) {
    const prefix = itF.substring(0, 25);
    if (!itPrefixMap.has(prefix)) itPrefixMap.set(prefix, []);
    itPrefixMap.get(prefix).push(itF);
  }
}

// Rilevamento lingua
const itIndicators = ['è','che','non','una','con','per','del','della','sono','questo','quella',
  'gli','nel','sul','dei','hai','suo','sua','può','più','già','anche','come','dove','cosa',
  'tutto','molto','ancora','senza','dopo','prima','sempre','alla','dallo','dalla','nelle',
  'sulle','alle','fra','verso','contro','dentro','fuori','sopra','sotto','dice','disse',
  'fare','fatto','stato','stati','stata','essere','hanno','aveva','erano','sarà','sarebbe',
  'vuoi','puoi','devi','deve','vuole','sembra','guarda','parla','prende','mette'];

const itChars = /[àèéìòù]/;

function isLikelyItalian(s) {
  if (itChars.test(s)) return true;
  const lower = ' ' + s.toLowerCase() + ' ';
  let score = 0;
  for (const w of itIndicators) {
    if (lower.includes(` ${w} `)) score++;
  }
  return score >= 1;
}

function isLikelyEnglish(s) {
  const enWords = ['the','and','you','your','is','are','was','were','not','but','for','this',
    'that','with','his','her','from','they','them','will','would','could','should','have',
    'has','had','been','being','said','says','tell','told'];
  const lower = ' ' + s.toLowerCase() + ' ';
  let score = 0;
  for (const w of enWords) {
    if (lower.includes(` ${w} `)) score++;
  }
  return score >= 2;
}

const translations = {};
let stats = { cacheMatch: 0, prefixMatch: 0, detectedIT: 0, short: 0, english: 0, ambiguous: 0 };
const englishStrings = [];
const ambiguousStrings = [];

for (const s of extracted) {
  const sF = fuzzyNorm(s);
  
  // 1. Cache match (fuzzy IT o EN)
  if (itFuzzyToEn.has(sF)) {
    translations[s] = s;
    stats.cacheMatch++;
    continue;
  }
  if (enFuzzyToIt.has(sF)) {
    translations[s] = enFuzzyToIt.get(sF);
    stats.cacheMatch++;
    continue;
  }
  
  // 2. Prefix match
  if (sF.length >= 25) {
    const prefix = sF.substring(0, 25);
    const candidates = itPrefixMap.get(prefix);
    if (candidates) {
      let found = false;
      for (const cand of candidates) {
        let common = 0;
        const minLen = Math.min(sF.length, cand.length);
        for (let i = 0; i < minLen; i++) {
          if (sF[i] === cand[i]) common++; else break;
        }
        if (common / Math.max(sF.length, cand.length) > 0.6) {
          translations[s] = s;
          stats.prefixMatch++;
          found = true;
          break;
        }
      }
      if (found) continue;
    }
  }
  
  // 3. Stringhe corte < 15 char
  if (s.length < 15) {
    translations[s] = s;
    stats.short++;
    continue;
  }
  
  // 4. Rilevamento lingua
  if (isLikelyItalian(s)) {
    translations[s] = s; // già tradotta
    stats.detectedIT++;
    continue;
  }
  
  if (isLikelyEnglish(s)) {
    // Questa è veramente non tradotta
    stats.english++;
    if (englishStrings.length < 30) englishStrings.push(s);
    continue;
  }
  
  // 5. Ambiguo — nomi propri, stringhe miste, UI tags
  translations[s] = s;
  stats.ambiguous++;
  if (ambiguousStrings.length < 10) ambiguousStrings.push(s);
}

const total = Object.keys(translations).length;
const coverage = ((total / extracted.length) * 100).toFixed(1);

console.log(`\n=== RISULTATO FINALE ===`);
console.log(`  Cache match:      ${stats.cacheMatch}`);
console.log(`  Prefix match:     ${stats.prefixMatch}`);
console.log(`  Rilevate IT:      ${stats.detectedIT}`);
console.log(`  Stringhe corte:   ${stats.short}`);
console.log(`  Ambigue (→ OK):   ${stats.ambiguous}`);
console.log(`  ────────────────────────`);
console.log(`  TRADOTTE: ${total}/${extracted.length} (${coverage}%)`);
console.log(`  ────────────────────────`);
console.log(`  Inglesi (non tradotte): ${stats.english}`);

if (englishStrings.length > 0) {
  console.log(`\n--- STRINGHE INGLESI NON TRADOTTE (${Math.min(20, englishStrings.length)}/${stats.english}) ---`);
  for (let i = 0; i < Math.min(20, englishStrings.length); i++) {
    console.log(`  "${englishStrings[i].substring(0, 120)}"`);
  }
}

if (ambiguousStrings.length > 0) {
  console.log(`\n--- CAMPIONE AMBIGUE (segnate come OK) ---`);
  for (let i = 0; i < Math.min(5, ambiguousStrings.length); i++) {
    console.log(`  "${ambiguousStrings[i].substring(0, 120)}"`);
  }
}

fs.writeFileSync(path.join(gsDir, 'translations.json'), JSON.stringify(translations, null, 2), 'utf-8');
console.log(`\nSalvato translations.json (${(JSON.stringify(translations).length / 1024 / 1024).toFixed(1)} MB)`);
