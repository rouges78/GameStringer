import { dialoguePatcher } from '../lib/dialogue-patcher';
import * as path from 'path';
import * as fs from 'fs';

// Traduzioni italiane per i dialoghi principali di Decarnation
const italianTranslations: Record<string, string> = {
  "You're twenty-nine, right?": "Hai ventinove anni, giusto?",
  "Right!": "Esatto!",
  "I just wanted to say... I'm really excited to be here. To experience this.": "Volevo solo dirti... Sono davvero entusiasta di essere qui. Di vivere questa esperienza.",
  "Let's say we were lucky...": "Diciamo che siamo stati fortunati...",
  "Lucky?": "Fortunati?",
  "...That I found you in time, in your cabaret.": "...Che ti ho trovata in tempo, nel tuo cabaret.",
  "Before everything falls apart.": "Prima che tutto crolli.",
  "Falls... apart?": "Che tutto... crolli?",
  "The other day I came across the first girl to pose for me...": "L'altro giorno ho incontrato la prima ragazza che ha posato per me...",
  "We weren't even twenty at that time.": "Non avevamo nemmeno vent'anni all'epoca.",
  "Ah, Fannette. As bright as the sun. A Botticelli come to life, you know?": "Ah, Fannette. Luminosa come il sole. Un Botticelli vivente, capisci?",
  "And now... look what's left.": "E ora... guarda cosa ne resta.",
  "A decrepit troll in clown's makeup.": "Un vecchio troll truccato da clown.",
  "I'd like to take a break...": "Vorrei fare una pausa...",
  "Covered in cheap trinkets, clutching a little dog to divert the eye.": "Coperta di gingilli da quattro soldi, che si aggrappa a un cagnolino per distogliere lo sguardo.",
  "It makes me sick.": "Mi fa stare male.",
  "Yes? Who is it?": "Sì? Chi è?",
  "Seriously? It's Joy!": "Sul serio? Sono Joy!",
  "Well, hello, cupcake.": "Ciao, dolcezza.",
  "Nervous? Think it'll be crowded?": "Nervosa? Pensi che ci sarà molta gente?",
  "Joy, I didn't get off work until two in the morning. Go easy on me with the questions, okay?": "Joy, ho finito di lavorare alle due di notte. Vacci piano con le domande, ok?",
  "Oops. Sorry!": "Ops. Scusa!",
  "But yeah, I'm slightly anxious. Mostly curious to see what it looks like.": "Ma sì, sono un po' ansiosa. Soprattutto curiosa di vedere come sarà.",
  "Well, I imagine a statue of you will look...": "Beh, immagino che una statua di te sembrerà...",
  "...like you, probably!": "...come te, probabilmente!",
  "You know what I mean. What will it say about me?": "Sai cosa intendo. Cosa dirà di me?",
  "What will people see in her?": "Cosa vedranno le persone in lei?",
  "And... will it make college girls weak in the knees?": "E... farà sciogliere le studentesse universitarie?",
  "I don't know why I bother...": "Non so perché mi ostino...",
  "Sure you do! Come on, get ready so we can go. I'll wait outside.": "Certo che lo sai! Dai, preparati così possiamo andare. Ti aspetto fuori.",
  "I hope she likes it.": "Spero che le piaccia.",
  "Here's the little blue box for Joy.": "Ecco la scatolina blu per Joy.",
  "Oh, I almost forgot the little blue box for Joy.": "Oh, stavo quasi dimenticando la scatolina blu per Joy."
};

async function createDecarnationPatch() {
  console.log('🎮 GameStringer - Creazione Patch Italiana per Decarnation\n');

  const decarnationPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Decarnation\\Decarnation_Data\\Example folder\\Decarnation_DataClean - dialogues-resources.assets-52.txt';
  
  // Verifica che il file esista
  if (!fs.existsSync(decarnationPath)) {
    console.error('❌ File dialoghi Decarnation non trovato!');
    console.error(`   Percorso: ${decarnationPath}`);
    return;
  }

  console.log('📄 Parsing file dialoghi...');
  
  try {
    // Parse del file
    const records = dialoguePatcher.parseDialogueFile(decarnationPath);
    console.log(`✅ Trovati ${records.length} record totali`);

    // Estrai dialoghi
    const dialogues = dialoguePatcher.extractDialogues(records);
    console.log(`✅ Estratti ${dialogues.length} dialoghi`);

    // Crea patch italiana
    console.log('\n🇮🇹 Creazione patch italiana...');
    const patch = dialoguePatcher.createItalianPatch(dialogues);

    // Applica traduzioni automatiche dove disponibili
    let translatedCount = 0;
    for (const entry of patch.entries) {
      if (italianTranslations[entry.textEN]) {
        entry.textIT = italianTranslations[entry.textEN];
        translatedCount++;
      }
    }
    console.log(`✅ Tradotti automaticamente ${translatedCount} dialoghi`);

    // Crea directory output
    const outputDir = path.join(process.cwd(), 'patches', 'decarnation');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Salva patch JSON
    const patchPath = path.join(outputDir, 'decarnation-italian-patch.json');
    dialoguePatcher.exportPatch(patch, patchPath);
    console.log(`\n✅ Patch salvata in: ${patchPath}`);

    // Genera template CSV per traduzione manuale
    const templatePath = path.join(outputDir, 'decarnation-translation-template.csv');
    dialoguePatcher.generateTranslationTemplate(dialogues, templatePath);
    console.log(`✅ Template traduzione salvato in: ${templatePath}`);

    // Crea file README
    const readmePath = path.join(outputDir, 'README.md');
    const readmeContent = `# Patch Italiana per Decarnation

## 📁 File inclusi

- **decarnation-italian-patch.json**: Patch completa con traduzioni
- **decarnation-translation-template.csv**: Template per completare le traduzioni mancanti
- **dialogues-patched.txt**: File dialoghi patchato (dopo applicazione)

## 🎮 Come applicare la patch

1. **Backup del file originale**:
   \`\`\`
   Copia il file originale dei dialoghi in un luogo sicuro
   \`\`\`

2. **Applica la patch**:
   \`\`\`bash
   npm run patch:decarnation
   \`\`\`

3. **Sostituisci il file**:
   - Vai nella cartella del gioco
   - Sostituisci il file originale con quello patchato

## 📝 Statistiche traduzione

- Dialoghi totali: ${dialogues.length}
- Tradotti automaticamente: ${translatedCount}
- Da tradurre: ${dialogues.length - translatedCount}

## 🔧 Personalizzazione

Per aggiungere o modificare traduzioni:

1. Modifica il file \`decarnation-italian-patch.json\`
2. Riapplica la patch con il comando sopra

## ⚠️ Note importanti

- Fai sempre un backup del file originale
- La patch modifica solo i testi in inglese
- Alcuni dialoghi potrebbero richiedere aggiustamenti contestuali
`;

    fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    console.log(`✅ README creato in: ${readmePath}`);

    // Mostra statistiche
    console.log('\n📊 Statistiche patch:');
    console.log(`   - Dialoghi totali: ${dialogues.length}`);
    console.log(`   - Tradotti: ${translatedCount} (${Math.round(translatedCount/dialogues.length*100)}%)`);
    console.log(`   - Da tradurre: ${dialogues.length - translatedCount}`);
    console.log(`   - Personaggi: ${new Set(dialogues.map(d => d.characterEN)).size}`);

    // Mostra esempi di traduzioni
    console.log('\n📝 Esempi di traduzioni applicate:');
    const examples = patch.entries.filter(e => e.textIT).slice(0, 3);
    for (const ex of examples) {
      console.log(`\n   ${ex.characterEN}:`);
      console.log(`   EN: "${ex.textEN}"`);
      console.log(`   IT: "${ex.textIT}"`);
    }

  } catch (error) {
    console.error('❌ Errore durante la creazione della patch:', error);
  }
}

// Esegui lo script
createDecarnationPatch().catch(console.error);
