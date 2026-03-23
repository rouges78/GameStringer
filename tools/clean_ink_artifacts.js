/**
 * Pulizia artefatti AI dalle traduzioni Ink di Esoteric Ebb
 * 
 * Strategia: estrae il testo italiano valido anche se mescolato con token AI.
 * Es: "<|im_start|>utente</|im_start|>\nTesto buono</|im_end|>" → "Testo buono"
 * 
 * Output:
 * - translate_progress_cleaned.json  → traduzioni pulite
 * - needs_retranslation.json         → entries vuote/garbage dopo pulizia  
 * - cleanup_report.txt               → report della pulizia
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'esoteric_ebb_strings', 'ink_strings');
const INPUT = path.join(BASE, 'translate_progress.json');
const OUTPUT_CLEAN = path.join(BASE, 'translate_progress_cleaned.json');
const OUTPUT_RETRANSLATE = path.join(BASE, 'needs_retranslation.json');
const REPORT = path.join(BASE, 'cleanup_report.txt');

function cleanTranslation(text) {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text;

  // Unescape \n → newline reali per processarle meglio
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // Rimuovi tutti i token chat template (con varianti di chiusura)
  cleaned = cleaned.replace(/<\|im_start\|>/gi, '');
  cleaned = cleaned.replace(/<\|im_end\|>/gi, '');
  cleaned = cleaned.replace(/<\/\|im_start\|>/gi, '');
  cleaned = cleaned.replace(/<\/\|im_end\|>/gi, '');
  
  // Rimuovi le parole "assistente" e "utente" che sono residui di ruolo
  // Ma solo quando sono isolate (non parte di una frase italiana vera)
  cleaned = cleaned.replace(/^\s*assistente\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*utente\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*assistant\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*user\s*$/gim, '');
  // In fondo alla stringa
  cleaned = cleaned.replace(/\s*assistente\s*$/gi, '');
  cleaned = cleaned.replace(/\s*utente\s*$/gi, '');
  // All'inizio della stringa
  cleaned = cleaned.replace(/^\s*assistente\s*/gi, '');
  cleaned = cleaned.replace(/^\s*utente\s*/gi, '');
  
  // Pulizia finale
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\n/gm, '')       // righe vuote
    .trim();
  
  return cleaned;
}

function isGarbage(text) {
  if (!text) return true;
  // Dopo il trim, deve avere almeno un po' di contenuto
  const stripped = text.replace(/[\s\n\r<>|\/\-_"'.,;:!?()\[\]{}]/g, '');
  if (stripped.length < 3) return true;
  // Deve contenere lettere latine (italiano)
  if (!/[a-zA-ZàèéìòùÀÈÉÌÒÙ]/i.test(text)) return true;
  // Se è solo "assistente" o simili
  if (/^(assistente|utente|assistant|user)$/i.test(stripped)) return true;
  return false;
}

// ─── Main ────────────────────────────────────────────────────────

console.log('Lettura translate_progress.json...');
const raw = fs.readFileSync(INPUT, 'utf-8');

// Parse manuale riga-per-riga (gestisce chiavi duplicate)
const entries = [];
const seen = new Set();
const lines = raw.split('\n');

for (const line of lines) {
  // Match key:value JSON — gestisce anche valori con escaped quotes
  const match = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
  if (match) {
    const key = match[1];
    const val = match[2];
    // Dedup: tieni la prima occorrenza
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ key, value: val });
    }
  }
}

console.log(`Trovate ${entries.length} entries uniche`);

// Analisi pre-pulizia
const hasArtifact = e => /<\|im_/.test(e.value) || /<\/\|im_/.test(e.value);
const dirtyBefore = entries.filter(hasArtifact).length;
console.log(`Entries con artefatti AI: ${dirtyBefore}`);

// Pulizia
const cleaned = [];
const needsRetranslation = [];
let fixedCount = 0;
let unchangedCount = 0;
let garbageCount = 0;

for (const entry of entries) {
  const original = entry.value;
  const cleanedValue = cleanTranslation(original);
  
  if (isGarbage(cleanedValue)) {
    needsRetranslation.push(entry.key);
    garbageCount++;
  } else if (cleanedValue !== original) {
    cleaned.push({ key: entry.key, value: cleanedValue });
    fixedCount++;
  } else {
    cleaned.push({ key: entry.key, value: original });
    unchangedCount++;
  }
}

// Salva traduzioni pulite
const cleanedObj = {};
for (const c of cleaned) {
  cleanedObj[c.key] = c.value;
}
fs.writeFileSync(OUTPUT_CLEAN, JSON.stringify(cleanedObj, null, 2), 'utf-8');

// Salva lista da ri-tradurre
fs.writeFileSync(OUTPUT_RETRANSLATE, JSON.stringify(needsRetranslation, null, 2), 'utf-8');

// Mostra campione entries recuperate
console.log('\n--- Campione entries recuperate ---');
let shown = 0;
for (const entry of entries) {
  if (hasArtifact(entry)) {
    const cv = cleanTranslation(entry.value);
    if (!isGarbage(cv)) {
      console.log(`  EN: ${entry.key.substring(0, 80)}...`);
      console.log(`  IT: ${cv.substring(0, 80)}...`);
      console.log();
      shown++;
      if (shown >= 3) break;
    }
  }
}

// Mostra campione garbage
console.log('--- Campione garbage (da ri-tradurre) ---');
shown = 0;
for (const entry of entries) {
  const cv = cleanTranslation(entry.value);
  if (isGarbage(cv)) {
    console.log(`  EN: ${entry.key.substring(0, 100)}`);
    console.log(`  RAW: "${entry.value.substring(0, 60)}"`);
    console.log();
    shown++;
    if (shown >= 3) break;
  }
}

// Report
const report = [
  '===============================================',
  '  PULIZIA ARTEFATTI AI - Esoteric Ebb (Ink)',
  '===============================================',
  '',
  `Totale entries analizzate:   ${entries.length}`,
  `Entries con artefatti:       ${dirtyBefore}`,
  '',
  'RISULTATO PULIZIA:',
  `  Gia pulite (invariate):    ${unchangedCount}`,
  `  Pulite con successo:       ${fixedCount}`,
  `  Irrecuperabili (garbage):  ${garbageCount}`,
  '',
  `Traduzioni salvate:  ${cleaned.length}`,
  `Da ri-tradurre:      ${needsRetranslation.length}`,
  '',
  'File generati:',
  '  -> translate_progress_cleaned.json',
  '  -> needs_retranslation.json',
  '  -> cleanup_report.txt',
  '===============================================',
].join('\n');

console.log('\n' + report);
fs.writeFileSync(REPORT, report, 'utf-8');

console.log('\nPulizia completata!');
