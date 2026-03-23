//! repak wrapper
//!
//! Usa `repak` (https://github.com/trumank/repak) per creare file .pak UE
//! compatibili al 100% con tutti i giochi Unreal Engine 4/5.
//! repak viene scaricato automaticamente la prima volta.
//!
//! Perché repak invece del PAK writer custom?
//! - Gestisce correttamente tutte le versioni PAK (V4 → V11+)
//! - Mount point / path separator corretti
//! - Testato con migliaia di giochi dalla community UE modding

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;
use reqwest::Client;
use zip::ZipArchive;
use serde::{Deserialize, Serialize};

const REPAK_DOWNLOAD_URL: &str =
    "https://github.com/trumank/repak/releases/latest/download/repak-x86_64-pc-windows-msvc.zip";
const REPAK_FALLBACK_URL: &str =
    "https://github.com/trumank/repak/releases/download/v0.2.3/repak-x86_64-pc-windows-msvc.zip";

// ──────────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────────

fn repak_dir() -> PathBuf {
    dirs::data_dir()
        .or_else(dirs::config_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("tools")
        .join("repak")
}

pub fn repak_exe() -> PathBuf {
    repak_dir().join("repak.exe")
}

pub fn is_repak_installed() -> bool {
    repak_exe().exists()
}

// ──────────────────────────────────────────────────────────────────────────────
// Download
// ──────────────────────────────────────────────────────────────────────────────

pub async fn ensure_repak() -> Result<PathBuf, String> {
    if is_repak_installed() {
        return Ok(repak_exe());
    }
    download_repak().await
}

pub async fn download_repak() -> Result<PathBuf, String> {
    let dir = repak_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cartella repak: {}", e))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build().map_err(|e| e.to_string())?;

    for url in &[REPAK_DOWNLOAD_URL, REPAK_FALLBACK_URL] {
        match try_download_repak(&client, url, &dir).await {
            Ok(exe) => {
                log::info!("✅ repak installato: {}", exe.display());
                return Ok(exe);
            }
            Err(e) => {
                log::warn!("⚠️ repak download fallito da {}: {}", url, e);
            }
        }
    }

    Err(format!(
        "Impossibile scaricare repak. Scaricalo manualmente da https://github.com/trumank/repak/releases e copialo in: {}",
        dir.display()
    ))
}

async fn try_download_repak(client: &Client, url: &str, dir: &Path) -> Result<PathBuf, String> {
    let resp = client.get(url).send().await
        .map_err(|e| format!("Connessione: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let ct = resp.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if ct.contains("text/html") {
        return Err("GitHub ha restituito HTML (404?)".to_string());
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() < 4 || &bytes[..4] != b"PK\x03\x04" {
        return Err("Non è uno ZIP valido".to_string());
    }

    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("ZIP: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.mangled_name();
        let fname = name.file_name().unwrap_or_default().to_string_lossy().to_string();
        if fname == "repak.exe" {
            let dest = dir.join("repak.exe");
            let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            return Ok(dest);
        }
    }

    Err("repak.exe non trovato nello ZIP".to_string())
}

// ──────────────────────────────────────────────────────────────────────────────
// PAK creation
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct RepakResult {
    pub success: bool,
    pub pak_path: String,
    pub method: String, // "repak" | "custom"
    pub message: String,
}

/// Crea un _P.pak a partire da una mappa {path_nel_pak → bytes}.
/// Usa repak se disponibile, fallback al writer custom.
pub async fn create_pak(
    files: &[(&str, &[u8])],
    output_path: &Path,
    pak_version_hint: Option<u32>,
) -> Result<RepakResult, String> {
    // Prova repak (scarica se necessario ma non blocca se fallisce)
    match ensure_repak().await {
        Ok(repak) => {
            match create_pak_with_repak(&repak, files, output_path, pak_version_hint) {
                Ok(r) => return Ok(r),
                Err(e) => {
                    log::warn!("⚠️ repak fallito, uso writer custom: {}", e);
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ repak non disponibile: {} — uso writer custom", e);
        }
    }

    // Fallback: writer custom Rust
    let pak_data = super::unreal_localization::create_pak_v4(files);
    fs::write(output_path, &pak_data)
        .map_err(|e| format!("Scrittura PAK: {}", e))?;

    Ok(RepakResult {
        success: true,
        pak_path: output_path.to_string_lossy().to_string(),
        method: "custom".to_string(),
        message: format!("PAK creato con writer custom ({} bytes)", pak_data.len()),
    })
}

fn create_pak_with_repak(
    repak_exe: &Path,
    files: &[(&str, &[u8])],
    output_path: &Path,
    pak_version_hint: Option<u32>,
) -> Result<RepakResult, String> {
    // Crea directory temporanea con la struttura richiesta
    let tmp_dir = std::env::temp_dir().join(format!("gs_repak_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()));
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("Tmp dir: {}", e))?;

    // Scrivi i file nella struttura corretta
    for (path_in_pak, data) in files {
        // repak usa percorsi Windows-style, converte / → \
        let rel_path = path_in_pak.replace('/', "\\");
        let dest = tmp_dir.join(&rel_path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&dest, data).map_err(|e| e.to_string())?;
    }

    // Determina versione PAK
    let version_arg = match pak_version_hint.unwrap_or(11) {
        v if v <= 4 => "V4",
        v if v <= 7 => "V7",
        v if v <= 8 => "V8A",
        v if v <= 9 => "V9",
        v if v <= 10 => "V10",
        _ => "V11",
    };

    // Esegui: repak.exe pack --version V11 --mount-point ../../../ <tmp_dir> <output.pak>
    let output = Command::new(repak_exe)
        .args([
            "pack",
            "--version", version_arg,
            "--mount-point", "../../../",
            &tmp_dir.to_string_lossy(),
            &output_path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Esecuzione repak: {}", e))?;

    // Cleanup tmp
    let _ = fs::remove_dir_all(&tmp_dir);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("repak exit {}: {}", output.status.code().unwrap_or(-1), stderr));
    }

    if !output_path.exists() {
        return Err("repak ha terminato ma il PAK non è stato creato".to_string());
    }

    let size = fs::metadata(output_path).map(|m| m.len()).unwrap_or(0);
    log::info!("✅ repak: {} ({} bytes, versione {})", output_path.display(), size, version_arg);

    Ok(RepakResult {
        success: true,
        pak_path: output_path.to_string_lossy().to_string(),
        method: format!("repak-{}", version_arg),
        message: format!("PAK creato con repak v{} ({} bytes)", version_arg, size),
    })
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: scarica repak manualmente
// ──────────────────────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn download_repak_tool() -> Result<String, String> {
    let exe = download_repak().await?;
    Ok(exe.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_repak_installed() -> Result<bool, String> {
    Ok(is_repak_installed())
}
