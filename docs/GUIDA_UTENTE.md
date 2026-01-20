# 📖 GameStringer - Guida Utente Completa

## Indice

1. [Panoramica](#panoramica)
2. [Primo Avvio e Profili](#primo-avvio-e-profili)
3. [Neural Translator Pro](#neural-translator-pro)
4. [Translation Wizard](#translation-wizard)
5. [Translation Bridge](#translation-bridge)
6. [Esportazione Patch](#esportazione-patch)
7. [Applicazione al Gioco](#applicazione-al-gioco)
8. [Gestione Backup](#gestione-backup)
9. [Editor Traduzioni](#editor-traduzioni)
10. [Activity History](#activity-history)
11. [Dizionari](#dizionari)
12. [Risoluzione Problemi](#risoluzione-problemi)

---

## Panoramica

GameStringer è un sistema avanzato per la traduzione automatica e manuale di videogiochi. Supporta:

- **Motori di gioco**: Unity, Unreal Engine, RPG Maker, Ren'Py e altri
- **Formati file**: CSV, JSON, XML, PO/POT, YAML, TXT e altri
- **Provider AI**: Claude (Anthropic), Gemini (Google), GPT (OpenAI)
- **Lingue**: 20+ lingue supportate
- **Store Gaming**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Rockstar

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

## Unity Patcher

Il Unity Patcher installa automaticamente BepInEx e XUnity.AutoTranslator sui giochi Unity.

### Come Usare

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

## Esportazione Patch

Dopo aver completato una traduzione, puoi esportare un pacchetto pronto per la distribuzione.

### Bottone "Esporta Patch"

Crea un file ZIP sul tuo **Desktop** contenente:

```
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

```
📁 Giochi
├── 📁 Decarnation
│   ├── 📄 dialoghi.csv (897 stringhe)
│   └── 📄 items.csv (123 stringhe)
└── 📁 Altro Gioco
    └── 📄 testi.json (456 stringhe)
```

### Funzionalità

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

```
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

*GameStringer v3.3.0 - Guida aggiornata al 29/12/2025*
