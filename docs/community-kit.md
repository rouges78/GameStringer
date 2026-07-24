# GameStringer — Community & testing kit

Goal: a community that (1) tests the tool on real games, lots of them, (2) spreads word-of-mouth, (3) contributes (parsers, locales, packs). Tone stays technical and honest.

---

## The flywheel (why testing → word-of-mouth is the same loop)

A tester picks a game → runs GameStringer → publishes the result as a `.gspack` to the Patch Hub (or files a compatibility report) → their reputation grows and the pack is shared → other players discover the tool through the pack → some of them become testers. Every test is also a piece of content and a piece of social proof. The job is to make that loop obvious and low-friction.

Don't spread thin across many chat servers. Keep **one** public hub (the project already follows a "Steam-style, single lobby" model). Recommendation:
- **GitHub Discussions** = public home for testers & contributors (searchable, no real-time moderation needed, indexed by Google).
- **In-app Lobby + forum** = for end users already inside the app.
- **Patch Hub** = the showcase / leaderboard that makes contributions visible.
- Add a Discord/Matrix only if you'll actually be present in it daily — otherwise it becomes a ghost town and hurts more than it helps.

---

## 1. Call for testers & contributors (post for GitHub Discussions / Reddit / in-app pinned)

**Title:** Help test GameStringer across engines — looking for testers and contributors

GameStringer auto-detects a game's engine, extracts the text, translates it (local or cloud AI), and re-applies the patch. It already has dedicated parsers for 12 engines and recognizes over 20, but real games are messy — the most useful thing right now is **coverage testing on real titles**.

You can help in three ways, pick whatever fits:

- **Test a game.** Run GameStringer on something in your library and tell us what happened — engine detected correctly? text extracted? patch applied and game still boots? Use the compatibility template below. Even "it failed at step X" is valuable.
- **Share a pack.** If a translation works, publish it to the Patch Hub so others can use it. That's the fastest way to help players and build your reputation as a translator.
- **Contribute code.** New engine parsers, locale fixes, RSS feed sources, QA scripts — there are good-first-issues labeled in the repo.

It's a solo, source-available project; honest about limits (single-player only, backup before every write). No experience needed to test — just a game and 10 minutes.

Code: https://github.com/rouges78/GameStringer · Site: https://gamestringer.ai

---

## 2. Game compatibility testing program

The core community activity. Make it a single pinned GitHub Discussion ("Compatibility reports") or a GitHub issue template, and keep a public table people can see grow.

**Report template (copy-paste):**

```
### Game compatibility report
- Game:
- Store / version:
- Engine detected (by GameStringer):
- Engine actually (if you know):
- Step reached: [Scan / Detect / Extract / Translate / Patch / Played]
- Result: [✅ works / ⚠️ partial / ❌ fails]
- AI provider used: [Ollama local / OpenAI / Gemini / …]
- Strings (approx) / completion %:
- Notes (what broke, encoding issues, control codes, screenshots):
- OS:
- GameStringer version:
```

**Public compatibility table** (maintain in README or a `COMPATIBILITY.md`, sorted by engine):

| Game | Engine | Result | Tester | Pack | Notes |
|------|--------|--------|--------|------|-------|
| _Example_ | RPG Maker MZ | ✅ | @user | [link] | clean |

This table IS the marketing: "works on N games across M engines, verified by the community."

---

## 3. Contributor on-ramp (turn testers into contributors)

Lower the barrier with labeled work and a 5-line quickstart.

**Good-first-issue ideas to seed in the repo:**
- Add a parser for an engine not yet covered (see `docs/ENGINE-COVERAGE.md` gaps).
- Add/verify a UI locale or fix an existing translation.
- Add a new fan-translation RSS feed source (`lib/news-feeds.ts`).
- Write a QA/validation script for an engine's output.
- Improve the Prediction Tool heuristics for a specific genre.

**CONTRIBUTING quickstart (put in CONTRIBUTING.md):**
1. `npm install`
2. `npm run tauri:dev` (or `npm run dev` for UI only, port 3135)
3. Pick a `good first issue`, open a PR.
4. New engine? Follow the hero-engine pattern: orchestrator in `lib/<engine>-translate.ts` + a branch in `startAutoTranslate()` + a QA script.
5. Commit messages in English.

---

## 4. Recognition & word-of-mouth levers (already in the product — use them)

- **Verified translator badge + reputation** in the Patch Hub — promote it, feature top contributors.
- **Credits / Hall of Fame**: a `CONTRIBUTORS.md` and an in-app/site credits list. People share what they're credited in.
- **"Translated with GameStringer"** line in published packs and a small badge testers can put on their itch/forum posts.
- **Featured pack of the week** on the site and in the Lobby — being featured is a reason to share.
- **Showcase**: collect before/after screenshots of community translations; that's the most shareable content you have.

---

## 5. Lightweight cadence (so it doesn't die)

Pick a rhythm you can actually sustain solo:
- **Weekly:** highlight one community pack + one "engine/game of the week" tested. One short post, cross-linked everywhere.
- **Per release:** a plain changelog post + a "what to test in this version" ask.
- **Monthly:** update the compatibility table count and thank new contributors by name.

This can be semi-automated: a scheduled task can draft the weekly highlight and the "what to test" ask from recent Patch Hub activity and release notes — you just review and post.

---

## Support line (optional, keep it gentle)

GameStringer is free and source-available. It's a solo project and the site + API costs come out of pocket — if it saved you time, a coffee is appreciated but never expected:
https://buymeacoffee.com/gamestringer · https://ko-fi.com/gamestringer · https://github.com/sponsors/rouges78
