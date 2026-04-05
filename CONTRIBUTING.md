# Contributing to GameStringer

Thank you for your interest in contributing to **GameStringer**! This project is a community-driven effort to make video games playable in every language, and contributions of all kinds — code, translations, bug reports, documentation, engine research — are genuinely appreciated.

> **TL;DR** — Fork → branch → PR. For anything non-trivial, open an [Issue](https://github.com/rouges78/GameStringer/issues) or [Discussion](https://github.com/rouges78/GameStringer/discussions) first so we can align on the approach before you invest time.

---

## 📑 Table of Contents

- [Ways to Contribute](#-ways-to-contribute)
- [Before You Start](#-before-you-start)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Development Workflow](#-development-workflow)
- [Coding Guidelines](#-coding-guidelines)
- [Testing](#-testing)
- [Commit & PR Conventions](#-commit--pr-conventions)
- [Contributing Translations](#-contributing-translations)
- [Adding a New Game Engine](#-adding-a-new-game-engine)
- [Adding a New AI Provider](#-adding-a-new-ai-provider)
- [Reporting Bugs](#-reporting-bugs)
- [Suggesting Enhancements](#-suggesting-enhancements)
- [Security Issues](#-security-issues)
- [Community & Code of Conduct](#-community--code-of-conduct)
- [License](#-license)

---

## 🤝 Ways to Contribute

You don't have to write Rust or TypeScript to help:

| Type | Examples |
|------|----------|
| **Code** | New engine patchers, AI providers, bug fixes, performance work, P.T. improvements |
| **Translations** | UI localization (11 languages currently), user guides in your language, README translations |
| **Engine research** | Reverse-engineering game file formats, documenting text encoding quirks, finding string tables |
| **Testing** | Report edge cases with specific games, verify releases on different hardware/OS |
| **Documentation** | User guides, tutorials, fixing typos, explaining features in the in-app guide |
| **Community** | Help other users in [Discussions](https://github.com/rouges78/GameStringer/discussions), answer questions in the Community Chat |
| **Translation memories** | Share finished translations via the Community Hub |

---

## 🚦 Before You Start

- **Check existing issues and PRs** to avoid duplicate work.
- **For large changes** (new engine, new tool, refactor, API change) please [open a Discussion](https://github.com/rouges78/GameStringer/discussions) or Issue first to discuss the approach. This saves everyone time.
- **For small fixes** (typos, one-line bugs, obvious improvements) go straight to a PR.
- **Read the** [`LICENSE`](LICENSE) — GameStringer is **Source-Available**, not OSI open source. By contributing, you agree your contributions fall under the same license.
- **Respect the** [anti-cheat warning](README.md#-supported-game-engines): GameStringer is for **single-player / offline** games. Contributions that weaken anti-cheat safeguards or target multiplayer titles will not be merged.

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js 18+** and **npm**
- **Rust 1.70+** (install via [rustup](https://rustup.rs))
- **Git**
- **Windows 10+** or **Linux** (Ubuntu 22.04+, Fedora 38+)
- On Linux also install: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `curl`, `wget`, `file`

### Clone & Install

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
```

### Run in Development

```bash
npm run dev           # Next.js dev server only (fast UI iteration)
npm run tauri:dev     # Full Tauri desktop app (Rust + UI)
```

First `tauri:dev` will compile the Rust backend — expect 5-15 minutes on a fresh machine. Subsequent runs are incremental.

### Build for Production

```bash
npm run tauri:build   # Produces signed installer in src-tauri/target/release/bundle/
```

### Useful Commands

```bash
npm run lint                    # ESLint on the frontend
npm run typecheck               # TypeScript check (no emit)
cd src-tauri && cargo check     # Rust compile check
cd src-tauri && cargo clippy    # Rust linter
cd src-tauri && cargo test      # Rust unit tests
npm test                        # Frontend Jest tests (if any are relevant)
```

> **Tip:** Run `cargo check` before pushing Rust changes. CI runs it on both Linux and Windows and will block your PR if it fails.

---

## 🗂️ Project Structure

```
GameStringer/
├── app/                      # Next.js 15 App Router pages
│   ├── library/              # Game library + Dry Run Scanner
│   ├── prediction-tool/      # P.T. analysis + P.T.Rank (/ranking)
│   ├── translation-wizard/   # "String it!" wizard
│   ├── guide/                # In-app user guide (Quickstart/Tools/Advanced/Shortcuts)
│   ├── batch/                # Batch folder translation
│   ├── community-hub/        # Community memories + GitHub Discussions
│   ├── bethesda-patcher/     # (v1.6.0) Bethesda Engine patcher UI
│   ├── cri-patcher/          # (v1.6.0) CRI Middleware patcher UI
│   ├── unity-localization/   # (v1.6.0) Unity Localization Package pipeline
│   └── settings/             # Providers, API keys, profiles
├── components/               # Shared React components (game-detail-client, main-layout, …)
│   └── ui/                   # shadcn/ui primitives + wizard-stepper
├── lib/                      # Frontend helpers
│   ├── i18n/                 # Translation strings (11 locales)
│   ├── tools-registry.ts     # Registry used by the guide and navigation
│   ├── bethesda-patcher.ts   # (v1.6.0) Bethesda frontend bindings
│   ├── cri-patcher.ts        # (v1.6.0) CRI frontend bindings
│   ├── unity-localization.ts # (v1.6.0) Unity Loc frontend bindings
│   └── po-export.ts          # (v1.6.0) Universal PO (gettext) exporter
├── src-tauri/                # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── main.rs           # Tauri invoke_handler registration
│   │   ├── commands/         # One file per feature area (~100 commands)
│   │   │   ├── prediction_tool.rs     # P.T., P.T.Rank, Dry Run, Workflow Orchestrator
│   │   │   ├── game_update_tracker.rs # Steam buildid + patch integrity
│   │   │   ├── bethesda_patcher.rs    # (v1.6.0) BSA/BA2/ESP parser
│   │   │   ├── cri_patcher.rs         # (v1.6.0) CPK/CRILAYLA/MSG
│   │   │   ├── unity_localization.rs  # (v1.6.0) StringTable/Smart Strings
│   │   │   ├── po_export.rs           # (v1.6.0) Universal .po exporter
│   │   │   └── …
│   │   └── engine_detector.rs         # Auto-detect 20+ engines from folder content
│   └── Cargo.toml
├── ue-translator-dll/        # Unreal Engine native DLL (MinHook)
├── unity-translator-dll/     # Unity native DLL
├── native/                   # Other native helpers
├── docs/                     # User guides (11 languages), VERSIONING, PROJECT_STATUS
│   └── sito/                 # Marketing website
├── scripts/                  # One-shot utilities (version-manager.js, etc.)
├── README.md                 # English master
├── README_{IT,ES,FR,DE,PT,JA,ZH,KO,RU,PL}.md  # Localized READMEs
├── CHANGELOG.md              # Version history
├── CONTRIBUTING.md           # This file
└── LICENSE                   # Source-Available License v1.1
```

---

## 🔁 Development Workflow

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally and add the upstream remote:
   ```bash
   git clone https://github.com/YOUR_USERNAME/GameStringer.git
   cd GameStringer
   git remote add upstream https://github.com/rouges78/GameStringer.git
   ```
3. **Sync with upstream** before starting work:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```
4. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/short-description
   # or: fix/bug-description, docs/topic, i18n/language-code
   ```
5. **Make focused commits** — see [Commit Conventions](#-commit--pr-conventions).
6. **Run local checks** before pushing:
   ```bash
   npm run lint
   npm run typecheck
   cd src-tauri && cargo check && cargo clippy
   ```
7. **Push** and open a Pull Request against `main`.
8. **Respond to review comments** — prefer new commits over force-pushes once the PR is open, unless you need to fix a CI failure in the latest commit.

---

## ✍️ Coding Guidelines

### General

- **Don't over-engineer.** Prefer the simplest code that solves the problem. Three similar lines of code is better than a premature abstraction.
- **Don't add features beyond what the PR's title says.** A bug fix doesn't need a refactor; a feature doesn't need a design-system sweep.
- **Don't add backwards-compatibility shims** for unused code paths. If it's dead, delete it.
- **Trust internal callers.** Validate only at real boundaries (user input, external APIs, file parsing).
- **Only add comments where the logic isn't self-evident.** Don't document trivial code.

### TypeScript / React (frontend)

- Follow the existing style — there is no `.prettierrc`, so match the surrounding file.
- Use functional React components with hooks. No class components.
- Server Components where possible (App Router default), Client Components only when needed (`'use client'`).
- Prefer **shadcn/ui** + **Radix UI** primitives over custom components. Use `components/ui/*`.
- Use **Tailwind CSS** with the existing design tokens. For custom sizes prefer the text-micro / text-2xs / xs / icon-sm utilities introduced in v1.6.0 before reaching for arbitrary values.
- Call the Rust backend via `invoke<T>('command_name', { ... })` from `@tauri-apps/api/core`. Avoid duplicating that import path — check `lib/tauri-api.ts` first.
- i18n strings go in `lib/i18n/locales/<lang>.json`. See [Contributing Translations](#-contributing-translations).

### Rust (backend)

- One file per feature area under `src-tauri/src/commands/`. Keep the `main.rs` `invoke_handler!` macro sorted by area.
- Use `#[tauri::command]` (fully qualified) for Tauri commands — the file style is already consistent.
- Return `Result<T, String>` for commands. Log with `log::info!` / `log::warn!` / `log::error!`, not `println!`.
- Prefer `serde_json::Value` only at the boundary; use typed structs internally with `#[derive(Serialize, Deserialize)]`.
- For new engine parsers: document the file format in a top-of-file comment, add the engine to `engine_detector.rs`, and wire the command in `main.rs`.
- Run `cargo clippy -- -D warnings` before pushing. Fix or explicitly allow each warning.

### Accessibility (v1.6.0 commitment)

- **Every icon button** must have an `aria-label`.
- **Interactive elements** must be focusable and have a visible `focus-visible` state.
- Respect **`prefers-reduced-motion`** for animations.
- Respect **`forced-colors`** for Windows High Contrast Mode.
- Use **semantic HTML**: `<main>`, `<nav>`, `<h1>`-`<h6>`, `CardTitle` for card headings.

---

## 🧪 Testing

### What to test

- **Rust commands**: add unit tests in the same file with `#[cfg(test)] mod tests { ... }`. File parsers especially benefit from test fixtures — small binary samples under `src-tauri/tests/fixtures/`.
- **Engine detection**: if you add or change `engine_detector.rs`, add at least one positive test case.
- **File format parsers** (BSA, BA2, CPK, `.locres`, etc.): include a minimal byte-level test fixture and assert round-trip behavior (parse → modify → serialize → parse again).
- **Frontend**: there is no strict unit-test requirement, but components with complex state (wizard steppers, P.T. report renderers) benefit from Jest/RTL coverage.

### Manual testing checklist

Before opening a PR that touches user-facing features, verify on at least one engine:

- [ ] `npm run tauri:dev` launches without errors
- [ ] Library loads and game detection works
- [ ] P.T. analysis completes for a known game (e.g. a Unity or Unreal title you have installed)
- [ ] Translation wizard ("String it!") runs to completion on a small game
- [ ] No new TypeScript errors (`npm run typecheck`)
- [ ] No new Rust warnings (`cargo clippy`)
- [ ] CI passes: `check-linux` and `check-windows`

---

## 📝 Commit & PR Conventions

### Language

> **All Git/GitHub content must be in English**: commit messages, PR titles, PR bodies, issue comments, release notes. User-facing UI strings and in-app documentation can be in any of the 11 supported languages.

### Commit Messages

Follow a lightweight **Conventional Commits** style:

```
<type>: <short description>

<optional body — what and why, not how>

<optional footer — Co-Authored-By, Fixes #N>
```

**Types used in this repo:**

| Type | Use for |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `docs` | Documentation only |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvements |
| `a11y` | Accessibility improvements |
| `i18n` | Translation additions/updates |
| `chore` | Build, tooling, dependencies, version bumps |
| `ci` | CI/CD workflow changes |
| `test` | Tests only |

**Examples from the history:**

```
feat: Bethesda Engine Patcher — BSA v103-105 + BA2 + ESP parser
fix: prevent console flash on child process spawns (Windows)
a11y: aria-label on icon buttons + text-micro/text-2xs utilities
chore: bump version to v1.6.0 across app, docs, and site
```

### Pull Requests

- **Title**: same format as a commit message (`type: short description`).
- **Body**: include a `## Summary` with 2–5 bullets and a `## Test plan` checklist.
- **Scope**: one logical change per PR. A new engine patcher is one PR; "add engine + refactor wizard + bump deps" is three.
- **Link issues**: use `Fixes #123` / `Closes #123` in the body if the PR closes an issue.
- **Draft PRs are welcome** for early feedback. Mark them ready when green.
- **Keep PRs small.** Reviews get slower and lower-quality as size grows. If a change must be large, explain why in the body and split it into logical commits.
- **CI must be green** before review. Don't ask for review on a red PR unless you're explicitly requesting help.

---

## 🌐 Contributing Translations

GameStringer ships with 11 UI languages. We'd love more.

### Updating Existing Translations

1. Edit the relevant file in `lib/i18n/locales/<lang>.json`.
2. Keep the JSON structure identical to `it.json` or `en.json` (the reference locales).
3. Don't translate technical terms that are brand names: `BepInEx`, `XUnity.AutoTranslator`, `UnrealLocres`, `Tauri`, `Steam`, `P.T.`, `String it!`, `Ollama`, etc.
4. Test in-app: `npm run tauri:dev` → Settings → Language → your locale.

### Adding a New UI Language

1. Create `lib/i18n/locales/<lang>.json` by copying `en.json`.
2. Add the locale to `lib/i18n/index.ts` (`SUPPORTED_LOCALES`, `Locale` type).
3. Create a user guide: copy `docs/USER_GUIDE_EN.md` to `docs/USER_GUIDE_<LANG>.md` and translate it.
4. Create a localized README: copy `README.md` to `README_<LANG>.md` and translate it.
5. Add your language to the README switcher in all existing READMEs.
6. Update `docs/sito/site-i18n.js` with the new locale.
7. Open a PR with type `i18n: add <language> translation`.

### Updating User Guides

The user guides in `docs/USER_GUIDE_*.md` and `docs/GUIDA_UTENTE.md` have a "What's New" section at the bottom for each version. When a new feature ships, add a short description in the `## What's New vX.Y.Z` block.

### Community Translations (not UI)

If you've translated an entire game using GameStringer, share it via the **Community Hub** inside the app — not via PR. The Community Hub uses Supabase and has its own submission flow.

---

## 🎮 Adding a New Game Engine

Adding support for a new engine is one of the most impactful contributions. Here's the typical flow:

1. **Research the format**
   - Document where strings live (loose files? archive? embedded in assets?)
   - Identify the encoding (UTF-8, Shift-JIS, UTF-16, Big5, EUC-KR, custom?)
   - Find existing open-source parsers or reverse-engineered documentation you can reference
2. **Add engine detection**
   - Edit `src-tauri/src/engine_detector.rs`
   - Add a variant to the `GameEngine` enum
   - Add detection logic (signature files, folder structure, magic bytes)
   - Return the new variant from `detect_engine()` when matched
3. **Create the parser module**
   - New file under `src-tauri/src/commands/<engine>_patcher.rs`
   - Public commands: `extract_strings`, `inject_strings`, optionally `backup`/`restore`
   - Use `#[tauri::command]` (not `#[command]` — fully qualified)
   - Return `Result<T, String>` with descriptive errors
4. **Register the commands**
   - Add them to the `invoke_handler![]` macro in `src-tauri/src/main.rs`
5. **Add a frontend wrapper**
   - `lib/<engine>-patcher.ts` — typed wrappers around `invoke()`
6. **Add a UI page**
   - `app/<engine>-patcher/page.tsx` using the shared `components/ui/wizard-stepper.tsx`
7. **Wire into P.T.**
   - Add the engine to the fast-path table in `prediction_tool.rs` so Dry Run and P.T. can analyze it
8. **Test on a real game** — ship only if it works end-to-end on at least one title.
9. **Document it** in the engine table in `README.md` and the user guides.

Check the v1.6.0 additions (`bethesda_patcher.rs`, `cri_patcher.rs`, `unity_localization.rs`) for reference implementations.

---

## 🤖 Adding a New AI Provider

1. **Backend**: add a function in `src-tauri/src/commands/providers/` (or the existing `translation_providers.rs`) that makes the API call and returns `Result<String, String>`.
2. **Frontend**: add the provider to the provider registry used by the Translation Wizard and Settings > Providers.
3. **P.T. time estimates**: add an entry to `prediction_tool.rs` `estimate_llm_times()` — users rely on this to pick a chain.
4. **LLM chains**: add the provider to one or more of the 5 recommended chains (Local / Cloud / Hybrid / Budget / Premium) if appropriate.
5. **Documentation**: add a row to the AI Providers table in `README.md`.
6. **Test** with real credentials (use your own API key during development; never commit keys). Use `dotenv` or Settings.

---

## 🐛 Reporting Bugs

Please use the [Issues](https://github.com/rouges78/GameStringer/issues) page and include:

- **GameStringer version** (Settings → About, or see the footer)
- **OS and version** (Windows 11 23H2, Ubuntu 24.04, etc.)
- **Game affected** (title, store, engine if known)
- **Steps to reproduce** — as specific as possible
- **Expected behavior**
- **Actual behavior**
- **Screenshots or screen recordings** when the bug is visual
- **Logs** — from the app: Settings → Debug Console → Copy logs, or from `%APPDATA%/GameStringer/logs/` (Windows) / `~/.config/GameStringer/logs/` (Linux)
- **Prediction Tool report** if the bug is translation-related (export from `/prediction-tool`)

Please **do not** report bugs you encountered while using GameStringer on online / multiplayer games — those use cases are unsupported by design.

---

## 💡 Suggesting Enhancements

- **Small ideas**: open an Issue with the `enhancement` label.
- **Large ideas** (new major feature, architecture changes): open a [Discussion](https://github.com/rouges78/GameStringer/discussions) under "Ideas" so the community can weigh in before it becomes a formal issue.
- **Explain the use case**, not just the solution. "I want to translate game X which stores text in format Y" is more actionable than "add support for format Y".

---

## 🔒 Security Issues

**Do NOT report security vulnerabilities in public issues.**

If you discover a security issue (RCE, arbitrary file write, credential leak, auth bypass in the Community Hub, etc.), please email the maintainers privately or use [GitHub's private vulnerability reporting](https://github.com/rouges78/GameStringer/security/advisories/new).

Include:
- A clear description of the issue
- Steps to reproduce
- Affected versions
- Suggested remediation if you have one

We'll acknowledge within a few days and coordinate a fix and disclosure timeline with you.

---

## 👥 Community & Code of Conduct

- Be kind, be specific, assume good intent.
- English is the primary language for GitHub interactions (Issues, PRs, commit messages). Italian and other supported languages are welcome in the in-app Community Chat.
- No harassment, no discrimination, no personal attacks. We reserve the right to block repeat offenders.
- Credit others' work. If you port a file format parser from an existing open-source project, **include the credit in your PR and in the file header**, and respect the upstream license.

Join the conversation:

- 💬 **In-app Community Chat** (Supabase Realtime, 4 default rooms + custom)
- 🗣️ **[GitHub Discussions](https://github.com/rouges78/GameStringer/discussions)** — Ideas, Q&A, Show and tell, Announcements
- 🐛 **[GitHub Issues](https://github.com/rouges78/GameStringer/issues)** — bugs and tracked enhancements

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's [**Source-Available License v1.1**](LICENSE).

Summary:
- ✅ Free for personal use
- ✅ Free to inspect, build, and modify for yourself
- ❌ Commercial use requires written permission
- ❌ Redistribution of modified versions requires written permission

If you're unsure whether your intended contribution is compatible with the license, open a [Discussion](https://github.com/rouges78/GameStringer/discussions) and ask before starting the work.

---

<p align="center">
  Thank you for helping make games playable in every language. ❤️<br>
  <strong>— The GameStringer Team</strong>
</p>
