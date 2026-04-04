use tauri::command;
use std::path::{Path, PathBuf};
use std::fs;
use super::process_util::no_window_command;
use reqwest::Client;
use std::io::Cursor;
use zip::ZipArchive;

// GitHub reindirizza automaticamente /latest/download/ all'ultima release disponibile
const UABEA_DOWNLOAD_URL: &str =
    "https://github.com/nesrak1/UABEA/releases/latest/download/UABEAvalonia-windows-x64.zip";
const UABEA_FALLBACK_URL: &str =
    "https://github.com/nesrak1/UABEA/releases/latest/download/UABEAvalonia.zip";

fn get_uabea_dir() -> PathBuf {
    dirs::data_dir()
        .or_else(dirs::config_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("tools")
        .join("uabea")
}

fn get_uabea_exe() -> PathBuf {
    get_uabea_dir().join("UABEAvalonia.exe")
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AssetsFileInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub data_folder: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TextAssetEntry {
    pub name: String,
    pub content: String,
    pub translated: String,
    pub assets_file: String,
    pub content_offset: u64,
    pub content_length: usize,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UabeaStatus {
    pub installed: bool,
    pub path: Option<String>,
}

#[command]
pub async fn find_unity_assets_files(game_path: String) -> Result<Vec<AssetsFileInfo>, String> {
    let game_dir = Path::new(&game_path);
    let mut result = Vec::new();

    let entries = fs::read_dir(game_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if name.ends_with("_Data") {
                let folder_str = path.to_string_lossy().to_string();
                if let Ok(assets) = fs::read_dir(&path) {
                    for asset in assets.flatten() {
                        let ap = asset.path();
                        if ap.extension().and_then(|e| e.to_str()) == Some("assets") {
                            let size = ap.metadata().map(|m| m.len()).unwrap_or(0);
                            result.push(AssetsFileInfo {
                                path: ap.to_string_lossy().to_string(),
                                file_name: ap.file_name().unwrap_or_default().to_string_lossy().to_string(),
                                size_bytes: size,
                                data_folder: folder_str.clone(),
                            });
                        }
                    }
                }
            }
        }
    }
    Ok(result)
}

#[command]
pub async fn check_uabea_installed() -> Result<UabeaStatus, String> {
    let exe = get_uabea_exe();
    Ok(UabeaStatus {
        installed: exe.exists(),
        path: if exe.exists() { Some(exe.to_string_lossy().to_string()) } else { None },
    })
}

#[command]
pub async fn download_uabea() -> Result<String, String> {
    let dir = get_uabea_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Errore cartella: {}", e))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build().map_err(|e| e.to_string())?;

    // Prova URL principale, poi fallback
    let urls = [UABEA_DOWNLOAD_URL, UABEA_FALLBACK_URL];
    let mut last_err = String::new();

    for url in &urls {
        match try_download_uabea(&client, url, &dir).await {
            Ok(exe_path) => return Ok(exe_path),
            Err(e) => {
                log::warn!("UABEA download fallito da {}: {}", url, e);
                last_err = e;
            }
        }
    }

    Err(format!(
        "Download UABEA fallito da tutti gli URL. Scaricalo manualmente da https://github.com/nesrak1/UABEA/releases e copialo in: {}. Errore: {}",
        dir.display(), last_err
    ))
}

async fn try_download_uabea(client: &Client, url: &str, dir: &std::path::Path) -> Result<String, String> {
    let response = client.get(url).send().await
        .map_err(|e| format!("Connessione fallita: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), url));
    }

    // Verifica Content-Type — deve essere ZIP, non HTML
    let content_type = response.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if content_type.contains("text/html") {
        return Err(format!("L'URL restituisce HTML invece dello ZIP (probabile 404 GitHub): {}", url));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    // Verifica magic bytes ZIP (PK\x03\x04)
    if bytes.len() < 4 || &bytes[..4] != b"PK\x03\x04" {
        return Err(format!("Il file scaricato non è un archivio ZIP valido (URL: {})", url));
    }

    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("Errore ZIP: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let out = dir.join(file.mangled_name());
        if file.name().ends_with('/') {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = out.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
            let mut f = fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut f).map_err(|e| e.to_string())?;
        }
    }

    let exe = get_uabea_exe();
    if exe.exists() {
        Ok(exe.to_string_lossy().to_string())
    } else {
        // Cerca qualsiasi .exe nell'archivio estratto
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().and_then(|e| e.to_str()) == Some("exe") {
                    return Ok(p.to_string_lossy().to_string());
                }
            }
        }
        Err(format!("UABEA estratto ma exe non trovato in {}", dir.display()))
    }
}

#[command]
pub async fn open_assets_with_uabea(assets_file: String) -> Result<(), String> {
    let exe = get_uabea_exe();
    if !exe.exists() {
        return Err("UABEA non installato. Chiama download_uabea() prima.".to_string());
    }
    no_window_command(&exe).arg(&assets_file).spawn()
        .map_err(|e| format!("Errore avvio UABEA: {}", e))?;
    Ok(())
}

fn is_likely_text(data: &[u8]) -> bool {
    if data.is_empty() { return false; }
    let printable = data.iter().filter(|&&b| b >= 0x20 || b == b'\n' || b == b'\r' || b == b'\t').count();
    (printable as f32 / data.len() as f32) > 0.85 && std::str::from_utf8(data).is_ok()
}

fn looks_like_game_text(text: &str) -> bool {
    let alpha = text.chars().filter(|c| c.is_alphabetic()).count();
    let non_alnum = text.chars().filter(|c| !c.is_alphanumeric() && !c.is_whitespace() && !".,!?:;'-\"()[]{}".contains(*c)).count();
    alpha > 5 && text.contains(' ') && (non_alnum as f32 / text.len() as f32) < 0.4
}

#[command]
pub async fn scan_assets_for_text(assets_file: String) -> Result<Vec<TextAssetEntry>, String> {
    let data = fs::read(&assets_file).map_err(|e| format!("Errore lettura: {}", e))?;
    let mut found: Vec<TextAssetEntry> = Vec::new();
    let min_len = 40usize;
    let max_len = 500_000usize;

    let mut i = 0usize;
    while i + 4 < data.len() {
        let len = u32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]) as usize;
        if len >= min_len && len <= max_len && i + 4 + len <= data.len() {
            let slice = &data[i+4..i+4+len];
            if is_likely_text(slice) {
                if let Ok(text) = std::str::from_utf8(slice) {
                    let t = text.trim();
                    if t.len() >= min_len && looks_like_game_text(t) {
                        let offset = i as u64;
                        if !found.iter().any(|e| e.content_offset.abs_diff(offset) < 16) {
                            found.push(TextAssetEntry {
                                name: format!("asset_{:08x}", i),
                                content: t.to_string(),
                                translated: String::new(),
                                assets_file: assets_file.clone(),
                                content_offset: offset,
                                content_length: len,
                            });
                        }
                        i += 4 + len;
                        i = (i + 3) & !3;
                        continue;
                    }
                }
            }
        }
        i += 1;
    }

    found.truncate(1000);
    Ok(found)
}

#[command]
pub async fn prepare_assets_for_translation(game_path: String) -> Result<serde_json::Value, String> {
    let assets = find_unity_assets_files(game_path.clone()).await?;
    let relevant: Vec<_> = assets.iter()
        .filter(|a| a.size_bytes > 1024 && a.size_bytes < 100_000_000)
        .collect();

    let uabea = check_uabea_installed().await?;

    Ok(serde_json::json!({
        "found": relevant.len(),
        "uabea_installed": uabea.installed,
        "uabea_path": uabea.path,
        "assets_files": relevant.iter().map(|a| serde_json::json!({
            "path": a.path,
            "file_name": a.file_name,
            "size_mb": (a.size_bytes as f64 / 1_048_576.0 * 10.0).round() / 10.0
        })).collect::<Vec<_>>(),
        "message": if uabea.installed {
            format!("Trovati {} file .assets. UABEA pronto.", relevant.len())
        } else {
            format!("Trovati {} file .assets. Installa UABEA per la traduzione grafica.", relevant.len())
        }
    }))
}
