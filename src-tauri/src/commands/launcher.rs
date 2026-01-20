// use tauri::api::shell; // Rimosso - non più disponibile in Tauri v2
use std::process::Command;
use std::path::Path;
use serde::{Serialize, Deserialize};
use log::{info, warn, error, debug};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LaunchResult {
    pub success: bool,
    pub message: String,
    pub method: String,
    pub game_id: String,
    pub store: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LaunchRequest {
    pub game_id: String,
    pub store: String,
    pub game_name: String,
    pub executable_path: Option<String>,
    pub launch_options: Option<String>,
}

// ================================================================================================
// STEAM LAUNCH SYSTEM
// ================================================================================================

/// Avvia un gioco Steam usando il protocollo steam://run/appid
#[tauri::command]
pub async fn launch_steam_game(app_id: String) -> Result<LaunchResult, String> {
    info!("🚀 Tentativo di avvio gioco Steam: {}", app_id);
    
    // Validazione App ID
    if !is_valid_steam_app_id(&app_id) {
        let error_msg = format!("App ID Steam non valido: {}", app_id);
        error!("{}", error_msg);
        return Ok(LaunchResult {
            success: false,
            message: error_msg,
            method: "steam_protocol".to_string(),
            game_id: app_id,
            store: "Steam".to_string(),
        });
    }

    // Metodo 1: Esecuzione diretta Steam (più affidabile)
    match launch_steam_direct(&app_id).await {
        Ok(result) => {
            info!("✅ Gioco Steam {} avviato con successo via steam.exe -applaunch", app_id);
            return Ok(result);
        }
        Err(e) => {
            warn!("⚠️ Fallimento esecuzione diretta Steam per {}: {}", app_id, e);
        }
    }

    // Metodo 2: Fallback - Protocollo Steam
    let steam_url = format!("steam://rungameid/{}", app_id);
    match launch_with_steam_protocol(&steam_url, &app_id).await {
        Ok(result) => {
            info!("✅ Gioco Steam {} avviato con successo via protocollo", app_id);
            Ok(result)
        }
        Err(e) => {
            let error_msg = format!("Impossibile avviare gioco Steam {}: {}", app_id, e);
            error!("{}", error_msg);
            Ok(LaunchResult {
                success: false,
                message: error_msg,
                method: "failed".to_string(),
                game_id: app_id,
                store: "Steam".to_string(),
            })
        }
    }
}

/// Avvia gioco Steam usando il protocollo steam://
async fn launch_with_steam_protocol(steam_url: &str, app_id: &str) -> Result<LaunchResult, String> {
    debug!("🔗 Tentativo avvio via protocollo: {}", steam_url);
    
    // Usa open::that che è più affidabile per aprire URL di protocollo
    let url = steam_url.to_string();
    let app_id_clone = app_id.to_string();
    
    let result = tokio::task::spawn_blocking(move || {
        open::that(&url)
    }).await;
    
    match result {
        Ok(Ok(())) => {
            info!("✅ Protocollo Steam eseguito con successo via open::that");
            Ok(LaunchResult {
                success: true,
                message: format!("Gioco avviato tramite protocollo Steam: {}", steam_url),
                method: "steam_protocol".to_string(),
                game_id: app_id_clone,
                store: "Steam".to_string(),
            })
        }
        Ok(Err(e)) => {
            Err(format!("Errore open::that protocollo Steam: {}", e))
        }
        Err(e) => {
            Err(format!("Errore spawn_blocking: {}", e))
        }
    }
}

/// Avvia gioco Steam tramite esecuzione diretta di steam.exe
async fn launch_steam_direct(app_id: &str) -> Result<LaunchResult, String> {
    debug!("🔧 Tentativo avvio diretto Steam per app {}", app_id);
    
    // Trova il percorso di Steam
    let steam_path = find_steam_executable()?;
    debug!("📁 Percorso Steam trovato: {}", steam_path);
    
    // Esegui steam.exe -applaunch <appid>
    match Command::new(&steam_path)
        .args(&["-applaunch", app_id])
        .spawn()
    {
        Ok(_) => {
            info!("✅ Steam avviato direttamente con successo");
            Ok(LaunchResult {
                success: true,
                message: format!("Gioco avviato tramite esecuzione diretta Steam: steam.exe -applaunch {}", app_id),
                method: "steam_direct".to_string(),
                game_id: app_id.to_string(),
                store: "Steam".to_string(),
            })
        }
        Err(e) => {
            Err(format!("Errore esecuzione diretta Steam: {}", e))
        }
    }
}

/// Trova il percorso dell'eseguibile Steam
fn find_steam_executable() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        
        // Prova registro di sistema
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(steam_key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
            if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
                let steam_exe = format!("{}\\steam.exe", install_path);
                if Path::new(&steam_exe).exists() {
                    return Ok(steam_exe);
                }
            }
        }
        
        // Fallback: percorsi comuni
        let common_paths = vec![
            "C:\\Program Files (x86)\\Steam\\steam.exe",
            "C:\\Program Files\\Steam\\steam.exe",
        ];
        
        for path in common_paths {
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        
        Err("Steam non trovato nel sistema".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Linux/macOS
        let common_paths = vec![
            "/usr/bin/steam",
            "/usr/local/bin/steam",
            "~/.steam/steam.sh",
        ];
        
        for path in common_paths {
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        
        Err("Steam non trovato nel sistema".to_string())
    }
}

// ================================================================================================
// EPIC GAMES LAUNCH SYSTEM
// ================================================================================================

/// Avvia un gioco Epic Games usando il protocollo com.epicgames.launcher://
#[tauri::command]
pub async fn launch_epic_game(app_name: String) -> Result<LaunchResult, String> {
    info!("🚀 Tentativo di avvio gioco Epic Games: {}", app_name);
    
    // Validazione App Name
    if app_name.trim().is_empty() {
        let error_msg = "App Name Epic Games non può essere vuoto".to_string();
        error!("{}", error_msg);
        return Ok(LaunchResult {
            success: false,
            message: error_msg,
            method: "epic_protocol".to_string(),
            game_id: app_name,
            store: "Epic Games".to_string(),
        });
    }

    // Metodo 1: Protocollo Epic Games
    let epic_url = format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", app_name);
    match launch_with_epic_protocol(&epic_url, &app_name).await {
        Ok(result) => {
            info!("✅ Gioco Epic Games {} avviato con successo", app_name);
            return Ok(result);
        }
        Err(e) => {
            warn!("⚠️ Fallimento protocollo Epic Games per {}: {}", app_name, e);
        }
    }

    // Metodo 2: Fallback - Epic Games Launcher diretto
    match launch_epic_direct(&app_name).await {
        Ok(result) => {
            info!("✅ Gioco Epic Games {} avviato con successo via launcher", app_name);
            Ok(result)
        }
        Err(e) => {
            let error_msg = format!("Impossibile avviare gioco Epic Games {}: {}", app_name, e);
            error!("{}", error_msg);
            Ok(LaunchResult {
                success: false,
                message: error_msg,
                method: "failed".to_string(),
                game_id: app_name,
                store: "Epic Games".to_string(),
            })
        }
    }
}

/// Avvia gioco Epic Games usando il protocollo com.epicgames.launcher://
async fn launch_with_epic_protocol(epic_url: &str, app_name: &str) -> Result<LaunchResult, String> {
    debug!("🔗 Tentativo avvio via protocollo Epic: {}", epic_url);
    
    #[cfg(target_os = "windows")]
    {
        match Command::new("cmd")
            .args(&["/C", "start", epic_url])
            .spawn()
        {
            Ok(_) => {
                info!("✅ Protocollo Epic Games eseguito con successo");
                Ok(LaunchResult {
                    success: true,
                    message: format!("Gioco avviato tramite protocollo Epic Games: {}", epic_url),
                    method: "epic_protocol".to_string(),
                    game_id: app_name.to_string(),
                    store: "Epic Games".to_string(),
                })
            }
            Err(e) => {
                Err(format!("Errore esecuzione protocollo Epic Games: {}", e))
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        match Command::new("xdg-open")
            .arg(epic_url)
            .spawn()
        {
            Ok(_) => {
                info!("✅ Protocollo Epic Games eseguito con successo (Linux)");
                Ok(LaunchResult {
                    success: true,
                    message: format!("Gioco avviato tramite protocollo Epic Games: {}", epic_url),
                    method: "epic_protocol".to_string(),
                    game_id: app_name.to_string(),
                    store: "Epic Games".to_string(),
                })
            }
            Err(e) => {
                Err(format!("Errore esecuzione protocollo Epic Games: {}", e))
            }
        }
    }
}

/// Avvia gioco Epic Games tramite Epic Games Launcher diretto
async fn launch_epic_direct(app_name: &str) -> Result<LaunchResult, String> {
    debug!("🔧 Tentativo avvio diretto Epic Games Launcher per app {}", app_name);
    
    // Trova il percorso di Epic Games Launcher
    let epic_path = find_epic_launcher_executable()?;
    debug!("📁 Percorso Epic Games Launcher trovato: {}", epic_path);
    
    // Esegui EpicGamesLauncher.exe -openapp <appname>
    match Command::new(&epic_path)
        .args(&["-openapp", app_name])
        .spawn()
    {
        Ok(_) => {
            info!("✅ Epic Games Launcher avviato direttamente con successo");
            Ok(LaunchResult {
                success: true,
                message: format!("Gioco avviato tramite Epic Games Launcher: -openapp {}", app_name),
                method: "epic_direct".to_string(),
                game_id: app_name.to_string(),
                store: "Epic Games".to_string(),
            })
        }
        Err(e) => {
            Err(format!("Errore esecuzione diretta Epic Games Launcher: {}", e))
        }
    }
}

/// Trova il percorso dell'eseguibile Epic Games Launcher
fn find_epic_launcher_executable() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Percorsi comuni per Epic Games Launcher
        let common_paths = vec![
            "C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe",
            "C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe",
            "C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe",
            "C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe",
        ];
        
        for path in common_paths {
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        
        Err("Epic Games Launcher non trovato nel sistema".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Epic Games Launcher non supportato su questo sistema operativo".to_string())
    }
}

// ================================================================================================
// GOG LAUNCH SYSTEM
// ================================================================================================

/// Avvia un gioco GOG usando GOG Galaxy
#[tauri::command]
pub async fn launch_gog_game(game_id: String) -> Result<LaunchResult, String> {
    info!("🚀 Tentativo di avvio gioco GOG: {}", game_id);
    
    // Validazione Game ID
    if game_id.trim().is_empty() {
        let error_msg = "Game ID GOG non può essere vuoto".to_string();
        error!("{}", error_msg);
        return Ok(LaunchResult {
            success: false,
            message: error_msg,
            method: "gog_protocol".to_string(),
            game_id: game_id,
            store: "GOG".to_string(),
        });
    }

    // Metodo 1: Protocollo GOG Galaxy
    let gog_url = format!("goggalaxy://openGameView/{}", game_id);
    match launch_with_gog_protocol(&gog_url, &game_id).await {
        Ok(result) => {
            info!("✅ Gioco GOG {} avviato con successo", game_id);
            return Ok(result);
        }
        Err(e) => {
            warn!("⚠️ Fallimento protocollo GOG per {}: {}", game_id, e);
        }
    }

    // Metodo 2: Fallback - GOG Galaxy diretto
    match launch_gog_direct(&game_id).await {
        Ok(result) => {
            info!("✅ Gioco GOG {} avviato con successo via Galaxy", game_id);
            Ok(result)
        }
        Err(e) => {
            let error_msg = format!("Impossibile avviare gioco GOG {}: {}", game_id, e);
            error!("{}", error_msg);
            Ok(LaunchResult {
                success: false,
                message: error_msg,
                method: "failed".to_string(),
                game_id: game_id,
                store: "GOG".to_string(),
            })
        }
    }
}

/// Avvia gioco GOG usando il protocollo goggalaxy://
async fn launch_with_gog_protocol(gog_url: &str, game_id: &str) -> Result<LaunchResult, String> {
    debug!("🔗 Tentativo avvio via protocollo GOG: {}", gog_url);
    
    #[cfg(target_os = "windows")]
    {
        match Command::new("cmd")
            .args(&["/C", "start", gog_url])
            .spawn()
        {
            Ok(_) => {
                info!("✅ Protocollo GOG Galaxy eseguito con successo");
                Ok(LaunchResult {
                    success: true,
                    message: format!("Gioco avviato tramite protocollo GOG Galaxy: {}", gog_url),
                    method: "gog_protocol".to_string(),
                    game_id: game_id.to_string(),
                    store: "GOG".to_string(),
                })
            }
            Err(e) => {
                Err(format!("Errore esecuzione protocollo GOG Galaxy: {}", e))
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        match Command::new("xdg-open")
            .arg(gog_url)
            .spawn()
        {
            Ok(_) => {
                info!("✅ Protocollo GOG Galaxy eseguito con successo (Linux)");
                Ok(LaunchResult {
                    success: true,
                    message: format!("Gioco avviato tramite protocollo GOG Galaxy: {}", gog_url),
                    method: "gog_protocol".to_string(),
                    game_id: game_id.to_string(),
                    store: "GOG".to_string(),
                })
            }
            Err(e) => {
                Err(format!("Errore esecuzione protocollo GOG Galaxy: {}", e))
            }
        }
    }
}

/// Avvia gioco GOG tramite GOG Galaxy diretto
async fn launch_gog_direct(game_id: &str) -> Result<LaunchResult, String> {
    debug!("🔧 Tentativo avvio diretto GOG Galaxy per gioco {}", game_id);
    
    // Trova il percorso di GOG Galaxy
    let gog_path = find_gog_galaxy_executable()?;
    debug!("📁 Percorso GOG Galaxy trovato: {}", gog_path);
    
    // Esegui GalaxyClient.exe /gameId=<gameid>
    match Command::new(&gog_path)
        .args(&[&format!("/gameId={}", game_id)])
        .spawn()
    {
        Ok(_) => {
            info!("✅ GOG Galaxy avviato direttamente con successo");
            Ok(LaunchResult {
                success: true,
                message: format!("Gioco avviato tramite GOG Galaxy: /gameId={}", game_id),
                method: "gog_direct".to_string(),
                game_id: game_id.to_string(),
                store: "GOG".to_string(),
            })
        }
        Err(e) => {
            Err(format!("Errore esecuzione diretta GOG Galaxy: {}", e))
        }
    }
}

/// Trova il percorso dell'eseguibile GOG Galaxy
fn find_gog_galaxy_executable() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Percorsi comuni per GOG Galaxy
        let common_paths = vec![
            "C:\\Program Files (x86)\\GOG Galaxy\\GalaxyClient.exe",
            "C:\\Program Files\\GOG Galaxy\\GalaxyClient.exe",
        ];
        
        for path in common_paths {
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        
        Err("GOG Galaxy non trovato nel sistema".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("GOG Galaxy non supportato su questo sistema operativo".to_string())
    }
}

// ================================================================================================
// GENERIC GAME LAUNCH SYSTEM
// ================================================================================================

/// Avvia un gioco generico tramite esecuzione diretta dell'eseguibile
#[tauri::command]
pub async fn launch_game_direct(executable_path: String, launch_options: Option<String>) -> Result<LaunchResult, String> {
    info!("🚀 Tentativo di avvio gioco diretto: {}", executable_path);
    
    // Validazione percorso
    if !Path::new(&executable_path).exists() {
        let error_msg = format!("Eseguibile non trovato: {}", executable_path);
        error!("{}", error_msg);
        return Ok(LaunchResult {
            success: false,
            message: error_msg,
            method: "direct_execution".to_string(),
            game_id: executable_path.clone(),
            store: "Direct".to_string(),
        });
    }

    // Prepara comando
    let mut command = Command::new(&executable_path);
    
    // Aggiungi opzioni di lancio se presenti
    if let Some(options) = launch_options {
        let args: Vec<&str> = options.split_whitespace().collect();
        command.args(&args);
        debug!("🔧 Opzioni di lancio: {:?}", args);
    }

    // Esegui il gioco
    match command.spawn() {
        Ok(_) => {
            info!("✅ Gioco avviato direttamente con successo");
            Ok(LaunchResult {
                success: true,
                message: format!("Gioco avviato direttamente: {}", executable_path),
                method: "direct_execution".to_string(),
                game_id: executable_path,
                store: "Direct".to_string(),
            })
        }
        Err(e) => {
            let error_msg = format!("Errore esecuzione diretta: {}", e);
            error!("{}", error_msg);
            Ok(LaunchResult {
                success: false,
                message: error_msg,
                method: "direct_execution".to_string(),
                game_id: executable_path,
                store: "Direct".to_string(),
            })
        }
    }
}

// ================================================================================================
// UNIVERSAL LAUNCH SYSTEM
// ================================================================================================

/// Sistema di avvio universale che determina automaticamente il metodo migliore
#[tauri::command]
pub async fn launch_game_universal(request: LaunchRequest) -> Result<LaunchResult, String> {
    info!("🚀 Avvio universale gioco: {} (Store: {})", request.game_name, request.store);
    
    match request.store.to_lowercase().as_str() {
        "steam" => {
            launch_steam_game(request.game_id).await
        }
        "epic games" | "epic" => {
            launch_epic_game(request.game_id).await
        }
        "gog" => {
            launch_gog_game(request.game_id).await
        }
        _ => {
            // Fallback: esecuzione diretta se disponibile
            if let Some(exe_path) = request.executable_path {
                launch_game_direct(exe_path, request.launch_options).await
            } else {
                let error_msg = format!("Store non supportato e nessun percorso eseguibile fornito: {}", request.store);
                error!("{}", error_msg);
                Ok(LaunchResult {
                    success: false,
                    message: error_msg,
                    method: "unsupported_store".to_string(),
                    game_id: request.game_id,
                    store: request.store,
                })
            }
        }
    }
}

// ================================================================================================
// UTILITY FUNCTIONS
// ================================================================================================

/// Valida un Steam App ID
fn is_valid_steam_app_id(app_id: &str) -> bool {
    if let Ok(numeric_id) = app_id.parse::<u64>() {
        numeric_id >= 1 && numeric_id <= 9999999999
    } else {
        false
    }
}

/// Ottiene informazioni sui launcher installati nel sistema
#[tauri::command]
pub async fn get_installed_launchers() -> Result<Vec<String>, String> {
    let mut launchers = Vec::new();
    
    // Controlla Steam
    if find_steam_executable().is_ok() {
        launchers.push("Steam".to_string());
    }
    
    // Controlla Epic Games Launcher
    if find_epic_launcher_executable().is_ok() {
        launchers.push("Epic Games".to_string());
    }
    
    // Controlla GOG Galaxy
    if find_gog_galaxy_executable().is_ok() {
        launchers.push("GOG".to_string());
    }
    
    info!("🔍 Launcher installati rilevati: {:?}", launchers);
    Ok(launchers)
}

/// Testa la funzionalità di avvio per un launcher specifico
#[tauri::command]
pub async fn test_launcher_functionality(launcher: String) -> Result<LaunchResult, String> {
    info!("🧪 Test funzionalità launcher: {}", launcher);
    
    match launcher.to_lowercase().as_str() {
        "steam" => {
            // Test con un App ID di test (Steam client stesso)
            launch_steam_game("0".to_string()).await
        }
        "epic" | "epic games" => {
            // Test apertura Epic Games Launcher
            match find_epic_launcher_executable() {
                Ok(path) => {
                    match Command::new(&path).spawn() {
                        Ok(_) => Ok(LaunchResult {
                            success: true,
                            message: "Epic Games Launcher aperto con successo".to_string(),
                            method: "test_launch".to_string(),
                            game_id: "test".to_string(),
                            store: "Epic Games".to_string(),
                        }),
                        Err(e) => Ok(LaunchResult {
                            success: false,
                            message: format!("Errore apertura Epic Games Launcher: {}", e),
                            method: "test_launch".to_string(),
                            game_id: "test".to_string(),
                            store: "Epic Games".to_string(),
                        })
                    }
                }
                Err(e) => Ok(LaunchResult {
                    success: false,
                    message: e,
                    method: "test_launch".to_string(),
                    game_id: "test".to_string(),
                    store: "Epic Games".to_string(),
                })
            }
        }
        "gog" => {
            // Test apertura GOG Galaxy
            match find_gog_galaxy_executable() {
                Ok(path) => {
                    match Command::new(&path).spawn() {
                        Ok(_) => Ok(LaunchResult {
                            success: true,
                            message: "GOG Galaxy aperto con successo".to_string(),
                            method: "test_launch".to_string(),
                            game_id: "test".to_string(),
                            store: "GOG".to_string(),
                        }),
                        Err(e) => Ok(LaunchResult {
                            success: false,
                            message: format!("Errore apertura GOG Galaxy: {}", e),
                            method: "test_launch".to_string(),
                            game_id: "test".to_string(),
                            store: "GOG".to_string(),
                        })
                    }
                }
                Err(e) => Ok(LaunchResult {
                    success: false,
                    message: e,
                    method: "test_launch".to_string(),
                    game_id: "test".to_string(),
                    store: "GOG".to_string(),
                })
            }
        }
        _ => {
            Ok(LaunchResult {
                success: false,
                message: format!("Launcher non supportato per il test: {}", launcher),
                method: "test_launch".to_string(),
                game_id: "test".to_string(),
                store: launcher,
            })
        }
    }
}
