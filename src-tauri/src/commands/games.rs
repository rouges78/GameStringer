use crate::models::*;
use serde_json;
use std::path::Path;
use tokio::fs;

#[tauri::command]
pub async fn get_games() -> Result<Vec<GameInfo>, String> {
    log::info!("🎮 Recupero lista giochi dal database...");
    
    // TODO: Implementare connessione database SQLite
    // Per ora restituiamo una lista vuota come placeholder
    let games = Vec::new();
    
    log::info!("✅ Trovati {} giochi nel database", games.len());
    Ok(games)
}

#[tauri::command]
pub async fn get_game_by_id(game_id: String) -> Result<Option<GameInfo>, String> {
    log::info!("🔍 Recupero gioco con ID: {}", game_id);
    
    // TODO: Implementare query database per ID specifico
    // Per ora restituiamo None come placeholder
    log::warn!("⚠️ Funzione get_game_by_id non ancora implementata");
    Ok(None)
}

#[tauri::command]
pub async fn scan_games() -> Result<Vec<GameScanResult>, String> {
    log::info!("🔎 Avvio scansione giochi...");
    
    let mut scan_results = Vec::new();
    
    // Scansiona giochi Steam
    match scan_steam_games().await {
        Ok(mut steam_games) => {
            log::info!("✅ Trovati {} giochi Steam", steam_games.len());
            scan_results.append(&mut steam_games);
        }
        Err(e) => {
            log::error!("❌ Errore scansione Steam: {}", e);
        }
    }
    
    // TODO: Aggiungere scansione per altri launcher (Epic, GOG, etc.)
    
    log::info!("🎯 Scansione completata: {} giochi totali", scan_results.len());
    Ok(scan_results)
}

// Funzione helper per scansionare giochi Steam
async fn scan_steam_games() -> Result<Vec<GameScanResult>, String> {
    let mut games = Vec::new();
    
    // Ottieni percorsi librerie Steam
    let library_paths = get_steam_library_folders().await?;
    
    for library_path in library_paths {
        let steamapps_path = format!("{}/steamapps", library_path);
        
        match scan_steam_library(&steamapps_path).await {
            Ok(mut library_games) => {
                games.append(&mut library_games);
            }
            Err(e) => {
                log::warn!("⚠️ Errore scansione libreria {}: {}", steamapps_path, e);
            }
        }
    }
    
    Ok(games)
}

// Funzione per ottenere percorsi librerie Steam
async fn get_steam_library_folders() -> Result<Vec<String>, String> {
    let steam_path = "C:/Program Files (x86)/Steam";
    let library_folders_vdf = format!("{}/steamapps/libraryfolders.vdf", steam_path);
    
    let mut library_paths = vec![steam_path.to_string()];
    
    match fs::read_to_string(&library_folders_vdf).await {
        Ok(data) => {
            for line in data.lines() {
                if let Some(captures) = regex::Regex::new(r#""path"\s+"(.+?)""#)
                    .unwrap()
                    .captures(line) 
                {
                    if let Some(path) = captures.get(1) {
                        let normalized_path = path.as_str().replace("\\\\", "/");
                        library_paths.push(normalized_path);
                    }
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ Impossibile leggere libraryfolders.vdf: {}", e);
        }
    }
    
    // Rimuovi duplicati
    library_paths.sort();
    library_paths.dedup();
    
    Ok(library_paths)
}

// Funzione per scansionare una singola libreria Steam
async fn scan_steam_library(steamapps_path: &str) -> Result<Vec<GameScanResult>, String> {
    let mut games = Vec::new();
    
    match fs::read_dir(steamapps_path).await {
        Ok(mut entries) => {
            while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
                let path = entry.path();
                
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                        match parse_steam_manifest(&path).await {
                            Ok(Some(game)) => {
                                games.push(game);
                            }
                            Ok(None) => {
                                // Manifest non valido o gioco non installato
                            }
                            Err(e) => {
                                log::warn!("⚠️ Errore parsing manifest {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Impossibile leggere directory {}: {}", steamapps_path, e));
        }
    }
    
    Ok(games)
}

// Funzione per parsare un manifest Steam
async fn parse_steam_manifest(manifest_path: &Path) -> Result<Option<GameScanResult>, String> {
    let content = fs::read_to_string(manifest_path).await
        .map_err(|e| format!("Errore lettura manifest: {}", e))?;
    
    let mut app_id: Option<String> = None;
    let mut name = None;
    let mut install_dir = None;
    let mut state_flags: Option<u32> = None;
    
    for line in content.lines() {
        let line = line.trim();
        
        if line.starts_with("\"appid\"") {
            if let Some(captures) = regex::Regex::new(r#""appid"\s+"(\d+)""#)
                .unwrap()
                .captures(line) 
            {
                app_id = captures.get(1).and_then(|m| m.as_str().parse().ok());
            }
        } else if line.starts_with("\"name\"") {
            if let Some(captures) = regex::Regex::new(r#""name"\s+"(.+?)""#)
                .unwrap()
                .captures(line) 
            {
                name = captures.get(1).map(|m| m.as_str().to_string());
            }
        } else if line.starts_with("\"installdir\"") {
            if let Some(captures) = regex::Regex::new(r#""installdir"\s+"(.+?)""#)
                .unwrap()
                .captures(line) 
            {
                install_dir = captures.get(1).map(|m| m.as_str().to_string());
            }
        } else if line.starts_with("\"StateFlags\"") {
            if let Some(captures) = regex::Regex::new(r#""StateFlags"\s+"(\d+)""#)
                .unwrap()
                .captures(line) 
            {
                state_flags = captures.get(1).and_then(|m| m.as_str().parse().ok());
            }
        }
    }
    
    if let (Some(app_id), Some(name), Some(install_dir)) = (app_id, name, install_dir) {
        // Verifica se il gioco è installato (StateFlags & 4 == 4)
        let is_installed = state_flags.map_or(false, |flags| flags & 4 == 4);
        
        if is_installed {
            let library_path = manifest_path.parent()
                .and_then(|p| p.parent())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let install_path = format!("{}/steamapps/common/{}", library_path, install_dir);
            
            // Trova l'eseguibile principale
            let executable_path = find_largest_exe(&install_path).await
                .unwrap_or_else(|| format!("{}/game.exe", install_path));
            
            let game_result = GameScanResult {
                title: name,
                path: install_path,
                executable_path: Some(executable_path),
                app_id: Some(app_id.to_string()),
                source: "Steam".to_string(),
                is_installed: true,
            };
            
            return Ok(Some(game_result));
        }
    }
    
    Ok(None)
}

// Funzione per trovare l'eseguibile più grande in una directory
async fn find_largest_exe(dir: &str) -> Option<String> {
    match fs::read_dir(dir).await {
        Ok(mut entries) => {
            let mut largest_exe = None;
            let mut largest_size = 0;
            
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                
                if let Some(extension) = path.extension() {
                    if extension.to_string_lossy().to_lowercase() == "exe" {
                        if let Ok(metadata) = entry.metadata().await {
                            if metadata.len() > largest_size {
                                largest_size = metadata.len();
                                largest_exe = Some(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
            
            largest_exe
        }
        Err(_) => None,
    }
}
