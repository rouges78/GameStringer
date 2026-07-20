// Font installer per engine FILE-BASED — sostituzione automatica dei font.
//
// Completa il font auto-patching (docs/FONT_CHECK.md): per Unity l'override
// passa da XUnity (unity_patcher); qui si coprono Ren'Py e RPG Maker MV/MZ,
// dove il fix è "copia un font Noto a copertura ampia e aggiorna la config".
//
// - Ren'Py: font in game/gamestringer/ + game/zzz_gamestringer_font.rpy che
//   forza il font su style.default e sugli stili che lo fissano esplicitamente
//   (init 999 → gira dopo gui.rpy/screens.rpy). Non tocca file del gioco.
// - RPG Maker MV: font in www/fonts/ + riscrittura di gamefont.css
//   (backup in gamefont.css.gs-font-backup) mantenendo la family "GameFont".
// - RPG Maker MZ: font in fonts/ + data/System.json → advanced.mainFontFilename
//   (backup in System.json.gs-font-backup).
//
// I font (Noto Sans / Noto Sans CJK subset) vengono scaricati una volta sola
// in %LOCALAPPDATA%\GameStringer\fonts con catena di URL di fallback
// (raw.githubusercontent + mirror jsDelivr). Se il download fallisce, il passo
// riporta il file da scaricare a mano e la cartella dove metterlo — la patch
// non si blocca in modo criptico (stesso pattern di ensure_tmp_fonts).

use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

// ═══════════════════════════════════════════════════════════════════
// FONT PACKS — quale Noto serve per quale lingua
// ═══════════════════════════════════════════════════════════════════

pub struct FontPack {
    pub file: &'static str,
    pub urls: &'static [&'static str],
}

/// Font a copertura ampia per la lingua target. None = alfabeto latino di
/// base: i font dei giochi lo coprono quasi sempre, nessuna sostituzione.
pub fn font_pack_for_lang(lang: &str) -> Option<FontPack> {
    let base = lang.split(['-', '_']).next().unwrap_or(lang).to_lowercase();
    match base.as_str() {
        // Cirillico / greco / vietnamita / latin-ext → Noto Sans LGC
        "ru" | "uk" | "be" | "bg" | "sr" | "mk" | "kk" | "el" | "vi" => Some(FontPack {
            file: "NotoSans-Regular.ttf",
            urls: &[
                "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf",
                "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf",
            ],
        }),
        "ja" => Some(FontPack {
            file: "NotoSansJP-Regular.otf",
            urls: &[
                "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf",
                "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf",
            ],
        }),
        "zh" => Some(FontPack {
            file: "NotoSansSC-Regular.otf",
            urls: &[
                "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf",
                "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf",
            ],
        }),
        "ko" => Some(FontPack {
            file: "NotoSansKR-Regular.otf",
            urls: &[
                "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
                "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
            ],
        }),
        "th" => Some(FontPack {
            file: "NotoSansThai-Regular.ttf",
            urls: &[
                "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSansThai/hinted/ttf/NotoSansThai-Regular.ttf",
                "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoSansThai/hinted/ttf/NotoSansThai-Regular.ttf",
            ],
        }),
        "ar" | "fa" | "ur" => Some(FontPack {
            file: "NotoSansArabic-Regular.ttf",
            urls: &[
                "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Regular.ttf",
                "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Regular.ttf",
            ],
        }),
        "he" => Some(FontPack {
            file: "NotoSansHebrew-Regular.ttf",
            urls: &[
                "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSansHebrew/hinted/ttf/NotoSansHebrew-Regular.ttf",
                "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoSansHebrew/hinted/ttf/NotoSansHebrew-Regular.ttf",
            ],
        }),
        _ => None,
    }
}

/// Cache locale dei font scaricati.
fn fonts_cache_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("fonts")
}

/// Un file font plausibile: magic sfnt (TTF/OTF) e dimensione non ridicola
/// (una pagina HTML di errore salvata come .ttf non deve passare).
fn looks_like_font(path: &Path) -> bool {
    match fs::read(path) {
        Ok(bytes) => {
            bytes.len() > 50_000
                && (bytes.starts_with(&[0x00, 0x01, 0x00, 0x00])
                    || bytes.starts_with(b"OTTO")
                    || bytes.starts_with(b"true")
                    || bytes.starts_with(b"ttcf"))
        }
        Err(_) => false,
    }
}

/// Assicura il font in cache: se manca lo scarica provando gli URL in ordine.
async fn ensure_font_cached(pack: &FontPack, steps: &mut Vec<String>) -> Result<PathBuf, String> {
    let cache = fonts_cache_dir();
    let _ = fs::create_dir_all(&cache);
    let target = cache.join(pack.file);

    if looks_like_font(&target) {
        steps.push(format!("✓ Font '{}' già in cache", pack.file));
        return Ok(target);
    }

    for url in pack.urls {
        steps.push(format!("Download {} ...", pack.file));
        match download_font(url, &target).await {
            Ok(_) if looks_like_font(&target) => {
                steps.push(format!("✓ Font '{}' scaricato", pack.file));
                return Ok(target);
            }
            Ok(_) => {
                let _ = fs::remove_file(&target);
                steps.push("⚠ Il file scaricato non sembra un font, provo un mirror...".to_string());
            }
            Err(e) => steps.push(format!("⚠ Download fallito ({}), provo un mirror...", e)),
        }
    }

    Err(format!(
        "Impossibile scaricare '{}'. Scaricalo a mano da Google Noto Fonts e copialo in: {}",
        pack.file,
        cache.to_string_lossy()
    ))
}

async fn download_font(url: &str, dest: &Path) -> Result<(), String> {
    use std::io::Write;
    let client = reqwest::Client::new();
    let mut resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════
// CONTENUTI GENERATI (puri, testabili)
// ═══════════════════════════════════════════════════════════════════

const GS_BACKUP_SUFFIX: &str = ".gs-font-backup";
const RENPY_RPY_NAME: &str = "zzz_gamestringer_font.rpy";
const RENPY_FONT_DIR: &str = "gamestringer";

/// Script Ren'Py che forza il font. init 999 = dopo gui.rpy/screens.rpy;
/// oltre a style.default vengono coperti gli stili che fissano il font
/// esplicitamente dal template GUI (say_label usa gui.name_text_font, ecc.).
pub fn renpy_font_rpy(font_rel_path: &str) -> String {
    format!(
        r#"# GameStringer font fix — glifi mancanti (□□□).
# Generato automaticamente: eliminare questo file (e la cartella gamestringer/)
# per tornare ai font originali del gioco.
init 999 python:
    _gs_font = "{font}"
    for _gs_style_name in ("default", "say_dialogue", "say_label", "say_thought",
                           "button_text", "label_text", "input", "prompt",
                           "choice_button_text", "notify_text"):
        try:
            getattr(style, _gs_style_name).font = _gs_font
        except Exception:
            pass
    try:
        gui.text_font = _gs_font
        gui.name_text_font = _gs_font
        gui.interface_text_font = _gs_font
    except Exception:
        pass
"#,
        font = font_rel_path
    )
}

/// gamefont.css per RPG Maker MV: mantiene la family "GameFont" (quella che
/// il motore usa) puntandola al font sostitutivo.
pub fn mv_gamefont_css(font_file: &str) -> String {
    format!(
        "/* GameStringer font fix — glifi mancanti (□□□).\n   Originale salvato come gamefont.css{} */\n@font-face {{\n    font-family: GameFont;\n    src: url(\"{}\");\n}}\n",
        GS_BACKUP_SUFFIX, font_file
    )
}

/// Aggiorna advanced.mainFontFilename nel System.json di RPG Maker MZ.
/// Ritorna il JSON serializzato, o None se la struttura non è quella attesa.
pub fn mz_patch_system_json(system_json: &str, font_file: &str) -> Option<String> {
    let mut root: serde_json::Value = serde_json::from_str(system_json).ok()?;
    let advanced = root.get_mut("advanced")?.as_object_mut()?;
    advanced.insert(
        "mainFontFilename".to_string(),
        serde_json::Value::String(font_file.to_string()),
    );
    serde_json::to_string(&root).ok()
}

// ═══════════════════════════════════════════════════════════════════
// INSTALL / REMOVE (filesystem, senza rete — testabili con tempdir)
// ═══════════════════════════════════════════════════════════════════

fn backup_once(path: &Path, steps: &mut Vec<String>) -> Result<(), String> {
    let backup = path.with_file_name(format!(
        "{}{}",
        path.file_name().unwrap_or_default().to_string_lossy(),
        GS_BACKUP_SUFFIX
    ));
    if !backup.exists() {
        fs::copy(path, &backup).map_err(|e| format!("Backup fallito: {}", e))?;
        steps.push(format!("✓ Backup: {}", backup.file_name().unwrap_or_default().to_string_lossy()));
    }
    Ok(())
}

/// Installa il font (già presente su disco a `font_path`) nel gioco.
/// `engine`: 'renpy' | 'rpgmaker' (auto-varianti MV/MZ).
pub fn install_font_files(
    game_dir: &Path,
    engine: &str,
    font_path: &Path,
    font_file: &str,
) -> Result<Vec<String>, String> {
    let mut steps = Vec::new();
    let engine_l = engine.to_lowercase();

    if engine_l.contains("ren") {
        // ── Ren'Py ──
        let game_sub = game_dir.join("game");
        if !game_sub.is_dir() {
            return Err("Cartella 'game/' non trovata: non sembra un gioco Ren'Py.".to_string());
        }
        let font_dir = game_sub.join(RENPY_FONT_DIR);
        fs::create_dir_all(&font_dir).map_err(|e| format!("Creazione cartella fallita: {}", e))?;
        fs::copy(font_path, font_dir.join(font_file))
            .map_err(|e| format!("Copia font fallita: {}", e))?;
        steps.push(format!("✓ Font copiato in game/{}/{}", RENPY_FONT_DIR, font_file));

        let rpy_path = game_sub.join(RENPY_RPY_NAME);
        let rel = format!("{}/{}", RENPY_FONT_DIR, font_file);
        fs::write(&rpy_path, renpy_font_rpy(&rel))
            .map_err(|e| format!("Scrittura {} fallita: {}", RENPY_RPY_NAME, e))?;
        // Rimuovi l'eventuale compilato stantio di una versione precedente.
        let _ = fs::remove_file(game_sub.join("zzz_gamestringer_font.rpyc"));
        steps.push(format!("✓ Override font scritto in game/{}", RENPY_RPY_NAME));
        steps.push("Al prossimo avvio Ren'Py ricompila lo script e usa il nuovo font.".to_string());
        return Ok(steps);
    }

    if engine_l.contains("rpg") {
        // ── RPG Maker MV (www/fonts + gamefont.css) ──
        let mv_fonts = game_dir.join("www").join("fonts");
        if mv_fonts.is_dir() {
            fs::copy(font_path, mv_fonts.join(font_file))
                .map_err(|e| format!("Copia font fallita: {}", e))?;
            steps.push(format!("✓ Font copiato in www/fonts/{}", font_file));

            let css_path = mv_fonts.join("gamefont.css");
            if css_path.exists() {
                backup_once(&css_path, &mut steps)?;
            }
            fs::write(&css_path, mv_gamefont_css(font_file))
                .map_err(|e| format!("Scrittura gamefont.css fallita: {}", e))?;
            steps.push("✓ gamefont.css aggiornato (family GameFont → nuovo font)".to_string());
            return Ok(steps);
        }

        // ── RPG Maker MZ (fonts/ + data/System.json advanced.mainFontFilename) ──
        let mz_fonts = game_dir.join("fonts");
        let system_json = game_dir.join("data").join("System.json");
        if mz_fonts.is_dir() && system_json.exists() {
            fs::copy(font_path, mz_fonts.join(font_file))
                .map_err(|e| format!("Copia font fallita: {}", e))?;
            steps.push(format!("✓ Font copiato in fonts/{}", font_file));

            let content = fs::read_to_string(&system_json)
                .map_err(|e| format!("Lettura System.json fallita: {}", e))?;
            match mz_patch_system_json(&content, font_file) {
                Some(patched) => {
                    backup_once(&system_json, &mut steps)?;
                    fs::write(&system_json, patched)
                        .map_err(|e| format!("Scrittura System.json fallita: {}", e))?;
                    steps.push("✓ System.json → advanced.mainFontFilename aggiornato".to_string());
                }
                None => {
                    steps.push(format!(
                        "⚠ System.json senza sezione 'advanced': imposta a mano il font '{}' (o usa un plugin font).",
                        font_file
                    ));
                }
            }
            return Ok(steps);
        }

        return Err(
            "Struttura RPG Maker non riconosciuta: attese www/fonts/ (MV) o fonts/ + data/System.json (MZ)."
                .to_string(),
        );
    }

    Err(format!(
        "Engine '{}' non supportato dalla sostituzione font automatica (supportati: Ren'Py, RPG Maker MV/MZ).",
        engine
    ))
}

/// Ripristina i font originali (backup + rimozione dei file installati).
pub fn remove_font_files(game_dir: &Path, engine: &str) -> Result<Vec<String>, String> {
    let mut steps = Vec::new();
    let engine_l = engine.to_lowercase();

    let restore = |path: &Path, steps: &mut Vec<String>| {
        let backup = path.with_file_name(format!(
            "{}{}",
            path.file_name().unwrap_or_default().to_string_lossy(),
            GS_BACKUP_SUFFIX
        ));
        if backup.exists() {
            if fs::copy(&backup, path).is_ok() {
                let _ = fs::remove_file(&backup);
                steps.push(format!(
                    "✓ Ripristinato {}",
                    path.file_name().unwrap_or_default().to_string_lossy()
                ));
            }
        }
    };

    if engine_l.contains("ren") {
        let game_sub = game_dir.join("game");
        for name in [RENPY_RPY_NAME, "zzz_gamestringer_font.rpyc"] {
            let p = game_sub.join(name);
            if p.exists() && fs::remove_file(&p).is_ok() {
                steps.push(format!("✓ Rimosso game/{}", name));
            }
        }
        let font_dir = game_sub.join(RENPY_FONT_DIR);
        if font_dir.is_dir() && fs::remove_dir_all(&font_dir).is_ok() {
            steps.push(format!("✓ Rimossa game/{}/", RENPY_FONT_DIR));
        }
    } else if engine_l.contains("rpg") {
        restore(&game_dir.join("www").join("fonts").join("gamefont.css"), &mut steps);
        restore(&game_dir.join("data").join("System.json"), &mut steps);
        for fonts_dir in [game_dir.join("www").join("fonts"), game_dir.join("fonts")] {
            if let Ok(rd) = fs::read_dir(&fonts_dir) {
                for e in rd.flatten() {
                    let name = e.file_name().to_string_lossy().to_string();
                    if name.starts_with("NotoSans") && fs::remove_file(e.path()).is_ok() {
                        steps.push(format!("✓ Rimosso {}", name));
                    }
                }
            }
        }
    } else {
        return Err(format!("Engine '{}' non supportato.", engine));
    }

    if steps.is_empty() {
        steps.push("Nessun font GameStringer da rimuovere.".to_string());
    }
    Ok(steps)
}

// ═══════════════════════════════════════════════════════════════════
// COMANDI TAURI
// ═══════════════════════════════════════════════════════════════════

/// Installa automaticamente un font Noto a copertura ampia nel gioco
/// (Ren'Py / RPG Maker MV/MZ) per la lingua target.
#[command(rename_all = "camelCase")]
pub async fn install_game_font(
    game_path: String,
    engine: String,
    target_lang: String,
) -> Result<Vec<String>, String> {
    let game_dir = PathBuf::from(&game_path);
    if !game_dir.exists() {
        return Err(format!("Cartella gioco non trovata: {}", game_path));
    }

    let pack = match font_pack_for_lang(&target_lang) {
        Some(p) => p,
        None => {
            return Ok(vec![format!(
                "La lingua '{}' usa l'alfabeto latino di base: sostituzione font non necessaria.",
                target_lang
            )])
        }
    };

    let mut steps = Vec::new();
    let font_path = ensure_font_cached(&pack, &mut steps).await?;
    let install_steps = install_font_files(&game_dir, &engine, &font_path, pack.file)?;
    steps.extend(install_steps);
    Ok(steps)
}

/// Ripristina i font originali del gioco (annulla install_game_font).
#[command(rename_all = "camelCase")]
pub async fn remove_game_font(game_path: String, engine: String) -> Result<Vec<String>, String> {
    let game_dir = PathBuf::from(&game_path);
    if !game_dir.exists() {
        return Err(format!("Cartella gioco non trovata: {}", game_path));
    }
    remove_font_files(&game_dir, &engine)
}

// ═══════════════════════════════════════════════════════════════════
// TEST (cargo test — girano in CI, nessuna rete)
// ═══════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn font_pack_mapping() {
        assert_eq!(font_pack_for_lang("ru").unwrap().file, "NotoSans-Regular.ttf");
        assert_eq!(font_pack_for_lang("el").unwrap().file, "NotoSans-Regular.ttf");
        assert_eq!(font_pack_for_lang("ja-JP").unwrap().file, "NotoSansJP-Regular.otf");
        assert_eq!(font_pack_for_lang("zh_CN").unwrap().file, "NotoSansSC-Regular.otf");
        assert_eq!(font_pack_for_lang("ko").unwrap().file, "NotoSansKR-Regular.otf");
        assert!(font_pack_for_lang("it").is_none());
        assert!(font_pack_for_lang("en").is_none());
    }

    #[test]
    fn renpy_rpy_contains_override() {
        let rpy = renpy_font_rpy("gamestringer/NotoSans-Regular.ttf");
        assert!(rpy.contains("init 999 python:"));
        assert!(rpy.contains("style.default") || rpy.contains("\"default\""));
        assert!(rpy.contains("gamestringer/NotoSans-Regular.ttf"));
        assert!(rpy.contains("gui.text_font"));
    }

    #[test]
    fn mz_system_json_patch() {
        let src = r#"{"gameTitle":"X","advanced":{"gameId":1,"mainFontFilename":"mplus-1m-regular.woff"}}"#;
        let out = mz_patch_system_json(src, "NotoSansJP-Regular.otf").unwrap();
        assert!(out.contains("\"mainFontFilename\":\"NotoSansJP-Regular.otf\""));
        assert!(out.contains("\"gameId\":1")); // il resto resta intatto
        // Struttura inattesa → None (nessuna scrittura cieca)
        assert!(mz_patch_system_json(r#"{"gameTitle":"X"}"#, "f.ttf").is_none());
        assert!(mz_patch_system_json("not json", "f.ttf").is_none());
    }

    fn fake_font(dir: &Path) -> PathBuf {
        let p = dir.join("NotoSans-Regular.ttf");
        fs::write(&p, b"\x00\x01\x00\x00fakefontdata").unwrap();
        p
    }

    #[test]
    fn renpy_install_and_remove() {
        let tmp = tempfile::tempdir().unwrap();
        let game = tmp.path();
        fs::create_dir_all(game.join("game")).unwrap();
        let font = fake_font(tmp.path());

        let steps = install_font_files(game, "renpy", &font, "NotoSans-Regular.ttf").unwrap();
        assert!(steps.iter().any(|s| s.contains("zzz_gamestringer_font.rpy")));
        assert!(game.join("game/gamestringer/NotoSans-Regular.ttf").exists());
        let rpy = fs::read_to_string(game.join("game").join(RENPY_RPY_NAME)).unwrap();
        assert!(rpy.contains("gamestringer/NotoSans-Regular.ttf"));

        let steps = remove_font_files(game, "renpy").unwrap();
        assert!(steps.iter().any(|s| s.contains("Rimosso")));
        assert!(!game.join("game").join(RENPY_RPY_NAME).exists());
        assert!(!game.join("game/gamestringer").exists());
    }

    #[test]
    fn renpy_requires_game_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let font = fake_font(tmp.path());
        let err = install_font_files(tmp.path(), "renpy", &font, "NotoSans-Regular.ttf").unwrap_err();
        assert!(err.contains("game/"));
    }

    #[test]
    fn rpgmaker_mv_install_and_restore() {
        let tmp = tempfile::tempdir().unwrap();
        let game = tmp.path();
        let fonts = game.join("www/fonts");
        fs::create_dir_all(&fonts).unwrap();
        let original_css = "@font-face { font-family: GameFont; src: url(\"mtlmr3m.ttf\"); }";
        fs::write(fonts.join("gamefont.css"), original_css).unwrap();
        let font = fake_font(tmp.path());

        let steps = install_font_files(game, "rpgmaker", &font, "NotoSans-Regular.ttf").unwrap();
        assert!(steps.iter().any(|s| s.contains("gamefont.css")));
        assert!(fonts.join("NotoSans-Regular.ttf").exists());
        let css = fs::read_to_string(fonts.join("gamefont.css")).unwrap();
        assert!(css.contains("GameFont"));
        assert!(css.contains("NotoSans-Regular.ttf"));
        // Il backup conserva l'originale
        let backup = fs::read_to_string(fonts.join(format!("gamefont.css{}", GS_BACKUP_SUFFIX))).unwrap();
        assert_eq!(backup, original_css);

        // Remove → ripristina l'originale ed elimina il font copiato
        let _ = remove_font_files(game, "rpgmaker").unwrap();
        assert_eq!(fs::read_to_string(fonts.join("gamefont.css")).unwrap(), original_css);
        assert!(!fonts.join("NotoSans-Regular.ttf").exists());
    }

    #[test]
    fn rpgmaker_mz_install_patches_system_json() {
        let tmp = tempfile::tempdir().unwrap();
        let game = tmp.path();
        fs::create_dir_all(game.join("fonts")).unwrap();
        fs::create_dir_all(game.join("data")).unwrap();
        fs::write(
            game.join("data/System.json"),
            r#"{"gameTitle":"MZ Game","advanced":{"gameId":42,"mainFontFilename":"mplus-1m-regular.woff"}}"#,
        )
        .unwrap();
        let font = fake_font(tmp.path());

        let steps = install_font_files(game, "RPG Maker MZ", &font, "NotoSansJP-Regular.otf").unwrap();
        assert!(steps.iter().any(|s| s.contains("System.json")));
        assert!(game.join("fonts/NotoSansJP-Regular.otf").exists());
        let sys = fs::read_to_string(game.join("data/System.json")).unwrap();
        assert!(sys.contains("NotoSansJP-Regular.otf"));
        assert!(game.join("data/System.json.gs-font-backup").exists());
    }

    #[test]
    fn unsupported_engine_errors() {
        let tmp = tempfile::tempdir().unwrap();
        let font = fake_font(tmp.path());
        assert!(install_font_files(tmp.path(), "unreal", &font, "f.ttf").is_err());
    }
}
