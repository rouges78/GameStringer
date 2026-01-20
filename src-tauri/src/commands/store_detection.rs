//! Store Detection Module
//! Rileva quali piattaforme di gioco sono installate sul sistema

use serde::{Deserialize, Serialize};
use std::path::Path;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub path: Option<String>,
    pub games_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoresConfig {
    pub stores: Vec<StoreStatus>,
    pub custom_folders: Vec<String>,
}

/// Rileva se Steam è installato
fn detect_steam() -> StoreStatus {
    let mut status = StoreStatus {
        id: "steam".to_string(),
        name: "Steam".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check registry
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam")
    {
        if let Ok(path) = hklm.get_value::<String, _>("InstallPath") {
            if Path::new(&path).exists() {
                status.installed = true;
                status.path = Some(path);
            }
        }
    }

    // Fallback: check common paths
    if !status.installed {
        let common_paths = [
            r"C:\Program Files (x86)\Steam",
            r"C:\Program Files\Steam",
            r"D:\Steam",
            r"E:\Steam",
        ];
        for p in common_paths {
            if Path::new(p).exists() {
                status.installed = true;
                status.path = Some(p.to_string());
                break;
            }
        }
    }

    status
}

/// Rileva se Epic Games è installato
fn detect_epic() -> StoreStatus {
    let mut status = StoreStatus {
        id: "epic".to_string(),
        name: "Epic Games".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check registry
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher")
    {
        if let Ok(path) = hklm.get_value::<String, _>("AppDataPath") {
            status.installed = true;
            status.path = Some(path);
        }
    }

    // Fallback: check common paths
    if !status.installed {
        let common_paths = [
            r"C:\Program Files\Epic Games",
            r"C:\Program Files (x86)\Epic Games",
            r"D:\Epic Games",
        ];
        for p in common_paths {
            if Path::new(p).exists() {
                status.installed = true;
                status.path = Some(p.to_string());
                break;
            }
        }
    }

    status
}

/// Rileva se GOG Galaxy è installato
fn detect_gog() -> StoreStatus {
    let mut status = StoreStatus {
        id: "gog".to_string(),
        name: "GOG Galaxy".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check registry
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths")
    {
        if let Ok(path) = hklm.get_value::<String, _>("client") {
            if Path::new(&path).exists() {
                status.installed = true;
                status.path = Some(path);
            }
        }
    }

    // Fallback
    if !status.installed {
        let common_paths = [
            r"C:\Program Files (x86)\GOG Galaxy",
            r"C:\Program Files\GOG Galaxy",
        ];
        for p in common_paths {
            if Path::new(p).exists() {
                status.installed = true;
                status.path = Some(p.to_string());
                break;
            }
        }
    }

    status
}

/// Rileva se EA App/Origin è installato
fn detect_origin() -> StoreStatus {
    let mut status = StoreStatus {
        id: "origin".to_string(),
        name: "EA App / Origin".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check EA App first
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Electronic Arts\EA Desktop")
    {
        if let Ok(path) = hklm.get_value::<String, _>("InstallLocation") {
            if Path::new(&path).exists() {
                status.installed = true;
                status.path = Some(path);
                status.name = "EA App".to_string();
            }
        }
    }

    // Fallback to Origin
    if !status.installed {
        if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\WOW6432Node\Origin")
        {
            if let Ok(path) = hklm.get_value::<String, _>("ClientPath") {
                if Path::new(&path).exists() {
                    status.installed = true;
                    status.path = Some(path);
                }
            }
        }
    }

    // Fallback paths
    if !status.installed {
        let common_paths = [
            r"C:\Program Files\Electronic Arts\EA Desktop",
            r"C:\Program Files (x86)\Origin",
        ];
        for p in common_paths {
            if Path::new(p).exists() {
                status.installed = true;
                status.path = Some(p.to_string());
                break;
            }
        }
    }

    status
}

/// Rileva se Ubisoft Connect è installato
fn detect_ubisoft() -> StoreStatus {
    let mut status = StoreStatus {
        id: "ubisoft".to_string(),
        name: "Ubisoft Connect".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check registry
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\Ubisoft\Launcher")
    {
        if let Ok(path) = hklm.get_value::<String, _>("InstallDir") {
            if Path::new(&path).exists() {
                status.installed = true;
                status.path = Some(path);
            }
        }
    }

    // Fallback
    if !status.installed {
        let common_paths = [
            r"C:\Program Files (x86)\Ubisoft\Ubisoft Game Launcher",
            r"C:\Program Files\Ubisoft\Ubisoft Game Launcher",
        ];
        for p in common_paths {
            if Path::new(p).exists() {
                status.installed = true;
                status.path = Some(p.to_string());
                break;
            }
        }
    }

    status
}

/// Rileva se Battle.net è installato
fn detect_battlenet() -> StoreStatus {
    let mut status = StoreStatus {
        id: "battlenet".to_string(),
        name: "Battle.net".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check registry
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\Blizzard Entertainment\Battle.net")
    {
        if let Ok(path) = hklm.get_value::<String, _>("InstallPath") {
            if Path::new(&path).exists() {
                status.installed = true;
                status.path = Some(path);
            }
        }
    }

    // Fallback
    if !status.installed {
        let common_paths = [
            r"C:\Program Files (x86)\Battle.net",
            r"C:\Program Files\Battle.net",
        ];
        for p in common_paths {
            if Path::new(p).exists() {
                status.installed = true;
                status.path = Some(p.to_string());
                break;
            }
        }
    }

    status
}

/// Rileva se itch.io è installato
fn detect_itchio() -> StoreStatus {
    let mut status = StoreStatus {
        id: "itchio".to_string(),
        name: "itch.io".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // itch.io installs in AppData
    if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
        let itch_path = format!(r"{}\itch", appdata);
        if Path::new(&itch_path).exists() {
            status.installed = true;
            status.path = Some(itch_path);
        }
    }

    status
}

/// Rileva se Rockstar Games Launcher è installato
fn detect_rockstar() -> StoreStatus {
    let mut status = StoreStatus {
        id: "rockstar".to_string(),
        name: "Rockstar Games".to_string(),
        installed: false,
        path: None,
        games_count: None,
    };

    // Check registry
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\Rockstar Games\Launcher")
    {
        if let Ok(path) = hklm.get_value::<String, _>("InstallFolder") {
            if Path::new(&path).exists() {
                status.installed = true;
                status.path = Some(path);
            }
        }
    }

    // Fallback
    if !status.installed {
        let path = r"C:\Program Files\Rockstar Games\Launcher";
        if Path::new(path).exists() {
            status.installed = true;
            status.path = Some(path.to_string());
        }
    }

    status
}

/// Comando Tauri: Rileva tutti gli store installati
#[tauri::command]
pub async fn get_installed_stores() -> Result<Vec<StoreStatus>, String> {
    let stores = vec![
        detect_steam(),
        detect_epic(),
        detect_gog(),
        detect_origin(),
        detect_ubisoft(),
        detect_battlenet(),
        detect_itchio(),
        detect_rockstar(),
    ];

    Ok(stores)
}

/// Comando Tauri: Salva la configurazione degli store
#[tauri::command]
pub async fn save_stores_config(config: StoresConfig) -> Result<(), String> {
    let config_path = dirs::config_dir()
        .ok_or("Cannot find config directory")?
        .join("GameStringer")
        .join("stores_config.json");

    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(&config_path, json)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Comando Tauri: Carica la configurazione degli store
#[tauri::command]
pub async fn load_stores_config() -> Result<StoresConfig, String> {
    let config_path = dirs::config_dir()
        .ok_or("Cannot find config directory")?
        .join("GameStringer")
        .join("stores_config.json");

    if config_path.exists() {
        let json = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;

        serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse config: {}", e))
    } else {
        // Return default config
        Ok(StoresConfig {
            stores: vec![],
            custom_folders: vec![],
        })
    }
}

/// Comando Tauri: Aggiungi cartella personalizzata
#[tauri::command]
pub async fn add_custom_game_folder(folder: String) -> Result<Vec<String>, String> {
    // Verify folder exists
    if !Path::new(&folder).exists() {
        return Err(format!("Folder does not exist: {}", folder));
    }

    let mut config = load_stores_config().await?;
    
    if !config.custom_folders.contains(&folder) {
        config.custom_folders.push(folder);
        save_stores_config(config.clone()).await?;
    }

    Ok(config.custom_folders)
}

/// Comando Tauri: Rimuovi cartella personalizzata
#[tauri::command]
pub async fn remove_custom_game_folder(folder: String) -> Result<Vec<String>, String> {
    let mut config = load_stores_config().await?;
    
    config.custom_folders.retain(|f| f != &folder);
    save_stores_config(config.clone()).await?;

    Ok(config.custom_folders)
}
