import { dialoguePatcher } from '../lib/dialogue-patcher';
import * as path from 'path';
import * as fs from 'fs';

async function applyDecarnationPatch() {
  console.log('🎮 GameStringer - Applicazione Patch Italiana per Decarnation\n');

  const decarnationPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Decarnation\\Decarnation_Data\\Example folder\\Decarnation_DataClean - dialogues-resources.assets-52.txt';
  const patchPath = path.join(process.cwd(), 'patches', 'decarnation', 'decarnation-italian-patch.json');
  const outputPath = path.join(process.cwd(), 'patches', 'decarnation', 'dialogues-patched.txt');
  
  // Verifica file
  if (!fs.existsSync(decarnationPath)) {
    console.error('❌ File dialoghi originale non trovato!');
    return;
  }

  if (!fs.existsSync(patchPath)) {
    console.error('❌ File patch non trovato! Esegui prima create-decarnation-patch.ts');
    return;
  }

  try {
    console.log('📄 Caricamento patch...');
    const patch = dialoguePatcher.importPatch(patchPath);
    console.log(`✅ Patch caricata: ${patch.entries.length} voci`);

    const translatedCount = patch.entries.filter(e => e.textIT).length;
    console.log(`✅ Traduzioni disponibili: ${translatedCount}`);

    console.log('\n🔧 Applicazione patch...');
    dialoguePatcher.applyPatch(decarnationPath, patch, outputPath);
    
    console.log(`✅ Patch applicata! File salvato in:\n   ${outputPath}`);

    // Crea backup automatico
    const backupPath = path.join(process.cwd(), 'patches', 'decarnation', 'dialogues-original-backup.txt');
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(decarnationPath, backupPath);
      console.log(`\n📦 Backup originale creato in:\n   ${backupPath}`);
    }

    console.log('\n📋 Prossimi passi:');
    console.log('1. Fai un backup manuale del file originale del gioco');
    console.log('2. Copia il file patchato nella cartella del gioco:');
    console.log(`   COPIA: ${outputPath}`);
    console.log(`   INCOLLA: ${path.dirname(decarnationPath)}`);
    console.log('3. Rinomina il file come l\'originale');
    console.log('4. Avvia il gioco e goditi la traduzione italiana!');

  } catch (error) {
    console.error('❌ Errore durante l\'applicazione della patch:', error);
  }
}

// Esegui
applyDecarnationPatch().catch(console.error);
