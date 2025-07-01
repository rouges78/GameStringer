import * as fs from 'fs';
import * as path from 'path';

// Percorsi
const dialogueFile = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Decarnation\\Decarnation_Data\\Example folder\\Decarnation_DataClean - dialogues-resources.assets-52.txt';
const patchFile = path.join(process.cwd(), 'decarnation-italian-patch.json');
const outputFile = path.join(process.cwd(), 'decarnation-dialogues-patched.txt');

console.log('🎮 Applicazione Patch Italiana per Decarnation\n');

// Verifica se il file dialoghi esiste
if (!fs.existsSync(dialogueFile)) {
  console.error('❌ File dialoghi di Decarnation non trovato!');
  console.log('Percorso cercato:', dialogueFile);
  process.exit(1);
}

// Carica la patch
console.log('📄 Caricamento patch...');
const patch = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));
console.log(`✅ Trovate ${Object.keys(patch.translations).length} traduzioni\n`);

// Leggi il file dialoghi
console.log('📖 Lettura file dialoghi originale...');
const dialogueContent = fs.readFileSync(dialogueFile, 'utf-8');
const lines = dialogueContent.split('\n');

// Applica le traduzioni
console.log('🔧 Applicazione traduzioni...');
let translationsApplied = 0;
const patchedLines = lines.map(line => {
  const columns = line.split('\t');
  
  // La colonna 7 contiene il testo inglese
  if (columns.length > 7) {
    const englishText = columns[7];
    
    // Cerca se abbiamo una traduzione per questo testo
    if (patch.translations[englishText]) {
      // Sostituisci il testo inglese con quello italiano
      columns[7] = patch.translations[englishText];
      translationsApplied++;
      console.log(`✅ Tradotto: "${englishText}" → "${columns[7]}"`);
    }
  }
  
  return columns.join('\t');
});

// Salva il file patchato
console.log(`\n💾 Salvataggio file patchato...`);
fs.writeFileSync(outputFile, patchedLines.join('\n'), 'utf-8');

console.log(`\n✅ Patch applicata con successo!`);
console.log(`📊 Traduzioni applicate: ${translationsApplied}`);
console.log(`📄 File salvato in: ${outputFile}`);

console.log('\n📋 Prossimi passi:');
console.log('1. Fai un backup del file originale del gioco');
console.log('2. Copia il file patchato nella cartella del gioco:');
console.log(`   DA: ${outputFile}`);
console.log(`   A: ${path.dirname(dialogueFile)}`);
console.log('3. Rinomina il file patchato come l\'originale');
console.log('4. Avvia Decarnation e goditi i dialoghi in italiano! 🇮🇹');
