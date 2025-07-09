use tauri::command;
use serde::{Serialize, Deserialize};
use crate::models::*;
use std::path::Path;
use std::fs;
use tokio::fs as async_fs;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstalledGame {
    pub id: String,
    pub name: String,
    pub path: String,
    pub executable: Option<String>,
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
    pub platform: String,
}

#[tauri::command]
pub async fn get_library_games() -> Result<Vec<InstalledGame>, String> {
    println!("[RUST] get_library_games called");
    
    let mut games = Vec::new();
    
    // 1. Scan Steam games from registry and .acf files
    if let Ok(steam_games) = get_steam_installed_games().await {
        games.extend(steam_games);
    }
    
    // 2. Scan Epic Games
    if let Ok(epic_games) = get_epic_installed_games().await {
        games.extend(epic_games);
    }
    
    // 3. Scan GOG Games
    if let Ok(gog_games) = crate::commands::gog::get_gog_installed_games().await {
        games.extend(gog_games);
    }
    
    // 4. Scan Origin/EA App Games
    if let Ok(origin_games) = crate::commands::origin::get_origin_installed_games().await {
        games.extend(origin_games);
    }
    
    // 5. Scan Ubisoft Connect Games
    if let Ok(ubisoft_games) = crate::commands::ubisoft::get_ubisoft_installed_games().await {
        games.extend(ubisoft_games);
    }
    
    // 6. Scan Battle.net Games
    if let Ok(battlenet_games) = crate::commands::battlenet::get_battlenet_installed_games().await {
        games.extend(battlenet_games);
    }
    
    // 7. Scan itch.io Games
    if let Ok(itchio_games) = crate::commands::itchio::get_itchio_installed_games().await {
        games.extend(itchio_games);
    }
    
    // Sort alphabetically
    games.sort_by(|a, b| a.name.cmp(&b.name));
    
    println!("[RUST] Returning {} library games", games.len());
    Ok(games)
}

async fn get_steam_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Find Steam path from registry
    let steam_path = find_steam_path_from_registry()
        .ok_or("Steam not found in registry")?;
    
    let steamapps_path = Path::new(&steam_path).join("steamapps");
    
    if !steamapps_path.exists() {
        return Ok(games);
    }
    
    // Read .acf files
    if let Ok(entries) = fs::read_dir(&steamapps_path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                    if let Ok(game) = parse_acf_file(&entry.path()).await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

async fn parse_acf_file(file_path: &Path) -> Result<InstalledGame, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read ACF file: {}", e))?;
    
    // Simple ACF parsing - extract appid, name, and installdir
    let mut app_id = String::new();
    let mut name = String::new();
    let mut install_dir = String::new();
    
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("\"appid\"") {
            app_id = extract_quoted_value(line);
        } else if line.starts_with("\"name\"") {
            name = extract_quoted_value(line);
        } else if line.starts_with("\"installdir\"") {
            install_dir = extract_quoted_value(line);
        }
    }
    
    if app_id.is_empty() || name.is_empty() {
        return Err("Invalid ACF file".to_string());
    }
    
    // Construct full path
    let steam_path = find_steam_path_from_registry()
        .ok_or("Steam path not found")?;
    let game_path = Path::new(&steam_path)
        .join("steamapps")
        .join("common")
        .join(&install_dir);
    
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("steam_{}", app_id),
        name,
        path: game_path.to_string_lossy().to_string(),
        executable: find_main_executable(&game_path).await,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Steam".to_string(),
    })
}

pub async fn get_epic_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Epic Games stores manifests in ProgramData
    let manifests_path = Path::new("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
    
    if !manifests_path.exists() {
        return Ok(games);
    }
    
    if let Ok(entries) = fs::read_dir(manifests_path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.ends_with(".item") {
                    if let Ok(game) = parse_epic_manifest(&entry.path()).await {
                        // 🚫 FILTRO: Escludi Unreal Engine dal conteggio giochi
                        if !is_unreal_engine(&game) {
                            games.push(game);
                        } else {
                            println!("[EPIC] 🔧 Escluso dal conteggio: {} (Unreal Engine)", game.name);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

// 🔧 Funzione per rilevare se un'installazione Epic è Unreal Engine
fn is_unreal_engine(game: &InstalledGame) -> bool {
    let name_lower = game.name.to_lowercase();
    let id_lower = game.id.to_lowercase();
    let path_lower = game.path.to_lowercase();
    
    // Rileva varie versioni di Unreal Engine
    let unreal_indicators = [
        "unreal engine", "unrealengine", "unreal_engine",
        "ue4", "ue5", "ue_4", "ue_5",
        "unreal editor", "unrealed",
        "engine\\binaries", "engine/binaries",
        "unrealtournament", // Anche Unreal Tournament può essere considerato tool
    ];
    
    for indicator in &unreal_indicators {
        if name_lower.contains(indicator) || 
           id_lower.contains(indicator) || 
           path_lower.contains(indicator) {
            return true;
        }
    }
    
    // Controlli specifici per AppName Epic
    if game.id.starts_with("epic_") {
        let app_name = &game.id[5..]; // Rimuove "epic_" prefix
        let app_name_lower = app_name.to_lowercase();
        
        if app_name_lower.starts_with("ue") || 
           app_name_lower.contains("unreal") ||
           app_name_lower.contains("editor") {
            return true;
        }
    }
    
    false
}

async fn parse_epic_manifest(file_path: &Path) -> Result<InstalledGame, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read Epic manifest: {}", e))?;
    
    let manifest: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Epic manifest JSON: {}", e))?;
    
    let app_name = manifest["AppName"].as_str().unwrap_or("Unknown").to_string();
    let display_name = manifest["DisplayName"].as_str().unwrap_or(&app_name).to_string();
    let install_location = manifest["InstallLocation"].as_str().unwrap_or("").to_string();
    let name = manifest["DisplayName"].as_str().unwrap_or("Unknown").to_string();
    let app_id = manifest["AppName"].as_str().unwrap_or("").to_string();
    let size_on_disk = manifest["SizeOnDisk"].as_u64().unwrap_or(0);
    
    let game_path = Path::new(&install_location);
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("epic_{}", app_id),
        name: name.clone(),
        path: install_location.clone(),
        executable: find_main_executable(game_path).await,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Epic Games".to_string(),
    })
}

async fn get_gog_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // GOG stores game info in registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    if let Ok(gog_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\GOG.com\\Games") {
        for game_key_name in gog_key.enum_keys().flatten() {
            if let Ok(game_key) = gog_key.open_subkey(&game_key_name) {
                if let Ok(game) = parse_gog_registry_entry(&game_key, &game_key_name).await {
                    games.push(game);
                }
            }
        }
    }
    
    Ok(games)
}

async fn parse_gog_registry_entry(game_key: &RegKey, game_id: &str) -> Result<InstalledGame, String> {
    let name: String = game_key.get_value("gameName")
        .or_else(|_| game_key.get_value("gameID"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let path: String = game_key.get_value("path")
        .map_err(|_| "No path in GOG registry entry")?;
    
    let game_path = Path::new(&path);
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("gog_{}", game_id),
        name: name.clone(),
        path: path.clone(),
        executable: find_main_executable(game_path).await,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "GOG".to_string(),
    })
}

pub fn find_steam_path_from_registry() -> Option<String> {
    // Try 64-bit registry first
    if let Some(path) = find_steam_path_in_hive(HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam") {
        return Some(path);
    }
    // Fallback to 32-bit registry
    if let Some(path) = find_steam_path_in_hive(HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam") {
        return Some(path);
    }
    None
}

fn find_steam_path_in_hive(hive: winreg::HKEY, subkey: &str) -> Option<String> {
    RegKey::predef(hive)
        .open_subkey(subkey)
        .and_then(|key| key.get_value::<String, _>("InstallPath"))
        .ok()
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if !game_path.exists() {
        return None;
    }
    
    // Look for common executable patterns
    let patterns = [".exe", ".bat", ".cmd"];
    
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                for pattern in &patterns {
                    if file_name.ends_with(pattern) {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    
    None
}

fn extract_quoted_value(line: &str) -> String {
    // Extract value from "key" "value" format
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() >= 2 {
        let value_part = parts[1].trim();
        if value_part.starts_with('"') && value_part.ends_with('"') {
            return value_part[1..value_part.len()-1].to_string();
        }
    }
    String::new()
}

#[tauri::command]
pub async fn get_game_path(game_id: String) -> Result<String, String> {
    println!("[RUST] get_game_path called for game_id: {}", game_id);
    
    // This would implement the logic from /api/library/game-path
    // For now, return a placeholder
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn read_game_file(file_path: String) -> Result<String, String> {
    println!("[RUST] read_game_file called for file_path: {}", file_path);
    
    // This would implement the logic from /api/library/read-file
    // For now, return a placeholder
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn scan_game_files(game_path: String) -> Result<Vec<String>, String> {
    println!("[RUST] scan_game_files called for game_path: {}", game_path);
    
    // This would implement the logic from /api/library/scan-files
    // For now, return a placeholder
    Err("Not yet implemented".to_string())
}
