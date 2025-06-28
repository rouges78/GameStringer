# 🎮 GameStringer

**Un'applicazione completa per la traduzione automatica di videogiochi ispirata alle tecnologie RAI-PAL VR**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2.28-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue)
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

3.  **Problema Finale e Svolta: Errore `401 Unauthorized` sui Giochi Condivisi**
    *   **Sintomo**: Una volta avviata l'app, la lista dei giochi non includeva quelli della Libreria Familiare di Steam. L'utente ha notato che il numero di giochi "cambiava continuamente".
    *   **Analisi**: L'analisi dei log del server ha rivelato il problema esatto. La chiamata all'API della Libreria Familiare falliva con un errore `401 Unauthorized`. Questo significa che il cookie di autenticazione (`steamLoginSecure`) fornito nel file `.env.local` era scaduto, non valido o errato. Il sistema, in modo robusto, procedeva mostrando solo i giochi di proprietà, causando la discrepanza notata dall'utente.
    *   **Soluzione Identificata (Prossimo Passo)**: È necessario ottenere un cookie `steamLoginSecure` aggiornato dal browser (dopo aver effettuato il login su `store.steampowered.com`) e sostituirlo nel file `.env.local`.

**Stato Attuale:** L'applicazione è stabile, robusta e si avvia correttamente. Il problema del recupero dei giochi condivisi è stato identificato con certezza e la soluzione è a portata di mano.

**Azione Richiesta all'Utente:** Aggiornare il cookie `steamLoginSecure` come da istruzioni per sbloccare la funzionalità completa.

## 🤝 Contribuire

Siamo sempre felici di ricevere contributi! Ecco come puoi aiutare:

### **Segnalazione Bug**
1. Controlla se il bug è già stato segnalato negli [Issues](https://github.com/tuousername/GameStringer/issues)
2. Crea un nuovo issue con:
   - Descrizione dettagliata del problema
   - Passi per riprodurre il bug
   - Screenshot se applicabili
   - Informazioni sul sistema (OS, browser, versione app)

### **Richiesta Funzionalità**
1. Apri un nuovo issue con il tag `enhancement`
2. Descrivi la funzionalità richiesta
3. Spiega perché sarebbe utile
4. Proponi una possibile implementazione

### **Contributi Codice**
1. Fai fork del repository
2. Crea un branch per la tua feature: `git checkout -b feature/amazing-feature`
3. Committa le modifiche: `git commit -m 'Add amazing feature'`
4. Pusha il branch: `git push origin feature/amazing-feature`
5. Apri una Pull Request

### **Linee Guida**
- Segui le convenzioni di codice esistenti
- Scrivi test per le nuove funzionalità
- Aggiorna la documentazione se necessario
- Usa commit message descrittivi

## 📄 Licenza

Questo progetto è rilasciato sotto la licenza MIT. Vedi il file [LICENSE](LICENSE) per i dettagli completi.

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

---

<div align="center">

**⭐ Se questo progetto ti è stato utile, considera di dargli una stella su GitHub! ⭐**

[🌟 Star su GitHub](https://github.com/tuousername/gamestringer-app) | [🐛 Segnala Bug](https://github.com/tuousername/gamestringer-app/issues) | [💡 Richiedi Feature](https://github.com/tuousername/gamestringer-app/issues/new?template=feature_request.md)

---

*Realizzato con ❤️ per la community gaming italiana*

</div>
