/**
 * v2: Match migliorato con normalizzazione e fuzzy matching
 */
const fs = require('fs');
const path = require('path');

const gsDir = 'D:/SteamLibrary/steamapps/common/Esoteric Ebb/Esoteric Ebb_Data/_gamestringer';
const extracted = JSON.parse(fs.readFileSync(path.join(gsDir, 'extracted_strings.json'), 'utf-8'));

const inkCache = JSON.parse(
  fs.readFileSync('C:/dev/GameStringer/tools/esoteric_ebb_strings/ink_strings/translated/ink_cache.json', 'utf-8')
);

// Normalizza: trim + collapse whitespace
function normalize(s) {
  return s.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
}

// Crea mappe con chiavi normalizzate
const itToEnNorm = new Map(); // IT normalizzata → EN originale
const enToItNorm = new Map(); // EN normalizzata → IT

for (const [en, it] of Object.entries(inkCache)) {
  if (it && typeof it === 'string' && it.length > 0) {
    const itN = normalize(it);
    const enN = normalize(en);
    if (!itToEnNorm.has(itN)) itToEnNorm.set(itN, en);
    if (!enToItNorm.has(enN)) enToItNorm.set(enN, it);
  }
}

console.log(`Extracted: ${extracted.length}`);
console.log(`Mappa IT→EN (norm): ${itToEnNorm.size}`);
console.log(`Mappa EN→IT (norm): ${enToItNorm.size}`);

const translations = {};
let alreadyTranslated = 0;
let hasTranslation = 0;
let shortString = 0;
let noMatch = 0;
const unmatched = [];

for (const s of extracted) {
  const sNorm = normalize(s);
  
  // Caso 1: stringa estratta corrisponde a una traduzione IT nel cache
  if (itToEnNorm.has(sNorm)) {
    translations[s] = s;
    alreadyTranslated++;
    continue;
  }
  
  // Caso 2: stringa estratta è inglese e ha traduzione
  if (enToItNorm.has(sNorm)) {
    translations[s] = enToItNorm.get(sNorm);
    hasTranslation++;
    continue;
  }
  
  // Caso 3: stringhe molto corte (< 15 char) → probabilmente nomi, numeri, UI
  if (s.length < 15) {
    // Segna come "tradotta" (non servono traduzione — sono nomi propri, UI, etc.)
    translations[s] = s;
    shortString++;
    continue;
  }
  
  // Caso 4: prova match parziale — la stringa estratta contiene una traduzione
  let found = false;
  // Solo per stringhe abbastanza lunghe
  if (sNorm.length >= 30) {
    const prefix = sNorm.substring(0, 40);
    for (const [itN, en] of itToEnNorm) {
      if (itN.startsWith(prefix) || prefix.startsWith(itN.substring(0, 40))) {
        translations[s] = s;
        alreadyTranslated++;
        found = true;
        break;
      }
    }
  }
  if (found) continue;
  
  noMatch++;
  if (unmatched.length < 20) unmatched.push(s);
}

const total = Object.keys(translations).length;
const coverage = ((total / extracted.length) * 100).toFixed(1);

console.log(`\nRisultato:`);
console.log(`  Già tradotte (IT match):     ${alreadyTranslated}`);
console.log(`  Con traduzione (EN→IT):      ${hasTranslation}`);
console.log(`  Stringhe corte (<15 char):   ${shortString}`);
console.log(`  Nessun match:                ${noMatch}`);
console.log(`  Totale: ${total}/${extracted.length} (${coverage}%)`);

if (unmatched.length > 0) {
  console.log(`\n--- Campione non matchate (${Math.min(10, unmatched.length)}) ---`);
  for (let i = 0; i < Math.min(10, unmatched.length); i++) {
    console.log(`  "${unmatched[i].substring(0, 120)}"`);
  }
}

fs.writeFileSync(path.join(gsDir, 'translations.json'), JSON.stringify(translations, null, 2), 'utf-8');
console.log(`\nSalvato translations.json (${(JSON.stringify(translations).length / 1024 / 1024).toFixed(1)} MB)`);
