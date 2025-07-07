use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use winreg::enums::*;
use winreg::RegKey;
use crate::commands::library::InstalledGame;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BattlenetGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "Battle.net"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
}

/// Scansiona i giochi Battle.net installati localmente
pub async fn get_battlenet_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi Battle.net dal registro
    if let Ok(battlenet_games) = scan_battlenet_registry().await {
        games.extend(battlenet_games);
    }
    
    // 2. Scansiona cartelle di installazione comuni
    if let Ok(folder_games) = scan_battlenet_folders().await {
        games.extend(folder_games);
    }
    
    // 3. Scansiona giochi specifici di Blizzard
    if let Ok(blizzard_games) = scan_blizzard_specific_games().await {
        games.extend(blizzard_games);
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

/// Scansiona giochi Battle.net dal registro
async fn scan_battlenet_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Chiavi di registro per Battle.net
    let registry_paths = vec![
        "SOFTWARE\\WOW6432Node\\Blizzard Entertainment",
        "SOFTWARE\\Blizzard Entertainment",
        "SOFTWARE\\WOW6432Node\\Battle.net",
        "SOFTWARE\\Battle.net",
    ];
    
    for registry_path in registry_paths {
        if let Ok(blizzard_key) = hklm.open_subkey(registry_path) {
            for game_key_name in blizzard_key.enum_keys().flatten() {
                if let Ok(game_key) = blizzard_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_battlenet_registry_entry(&game_key, &game_key_name).await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione comuni per Battle.net
async fn scan_battlenet_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per Battle.net
    let possible_paths = vec![
        r"C:\Program Files (x86)\Battle.net",
        r"C:\Program Files\Battle.net",
        r"C:\Program Files (x86)\Blizzard Entertainment",
        r"C:\Program Files\Blizzard Entertainment",
        r"D:\Battle.net",
        r"D:\Blizzard Games",
        r"E:\Battle.net",
        r"E:\Blizzard Games",
    ];
    
    for base_path in possible_paths {
        let path = Path::new(base_path);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_battlenet_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona giochi specifici di Blizzard in percorsi noti
async fn scan_blizzard_specific_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Giochi specifici di Blizzard con i loro percorsi comuni
    let blizzard_games = vec![
        ("World of Warcraft", vec![
            r"C:\Program Files (x86)\World of Warcraft",
            r"C:\Program Files\World of Warcraft",
            r"D:\World of Warcraft",
            r"E:\World of Warcraft",
        ]),
        ("Overwatch", vec![
            r"C:\Program Files (x86)\Overwatch",
            r"C:\Program Files\Overwatch",
            r"D:\Overwatch",
            r"E:\Overwatch",
        ]),
        ("Hearthstone", vec![
            r"C:\Program Files (x86)\Hearthstone",
            r"C:\Program Files\Hearthstone",
            r"D:\Hearthstone",
            r"E:\Hearthstone",
        ]),
        ("StarCraft II", vec![
            r"C:\Program Files (x86)\StarCraft II",
            r"C:\Program Files\StarCraft II",
            r"D:\StarCraft II",
            r"E:\StarCraft II",
        ]),
        ("Diablo III", vec![
            r"C:\Program Files (x86)\Diablo III",
            r"C:\Program Files\Diablo III",
            r"D:\Diablo III",
            r"E:\Diablo III",
        ]),
        ("Diablo IV", vec![
            r"C:\Program Files (x86)\Diablo IV",
            r"C:\Program Files\Diablo IV",
            r"D:\Diablo IV",
            r"E:\Diablo IV",
        ]),
        ("Call of Duty", vec![
            r"C:\Program Files (x86)\Call of Duty",
            r"C:\Program Files\Call of Duty",
            r"D:\Call of Duty",
            r"E:\Call of Duty",
        ]),
    ];
    
    for (game_name, paths) in blizzard_games {
        for path_str in paths {
            let path = Path::new(path_str);
            if path.exists() {
                if let Ok(game) = create_blizzard_game_entry(game_name, path).await {
                    games.push(game);
                }
                break; // Trovato, non cercare negli altri percorsi
            }
        }
    }
    
    Ok(games)
}

/// Test della connessione Battle.net (solo scansione locale)
#[tauri::command]
pub async fn test_battlenet_connection() -> Result<String, String> {
    println!("[BATTLENET] Test scansione locale");
    
    let games = get_battlenet_installed_games().await?;
    
    Ok(format!("Scansione Battle.net completata: {} giochi trovati", games.len()))
}

/// Recupera informazioni su un gioco Battle.net specifico
#[tauri::command]
pub async fn get_battlenet_game_info(game_id: String) -> Result<BattlenetGame, String> {
    println!("[BATTLENET] Recupero informazioni per: {}", game_id);
    
    let games = get_battlenet_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(BattlenetGame {
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

/// Recupera le copertine per i giochi Battle.net (placeholder)
#[tauri::command]
pub async fn get_battlenet_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[BATTLENET] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // Battle.net non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_battlenet_registry_entry(game_key: &RegKey, game_id: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per Battle.net
    let name = game_key.get_value::<String, _>("DisplayName")
        .or_else(|_| game_key.get_value::<String, _>("ProductName"))
        .or_else(|_| game_key.get_value::<String, _>("Title"))
        .or_else(|_| game_key.get_value::<String, _>("GameName"))
        .unwrap_or_else(|_| game_id.to_string());
    
    let install_path = game_key.get_value::<String, _>("InstallPath")
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
        id: format!("battlenet_{}", game_id.to_lowercase()),
        name,
        path: install_path,
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Battle.net".to_string(),
    })
}

async fn parse_battlenet_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Salta cartelle che non sono giochi
    if folder_name.contains("Battle.net") 
        || folder_name.contains("Blizzard") 
        || folder_name.contains("Logs")
        || folder_name.contains("Cache") {
        return Err("Non è una cartella di gioco".to_string());
    }
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("battlenet_{}", folder_name.to_lowercase().replace(" ", "_")),
        name: folder_name.clone(),
        path: folder_path.to_string_lossy().to_string(),
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Battle.net".to_string(),
    })
}

async fn create_blizzard_game_entry(game_name: &str, game_path: &Path) -> Result<InstalledGame, String> {
    // Cerca l'eseguibile principale
    let executable = find_main_executable(game_path).await;
    
    // Ottieni metadati della cartella
    let metadata = game_path.metadata().ok();
    
    Ok(InstalledGame {
        id: format!("battlenet_{}", game_name.to_lowercase().replace(" ", "_").replace(":", "")),
        name: game_name.to_string(),
        path: game_path.to_string_lossy().to_string(),
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "Battle.net".to_string(),
    })
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili specifici di giochi Blizzard
        let blizzard_executables = vec![
            "Wow.exe", "WowClassic.exe", "World of Warcraft.exe", // World of Warcraft
            "Overwatch.exe", "OverwatchLauncher.exe", // Overwatch
            "Hearthstone.exe", "Hearthstone Beta Launcher.exe", // Hearthstone
            "SC2.exe", "SC2Switcher.exe", "StarCraft II.exe", // StarCraft II
            "Diablo III.exe", "D3.exe", // Diablo III
            "Diablo IV.exe", "D4.exe", // Diablo IV
            "ModernWarfare.exe", "BlackOps.exe", "Warzone.exe", // Call of Duty
            "Heroes of the Storm.exe", "HeroesSwitcher.exe", // Heroes of the Storm
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if blizzard_executables.iter().any(|&exe| file_name == exe) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Cerca eseguibili comuni
        let common_executables = vec![
            "Game.exe", "game.exe",
            "Launcher.exe", "launcher.exe",
            "Main.exe", "main.exe",
            "Start.exe", "start.exe",
        ];
        
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if common_executables.contains(&file_name) {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
        
        // Se non trova eseguibili specifici, cerca qualsiasi .exe che non sia un launcher/uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.contains("unins") 
                        && !file_name.contains("Uninstall")
                        && !file_name.contains("setup")
                        && !file_name.contains("Setup")
                        && !file_name.contains("Battle.net")
                        && !file_name.contains("Blizzard") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}
