# Antivirus, Windows Defender & SmartScreen — false positives explained

> **TL;DR** — Some antivirus tools occasionally flag GameStringer or the
> modding tools it installs (BepInEx, XUnity.AutoTranslator, gs-hook). These
> are **false positives** caused by how runtime translation works (DLL
> injection — the same technique some malware uses, which is why heuristics
> react). GameStringer is source-available: you can read every line it runs,
> build it yourself, and verify the signed releases. This page explains what
> triggers the warnings, how to verify your download, and how to report the
> false positive so it stops happening for everyone.

---

## Why does it get flagged?

1. **Runtime injection tools.** For Unity games (and the Auto-Hook scanner),
   GameStringer uses **BepInEx + XUnity.AutoTranslator** and its own
   **gs-hook** DLL to insert translated text into a running game. DLL
   injection and process-memory reading are *techniques*, not verdicts — the
   same mechanics are used by mods, overlays (Steam, Discord, RivaTuner) and,
   unfortunately, by malware. Heuristic engines sometimes flag the technique
   without looking at what the code actually does.

2. **New-release reputation.** Microsoft **SmartScreen** builds reputation
   *per file*. Every new GameStringer release is a brand-new binary with zero
   download history, so for the first days after a release you may see
   "Windows protected your PC" even though nothing changed in the code.

3. **Tools downloaded at runtime.** BepInEx, XUnity, UABEA and similar
   components are fetched from their official GitHub releases when you need
   them. They are legitimate, widely-used open-source projects, but they are
   not signed by GameStringer.

**Important:** the file-based patchers (Unreal `.locres`, RPG Maker, Ren'Py,
Bethesda, CRI, Godot, …) do **not** inject anything — they edit game files on
disk, always after creating a backup. Injection is only involved for Unity
runtime translation, the live overlay and the Auto-Hook scanner.

## How to verify your download

- **Download only from [GitHub Releases](https://github.com/rouges78/GameStringer/releases)**
  (or the auto-updater inside the app, which verifies the update signature).
  No other site is authorized to distribute GameStringer.
- **Verify the update signature.** The Tauri auto-updater verifies every
  update against the public key bundled in the app, so updates delivered
  in-app are cryptographically authenticated. (Installer Authenticode
  code-signing is being set up — see
  [DEFENDER_SUBMISSION.md](DEFENDER_SUBMISSION.md) §0 — so for now a fresh
  installer may not carry a Windows "Digital Signatures" tab; that's expected
  and not a sign of tampering when downloaded from the official Releases page.)
- **Scan it yourself** on [VirusTotal](https://www.virustotal.com) — a couple
  of heuristic engines flagging an injector while the major engines are clean
  is the classic false-positive pattern.
- **Audit or build from source.** The full source is public:
  [github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
  — see *Build from Source* in the README.

## If Defender quarantined a file

1. Open **Windows Security → Virus & threat protection → Protection history**.
2. Find the detection (typically the BepInEx folder inside the game, `winhttp.dll`,
   or `gs-hook`), choose **Restore**, and add an **exclusion** for the game's
   folder if it keeps recurring: *Virus & threat protection settings →
   Exclusions → Add folder*.
3. Only do this for files you got through GameStringer or official GitHub
   releases — never for random downloads.

## Help kill the false positive at the source

False positives disappear when enough people report them:

- **Microsoft (Defender / SmartScreen):**
  submit the file as a false positive at
  <https://www.microsoft.com/en-us/wdsi/filesubmission> (choose *Software
  developer* or *Home user* → "I believe this file is safe"). The developer
  submits every release; user submissions raise reputation much faster.
- **Other antivirus vendors** have similar forms (Avast, AVG, Bitdefender,
  Kaspersky, Norton). If yours flags GameStringer, a one-minute report helps
  every other user of that product.

## Antivirus ≠ anti-cheat

This page is about false positives on your PC. **Anti-cheat is different and
is not a false positive**: injecting DLLs into a game protected by EAC,
BattlEye or Vanguard can get your account banned. GameStringer detects
anti-cheat and warns you — **only use runtime translation on single-player /
offline games.** See the warning in the README.

---

*Questions? Open a [Discussion](https://github.com/rouges78/GameStringer/discussions).*

*Maintainer note: the per-release submission runbook lives in
[DEFENDER_SUBMISSION.md](DEFENDER_SUBMISSION.md) (`npm run av:checklist`).*
