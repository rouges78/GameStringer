use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use log::{info, warn, error, debug};
use crate::models::GameInfo;

/// 🎮 Struttura per gioco Epic Games migliorata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicGameEnhanced {
    pub app_name: String,
    pub display_name: String,
    pub namespace: String,
    pub catalog_item_id: String,
    pub install_location: Option<String>,
    pub is_installed: bool,
    pub is_owned: bool,
    pub is_dlc: bool,
    pub executable_path: Option<String>,
    pub install_size: Option<u64>,
    pub last_played: Option<u64>,
    pub version: Option<String>,
    pub build_version: Option<String>,
    pub launch_parameters: Option<String>,
}

/// 🔍 Risultato scansione Epic Games migliorata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicScanResult {
    pub total_games: u32,
    pub installed_games: u32,
    pub owned_games: u32,
    pub dlc_count: u32,
    pub games: Vec<EpicGameEnhanced>,
    pub scan_method: String,
    pub scan_duration_ms: u64,
    pub errors: Vec<String>,
}

/// 🚀 Comando principale: Scansione Epic Games migliorata
#[tauri::command]
pub async fn scan_epic_games_enhanced() -> Result<EpicScanResult, String> {
    info!("🎮 Avvio scansione Epic Games migliorata");
    let start_time = std::time::Instant::now();
    
    let mut all_games = Vec::new();
    let mut errors = Vec::new();
    let mut scan_methods = Vec::new();
    
    // Metodo 1: Scansione manifests Epic Games (più robusta)
    match scan_epic_manifests_enhanced().await {
        Ok(manifest_games) => {
            info!("✅ Manifests Epic: {} giochi trovati", manifest_games.len());
            all_games.extend(manifest_games);
            scan_methods.push("Epic Manifests");
        }
        Err(e) => {
            warn!("⚠️ Errore scansione manifests Epic: {}", e);
            errors.push(format!("Manifests: {}", e));
        }
    }
    
    // Metodo 2: Scansione registro Windows (pattern migliorati)
    match scan_epic_registry_enhanced().await {
        Ok(registry_games) => {
            info!("✅ Registro Epic: {} giochi trovati", registry_games.len());
            // Merge con giochi esistenti evitando duplicati
            merge_epic_games(&mut all_games, registry_games);
            scan_methods.push("Windows Registry");
        }
        Err(e) => {
            warn!("⚠️ Errore scansione registro Epic: {}", e);
            errors.push(format!("Registry: {}", e));
        }
    }
    
    // Metodo 3: Scansione directory installazione (pattern EOS)
    match scan_epic_installation_dirs().await {
        Ok(install_games) => {
            info!("✅ Directory installazione Epic: {} giochi trovati", install_games.len());
            merge_epic_games(&mut all_games, install_games);
            scan_methods.push("Installation Directories");
        }
        Err(e) => {
            warn!("⚠️ Errore scansione directory Epic: {}", e);
            errors.push(format!("Installation: {}", e));
        }
    }
    
    // Metodo 4: Legendary integration (se disponibile)
    match scan_epic_via_legendary().await {
        Ok(legendary_games) => {
            info!("✅ Legendary Epic: {} giochi trovati", legendary_games.len());
            merge_epic_games(&mut all_games, legendary_games);
            scan_methods.push("Legendary CLI");
        }
        Err(e) => {
            debug!("ℹ️ Legendary non disponibile: {}", e);
        }
    }
    
    // Arricchisci i dati dei giochi
    for game in &mut all_games {
        enrich_epic_game_data(game).await;
    }
    
    let scan_duration = start_time.elapsed().as_millis() as u64;
    let total_games = all_games.len() as u32;
    let installed_games = all_games.iter().filter(|g| g.is_installed).count() as u32;
    let owned_games = all_games.iter().filter(|g| g.is_owned).count() as u32;
    let dlc_count = all_games.iter().filter(|g| g.is_dlc).count() as u32;
    
    info!("🎉 Scansione Epic migliorata completata: {} giochi totali, {} installati in {}ms", 
          total_games, installed_games, scan_duration);
    
    Ok(EpicScanResult {
        total_games,
        installed_games,
        owned_games,
        dlc_count,
        games: all_games,
        scan_method: scan_methods.join(" + "),
        scan_duration_ms: scan_duration,
        errors,
    })
}

/// 🔍 Scansione manifests Epic Games migliorata
async fn scan_epic_manifests_enhanced() -> Result<Vec<EpicGameEnhanced>, String> {
    let manifests_path = Path::new("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
    
    if !manifests_path.exists() {
        return Err("Directory manifests Epic Games non trovata".to_string());
    }
    
    let mut games = Vec::new();
    
    match fs::read_dir(manifests_path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".item") {
                        match parse_epic_manifest_enhanced(&entry.path()).await {
                            Ok(game) => {
                                debug!("📦 Manifest Epic parsed: {}", game.display_name);
                                games.push(game);
                            }
                            Err(e) => {
                                warn!("⚠️ Errore parsing manifest {}: {}", file_name, e);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Errore lettura directory manifests: {}", e));
        }
    }
    
    Ok(games)
}

/// 📄 Parse manifest Epic Games con dati arricchiti
async fn parse_epic_manifest_enhanced(manifest_path: &Path) -> Result<EpicGameEnhanced, String> {
    let content = fs::read_to_string(manifest_path)
        .map_err(|e| format!("Errore lettura manifest: {}", e))?;
    
    let manifest: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing JSON manifest: {}", e))?;
    
    let app_name = manifest["AppName"].as_str().unwrap_or("unknown").to_string();
    let display_name = manifest["DisplayName"].as_str().unwrap_or(&app_name).to_string();
    let namespace = manifest["CatalogNamespace"].as_str().unwrap_or("").to_string();
    let catalog_item_id = manifest["CatalogItemId"].as_str().unwrap_or("").to_string();
    let install_location = manifest["InstallLocation"].as_str().map(|s| s.to_string());
    let version = manifest["AppVersionString"].as_str().map(|s| s.to_string());
    let build_version = manifest["BuildVersion"].as_str().map(|s| s.to_string());
    let launch_executable = manifest["LaunchExecutable"].as_str().map(|s| s.to_string());
    let launch_command = manifest["LaunchCommand"].as_str().map(|s| s.to_string());
    
    // Determina se è installato
    let is_installed = if let Some(ref install_path) = install_location {
        Path::new(install_path).exists()
    } else {
        false
    };
    
    // Determina se è un DLC
    let is_dlc = manifest["bIsIncompleteInstall"].as_bool().unwrap_or(false) ||
                 display_name.to_lowercase().contains("dlc") ||
                 display_name.to_lowercase().contains("expansion") ||
                 display_name.to_lowercase().contains("season pass");
    
    // Calcola dimensione installazione
    let install_size = if let Some(ref install_path) = install_location {
        calculate_directory_size(Path::new(install_path)).await
    } else {
        None
    };
    
    // Trova eseguibile
    let executable_path = if let Some(ref install_path) = install_location {
        if let Some(ref launch_exe) = launch_executable {
            Some(Path::new(install_path).join(launch_exe).to_string_lossy().to_string())
        } else {
            find_main_executable_epic(Path::new(install_path)).await
        }
    } else {
        None
    };
    
    // Combina parametri di lancio
    let launch_parameters = match (launch_executable, launch_command) {
        (Some(exe), Some(cmd)) => Some(format!("{} {}", exe, cmd)),
        (Some(exe), None) => Some(exe),
        (None, Some(cmd)) => Some(cmd),
        (None, None) => None,
    };
    
    Ok(EpicGameEnhanced {
        app_name,
        display_name,
        namespace,
        catalog_item_id,
        install_location,
        is_installed,
        is_owned: true, // Se è nel manifest, è posseduto
        is_dlc,
        executable_path,
        install_size,
        last_played: None, // TODO: Implementare tracking last played
        version,
        build_version,
        launch_parameters,
    })
}

/// 🔍 Scansione registro Windows migliorata per Epic Games
async fn scan_epic_registry_enhanced() -> Result<Vec<EpicGameEnhanced>, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let mut games = Vec::new();
    
    // Percorsi registro Epic Games più specifici
    let registry_paths = [
        "SOFTWARE\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ];
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    for root in [&hklm, &hkcu] {
        for reg_path in &registry_paths {
            if let Ok(key) = root.open_subkey(reg_path) {
                if reg_path.contains("Uninstall") {
                    // Cerca nelle chiavi di disinstallazione
                    if let Ok(subkeys) = key.enum_keys() {
                        for subkey_name in subkeys.flatten() {
                            if let Ok(subkey) = key.open_subkey(&subkey_name) {
                                if let Ok(publisher) = subkey.get_value::<String, _>("Publisher") {
                                    if publisher.contains("Epic Games") {
                                        if let Ok(display_name) = subkey.get_value::<String, _>("DisplayName") {
                                            if is_valid_epic_game_name(&display_name) {
                                                let install_location = subkey.get_value::<String, _>("InstallLocation").ok();
                                                
                                                games.push(EpicGameEnhanced {
                                                    app_name: subkey_name.clone(),
                                                    display_name: display_name.clone(),
                                                    namespace: "".to_string(),
                                                    catalog_item_id: "".to_string(),
                                                    install_location: install_location.clone(),
                                                    is_installed: install_location.as_ref()
                                                        .map(|path| Path::new(path).exists())
                                                        .unwrap_or(false),
                                                    is_owned: true,
                                                    is_dlc: display_name.to_lowercase().contains("dlc"),
                                                    executable_path: None,
                                                    install_size: None,
                                                    last_played: None,
                                                    version: subkey.get_value::<String, _>("DisplayVersion").ok(),
                                                    build_version: None,
                                                    launch_parameters: None,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// 🔍 Scansione directory installazione Epic Games
async fn scan_epic_installation_dirs() -> Result<Vec<EpicGameEnhanced>, String> {
    let mut games = Vec::new();
    
    // Directory comuni Epic Games
    let epic_dirs = [
        "C:\\Program Files\\Epic Games",
        "C:\\Program Files (x86)\\Epic Games",
        "D:\\Epic Games",
        "E:\\Epic Games",
    ];
    
    for base_dir in &epic_dirs {
        let base_path = Path::new(base_dir);
        if base_path.exists() {
            if let Ok(entries) = fs::read_dir(base_path) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                        let game_dir = entry.path();
                        if let Some(game_name) = game_dir.file_name().and_then(|n| n.to_str()) {
                            if is_valid_epic_game_directory(game_name) {
                                let executable = find_main_executable_epic(&game_dir).await;
                                let install_size = calculate_directory_size(&game_dir).await;
                                
                                games.push(EpicGameEnhanced {
                                    app_name: game_name.to_lowercase().replace(" ", "_"),
                                    display_name: game_name.to_string(),
                                    namespace: "".to_string(),
                                    catalog_item_id: "".to_string(),
                                    install_location: Some(game_dir.to_string_lossy().to_string()),
                                    is_installed: true,
                                    is_owned: true,
                                    is_dlc: false,
                                    executable_path: executable,
                                    install_size,
                                    last_played: None,
                                    version: None,
                                    build_version: None,
                                    launch_parameters: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// 🔍 Scansione Epic Games via Legendary CLI
async fn scan_epic_via_legendary() -> Result<Vec<EpicGameEnhanced>, String> {
    use std::process::Command;
    
    // Verifica se Legendary è disponibile
    let output = Command::new("legendary")
        .args(&["list", "--json"])
        .output()
        .map_err(|_| "Legendary CLI non disponibile")?;
    
    if !output.status.success() {
        return Err("Legendary command failed".to_string());
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let games_json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Errore parsing Legendary JSON: {}", e))?;
    
    let mut games = Vec::new();
    
    if let Some(games_array) = games_json.as_array() {
        for game_data in games_array {
            if let Some(app_name) = game_data["app_name"].as_str() {
                if let Some(app_title) = game_data["app_title"].as_str() {
                    let is_installed = game_data["installed"].as_bool().unwrap_or(false);
                    let install_path = game_data["install_path"].as_str().map(|s| s.to_string());
                    let version = game_data["version"].as_str().map(|s| s.to_string());
                    let namespace = game_data["namespace"].as_str().unwrap_or("").to_string();
                    
                    games.push(EpicGameEnhanced {
                        app_name: app_name.to_string(),
                        display_name: app_title.to_string(),
                        namespace,
                        catalog_item_id: "".to_string(),
                        install_location: install_path,
                        is_installed,
                        is_owned: true,
                        is_dlc: false,
                        executable_path: None,
                        install_size: None,
                        last_played: None,
                        version,
                        build_version: None,
                        launch_parameters: None,
                    });
                }
            }
        }
    }
    
    Ok(games)
}

/// 🔧 Funzioni helper

/// Merge giochi Epic evitando duplicati
fn merge_epic_games(existing: &mut Vec<EpicGameEnhanced>, new_games: Vec<EpicGameEnhanced>) {
    for new_game in new_games {
        let exists = existing.iter().any(|existing_game| {
            existing_game.app_name == new_game.app_name ||
            existing_game.display_name == new_game.display_name
        });
        
        if !exists {
            existing.push(new_game);
        } else {
            // Aggiorna gioco esistente con dati più completi
            if let Some(existing_game) = existing.iter_mut().find(|g| 
                g.app_name == new_game.app_name || g.display_name == new_game.display_name
            ) {
                if existing_game.install_location.is_none() && new_game.install_location.is_some() {
                    existing_game.install_location = new_game.install_location;
                }
                if existing_game.executable_path.is_none() && new_game.executable_path.is_some() {
                    existing_game.executable_path = new_game.executable_path;
                }
                if existing_game.version.is_none() && new_game.version.is_some() {
                    existing_game.version = new_game.version;
                }
                existing_game.is_installed = existing_game.is_installed || new_game.is_installed;
            }
        }
    }
}

/// Arricchisce i dati di un gioco Epic
async fn enrich_epic_game_data(game: &mut EpicGameEnhanced) {
    // Aggiorna executable path se mancante
    if game.executable_path.is_none() {
        if let Some(ref install_path) = game.install_location {
            game.executable_path = find_main_executable_epic(Path::new(install_path)).await;
        }
    }
    
    // Aggiorna install size se mancante
    if game.install_size.is_none() {
        if let Some(ref install_path) = game.install_location {
            game.install_size = calculate_directory_size(Path::new(install_path)).await;
        }
    }
}

/// Trova eseguibile principale in directory Epic Games
async fn find_main_executable_epic(game_dir: &Path) -> Option<String> {
    let executable_patterns = [
        "*.exe",
        "Binaries/Win64/*.exe",
        "Engine/Binaries/Win64/*.exe",
    ];
    
    for pattern in &executable_patterns {
        if let Ok(entries) = fs::read_dir(game_dir) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".exe") && 
                       !file_name.contains("UE4") && 
                       !file_name.contains("Unreal") &&
                       !file_name.contains("Crash") {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    
    None
}

/// Calcola dimensione directory
async fn calculate_directory_size(dir: &Path) -> Option<u64> {
    fn dir_size(path: &Path) -> std::io::Result<u64> {
        let mut size = 0;
        if path.is_dir() {
            for entry in fs::read_dir(path)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    size += dir_size(&path)?;
                } else {
                    size += entry.metadata()?.len();
                }
            }
        }
        Ok(size)
    }
    
    dir_size(dir).ok()
}

/// Valida nome gioco Epic Games
fn is_valid_epic_game_name(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    
    // Escludi launcher e tool
    if name_lower.contains("epic games launcher") ||
       name_lower.contains("unreal engine") ||
       name_lower.contains("epic online services") {
        return false;
    }
    
    // Deve essere un nome ragionevole
    name.len() > 2 && name.len() < 100
}

/// Valida directory gioco Epic Games
fn is_valid_epic_game_directory(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    
    // Escludi directory sistema
    !name_lower.contains("launcher") &&
    !name_lower.contains("engine") &&
    !name_lower.contains("tools") &&
    name.len() > 2
}

/// 🔍 Comando per ottenere gioco Epic specifico
#[tauri::command]
pub async fn get_epic_game_enhanced(app_name: String) -> Result<EpicGameEnhanced, String> {
    let scan_result = scan_epic_games_enhanced().await?;
    
    for game in scan_result.games {
        if game.app_name == app_name {
            return Ok(game);
        }
    }
    
    Err(format!("Gioco Epic {} non trovato", app_name))
}

/// 📊 Comando per statistiche Epic Games
#[tauri::command]
pub async fn get_epic_statistics_enhanced() -> Result<serde_json::Value, String> {
    let scan_result = scan_epic_games_enhanced().await?;
    
    let total_size: u64 = scan_result.games.iter()
        .filter_map(|g| g.install_size)
        .sum();
    
    Ok(serde_json::json!({
        "total_games": scan_result.total_games,
        "installed_games": scan_result.installed_games,
        "owned_games": scan_result.owned_games,
        "dlc_count": scan_result.dlc_count,
        "total_install_size": total_size,
        "scan_method": scan_result.scan_method,
        "scan_duration_ms": scan_result.scan_duration_ms,
        "errors": scan_result.errors
    }))
}
