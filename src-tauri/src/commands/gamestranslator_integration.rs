//! GameTranslator.it Integration
//!
//! Cerca traduzioni italiane su gamestranslator.it tramite scraping HTML dell'IPS forum.
//! Download → apre il browser di sistema (utente già loggato).
//! Installazione → file picker + estrazione ZIP nel percorso corretto.

use tauri::command;
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Cursor;
use reqwest::Client;
use regex::Regex;
use serde::{Deserialize, Serialize};
use zip::ZipArchive;

const BASE_URL: &str = "https://www.gamestranslator.it";
const SEARCH_URL: &str = "https://www.gamestranslator.it/index.php?/search/&q={QUERY}&type=downloads_file&search_and_or=and";
// Fallback: lista download filtrabile
const DOWNLOADS_URL: &str = "https://www.gamestranslator.it/index.php?/files/&q={QUERY}";

// ──────────────────────────────────────────────────────────────────────────────
// Tipi
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityTranslation {
    pub id: String,
    pub title: String,
    pub author: String,
    pub state: String,         // "100%", "90%", "demo", ecc.
    pub revision: String,      // "completa", "in corso", ""
    pub version: String,
    pub steam_app_id: Option<String>,
    pub page_url: String,
    pub download_url: String,
    pub updated_at: String,
}

fn make_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 GameStringer/1.4")
        .build()
        .map_err(|e| e.to_string())
}

// ──────────────────────────────────────────────────────────────────────────────
// Parsing HTML
// ──────────────────────────────────────────────────────────────────────────────

/// Estrae le traduzioni trovate dall'HTML della pagina di ricerca IPS
fn parse_search_results(html: &str) -> Vec<CommunityTranslation> {
    let mut results = Vec::new();

    // Pattern per estrarre blocchi file dalla search results di IPS
    // Link file: href="/index.php?/file/1052-crisol-theater-of-idols-full/"
    let file_link_re = Regex::new(
        r#"href="(/index\.php\?/file/(\d+)-([^/"]+)/)"[^>]*>([^<]{3,120})</a>"#
    ).unwrap();

    // Steam app ID nel testo: store.steampowered.com/app/1234567/
    let steam_id_re = Regex::new(r"store\.steampowered\.com/app/(\d+)").unwrap();

    // Stato traduzione: "100%", "90%", "demo"
    let state_re = Regex::new(r"(?i)stato[^\d]*(\d{1,3}%|demo|parziale|completa)").unwrap();

    // Revisione
    let rev_re = Regex::new(r"(?i)revisione[:\s]*([^\n,<]{2,30})").unwrap();

    // Autore: "Autore: NomeAutore" o "by NomeAutore"
    let author_re = Regex::new(r"(?i)autore[:\s]+([^\n,<]{2,40})").unwrap();

    // Versione: "v1.30", "1.30", "v20251219"
    let version_re = Regex::new(r"\bv?(\d{1,4}[\.\-]\d{1,4}[\.\-]?\d{0,4}|\d{8})\b").unwrap();

    for cap in file_link_re.captures_iter(html) {
        let relative_path = cap[1].to_string();
        let file_id = cap[2].to_string();
        let title = cap[4].trim().to_string();

        if title.len() < 3 { continue; }

        let page_url = format!("{}{}", BASE_URL, relative_path);
        let download_url = format!(
            "{}/index.php?/files/file/{}-{}/&do=download",
            BASE_URL, file_id, &cap[3]
        );

        // Cerca nel contesto circostante (±500 chars) per metadata
        let pos = html.find(&relative_path).unwrap_or(0);
        let start = pos.saturating_sub(200);
        let end = (pos + 500).min(html.len());
        let context = &html[start..end];

        let steam_app_id = steam_id_re
            .captures(context)
            .map(|c| c[1].to_string());

        let state = state_re
            .captures(context)
            .map(|c| c[1].trim().to_string())
            .unwrap_or_default();

        let revision = rev_re
            .captures(context)
            .map(|c| c[1].trim().to_string())
            .unwrap_or_default();

        let author = author_re
            .captures(context)
            .map(|c| c[1].trim().to_string())
            .unwrap_or_default();

        let version = version_re
            .captures(&title)
            .map(|c| c[1].to_string())
            .unwrap_or_default();

        results.push(CommunityTranslation {
            id: file_id,
            title,
            author,
            state,
            revision,
            version,
            steam_app_id,
            page_url,
            download_url,
            updated_at: String::new(),
        });
    }

    results
}

/// Scrapes la pagina del file per ottenere metadata completi
fn parse_file_page(html: &str, base: CommunityTranslation) -> CommunityTranslation {
    let steam_id_re = Regex::new(r"store\.steampowered\.com/app/(\d+)").unwrap();
    let state_re = Regex::new(r"(?i)stato[^\d]*(\d{1,3}%|demo|parziale|completa)").unwrap();
    let rev_re = Regex::new(r"(?i)revisione[:\s]*([^\n,<]{2,30})").unwrap();
    let author_re = Regex::new(r"(?i)autore[:\s]+([^\n,<]{2,40})").unwrap();
    // Data modifica: "Marzo 5, 2026 alle 07:19" o simile
    let date_re = Regex::new(r"(?i)(Rilasciata|Modificato)\s+([A-Za-z]+\s+\d+,\s+\d{4})").unwrap();

    CommunityTranslation {
        steam_app_id: steam_id_re.captures(html).map(|c| c[1].to_string()).or(base.steam_app_id),
        state: state_re.captures(html).map(|c| c[1].trim().to_string()).unwrap_or(base.state),
        revision: rev_re.captures(html).map(|c| c[1].trim().to_string()).unwrap_or(base.revision),
        author: author_re.captures(html).map(|c| c[1].trim().to_string()).unwrap_or(base.author),
        updated_at: date_re.captures(html).map(|c| c[2].trim().to_string()).unwrap_or(base.updated_at),
        ..base
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Cerca traduzioni su gamestranslator.it
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn search_gamestranslator(
    game_name: String,
    steam_app_id: Option<String>,
) -> Result<Vec<CommunityTranslation>, String> {
    let client = make_client()?;

    // Normalizza il nome: rimuove articoli e caratteri speciali
    let query = game_name
        .replace([':', '™', '®', '©', '–', '-'], " ")
        .split_whitespace()
        .take(5) // max 5 parole per non essere troppo specifico
        .collect::<Vec<_>>()
        .join("+");

    // Prima prova: ricerca IPS
    let search_url = SEARCH_URL.replace("{QUERY}", &urlencoding::encode(&query));
    let mut all_results: Vec<CommunityTranslation> = Vec::new();

    match client.get(&search_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let html = resp.text().await.unwrap_or_default();
            let found = parse_search_results(&html);
            all_results.extend(found);
        }
        _ => {
            // Fallback: downloads listing
            let fallback_url = DOWNLOADS_URL.replace("{QUERY}", &urlencoding::encode(&query));
            if let Ok(resp) = client.get(&fallback_url).send().await {
                if resp.status().is_success() {
                    let html = resp.text().await.unwrap_or_default();
                    all_results.extend(parse_search_results(&html));
                }
            }
        }
    }

    // Se abbiamo steam_app_id, filtra per priorità i risultati che hanno corrispondenza
    if let Some(ref sid) = steam_app_id {
        let (with_id, without_id): (Vec<_>, Vec<_>) = all_results
            .into_iter()
            .partition(|r| r.steam_app_id.as_deref() == Some(sid.as_str()));
        all_results = with_id.into_iter().chain(without_id).collect();
    }

    // Dedup per file_id
    all_results.dedup_by_key(|r| r.id.clone());

    Ok(all_results)
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Ottieni dettagli completi di un file specifico
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn get_gamestranslator_file(file_id: String, file_slug: String) -> Result<CommunityTranslation, String> {
    let client = make_client()?;
    let url = format!("{}/index.php?/file/{}-{}/", BASE_URL, file_id, file_slug);

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }
    let html = resp.text().await.map_err(|e| e.to_string())?;

    let base = CommunityTranslation {
        id: file_id.clone(),
        title: String::new(),
        author: String::new(),
        state: String::new(),
        revision: String::new(),
        version: String::new(),
        steam_app_id: None,
        page_url: url.clone(),
        download_url: format!("{}/index.php?/files/file/{}-{}/&do=download", BASE_URL, file_id, file_slug),
        updated_at: String::new(),
    };

    Ok(parse_file_page(&html, base))
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: trova la cartella paks per gioco Unreal
// ──────────────────────────────────────────────────────────────────────────────
fn find_paks_dir(game_path: &Path) -> Option<PathBuf> {
    // Pattern: <GameDir>/<AnyName>/Content/Paks/
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            let candidate = entry.path().join("Content").join("Paks");
            if candidate.is_dir() { return Some(candidate); }
        }
    }
    // Oppure direttamente game_path/Content/Paks/
    let direct = game_path.join("Content").join("Paks");
    if direct.is_dir() { return Some(direct); }
    None
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Installa traduzione da ZIP (Unreal pak o Unity)
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn install_translation_from_zip(
    zip_path: String,
    game_path: String,
    engine: String, // "unreal", "unity", "auto"
) -> Result<serde_json::Value, String> {
    let zip_file = Path::new(&zip_path);
    let game_dir = Path::new(&game_path);

    if !zip_file.exists() {
        return Err(format!("File ZIP non trovato: {}", zip_path));
    }
    if !game_dir.is_dir() {
        return Err(format!("Cartella di gioco non trovata: {}", game_path));
    }

    let bytes = fs::read(zip_file).map_err(|e| format!("Lettura ZIP: {}", e))?;

    // Verifica magic bytes
    if bytes.len() < 4 || &bytes[..4] != b"PK\x03\x04" {
        return Err("Il file non è un archivio ZIP valido".to_string());
    }

    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("ZIP corrotto: {}", e))?;

    // Determina il motore se "auto"
    let detected_engine = if engine == "auto" {
        if find_paks_dir(game_dir).is_some() { "unreal".to_string() }
        else if game_dir.join("BepInEx").exists() || game_dir.join("winhttp.dll").exists() { "unity".to_string() }
        else { "unknown".to_string() }
    } else {
        engine.to_lowercase()
    };

    let mut installed_files: Vec<String> = Vec::new();
    let mut skipped_files: Vec<String> = Vec::new();

    match detected_engine.as_str() {
        "unreal" => {
            let paks_dir = find_paks_dir(game_dir)
                .ok_or_else(|| "Cartella Content/Paks/ non trovata nel gioco".to_string())?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let name = file.mangled_name();
                let fname = name.file_name().unwrap_or_default().to_string_lossy().to_string();

                if fname.ends_with(".pak") || fname.ends_with(".ucas") || fname.ends_with(".utoc") {
                    let dest = paks_dir.join(&fname);
                    let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
                    installed_files.push(fname);
                } else if !fname.is_empty() && !file.name().ends_with('/') {
                    skipped_files.push(fname);
                }
            }
        }
        "unity" => {
            // Per Unity: estrae tutto nella cartella di gioco mantenendo la struttura
            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let relative = file.mangled_name();
                let dest = game_dir.join(&relative);

                if file.name().ends_with('/') {
                    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
                } else {
                    if let Some(p) = dest.parent() {
                        fs::create_dir_all(p).map_err(|e| e.to_string())?;
                    }
                    let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
                    installed_files.push(relative.to_string_lossy().to_string());
                }
            }
        }
        _ => {
            return Err(format!("Motore non riconosciuto: '{}'. Usa 'unreal' o 'unity'.", detected_engine));
        }
    }

    if installed_files.is_empty() {
        return Err("Nessun file di traduzione trovato nell'archivio ZIP".to_string());
    }

    Ok(serde_json::json!({
        "success": true,
        "engine": detected_engine,
        "installed": installed_files,
        "skipped": skipped_files,
        "message": format!("Installati {} file in {}", installed_files.len(), game_path)
    }))
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Apre la pagina del file nel browser di sistema (utente già loggato)
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn open_gamestranslator_page(url: String) -> Result<(), String> {
    // Validazione: deve essere un URL gamestranslator.it
    if !url.starts_with("https://www.gamestranslator.it") {
        return Err("URL non valido: deve essere gamestranslator.it".to_string());
    }
    open::that(&url).map_err(|e| format!("Impossibile aprire il browser: {}", e))
}
