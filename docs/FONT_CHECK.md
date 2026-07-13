# Font Check — missing glyphs (□□□) detection & fix

> A perfect translation that renders □□□ in-game is still a failure for the
> user. This feature answers "will I see tofu?" BEFORE playing — and fixes it
> with one click on Unity.

## Pieces

| Piece | Where |
|---|---|
| cmap parser (TTF/OTF/TTC, formats 4 & 12) + script coverage | `lib/font-coverage.ts` (pure TS, zero deps) |
| Game folder scanner + engine advice | `lib/font-check.ts` (uses `scan_localization_files` + `read_binary_file_base64`) |
| Unity status / retroactive fix commands | `src-tauri/src/commands/unity_patcher.rs` → `check_game_font_status`, `apply_xunity_font_override` |
| UI card in game detail | `components/game-detail/font-check-card.tsx` |
| i18n | namespace `fontCheck` (25 keys, 12 locales) |
| Tests + real TTF fixtures | `__tests__/engines/font-coverage.test.ts`, `__tests__/fixtures/engines/fonts/` |

## How it works

1. **Coverage engine** — parses the font's `cmap` table (the character→glyph
   map) and checks representative sample sets per writing system (Cyrillic,
   Greek, CJK, hiragana/katakana, hangul, Arabic, Hebrew, Thai, Vietnamese,
   Latin/-ext). `scriptsForLanguage(lang)` maps the target language to the
   scripts it needs; a font is "ok" at ≥95% coverage of every required script.
2. **Game scan** — finds loose `.ttf/.otf/.ttc` files (depth 6, max 12 files)
   and reports per-font, per-script coverage with concrete missing samples.
   Many games embed fonts in compiled assets → verdict `no_fonts_found` with
   engine-specific guidance instead.
3. **Unity fix (one click)** — the XUnity installer already writes font
   overrides for non-Latin languages (issue #46: `OverrideFont`,
   `OverrideFontTextMeshPro`/`FallbackFontTextMeshPro` + the version-matched
   `arialuni_sdf_*` TMP bundle). The new `apply_xunity_font_override` command
   retrofits the same fix onto EXISTING configs (installed before the fix, or
   after a language change): idempotent ini injection (CRLF-safe) +
   `ensure_tmp_fonts` download/copy. `check_game_font_status` powers the
   status display (config found / override present / bundle present).
4. **Other engines** — actionable per-engine advice (Ren'Py `game/` +
   `gui.text_font`, RPG Maker `www/fonts/` + `gamefont.css`, Unreal `_P.pak`
   font mod, Godot theme override).

## Fixtures

`__tests__/fixtures/engines/fonts/` contains real DejaVuSans subsets built
with fonttools: `latin-only.ttf` (must FAIL for ru/el/ja) and
`latin-cyr-el.ttf` (must pass ru/el, fail ja/zh/ko). 15 regression tests.

## Automatic font replacement (file-based engines)

`src-tauri/src/commands/font_installer.rs` → `install_game_font` /
`remove_game_font` (UI: "Install Noto font" in the FontCheckCard for
Ren'Py / RPG Maker games with missing glyphs):

- **Font selection**: `font_pack_for_lang` maps the target language to a
  wide-coverage Noto font — Noto Sans LGC for Cyrillic/Greek/Vietnamese,
  Noto Sans JP/SC/KR subsets for CJK, Thai/Arabic/Hebrew variants. Downloaded
  once to `%LOCALAPPDATA%\GameStringer\fonts` with fallback URL chain
  (raw.githubusercontent → jsDelivr mirror), sfnt-magic + size validation
  (an HTML error page saved as .ttf never gets installed), and an honest
  manual-download message when everything fails.
- **Ren'Py**: font copied to `game/gamestringer/`, override written to
  `game/zzz_gamestringer_font.rpy` (`init 999` → runs after gui.rpy/screens.rpy;
  overrides `style.default` plus the styles that pin fonts explicitly).
  Non-destructive: remove = delete the two items.
- **RPG Maker MV**: font copied to `www/fonts/`, `gamefont.css` rewritten
  keeping the `GameFont` family (original backed up as
  `gamefont.css.gs-font-backup`).
- **RPG Maker MZ**: font copied to `fonts/`, `data/System.json` →
  `advanced.mainFontFilename` updated via serde_json (backup kept; unexpected
  structure → no blind write, manual step reported instead).
- **Restore**: `remove_game_font` restores backups and deletes installed files.
- **Tests**: 7 cargo tests in the module (tempdir-based install/remove/restore
  round-trips, System.json patch, honest errors) + flows validated standalone.

## Next (future)

Unreal composite-font `_P.pak` generation — **assessed and deferred with a
plan**, see [ADR-001](adr/ADR-001-unreal-font-pak.md): unlike file-based
engines, UE requires replacing the game's exact font asset, which needs
`.uasset` serialization + a compressed/UE5 pak reader + a real test game.
Godot theme-override packer.
