# 📋 CHANGELOG - GameStringer

Tutte le modifiche importanti a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-07-01

### 🎯 Milestone Raggiunta
- **POC Injekt-Translator Completato** - Il primo proof of concept del sistema di traduzione in tempo reale è stato completato con successo
  - Sistema di rilevamento processi di gioco funzionante
  - Simulazione di iniezione e traduzione in tempo reale
  - UI reattiva con traduzioni che appaiono ogni 3 secondi
  - Gestione start/stop dell'iniezione
  - Accessibile su `/injekt-poc` per test e demo

### 🚀 Aggiunto
- **Tauri v2 Integration** - Migrazione completa da Tauri v1.5 a v2.0
  - Nuovo formato di configurazione `tauri.conf.json`
  - Supporto hot reload per sviluppo rapido
  - Build system ottimizzato
  - Compatibilità con le ultime API Tauri

- **Strategia RAI PAL** - Nuovo sistema di rilevamento giochi
  - Rileva tutti i 1345 giochi posseduti dall'utente
  - Lettura diretta di `packageinfo.vdf` di Steam
  - Limite aumentato da 100 a 10.000 giochi
  - Sistema di logging con emoji e progress tracking
  - Cache efficiente per prestazioni ottimali

- **Editor Impostazioni Completo** - Nuova pagina settings con tutte le sezioni
  - Gestione API keys (OpenAI, Anthropic, Google, ecc.)
  - Configurazione modelli AI
  - Impostazioni directory di gioco
  - Opzioni avanzate
  - Gestione notifiche
  - Informazioni account

- **Traduzione Inline** - Editor integrato nella pagina dettaglio
  - Apertura diretta senza passare dalla ricerca
  - Editor di traduzione reale (non mockup)
  - Configurazione API AI integrata
  - Selezione file e lingua
  - Preview e salvataggio traduzioni

- **Dashboard Interattiva** - Rimossi tutti i mockup
  - Statistiche reali sui giochi
  - Grafici interattivi
  - Informazioni di sistema aggiornate
  - Collegamenti rapidi funzionanti

### 🔧 Modificato
- **Menu Laterale Aggiornato**
  - "Giochi" rinominato in "Libreria"
  - "Tempo Reale" rinominato in "Injekt-Translator"
  - "Store" rinominato in "Stores"
  - Rimossa voce "Traduttore AI" (integrato nelle pagine)

- **UI/UX Miglioramenti**
  - Bandiere reali da flagcdn invece di emoji
  - Badge colorati per engine detection
  - Badge VR più visibile sopra la cover
  - GameCard semplificata con solo info essenziali
  - Cover più piccola nel dettaglio per dare spazio alla descrizione

- **Engine Detection Migliorata**
  - Supporto per 11 engine diversi
  - Pattern matching più accurato
  - Rilevamento conservativo per evitare falsi positivi
  - Integrazione con metadati Steam

### 🐛 Corretto
- **Errori TypeScript Risolti**
  - Compatibilità completa con Mantine 8.x
  - Proprietà `compact` deprecata rimossa da tutti i Button
  - Tipi `FilterOptions` estesi con campi mancanti
  - Import non utilizzati rimossi
  - Build pulita senza errori o warning

- **Errori Compilazione Rust**
  - Tutti gli extractors ora compilano correttamente
  - Conversioni di tipo esplicite per sqlx e reqwest
  - Gestione errori serializzabile per frontend
  - Backend HLTB completamente funzionante

- **Problemi UI**
  - DLC mostrati solo nel dettaglio del gioco principale
  - Navigazione corretta per Injekt-Translator (/realtime)
  - Filtri avanzati funzionanti (architettura, status, tags)

### 📚 Documentazione
- README.md aggiornato con tutte le nuove funzionalità
- Aggiunte note su configurazione Tauri v2
- Documentati pattern di import per compatibilità ES/CommonJS
- Aggiunte istruzioni per troubleshooting compilazione

### 🔒 Sicurezza
- Gestione sicura delle API keys nell'editor impostazioni
- Validazione input utente migliorata
- Sanitizzazione path per operazioni file

### 🏗️ Infrastruttura
- Sistema di memoria persistente per contesto AI
- Cache SQLite per dati HLTB
- Logging strutturato con emoji per debug
- Test end-to-end per integrazione desktop

## [0.1.0] - 2025-06-30

### Versione Iniziale
- Integrazione base con Steam
- UI principale con lista giochi
- Sistema di filtri e ricerca
- Pagina dettaglio gioco
- Mock iniziali per traduttore

---

## Note di Sviluppo

### Prossimi Passi
1. Completare l'integrazione reale dell'Injekt-Translator con hook Windows
2. Implementare il sistema di patch management reale
3. Aggiungere supporto per più piattaforme oltre Steam
4. Migliorare l'accuratezza delle traduzioni AI
5. Implementare sistema di backup e ripristino

### Known Issues
- L'eseguibile Tauri v2 potrebbe richiedere tempo per la prima compilazione
- Alcuni giochi potrebbero non mostrare l'engine se Steam non fornisce i metadati
- La traduzione in tempo reale è ancora in fase POC

### Contributi
Per contribuire al progetto, vedere il file CONTRIBUTING.md (da creare).
