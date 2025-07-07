use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use winreg::enums::*;
use winreg::RegKey;
use crate::commands::library::InstalledGame;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItchioGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub executable: Option<String>,
    pub platform: String, // "itch.io"
    pub size_bytes: Option<u64>,
    pub last_modified: Option<u64>,
    pub author: Option<String>,
    pub version: Option<String>,
}

/// Scansiona i giochi itch.io installati localmente
pub async fn get_itchio_installed_games() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // 1. Scansiona giochi itch.io dal registro
    if let Ok(itchio_games) = scan_itchio_registry().await {
        games.extend(itchio_games);
    }
    
    // 2. Scansiona cartelle di installazione itch.io
    if let Ok(folder_games) = scan_itchio_folders().await {
        games.extend(folder_games);
    }
    
    // 3. Scansiona database itch.io app (se disponibile)
    if let Ok(db_games) = scan_itchio_database().await {
        games.extend(db_games);
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

/// Scansiona giochi itch.io dal registro
async fn scan_itchio_registry() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Chiavi di registro per itch.io
    let registry_paths = vec![
        ("HKLM", "SOFTWARE\\WOW6432Node\\itch"),
        ("HKLM", "SOFTWARE\\itch"),
        ("HKCU", "SOFTWARE\\itch"),
        ("HKCU", "SOFTWARE\\itch.io"),
    ];
    
    for (hive, registry_path) in registry_paths {
        let reg_key = match hive {
            "HKLM" => &hklm,
            "HKCU" => &hkcu,
            _ => continue,
        };
        
        if let Ok(itch_key) = reg_key.open_subkey(registry_path) {
            for game_key_name in itch_key.enum_keys().flatten() {
                if let Ok(game_key) = itch_key.open_subkey(&game_key_name) {
                    if let Ok(game) = parse_itchio_registry_entry(&game_key, &game_key_name).await {
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona cartelle di installazione itch.io
async fn scan_itchio_folders() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // Cartelle comuni per itch.io
    let possible_paths = vec![
        // Percorsi standard itch.io app
        r"C:\Users\%USERNAME%\AppData\Roaming\itch\apps",
        r"C:\Users\%USERNAME%\AppData\Local\itch\apps",
        r"C:\Program Files\itch\apps",
        r"C:\Program Files (x86)\itch\apps",
        // Percorsi personalizzati comuni
        r"D:\itch.io",
        r"E:\itch.io",
        r"D:\Games\itch.io",
        r"E:\Games\itch.io",
    ];
    
    // Espandi %USERNAME% nei percorsi
    let username = std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string());
    
    for base_path_template in possible_paths {
        let base_path = base_path_template.replace("%USERNAME%", &username);
        let path = Path::new(&base_path);
        
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(game) = parse_itchio_game_folder(&entry.path()).await {
                            games.push(game);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Scansiona database itch.io app (se disponibile)
async fn scan_itchio_database() -> Result<Vec<InstalledGame>, String> {
    let mut games = Vec::new();
    
    // itch.io app memorizza i dati in SQLite, ma per semplicità
    // cerchiamo i file di configurazione JSON
    let username = std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string());
    
    let config_paths = vec![
        format!(r"C:\Users\{}\AppData\Roaming\itch\db\butler.db", username),
        format!(r"C:\Users\{}\AppData\Roaming\itch\preferences.json", username),
        format!(r"C:\Users\{}\AppData\Local\itch\preferences.json", username),
    ];
    
    for config_path in config_paths {
        let path = Path::new(&config_path);
        if path.exists() {
            // Per ora, saltiamo il parsing del database SQLite
            // In futuro si potrebbe implementare il parsing del database
            // per ottenere informazioni più dettagliate sui giochi
            break;
        }
    }
    
    Ok(games)
}

/// Test della connessione itch.io (solo scansione locale)
#[tauri::command]
pub async fn test_itchio_connection() -> Result<String, String> {
    println!("[ITCH.IO] Test scansione locale");
    
    let games = get_itchio_installed_games().await?;
    
    Ok(format!("Scansione itch.io completata: {} giochi trovati", games.len()))
}

/// Recupera informazioni su un gioco itch.io specifico
#[tauri::command]
pub async fn get_itchio_game_info(game_id: String) -> Result<ItchioGame, String> {
    println!("[ITCH.IO] Recupero informazioni per: {}", game_id);
    
    let games = get_itchio_installed_games().await?;
    
    for game in games {
        if game.id == game_id {
            return Ok(ItchioGame {
                id: game.id,
                title: game.name,
                install_path: Some(game.path),
                executable: game.executable,
                platform: game.platform,
                size_bytes: game.size_bytes,
                last_modified: game.last_modified,
                author: None, // Potrebbe essere estratto dal nome della cartella
                version: None, // Potrebbe essere estratto dai metadati
            });
        }
    }
    
    Err(format!("Gioco '{}' non trovato", game_id))
}

/// Recupera le copertine per i giochi itch.io (placeholder)
#[tauri::command]
pub async fn get_itchio_covers_batch(game_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    println!("[ITCH.IO] Recupero copertine per {} giochi (placeholder)", game_ids.len());
    
    // itch.io non ha API pubblica per le copertine
    // Restituiamo un HashMap vuoto per ora
    // In futuro si potrebbe implementare il recupero da fonti alternative
    // o cercare immagini locali nelle cartelle dei giochi
    let covers = HashMap::new();
    
    Ok(covers)
}

// Funzioni helper private

async fn parse_itchio_registry_entry(game_key: &RegKey, game_id: &str) -> Result<InstalledGame, String> {
    // Prova a leggere diversi campi possibili per itch.io
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
        id: format!("itchio_{}", game_id.to_lowercase()),
        name,
        path: install_path,
        executable,
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "itch.io".to_string(),
    })
}

async fn parse_itchio_game_folder(folder_path: &Path) -> Result<InstalledGame, String> {
    let folder_name = folder_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Salta cartelle che non sono giochi
    if folder_name.contains("itch") 
        || folder_name.contains("temp")
        || folder_name.contains("cache")
        || folder_name.contains("logs")
        || folder_name.starts_with(".") {
        return Err("Non è una cartella di gioco".to_string());
    }
    
    // Cerca l'eseguibile principale
    let executable = find_main_executable(folder_path).await;
    
    // Se non trova eseguibili, potrebbe essere un gioco web-only
    // In questo caso, cerchiamo file HTML o altri indicatori
    let has_web_content = if executable.is_none() {
        check_for_web_game(folder_path).await
    } else {
        false
    };
    
    // Ottieni metadati della cartella
    let metadata = folder_path.metadata().ok();
    
    // Pulisci il nome del gioco (spesso i nomi delle cartelle itch.io includono l'autore)
    let clean_name = clean_itchio_game_name(&folder_name);
    
    Ok(InstalledGame {
        id: format!("itchio_{}", folder_name.to_lowercase().replace(" ", "_").replace("-", "_")),
        name: clean_name,
        path: folder_path.to_string_lossy().to_string(),
        executable: if has_web_content { Some("web_game".to_string()) } else { executable },
        size_bytes: metadata.as_ref().map(|m| m.len()),
        last_modified: metadata.and_then(|m| {
            m.modified().ok().and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            })
        }),
        platform: "itch.io".to_string(),
    })
}

async fn find_main_executable(game_path: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(game_path) {
        // Prima cerca eseguibili comuni per giochi indie
        let common_executables = vec![
            "game.exe", "Game.exe",
            "main.exe", "Main.exe",
            "start.exe", "Start.exe",
            "run.exe", "Run.exe",
            "play.exe", "Play.exe",
            "launcher.exe", "Launcher.exe",
        ];
        
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if common_executables.contains(&file_name) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
        
        // Cerca qualsiasi .exe che non sia un installer/uninstaller
        if let Ok(entries) = fs::read_dir(game_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") 
                        && !file_name.contains("unins") 
                        && !file_name.contains("Uninstall")
                        && !file_name.contains("setup")
                        && !file_name.contains("Setup")
                        && !file_name.contains("install")
                        && !file_name.contains("Install") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

async fn check_for_web_game(game_path: &Path) -> bool {
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.ends_with(".html") 
                    || file_name == "index.html"
                    || file_name.ends_with(".swf")
                    || file_name.ends_with(".unity3d") {
                    return true;
                }
            }
        }
    }
    false
}

fn clean_itchio_game_name(folder_name: &str) -> String {
    // I nomi delle cartelle itch.io spesso seguono il formato "game-name-by-author"
    // o "author-game-name". Proviamo a pulire il nome.
    
    let name = folder_name.replace("-", " ").replace("_", " ");
    
    // Rimuovi pattern comuni
    let cleaned = name
        .replace(" by ", " - ")
        .replace("by ", "")
        .trim()
        .to_string();
    
    // Capitalizza la prima lettera di ogni parola
    cleaned
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}
