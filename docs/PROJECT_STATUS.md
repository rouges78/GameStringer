# Stato del Progetto GameStringer

## Ultimo Aggiornamento: 03/03/2026 - v1.4.2

### PROGETTO v1.4.2 RILASCIATO

**GameStringer**: Suite completa di localizzazione videogiochi con AI. 18+ provider AI, 10+ engine supportati, 200+ lingue, 11 lingue UI.

---

### Nuove Feature v1.4.2

- **Vision LLM Translator**: Traduzione context-aware con screenshot del gioco (Ollama, Gemini, OpenAI)
- **Lore Assistant**: Chat RAG per lore e dialoghi del gioco
- **Auto-Hook Scanner**: Scansione memoria processo con WinAPI
- **System Monitor**: Monitoraggio VRAM/RAM in tempo reale (backend Rust)
- **Ollama Setup Wizard**: Installazione guidata AI locale step-by-step
- **Debug Console**: Console di debug con intercept console integrato
- **Plugin System**: Design doc per architettura plugin
- **GitHub Discussions**: 12 discussioni create, Community Hub con REST API pubblica
- **Fix**: Dynamic imports con ssr:false per prevenire hooks mismatch

### Feature v1.4.1

- **i18n 11 Lingue UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **translations.ts**: +9.056 righe (da 13.472 a 22.528)
- **11 Guide Utente**: Tutte le lingue aggiornate con sezioni v1.1-v1.4
- **CI/CD**: Workflow Linux + Windows fixato e funzionante

### Feature v1.4.0

- **Radix UI Unificato**: 37 file migrati, 27 pacchetti rimossi
- **Quality Badge**: Punteggio qualita per-riga (0-100) nel Traduttore Pro
- **Supporto RTL**: Rilevamento automatico direzione testo
- **Ollama Generico**: Con chain presets fallback

### Feature v1.3.0

- **Danganronpa WAD Patcher v15**: All-Ice base + GameStringer override (35.865 stringhe)
- **WAD Extractor UI**: Editor con ricerca, filtri e traduzione batch AI
- **Export Patch Distribuibile**: ZIP con WAD + install.bat + LEGGIMI.txt

### Feature v1.2.0

- **Fallback Provider**: Traduzione automatica Gemini -> DeepSeek -> OpenAI
- **Audit /api/**: 0 fetch('/api/') attive, tutto compatibile Tauri
- **Danganronpa Filtro Smart**: 18K -> 3K stringhe
- **Test E2E Playwright**: 38 test reali

### Feature v1.1.0

- **Website Multilingua**: 9 lingue con auto-detect browser
- **Danganronpa Auto-Translator**: Traduzione automatica con estrazione PAK nativa
- **Verifica API Key**: Controllo chiavi prima di traduzione
- **Rate Limit Handler**: Retry automatico con delay

### Store Manager - 8 Piattaforme Integrate

- **Steam**: Auto-connessione, API completa, Family Sharing (600+ giochi)
- **Epic Games**: Legendary CLI, credenziali AES-256, auto-detection
- **GOG Galaxy**: API pubblica, scansione locale, credenziali criptate
- **Origin/EA App**: Registro Windows, credenziali AES-256
- **Battle.net**: Giochi Blizzard, credenziali criptate, BattleTag
- **Ubisoft Connect**: Scansione locale, credenziali criptate
- **itch.io**: API pubblica, scansione locale
- **Xbox/Game Pass**: Scansione locale UWP apps

### Provider AI Traduzione (18+)

| Provider | Tipo | Note |
|----------|------|------|
| OpenAI | Cloud | GPT-4o, a pagamento |
| Gemini | Cloud | Free tier generoso |
| DeepSeek | Cloud | Economico |
| DeepL | Cloud | 106 lingue, custom instructions |
| Mistral | Cloud | Mistral Large |
| Groq | Cloud | LLaMA 3.3 70B, veloce |
| Groq GPT-OSS | Cloud | GPT-OSS 120B |
| Cerebras | Cloud | Velocissimo |
| Together AI | Cloud | Open source models |
| Fireworks AI | Cloud | Veloce |
| Cohere | Cloud | Command R+ |
| OpenRouter | Cloud | Multi-model gateway |
| Ollama | Locale | Qualsiasi modello locale |
| TranslateGemma | Locale | Google Translate via Ollama |
| HYMT | Locale | Helsinki-NLP via Ollama |
| Qwen 3 | Locale | Ottimo per CJK |
| NLLB-200 | Cloud | 200 lingue, HuggingFace |
| MyMemory | Gratis | Rate limited |
| Lingva | Gratis | Google Translate mirror |
| Google Translate | Cloud | API v2, a pagamento |
| LibreTranslate | Self-host | Open source |

### Engine Supportati (10+)

- **Unity**: BepInEx + XUnity.AutoTranslator
- **Unreal Engine**: PAK/UTOC/IoStore, UAsset parser nativo
- **Ren'Py**: Parser .rpy nativo
- **RPG Maker**: MV/MZ JSON, VX/XP Ruby
- **Godot**: .tres, .tscn, .cfg, .translation
- **Telltale**: .langdb, .landb, .dlog
- **GameMaker**: data.win
- **Danganronpa**: WAD Patcher v15 con All-Ice base
- **Retro ROM**: NES, SNES, GB, GBA, Genesis, PSX

### Architettura

- **Frontend**: Next.js 15.5.2, TailwindCSS, shadcn/ui, Radix UI
- **Backend**: Tauri v2 (Rust), comandi nativi
- **AI Pipeline**: Multi-step (Harvest -> Translate -> QA -> Fix -> Review -> Score)
- **Adaptive MT**: Few-shot learning da correzioni umane
- **OCR**: 4 engine (OneOCR, PaddleOCR, RapidOCR, Tesseract)
- **Profili**: AES-256-GCM, Recovery Key BIP39, multi-profilo
- **i18n**: 11 lingue UI complete

### Statistiche Codebase

- **700+ giochi** rilevati (Steam + Epic + GOG + altri)
- **22.528 righe** di traduzioni UI
- **11 lingue** UI supportate
- **18+ provider** AI traduzione
- **10+ engine** gioco supportati
- **38 test** E2E Playwright
- **74 file** documentazione

---

Ultimo aggiornamento: 03/03/2026
