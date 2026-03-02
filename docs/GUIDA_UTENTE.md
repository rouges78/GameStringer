# 📖 GameStringer - Guida Utente Completa

## Indice

1. [Panoramica](#panoramica)
2. [Primo Avvio e Profili](#primo-avvio-e-profili)
3. [Libreria e Dettaglio Gioco](#libreria-e-dettaglio-gioco)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [API Pubblica v1](#api-pubblica-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NUOVO v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NUOVO v1.0.5)*
12. [Quality Gates](#quality-gates) *(NUOVO v1.0.5)*
13. [Player Feedback](#player-feedback) *(NUOVO v1.0.5)*
14. [Nuovi Provider AI v1.0.6](#nuovi-provider-ai-v106) *(NUOVO v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NUOVO v1.0.7)*
16. [UI Miglioramenti v1.0.9](#ui-miglioramenti-v109) *(NUOVO v1.0.9)*
17. [Esportazione Patch](#esportazione-patch)
18. [Applicazione al Gioco](#applicazione-al-gioco)
19. [Gestione Backup](#gestione-backup)
20. [Editor Traduzioni](#editor-traduzioni)
21. [Activity History](#activity-history)
22. [Dizionari](#dizionari)
23. [Risoluzione Problemi](#risoluzione-problemi)
24. [Novità v1.4.0](#novità-v140)
25. [Novità v1.4.1](#novità-v141)

---

## Panoramica

GameStringer è un sistema avanzato per la traduzione automatica e manuale di videogiochi. Supporta:

- **Motori di gioco**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri e altri
- **Formati file**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA e altri
- **Provider AI**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ provider)
- **Lingue**: 200+ lingue supportate (con NLLB-200)
- **UI Multilingua**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 lingue)
- **Store Gaming**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NUOVO v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NUOVO v1.0.6**: Qwen 3 (lingue asiatiche), NLLB-200 (200 lingue), bug fixes
- **NUOVO v1.0.7**: Community Hub, GitHub Discussions, Licenza v1.1
- **NUOVO v1.0.8**: Fix download aggiornamenti
- **NUOVO v1.0.9**: Header animati, notifiche aggiornamenti, UI polish
- **NUOVO v1.4.0**: Radix UI unificato, Quality Badge per-riga, supporto RTL, Ollama generico, pulizia TypeScript
- **NUOVO v1.4.1**: GOG Galaxy completo, dashboard migliorata, tab Info gioco, fix provider AI, build cross-platform Linux

---

## Primo Avvio e Profili

### Creazione Profilo

Al primo avvio, GameStringer richiede la creazione di un profilo utente:

1. **Clicca "Crea Profilo"** nella schermata iniziale
2. **Inserisci un nome** per il profilo (es. "MioNome")
3. **Imposta una password** (minimo 6 caratteri)
4. **Clicca "Crea"** per confermare

### Login

Per accedere a un profilo esistente:

1. **Seleziona il profilo** dalla lista
2. **Inserisci la password**
3. **(Opzionale)** Spunta "Ricorda password" per login automatico
4. **Clicca "Accedi"**

### Gestione Profili

- **Cambio profilo**: Clicca sull'icona profilo in alto a destra → "Cambia profilo"
- **Logout**: Clicca sull'icona profilo → "Esci"
- **Impostazioni profilo**: Vai in Settings → Profilo

---

## Libreria e Dettaglio Gioco

### Libreria

La Libreria mostra tutti i tuoi giochi sincronizzati da Steam, Epic Games, GOG e altri store.

- **Aggiorna**: Ricarica la lista dei giochi
- **Condivisi**: Mostra/nascondi giochi Family Sharing
- **Filtri**: Filtra per piattaforma, stato installazione, engine

### Pagina Dettaglio Gioco

Clicca su un gioco per aprire la pagina dettaglio con layout **3:1**:

#### Colonna Principale (75%)

- **Screenshot Gallery**: Griglia fino a 12 screenshot cliccabili (lightbox)
- **Info rapide**: Engine, numero file, percorso installazione, DLC
- **Tabs File/Traduzioni/Patch**:
  - **File**: File traducibili trovati con pulsante "Neural Translator"
  - **Traduzioni**: Traduzioni attive per questo gioco
  - **Patch**: Installa/rimuovi patch per Unity, Unreal, RPG Maker

#### Sidebar Destra (25%)

- **Info Gioco**: Sviluppatore, editore, data uscita, generi, lingue supportate
- **Azioni**: Traduci Gioco, Scansiona File
- **HowLongToBeat**: Tempo stimato per completare il gioco

#### Raccomandazione Traduzione

In fondo alla pagina, il sistema analizza il gioco e suggerisce il **metodo di traduzione migliore**:

| Metodo | Quando usarlo |
|--------|---------------|
| **Live Unity** | Giochi Unity con BepInEx + XUnity |
| **File Translation** | File di localizzazione trovati (JSON, CSV, ecc.) |
| **OCR Overlay** | Nessun file trovato, traduzione visiva in tempo reale |

---

## Neural Translator Pro

### Come Tradurre un File

1. **Seleziona un gioco** dalla libreria Steam o carica manualmente
2. **Carica il file** da tradurre (drag & drop o sfoglia)
3. **Configura le opzioni**:
   - **Lingua sorgente**: la lingua originale del file (es. Inglese)
   - **Lingua target**: la lingua di destinazione (es. Italiano)
   - **Provider AI**: Claude (consigliato), Gemini o GPT
   - **API Key**: inserisci la tua chiave API del provider scelto
4. **Avvia la traduzione** cliccando "Avvia Traduzione"
5. **Monitora il progresso** nella barra di avanzamento

### Opzioni Avanzate

| Opzione | Descrizione |
|---------|-------------|
| **Quality Checks** | Verifica automatica della qualità (numeri, formattazione, ecc.) |
| **Translation Memory** | Riutilizza traduzioni precedenti per velocizzare |
| **Batch Size** | Numero di stringhe tradotte in parallelo (default: 10) |

### Costi Stimati

Il sistema mostra una stima dei costi prima di iniziare:

- **Claude**: ~$0.003 per 1K token
- **Gemini**: ~$0.0005 per 1K token (più economico)
- **GPT-4**: ~$0.01 per 1K token

---

## Translation Wizard

Il Translation Wizard è una procedura guidata per tradurre automaticamente i file di un gioco.

### Come Usare il Wizard

1. **Vai su Translator** → clicca "Translation Wizard"
2. **Seleziona il gioco** dalla libreria o inserisci il percorso manualmente
3. **Scansiona i file**: il wizard trova automaticamente i file traducibili
4. **Seleziona i file** da tradurre (puoi selezionarne più di uno)
5. **Configura le opzioni**:
   - Lingua sorgente e destinazione
   - Provider AI
   - Opzioni di qualità
6. **Avvia la traduzione batch**
7. **Monitora il progresso** nella barra di avanzamento

### Formati Rilevati Automaticamente

| Estensione | Tipo |
| ---------- | ---- |
| `.json` | Localizzazione JSON |
| `.csv` | Tabelle di testo |
| `.xml` | Configurazioni XML |
| `.po/.pot` | Gettext (standard Linux) |
| `.txt` | Testo semplice |
| `.yaml` | YAML config |

---

## Translation Bridge

Il Translation Bridge permette di tradurre i giochi Unity **in tempo reale** durante il gameplay.

### Requisiti

- Gioco Unity (Mono o IL2CPP)
- BepInEx installato
- XUnity.AutoTranslator plugin

### Come Configurare

1. **Vai su Translation Bridge** nel menu
2. **Seleziona il gioco** Unity dalla lista
3. **Installa BepInEx** (automatico se non presente)
4. **Configura XUnity.AutoTranslator**:
   - Lingua di destinazione
   - Endpoint di traduzione
5. **Avvia il gioco** - le traduzioni appariranno automaticamente

### Modalità di Funzionamento

- **Cache locale**: Traduzioni salvate per riutilizzo
- **Traduzione live**: Nuove stringhe tradotte al volo
- **Fallback**: Se offline, usa solo la cache

---

## Subtitle Translator Pro

> Aggiunto in v1.0.4

Il Subtitle Translator Pro permette di tradurre sottotitoli in vari formati.

### Formati Supportati

| Formato | Estensione | Descrizione |
|---------|------------|-------------|
| **SubRip** | .srt | Formato più comune |
| **WebVTT** | .vtt | Standard web |
| **ASS/SSA** | .ass/.ssa | Sottotitoli avanzati con stili |

### Come Usare

1. **Vai su Subtitle Translator** nel menu
2. **Carica il file** sottotitoli (drag & drop o sfoglia)
3. **Seleziona lingua** sorgente e destinazione
4. **Preview in tempo reale** delle traduzioni
5. **Esporta** nel formato desiderato

### Funzionalità

- **Validazione QA**: Controllo automatico timing e formattazione
- **Preview sincronizzata**: Vedi le traduzioni con timing originale
- **Export multi-formato**: Converti tra SRT, VTT, ASS

---

## Retro ROM Tools

> Aggiunto in v1.0.4

Strumenti per tradurre giochi retro su ROM.

### Console Supportate

| Console | Abbreviazione |
|---------|---------------|
| Nintendo Entertainment System | NES |
| Super Nintendo | SNES |
| Game Boy | GB |
| Game Boy Color | GBC |
| Game Boy Advance | GBA |
| Sega Genesis/Mega Drive | Genesis |
| PlayStation 1 | PSX |
| Nintendo 64 | N64 |

### Funzionalità ROM

- **Table File Parser**: Legge e genera file .TBL per mappatura caratteri
- **Font Injection**: Inietta font con caratteri accentati italiani
- **Hex Editor integrato**: Modifica diretta delle ROM

### Utilizzo Retro ROM

1. **Vai su Retro ROM Tools** nel menu
2. **Carica la ROM** del gioco
3. **Carica o genera** il Table File (.TBL)
4. **Estrai il testo** dalla ROM
5. **Traduci** con AI o manualmente
6. **Inietta** le traduzioni nella ROM

---

## API Pubblica v1

> Aggiunto in v1.0.4

GameStringer espone una API REST per integrazioni esterne.

### Endpoint Disponibili

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/api/v1/translate` | Traduzione singola stringa |
| `POST` | `/api/v1/batch` | Traduzione batch (max 100 stringhe) |
| `GET` | `/api/v1/languages` | Lista 20 lingue supportate |
| `GET` | `/api/v1/health` | Health check del servizio |

### Esempio Richiesta

```json
POST /api/v1/translate
{
  "text": "Hello, world!",
  "source": "en",
  "target": "it",
  "provider": "gemini"
}
```

### Esempio Risposta

```json
{
  "translation": "Ciao, mondo!",
  "source": "en",
  "target": "it",
  "provider": "gemini",
  "tokens": 12
}
```

### Uso CI/CD

L'API è ideale per integrare GameStringer in pipeline di build automatizzate.

---

## Voice Clone Studio

> Aggiunto in v1.0.5

Clona voci con AI per doppiaggio automatico dei giochi.

### Provider Supportati

| Provider | Tipo | Qualità |
|----------|------|---------|
| **ElevenLabs** | Cloud | ⭐⭐⭐⭐⭐ Eccellente |
| **OpenAI TTS** | Cloud | ⭐⭐⭐⭐ Molto buona |

### Voice Presets

- 🎭 **Narratore**: Voce calma e autorevole
- ⚔️ **Eroe**: Voce coraggiosa e determinata
- 😈 **Cattivo**: Voce minacciosa e profonda
- 👶 **Bambino**: Voce giovane e allegra
- 🤖 **Robot**: Voce sintetica e metallica
- 👻 **Sussurro**: Voce bassa e misteriosa

### Utilizzo Voice Clone

1. **Vai su Voice Clone** nel menu
2. **Inserisci il testo** da convertire in audio
3. **Seleziona il provider** (ElevenLabs o OpenAI)
4. **Scegli il preset** vocale
5. **Genera audio** e scarica il file MP3/WAV

---

## VR Text Overlay

> Aggiunto in v1.0.5

Sottotitoli spaziali 3D per giochi VR.

### Headset Supportati

| Headset | Supporto |
|---------|----------|
| **Oculus Quest/Rift** | ✅ Completo |
| **SteamVR** (Valve Index, HTC Vive) | ✅ Completo |
| **Windows Mixed Reality** | ✅ Completo |

### Position Presets

- **Center** - Davanti al giocatore
- **Bottom** - In basso (classico sottotitolo)
- **Top** - In alto (notifiche)
- **Follow Head** - Segue lo sguardo

### Utilizzo VR Overlay

1. **Vai su VR Overlay** nel menu
2. **Rileva headset** automaticamente
3. **Configura posizione** e dimensione testo
4. **Avvia overlay** prima di lanciare il gioco VR
5. I sottotitoli appariranno nello spazio 3D

---

## Quality Gates

> Aggiunto in v1.0.5

Sistema automatico di controllo qualità traduzioni.

### Controlli Automatici

| Check | Descrizione |
|-------|-------------|
| **Placeholder** | Verifica {0}, {1}, %s, etc. |
| **Numeri** | Numeri preservati correttamente |
| **Tag HTML** | `<color>`, `<b>`, etc. intatti |
| **Lunghezza** | Traduzione non troppo lunga/corta |
| **Punteggiatura** | Coerenza con originale |

### Livelli di Confidenza

| Livello | Punteggio | Colore |
|---------|-----------|--------|
| 🔴 Critico | < 40% | Rosso |
| 🟠 Basso | 40-59% | Arancione |
| 🟡 Medio | 60-74% | Giallo |
| 🟢 Alto | 75-89% | Verde |
| 💚 Perfetto | 90-100% | Verde scuro |

### Utilizzo Quality Gates

1. **Vai su Quality Gates** nel menu
2. **Carica traduzioni** (JSON, CSV, o incolla)
3. **Analizza** automaticamente ogni stringa
4. **Filtra** per livello di confidenza
5. **Esporta report** in JSON

---

## Player Feedback

> Aggiunto in v1.0.5

Raccogli e gestisci feedback dei giocatori sulle traduzioni.

### Categorie Feedback

- 📝 **Traduzione errata** - Significato sbagliato
- 🔤 **Errore grammaticale** - Grammatica/ortografia
- 🎭 **Tono inappropriato** - Registro linguistico errato
- ❓ **Non chiaro** - Traduzione confusa
- ✨ **Suggerimento** - Proposta miglioramento

### Sistema Rating

⭐⭐⭐⭐⭐ Rating 1-5 stelle per ogni traduzione

### Stati Feedback

| Stato | Descrizione |
|-------|-------------|
| 🆕 Nuovo | Appena ricevuto |
| 👀 In revisione | In fase di analisi |
| ✅ Risolto | Corretto |
| ❌ Rifiutato | Non applicabile |

### Utilizzo Player Feedback

1. **Vai su Player Feedback** nel menu
2. **Visualizza feedback** ricevuti
3. **Filtra** per categoria, stato, rating
4. **Aggiorna stato** dei feedback
5. **Esporta** in CSV per analisi

---

## Nuovi Provider AI v1.0.6

> Aggiunto in v1.0.6

### Qwen 3 - Lingue Asiatiche

Provider ottimizzato per cinese, giapponese e coreano.

| Modello | Parametri | RAM Richiesta |
|---------|-----------|---------------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |

**Installazione**:

```bash
ollama pull qwen3:14b
```

**Lingue ottimizzate**: 中文 (Cinese), 日本語 (Giapponese), 한국어 (Coreano)

### NLLB-200 - 200 Lingue

Provider Meta AI con supporto per 200 lingue, incluse quelle rare.

**Lingue speciali supportate**:


- Thai, Vietnamese, Hindi, Arabic
- Swahili, Indonesian, Turkish
- Ukrainian, Bengali, Tamil

**Configurazione**:


1. Vai su **Settings → API Keys**
2. Inserisci **HuggingFace API Key** (gratuito)
3. Seleziona **NLLB-200** come provider

### Generic Ollama

Usa qualsiasi modello installato in Ollama per traduzioni.

**Modelli consigliati**:


- `llama3.2` - Buon bilanciamento qualità/velocità
- `mistral` - Ottimo per lingue europee
- `gemma2` - Veloce e leggero

---

## Community Hub v1.0.7

> Aggiunto in v1.0.7

Hub centralizzato per la community di GameStringer.

### GitHub Discussions

Accesso diretto alle discussioni della community:

- **Annunci**: Novità e aggiornamenti ufficiali
- **Q&A**: Domande e risposte dalla community
- **Idee**: Proposte per nuove funzionalità
- **Showcase**: Progetti e traduzioni della community

### Come Accedere

1. **Vai su Community Hub** nel menu laterale
2. **Naviga** tra le categorie di discussione
3. **Partecipa** direttamente su GitHub

### Licenza v1.1

- **YouTuber/Streamer**: OK con attribuzione
- **Fork non-commerciali**: Permessi
- **Uso commerciale**: Richiede autorizzazione

---

## UI Miglioramenti v1.0.9

> Aggiunto in v1.0.9

Aggiornamenti estetici e funzionali all'interfaccia.

### Header Animati

Tutte le pagine di traduzione ora hanno header con:

- **Effetto "Respiro"**: Gradiente che si espande/contrae dolcemente (12s)
- **Ombreggiature profonde**: shadow-xl con tinta blu
- **Gradiente uniforme**: Sky → Blue → Cyan

### Notifiche Aggiornamenti

La **campanella** nella navbar ora gestisce gli aggiornamenti:

| Stato | Comportamento |
|-------|---------------|
| 🔔 Grigia | Nessuna notifica |
| 🔔 Gialla | Notifiche non lette |
| 🔔 Verde + pulse | Aggiornamento disponibile! |

**Funzionalità**:


- **Suono**: Due toni melodici quando rileva update
- **Badge verde**: Icona download animata
- **Click**: Apre popup con lista novità
- **Pulsante Scarica**: Apre pagina download

### Menu Sidebar

- **Sub-item hover**: Colore verde scuro (emerald-600)
- **Coerenza visiva**: Stile unificato

### Schermata Login

- **Versione sotto logo**: Mostra v1.0.9 sotto il logo
- **Footer**: Battuta/massima invece del copyright

---

## Esportazione Patch

Il Unity Patcher installa automaticamente BepInEx e XUnity.AutoTranslator sui giochi Unity.

### Utilizzo Unity Patcher

1. **Vai su Unity Patcher** nel menu laterale
2. **Seleziona un gioco Unity** dalla lista (badge verde "Unity")
3. **Scegli la lingua** di destinazione (es. Italiano)
4. **Scegli la modalità**:
   - **Solo cattura**: Cattura testo per traduzione manuale
   - **Google Translate**: Traduzione automatica in-game
   - **DeepL**: Traduzione automatica di qualità superiore
5. **Clicca "Installa patch"**
6. **Avvia il gioco** - premi `ALT+T` per aprire il menu XUnity

### Badge Traduzione

Dopo l'installazione, vedrai un badge che indica lo stato:

| Badge | Significato |
|-------|-------------|
| 🥈 Argento | XUnity con auto-translate attivo (Google/DeepL) |
| 🥉 Bronzo | Solo cattura testo (traduzione manuale) |

### Tracking Attività

Ogni patch installata viene registrata in **Attività Recenti** nella Dashboard con:

- Nome del gioco
- Modalità di traduzione scelta
- Lingua target

---

## Activity History

La cronologia delle attività tiene traccia di tutte le operazioni effettuate.

### Accesso

Vai su **Activity History** nel menu laterale.

### Tipi di Attività Registrate

| Icona | Tipo | Descrizione |
| ----- | ---- | ----------- |
| 🌐 | Translation | Traduzioni completate |
| 🔧 | Patch | Patch create/applicate |
| ♻️ | SteamSync | Sincronizzazioni Steam |
| ➕ | GameAdded | Giochi aggiunti |
| 🎮 | GameLaunched | Giochi avviati |
| 👤 | ProfileCreated | Profili creati |
| ⚙️ | SettingsChanged | Impostazioni modificate |

### Filtri Disponibili

- **Per tipo**: Filtra per categoria di attività
- **Per data**: Seleziona intervallo temporale
- **Per gioco**: Mostra solo attività di un gioco specifico

---

## Esportazione e Distribuzione Patch

Dopo aver completato una traduzione, puoi esportare un pacchetto pronto per la distribuzione.

### Bottone "Esporta Patch"

Crea un file ZIP sul tuo **Desktop** contenente:

```text
📦 NomeGioco_it_patch.zip
├── 📁 translated/          # File tradotti pronti all'uso
│   └── file_tradotto.csv
├── 📁 backup/               # Backup dei file originali
│   └── file_originale.csv
├── 📁 xunity/               # Formato XUnity.AutoTranslator
│   └── AutoTranslator/
│       └── Translation/
│           └── it/
│               └── _Translations.txt
├── 📄 README.txt            # Istruzioni di installazione
└── 📄 metadata.json         # Informazioni sulla traduzione
```

### Formato XUnity.AutoTranslator

Il formato XUnity è compatibile con:

- **Unity games** con BepInEx + XUnity.AutoTranslator
- Formato: `testo_originale=testo_tradotto`

---

## Applicazione al Gioco

### Bottone "Applica al gioco"

Installa la traduzione **direttamente nel gioco** in automatico:

1. **Rileva il motore** del gioco (Unity, Unreal, ecc.)
2. **Verifica compatibilità** con i patcher disponibili
3. **Installa il patcher** se necessario (es. BepInEx per Unity)
4. **Copia i file tradotti** nella cartella corretta
5. **Configura il gioco** per caricare le traduzioni

### Motori Supportati

| Motore | Patcher | Stato |
|--------|---------|-------|
| Unity (Mono) | BepInEx + XUnity.AutoTranslator | ✅ Automatico |
| Unity (IL2CPP) | BepInEx IL2CPP | ⚠️ Parziale |
| Unreal Engine | - | 🔧 Manuale |
| RPG Maker | - | ✅ Sostituzione diretta |
| Ren'Py | - | ✅ Sostituzione diretta |

### Cosa Succede ai File Originali?

**I file originali vengono SEMPRE preservati!**

1. Prima di sovrascrivere, viene creato un backup automatico
2. I backup sono salvati in `.gamestringer_backups/` nella cartella del gioco
3. Il nome del backup include un timestamp: `20241228_001500_nomefile.csv`

---

## Gestione Backup

### Dove Trovare i Backup

I backup sono salvati in due posti:

1. **Nella cartella del gioco**: `[cartella_gioco]/.gamestringer_backups/`
2. **Nel pacchetto ZIP esportato**: cartella `backup/`

### Come Ripristinare un Backup

#### Metodo 1: Dall'app GameStringer

1. Vai nella sezione **Backup** dell'app
2. Seleziona il file da ripristinare
3. Clicca **Ripristina**

#### Metodo 2: Manualmente

1. Trova il file backup in `.gamestringer_backups/`
2. Copia il file nella posizione originale
3. Rinomina rimuovendo il timestamp

---

## Editor Traduzioni

L'Editor permette di modificare manualmente le traduzioni.

### Struttura Gerarchica

```text
📁 Giochi
├── 📁 Decarnation
│   ├── 📄 dialoghi.csv (897 stringhe)
│   └── 📄 items.csv (123 stringhe)
└── 📁 Altro Gioco
    └── 📄 testi.json (456 stringhe)
```

### Funzionalità Editor

- **Ricerca**: trova stringhe per testo
- **Filtri**: mostra solo traduzioni incomplete, con errori, ecc.
- **Suggerimenti AI**: richiedi nuove traduzioni per singole stringhe
- **Salvataggio automatico**: le modifiche vengono salvate nel dizionario

---

## Dizionari

I dizionari salvano le traduzioni per ogni gioco.

### Come Funzionano

1. Ogni gioco ha il suo dizionario separato
2. Le traduzioni vengono salvate automaticamente
3. Riutilizzate per velocizzare traduzioni future
4. Esportabili in vari formati (JSON, CSV, TMX)

### Posizione dei Dizionari

```text
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_altro_gioco.json
└── ...
```

---

## Risoluzione Problemi

### La traduzione è lenta

- **Causa**: Troppe stringhe o provider lento
- **Soluzione**: Aumenta il batch size o usa Gemini (più veloce)

### Errore API Key

- **Causa**: Chiave API non valida o scaduta
- **Soluzione**: Verifica la chiave sul sito del provider

### Il patcher non si installa

- **Causa**: Antivirus blocca BepInEx
- **Soluzione**: Aggiungi eccezione per la cartella del gioco

### File non riconosciuto

- **Causa**: Formato file non supportato
- **Soluzione**: Converti in CSV o JSON

### Traduzione con errori di formattazione

- **Causa**: L'AI ha modificato variabili o tag
- **Soluzione**: Attiva "Quality Checks" per rilevare automaticamente

---

## Scorciatoie da Tastiera

| Scorciatoia | Azione |
|-------------|--------|
| `Ctrl + S` | Salva traduzione corrente |
| `Ctrl + Z` | Annulla modifica |
| `Ctrl + F` | Cerca nel file |
| `Esc` | Chiudi dialog/pannello |

---

## Supporto

- **GitHub**: [github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
- **Issues**: Segnala bug o richiedi funzionalità
- **Wiki**: Documentazione tecnica dettagliata

---

## Novità v1.4.0

### Radix UI Unificato

La libreria UI è stata migrata dal pacchetto individuale `@radix-ui/react-*` al pacchetto unificato `radix-ui`:

- **37 componenti migrati** con import semplificati
- **27 pacchetti rimossi** dalle dipendenze, bundle più leggero
- Nessun cambiamento visivo — stessa UI, meno dipendenze

### Quality Badge nel Traduttore Pro

Ogni riga tradotta ora mostra indicatori di qualità visivi:

- **QualityScoreBadge**: punteggio 0-100 con colori (🟢 ≥80, 🟡 ≥60, 🔴 <60)
- **ContentTypeBadge**: classifica il tipo di contenuto (UI, Dialogo, Narrativa, Sistema, Tutorial, etc.)
- **Live Preview**: durante la traduzione batch, le ultime 3 righe tradotte appaiono con il punteggio in tempo reale
- **Tabella Dettaglio**: nella pagina risultati, fino a 200 righe con originale, traduzione, tipo e qualità

### Supporto RTL

- Rilevamento automatico della direzione del testo per lingue RTL (arabo, ebraico)
- Attributo `dir` applicato dinamicamente al documento HTML
- Funziona con il sistema i18n esistente

### Ollama Generico

- Nuovo provider `translateWithOllamaGeneric` per usare qualsiasi modello Ollama
- PROVIDER_MAP con mapping automatico dei modelli
- Chain presets con fallback automatico tra provider

### Ottimizzazione Bundle

- `optimizePackageImports` aggiornato con `radix-ui`, `framer-motion`, `recharts`, `cmdk`, `react-hook-form`
- Zero errori TypeScript nei file sorgente

---

## Novità v1.4.1

### GOG Galaxy Completo

- **Lettura libreria GOG Galaxy 2.0**: legge i giochi posseduti dal database SQLite locale
- **Copertine e descrizioni via GOG API**: fetch automatico delle immagini e dei dettagli
- **Merge con giochi installati**: unisce i dati del registro con quelli del database Galaxy
- **Link store e download**: pagina Store con link diretti a GOG Galaxy

### Dashboard Migliorata

- **Store Connessi in alto**: gli store connessi sono ora affiancati all'ultimo gioco aperto
- **Badge store con conteggi reali**: mostra il numero effettivo di giochi per ogni store
- **Placeholder ultimo gioco**: visualizzazione elegante quando nessun gioco è stato aperto

### Dettaglio Gioco Potenziato

- **Tab Info**: requisiti di sistema, punteggio Metacritic, link store, lista DLC nella sidebar
- **Copertine GOG**: fallback automatico per le copertine dei giochi GOG
- **Descrizioni GOG**: fetch descrizione completa via GOG API

### Fix Provider AI

- **Provider gratuiti mai bloccati permanentemente**: MyMemory, Lingva e altri usano cooldown (30s) invece di blocco permanente
- **Steam Wishlist**: nuovo endpoint IWishlistService con fallback al legacy

### Performance

- **Cache sessionStorage**: navigazione istantanea tornando dalla pagina dettaglio alla libreria
- **Batch cover save**: salvataggio copertine in batch con debounce (2s) per evitare race condition
- **Deduplica fetch SteamGridDB**: evita richieste duplicate in StrictMode

### Build Cross-Platform

- **Script build Node.js**: `build-tauri-cross.js` sostituisce lo script PowerShell-only
- **Supporto Linux**: il workflow GitHub Actions ora compila anche per Linux (.deb, .AppImage)
- **Windows**: installer (.msi, .exe NSIS) e versione portable (.zip)

### Documentazione

- **11 guide utente**: fix markdown lint (MD029, MD024, MD032, MD036, MD040, MD022, MD031)
- **Numerazione indice corretta**: indice ordinato senza salti di numerazione

---

*GameStringer v1.4.1 - Guida aggiornata al 02/03/2026*
