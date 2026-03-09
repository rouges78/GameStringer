# 📋 TODO.md - GameStringer Development Tasks

> Ultimo aggiornamento: 7 Marzo 2026 — v1.4.2

---

## 🚨 TASK ATTIVI & DA FARE

### 🏪 Store Integration

- [ ] **PlayStation Store** — Supporto per giochi PlayStation (se possibile)
- [ ] **Nintendo eShop** — Integrazione per giochi Nintendo (se possibile)
- [ ] **Espandere Database Nomi** — Coprire più giochi popolari per tutti gli store

### 🛠️ Developer Tools & Testing

- [ ] **Automated Testing** — Suite di test automatizzati completa (Rust + Frontend)
- [ ] **Debug Console** — Console di debug integrata per sviluppatori
- [ ] **Plugin System** — Sistema di plugin per estensioni di terze parti

### 🚀 Roadmap — Funzionalità Avanzate

- [ ] **Real-time Collaboration** — Traduzione collaborativa in tempo reale
- [ ] **Cloud Sync** — Sincronizzazione cloud per traduzioni e impostazioni
- [ ] **Mobile Companion** — App mobile per gestione remota

### 📊 Metriche da Raggiungere

- [ ] **<3s Startup Time** — Tempo di avvio sotto 3 secondi
- [ ] **<100MB Memory** — Uso memoria sotto 100MB a riposo
- [ ] **99% Uptime** — Stabilità applicazione 99%
- [ ] **<1s Translation** — Traduzione testi sotto 1 secondo

### 📚 Documentazione

- [ ] **Blocco 4 User Guide** — Prossimo blocco di feature AI da documentare (se presenti)
- [ ] **Tradurre docs tecnici** — `API_REFERENCE.md`, `TROUBLESHOOTING.md`, `ARCHITETTURA.md` in EN

---

## ✅ RECENTEMENTE COMPLETATO (Marzo 2026)

### 🤖 Feature AI Avanzate — Documentazione Completa

Tutte le 11 guide utente (IT, EN, ES, FR, DE, PT, JA, KO, ZH, RU, PL) aggiornate con 12 sezioni AI:

**Blocco 1** — Feature AI Core:

- ✅ Confronto Multi-LLM (3+ provider in parallelo, selezione automatica)
- ✅ Punteggio Qualità Live (Fluency, Accuracy, Consistency, Style)
- ✅ Profili Voce Personaggio (8 preset, personalità, speech patterns)
- ✅ Pipeline Traduzione Vocale (Whisper → Traduzione → TTS)

**Blocco 2** — OCR & Traduzione Avanzata:

- ✅ OCR Multi-Engine (OneOCR, PaddleOCR, RapidOCR, Tesseract + fallback)
- ✅ Retro-Game OCR (preset 8-bit/16-bit/DOS, preprocessing dedicato)
- ✅ Adaptive MT (correzioni umane, few-shot learning, feedback loop)
- ✅ Batch Folder Translator (scansione ricorsiva, multi-formato, TM, QA)

**Blocco 3** — Traduzione Specializzata & Glossario:

- ✅ Traduttore Offline (Ollama, HY-MT 1.5, TranslateGemma, Qwen 3, 14 lingue)
- ✅ Manga/Comic Translator (balloon detection, OCR, inpainting, font matching)
- ✅ Texture Translator (DDS/PNG/TGA, region detection, stile preservato)
- ✅ Auto-Glossario (estrazione LLM, 3 tier, 11 categorie, prompt injection)

### 🧹 Pulizia Progetto (Marzo 2026)

- ✅ **7 docs spostati in archive/** — Report implementazione superati
- ✅ **20 file temporanei eliminati da scripts/** — Fix/debug/inserimento una-tantum
- ✅ **8 file obsoleti eliminati dalla root** — README_OLD, bug report, landing page duplicate, script utility
- ✅ **Script verifica aggiornato** — `scripts/verify-ai-advanced.py` verifica 12 sezioni × 11 guide

### 🚀 Ottimizzazione Performance e Libreria

- **Guard globalThis**: Eliminati doppi fetch causati da React 18 StrictMode.
- **Cache IndexedDB e In-Memory**: Cache con TTL 5-15 min per copertine, date, lingue.
- **Zero HTTP Calls per Scan**: `scan_all_steam_games_fast` solo dati locali, eliminando 1600+ richieste.
- **Deduplicazione Fetch**: Fixati doppi download su SteamGridDB.
- **Internazionalizzazione**: Supporto completo 11 lingue UI.

### 🎮 Store & Supporto

- **Microsoft Store / Xbox Game Pass**: Scanner completo (`xbox.rs`).
- **Epic Games Parser**: Filtro basato su `categories`.
- **Steam Family Sharing**: Integrazione `steam_family_*` via file ACF.
- **GOG Galaxy**: Supporto completo (v1.4.1).

### 🐛 Bug Fix

- **Memory Usage**: List view virtualizzata (`Virtuoso`), fix closure stale.
- **Cache Corruption**: Recovery automatico JSON corrotto.
- **CI/CD**: Fix compilazione Rust cross-platform, stub frontend per cargo check.

---

## 📚 ARCHIVIO SUCCESSI CORE (2025)

*Task fondazionali già stabili.*

- **Architettura Full-Stack**: Tauri v2 + Next.js + Rust bridge.
- **Sistema Injection (Injekt)**: Multi-processo, anti-cheat bypass (7+ sistemi), hook pooling.
- **Motori OCR & ML**: Tesseract/WindowsOCR/EasyOCR, fallback asincroni, ML scoring.
- **Integrazioni API**: Cloudflare/Akamai per immagini, HowLongToBeat, traduzione multilingua.
- **Tooling Rust**: Stabilizzazione compilatore, fix massivi binari Tauri, memory audit.

---

## 🔧 SETUP DEVELOPMENT

### 📋 Prerequisiti

- **Rust Toolchain** — `stable` (via `rustup`)
- **Node.js 18+** — Ambiente Node.js aggiornato
- **Tauri CLI v2** — `cargo install tauri-cli`
- **Git Hooks** — Pre-commit hooks configurati in `.githooks/`

### 🚀 Comandi Utili

```bash
# Sviluppo
npm run tauri:dev          # Avvia app in modalità sviluppo
npm run dev                # Solo frontend (per debug UI)
npm run build:tauri        # Build produzione

# Testing
npm run test               # Test suite completa
npm run test:rust          # Test solo backend Rust
npm run test:frontend      # Test solo frontend

# Verifica documentazione
python scripts/verify-ai-advanced.py  # Verifica 12 sezioni × 11 guide

# Maintenance
npm run lint               # Check codice TS/JS
npm run format             # Formatta codice
cargo update               # Aggiorna dipendenze Rust
cargo clippy               # Linting codice Rust
```

## 📝 NOTE SVILUPPO

### 🎯 Principi Guida

1. **Traduzione First** — Ogni feature deve supportare l'obiettivo principale di traduzione
2. **Performance** — Ottimizzazione continua per responsività
3. **Sicurezza** — Crittografia e protezione dati utente
4. **Usabilità** — UI intuitiva e accessibile

### 🔍 Aree di Attenzione

- **Memory Management** — Monitoraggio continuo uso memoria
- **Cross-Platform** — Compatibilità Windows/Linux/macOS
- **Backward Compatibility** — Supporto versioni precedenti

---

## 📞 CONTATTI SVILUPPO

**Repository**: <https://github.com/rouges78/GameStringer>
**Issues**: Utilizzare GitHub Issues per bug report
**Discussions**: GitHub Discussions per feature request

---

*Questo TODO.md viene aggiornato regolarmente. Controllare sempre la versione più recente.*
