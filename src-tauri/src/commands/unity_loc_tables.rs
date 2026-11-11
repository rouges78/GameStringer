//! Riconoscitore delle tabelle di localizzazione dentro i TextAsset Unity.
//!
//! Un TextAsset è un file di testo qualunque: su art of rally 22 su 23 sono
//! assetti delle auto, classifiche e tabelle di caratteri (vedi
//! docs/METODI-DI-TRADUZIONE.md). Tradurli tutti romperebbe il gioco. Qui si
//! decide, in modo CONSERVATIVO, quali sono tabelle di localizzazione: solo
//! quelli che dichiarano da soli almeno due lingue. Nel dubbio la risposta è
//! «non è una tabella».
//!
//! Guarda sia i file `.assets` sciolti sia i file interni di `data.unity3d`
//! (tramite `unity_fs`).
//!
//! Riconosce:
//! - CSV / TSV la cui intestazione ha almeno due colonne-lingua;
//! - JSON con almeno due chiavi-lingua, al primo livello o nelle voci di un
//!   elenco;
//! - famiglie di file per lingua: almeno due TextAsset dello stesso file con
//!   lo stesso nome e una lingua diversa in coda (`LOST_HOST - Italian`,
//!   `LOST_HOST - French`). Schema trovato su Lost Host Demo l'11/11/2026.
//!
//! NON riconosce (di proposito): testo in una lingua sola, come un JSON di
//! obiettivi. Lì non c'è modo di sapere quali campi sono testo per il
//! giocatore senza conoscere il gioco.

use serde::Serialize;
use std::path::Path;

use super::unity_fs::Bundle;
use super::unity_serialized::{extract_text_assets_from, extract_text_assets_from_path, SerializedTextAsset};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TableFormat {
    Csv,
    Tsv,
    Json,
}

/// Cosa si è capito di un TextAsset riconosciuto come tabella.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Recognized {
    pub format: TableFormat,
    /// Codici lingua trovati ("en", "fr", …): in ordine di colonna per CSV/TSV,
    /// alfabetico per JSON.
    pub languages: Vec<String>,
    /// Righe (CSV) o voci (JSON) di contenuto.
    pub rows: usize,
    /// Per i file per lingua: il nome comune della famiglia ("LOST_HOST").
    /// `None` per le tabelle che hanno più lingue nello stesso file.
    pub family: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocTableInfo {
    /// File `.assets` che contiene il TextAsset.
    pub file: String,
    pub path_id: i64,
    pub name: String,
    #[serde(flatten)]
    pub recognized: Recognized,
}

/// Nome o codice di lingua → codice canonico. Volutamente corta: le lingue in
/// cui i giochi escono davvero. Mancano di proposito i codici che sono anche
/// parole comuni nelle intestazioni (`id`, `no`, `is`, `to`): «name,id,no»
/// non è una tabella indonesiano/norvegese.
fn language_code(cell: &str) -> Option<&'static str> {
    let norm: String = cell
        .trim()
        .trim_start_matches('\u{feff}')
        .trim_matches(|c| c == '"' || c == '\'')
        .trim()
        .to_lowercase()
        .replace('_', "-");
    let table: &[(&str, &[&str])] = &[
        ("en", &["en", "eng", "english", "en-us", "en-gb", "inglese"]),
        ("fr", &["fr", "fra", "fre", "french", "fr-fr", "français", "francais", "francese"]),
        ("de", &["de", "deu", "ger", "german", "de-de", "deutsch", "tedesco"]),
        ("es", &["es", "spa", "spanish", "es-es", "es-mx", "es-419", "español", "espanol", "spagnolo", "latam"]),
        ("it", &["it", "ita", "italian", "it-it", "italiano"]),
        ("pt", &["pt", "por", "portuguese", "pt-br", "pt-pt", "português", "portugues", "brazilian", "portoghese", "brazilian portuguese", "portuguese (brazil)"]),
        ("ru", &["ru", "rus", "russian", "ru-ru", "русский", "russo"]),
        ("ja", &["ja", "jp", "jpn", "japanese", "ja-jp", "日本語", "giapponese"]),
        ("ko", &["ko", "kr", "kor", "korean", "ko-kr", "한국어", "coreano"]),
        ("zh", &["zh", "chi", "zho", "chinese", "zh-cn", "zh-tw", "zh-hans", "zh-hant", "schinese", "tchinese", "简体中文", "繁體中文", "中文", "cinese", "simplified chinese", "traditional chinese"]),
        ("pl", &["pl", "pol", "polish", "pl-pl", "polski", "polacco"]),
        ("tr", &["tr", "tur", "turkish", "tr-tr", "türkçe"]),
        ("nl", &["nl", "nld", "dutch", "nl-nl", "nederlands"]),
        ("uk", &["uk", "ukr", "ukrainian", "uk-ua", "українська"]),
        ("cs", &["cs", "cze", "ces", "czech", "cs-cz", "čeština"]),
        ("hu", &["hu", "hun", "hungarian", "hu-hu", "magyar"]),
        ("sv", &["sv", "swe", "swedish", "sv-se", "svenska"]),
        ("ar", &["ar", "ara", "arabic", "العربية"]),
        ("th", &["th", "tha", "thai", "ไทย"]),
        ("vi", &["vi", "vie", "vietnamese", "tiếng việt"]),
        ("el", &["el", "ell", "gre", "greek", "ελληνικά"]),
        ("lt", &["lt", "lit", "lithuanian", "lietuvių"]),
    ];
    table.iter().find(|(_, names)| names.contains(&norm.as_str())).map(|(code, _)| *code)
}

/// Lingue distinte fra le celle, nell'ordine di comparsa.
fn languages_in<'a>(cells: impl Iterator<Item = &'a str>) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for code in cells.filter_map(language_code) {
        if !found.iter().any(|c| c == code) {
            found.push(code.to_string());
        }
    }
    found
}

/// Divide una riga CSV rispettando le virgolette doppie.
pub(crate) fn split_row(line: &str, delimiter: char) -> Vec<String> {
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' if quoted && chars.peek() == Some(&'"') => {
                current.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            c if c == delimiter && !quoted => cells.push(std::mem::take(&mut current)),
            c => current.push(c),
        }
    }
    cells.push(current);
    cells
}

fn recognize_delimited(content: &str) -> Option<Recognized> {
    let mut lines = content.lines().filter(|l| !l.trim().is_empty());
    let header = lines.next()?;
    // Un'intestazione è una riga corta: una frase lunga con dentro «it» non lo è.
    if header.len() > 2000 {
        return None;
    }
    let (delimiter, format) = [('\t', TableFormat::Tsv), (',', TableFormat::Csv), (';', TableFormat::Csv)]
        .into_iter()
        .max_by_key(|(d, _)| header.matches(*d).count())?;
    let cells = split_row(header, delimiter);
    if cells.len() < 3 {
        // chiave + almeno due lingue
        return None;
    }
    let languages = languages_in(cells.iter().map(String::as_str));
    if languages.len() < 2 {
        return None;
    }
    let rows = lines.count();
    if rows == 0 {
        return None;
    }
    Some(Recognized { format, languages, rows, family: None })
}

fn recognize_json(content: &str) -> Option<Recognized> {
    let value: serde_json::Value = serde_json::from_str(content).ok()?;

    // { "en": {...}, "fr": {...} }
    if let Some(object) = value.as_object() {
        let languages = languages_in(object.keys().map(String::as_str));
        if languages.len() >= 2 {
            let rows = object
                .values()
                .map(|v| v.as_object().map(|o| o.len()).or_else(|| v.as_array().map(|a| a.len())).unwrap_or(1))
                .max()
                .unwrap_or(0);
            return Some(Recognized { format: TableFormat::Json, languages, rows, family: None });
        }
    }

    // [ {"key": "...", "en": "...", "fr": "..."} ]  oppure  { "entries": [ … ] }
    let list = value.as_array().or_else(|| {
        let object = value.as_object()?;
        let mut arrays = object.values().filter_map(|v| v.as_array());
        let first = arrays.next()?;
        // un solo elenco al primo livello, altrimenti non si sa quale guardare
        if arrays.next().is_some() { None } else { Some(first) }
    })?;
    let first = list.first()?.as_object()?;
    let languages = languages_in(first.keys().map(String::as_str));
    if languages.len() < 2 {
        return None;
    }
    // le colonne-lingua devono contenere testo, non numeri o oggetti
    let textual = first
        .iter()
        .filter(|(k, _)| language_code(k).is_some())
        .all(|(_, v)| v.is_string() || v.is_null());
    if !textual {
        return None;
    }
    Some(Recognized { format: TableFormat::Json, languages, rows: list.len(), family: None })
}

/// È una tabella di localizzazione? `None` = no, o non abbastanza sicuro.
pub fn recognize(content: &str) -> Option<Recognized> {
    let trimmed = content.trim_start_matches('\u{feff}').trim_start();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        // Un file che comincia come JSON si giudica solo come JSON: «[body]
        // weight=900» è l'assetto di un'auto, non un CSV.
        return recognize_json(trimmed);
    }
    recognize_delimited(trimmed)
}

/// Il nome di un TextAsset finisce con una lingua? Restituisce il nome comune
/// e il codice: "LOST_HOST - Brazilian Portuguese" → ("LOST_HOST", "pt").
/// Il separatore più lungo si prova per primo, così «Brazilian Portuguese»
/// resta intero invece di spezzarsi sullo spazio.
pub(crate) fn name_language(name: &str) -> Option<(String, &'static str)> {
    [" - ", "_", "-", ".", " "].iter().find_map(|sep| {
        let (stem, suffix) = name.rsplit_once(sep)?;
        let code = language_code(suffix)?;
        let stem = stem.trim();
        (!stem.is_empty()).then(|| (stem.to_string(), code))
    })
}

/// Formato di un file per lingua, dal suo contenuto.
fn member_format(content: &str) -> TableFormat {
    let trimmed = content.trim_start_matches('\u{feff}').trim_start();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        TableFormat::Json
    } else if trimmed.lines().next().is_some_and(|l| l.contains('\t')) {
        TableFormat::Tsv
    } else {
        TableFormat::Csv
    }
}

/// Famiglie di file per lingua fra i TextAsset di UNO stesso file. Una
/// famiglia esiste solo con almeno due lingue diverse: un solo «readme_en» non
/// è localizzazione. Restituisce, per ogni membro, l'indice e cosa si è capito.
fn recognize_families(assets: &[(&str, &str)]) -> Vec<(usize, Recognized)> {
    let named: Vec<(usize, String, &'static str)> = assets
        .iter()
        .enumerate()
        .filter_map(|(i, (name, _))| name_language(name).map(|(stem, code)| (i, stem, code)))
        .collect();

    let mut out = Vec::new();
    for (i, stem, code) in &named {
        let mut languages: Vec<&str> = named.iter().filter(|(_, s, _)| s == stem).map(|(_, _, c)| *c).collect();
        languages.sort_unstable();
        languages.dedup();
        if languages.len() < 2 {
            continue;
        }
        let content = assets[*i].1;
        let rows = content.lines().filter(|l| !l.trim().is_empty()).count();
        if rows == 0 {
            continue;
        }
        out.push((*i, Recognized {
            format: member_format(content),
            languages: vec![code.to_string()],
            rows,
            family: Some(stem.clone()),
        }));
    }
    out
}

/// La cartella `<Gioco>_Data` di un gioco Unity.
pub(crate) fn data_dir(game_dir: &Path) -> Option<std::path::PathBuf> {
    std::fs::read_dir(game_dir)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .find(|p| p.is_dir() && p.file_name().map(|n| n.to_string_lossy().ends_with("_Data")).unwrap_or(false))
}

/// Tutti i TextAsset di un gioco Unity, con il file che li contiene: dai file
/// `.assets` sciolti e dai file interni di `data.unity3d`. Sola lettura.
pub fn text_assets(game_dir: &Path) -> Vec<(String, SerializedTextAsset)> {
    let Some(data) = data_dir(game_dir) else { return Vec::new() };
    let mut found = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&data) {
        for entry in entries.flatten() {
            let file = entry.file_name().to_string_lossy().to_string();
            if !file.ends_with(".assets") {
                continue;
            }
            if let Ok(assets) = extract_text_assets_from_path(&entry.path()) {
                found.extend(assets.into_iter().map(|a| (file.clone(), a)));
            }
        }
    }

    if let Ok(mut bundle) = Bundle::open(&data.join("data.unity3d")) {
        for index in 0..bundle.nodes.len() {
            let path = bundle.nodes[index].path.clone();
            // .resS / .resource sono dati grezzi (texture, audio); GI/ è luce
            // precalcolata. Il testo sta nei file serializzati.
            if path.ends_with(".resS") || path.ends_with(".resource") || path.starts_with("GI/") {
                continue;
            }
            if let Ok(assets) = extract_text_assets_from(&mut bundle.node(index)) {
                let file = format!("data.unity3d/{path}");
                found.extend(assets.into_iter().map(|a| (file.clone(), a)));
            }
        }
    }
    found
}

/// Tabelle di localizzazione di un gioco Unity. Sola lettura.
pub fn scan(game_dir: &Path) -> Vec<LocTableInfo> {
    let assets = text_assets(game_dir);
    let mut tables = Vec::new();

    // 1. tabelle con più lingue nello stesso file
    let mut taken = vec![false; assets.len()];
    for (i, (file, asset)) in assets.iter().enumerate() {
        if let Some(recognized) = recognize(&asset.content) {
            taken[i] = true;
            tables.push(LocTableInfo { file: file.clone(), path_id: asset.path_id, name: asset.name.clone(), recognized });
        }
    }

    // 2. famiglie di file per lingua, cercate dentro ciascun file contenitore
    let mut files: Vec<&str> = assets.iter().map(|(f, _)| f.as_str()).collect();
    files.sort_unstable();
    files.dedup();
    for file in files {
        let members: Vec<usize> = (0..assets.len()).filter(|&i| !taken[i] && assets[i].0 == file).collect();
        let view: Vec<(&str, &str)> = members.iter().map(|&i| (assets[i].1.name.as_str(), assets[i].1.content.as_str())).collect();
        for (local, recognized) in recognize_families(&view) {
            let asset = &assets[members[local]].1;
            tables.push(LocTableInfo { file: file.to_string(), path_id: asset.path_id, name: asset.name.clone(), recognized });
        }
    }
    tables
}

/// Elenca le tabelle di localizzazione di un gioco Unity installato.
#[tauri::command(rename_all = "camelCase")]
pub async fn scan_unity_loc_tables(game_path: String) -> Result<Vec<LocTableInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || scan(Path::new(&game_path)))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn langs(r: &Recognized) -> Vec<&str> {
        r.languages.iter().map(String::as_str).collect()
    }

    #[test]
    fn csv_with_language_columns_is_a_table() {
        let r = recognize("ID,ENGLISH,FRENCH,GERMAN\nmenu.start,Start,Commencer,Starten\nmenu.quit,Quit,Quitter,Beenden\n").unwrap();
        assert_eq!(r.format, TableFormat::Csv);
        assert_eq!(langs(&r), ["en", "fr", "de"]);
        assert_eq!(r.rows, 2);
    }

    #[test]
    fn codes_locales_quotes_semicolons_tabs_and_bom_are_understood() {
        assert_eq!(langs(&recognize("\u{feff}\"key\";\"en-US\";\"pt_BR\";\"zh-CN\"\na;b;c;d\n").unwrap()), ["en", "pt", "zh"]);
        let tsv = recognize("Key\tEnglish\t日本語\nhello\tHello\tこんにちは\n").unwrap();
        assert_eq!(tsv.format, TableFormat::Tsv);
        assert_eq!(langs(&tsv), ["en", "ja"]);
    }

    #[test]
    fn quoted_cells_may_contain_the_delimiter() {
        let r = recognize("id,en,fr\ngreet,\"Hello, you\",\"Salut, toi\"\n").unwrap();
        assert_eq!(r.rows, 1);
        assert_eq!(split_row("a,\"b, \"\"c\"\"\",d", ','), ["a", "b, \"c\"", "d"]);
    }

    #[test]
    fn one_language_is_not_enough() {
        assert_eq!(recognize("ID,ENGLISH\nmenu.start,Start\n"), None);
        assert_eq!(recognize("key,value,en\na,b,c\n"), None);
    }

    #[test]
    fn common_header_words_are_not_languages() {
        // «id» e «no» sono anche codici ISO (indonesiano, norvegese).
        assert_eq!(recognize("name,id,no,is,to\nfoo,1,2,3,4\n"), None);
    }

    #[test]
    fn a_header_without_rows_is_not_a_table() {
        assert_eq!(recognize("id,en,fr\n"), None);
    }

    #[test]
    fn real_non_tables_from_art_of_rally_are_rejected() {
        // Forme prese dai 23 TextAsset di art of rally (11/11/2026).
        let setup = "[body]\nweight=900\nweightRepartition=0.5\ncenterOfMass=(0.0, -0.1, 0.0)\n";
        let leaderboard = r#"{"LeaderboardTimes": [{"name": "Finland_Stage_1_Forward_Dry_60s", "topTime": 123.4}]}"#;
        let achievements = r#"{ "achievements": [ { "label": "platinum", "title": "Rally Legend", "description": "Unlock everything" } ] }"#;
        let readme = "Sample pack of textures for Beautify. Feel free to use them in your projects.";
        let line_breaking = "([｛〔〈《「『【〘〖〝‘“｟«$—…‥〳〴〵\\［（{£¥\"々〇";
        for text in [setup, leaderboard, achievements, readme, line_breaking, "0.0.0.11", ""] {
            assert_eq!(recognize(text), None, "{text}");
        }
    }

    #[test]
    fn json_keyed_by_language_is_a_table() {
        let r = recognize(r#"{ "en": {"start": "Start", "quit": "Quit"}, "it": {"start": "Inizia"} }"#).unwrap();
        assert_eq!(r.format, TableFormat::Json);
        assert_eq!(langs(&r), ["en", "it"]);
        assert_eq!(r.rows, 2);
    }

    #[test]
    fn json_list_with_language_fields_is_a_table() {
        let direct = recognize(r#"[ {"key": "start", "English": "Start", "French": "Commencer"}, {"key": "quit", "English": "Quit", "French": "Quitter"} ]"#).unwrap();
        assert_eq!(langs(&direct), ["en", "fr"]);
        assert_eq!(direct.rows, 2);

        let wrapped = recognize(r#"{ "entries": [ {"id": 1, "en": "Start", "de": "Starten"} ] }"#).unwrap();
        // nel JSON le chiavi arrivano in ordine alfabetico, non di comparsa
        assert_eq!(langs(&wrapped), ["de", "en"]);
    }

    #[test]
    fn json_language_fields_must_hold_text() {
        // «en» e «fr» qui sono punteggi, non testi.
        assert_eq!(recognize(r#"[ {"name": "x", "en": 3, "fr": 4} ]"#), None);
        // due elenchi al primo livello: non si sa quale sia la tabella
        assert_eq!(recognize(r#"{ "a": [ {"en": "x", "fr": "y"} ], "b": [ {"en": "x", "fr": "y"} ] }"#), None);
    }

    #[test]
    fn files_per_language_form_a_family() {
        // Nomi e forma presi da Lost Host Demo (11/11/2026): un CSV per lingua.
        let assets = [
            ("LOST_HOST - English", "Play,Play\nSettings,Settings\n"),
            ("LOST_HOST - Italian", "Play,Gioca\nSettings,Impostazioni\n"),
            ("LOST_HOST - Brazilian Portuguese", "Play,Jogar\n"),
            ("LOST_HOST - Simplified Chinese", "Play,开始游戏\n"),
            // lingua scritta male nel gioco: non riconosciuta, resta fuori
            ("LOST_HOST - Ukranian", "Play,Грати\n"),
            ("BillingMode", "{\"androidStore\":\"GooglePlay\"}"),
        ];
        let found = recognize_families(&assets);
        let codes: Vec<(usize, &str)> = found.iter().map(|(i, r)| (*i, r.languages[0].as_str())).collect();
        assert_eq!(codes, [(0, "en"), (1, "it"), (2, "pt"), (3, "zh")]);
        assert!(found.iter().all(|(_, r)| r.family.as_deref() == Some("LOST_HOST") && r.format == TableFormat::Csv));
        assert_eq!(found[0].1.rows, 2);
    }

    #[test]
    fn one_file_with_a_language_in_its_name_is_not_a_family() {
        assert!(recognize_families(&[("readme_en", "hello"), ("notes", "x")]).is_empty());
        // stessa lingua due volte: sempre una lingua sola
        assert!(recognize_families(&[("menu_en", "a"), ("menu.en", "b")]).is_empty());
        // nomi diversi non fanno famiglia
        assert!(recognize_families(&[("menu_en", "a"), ("credits_fr", "b")]).is_empty());
        // un nome che È una lingua, senza parte comune, non conta
        assert_eq!(name_language("English"), None);
    }

    #[test]
    fn family_names_are_split_on_the_longest_separator() {
        assert_eq!(name_language("LOST_HOST - Brazilian Portuguese"), Some(("LOST_HOST".to_string(), "pt")));
        assert_eq!(name_language("dialogue_fr"), Some(("dialogue".to_string(), "fr")));
        assert_eq!(name_language("strings.ja"), Some(("strings".to_string(), "ja")));
        assert_eq!(name_language("top-times_oldest"), None);
        assert_eq!(name_language("80s_setup"), None);
    }

    #[test]
    fn scan_without_a_data_folder_finds_nothing() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(scan(tmp.path()).is_empty());
    }
}

/// Misura su giochi VERI, in sola lettura: quali TextAsset vengono presi per
/// tabelle. Serve a contare i falsi positivi.
///
/// ```bash
/// cd src-tauri && GS_UNITY_GAME_DIRS="E:/…/artofrally" \
///   cargo test --bin gamestringer real_games_loc_tables -- --ignored --nocapture
/// ```
#[cfg(test)]
mod real_games {
    use super::*;

    #[test]
    #[ignore]
    fn real_games_loc_tables() {
        let dirs = std::env::var("GS_UNITY_GAME_DIRS").expect("GS_UNITY_GAME_DIRS non impostata");
        for dir in dirs.split(';').filter(|d| !d.trim().is_empty()) {
            let started = std::time::Instant::now();
            let assets = text_assets(Path::new(dir));
            let tables = scan(Path::new(dir));
            println!("{dir} | textasset={} | tabelle={} | {} ms (due passate)", assets.len(), tables.len(), started.elapsed().as_millis());
            // GS_UNITY_SHOW=1: elenca i TextAsset (file, nome, byte, inizio del testo).
            if std::env::var("GS_UNITY_SHOW").is_ok() {
                for (file, a) in &assets {
                    let head: String = a.content.chars().take(60).map(|c| if c.is_control() { ' ' } else { c }).collect();
                    println!("    textasset | {file} | {} | {} byte | {head}", a.name, a.content.len());
                }
            }
            for t in &tables {
                println!("    {} | {} | {:?} | lingue={:?} | righe={} | famiglia={:?}", t.file, t.name, t.recognized.format, t.recognized.languages, t.recognized.rows, t.recognized.family);
            }
        }
    }
}
