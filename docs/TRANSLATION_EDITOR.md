# Editor Traduzioni - GameStringer

## Panoramica

L'Editor Traduzioni di GameStringer è un workspace collaborativo avanzato per la gestione, revisione e traduzione dei file di localizzazione dei videogiochi. Offre un'interfaccia intuitiva simile a DeepL con funzionalità specifiche per il gaming.

## Funzionalità Principali

### 1. **Editor Side-by-Side**
- Visualizzazione affiancata del testo originale e della traduzione
- Modifica in tempo reale con salvataggio automatico
- Indicatori di stato per ogni traduzione (pending, completed, reviewed, edited)
- Supporto per contesto e note aggiuntive

### 2. **Suggerimenti AI**
- Generazione automatica di suggerimenti di traduzione
- Multiple varianti per ogni testo
- Indicatore di confidenza per ogni suggerimento
- Applicazione one-click dei suggerimenti

### 3. **Importazione/Esportazione**
- **Formati supportati:**
  - JSON (formato nativo)
  - CSV (compatibile con Excel/Google Sheets)
  - PO (gettext per strumenti di traduzione standard)
- Importazione batch di traduzioni esistenti
- Esportazione filtrata per stato o gioco

### 4. **Ricerca e Filtri**
- Ricerca full-text in originale e traduzione
- Filtri per:
  - Stato (pending, completed, reviewed, edited)
  - Gioco
  - Lingua di destinazione
  - Modifiche manuali
  - Presenza di contesto
  - Livello di confidenza

### 5. **Editor Batch**
- Selezione multipla di traduzioni
- Copia/incolla bulk per workflow esterni
- Generazione suggerimenti AI in batch
- Salvataggio simultaneo di multiple traduzioni

### 6. **Dashboard Statistiche**
- Panoramica del progresso generale
- Statistiche per gioco e lingua
- Tracking delle modifiche manuali
- Metriche di completamento

## Workflow Consigliato

### Per Nuovi Progetti

1. **Scansione Gioco**
   - Vai alla pagina Library
   - Scansiona il gioco per estrarre i file di localizzazione
   - I testi vengono automaticamente importati nell'editor

2. **Traduzione Iniziale**
   - Usa l'editor batch per traduzioni rapide
   - Genera suggerimenti AI per accelerare il processo
   - Applica i suggerimenti più appropriati

3. **Revisione e Raffinamento**
   - Usa l'editor singolo per revisioni dettagliate
   - Aggiungi contesto dove necessario
   - Marca come "reviewed" le traduzioni verificate

4. **Esportazione**
   - Esporta in formato appropriato per il gioco
   - Crea patch per la distribuzione

### Per Progetti Esistenti

1. **Importazione**
   - Prepara file CSV o JSON con traduzioni esistenti
   - Usa il dialog di importazione per caricare in batch
   - Il sistema rileva automaticamente duplicati

2. **Aggiornamento**
   - Filtra per traduzioni "pending" o incomplete
   - Completa le traduzioni mancanti
   - Revisiona quelle esistenti

## Formato File

### JSON
```json
{
  "translations": [
    {
      "filePath": "localization/text_en.csv",
      "originalText": "Welcome to the game",
      "translatedText": "Benvenuto nel gioco",
      "targetLanguage": "it",
      "sourceLanguage": "en",
      "context": "Main menu greeting"
    }
  ]
}
```

### CSV
```csv
File Path,Original Text,Translated Text,Target Language,Status,Context
localization/text_en.csv,"Welcome to the game","Benvenuto nel gioco",it,completed,"Main menu greeting"
```

## API Endpoints

### Traduzioni
- `GET /api/translations` - Lista traduzioni con filtri
- `POST /api/translations` - Crea nuova traduzione
- `PUT /api/translations` - Aggiorna traduzione esistente
- `DELETE /api/translations?id={id}` - Elimina traduzione

### Suggerimenti
- `POST /api/translations/suggestions` - Genera suggerimenti AI
- `DELETE /api/translations/suggestions?translationId={id}` - Elimina suggerimenti

### Import/Export
- `POST /api/translations/import` - Importa traduzioni in batch
- `GET /api/translations/export?gameId={id}&format={format}` - Esporta traduzioni

## Modello Database

```prisma
model Translation {
  id              String   @id @default(cuid())
  gameId          String
  filePath        String
  originalText    String
  translatedText  String   @default("")
  targetLanguage  String
  sourceLanguage  String   @default("en")
  status          String   @default("pending")
  confidence      Float    @default(0)
  isManualEdit    Boolean  @default(false)
  context         String?
  
  game            Game     @relation(...)
  suggestions     AISuggestion[]
}

model AISuggestion {
  id             String      @id @default(cuid())
  translationId  String
  suggestion     String
  confidence     Float       @default(0)
  provider       String      @default("openai")
  
  translation    Translation @relation(...)
}
```

## Integrazione AI

L'editor supporta l'integrazione con vari servizi AI per la generazione di suggerimenti:

- **OpenAI GPT** - Per traduzioni contestuali avanzate
- **DeepL API** - Per traduzioni di alta qualità
- **Google Translate** - Per traduzioni rapide
- **Custom Models** - Supporto per modelli personalizzati

## Best Practices

1. **Usa il Contesto**: Aggiungi sempre contesto quando possibile per migliorare la qualità
2. **Revisiona i Suggerimenti**: Non accettare ciecamente i suggerimenti AI
3. **Mantieni Consistenza**: Usa la ricerca per verificare traduzioni simili
4. **Esporta Regolarmente**: Fai backup frequenti del tuo lavoro
5. **Collabora**: Usa gli stati per coordinare il lavoro in team

## Troubleshooting

### Problemi Comuni

1. **Importazione fallita**
   - Verifica il formato del file
   - Assicurati che il gameId esista
   - Controlla la codifica (UTF-8 richiesta)

2. **Suggerimenti non generati**
   - Verifica la connessione API
   - Controlla i limiti di rate
   - Assicurati che il testo originale sia presente

3. **Esportazione vuota**
   - Seleziona un gioco specifico
   - Verifica i filtri applicati
   - Controlla i permessi del browser

## Roadmap Futura

- [ ] Supporto per più lingue simultanee
- [ ] Memoria di traduzione (TM)
- [ ] Glossari personalizzati
- [ ] Collaborazione real-time
- [ ] Versioning delle traduzioni
- [ ] Integrazione con CAT tools
- [ ] Preview in-game delle traduzioni