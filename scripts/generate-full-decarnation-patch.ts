import * as fs from 'fs';
import * as path from 'path';

// Mappa completa delle traduzioni italiane per Decarnation
const decarnationTranslations = {
  // Scena 1 - Workshop di Petrus
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
  
  // Scena 2 - Appartamento
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

function generateFullPatch() {
  const patchData = {
    gameId: "decarnation",
    gameName: "Decarnation",
    sourceFile: "dialogues-resources.assets-52.txt",
    targetLanguage: "it",
    version: "1.0.0",
    translations: decarnationTranslations,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      translatedCount: Object.keys(decarnationTranslations).length,
      author: "GameStringer",
      description: "Patch di traduzione italiana per Decarnation - Dialoghi principali"
    }
  };

  // Crea directory se non esiste
  const outputDir = path.join(process.cwd(), 'patches', 'decarnation');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Salva patch completa
  const patchPath = path.join(outputDir, 'decarnation-italian-translations.json');
  fs.writeFileSync(patchPath, JSON.stringify(patchData, null, 2), 'utf-8');
  
  console.log(`✅ Patch italiana completa creata con ${Object.keys(decarnationTranslations).length} traduzioni!`);
  console.log(`📁 Salvata in: ${patchPath}`);

  // Crea anche un file README aggiornato
  const readmeContent = `# 🇮🇹 Patch Italiana per Decarnation

## 📊 Stato Traduzione

- **Traduzioni complete**: ${Object.keys(decarnationTranslations).length} dialoghi
- **Versione**: 1.0.0
- **Ultimo aggiornamento**: ${new Date().toLocaleDateString('it-IT')}

## 🎮 Come Applicare la Patch

### Metodo 1: Injection in Memoria (Consigliato)
1. Avvia GameStringer
2. Vai alla sezione "Injekt-Translator"
3. Avvia Decarnation
4. Clicca su "Inizia Injection"
5. Le traduzioni verranno applicate automaticamente in tempo reale

### Metodo 2: Modifica File Dialoghi
1. **Backup del file originale**:
   \`\`\`
   C:\\Program Files (x86)\\Steam\\steamapps\\common\\Decarnation\\Decarnation_Data\\Example folder\\
   Decarnation_DataClean - dialogues-resources.assets-52.txt
   \`\`\`

2. **Applica la patch** usando lo script fornito

3. **Sostituisci il file** nel gioco con quello patchato

## 📝 Esempi di Traduzioni

### Gloria e Petrus - Workshop
- **EN**: "You're twenty-nine, right?"
- **IT**: "Hai ventinove anni, giusto?"

### Gloria e Joy - Appartamento  
- **EN**: "Well, hello, cupcake."
- **IT**: "Ciao, dolcezza."

## 🔧 Personalizzazione

Per aggiungere nuove traduzioni:
1. Modifica il file \`decarnation-italian-translations.json\`
2. Aggiungi le coppie inglese-italiano nel campo \`translations\`
3. Riapplica la patch

## ⚠️ Note Importanti

- Fai sempre un backup del file originale prima di modificarlo
- Alcune traduzioni potrebbero richiedere aggiustamenti contestuali
- Il gioco potrebbe richiedere il riavvio per applicare le modifiche

## 🤝 Contributi

Vuoi migliorare le traduzioni? Apri una issue o invia una pull request!
`;

  const readmePath = path.join(outputDir, 'README.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf-8');
  console.log(`📄 README aggiornato: ${readmePath}`);
}

// Esegui
generateFullPatch();
