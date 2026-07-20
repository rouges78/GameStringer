//! # Extra Stores Integration Module
//!
//! Rilevamento locale (senza credenziali) per launcher minori ricchi di
//! giochi indie/casual spesso non localizzati — target ideali per le patch:
//! - **Humble App**   → legge %APPDATA%\Humble App\config.json
//! - **Game Jolt**    → legge i JSON del client (packages/games .wttf)
//! - **Big Fish Games** → registry Uninstall (chiavi BFG-*) + cartelle default
//!
//! Stesso pattern di amazon.rs / xbox.rs: is_*_installed, get_*_installed_games,
//! test_*_connection (Ok(String) descrittiva su successo).

use crate::commands::library::InstalledGame;
use log::info;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

// ============================================================================
// HELPERS COMUNI
// ============================================================================

fn folder_modified_time(path: &Path) -> Option<u64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

/// Cerca l'eseguibile principale in una cartella gioco (root + sottocartelle comuni).
fn find_main_executable(game_path: &Path) -> Option<String> {
    if !game_path.exists() {
        return None;
    }
    let is_noise = |name: &str| {
        let n = name.to_lowercase();
        n.contains("unins") || n.contains("crash") || n.contains("update") || n.contains("setup")
            || n.contains("redist") || n.contains("vcredist")
    };

    let mut executables: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(game_path) {
        for e in entries.flatten() {
            if let Some(name) = e.file_name().to_str() {
                if name.to_lowercase().ends_with(".exe") && !is_noise(name) {
                    executables.push(e.path());
                }
            }
        }
    }
    // Il più grande è tipicamente il gioco
    executables.sort_by_key(|p| std::cmp::Reverse(std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)));
    if let Some(exe) = executables.first() {
        return Some(exe.to_string_lossy().to_string());
    }

    for subdir in ["bin", "Binaries", "Win64", "x64", "game"] {
        let sub = game_path.join(subdir);
        if let Ok(entries) = std::fs::read_dir(&sub) {
            for e in entries.flatten() {
                if let Some(name) = e.file_name().to_str() {
                    if name.to_lowercase().ends_with(".exe") && !is_noise(name) {
                        return Some(e.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

// ============================================================================
// HUMBLE APP
// ============================================================================

fn humble_config_path() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let p = PathBuf::from(appdata).join("Humble App").join("config.json");
    if p.exists() { Some(p) } else { None }
}

#[tauri::command]
pub async fn is_humble_installed() -> bool {
    humble_config_path().is_some()
}

/// Scansiona i giochi installati via Humble App leggendo config.json.
/// La chiave della collection è versionata ("game-collection-4"): cerchiamo
/// qualsiasi chiave top-level "game-collection*" che sia un array.
#[tauri::command]
pub async fn get_humble_installed_games() -> Result<Vec<InstalledGame>, String> {
    info!("[HUMBLE] Scansione giochi Humble App...");
    let config_path = match humble_config_path() {
        Some(p) => p,
        None => {
            info!("[HUMBLE] config.json non trovato - Humble App non installata");
            return Ok(Vec::new());
        }
    };

    let raw = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Errore lettura config Humble: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Errore parsing config Humble: {}", e))?;

    let mut games = Vec::new();
    if let Some(obj) = json.as_object() {
        for (key, value) in obj {
            if !key.starts_with("game-collection") {
                continue;
            }
            let Some(arr) = value.as_array() else { continue };
            for entry in arr {
                let status = entry.get("status").and_then(|v| v.as_str()).unwrap_or("");
                if status != "installed" && status != "downloaded" {
                    continue;
                }
                let path = entry.get("filePath").and_then(|v| v.as_str()).unwrap_or("");
                if path.is_empty() || !Path::new(path).exists() {
                    continue;
                }
                let name = entry.get("gameName")
                    .or_else(|| entry.get("machineName"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Humble Game")
                    .to_string();
                let id_src = entry.get("machineName")
                    .or_else(|| entry.get("gamekey"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| name.to_lowercase().replace(' ', "_"));
                let game_path = Path::new(path);

                games.push(InstalledGame {
                    id: format!("humble_{}", id_src),
                    name,
                    path: path.to_string(),
                    executable: entry.get("executablePath").and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .or_else(|| find_main_executable(game_path)),
                    size_bytes: None,
                    last_modified: folder_modified_time(game_path),
                    platform: "Humble App".to_string(),
                });
            }
        }
    }

    info!("[HUMBLE] ✅ Trovati {} giochi Humble", games.len());
    Ok(games)
}

#[tauri::command]
pub async fn test_humble_connection() -> Result<String, String> {
    if humble_config_path().is_none() {
        return Err("Humble App non installata (config.json non trovato)".to_string());
    }
    let games = get_humble_installed_games().await?;
    Ok(format!("✅ Humble App trovata - {} giochi installati", games.len()))
}

// ============================================================================
// GAME JOLT CLIENT
// ============================================================================

fn gamejolt_data_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let candidates = [
        PathBuf::from(&local).join("game-jolt-client").join("User Data").join("Default"),
        PathBuf::from(&local).join("GameJoltClient").join("User Data").join("Default"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

/// Estrae oggetti da un file .wttf del client Game Jolt (JSON con chiave "objects").
fn gamejolt_read_objects(path: &Path) -> Option<serde_json::Map<String, serde_json::Value>> {
    let raw = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
    json.get("objects")?.as_object().cloned()
}

#[tauri::command]
pub async fn is_gamejolt_installed() -> bool {
    gamejolt_data_dir().is_some()
}

/// Scansiona i giochi installati dal client Game Jolt.
/// packages.wttf contiene i pacchetti con install_dir; games.wttf i titoli.
#[tauri::command]
pub async fn get_gamejolt_installed_games() -> Result<Vec<InstalledGame>, String> {
    info!("[GAMEJOLT] Scansione giochi Game Jolt...");
    let data_dir = match gamejolt_data_dir() {
        Some(d) => d,
        None => {
            info!("[GAMEJOLT] Client non trovato");
            return Ok(Vec::new());
        }
    };

    let packages = gamejolt_read_objects(&data_dir.join("packages.wttf")).unwrap_or_default();
    let games_meta = gamejolt_read_objects(&data_dir.join("games.wttf")).unwrap_or_default();

    let mut games = Vec::new();
    for (pkg_id, pkg) in &packages {
        let install_dir = pkg.get("install_dir").and_then(|v| v.as_str()).unwrap_or("");
        if install_dir.is_empty() || !Path::new(install_dir).exists() {
            continue;
        }
        // Titolo: dal gioco collegato (game_id) o dal pacchetto stesso
        let title = pkg.get("game_id")
            .and_then(|gid| {
                let key = if gid.is_string() { gid.as_str().map(|s| s.to_string()) } else { gid.as_u64().map(|n| n.to_string()) }?;
                games_meta.get(&key)?.get("title")?.as_str().map(|s| s.to_string())
            })
            .or_else(|| pkg.get("title").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| format!("Game Jolt #{}", pkg_id));

        let game_path = Path::new(install_dir);
        games.push(InstalledGame {
            id: format!("gamejolt_{}", pkg_id),
            name: title,
            path: install_dir.to_string(),
            executable: find_main_executable(game_path),
            size_bytes: None,
            last_modified: folder_modified_time(game_path),
            platform: "Game Jolt".to_string(),
        });
    }

    info!("[GAMEJOLT] ✅ Trovati {} giochi Game Jolt", games.len());
    Ok(games)
}

#[tauri::command]
pub async fn test_gamejolt_connection() -> Result<String, String> {
    if gamejolt_data_dir().is_none() {
        return Err("Client Game Jolt non installato".to_string());
    }
    let games = get_gamejolt_installed_games().await?;
    Ok(format!("✅ Game Jolt trovato - {} giochi installati", games.len()))
}

// ============================================================================
// BIG FISH GAMES
// ============================================================================

fn bigfish_default_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Ok(base) = std::env::var(var) {
            dirs.push(PathBuf::from(base).join("Big Fish Games"));
        }
    }
    dirs
}

fn bigfish_detected() -> bool {
    // Client Game Manager o cartella giochi default
    if bigfish_default_dirs().iter().any(|d| d.exists()) {
        return true;
    }
    // Chiavi uninstall BFG-*
    !bigfish_registry_games().is_empty()
}

/// Giochi Big Fish dalle chiavi di registro Uninstall (prefisso "BFG-").
#[cfg(windows)]
fn bigfish_registry_games() -> Vec<(String, String)> {
    let mut found = Vec::new();
    let hives = [
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];
    for (hive, subkey) in hives {
        let Ok(uninstall) = RegKey::predef(hive).open_subkey(subkey) else { continue };
        for key_name in uninstall.enum_keys().flatten() {
            if !key_name.starts_with("BFG-") {
                continue;
            }
            let Ok(game_key) = uninstall.open_subkey(&key_name) else { continue };
            let name: String = game_key.get_value("DisplayName").unwrap_or_default();
            // InstallLocation, o ricavo dalla DisplayIcon (path all'exe)
            let mut location: String = game_key.get_value("InstallLocation").unwrap_or_default();
            if location.is_empty() {
                let icon: String = game_key.get_value("DisplayIcon").unwrap_or_default();
                if !icon.is_empty() {
                    let icon_path = icon.split(',').next().unwrap_or("").trim_matches('"');
                    if let Some(parent) = Path::new(icon_path).parent() {
                        location = parent.to_string_lossy().to_string();
                    }
                }
            }
            if !name.is_empty() && !location.is_empty() && Path::new(&location).exists() {
                found.push((name, location));
            }
        }
    }
    found
}

/// Su piattaforme non-Windows non esiste il registro: nessun gioco Big Fish via registry.
#[cfg(not(windows))]
fn bigfish_registry_games() -> Vec<(String, String)> {
    Vec::new()
}

#[tauri::command]
pub async fn is_bigfish_installed() -> bool {
    tokio::task::spawn_blocking(bigfish_detected).await.unwrap_or(false)
}

/// Scansiona i giochi Big Fish: registry (BFG-*) + cartelle default come fallback.
#[tauri::command]
pub async fn get_bigfish_installed_games() -> Result<Vec<InstalledGame>, String> {
    info!("[BIGFISH] Scansione giochi Big Fish...");

    let (reg_games, dir_games) = tokio::task::spawn_blocking(|| {
        let reg = bigfish_registry_games();
        // Fallback: sottocartelle di "Big Fish Games" (escluso il Game Manager)
        let mut dirs: Vec<(String, String)> = Vec::new();
        for base in bigfish_default_dirs() {
            let Ok(entries) = std::fs::read_dir(&base) else { continue };
            for e in entries.flatten() {
                let p = e.path();
                if !p.is_dir() {
                    continue;
                }
                let name = e.file_name().to_string_lossy().to_string();
                let lower = name.to_lowercase();
                if lower.contains("game manager") || lower.contains("bfg") || lower == "cache" {
                    continue;
                }
                dirs.push((name, p.to_string_lossy().to_string()));
            }
        }
        (reg, dirs)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?;

    let mut games: Vec<InstalledGame> = Vec::new();
    let mut seen_paths: Vec<String> = Vec::new();

    for (name, location) in reg_games.into_iter().chain(dir_games.into_iter()) {
        let norm = location.to_lowercase();
        if seen_paths.contains(&norm) {
            continue;
        }
        seen_paths.push(norm);
        let game_path = Path::new(&location);
        games.push(InstalledGame {
            id: format!("bigfish_{}", name.to_lowercase().replace(' ', "_")),
            name,
            path: location.clone(),
            executable: find_main_executable(game_path),
            size_bytes: None,
            last_modified: folder_modified_time(game_path),
            platform: "Big Fish Games".to_string(),
        });
    }

    info!("[BIGFISH] ✅ Trovati {} giochi Big Fish", games.len());
    Ok(games)
}

#[tauri::command]
pub async fn test_bigfish_connection() -> Result<String, String> {
    let installed = tokio::task::spawn_blocking(bigfish_detected).await.unwrap_or(false);
    if !installed {
        return Err("Big Fish Games non rilevato (nessun client o gioco installato)".to_string());
    }
    let games = get_bigfish_installed_games().await?;
    Ok(format!("✅ Big Fish Games trovato - {} giochi installati", games.len()))
}
