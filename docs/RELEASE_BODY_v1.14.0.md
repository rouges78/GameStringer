## 🇮🇹 Italiano

### 🧭 Compatibilità verificata dalla community

- **Telemetria di compatibilità (opt-in)** — il "ProtonDB delle traduzioni": dopo una traduzione puoi segnalare se ha funzionato, e le segnalazioni della community diventano **badge di compatibilità sulle schede gioco**. Con protezioni anti-abuso e una [pagina pubblica delle statistiche](https://gamestringer.ai/compatibilita.html).

### 🔤 Font sempre leggibili

- **Rilevamento glifi mancanti** — GameStringer legge la character map (cmap) dei font del gioco e capisce se mancano i glifi della tua lingua *prima* che tu veda i quadratini.
- **Installazione automatica di un font Noto** adatto per gli engine su file (Ren'Py, RPG Maker), più un fix alla configurazione font di XUnity.AutoTranslator.

### 🛡 Pack verificabili, app più solida

- **Integrità dei pack** — ogni pack della community è verificato con un **SHA-256 aggregato**, protezione anti path-traversal e segnalazione automatica dei pack manomessi.
- **Crash reporting (opt-in)** — report anonimi con firme dei crash ricorrenti, per correggerli più in fretta.
- **Scansione lingue della libreria** — rilevamento più affidabile delle lingue già incluse in un gioco + pulsante manuale "Rileva lingue".

### 💬 Community

- **Il server Discord è attivo!** [discord.gg/SjnD3Z7Uf8](https://discord.gg/SjnD3Z7Uf8) — link nel README, nel sito e nell'app.
- **News feed più pulito** — descrizioni dei diff MediaWiki ripulite e post di offerte/sconti filtrati.

### 🧪 Qualità e fix

- **Suite di regressione dei parser** — corpus condiviso di fixture binarie (Godot, .locres, STX, RPG Maker, CRI CPK, Bethesda) testato sia dai parser Rust che TS: 2 bug reali trovati e corretti.
- `release`: fix del prompt di conferma di `ship` che si bloccava su Windows.
- Nuove chiavi i18n per tutte le funzioni in **12 lingue UI**; documentazione su antivirus/firma del codice e ADR-001.

---

## 🇬🇧 English

### 🧭 Community-verified compatibility

- **Compatibility telemetry (opt-in)** — the "ProtonDB of translations": after translating you can report whether it worked, and community reports become **compatibility badges on game cards**. Ships with abuse guards and a [public stats page](https://gamestringer.ai/compatibilita.html).

### 🔤 Fonts that always render

- **Missing-glyph detection** — GameStringer parses the game font's character map (cmap) and knows your language's glyphs are missing *before* you see tofu squares.
- **Automatic Noto font install** for file-based engines (Ren'Py, RPG Maker), plus a fix to the XUnity.AutoTranslator font configuration.

### 🛡 Verifiable packs, a more solid app

- **Pack integrity** — every community pack is verified with an **aggregated SHA-256**, path-traversal protection and automatic flagging of tampered packs.
- **Crash reporting (opt-in)** — anonymous reports with recurring-crash signatures, so crashes get fixed faster.
- **Library language scan** — more reliable detection of the languages a game already ships + a manual "Detect languages" button.

### 💬 Community

- **The Discord server is live!** [discord.gg/SjnD3Z7Uf8](https://discord.gg/SjnD3Z7Uf8) — linked from the README, the site and the app.
- **Cleaner news feed** — MediaWiki diff descriptions cleaned up and deal/discount posts filtered out.

### 🧪 Quality & fixes

- **Parser regression suite** — shared binary fixture corpus (Godot, .locres, STX, RPG Maker, CRI CPK, Bethesda) exercised by both the Rust and TS parsers: 2 real bugs found and fixed.
- `release`: fixed the `ship` confirm prompt hanging on Windows.
- New i18n keys for every feature across **12 UI languages**; antivirus/code-signing docs and ADR-001.

---

## 📥 Download

| Piattaforma | File |
| --- | --- |
| 🪟 Windows | `GameStringer_1.14.0_x64-setup.exe` (installer), `GameStringer_1.14.0_x64_en-US.msi`, `GameStringer_1.14.0_x64-portable.zip` |
| 🐧 Linux | `GameStringer_1.14.0_amd64.deb`, `GameStringer_1.14.0_amd64.AppImage`, `GameStringer-1.14.0-1.x86_64.rpm` |
| 🍎 macOS | `GameStringer_1.14.0_aarch64.dmg` (Apple Silicon), `GameStringer_1.14.0_x64.dmg` (Intel) |

> ⚠️ **Sei fermo alla v1.8.2 o precedente?** L'auto-updater è bloccato su "Preparazione…" perché dalla v1.9.0 siamo passati a Tauri v2. Scarica l'installer **una volta** a mano: dopo, gli aggiornamenti tornano automatici.
>
> ⚠️ **Still on v1.8.2 or earlier?** The auto-updater is stuck on "Preparing…" because v1.9.0 migrated from Tauri v1 to Tauri v2. Download the installer manually **once** — after that, auto-updates work again.

📖 [Changelog completo](https://github.com/rouges78/GameStringer/blob/main/CHANGELOG.md) · 🌐 [gamestringer.ai](https://gamestringer.ai/) · 📘 [Guida](https://gamestringer.ai/guida.html) · 💬 [Discord](https://discord.gg/SjnD3Z7Uf8)

**Full Changelog**: https://github.com/rouges78/GameStringer/compare/v1.13.0...v1.14.0
