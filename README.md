# 🎮 GameStringer

## 🎉 **STATO ATTUALE: SISTEMA COMPLETO E FUNZIONANTE** (12 Luglio 2025)

### ✅ **SISTEMA MULTI-STORE COMPLETATO CON SUCCESSO!**
- **🚀 Backend Rust**: 127+ comandi Tauri implementati e compilati senza errori
- **🎨 UI Completa**: Dashboard moderna con Store Manager unificato per 8 piattaforme
- **🖥️ Desktop App**: Applicazione Tauri stabile e completamente funzionale
- **🔗 Integrazione Totale**: Frontend-Backend comunicazione perfettamente ottimizzata
- **📱 Finestra Responsiva**: Applicazione desktop moderna con UI responsive
- **⚙️ Configurazione Ottimizzata**: Sistema di sviluppo e produzione completamente configurato
- **🔐 Autenticazione Multi-Store**: 8 store gaming integrati con credenziali criptate AES-256

### 🏪 **STORE MANAGER COMPLETO - 8 PIATTAFORME INTEGRATE**
- **✅ Steam**: Auto-connessione, API completa, Family Sharing, 350+ giochi
- **✅ Epic Games**: Legendary CLI, credenziali criptate, auto-detection
- **✅ GOG Galaxy**: API pubblica, scansione locale, credenziali AES-256
- **✅ Origin/EA App**: Registro Windows, credenziali criptate, game detection
- **✅ Battle.net**: Giochi Blizzard, credenziali AES-256, BattleTag support
- **✅ Ubisoft Connect**: Lista completa eseguibili, credenziali criptate
- **✅ itch.io**: API integration, credenziali criptate, indie games
- **✅ Rockstar Games**: Social Club, credenziali criptate, GTA/RDR support

**GameStringer è un sistema completo per gestione multi-store gaming!** 🚀

---

### ✨ Implementazioni Recenti e Completamenti (Luglio 2025)

#### 🏪 Store Manager Multi-Piattaforma Completato (12 Luglio 2025)
- **🎯 Integrazione Completa**: Tutti gli 8 store gaming principali implementati e funzionanti
- **🔐 Sistema Credenziali Unificato**: AES-256-GCM encryption per tutte le piattaforme con chiavi specifiche per macchina
- **📚 Libreria Unificata**: Comando `scan_games()` ora include tutti gli store, non solo Steam
- **🎮 Scansione Multi-Store**: Epic, GOG, Origin, Battle.net, Ubisoft, itch.io, Rockstar integrati
- **💾 Salvataggio Automatico**: Credenziali salvate automaticamente all'autenticazione per tutti gli store
- **🔄 Auto-Caricamento**: Credenziali ricaricate automaticamente all'avvio dell'applicazione
- **🎨 UI Store Manager**: Interfaccia unificata per gestione connessioni, disconnessioni, e stato store
- **📁 File Implementati**: 8 moduli Rust completi, UI React responsive, sistema di credenziali sicuro

#### 🔧 Sistema Status Sidebar Migliorato (12 Luglio 2025)
- **🚀 Steam API Status**: Ora testa realmente la connessione Steam API (LIVE/ERR/OFF)
- **🧠 Neural Engine**: Status real-time del motore di traduzione
- **💾 Cache Monitor**: Calcolo percentuale reale dell'uso localStorage con colori dinamici
- **⚡ Real-time Updates**: Aggiornamento automatico ogni 10 secondi via Tauri commands

#### 🏗️ Build e Integrazione Tauri Stabilizzate (4 Luglio 2025)
- **Problemi Build Risolti**: Corretti errori di compilazione Rust (dipendenze mancanti, ownership, sintassi)
- **Eseguibile Release**: Generato `gamestringer.exe` (14.5MB) completamente funzionante
- **Configurazione Tauri**: Ottimizzata per servire file statici senza errori di connessione
- **Finestra Applicazione**: Verificata apertura e responsività della finestra "GameStringer"
- **Integrazione Stabile**: Frontend-Backend comunicano correttamente via comandi Tauri
- **Architettura Desktop**: Applicazione standalone moderna (Rust + Tauri) operativa
- **Risolto Errore 127.0.0.1**: Problema finestra vuota risolto usando build release invece di debug

#### 🔧 Errore TypeScript 'long' Risolto (2 Luglio 2025)
- **Conflitto Definizioni Tipo**: Risolto conflitto tra `@types/long` e `@xtuc/long`
- **Dipendenza Ridondante**: Rimosso `@types/long` che causava errore di compilazione
- **Webpack Compatibility**: `@xtuc/long` (dipendenza di webpack) fornisce già tutte le definizioni necessarie
- **Build Pulita**: TypeScript compilation ora funziona senza errori
- **Documentazione Aggiornata**: Aggiunta sezione in TROUBLESHOOTING.md per riferimento futuro

#### 🔐 Supporto 2FA per GOG Implementato (2 Luglio 2025)
- **Autenticazione a Due Fattori**: Supporto completo per il login GOG con codice 2FA
- **UI Moderna a Due Step**: Flusso intuitivo che guida l'utente attraverso email/password e poi codice 2FA
- **Alert Informativi**: Avvisi chiari che spiegano i requisiti di autenticazione GOG
- **Campo Codice Dedicato**: Input formattato per codici a 6 cifre con stile monospace
- **Gestione Errori Intelligente**: Messaggi specifici per problemi di autenticazione 2FA

#### 🎯 Milestone Raggiunta: POC Injekt-Translator Completato (1 Luglio 2025)
- **Proof of Concept Funzionante**: Sistema di traduzione in tempo reale completamente simulato
- **Rilevamento Processi**: Identificazione automatica dei giochi in esecuzione
- **Traduzione Live**: Traduzioni che appaiono in tempo reale ogni 3 secondi
- **UI Reattiva**: Interfaccia che mostra lo stato dell'iniezione e le traduzioni
- **Accessibile su `/injekt-poc`**: Demo funzionante del sistema anche senza Tauri completamente integrato

#### 🚀 Aggiornamento a Tauri v2
- **Migrazione Completata**: Il progetto è stato aggiornato con successo da Tauri v1.5 a Tauri v2.0
- **Configurazione Modernizzata**: Nuovo formato di configurazione `tauri.conf.json` compatibile con v2
- **Dipendenze Aggiornate**: Tutte le dipendenze Rust e npm sono state allineate a Tauri v2
- **Build System Ottimizzato**: Processo di compilazione più veloce e affidabile
- **Hot Reload Funzionante**: Modalità watch per sviluppo rapido

#### 🎮 Strategia RAI PAL Implementata
- **1345 Giochi Rilevati**: Sistema ora rileva tutti i giochi posseduti su Steam
- **Lettura packageinfo.vdf**: Parsing corretto del file Steam per giochi posseduti
- **Limite Aumentato**: Da 100 a 10.000 giochi supportati
- **Logging Dettagliato**: Progress tracking con emoji per debug facilitato
- **Cache Efficiente**: Sistema di caching per prestazioni ottimali

#### 🛠️ Risoluzione Completa Errori TypeScript
- **Mantine 8.x**: Aggiornamento completo all'API più recente
- **FilterPanel**: Rimossa proprietà `compact` deprecata
- **Tipi Estesi**: Aggiunti campi mancanti a `FilterOptions`
- **Build Pulita**: Zero errori TypeScript, build completamente funzionante

#### 🎨 UI/UX Miglioramenti Maggiori
- **Dashboard Interattiva**: Rimossi tutti i mock-up, dati reali visualizzati
- **Editor Impostazioni Completo**: Tutte le sezioni implementate (API keys, AI, directory, notifiche)
- **Traduzione Inline**: Editor di traduzione integrato direttamente nella pagina dettaglio
- **Configurazione API AI**: Scelta provider, modelli e chiavi direttamente dall'interfaccia
- **Bandiere Reali**: Uso di flagcdn per bandiere nazionali accurate
- **Badge Colorati**: Engine detection con badge visivi distintivi

#### 🔧 Backend e Extractors
- **Tutti gli Extractors Compilano**: Epic, GOG, Itch, Origin, Heroic, Ubisoft, Battle.net
- **Engine Detection Migliorata**: 11 engine supportati con pattern avanzati
- **HLTB Backend Funzionante**: Sistema cache SQLite operativo
- **Gestione Errori Robusta**: Conversioni e serializzazione corrette

### ✨ Correzioni Recenti e Miglioramenti (Giugno 2025)

Questa versione include importanti correzioni di bug e miglioramenti alla stabilità e all'esperienza utente:

- **Risolto: Problemi di Arricchimento Dati Steam (VR, Motore, HLTB)**
  - **Diagnosi:** Identificato che un'API esterna (`xpaw.me`) non era più affidabile, causando il fallimento silenzioso del recupero dei dati.
  - **Soluzione:** Sostituita l'API esterna con l'endpoint ufficiale di Steam (`appdetails`) per garantire un recupero dati stabile e accurato.
  - **Debug:** Risolto un problema di cache del server di sviluppo Next.js che impediva l'applicazione delle correzioni, forzando una pulizia completa della cache (`.next`).

- **Risolto: Lista Giochi Vuota nel Traduttore AI**
  - Corretto un disallineamento critico tra i dati del backend (`appId`) e quelli attesi dal frontend (`id`).
  - Ora la lista dei giochi installati viene caricata e visualizzata correttamente.

- **Risolto: Errore Caricamento Immagini di Copertina**
  - Configurato `next.config.js` per autorizzare il dominio delle immagini di Steam (`steamcdn-a.akamaihd.net`).
  - Le copertine dei giochi ora vengono visualizzate senza errori.

- **Risolto: Errori 500 e Warning nel Selettore Giochi**
  - Aggiunto un filtro per prevenire chiamate API con ID non validi, eliminando crash del backend.
  - Aggiunta una `key` univoca agli elementi della lista per risolvere i warning di React e migliorare le performance.

- **Stabilizzazione Generale del Backend**
  - Verificato e confermato il corretto funzionamento della pipeline di scansione dei giochi, dalla lettura del registro di Windows fino alla restituzione dei dati via API.

---

GameStringer è un'applicazione avanzata per la traduzione di videogiochi che sfrutta l'intelligenza artificiale per aiutare gli utenti a tradurre i loro giochi preferiti. L'applicazione si integra con Steam per recuperare la libreria di giochi dell'utente e fornisce un'interfaccia intuitiva per estrarre, tradurre e creare patch di lingua.

## ✨ Funzionalità Principali

- **Integrazione con Steam**: Sincronizza la tua libreria di Steam per un accesso facile e veloce ai tuoi giochi.
- **Traduzione AI**: Utilizza potenti API di traduzione AI (OpenAI, Abacus.AI) per traduzioni rapide e accurate.
- **Estrazione di Stringhe**: Analizza automaticamente i file di gioco per estrarre il testo da tradurre.
- **Supporto File Avanzato**: Gestisce una varietà di formati, inclusi file di testo semplici, file `.ini` strutturati e file `.csv` multilingua complessi.
- **Selezione Lingua per File Multilingua**: Per i giochi con file che contengono più lingue (es. *Decarnation*), l'interfaccia permette di selezionare la lingua specifica da visualizzare e tradurre.
- **Gestione Casi Limite**: Fornisce un'esperienza utente chiara anche per i giochi che non contengono file di testo traducibili (es. solo eseguibili), mostrando messaggi informativi e opzioni appropriate.
- **Creazione di Patch**: Genera file di patch che possono essere facilmente applicati al gioco per visualizzare le traduzioni.
- **Ricerca Intuitiva**: La ricerca nella libreria dà priorità ai giochi il cui titolo inizia con il testo cercato, rendendo più facile trovare ciò che cerchi.
- **Visualizzazione Lingue Supportate**: Mostra le lingue ufficialmente supportate da un gioco direttamente nella libreria tramite icone a bandiera, per una rapida consultazione.
- **Interfaccia Moderna**: Un'interfaccia utente pulita e reattiva costruita con Next.js e shadcn/ui.

**Un'applicazione completa per la traduzione automatica di videogiochi ispirata alle tecnologie RAI-PAL VR**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2.28-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![Rust](https://img.shields.io/badge/Rust-1.70+-orange)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Prisma](https://img.shields.io/badge/Prisma-6.7.0-2D3748)

## 📋 Indice

- [Descrizione del Progetto](#-descrizione-del-progetto)
- [Caratteristiche Principali](#-caratteristiche-principali)
- [Tecnologie Utilizzate](#-tecnologie-utilizzate)
- [Prerequisiti](#-prerequisiti)
- [Installazione](#-installazione)
- [Configurazione](#-configurazione)
- [Guida all'Uso](#-guida-alluso)
- [Struttura del Progetto](#-struttura-del-progetto)
- [API Reference](#-api-reference)
- [Screenshots](#-screenshots)
- [Contribuire](#-contribuire)
- [Licenza](#-licenza)
- [Crediti](#-crediti)
- [Stato di Avanzamento](#-stato-di-avanzamento)

## 🎯 Descrizione del Progetto

GameStringer è una soluzione completa e moderna per la traduzione automatica di videogiochi, sviluppata con tecnologie all'avanguardia ispirate al progetto RAI-PAL VR. L'applicazione permette di:

- **Scansionare automaticamente** la libreria di giochi installati
- **Tradurre in tempo reale** i testi dei giochi utilizzando AI avanzata
- **Creare patch personalizzate** per applicare le traduzioni
- **Gestire backup automatici** per proteggere i file originali
- **Sincronizzare** con i principali store digitali (Steam, Epic Games, GOG)

L'app è progettata per essere user-friendly e accessibile sia a utenti esperti che principianti, offrendo un'interfaccia moderna e intuitiva costruita con Next.js 14 e componenti UI di alta qualità.

## ✨ Caratteristiche Principali

### 🔍 **Scansione Intelligente**
- Rilevamento automatico dei giochi installati da Steam, Epic Games, GOG, EA e altri store
- Identificazione dei file di testo traducibili
- Supporto per multiple directory di installazione
- Filtri avanzati per escludere file non necessari

### 🤖 **Traduzione AI Avanzata**
- Integrazione con modelli LLM di ultima generazione (GPT-4o-mini)
- Traduzione contestuale che mantiene il significato originale
- Supporto per oltre 50 lingue
- Sistema di confidence scoring per valutare la qualità delle traduzioni
- Suggerimenti alternativi per ogni traduzione

### ⚡ **Modalità Tempo Reale**
- Traduzione live durante il gameplay
- Overlay non invasivo per visualizzare le traduzioni
- Hotkey personalizzabili per controllo rapido
- Cache intelligente per prestazioni ottimali

### 📝 **Editor Integrato**
- Interfaccia WYSIWYG per modificare le traduzioni
- Anteprima in tempo reale delle modifiche
- Sistema di versioning per tracciare le modifiche
- Collaborazione multi-utente (pianificata)

### 🔧 **Gestione Patch**
- Creazione automatica di patch di traduzione
- Supporto per diversi tipi di patch (sostituzione, iniezione, ibrida)
- Sistema di versioning delle patch
- Distribuzione e condivisione delle patch

### 💾 **Backup e Sicurezza**
- Backup automatici prima di ogni modifica
- Ripristino con un click dei file originali
- Crittografia dei backup sensibili
- Pulizia automatica dei backup obsoleti

### ✨ **Funzionalità Implementate**

#### **Libreria Giochi Avanzata (`/games`)**
- **Visualizzazione Unificata**: Mostra tutti i giochi da diverse piattaforme (Steam, locali) in un'unica interfaccia.
- **Copertine Intelligenti**: Sistema di fallback automatico (Steam → SteamGridDB → placeholder) per garantire che ogni gioco abbia sempre un'immagine di copertina, eliminando errori 404.
- **Dati Arricchiti**: Recupero di informazioni dettagliate da Steam, inclusi generi, categorie e supporto VR.
- **Filtri Potenti**: Filtra la libreria per stato di installazione (installati/non installati) e supporto VR.
- **Ordinamento Flessibile**: Ordina i giochi per nome, data di aggiunta o tempo di gioco.
- **Badge Informativi**: Etichette visive immediate per identificare giochi installati e compatibili con VR.

### 🏪 **Integrazione Store**
- **Sincronizzazione con Steam**: Connessione sicura via NextAuth e OpenID per recuperare la lista completa dei giochi posseduti, il tempo di gioco e lo stato di installazione.
- **Logica di Arricchimento Robusta**: Utilizzo di API alternative (steamapi.xpaw.me) e una logica di fallback per garantire che i dati dei giochi vengano sempre visualizzati, anche in caso di instabilità delle API di Steam.
- **Rilevamento Giochi Installati**: Scansione del registro di Windows e dei file di configurazione di Steam (`.acf`) per un rilevamento preciso dei giochi installati, superando i limiti delle API pubbliche.
- **Correzione Cache**: Implementata la possibilità di forzare l'aggiornamento della cache per visualizzare immediatamente le modifiche.
- **(Sospeso)**: L'integrazione con **itch.io** è stata temporaneamente sospesa a causa di incompatibilità e restrizioni non documentate della loro API OAuth che impediscono un'autenticazione server-side affidabile.
- **(In Sviluppo)**: Supporto per Epic Games, GOG e altri launcher.

#### **Traduttore AI (`/translator`)**
- **Interfaccia Semplificata**: La UI è stata ridisegnata per essere più pulita e veloce, mostrando una lista di giochi testuale senza locandine, per eliminare tempi di caricamento e problemi con API esterne.
- **Flusso di Lavoro Completo**: Supporta l'intero processo: selezione del gioco, ricerca del percorso di installazione (automatica o manuale), scansione dei file di testo (.json, .xml, .txt), e interfaccia di traduzione multi-provider (OpenAI, DeepL, Google Translate).
- **Calcolo Costi in Tempo Reale**: Fornisce una stima dei costi di traduzione prima di avviare il processo.

## 🚀 Idee per il Futuro

-   **Integrazione con Database di Giochi (via APIWeaver)**: Utilizzare il server MCP [APIWeaver](https://github.com/GongRzhe/APIWeaver) per integrare dinamicamente API come IGDB. Questo ci permetterebbe di arricchire automaticamente i dati dei giochi con copertine, descrizioni, generi e screenshot, migliorando notevolmente l'interfaccia utente.
-   **Espansione dei Provider di Traduzione (via Any Chat Completions)**: Sfruttare il server MCP [Any Chat Completions](https://github.com/pyroprompts/any-chat-completions-mcp) per aggiungere facilmente il supporto a nuovi servizi di traduzione AI (es. Perplexity, Groq), offrendo agli utenti maggiore flessibilità e scelta.

## 🛠 Tecnologie Utilizzate

### **Frontend**
- **Next.js 14.2.28** - Framework React con App Router
- **TypeScript 5.2.2** - Tipizzazione statica
- **Tailwind CSS 3.3.3** - Framework CSS utility-first
- **Framer Motion 10.18.0** - Animazioni fluide
- **Radix UI** - Componenti accessibili e personalizzabili
- **React Hook Form 7.53.0** - Gestione form avanzata
- **Zustand 5.0.3** - State management leggero

### **Backend & Database**
- **PostgreSQL** - Database relazionale principale
- **Prisma 6.7.0** - ORM type-safe
- **Next.js API Routes** - Endpoint API serverless

### **AI & Machine Learning**
- **Integrazione LLM** - GPT-4o-mini per traduzioni
- **TanStack Query 5.0.0** - Cache e sincronizzazione dati
- **Confidence Scoring** - Algoritmi di valutazione qualità

### **UI/UX**
- **Lucide React** - Icone moderne e consistenti
- **React Hot Toast** - Notifiche eleganti
- **Chart.js & Recharts** - Visualizzazione dati
- **React Plotly.js** - Grafici interattivi avanzati

### **Sviluppo & Build**
- **ESLint 9.24.0** - Linting del codice
- **Prettier** - Formattazione automatica
- **Webpack 5.99.5** - Bundling ottimizzato

## 📋 Prerequisiti

Prima di iniziare, assicurati di avere installato:

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 o **yarn** >= 1.22.0
- **PostgreSQL** >= 13.0
- **Git** per il version control

### Requisiti di Sistema
- **RAM**: Minimo 4GB, consigliato 8GB+
- **Spazio Disco**: Almeno 2GB liberi
- **OS**: Windows 10+, macOS 10.15+, Linux Ubuntu 20.04+

## 🚀 Installazione

### 1. Clona il Repository

```bash
git clone https://github.com/tuousername/GameStringer.git
cd GameStringer
```

### 2. Installa le Dipendenze

```bash
# Con npm
npm install

# Con yarn
yarn install
```

### 3. Configura il Database

```bash
# Crea il database PostgreSQL
createdb game_translator

# Genera il client Prisma
npx prisma generate

# Esegui le migrazioni
npx prisma db push

# (Opzionale) Popola con dati di esempio
npx prisma db seed
```

## ⚙️ Configurazione

### 1. Variabili d'Ambiente

Crea un file `.env.local` nella directory `app/`:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/game_translator"

# AI Configuration
OPENAI_API_KEY="your-openai-api-key"
AI_PROVIDER="gpt-4o-mini"

# Store APIs (Opzionali)
STEAM_API_KEY="your-steam-api-key"
EPIC_CLIENT_ID="your-epic-client-id"
EPIC_CLIENT_SECRET="your-epic-client-secret"

# Security
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# App Configuration
DEFAULT_LANGUAGE="it"
MAX_FILE_SIZE="10485760"
BACKUP_RETENTION_DAYS="30"
```

### 2. Configurazione Database

```bash
# Verifica la connessione
npx prisma studio
```

### 3. Configurazione AI

L'app supporta diversi provider AI. Configura il tuo provider preferito nel file `.env.local`:

- **OpenAI GPT-4o-mini** (Consigliato)
- **Anthropic Claude**
- **Google Gemini**
- **Provider locali** (Ollama, etc.)

## 📖 Guida all'Uso

### 🎮 **1. Scansione Giochi**

1. Avvia l'applicazione: `npm run dev`
2. Vai alla **Dashboard** principale
3. Clicca su **"Scansiona Giochi"**
4. L'app rileverà automaticamente i giochi installati
5. Visualizza i risultati nella sezione **"Giochi"**

### 🌐 **2. Traduzione di un Gioco**

1. Seleziona un gioco dalla lista
2. Clicca su **"Traduci"**
3. Scegli la lingua di destinazione
4. Configura le opzioni di traduzione:
   - Modalità (Automatica/Manuale)
   - Confidence threshold
   - File da includere/escludere
5. Avvia il processo di traduzione
6. Monitora il progresso in tempo reale

### ✏️ **3. Modifica Traduzioni**

1. Accedi all'**Editor Integrato**
2. Seleziona il gioco e il file da modificare
3. Modifica le traduzioni direttamente nell'interfaccia
4. Utilizza i suggerimenti AI per migliorare le traduzioni
5. Salva le modifiche

### 🔧 **4. Creazione Patch**

1. Vai alla sezione **"Patch"**
2. Seleziona il gioco tradotto
3. Configura le opzioni della patch:
   - Nome e versione
   - Tipo di patch (Sostituzione/Iniezione)
   - File da includere
4. Genera la patch
5. Testa la patch prima della distribuzione

### ⚡ **5. Modalità Tempo Reale**

1. Attiva la **"Modalità Tempo Reale"**
2. Configura l'overlay:
   - Posizione sullo schermo
   - Trasparenza
   - Hotkey di controllo
3. Avvia il gioco
4. Le traduzioni appariranno automaticamente

### 💾 **6. Gestione Backup**

- I backup vengono creati automaticamente
- Accedi alla sezione **"Backup"** per gestirli
- Ripristina i file originali con un click
- Configura la retention policy

## 📁 Struttura del Progetto

```
GameStringer/
├── app/                          # Applicazione Next.js principale
│   ├── app/                      # App Router di Next.js 14
│   │   ├── api/                  # API Routes
│   │   │   └── translate/        # Endpoint traduzione
│   │   ├── editor/               # Editor traduzioni
│   │   ├── games/                # Gestione giochi
│   │   │   └── [id]/            # Dettaglio gioco dinamico
│   │   ├── patches/              # Gestione patch
│   │   ├── realtime/             # Modalità tempo reale
│   │   ├── settings/             # Configurazioni
│   │   ├── stores/               # Integrazione store
│   │   ├── translator/           # Interfaccia traduzione
│   │   ├── globals.css           # Stili globali
│   │   ├── layout.tsx            # Layout principale
│   │   └── page.tsx              # Dashboard homepage
│   ├── components/               # Componenti React
│   │   ├── layout/               # Componenti layout
│   │   │   └── main-layout.tsx   # Layout principale
│   │   ├── ui/                   # Componenti UI (Radix + Tailwind)
│   │   │   ├── button.tsx        # Componente Button
│   │   │   ├── card.tsx          # Componente Card
│   │   │   ├── dialog.tsx        # Componente Dialog
│   │   │   └── ...               # Altri componenti UI
│   │   └── theme-provider.tsx    # Provider tema scuro/chiaro
│   ├── hooks/                    # Custom React Hooks
│   │   └── use-toast.ts          # Hook per notifiche
│   ├── lib/                      # Utilities e configurazioni
│   │   ├── db/                   # Configurazione database
│   │   ├── db.ts                 # Client Prisma
│   │   ├── mock-data.ts          # Dati di esempio
│   │   ├── types.ts              # Definizioni TypeScript
│   │   └── utils.ts              # Utility functions
│   ├── prisma/                   # Schema e migrazioni database
│   │   └── schema.prisma         # Schema Prisma
│   ├── package.json              # Dipendenze e scripts
│   ├── next.config.js            # Configurazione Next.js
│   ├── tailwind.config.ts        # Configurazione Tailwind
│   ├── tsconfig.json             # Configurazione TypeScript
│   └── components.json           # Configurazione componenti UI
├── .deploy/                      # File di deployment
├── .logs/                        # Log applicazione
└── README.md                     # Questo file
```

### **Componenti Chiave**

- **`app/page.tsx`**: Dashboard principale con statistiche e controlli
- **`prisma/schema.prisma`**: Schema database con modelli per giochi, traduzioni, patch, backup
- **`components/ui/`**: Libreria completa di componenti UI riutilizzabili
- **`lib/db.ts`**: Client Prisma per interazioni database
- **`app/api/translate/`**: API per servizi di traduzione AI

## 🔌 API Reference

### **Endpoint Principali**

#### `POST /api/translate`
Traduce un testo utilizzando AI

```typescript
interface TranslateRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: string;
}

interface TranslateResponse {
  translatedText: string;
  confidence: number;
  alternatives: string[];
}
```

#### `GET /api/games`
Recupera la lista dei giochi

```typescript
interface Game {
  id: string;
  title: string;
  platform: string;
  isInstalled: boolean;
  translationsCount: number;
}
```

#### `POST /api/games/scan`
Avvia la scansione dei giochi

```typescript
interface ScanResponse {
  gamesFound: number;
  newGames: Game[];
  scanDuration: number;
}
```

## Stato di Avanzamento

### Stato Attuale (29 Giugno 2025)

Lo sviluppo è attualmente concentrato sul modulo **Traduttore AI**.

-   **✅ Completato**:
    -   Refactoring dell'interfaccia utente per un flusso a passi (Selezione Gioco → Selezione Cartella → Traduzione).
    -   Sostituzione della griglia giochi con un combobox ricercabile.
    -   Implementazione della logica API per recuperare la lista completa dei giochi dell'utente da Steam.

-   **🔴 Blocker Critico**:
    -   L'applicazione è attualmente bloccata da un errore `TypeError: Steam is not a constructor` che si verifica nell'endpoint API `/api/library/games`. Questo errore impedisce di filtrare e mostrare solo i giochi installati, rendendo il Traduttore AI inutilizzabile.
    -   **Causa**: Conflitto di interoperabilità tra la libreria `steam-locate` (CommonJS) e l'ambiente server di Next.js (ES Modules).
    -   **Prossimi Passi**: La risoluzione di questo blocker è la priorità assoluta. L'attività corrente è una ricerca approfondita per trovare il pattern di importazione corretto e stabile per questo tipo di dipendenza.

## 📸 Screenshots

### Dashboard Principale
![Dashboard](screenshots/dashboard.png)
*Panoramica completa con statistiche in tempo reale e attività recenti*

### Gestione Giochi
![Games Management](screenshots/games.png)
*Interfaccia per la gestione della libreria giochi con filtri avanzati*

### Editor Traduzioni
![Translation Editor](screenshots/editor.png)
*Editor WYSIWYG per modificare e perfezionare le traduzioni*

### Modalità Tempo Reale
![Real-time Mode](screenshots/realtime.png)
*Overlay non invasivo per traduzioni durante il gameplay*

## 📈 Stato di Avanzamento

### **Fase 1: Integrazione Steam (Completata)**
- **[✅] Connessione e Autenticazione**: Implementato con successo il login tramite Steam (OpenID) e NextAuth, con salvataggio sicuro delle credenziali nel database.
- **[✅] Importazione Libreria Giochi**: Sviluppata una logica di importazione robusta che recupera tutti i giochi posseduti dall'utente. Risolti bug critici che impedivano l'importazione di alcuni titoli (es. Dead Space) a causa di API instabili, implementando una logica di arricchimento con fallback.
- **[✅] Rilevamento Giochi Installati**: Creata una soluzione ibrida che combina la lettura del registro di Windows e il parsing dei file di configurazione di Steam (`.acf`) per determinare con precisione quali giochi sono installati, superando i limiti delle API ufficiali.
- **[✅] UI e UX**: La libreria giochi ora mostra correttamente lo stato "Installato" e tutti i dati vengono sincronizzati tra backend e frontend, risolvendo problemi di cache.

### **Fase 2: Integrazione Itch.io (Sospesa)**
- **[⚠️] Problema Bloccante**: Dopo un'analisi approfondita e numerosi tentativi, si è concluso che l'API OAuth di itch.io non è compatibile con un flusso di autenticazione server-side standard (richiesto da NextAuth). Le richieste vengono bloccate o ricevono risposte inattese, rendendo impossibile completare l'integrazione in modo affidabile. L'integrazione è stata sospesa in attesa di chiarimenti o aggiornamenti da parte di itch.io.

### **Prossimi Passi**
- **Integrazione GOG**: Inizio dell'analisi e sviluppo per l'integrazione con GOG.
- **Integrazione Epic Games Store**: A seguire, si procederà con l'integrazione di Epic Games.

### Creazione Patch
![Patch Creation](screenshots/patches.png)
*Interfaccia per creare e gestire patch di traduzione*

## 📔 Diario di Sviluppo

### **26 Giugno 2025: Sessione di Debug Critica e Svolta**

Questa giornata è stata dedicata alla risoluzione di una serie di problemi bloccanti che impedivano l'avvio e il corretto funzionamento dell'applicazione in ambiente di sviluppo.

1.  **Problema Iniziale: `ChunkLoadError` e Crash del Server**
    *   **Sintomo**: L'applicazione non si avviava, restituendo errori `ChunkLoadError` nel browser e crashando il server di sviluppo Next.js.
    *   **Analisi**: L'errore indicava una corruzione nella cache di build (`.next`) o nelle dipendenze (`node_modules`).
    *   **Soluzione**: È stata eseguita una pulizia completa del progetto, rimuovendo le cartelle `.next`, `node_modules` e il file `yarn.lock`, seguita da una reinstallazione pulita con `yarn install`.

2.  **Secondo Problema: Errore `prisma generate`**
    *   **Sintomo**: Durante `yarn install`, il processo si interrompeva con un errore `EPERM: operation not permitted` durante la fase `prisma generate`.
    *   **Analisi**: L'errore `EPERM` su Windows è quasi sempre legato a permessi insufficienti. Il terminale non aveva i privilegi per scrivere/rinominare file nella cartella `node_modules`.
    *   **Soluzione**: Dopo aver corretto una piccola omissione nello schema (`schema.prisma`), il problema è stato risolto definitivamente eseguendo il terminale **come Amministratore**.


## 🤝 Contribuire

Le contribuzioni sono benvenute! 

1. Fork del progetto
2. Crea un feature branch (`git checkout -b feature/NuovaFunzionalità`)
3. Commit delle modifiche (`git commit -m 'Aggiunge nuova funzionalità'`)
4. Push del branch (`git push origin feature/NuovaFunzionalità`)
5. Apri una Pull Request

### Linee Guida
- Segui lo stile di codice esistente
- Aggiungi test quando possibile
- Aggiorna la documentazione
- Usa commit messages descrittivi

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per maggiori informazioni.

```
MIT License

Copyright (c) 2025 Game Translator App

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Crediti

### **Sviluppo**
- **Team di Sviluppo**: Ispirato alle tecnologie RAI-PAL VR
- **UI/UX Design**: Basato su principi di design moderni e accessibili
- **AI Integration**: Utilizzando i migliori modelli LLM disponibili

### **Tecnologie Open Source**
Ringraziamo tutti i maintainer e contributor delle librerie open source utilizzate:

- [Next.js](https://nextjs.org/) - Framework React
- [Prisma](https://prisma.io/) - Database ORM
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [Radix UI](https://radix-ui.com/) - Componenti primitivi
- [Framer Motion](https://framer.com/motion/) - Libreria animazioni
- [Lucide](https://lucide.dev/) - Icone moderne

### **Ispirazione**
- **RAI-PAL VR Technologies**: Per l'ispirazione tecnologica
- **Community Gaming**: Per feedback e suggerimenti
- **Open Source Community**: Per gli strumenti e le librerie

### **Supporto**
- **Beta Testers**: Grazie a tutti i beta tester per il feedback prezioso
- **Translators**: Ringraziamenti speciali ai traduttori della community
- **Contributors**: Tutti coloro che hanno contribuito al progetto

---

## 📞 Supporto

### **Documentazione**
- [Wiki Completa](https://github.com/tuousername/gamestringer-app/wiki)
- [FAQ](https://github.com/tuousername/gamestringer-app/wiki/FAQ)
- [Troubleshooting](https://github.com/tuousername/gamestringer-app/wiki/Troubleshooting)

### **Community**
- [Discord Server](https://discord.gg/gamestringer)
- [Forum Discussioni](https://github.com/tuousername/gamestringer-app/discussions)
- [Reddit Community](https://reddit.com/r/GameTranslator)

### **Contatti**
- **Email**: support@gamestringer-app.com
- **Twitter**: [@GameTranslatorApp](https://twitter.com/GameTranslatorApp)
- **GitHub Issues**: [Segnala un problema](https://github.com/tuousername/gamestringer-app/issues)

## 📄 Dialogue Patcher

Il **Dialogue Patcher** è uno strumento avanzato per tradurre i file di dialoghi dei giochi che memorizzano i testi in file esterni (CSV, TSV, XML, etc.).

### Caratteristiche principali:

- **Parsing automatico** dei file di dialoghi in vari formati
- **Estrazione intelligente** dei testi da tradurre
- **Generazione patch** con traduzioni organizzate
- **Applicazione sicura** delle traduzioni con backup automatico
- **Interfaccia grafica** per gestire e visualizzare le patch

### Giochi supportati:

#### 🎮 Decarnation
- **File dialoghi**: `dialogues-resources.assets-52.txt` (formato TSV)
- **Traduzioni disponibili**: 33 dialoghi principali in italiano
- **Stato**: ✅ Patch completa e testata

### Come usare il Dialogue Patcher:

1. **Accedi alla sezione** "Dialogue Patcher" dal menu principale
2. **Seleziona una patch** disponibile dalla lista
3. **Visualizza le traduzioni** nella scheda "Traduzioni"
4. **Applica la patch** seguendo le istruzioni:
   - **Metodo 1**: Usa l'Injekt-Translator per applicare le traduzioni in tempo reale
   - **Metodo 2**: Modifica direttamente il file di dialoghi del gioco

### Creare nuove patch:

```bash
# Genera una nuova patch per un gioco
npm run patch:create <game-id>

# Esempio per Decarnation
npm run patch:decarnation:create
```

---

<div align="center">

**⭐ Se questo progetto ti è stato utile, considera di dargli una stella su GitHub! ⭐**

[🌟 Star su GitHub](https://github.com/tuousername/gamestringer-app) | [🐛 Segnala Bug](https://github.com/tuousername/gamestringer-app/issues) | [💡 Richiedi Feature](https://github.com/tuousername/gamestringer-app/issues/new?template=feature_request.md)

---

*Realizzato con ❤️ per la community gaming italiana*

</div>
