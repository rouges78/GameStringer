use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use winreg::enums::*;
use winreg::RegKey;
use crate::commands::library::InstalledGame;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UbisoftGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "Ubisoft Connect" or "Uplay"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
}

/// Scansiona i giochi Ubisoft Connect installati localmente
pub async fn get_ubisoft_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi Ubisoft Connect dal registro
    if let Ok(ubisoft_games) = scan_ubisoft_registry().await {
        games.extend(ubisoft_games);
    }
    
    // 2. Scansiona giochi Uplay (legacy) dal registro
    if let Ok(uplay_games) = scan_uplay_registry().await {
        games.extend(uplay_games);
    }
    
    // 3. Scansiona cartelle di installazione comuni
    if let Ok(folder_games) = scan_ubisoft_folders().await {
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

/// Scansiona giochi Ubisoft Connect dal registro
async fn scan_ubisoft_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Chiavi di registro per Ubisoft Connect
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs",
        "SOFTWARE\\Ubisoft\\Launcher\\Installs",
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Ubisoft Game Launcher\\Installs",
        "SOFTWARE\\Ubisoft\\Ubisoft Game Launcher\\Installs",
    ];
    
    for registry_path in registry_paths {
        if let Ok(ubisoft_key) = hklm.open_subkey(registry_path) {
            for game_key_name in ubisoft_key.enum_keys().flatten() {
                if let Ok(game_key) = ubisoft_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_ubisoft_registry_entry(&game_key, &game_key_name, "Ubisoft Connect").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona giochi Uplay (legacy) dal registro
async fn scan_uplay_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Chiavi di registro per Uplay (legacy)
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Uplay\\Installs",
        "SOFTWARE\\Ubisoft\\Uplay\\Installs",
    ];
    
    for registry_path in registry_paths {
        if let Ok(uplay_key) = hklm.open_subkey(registry_path) {
            for game_key_name in uplay_key.enum_keys().flatten() {
                if let Ok(game_key) = uplay_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_ubisoft_registry_entry(&game_key, &game_key_name, "Uplay").await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione comuni per Ubisoft Connect
async fn scan_ubisoft_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per Ubisoft Connect
    let possible_paths = vec![
        r"C:\Program Files (x86)\Ubisoft\Ubisoft Game Launcher\games",
        r"C:\Program Files\Ubisoft\Ubisoft Game Launcher\games",
        r"C:\Program Files (x86)\Uplay\games",
        r"C:\Program Files\Uplay\games",
        r"D:\Ubisoft Games",
        r"D:\Uplay Games",
        r"E:\Ubisoft Games",
        r"E:\Uplay Games",
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_ubisoft_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Test della connessione Ubisoft Connect (solo scansione locale)
#[tauri::command]
pub async fn test_ubisoft_connection() -> Result<String, String> {
    println!("[UBISOFT] Test scansione locale");
    
    let games = get_ubisoft_installed_games().await?;
    
    Ok(format!("Scansione Ubisoft Connect completata: {} giochi trovati", games.len()))
}

/// Recupera informazioni su un gioco Ubisoft Connect specifico
#[tauri::command]
pub async fn get_ubisoft_game_info(game_id: String) -> Result<UbisoftGame, String> {
    println!("[UBISOFT] Recupero informazioni per: {}", game_id);
    
    let games = get_ubisoft_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(UbisoftGame {
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

/// Recupera le copertine per i giochi Ubisoft Connect (placeholder)
#[tauri::command]
pub async fn get_ubisoft_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[UBISOFT] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // Ubisoft Connect non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_ubisoft_registry_entry(game_key: &RegKey, game_id: &str, platform: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per Ubisoft Connect
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .or_else(|_| game_key.get_value::<String, _>("GameName"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallDir")
        .or_else(|_| game_key.get_value::<String, _>("InstallLocation"))
        .or_else(|_| game_key.get_value::<String, _>("Install Dir"))
        .or_else(|_| game_key.get_value::<String, _>("Path"))
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

async fn parse_ubisoft_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Determina se è Ubisoft Connect o Uplay basandosi sul percorso
    let platform = if folder_path.to_string_lossy().contains("Uplay") {
        "Uplay"
    } else {
        "Ubisoft Connect"
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
        // Prima cerca eseguibili comuni di Ubisoft
        let common_executables = vec![
            "Game.exe", "game.exe",
            "Launcher.exe", "launcher.exe",
            "Main.exe", "main.exe",
            "Start.exe", "start.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if common_executables.contains(&file_name) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Cerca eseguibili specifici di giochi Ubisoft famosi
        let ubisoft_game_executables = vec![
            "ACOrigins.exe", "ACOdyssey.exe", "ACValhalla.exe", // Assassin's Creed
            "FarCry5.exe", "FarCry6.exe", "FarCryNewDawn.exe", // Far Cry
            "RainbowSix.exe", "R6Game.exe", // Rainbow Six
            "WatchDogs.exe", "WatchDogs2.exe", "WatchDogsLegion.exe", // Watch Dogs
            "TheDivision.exe", "TheDivision2.exe", // The Division
        ];
        
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if ubisoft_game_executables.iter().any(|&exe| file_name.contains(&exe[..exe.len()-4])) {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
        
        // Se non trova eseguibili specifici, cerca qualsiasi .exe che non sia un uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.contains("unins") 
                        && !file_name.contains("Uninstall")
                        && !file_name.contains("setup")
                        && !file_name.contains("Setup")
                        && !file_name.contains("UbisoftGameLauncher")
                        && !file_name.contains("upc.exe") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}
