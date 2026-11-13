//! Rilevamento lingue supportate da un gioco analizzando i FILE di localizzazione.
//!
//! A differenza di `steam.rs::detect_supported_languages` (database hardcoded +
//! euristiche su nome/publisher), qui ispezioniamo la cartella installata del gioco
//! e deduciamo le lingue da cartelle/file di localizzazione. Funziona offline e per
//! qualsiasi store (Steam, Epic, GOG, manuale), per i principali engine:
//!   - Ren'Py:   game/tl/<lingua>/            (sottocartelle = lingue)
//!   - Unreal:   Content/Localization/<Target>/<culture>/   (+ file .locres)
//!   - Godot:    locale/<lang>.po, *.po, *.translation
//!   - Unity / RPG Maker / GameMaker / altri: euristica generica su token-lingua
//!     dentro cartelle di localizzazione note (localization, locale, lang, i18n, ...).
//!
//! Output: nomi lingua canonici (es. "English", "Japanese", "Simplified Chinese")
//! compatibili con il componente UI `LanguageFlags`.

use std::collections::BTreeSet;
use std::path::Path;

/// Cartelle che indicano un "contesto di localizzazione": al loro interno anche i
/// codici lingua brevi e ambigui (en, it, no, ...) sono accettati senza rischio di
/// falsi positivi.
const LOC_FOLDERS: &[&str] = &[
    "localization",
    "localisation",
    "locale",
    "locales",
    "lang",
    "langs",
    "language",
    "languages",
    "languagedata",
    "i18n",
    "l10n",
    "translation",
    "translations",
    "tl",          // Ren'Py
    "loc",
    "text",        // spesso contiene sottocartelle lingua
];

/// Estensioni di file tipiche di localizzazione (rafforzano la confidenza).
const LOC_EXTS: &[&str] = &["po", "mo", "locres", "loc", "json", "csv", "xliff", "xlf", "resx", "ts", "strings"];

/// Mappa un token (segmento di path o stem di file) a un nome lingua canonico.
/// Ritorna `(nome_canonico, ambiguo)` dove `ambiguo == true` per i codici brevi
/// (2 lettere) che vanno accettati solo dentro un contesto di localizzazione.
fn lang_from_token(token: &str) -> Option<(&'static str, bool)> {
    let t = token.trim().to_ascii_lowercase();
    if t.is_empty() {
        return None;
    }

    // Match diretto su nomi completi e codici distintivi (NON ambigui).
    let direct: Option<&'static str> = match t.as_str() {
        "english" | "eng" => Some("English"),
        "french" | "francais" | "français" | "fra" | "fre" => Some("French"),
        "italian" | "italiano" | "ita" => Some("Italian"),
        "german" | "deutsch" | "ger" | "deu" => Some("German"),
        "spanish" | "espanol" | "español" | "spa" | "latam" | "es-419" | "es_419" => Some("Spanish"),
        "spanish - latin america" | "latinamerican" | "spanishlatinamerica" => {
            Some("Spanish - Latin America")
        }
        "japanese" | "japones" | "jpn" => Some("Japanese"),
        "korean" | "koreana" | "kor" => Some("Korean"),
        "polish" | "polski" | "pol" => Some("Polish"),
        "portuguese" | "portugues" | "português" | "por" => Some("Portuguese"),
        "brazilian" | "brazilianportuguese" | "ptbr" | "pt-br" | "pt_br" | "portuguese - brazil" => {
            Some("Portuguese - Brazil")
        }
        "russian" | "russkij" | "rus" => Some("Russian"),
        "chinese" | "zho" | "chi" => Some("Chinese"),
        "schinese" | "hans" | "zh-hans" | "zh_hans" | "zh-cn" | "zh_cn" | "zhcn"
        | "simplifiedchinese" | "simplified chinese" | "chinese_simplified" => {
            Some("Simplified Chinese")
        }
        "tchinese" | "hant" | "zh-hant" | "zh_hant" | "zh-tw" | "zh_tw" | "zhtw"
        | "traditionalchinese" | "traditional chinese" | "chinese_traditional" => {
            Some("Traditional Chinese")
        }
        "turkish" | "turkce" | "türkçe" | "tur" => Some("Turkish"),
        "ukrainian" | "ukr" => Some("Ukrainian"),
        "dutch" | "nederlands" | "nld" | "dut" => Some("Dutch"),
        "swedish" | "svenska" | "swe" => Some("Swedish"),
        "czech" | "cesky" | "ces" | "cze" => Some("Czech"),
        "hungarian" | "magyar" | "hun" => Some("Hungarian"),
        "romanian" | "romana" | "ron" | "rum" => Some("Romanian"),
        "danish" | "dansk" | "dan" => Some("Danish"),
        "norwegian" | "norsk" | "nor" | "nob" => Some("Norwegian"),
        "finnish" | "suomi" | "fin" => Some("Finnish"),
        "arabic" | "ara" => Some("Arabic"),
        "thai" | "tha" => Some("Thai"),
        "vietnamese" | "tiengviet" | "vie" => Some("Vietnamese"),
        "bulgarian" | "bul" => Some("Bulgarian"),
        "greek" | "ell" | "gre" => Some("Greek"),
        "hebrew" | "heb" => Some("Hebrew"),
        "latvian" | "lav" => Some("Latvian"),
        "lithuanian" | "lit" => Some("Lithuanian"),
        "estonian" | "est" => Some("Estonian"),
        _ => None,
    };
    if let Some(name) = direct {
        return Some((name, false));
    }

    // Codici brevi a 2 lettere: AMBIGUI (es. "it", "no", "is" sono anche parole).
    // Accettati solo dentro un contesto di localizzazione.
    let short: Option<&'static str> = match t.as_str() {
        "en" => Some("English"),
        "fr" => Some("French"),
        "it" => Some("Italian"),
        "de" => Some("German"),
        "es" => Some("Spanish"),
        "ja" | "jp" => Some("Japanese"),
        "ko" | "kr" => Some("Korean"),
        "pl" => Some("Polish"),
        "pt" => Some("Portuguese"),
        "ru" => Some("Russian"),
        "zh" => Some("Chinese"),
        "tr" => Some("Turkish"),
        "uk" | "ua" => Some("Ukrainian"),
        "nl" => Some("Dutch"),
        "sv" | "se" => Some("Swedish"),
        "cs" | "cz" => Some("Czech"),
        "hu" => Some("Hungarian"),
        "ro" => Some("Romanian"),
        "da" | "dk" => Some("Danish"),
        "nb" | "nn" => Some("Norwegian"),
        "fi" => Some("Finnish"),
        "ar" => Some("Arabic"),
        "th" => Some("Thai"),
        "vi" => Some("Vietnamese"),
        "bg" => Some("Bulgarian"),
        "el" => Some("Greek"),
        "he" | "iw" => Some("Hebrew"),
        "lv" => Some("Latvian"),
        "lt" => Some("Lithuanian"),
        "et" => Some("Estonian"),
        _ => None,
    };
    short.map(|name| (name, true))
}

/// Prova a estrarre una lingua da un nome (cartella o stem di file).
/// Tenta: il nome intero, poi i sotto-token separati da `-_. ` (es. "lang_it",
/// "Game_JA", "ui-de"). `in_loc` indica se siamo in contesto di localizzazione.
fn detect_in_name(name: &str, in_loc: bool, out: &mut BTreeSet<String>) {
    // 1) Nome intero
    if let Some((lang, ambiguous)) = lang_from_token(name) {
        if !ambiguous || in_loc {
            out.insert(lang.to_string());
            return;
        }
    }
    // 2) Sotto-token (utile per "lang_it", "Game_JA", "strings-de")
    for part in name.split(|c: char| c == '-' || c == '_' || c == '.' || c == ' ') {
        if part.is_empty() {
            continue;
        }
        if let Some((lang, ambiguous)) = lang_from_token(part) {
            // I codici brevi nei sotto-token li accettiamo solo in contesto loc,
            // i nomi completi sempre.
            if !ambiguous || in_loc {
                out.insert(lang.to_string());
            }
        }
    }
}

/// Walk ricorsivo e BOUNDED della cartella gioco.
fn walk(dir: &Path, depth: usize, in_loc: bool, budget: &mut usize, out: &mut BTreeSet<String>) {
    const MAX_DEPTH: usize = 8;
    if depth > MAX_DEPTH || *budget == 0 {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if *budget == 0 {
            return;
        }
        *budget -= 1;

        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();
        let name_lc = name.to_ascii_lowercase();

        if file_type.is_dir() {
            // `locales/en-US.pak` è l'interfaccia di Chromium che NW.js, Electron
            // e CEF portano con sé in decine di lingue: non sono lingue del gioco.
            if name_lc == "locales" && path.join("en-US.pak").is_file() {
                continue;
            }
            let dir_is_loc = LOC_FOLDERS.contains(&name_lc.as_str());
            let child_in_loc = in_loc || dir_is_loc;

            // Il nome della cartella può essere esso stesso una lingua (es. tl/french,
            // Localization/Game/ja, Japanese/). I codici brevi solo se in contesto.
            detect_in_name(&name, in_loc, out);

            walk(&path, depth + 1, child_in_loc, budget, out);
        } else {
            // File: considera lo stem e, se l'estensione è di localizzazione, dà più
            // fiducia (es. ja.po, de.locres, strings_it.json).
            let stem = Path::new(&name)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| name.clone());
            let ext = Path::new(&name)
                .extension()
                .map(|e| e.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();

            let file_in_loc = in_loc || LOC_EXTS.contains(&ext.as_str());
            detect_in_name(&stem, file_in_loc, out);
        }
    }
}

/// Comando Tauri: rileva le lingue supportate dal gioco installato in `game_path`
/// analizzando i suoi file di localizzazione. Ritorna nomi lingua canonici.
#[tauri::command]
pub async fn detect_languages_from_files(game_path: String) -> Result<Vec<String>, String> {
    if game_path.trim().is_empty() {
        return Err("Percorso gioco vuoto".into());
    }

    let p = Path::new(&game_path);
    // Se è un file (es. eseguibile), parti dalla cartella che lo contiene.
    let root = if p.is_file() {
        p.parent().unwrap_or(p).to_path_buf()
    } else {
        p.to_path_buf()
    };

    if !root.exists() {
        return Err(format!("Percorso non trovato: {}", root.display()));
    }

    let mut out: BTreeSet<String> = BTreeSet::new();
    // Budget: numero massimo di entry da visitare per evitare scan infiniti su
    // installazioni enormi (es. asset di AAA). 60k entry sono più che sufficienti
    // a coprire le cartelle di localizzazione.
    let mut budget: usize = 60_000;
    walk(&root, 0, false, &mut budget, &mut out);

    Ok(out.into_iter().collect::<Vec<String>>())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scan(root: &Path) -> Vec<String> {
        let mut out = BTreeSet::new();
        let mut budget = 1_000;
        walk(root, 0, false, &mut budget, &mut out);
        out.into_iter().collect()
    }

    #[test]
    fn chromium_locales_are_not_game_languages() {
        let dir = tempfile::tempdir().unwrap();
        let locales = dir.path().join("locales");
        std::fs::create_dir(&locales).unwrap();
        for name in ["en-US.pak", "it.pak", "de.pak"] {
            std::fs::write(locales.join(name), b"").unwrap();
        }
        assert!(scan(dir.path()).is_empty());
    }

    #[test]
    fn a_game_locales_folder_still_counts() {
        let dir = tempfile::tempdir().unwrap();
        let locales = dir.path().join("locales");
        std::fs::create_dir(&locales).unwrap();
        std::fs::write(locales.join("it.json"), b"{}").unwrap();
        assert_eq!(scan(dir.path()), vec!["Italian".to_string()]);
    }
}
