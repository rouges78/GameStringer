## 🇮🇹 Italiano

> ℹ️ Questa release include anche le novità della **v1.12.0**, che non è mai stata pubblicata come release su GitHub. Se vieni dalla v1.11.2, qui trovi tutto.

### 🧠 Traduzioni più intelligenti, che si correggono da sole

- **👁️ Contesto visivo (VLM)** — per la traduzione live/a schermo, un modello visivo guarda il frame e traduce col contesto: niente più ambiguità sulle parole isolate ("chest" = forziere o petto?). Modalità OCR+VLM e full-VLM. Provider: Ollama (locale), OpenAI, Gemini.
- **🪞 Traduzioni auto-correttive** — una seconda passata opzionale (scrivi → rifletti → rifinisci) rilegge le righe a rischio su glossario, tono, coerenza e placeholder, e corregge solo quelle che ne hanno davvero bisogno. Selettiva di default, con tetto di costo.
- **🧠 Memoria semantica (RAG)** — Translation Memory e glossario si abbinano **per significato** tramite embedding locali Ollama: una frase già tradotta viene riusata anche se scritta in modo diverso. Indicizzazione lazy, cache vettoriale su IndexedDB, fallback trasparente al matching per parole chiave.
- **🖼️ `downscale_capture` nativo** (Rust image/base64) — ritaglio, ridimensionamento e re-encode JPEG degli screenshot prima della chiamata al VLM. Nessuna nuova dipendenza.

### 🚀 Engine e flusso di lavoro

- **String it! ovunque** — instradamento one-click per Unity, Unreal e Godot, più una nuova pipeline cloud per TyranoScript.
- **Godot 4.4+** — il parser `.pck` legge il formato v3 con directory in coda (verificato su Slay the Spire 2: 15.658 file, localizzazione JSON trovata).
- **Unreal Translator** — marcato come **sperimentale**, con pre-check che verifica che il gioco sia avviato prima di partire (l'injection della DLL richiede il processo attivo).
- **Patch Hub** — un progetto completato si pubblica in un solo passo; il Community Hub ha una nuova panoramica con attività recenti e ultimi pack.
- **Più store** — rilevamento locale di Humble App, Game Jolt e Big Fish Games, verifica via PCGamingWiki se il gioco ha già la tua lingua, e aggiunta manuale di un gioco selezionando la cartella dal disco.

### 🔌 Provider AI

Allowlist ampliata: **DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory** — più motori funzionano subito, senza configurazione.

### 🐛 Fix

- `supabase`: policy INSERT del forum ricreate nell'hardening RLS + bailout controllato del bridge
- `supabase`: deduplicata la migrazione `20260626`
- `ci`: la build della release parte dal branch corrente, non dal tag non ancora creato
- `i18n`: backfill delle chiavi `aiQuality`/`semantic`/`lore` in tutti i locale (locale-integrity)
- Changelog in-app tradotto in tutte e 12 le lingue UI

---

## 🇬🇧 English

> ℹ️ This release also ships everything from **v1.12.0**, which was never published as a GitHub release. Coming from v1.11.2? It's all here.

### 🧠 Smarter translations that fix themselves

- **👁️ Visual context (VLM)** — for live/on-screen translation, a vision model looks at the frame and translates with context, resolving ambiguity on isolated words ("chest" = coffer or body part?). OCR+VLM and full-VLM modes. Providers: Ollama (local), OpenAI, Gemini.
- **🪞 Self-correcting translations** — an optional second pass (write → reflect → refine) reviews risky lines against glossary, tone, consistency and placeholders, and fixes only the ones that actually need it. Selective by default, cost-capped.
- **🧠 Semantic memory (RAG)** — Translation Memory and glossary are matched **by meaning** via local Ollama embeddings: an already-translated sentence gets reused even when worded differently. Lazy indexing, IndexedDB vector cache, fail-open to keyword matching.
- **🖼️ Native `downscale_capture`** (Rust image/base64) — crop, resize and JPEG re-encode screenshots before the VLM call. No new dependencies.

### 🚀 Engines and workflow

- **String it! everywhere** — one-click routing for Unity, Unreal and Godot, plus a new cloud pipeline for TyranoScript.
- **Godot 4.4+** — the `.pck` parser now reads format v3 with directory-at-end (verified on Slay the Spire 2: 15,658 files, JSON localization found).
- **Unreal Translator** — marked **experimental**, with a pre-check that the game is running before it starts (DLL injection needs a live process).
- **Patch Hub** — publish a finished project in one step; the Community Hub gets a new overview with recent activity and latest packs.
- **More stores** — local detection of Humble App, Game Jolt and Big Fish Games, PCGamingWiki lookup to check whether the game already ships your language, and manual game add by picking a folder from disk.

### 🔌 AI providers

Broadened allowlist: **DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory** — more engines work out of the box.

### 🐛 Fixes

- `supabase`: forum INSERT policies recreated in the RLS hardening + graceful bridge bailout
- `supabase`: deduped migration `20260626`
- `ci`: release build runs from the current branch, not the not-yet-created tag
- `i18n`: backfilled `aiQuality`/`semantic`/`lore` keys across all locales (locale-integrity)
- In-app changelog translated across all 12 UI languages

---

## 📥 Download

| Piattaforma | File |
| --- | --- |
| 🪟 Windows | `GameStringer_1.13.0_x64-setup.exe` (installer), `GameStringer_1.13.0_x64_en-US.msi`, `GameStringer_1.13.0_x64-portable.zip` |
| 🐧 Linux | `GameStringer_1.13.0_amd64.deb`, `GameStringer_1.13.0_amd64.AppImage`, `GameStringer-1.13.0-1.x86_64.rpm` |
| 🍎 macOS | `GameStringer_1.13.0_aarch64.dmg` (Apple Silicon), `GameStringer_1.13.0_x64.dmg` (Intel) |

> ⚠️ **Sei fermo alla v1.8.2 o precedente?** L'auto-updater è bloccato su "Preparazione…" perché dalla v1.9.0 siamo passati a Tauri v2. Scarica l'installer **una volta** a mano: dopo, gli aggiornamenti tornano automatici.
>
> ⚠️ **Still on v1.8.2 or earlier?** The auto-updater is stuck on "Preparing…" because v1.9.0 migrated from Tauri v1 to Tauri v2. Download the installer manually **once** — after that, auto-updates work again.

📖 [Changelog completo](https://github.com/rouges78/GameStringer/blob/main/CHANGELOG.md) · 🌐 [gamestringer.ai](https://gamestringer.ai/) · 📘 [Guida](https://gamestringer.ai/guida.html)

**Full Changelog**: https://github.com/rouges78/GameStringer/compare/v1.11.2...v1.13.0
