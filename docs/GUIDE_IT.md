# 📚 GameStringer Guida Completa

> **Versione**: 1.0.2  
> **Ultimo Aggiornamento**: 22 Gennaio 2026

---

## Indice

1. [Introduzione](#introduzione)
2. [Installazione](#installazione)
3. [Primo Avvio e Creazione Profilo](#primo-avvio-e-creazione-profilo)
4. [Panoramica Dashboard](#panoramica-dashboard)
5. [Gestione Libreria](#gestione-libreria)
6. [Strumenti di Traduzione](#strumenti-di-traduzione)
7. [Configurazione Provider AI](#configurazione-provider-ai)
8. [Supporto Engine di Gioco](#supporto-engine-di-gioco)
9. [Patcher e Iniezione Mod](#patcher-e-iniezione-mod)
10. [Community Hub](#community-hub)
11. [Funzionalità Avanzate](#funzionalità-avanzate)
12. [Risoluzione Problemi](#risoluzione-problemi)
13. [FAQ](#faq)

---

## Introduzione

**GameStringer** è uno strumento gratuito di localizzazione videogiochi con AI che ti permette di tradurre i tuoi giochi preferiti in qualsiasi lingua usando tecnologia AI neurale.

### Funzionalità Principali

- **15+ Provider AI**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, Cohere, DeepL, Ollama (locale), LM Studio e altri
- **Supporto Multi-Engine**: Unity, Unreal Engine, Godot, RPG Maker, Ren'Py, GameMaker, Telltale
- **Integrazione Store**: Steam, Epic Games, GOG, Origin, Ubisoft Connect, Battle.net, itch.io
- **Strumenti Professionali**: OCR Translator, Voice Pipeline, Overlay Real-time, Translation Memory
- **7 Lingue UI**: Italiano, English, Español, Français, Deutsch, 日本語, 中文

---

## Installazione

### Requisiti di Sistema

| Componente | Minimo | Consigliato |
|------------|--------|-------------|
| OS | Windows 10 (64-bit) | Windows 11 (64-bit) |
| RAM | 4 GB | 8 GB |
| Spazio | 500 MB | 1 GB |
| Internet | Richiesto per traduzione AI | Banda larga consigliata |

### Passaggi di Installazione

1. **Scarica** l'ultima release da [GitHub Releases](https://github.com/rouges78/GameStringer/releases)
2. **Scegli la versione**:
   - `GameStringer-Setup.exe` - Installer standard (consigliato)
   - `GameStringer-Portable.zip` - Versione portatile (nessuna installazione)
3. **Esegui l'installer** e segui le istruzioni a schermo
4. **Avvia GameStringer** dal menu Start o dal collegamento sul desktop

---

## Primo Avvio e Creazione Profilo

### Creazione del Profilo

1. Al primo avvio, vedrai la schermata **Selettore Profilo**
2. Clicca **"Crea Nuovo Profilo"**
3. Inserisci nome profilo e password
4. Il tuo profilo memorizza:
   - Impostazioni provider AI
   - Preferenze di traduzione
   - Cache libreria giochi
   - Translation memory

### Sicurezza Profilo

- I profili sono memorizzati localmente sul tuo computer
- Le password sono hashate (non salvate in chiaro)
- Puoi esportare/importare profili per backup

---

## Panoramica Dashboard

La dashboard è il tuo centro di controllo con accesso rapido a tutte le funzionalità.

### Sezioni Principali

| Sezione | Descrizione |
|---------|-------------|
| **Attività Recenti** | Le tue ultime traduzioni e azioni |
| **Azioni Rapide** | Accesso con un click a Libreria, Traduci, Patcher, Community |
| **Statistiche** | Giochi totali, traduzioni, patch attive |

### Link Rapidi

- **Batch** - Coda multipli file per traduzione
- **Progetti** - Gestisci progetti di traduzione
- **Statistiche** - Visualizza statistiche dettagliate
- **Impostazioni** - Configura preferenze app

---

## Gestione Libreria

### Rilevamento Automatico Giochi

GameStringer rileva automaticamente i giochi da:

- **Steam** - Libreria completa + supporto Family Sharing
- **Epic Games** - Tramite Legendary CLI
- **GOG Galaxy** - Integrazione nativa
- **Origin/EA** - Rilevamento registro
- **Ubisoft Connect** - Supporto completo
- **Amazon Games** - Supporto completo
- **itch.io** - Supporto giochi indie

### Aggiunta Manuale Giochi

1. Clicca il pulsante **"Aggiungi Gioco"**
2. Naviga alla cartella di installazione del gioco
3. GameStringer rileverà l'engine e i file disponibili

### Dettagli Gioco

Clicca su qualsiasi gioco per vedere:

- **Engine rilevato** (Unity, Unreal, ecc.)
- **Traduzioni disponibili**
- **Metodo di traduzione consigliato**
- **Galleria screenshot**

---

## Strumenti di Traduzione

### AI Translator

L'interfaccia principale di traduzione con:

1. **Selezione Sorgente** - Scegli file o cartelle da tradurre
2. **Selezione Lingua** - Scegli lingua sorgente e destinazione
3. **Provider AI** - Seleziona il tuo AI preferito
4. **Impostazioni Contesto** - Genere gioco, voce personaggio, formalità

### Neural Translator Pro

Funzionalità avanzate:

- **Elaborazione batch multi-file**
- **Integrazione translation memory**
- **Supporto glossario**
- **Punteggio qualità**

### Confronto Multi-LLM

Confronta traduzioni da più provider AI:

1. Inserisci il tuo testo
2. Seleziona 3+ provider AI
3. Ottieni traduzioni parallele
4. Selezione automatica del miglior risultato per consenso

### OCR Translator

Per giochi retro senza testo estraibile:

1. Cattura screenshot
2. OCR estrae il testo (Tesseract.js)
3. Traduci il testo estratto
4. Visualizza con overlay

### Voice Pipeline

Speech-to-text → Traduzione → Text-to-speech:

1. Registra o carica audio
2. Whisper trascrive in testo
3. AI traduce il testo
4. TTS genera audio tradotto

---

## Configurazione Provider AI

### Opzioni Gratuite

| Provider | API Key | Limiti |
|----------|---------|--------|
| **Ollama** | ❌ No (locale) | Illimitato |
| **LM Studio** | ❌ No (locale) | Illimitato |
| **Gemini** | ✅ Sì | Tier gratuito disponibile |
| **Groq** | ✅ Sì | Tier gratuito disponibile |
| **Mistral** | ✅ Sì | Tier gratuito disponibile |
| **MyMemory** | ❌ No | 1000 parole/giorno |

### Opzioni a Pagamento

| Provider | Qualità | Velocità | Costo |
|----------|---------|----------|-------|
| **OpenAI GPT-4** | ⭐⭐⭐⭐⭐ | Veloce | $$$ |
| **Claude 3** | ⭐⭐⭐⭐⭐ | Veloce | $$$ |
| **DeepL** | ⭐⭐⭐⭐ | Molto Veloce | $$ |
| **DeepSeek** | ⭐⭐⭐⭐ | Veloce | $ |

### Istruzioni di Configurazione

1. Vai su **Impostazioni** → **Provider AI**
2. Clicca sul provider che vuoi configurare
3. Inserisci la tua API key
4. Testa la connessione
5. Imposta come predefinito (opzionale)

### Configurazione AI Locale (Ollama)

1. Scarica [Ollama](https://ollama.ai)
2. Installa ed esegui `ollama serve`
3. Scarica un modello: `ollama pull llama2` o `ollama pull mistral`
4. In GameStringer, Ollama verrà rilevato automaticamente

---

## Supporto Engine di Gioco

### Giochi Unity (Automatico)

GameStringer gestisce i giochi Unity automaticamente:

1. **Rileva la versione Unity** da `globalgamemanagers`
2. **Installa BepInEx** (framework mod)
3. **Installa XUnity.AutoTranslator** (hook traduzione)
4. **Estrae tutto il testo del gioco**
5. **Traduce con l'AI scelto**
6. **Crea i file di traduzione**

Nessun patching manuale richiesto!

### Unreal Engine

Usa UnrealLocres per manipolazione file `.locres`:

1. Seleziona il tuo gioco UE
2. GameStringer estrae il testo dai file di localizzazione
3. Traduci
4. Creazione patch con un click

### Godot

Supporto nativo per progetti Godot:

- File `.translation`
- Risorse `.tres`
- Scene `.tscn`

### RPG Maker

| Versione | Metodo |
|----------|--------|
| MV/MZ | Traduzione JSON diretta |
| VX/Ace | Tramite tool RPG Maker Trans |

### Ren'Py

Parsing diretto file `.rpy`:

- Estrazione dialoghi
- Rilevamento nomi personaggi
- Preservazione formattazione

### Giochi Telltale

Supporto per file `.langdb` e `.dlog`:

- The Wolf Among Us
- Serie The Walking Dead
- Serie Batman

---

## Patcher e Iniezione Mod

### Unity Patcher

1. Seleziona un gioco Unity
2. Clicca **"Patch"**
3. GameStringer:
   - Crea backup dei file originali
   - Installa BepInEx
   - Installa XUnity.AutoTranslator
   - Applica le tue traduzioni

### Universal Injector

Per giochi senza supporto nativo:

1. Seleziona l'eseguibile del gioco
2. Scegli il metodo di iniezione
3. Configura gli hook
4. Applica l'overlay di traduzione

### Backup e Ripristino

Tutte le patch includono backup automatico:

- **Backup** creato prima del patching
- **Ripristino** con un click
- **Verifica** stato installazione

---

## Community Hub

### Pack di Traduzione

Sfoglia e scarica traduzioni della community:

1. Vai alla tab **Community**
2. Cerca il tuo gioco
3. Filtra per lingua, valutazione, data
4. Scarica con un click

### Condivisione Traduzioni

1. Completa un progetto di traduzione
2. Clicca **"Condividi con Community"**
3. Aggiungi descrizione e tag
4. Carica

### Translation Memory

Riutilizza traduzioni precedenti:

- Matching automatico
- Matching fuzzy per stringhe simili
- Import/export file TM

---

## Funzionalità Avanzate

### Context Crawler

Estrazione contesto gioco con AI:

1. Fornisci nome o descrizione del gioco
2. AI analizza genere, ambientazione, personaggi
3. Il contesto migliora la qualità della traduzione

### Translation Fixer

Riparazione automatica markup:

- Fix tag HTML/XML rotti
- Preserva variabili placeholder
- Corregge problemi di encoding

### Subtitle Overlay

Visualizzazione traduzione real-time:

- Posizione personalizzabile
- Opzioni font e colore
- Controllo opacità
- Supporto multi-riga

### Profili Voce Personaggio

Definisci stili di traduzione specifici per personaggio:

- **Preset profili**: Pirata, Nobile, Bambino, Robot, ecc.
- **Profili custom**: Crea i tuoi
- **Impostazioni per personaggio**: Formalità, vocabolario, pattern linguistici

---

## Risoluzione Problemi

### Problemi Comuni

#### "Giochi Steam non rilevati"

1. Assicurati che Steam sia installato e connesso
2. Vai su **Impostazioni** → **Connessioni Store** → **Steam**
3. Inserisci la tua API key Steam e Steam ID
4. Clicca **Aggiorna Libreria**

#### "Traduzione fallita"

1. Controlla la tua connessione internet
2. Verifica che l'API key sia corretta
3. Controlla se il provider ha limiti di frequenza
4. Prova un altro provider AI

#### "Patch non funziona"

1. Assicurati che il gioco non sia in esecuzione
2. Esegui GameStringer come Amministratore
3. Controlla che l'antivirus non blocchi i file
4. Prova ripristino manuale backup e ri-patch

#### "OCR non accurato"

1. Usa screenshot a risoluzione maggiore
2. Prova preset OCR diversi (8-bit, 16-bit, DOS)
3. Regola impostazioni contrasto e soglia
4. Considera correzione manuale

### File di Log

I log sono salvati in:

```
%APPDATA%\GameStringer\logs\
```

Includi i log quando segnali problemi.

---

## FAQ

### GameStringer è gratuito?

**Sì!** GameStringer è gratuito per uso personale. L'uso commerciale richiede una licenza.

### Funziona offline?

**Parzialmente.** Puoi:

- ✅ Sfogliare la tua libreria
- ✅ Usare AI locale (Ollama, LM Studio)
- ✅ Applicare traduzioni in cache
- ❌ Usare provider AI cloud

### È sicuro da usare?

**Sì.** GameStringer:

- Modifica file di gioco solo con il tuo permesso
- Crea backup automatici
- Non modifica eseguibili di gioco
- Non accede ad account di gioco online

### Verrò bannato per usare traduzioni?

**Improbabile.** GameStringer:

- Traduce solo testo (niente cheat)
- Non modifica il comportamento del gioco
- Funziona come qualsiasi altra mod

Tuttavia, controlla sempre l'EULA di ogni gioco.

### Quali giochi funzionano meglio?

I giochi con questi engine funzionano meglio:

- ✅ Unity (automatico)
- ✅ Unreal Engine
- ✅ RPG Maker MV/MZ
- ✅ Ren'Py
- ✅ Godot

### Come posso supportare il progetto?

- ⭐ Metti una stella al [repository GitHub](https://github.com/rouges78/GameStringer)
- ☕ [Offrimi un caffè](https://ko-fi.com/gamestringer)
- 💜 [Diventa sponsor](https://github.com/sponsors/rouges78)
- 🐛 Segnala bug e suggerisci funzionalità

---

## Supporto

- **GitHub Issues**: [Segnala bug](https://github.com/rouges78/GameStringer/issues)
- **Ko-fi**: [Supporta il progetto](https://ko-fi.com/gamestringer)
- **GitHub Sponsors**: [Diventa sponsor](https://github.com/sponsors/rouges78)

---

<p align="center">
  <strong>GameStringer v1.0.2</strong><br>
  Fatto con ❤️ per i gamer che vogliono giocare nella propria lingua
</p>
