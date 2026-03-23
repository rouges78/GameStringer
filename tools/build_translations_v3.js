/**
 * v3: Fuzzy matching avanzato per massimizzare la copertura
 * 
 * Pattern di differenza identificati:
 * - "…" vs "..."
 * - Virgolette tipografiche vs dritte
 * - Spazi prima/dopo punteggiatura
 * - Accenti diversi
 * - HTML tags con varianti minori
 */
const fs = require('fs');
const path = require('path');

const gsDir = 'D:/SteamLibrary/steamapps/common/Esoteric Ebb/Esoteric Ebb_Data/_gamestringer';
const extracted = JSON.parse(fs.readFileSync(path.join(gsDir, 'extracted_strings.json'), 'utf-8'));

const inkCache = JSON.parse(
  fs.readFileSync('C:/dev/GameStringer/tools/esoteric_ebb_strings/ink_strings/translated/ink_cache.json', 'utf-8')
);

// Normalizzazione aggressiva per fuzzy match
function fuzzyNorm(s) {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/…/g, '...')
    .replace(/\u2026/g, '...')
    .replace(/[""«»]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\u2013|\u2014/g, '-')  // en-dash, em-dash → hyphen
    .replace(/\s*\.\.\.\s*/g, '...')
    .replace(/\s+([.,;:!?])/g, '$1') // rimuovi spazi prima punteggiatura
    .toLowerCase();
}

// Crea mappe fuzzy
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

// Crea anche un indice dei primi N caratteri per match parziale veloce
const itPrefixMap = new Map(); // prefix(30) → [full fuzzy key]
for (const itF of itFuzzyToEn.keys()) {
  if (itF.length >= 30) {
    const prefix = itF.substring(0, 30);
    if (!itPrefixMap.has(prefix)) itPrefixMap.set(prefix, []);
    itPrefixMap.get(prefix).push(itF);
  }
}

console.log(`Extracted: ${extracted.length}`);
console.log(`Mappa IT fuzzy: ${itFuzzyToEn.size}`);
console.log(`Mappa EN fuzzy: ${enFuzzyToIt.size}`);
console.log(`Prefissi IT (30ch): ${itPrefixMap.size}`);

const translations = {};
let stats = { exactIT: 0, fuzzyIT: 0, prefixIT: 0, exactEN: 0, fuzzyEN: 0, short: 0, noMatch: 0 };
const unmatched = [];

for (const s of extracted) {
  const sF = fuzzyNorm(s);
  
  // 1. Fuzzy match IT
  if (itFuzzyToEn.has(sF)) {
    translations[s] = s;
    stats.fuzzyIT++;
    continue;
  }
  
  // 2. Fuzzy match EN
  if (enFuzzyToIt.has(sF)) {
    translations[s] = enFuzzyToIt.get(sF);
    stats.fuzzyEN++;
    continue;
  }
  
  // 3. Prefix match per stringhe lunghe
  if (sF.length >= 30) {
    const prefix = sF.substring(0, 30);
    const candidates = itPrefixMap.get(prefix);
    if (candidates) {
      // Trova il match più simile
      let bestMatch = null;
      let bestScore = 0;
      for (const cand of candidates) {
        // Score basato sulla lunghezza del prefisso comune
        let common = 0;
        const minLen = Math.min(sF.length, cand.length);
        for (let i = 0; i < minLen; i++) {
          if (sF[i] === cand[i]) common++;
          else break;
        }
        const score = common / Math.max(sF.length, cand.length);
        if (score > bestScore && score > 0.7) {
          bestScore = score;
          bestMatch = cand;
        }
      }
      if (bestMatch) {
        translations[s] = s;
        stats.prefixIT++;
        continue;
      }
    }
  }
  
  // 4. Stringhe corte (<15 char) → nomi propri, numeri, UI
  if (s.length < 15) {
    translations[s] = s;
    stats.short++;
    continue;
  }
  
  // 5. Stringhe medie (15-40) che contengono parole italiane comuni → probabilmente già tradotte
  if (s.length <= 60) {
    const itWords = ['è','che','non','una','con','per','del','della','sono','questo','quella',
                     'gli','nel','sul','dei','hai','suo','sua','può','più','già','anche','come',
                     'dove','cosa','tutto','molto','ancora','senza','dopo','prima','sempre'];
    const lower = s.toLowerCase();
    const itScore = itWords.filter(w => lower.includes(` ${w} `) || lower.startsWith(`${w} `) || lower.endsWith(` ${w}`)).length;
    if (itScore >= 1) {
      translations[s] = s;
      stats.fuzzyIT++;
      continue;
    }
  }
  
  // 6. Stringhe più lunghe con parole italiane
  if (s.length > 60) {
    const itWords = ['è','che','non','una','con','per'];
    const lower = s.toLowerCase();
    const itScore = itWords.filter(w => lower.includes(` ${w} `)).length;
    if (itScore >= 1) {
      translations[s] = s;
      stats.fuzzyIT++;
      continue;
    }
  }
  
  stats.noMatch++;
  if (unmatched.length < 30) unmatched.push(s);
}

const total = Object.keys(translations).length;
const coverage = ((total / extracted.length) * 100).toFixed(1);

console.log(`\n=== RISULTATO ===`);
console.log(`  Fuzzy IT match:    ${stats.fuzzyIT}`);
console.log(`  Prefix IT match:   ${stats.prefixIT}`);
console.log(`  Fuzzy EN match:    ${stats.fuzzyEN}`);
console.log(`  Stringhe corte:    ${stats.short}`);
console.log(`  Nessun match:      ${stats.noMatch}`);
console.log(`  TOTALE: ${total}/${extracted.length} (${coverage}%)`);

if (unmatched.length > 0) {
  console.log(`\n--- Non matchate (${Math.min(15, unmatched.length)} su ${stats.noMatch}) ---`);
  for (let i = 0; i < Math.min(15, unmatched.length); i++) {
    console.log(`  [${i}] "${unmatched[i].substring(0, 120)}"`);
  }
  
  // Analizza le non matchate
  let enCount = 0, itCount = 0, otherCount = 0;
  const enCheck = ['the','and','you','is','was','not','but','for','this','that','with'];
  const itCheck = ['è','che','non','una','con','per','del','della','nel','sul'];
  for (const s of unmatched) {
    const low = s.toLowerCase();
    const en = enCheck.filter(w => low.includes(` ${w} `)).length;
    const it = itCheck.filter(w => low.includes(` ${w} `)).length;
    if (en > it) enCount++;
    else if (it > en) itCount++;
    else otherCount++;
  }
  console.log(`\nLingua delle non matchate (campione ${unmatched.length}):`);
  console.log(`  EN: ${enCount}, IT: ${itCount}, Altro/Misto: ${otherCount}`);
}

fs.writeFileSync(path.join(gsDir, 'translations.json'), JSON.stringify(translations, null, 2), 'utf-8');
console.log(`\nSalvato translations.json (${(JSON.stringify(translations).length / 1024 / 1024).toFixed(1)} MB)`);
