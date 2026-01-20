//! # Amazon Games Integration Module
//! 
//! Supporto per Amazon Games (Prime Gaming) - legge da SQLite database
//! Basato sull'implementazione di Vortex Mod Manager

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::commands::library::InstalledGame;
use log::{info, warn};

// ============================================================================
// STRUTTURE DATI
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AmazonGame {
    pub id: String,
    pub title: String,
    pub install_directory: String,
    pub product_asin: Option<String>,
    pub installed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct AmazonGameDbRow {
    id: String,
    product_title: String,
    install_directory: String,
    product_asin: Option<String>,
}

// ============================================================================
// FUNZIONI PRINCIPALI
// ============================================================================

/// Ottiene il percorso del database SQLite di Amazon Games
fn get_amazon_db_path() -> Option<PathBuf> {
    // %localappdata%\Amazon Games\Data\Games\Sql\GameInstallInfo.sqlite
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let db_path = PathBuf::from(&local_app_data)
        .join("Amazon Games")
        .join("Data")
        .join("Games")
        .join("Sql")
        .join("GameInstallInfo.sqlite");
    
    if db_path.exists() {
        Some(db_path)
    } else {
        None
    }
}

/// Scansiona i giochi Amazon Games installati dal database SQLite
#[tauri::command]
pub async fn get_amazon_installed_games() -> Result<Vec<InstalledGame>, String> {
    info!("[AMAZON] Scansione giochi Amazon Games...");
    
    let db_path = match get_amazon_db_path() {
        Some(path) => path,
        None => {
            info!("[AMAZON] Database Amazon Games non trovato - Amazon Games potrebbe non essere installato");
            return Ok(Vec::new());
        }
    };
    
    info!("[AMAZON] Database trovato: {:?}", db_path);
    
    // Fase 1: Leggi i dati dal database (sincrono, in spawn_blocking)
    let db_games = tokio::task::spawn_blocking(move || {
        read_amazon_db_sync(&db_path)
    }).await.map_err(|e| format!("Task error: {}", e))??;
    
    // Fase 2: Cerca gli eseguibili (async)
    let mut games = Vec::new();
    for db_game in db_games {
        let install_path = PathBuf::from(&db_game.install_directory);
        let executable = find_amazon_executable(&install_path).await;
        
        let installed_game = InstalledGame {
            id: format!("amazon_{}", db_game.id),
            name: db_game.product_title,
            path: db_game.install_directory,
            executable,
            size_bytes: None,
            last_modified: get_folder_modified_time(&install_path),
            platform: "Amazon Games".to_string(),
        };
        
        games.push(installed_game);
    }
    
    info!("[AMAZON] ✅ Trovati {} giochi Amazon Games", games.len());
    Ok(games)
}

/// Legge i giochi dal database Amazon in modo sincrono
fn read_amazon_db_sync(db_path: &PathBuf) -> Result<Vec<AmazonGameDbRow>, String> {
    let conn = rusqlite::Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY
    ).map_err(|e| format!("Errore apertura database Amazon: {}", e))?;
    
    let mut games = Vec::new();
    
    // Query per ottenere i giochi installati
    let query = "SELECT Id, ProductTitle, InstallDirectory, ProductAsin FROM DbSet WHERE Installed = 1";
    
    match conn.prepare(query) {
        Ok(mut stmt) => {
            let game_iter = stmt.query_map([], |row| {
                Ok(AmazonGameDbRow {
                    id: row.get(0).unwrap_or_default(),
                    product_title: row.get(1).unwrap_or_default(),
                    install_directory: row.get(2).unwrap_or_default(),
                    product_asin: row.get(3).ok(),
                })
            });
            
            if let Ok(iter) = game_iter {
                for game_result in iter {
                    if let Ok(game) = game_result {
                        games.push(game);
                    }
                }
            }
        }
        Err(e) => {
            warn!("[AMAZON] Query primaria fallita ({}), provo query alternativa...", e);
            
            // Prova query alternativa per strutture DB diverse
            let alt_query = "SELECT * FROM sqlite_master WHERE type='table'";
            if let Ok(mut stmt) = conn.prepare(alt_query) {
                let tables: Vec<String> = stmt.query_map([], |row| {
                    row.get::<_, String>(1)
                }).ok()
                    .map(|iter| iter.filter_map(|r| r.ok()).collect())
                    .unwrap_or_default();
                
                info!("[AMAZON] Tabelle disponibili: {:?}", tables);
                
                for table in tables {
                    if table.to_lowercase().contains("game") || table.to_lowercase().contains("install") {
                        if let Ok(table_games) = query_amazon_table_sync(&conn, &table) {
                            games.extend(table_games);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Query generica per tabella Amazon (versione sincrona)
fn query_amazon_table_sync(conn: &rusqlite::Connection, table_name: &str) -> Result<Vec<AmazonGameDbRow>, String> {
    let mut games = Vec::new();
    
    // Ottieni info colonne
    let pragma_query = format!("PRAGMA table_info({})", table_name);
    let columns: Vec<String> = conn.prepare(&pragma_query)
        .map_err(|e| e.to_string())?
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    
    info!("[AMAZON] Colonne in {}: {:?}", table_name, columns);
    
    // Cerca colonne rilevanti
    let title_col = columns.iter()
        .find(|c| c.to_lowercase().contains("title") || c.to_lowercase().contains("name"))
        .cloned()
        .unwrap_or("ProductTitle".to_string());
    
    let path_col = columns.iter()
        .find(|c| c.to_lowercase().contains("directory") || c.to_lowercase().contains("path") || c.to_lowercase().contains("install"))
        .cloned()
        .unwrap_or("InstallDirectory".to_string());
    
    let id_col = columns.iter()
        .find(|c| c.to_lowercase() == "id" || c.to_lowercase().contains("asin"))
        .cloned()
        .unwrap_or("Id".to_string());
    
    let query = format!("SELECT {}, {}, {} FROM {}", id_col, title_col, path_col, table_name);
    
    if let Ok(mut stmt) = conn.prepare(&query) {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0).unwrap_or_default(),
                row.get::<_, String>(1).unwrap_or_default(),
                row.get::<_, String>(2).unwrap_or_default(),
            ))
        }) {
            for row_result in rows {
                if let Ok((id, title, path)) = row_result {
                    if !path.is_empty() && std::path::Path::new(&path).exists() {
                        games.push(AmazonGameDbRow {
                            id,
                            product_title: title,
                            install_directory: path,
                            product_asin: None,
                        });
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Cerca l'eseguibile principale in una cartella Amazon Games
async fn find_amazon_executable(game_path: &PathBuf) -> Option<String> {
    if !game_path.exists() {
        return None;
    }
    
    // Prima cerca file .exe nella root
    if let Ok(entries) = std::fs::read_dir(game_path) {
        let mut executables: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                if let Some(name) = e.file_name().to_str() {
                    name.ends_with(".exe") && 
                    !name.to_lowercase().contains("unins") &&
                    !name.to_lowercase().contains("crash") &&
                    !name.to_lowercase().contains("update") &&
                    !name.to_lowercase().contains("setup")
                } else {
                    false
                }
            })
            .map(|e| e.path())
            .collect();
        
        // Ordina per dimensione (più grande = probabilmente il gioco principale)
        executables.sort_by(|a, b| {
            let size_a = std::fs::metadata(a).map(|m| m.len()).unwrap_or(0);
            let size_b = std::fs::metadata(b).map(|m| m.len()).unwrap_or(0);
            size_b.cmp(&size_a)
        });
        
        if let Some(exe) = executables.first() {
            return Some(exe.to_string_lossy().to_string());
        }
    }
    
    // Cerca in sottocartelle comuni
    let common_subdirs = ["bin", "Binaries", "Win64", "x64", "game"];
    for subdir in common_subdirs {
        let subpath = game_path.join(subdir);
        if subpath.exists() {
            if let Ok(entries) = std::fs::read_dir(&subpath) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.ends_with(".exe") && !name.to_lowercase().contains("unins") {
                            return Some(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    
    None
}

/// Ottiene il tempo di modifica di una cartella
fn get_folder_modified_time(path: &PathBuf) -> Option<u64> {
    std::fs::metadata(path).ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

/// Verifica se Amazon Games è installato
#[tauri::command]
pub async fn is_amazon_games_installed() -> bool {
    get_amazon_db_path().is_some()
}

/// Test connessione Amazon Games
#[tauri::command]
pub async fn test_amazon_connection() -> Result<String, String> {
    if let Some(_db_path) = get_amazon_db_path() {
        match get_amazon_installed_games().await {
            Ok(games) => Ok(format!("✅ Amazon Games trovato - {} giochi installati", games.len())),
            Err(e) => Err(format!("❌ Errore lettura database: {}", e))
        }
    } else {
        Err("Amazon Games non installato o database non trovato".to_string())
    }
}
