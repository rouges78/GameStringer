## 🇮🇹 Italiano

### 🎛 Parametri di inferenza Ollama

- **Pannello parametri** (`/ollama-manager/advanced`) — preset **Fedele / Bilanciato / Creativo** più una **modalità esperto** con `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` e `seed`. Vale per Ollama locale, **reflection inclusa**, e chiude il **404** del pulsante "Funzioni avanzate".

### 🔗 Progetti ↔ Patch Hub

- **Import `.gspack`** — importare un pacchetto registra un **progetto completato** e salva il file tradotto.
- **Pubblica precompilato** dal progetto, con il **file tradotto reale** allegato alla pubblicazione; toggle **Esplora / Le mie patch**.
- **Applica al gioco** — nuova azione con scelta della cartella e **backup `.bak` automatico**.

### 💬 Feedback in-app

- **Widget di feedback** (Impostazioni → Community) — categoria + messaggio con **contesto automatico** (versione, piattaforma, schermata, gioco). Invio **fail-open** con fallback copia/email.

### ⚡ Patch Hub più veloce

- **Caching client-side** (TTL 60s) e **throttle delle scritture**; **migration di rate-limiting** lato server preparata.

### 🧪 Qualità e fix

- Fix: i **feed RSS** non generano più errori **CORS** nella webview desktop.
- **Audit accessibilità WCAG 2.1 AA** documentato.
- **Dipendenze**: aggiornato **rand 0.8 → 0.9** (adattato alla nuova API: `rng()`, `random()`, `OsRng` ora `TryRngCore`, `IndexedRandom`) — suite di test Rust tutta verde.
- Changelog in-app v1.15.0 in **12 lingue UI**.

---

## 🇬🇧 English

### 🎛 Ollama inference parameters

- **Parameters panel** (`/ollama-manager/advanced`) — **Faithful / Balanced / Creative** presets plus an **expert mode** with `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` and `seed`. Applies to local Ollama, **reflection included**, and closes the **404** on the "Advanced Functions" button.

### 🔗 Projects ↔ Patch Hub

- **`.gspack` import** — importing a pack registers a **completed project** and saves the translated file.
- **Publish pre-filled** from a project, with the **real translated file** attached to the publication; **Explore / My patches** toggle.
- **Apply to game** — new action with a folder picker and **automatic `.bak` backup**.

### 💬 In-app feedback

- **Feedback widget** (Settings → Community) — category + message with **automatic context** (version, platform, screen, game). **Fail-open** send with copy/email fallback.

### ⚡ Faster Patch Hub

- **Client-side caching** (60s TTL) and **write throttling**; server-side **rate-limiting migration** prepared.

### 🧪 Quality & fixes

- Fix: **RSS feeds** no longer trigger **CORS** errors in the desktop webview.
- Documented **WCAG 2.1 AA accessibility audit**.
- **Dependencies**: upgraded **rand 0.8 → 0.9**, adapting to its new API (`rng()`, `random()`, `OsRng` is now `TryRngCore`, `IndexedRandom`) — full Rust test suite green.
- In-app v1.15.0 changelog across **12 UI languages**.

---

## 📥 Download

| Piattaforma | File |
| --- | --- |
| 🪟 Windows | `GameStringer_1.15.0_x64-setup.exe` (installer), `GameStringer_1.15.0_x64_en-US.msi`, `GameStringer_1.15.0_x64-portable.zip` |
| 🐧 Linux | `GameStringer_1.15.0_amd64.deb`, `GameStringer_1.15.0_amd64.AppImage`, `GameStringer-1.15.0-1.x86_64.rpm` |
| 🍎 macOS | `GameStringer_1.15.0_aarch64.dmg` (Apple Silicon), `GameStringer_1.15.0_x64.dmg` (Intel) |

> ⚠️ **Sei fermo alla v1.8.2 o precedente?** L'auto-updater è bloccato su "Preparazione…" perché dalla v1.9.0 siamo passati a Tauri v2. Scarica l'installer **una volta** a mano: dopo, gli aggiornamenti tornano automatici.
>
> ⚠️ **Still on v1.8.2 or earlier?** The auto-updater is stuck on "Preparing…" because v1.9.0 migrated from Tauri v1 to Tauri v2. Download the installer manually **once** — after that, auto-updates work again.

📖 [Changelog completo](https://github.com/rouges78/GameStringer/blob/main/CHANGELOG.md) · 🌐 [gamestringer.ai](https://gamestringer.ai/) · 📘 [Guida](https://gamestringer.ai/guida.html) · 💬 [Discord](https://discord.gg/SjnD3Z7Uf8)

**Full Changelog**: https://github.com/rouges78/GameStringer/compare/v1.14.0...v1.15.0
