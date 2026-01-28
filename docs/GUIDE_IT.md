# 📚 GameStringer Guida Completa

> **Versione**: 1.0.6  
> **Ultimo Aggiornamento**: 28 Gennaio 2026

---

## Indice

1. [Introduzione](#introduzione)
2. [Installazione](#installazione)
3. [Primo Avvio e Tutorial](#primo-avvio-e-tutorial)
4. [Sistema Profili e Recovery Key](#sistema-profili-e-recovery-key)
5. [Panoramica Dashboard](#panoramica-dashboard)
6. [Gestione Libreria](#gestione-libreria)
7. [Strumenti di Traduzione](#strumenti-di-traduzione)
8. [Configurazione Provider AI](#configurazione-provider-ai)
9. [Supporto Engine di Gioco](#supporto-engine-di-gioco)
10. [Patcher e Iniezione Mod](#patcher-e-iniezione-mod)
11. [Community Hub](#community-hub)
12. [Project Manager](#project-manager)
13. [Funzionalità Avanzate](#funzionalità-avanzate)
14. [Confidence Heatmap](#confidence-heatmap)
15. [Impostazioni e Lingue UI](#impostazioni-e-lingue-ui)
16. [Risoluzione Problemi](#risoluzione-problemi)
17. [FAQ](#faq)

---

## Introduzione

**GameStringer** è uno strumento gratuito di localizzazione videogiochi con AI che ti permette di tradurre i tuoi giochi preferiti in qualsiasi lingua usando tecnologia AI neurale.

### Funzionalità Principali

- **18+ Provider AI**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, Cohere, DeepL, Ollama, LM Studio, **Qwen 3**, **NLLB-200** e altri
- **Supporto Multi-Engine**: Unity, Unreal Engine, Godot, RPG Maker, Ren'Py, GameMaker, Telltale
- **Integrazione Store**: Steam, Epic Games, GOG, Origin, Ubisoft Connect, Battle.net, itch.io
- **Strumenti Professionali**: OCR Translator, Voice Pipeline, Overlay Real-time, Translation Memory
- **7 Lingue UI**: Italiano, English, Español, Français, Deutsch, 日本語, 中文
- **NUOVO v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NUOVO v1.0.6**: Qwen 3 (lingue asiatiche), NLLB-200 (200 lingue), bug fixes

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

## Primo Avvio e Tutorial

### Disclaimer e Termini d'Uso

Al primo avvio, vedrai il **Disclaimer** con i termini d'uso:

- **Responsabilità**: Lo sviluppatore non è responsabile per traduzioni o modifiche
- **Uso a Proprio Rischio**: Fai sempre backup prima di modificare file di gioco
- **Proprietà Intellettuale**: I giochi appartengono ai rispettivi proprietari
- **Qualità Traduzioni**: Le traduzioni automatiche possono contenere errori

Accetta i termini per continuare.

### Tutorial Interattivo

Dopo l'accettazione dei termini, parte il **Tutorial Interattivo** che ti guida attraverso:

1. **Benvenuto** - Introduzione a GameStringer
2. **Sidebar** - Navigazione tra le sezioni
3. **Dashboard** - Panoramica e statistiche
4. **Libreria** - I tuoi giochi da tutti gli store
5. **Traduttore** - Strumenti di traduzione AI
6. **Strumenti** - Patcher, OCR, Fixer e altri tool
7. **Impostazioni** - Configurazione provider e preferenze

Il tutorial evidenzia gli elementi reali dell'interfaccia con uno spotlight viola. Puoi:
- **Spazio/Click** per avanzare
- **Frecce** per navigare
- **Esc** per saltare

---

## Sistema Profili e Recovery Key

### Creazione del Profilo

1. Clicca **"Crea Nuovo Profilo"**
2. Inserisci nome profilo e password
3. **IMPORTANTE**: Salva la tua **Recovery Key** (12 parole)

### Recovery Key 🔐

La Recovery Key è una sequenza di **12 parole** che ti permette di recuperare l'accesso al profilo se dimentichi la password.

**Come funziona:**
- Generata automaticamente alla creazione del profilo
- Basata su dizionario BIP39 (standard crypto)
- Può essere copiata o scaricata come file `.txt`
- Hash SHA-256 salvato localmente (non la chiave stessa)

**Recupero Password:**
1. Clicca **"Password dimenticata?"** nel login
2. Inserisci la tua Recovery Key (12 parole separate da spazio)
3. Se corretta, puoi impostare una nuova password

⚠️ **ATTENZIONE**: Senza la Recovery Key, non c'è modo di recuperare un profilo con password dimenticata!

### Sicurezza Profilo

- I profili sono memorizzati localmente sul tuo computer
- Le password sono hashate con bcrypt (non salvate in chiaro)
- La Recovery Key è hashata con SHA-256
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

## Project Manager

Il **Project Manager** ti permette di organizzare progetti di traduzione completi in un unico posto.

### Creazione Progetto

1. Vai su **Risorse → Gestione Progetti** nel menu laterale
2. Clicca **"Nuovo"** per creare un progetto
3. Compila i dati: nome, descrizione, gioco, lingue sorgente/target
4. Il progetto viene salvato in formato `.gsproj`

### Funzionalità Principali

| Funzione | Descrizione |
|----------|-------------|
| **File** | Aggiungi e gestisci file di traduzione (JSON, PO, CSV, ecc.) |
| **Glossario** | Terminologia consistente per tutto il progetto |
| **Progresso** | Tracciamento traduzioni completate/pending |
| **Statistiche** | Stringhe totali, tradotte, percentuale completamento |

### Gestione Glossario

Il glossario integrato garantisce coerenza terminologica:

- Aggiungi termini tecnici specifici del gioco
- I termini vengono applicati automaticamente nelle traduzioni
- Importa/esporta glossari per riutilizzo

### Export e Backup

- **Salva**: Salva modifiche al progetto corrente
- **Salva come**: Crea una nuova copia del progetto
- **Esporta traduzioni**: Export solo stringhe tradotte

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

## Confidence Heatmap

La **Confidence Heatmap** analizza la qualità delle tue traduzioni con 8 metriche:

### Metriche di Analisi

| Metrica | Descrizione |
|---------|-------------|
| **Length Ratio** | Rapporto lunghezza originale/traduzione |
| **Placeholder Match** | Verifica placeholder `{0}`, `%s`, ecc. |
| **Number Match** | Preservazione numeri |
| **Punctuation Match** | Coerenza punteggiatura |
| **Capitalization** | Coerenza maiuscole/minuscole |
| **Consistency** | Coerenza con traduzioni precedenti |
| **Format Preservation** | Preservazione tag HTML/XML |
| **Emotion Match** | Coerenza tono emotivo |

### Livelli di Confidenza

| Livello | Punteggio | Colore |
|---------|-----------|--------|
| 🔴 **Critico** | <40% | Rosso |
| 🟠 **Basso** | 40-59% | Arancione |
| 🟡 **Medio** | 60-74% | Giallo |
| 🟢 **Alto** | 75-89% | Verde |
| 💚 **Perfetto** | 90-100% | Verde scuro |

### Problemi Rilevati

- `EMPTY_TRANSLATION` - Traduzione vuota
- `IDENTICAL_TRANSLATION` - Traduzione identica all'originale
- `LENGTH_MISMATCH` - Lunghezza troppo diversa
- `MISSING_PLACEHOLDER` - Placeholder mancante
- `MISSING_NUMBER` - Numero mancante
- `MISSING_TAGS` - Tag HTML mancante
- `PUNCTUATION_MISMATCH` - Punteggiatura diversa

---

## Impostazioni e Lingue UI

### Lingue Interfaccia

GameStringer supporta **6 lingue** per l'interfaccia utente:

| Lingua | Codice | Stato |
|--------|--------|-------|
| 🇮🇹 Italiano | `it` | ✅ Completo |
| 🇬🇧 English | `en` | ✅ Completo |
| 🇪🇸 Español | `es` | ✅ Completo |
| 🇫🇷 Français | `fr` | ✅ Completo |
| 🇩🇪 Deutsch | `de` | ✅ Completo |
| 🇨🇳 中文 | `zh` | ✅ Completo |

Per cambiare lingua:
1. Clicca sull'icona bandiera nell'header
2. Seleziona la lingua desiderata
3. L'interfaccia si aggiorna istantaneamente

### Configurazione Provider AI

In **Impostazioni** → **Provider AI**:

- Inserisci API key per ogni provider
- Testa la connessione
- Imposta provider predefinito
- Visualizza costi stimati

### Connessioni Store

In **Impostazioni** → **Store**:

- **Steam**: API Key + Steam ID per libreria completa
- **Epic Games**: Rilevamento automatico
- **GOG**: Rilevamento automatico
- **Altri**: Configurazione manuale

### Preferenze Generali

- **Tema**: Dark (predefinito)
- **Lingua UI**: Selezionabile
- **Notifiche**: Abilita/disabilita
- **Auto-aggiornamento libreria**: All'avvio

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
  <strong>GameStringer v1.0.6</strong><br>
  Fatto con ❤️ per i gamer che vogliono giocare nella propria lingua
</p>
