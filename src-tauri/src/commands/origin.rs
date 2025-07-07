use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use winreg::enums::*;
use winreg::RegKey;
use crate::commands::library::InstalledGame;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OriginGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "Origin" or "EA App"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
}

/// Scansiona i giochi Origin/EA App installati localmente
pub async fn get_origin_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi Origin (legacy)
    if let Ok(origin_games) = scan_origin_legacy().await {
        games.extend(origin_games);
    }
    
    // 2. Scansiona giochi EA App (nuovo)
    if let Ok(ea_games) = scan_ea_app().await {
        games.extend(ea_games);
    }
    
    // 3. Scansiona cartelle di installazione comuni
    if let Ok(folder_games) = scan_origin_folders().await {
        games.extend(folder_games);
    }
    
    // Rimuovi duplicati basandosi sul nome del gioco
    let mut unique_games = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    
    for game in games {
        if seen_names.insert(game.name.clone()) {
            unique_games.push(game);
        }
    }
    
    Ok(unique_games)
}

/// Scansiona giochi Origin dal registro (versione legacy)
async fn scan_origin_legacy() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Origin memorizza i giochi nel registro
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Prova diverse chiavi di registro per Origin
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Origin Games",
        "SOFTWARE\\Origin Games",
        "SOFTWARE\\WOW6432Node\\Electronic Arts\\EA Core\\ProductGUID",
        "SOFTWARE\\Electronic Arts\\EA Core\\ProductGUID",
    ];
    
    for registry_path in registry_paths {
        if let Ok(origin_key) = hklm.open_subkey(registry_path) {
            for game_key_name in origin_key.enum_keys().flatten() {
                if let Ok(game_key) = origin_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_origin_registry_entry(&game_key, &game_key_name, "Origin").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona giochi EA App dal registro (nuova versione)
async fn scan_ea_app() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // EA App usa chiavi di registro diverse
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\EA Games",
        "SOFTWARE\\EA Games",
        "SOFTWARE\\WOW6432Node\\Electronic Arts\\EA Desktop",
        "SOFTWARE\\Electronic Arts\\EA Desktop",
    ];
    
    for registry_path in registry_paths {
        if let Ok(ea_key) = hklm.open_subkey(registry_path) {
            for game_key_name in ea_key.enum_keys().flatten() {
                if let Ok(game_key) = ea_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_origin_registry_entry(&game_key, &game_key_name, "EA App").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione comuni per Origin/EA App
async fn scan_origin_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per Origin/EA App
    let possible_paths = vec![
        r"C:\Program Files (x86)\Origin Games",
        r"C:\Program Files\Origin Games",
        r"C:\Program Files (x86)\EA Games",
        r"C:\Program Files\EA Games",
        r"D:\Origin Games",
        r"D:\EA Games",
        r"E:\Origin Games",
        r"E:\EA Games",
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_origin_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Test della connessione Origin/EA App (solo scansione locale)
#[tauri::command]
pub async fn test_origin_connection() -> Result<String, String> {
    println!("[ORIGIN] Test scansione locale");
    
    let games = get_origin_installed_games().await?;
    
    Ok(format!("Scansione Origin/EA App completata: {} giochi trovati", games.len()))
}

/// Recupera informazioni su un gioco Origin/EA App specifico
#[tauri::command]
pub async fn get_origin_game_info(game_id: String) -> Result<OriginGame, String> {
    println!("[ORIGIN] Recupero informazioni per: {}", game_id);
    
    let games = get_origin_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(OriginGame {
                id: game.id,
                title: game.name,
                install_path: Some(game.path),
                executable: game.executable,
                platform: game.platform,
                size_bytes: game.size_bytes,
                last_modified: game.last_modified,
            });
        }
    }
    
    Err(format!("Gioco '{}' non trovato", game_id))
}

/// Recupera le copertine per i giochi Origin/EA App (placeholder)
#[tauri::command]
pub async fn get_origin_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[ORIGIN] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // Origin/EA App non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_origin_registry_entry(game_key: &RegKey, game_id: &str, platform: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallLocation")
        .or_else(|_| game_key.get_value::<String, _>("Install Dir"))
        .or_else(|_| game_key.get_value::<String, _>("InstallDir"))
        .unwrap_or_default();
    
    if install_path.is_empty() {
        return Err("Percorso di installazione non trovato".to_string());
    }
    
    let game_path = Path::new(&install_path);
    let executable = find_main_executable(game_path).await;
    
    // Ottieni metadati della cartella
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("{}_{}", platform.to_lowercase().replace(" ", "_"), game_id.to_lowercase()),
        name,
        path: install_path,
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: platform.to_string(),
    })
}

async fn parse_origin_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Determina se è Origin o EA App basandosi sul percorso
    let platform = if folder_path.to_string_lossy().contains("Origin") {
        "Origin"
    } else {
        "EA App"
    };
    
    Ok(InstalledGame {
        id: format!("{}_{}", platform.to_lowercase().replace(" ", "_"), folder_name.to_lowercase().replace(" ", "_")),
        name: folder_name.clone(),
        path: folder_path.to_string_lossy().to_string(),
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: platform.to_string(),
    })
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili comuni di EA/Origin
        let common_executables = vec![
            "Game.exe", "game.exe",
            "Launcher.exe", "launcher.exe",
            "Main.exe", "main.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if common_executables.contains(&file_name) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Se non trova eseguibili comuni, cerca qualsiasi .exe che non sia un uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.contains("unins") 
                        && !file_name.contains("Uninstall")
                        && !file_name.contains("setup")
                        && !file_name.contains("Setup") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}
