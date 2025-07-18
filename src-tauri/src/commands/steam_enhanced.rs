use steamlocate::SteamDir;
use crate::models::{GameInfo, SteamGame};
use std::collections::HashMap;
use log::{debug, info, warn, error};
use serde::{Serialize, Deserialize};

/// 🚀 STEAMLOCATE-RS INTEGRATION
/// Nuova implementazione per scansione Steam più robusta e veloce

#[derive(Debug, Serialize, Deserialize)]
pub struct EnhancedSteamInfo {
    pub steam_path: String,
    pub libraries_count: usize,
    pub total_apps: usize,
    pub installed_apps: usize,
}

/// 🎮 Scansione Steam migliorata con steamlocate-rs
/// Questa funzione sostituisce la logica custom con una libreria dedicata
#[tauri::command]
pub async fn scan_steam_with_steamlocate() -> Result<Vec<GameInfo>, String> {
    info!("🚀 Avvio scansione Steam con steamlocate-rs");
    
    // Localizza l'installazione Steam
    let steam_dir = match SteamDir::locate() {
        Some(dir) => {
            info!("✅ Steam trovato in: {}", dir.path().display());
            dir
        },
        None => {
            warn!("❌ Steam non trovato sul sistema");
            return Err("Steam non installato o non trovato".to_string());
        }
    };

    let mut games = Vec::new();
    let mut total_libraries = 0;
    let mut total_apps = 0;
    let mut installed_apps = 0;

    // Itera su tutte le librerie Steam
    match steam_dir.libraries() {
        Ok(libraries) => {
            for library_result in libraries {
                match library_result {
                    Ok(library) => {
                        total_libraries += 1;
                        info!("📚 Scansione libreria: {}", library.path().display());
                        
                        // Itera su tutte le app nella libreria
                        for app_result in library.apps() {
                            match app_result {
                                Ok(app) => {
                                    total_apps += 1;
                                    
                                    // Converti SteamApp in GameInfo
                                    let game_info = convert_steam_app_to_game_info(&app, &library.path().display().to_string());
                                    
                                    // Controlla se è installato
                                    if app.name.is_some() {
                                        installed_apps += 1;
                                    }
                                    
                                    games.push(game_info);
                                },
                                Err(e) => {
                                    warn!("⚠️ Errore lettura app: {}", e);
                                }
                            }
                        }
                    },
                    Err(e) => {
                        warn!("⚠️ Errore lettura libreria: {}", e);
                    }
                }
            }
        },
        Err(e) => {
            error!("❌ Errore accesso librerie Steam: {}", e);
            return Err(format!("Errore accesso librerie Steam: {}", e));
        }
    }

    info!("✅ Scansione completata: {} librerie, {} app totali, {} installate", 
          total_libraries, total_apps, installed_apps);

    Ok(games)
}

/// 🔍 Trova un gioco specifico per App ID
#[tauri::command]
pub async fn find_steam_game_by_id(app_id: u32) -> Result<Option<GameInfo>, String> {
    info!("🔍 Ricerca gioco Steam con ID: {}", app_id);
    
    let steam_dir = match SteamDir::locate() {
        Some(dir) => dir,
        None => return Err("Steam non trovato".to_string()),
    };

    match steam_dir.find_app(app_id) {
        Ok(Some((app, library))) => {
            info!("✅ Gioco trovato: {:?} in libreria: {}", app.name, library.path().display());
            let game_info = convert_steam_app_to_game_info(&app, &library.path().display().to_string());
            Ok(Some(game_info))
        },
        Ok(None) => {
            info!("❌ Gioco con ID {} non trovato", app_id);
            Ok(None)
        },
        Err(e) => {
            error!("❌ Errore ricerca gioco: {}", e);
            Err(format!("Errore ricerca gioco: {}", e))
        }
    }
}

/// 📊 Ottieni informazioni dettagliate su Steam
#[tauri::command]
pub async fn get_enhanced_steam_info() -> Result<EnhancedSteamInfo, String> {
    info!("📊 Raccolta informazioni Steam avanzate");
    
    let steam_dir = match SteamDir::locate() {
        Some(dir) => dir,
        None => return Err("Steam non trovato".to_string()),
    };

    let steam_path = steam_dir.path().display().to_string();
    let mut libraries_count = 0;
    let mut total_apps = 0;
    let mut installed_apps = 0;

    // Conta librerie e app
    match steam_dir.libraries() {
        Ok(libraries) => {
            for library_result in libraries {
                match library_result {
                    Ok(library) => {
                        libraries_count += 1;
                        
                        for app_result in library.apps() {
                            match app_result {
                                Ok(app) => {
                                    total_apps += 1;
                                    if app.name.is_some() {
                                        installed_apps += 1;
                                    }
                                },
                                Err(_) => {}
                            }
                        }
                    },
                    Err(_) => {}
                }
            }
        },
        Err(e) => {
            warn!("⚠️ Errore conteggio librerie: {}", e);
        }
    }

    let info = EnhancedSteamInfo {
        steam_path,
        libraries_count,
        total_apps,
        installed_apps,
    };

    info!("📊 Steam Info: {} librerie, {} app totali, {} installate", 
          info.libraries_count, info.total_apps, info.installed_apps);

    Ok(info)
}

/// 🔄 Converti SteamApp in GameInfo
// TODO: Implementare quando SteamApp sarà definito o importato da steamlocate
/*
fn convert_steam_app_to_game_info(app: &SteamApp, library_path: &str) -> GameInfo {
    // Importa le funzioni di rilevamento dal modulo steam esistente
    use crate::commands::steam::{detect_vr_game, detect_game_engine, detect_game_genres, detect_supported_languages};
    
    let app_id_str = app.app_id.to_string();
    let name = app.name.clone().unwrap_or_else(|| format!("App {}", app.app_id));
    
    // Usa le funzioni di rilevamento esistenti
    let is_vr = detect_vr_game(&name, app.app_id);
    let engine = detect_game_engine(&name, app.app_id);
    let genres = detect_game_genres(&name, app.app_id);
    let supported_languages = detect_supported_languages(&name, app.app_id);
    
    GameInfo {
        id: app_id_str.clone(),
        app_id: app_id_str,
        title: name,
        platform: "Steam".to_string(),
        header_image: None, // Sarà popolato successivamente se necessario
        supported_languages: if supported_languages.is_empty() { 
            None 
        } else { 
            Some(supported_languages.split(',').map(|s| s.trim().to_string()).collect()) 
        },
        is_vr: Some(is_vr),
        engine: if engine == "Unknown" { None } else { Some(engine) },
        is_installed: Some(app.name.is_some()), // Se ha un nome, probabilmente è installato
        genres: if genres.is_empty() { None } else { Some(genres) },
        last_played: None, // Potrebbe essere aggiunto in futuro
        install_path: app.install_dir.clone(),
        library_path: Some(library_path.to_string()),
    }
}
*/

/// 🎯 Test della nuova implementazione steamlocate
#[tauri::command]
pub async fn test_steamlocate_integration() -> Result<String, String> {
    info!("🧪 Test integrazione steamlocate-rs");
    
    let steam_dir = match SteamDir::locate() {
        Some(dir) => dir,
        None => return Ok("❌ Steam non trovato per il test".to_string()),
    };

    let mut report = String::new();
    report.push_str(&format!("✅ Steam trovato in: {}\n", steam_dir.path().display()));
    
    // Test conteggio librerie
    match steam_dir.libraries() {
        Ok(libraries) => {
            let mut lib_count = 0;
            let mut app_count = 0;
            
            for library_result in libraries {
                match library_result {
                    Ok(library) => {
                        lib_count += 1;
                        report.push_str(&format!("📚 Libreria {}: {}\n", lib_count, library.path().display()));
                        
                        let mut local_app_count = 0;
                        for app_result in library.apps() {
                            match app_result {
                                Ok(app) => {
                                    app_count += 1;
                                    local_app_count += 1;
                                    
                                    // Mostra solo i primi 3 giochi per libreria
                                    if local_app_count <= 3 {
                                        let name = app.name.as_deref().unwrap_or("Senza nome");
                                        report.push_str(&format!("  🎮 {} (ID: {})\n", name, app.app_id));
                                    }
                                },
                                Err(_) => {}
                            }
                        }
                        
                        if local_app_count > 3 {
                            report.push_str(&format!("  ... e altri {} giochi\n", local_app_count - 3));
                        }
                        report.push_str(&format!("  Totale app in questa libreria: {}\n\n", local_app_count));
                    },
                    Err(e) => {
                        report.push_str(&format!("⚠️ Errore libreria: {}\n", e));
                    }
                }
            }
            
            report.push_str(&format!("📊 RIEPILOGO:\n"));
            report.push_str(&format!("  - Librerie trovate: {}\n", lib_count));
            report.push_str(&format!("  - App totali: {}\n", app_count));
            report.push_str(&format!("✅ Test steamlocate-rs completato con successo!\n"));
        },
        Err(e) => {
            report.push_str(&format!("❌ Errore accesso librerie: {}\n", e));
        }
    }
    
    Ok(report)
}
