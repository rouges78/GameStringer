use tauri::State;
use crate::models::{SteamConfig, GameDetails, SteamGame};
use winreg::HKEY;

// Placeholder for session state if needed later
pub struct SessionState;

use winreg::enums::*;
use winreg::RegKey;
use std::path::Path;
use std::fs;

#[tauri::command]
pub async fn auto_detect_steam_config() -> Result<SteamConfig, String> {
    println!("[RUST] auto_detect_steam_config called");

    let steam_path = find_steam_path_from_registry().await;
    let mut logged_in_users = Vec::new();

    if let Some(ref path) = steam_path {
        let login_users_path = Path::new(path).join("config/loginusers.vdf");
        if login_users_path.exists() {
            match fs::read_to_string(login_users_path) {
                Ok(content) => {
                    match steamy_vdf::load(&content) {
                        Ok(vdf) => {
                            if let Some(users) = vdf.get("users").and_then(|u| u.as_table()) {
                                for (steam_id, user_data) in users.iter() {
                                    if let Some(account_name) = user_data.as_table().and_then(|ud| ud.get("AccountName")).and_then(|an| an.as_str()) {
                                        if !account_name.is_empty() {
                                            logged_in_users.push(steam_id.clone());
                                        }
                                    }
                                }
                            }
                        },
                        Err(e) => eprintln!("Failed to parse VDF: {}", e),
                    }
                },
                Err(e) => eprintln!("Failed to read loginusers.vdf: {}", e),
            }
        }
    }

    Ok(SteamConfig {
        steam_path,
        logged_in_users,
    })
}

async fn find_steam_path_from_registry() -> Option<String> {
    // Cerca prima nella chiave a 64-bit
    if let Some(path) = find_steam_path_in_hive(HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam") {
        return Some(path);
    }
    // Fallback sulla chiave a 32-bit
    if let Some(path) = find_steam_path_in_hive(HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam") {
        return Some(path);
    }
    None
}

fn find_steam_path_in_hive(hive: HKEY, subkey: &str) -> Option<String> {
    RegKey::predef(hive)
        .open_subkey(subkey)
        .and_then(|key| key.get_value::<String, _>("InstallPath"))
        .ok()
}

#[tauri::command]
pub async fn fix_steam_id(_session: State<'_, SessionState>, _new_steam_id: String) -> Result<(), String> {
    // TODO: Implement logic using sqlx
    println!("[RUST] fix_steam_id called");
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn get_game_details(_appid: u32) -> Result<GameDetails, String> {
    // TODO: Implement logic using reqwest and moka for caching
    println!("[RUST] get_game_details called");
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn get_all_steam_games(_session: State<'_, SessionState>, _force_refresh: bool) -> Result<Vec<SteamGame>, String> {
    // TODO: Implement the full, complex logic from the API route
    println!("[RUST] get_all_steam_games called");
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn get_cached_game_details(_appid: u32) -> Result<SteamGame, String> {
    // TODO: Implement logic to read from cache file
    println!("[RUST] get_cached_game_details called");
    Err("Not yet implemented".to_string())
}
