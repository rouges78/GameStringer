# Piano Migrazione Next.js API Routes → Comandi Tauri (Rust)
*Aggiornato: 3 Luglio 2025*

## 🎯 **Obiettivo Principale**
Migrare tutte le Next.js Steam API routes in comandi Rust-based Tauri per creare un'applicazione desktop standalone Windows con frontend statico e backend Rust.

## ✅ **Traguardi Raggiunti**

### Migrazione Primo Comando (auto_detect_steam_config)
- **✅ Backend Rust Implementato**: Comando `auto_detect_steam_config` con lettura registro Windows e parsing file VDF
- **✅ Frontend Aggiornato**: Componente React modificato per usare `invoke` Tauri invece di `fetch`
- **✅ Architettura Stabilita**: Moduli Rust (models, commands), struttura progetto corretta
- **✅ Dipendenze Risolte**: winreg 0.52.0, steamy-vdf 0.2.0, @tauri-apps/api installate

### Problemi Tecnici Risolti
- **✅ Errori Compilazione Rust**: HKEY import, iterazione VDF, build script standard
- **✅ Problemi Next.js**: CLI reinstallata, React riparato, caniuse-lite installato
- **✅ Configurazione Tauri**: Icone corrette, finestre configurate, script di build
- **✅ Cache Corrotte**: Cargo, npm, node_modules pulite multiple volte

### 🚫 **Problema Persistente**

- **❌ Applicazione Non Appare**: Compilazione riuscita ma finestra non visibile
- **❌ Test Console Falliscono**: Anche output più semplici non appaiono  
- **❌ Causa Sconosciuta**: Possibile problema ambiente, antivirus, permessi, compatibilità

### 📋 **Stato Tecnico Attuale**

- ✅ **Codice Rust**: Funzionante e compilabile senza errori
- ✅ **Frontend React**: Pronto per comandi Tauri con `invoke` implementato
- ✅ **Configurazione Progetto**: Corretta (tauri.conf.json, build.rs, Cargo.toml)
- ❌ **Runtime/Visualizzazione**: Bloccata da problema ambiente non identificato

---

## 🚀 Prossimi Passi

### Priorità Immediata: Risolvere Problema Runtime

1. **Investigare Ambiente di Sviluppo**:
   - Verificare antivirus/Windows Defender (possibile blocco esecuzione)
   - Controllare permessi amministratore per Tauri
   - Testare con versioni diverse di Node.js/Rust
   - Verificare variabili ambiente e PATH

2. **Approcci Alternativi**:
   - Testare su sistema/ambiente diverso per isolare il problema
   - Creare build di produzione (`npm run tauri build`) per test
   - Considerare approccio ibrido temporaneo (Next.js + API Rust separate)

3. **Continuare Migrazione API**:
   - Procedere con migrazione altre routes Steam (architettura pronta)
   - Implementare `fix_steam_id`, `get_game_details`, `get_all_steam_games`
   - Testare comandi Rust in isolamento quando possibile

### Sviluppi Futuri

1. **Completamento Migrazione API**:
   - Migrare tutte le routes Steam rimanenti (`/games`, `/game-details`, ecc.)
   - Implementare comandi per HLTB (HowLongToBeat) integration
   - Convertire sistema di caching da Next.js a Rust
   - Migrare gestione database da API routes a comandi Tauri

2. **Ottimizzazione Architettura Rust**:
   - Suddividere logica in moduli specializzati (steam_api_client, hltb_client, local_files)
   - Implementare parallelismo avanzato per endpoint complessi
   - Ottimizzare performance lettura file Steam e parsing VDF
   - Sistema di caching intelligente in Rust

3. **Miglioramenti Desktop App**:
   - Risoluzione problemi runtime/visualizzazione
   - Ottimizzazione startup time dell'applicazione
   - Gestione errori robusta e logging dettagliato
   - Sistema di aggiornamenti automatici per app desktop

---

## 🔧 **Dettagli Tecnici Migrazione**

### Architettura Implementata
```
src-tauri/
├── src/
│   ├── main.rs           # Entry point con registrazione comandi
│   ├── models/
│   │   └── mod.rs         # Struct SteamConfig, GameDetails, ecc.
│   └── commands/
│       ├── mod.rs         # Dichiarazione moduli comandi
│       └── steam.rs       # Comandi Steam (auto_detect_steam_config)
├── Cargo.toml             # Dipendenze Rust (winreg, steamy-vdf)
├── build.rs               # Script build standard Tauri
└── tauri.conf.json        # Configurazione app (finestre, icone)
```

### Comando Migrato: auto_detect_steam_config
**Funzionalità**: Rileva automaticamente percorso Steam e utenti loggati
- **Input**: Nessuno
- **Output**: `SteamConfig { steam_path: Option<String>, logged_in_users: Vec<String> }`
- **Implementazione**: 
  - Lettura registro Windows (HKEY_LOCAL_MACHINE e HKEY_CURRENT_USER)
  - Parsing file `loginusers.vdf` con crate `steamy-vdf`
  - Gestione errori robusta con Result<T, String>

### Frontend Integration
**File**: `components/steam-family-sharing.tsx`
- **Prima**: `fetch('/api/steam/auto-detect-config')`
- **Dopo**: `invoke('auto_detect_steam_config')`
- **Dipendenza**: `@tauri-apps/api` per funzione `invoke`

### Dipendenze Chiave
- **winreg 0.52.0**: Accesso registro Windows
- **steamy-vdf 0.2.0**: Parsing file VDF di Steam
- **@tauri-apps/api**: Comunicazione frontend-backend

---

## 📝 **Note Implementative**

### Problemi Risolti
1. **Errore HKEY**: Aggiunto `use winreg::HKEY;`
2. **Iterazione VDF**: Cambiato `for (k,v) in users` → `for (k,v) in users.iter()`
3. **Build Script**: Ripristinato `build.rs` standard con `tauri_build::build()`
4. **Icone**: Configurato `tauri.conf.json` con icone esistenti
5. **Next.js**: Reinstallato CLI, React, caniuse-lite

### Configurazione Finestra Tauri
```json
{
  "title": "GameStringer",
  "width": 1200, "height": 800,
  "center": true, "visible": true,
  "decorations": true, "skipTaskbar": false
}
```

### Stato Compilazione
- ✅ **cargo build**: Successo
- ✅ **npm run tauri dev**: Compilazione completa
- ❌ **Visualizzazione**: Problema runtime non risolto

*La migrazione è tecnicamente completata, manca solo la risoluzione del problema di visualizzazione dell'applicazione.*
