/**
 * Costruisce translations.json nel formato corretto per la preview.
 * 
 * Problema: le stringhe estratte dal gioco sono GIA' in italiano (patch applicata),
 * ma ink_cache.json ha chiavi inglesi. Dobbiamo invertire il mapping
 * e creare un file con chiave=stringa_estratta, valore=traduzione_italiana.
 * 
 * Strategia:
 * 1. Carica ink_cache (EN→IT)
 * 2. Crea mappa inversa (IT→EN) per sapere che una stringa italiana è una traduzione
 * 3. Per ogni stringa estratta: se è nel mapping inverso → è già tradotta
 * 4. Se è una stringa inglese originale nel cache → ha traduzione
 */
const fs = require('fs');
const path = require('path');

const gsDir = 'D:/SteamLibrary/steamapps/common/Esoteric Ebb/Esoteric Ebb_Data/_gamestringer';
const extracted = JSON.parse(fs.readFileSync(path.join(gsDir, 'extracted_strings.json'), 'utf-8'));

// Carica ink_cache (EN → IT)
const inkCache = JSON.parse(
  fs.readFileSync('C:/dev/GameStringer/tools/esoteric_ebb_strings/ink_strings/translated/ink_cache.json', 'utf-8')
);

// Crea mappa inversa IT → EN
const itToEn = new Map();
for (const [en, it] of Object.entries(inkCache)) {
  if (it && typeof it === 'string' && it.length > 3) {
    itToEn.set(it, en);
    // Normalizza: anche senza spazi trailing
    itToEn.set(it.trim(), en);
  }
}

console.log(`Extracted: ${extracted.length}`);
console.log(`ink_cache EN→IT: ${Object.keys(inkCache).length}`);
console.log(`Mappa inversa IT→EN: ${itToEn.size}`);

const translations = {};
let alreadyTranslated = 0;
let hasTranslation = 0;
let noMatch = 0;

for (const s of extracted) {
  // Caso 1: la stringa estratta è una traduzione italiana → già tradotta
  if (itToEn.has(s) || itToEn.has(s.trim())) {
    translations[s] = s; // è già la traduzione
    alreadyTranslated++;
    continue;
  }
  
  // Caso 2: la stringa estratta è inglese e ha traduzione nel cache
  if (inkCache[s]) {
    translations[s] = inkCache[s];
    hasTranslation++;
    continue;
  }
  
  // Caso 2b: con spazi
  const trimmed = s.trim();
  const withSpace = ' ' + s + ' ';
  if (inkCache[trimmed]) {
    translations[s] = inkCache[trimmed];
    hasTranslation++;
    continue;
  }
  
  // Caso 3: nessun match — probabile nome proprio, stringa corta, o UI
  noMatch++;
}

console.log(`\nRisultato:`);
console.log(`  Già tradotte (IT nel gioco): ${alreadyTranslated}`);
console.log(`  Con traduzione (EN→IT):      ${hasTranslation}`);
console.log(`  Nessun match:                ${noMatch}`);
console.log(`  Totale nel translations.json: ${Object.keys(translations).length}`);

const coverage = ((Object.keys(translations).length / extracted.length) * 100).toFixed(1);
console.log(`  Copertura: ${coverage}%`);

// Salva
fs.writeFileSync(path.join(gsDir, 'translations.json'), JSON.stringify(translations, null, 2), 'utf-8');
console.log(`\nSalvato translations.json (${(JSON.stringify(translations).length / 1024 / 1024).toFixed(1)} MB)`);
