use tauri::State;
use crate::models::{SteamConfig, GameDetails, SteamGame, SteamApiGenre, SteamApiCategory, SteamApiReleaseDate, SteamApiRequirements, HowLongToBeatData};
use winreg::HKEY;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use moka::future::Cache;
use once_cell::sync::Lazy;
use reqwest::Client;
use chrono::{DateTime, Utc};

// Placeholder for session state if needed later
pub struct SessionState;

use winreg::enums::*;
use winreg::RegKey;
use std::path::Path;
use std::fs;

// Global HTTP client and cache
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
});

static GAME_CACHE: Lazy<Cache<u32, SteamGame>> = Lazy::new(|| {
    Cache::builder()
        .max_capacity(10000)
        .time_to_live(Duration::from_secs(3600)) // 1 hour
        .build()
});

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
pub async fn test_steam_connection() -> Result<String, String> {
    println!("[RUST] 🧪 test_steam_connection called!");
    Ok("Steam connection test successful!".to_string())
}

#[tauri::command]
pub async fn get_steam_games(api_key: String, steam_id: String, force_refresh: Option<bool>) -> Result<Vec<SteamGame>, String> {
    println!("[RUST] get_steam_games called with steam_id: {}", steam_id);
    
    let force = force_refresh.unwrap_or(false);
    println!("[RUST] Force refresh: {}", force);
    
    // VERSIONE SEMPLIFICATA: Leggi solo dal file locale
    println!("[RUST] Loading games from local file: ../steam_owned_games.json");
    
    let file_path = "../steam_owned_games.json";
    let file_content = match std::fs::read_to_string(file_path) {
        Ok(content) => {
            println!("[RUST] ✅ File loaded successfully, size: {} bytes", content.len());
            content
        },
        Err(e) => {
            let error_msg = format!("Failed to read steam_owned_games.json: {}", e);
            println!("[RUST] ❌ {}", error_msg);
            return Err(error_msg);
        }
    };
    
    println!("[RUST] Parsing JSON from file...");
    let games_data: Value = match serde_json::from_str(&file_content) {
        Ok(data) => {
            println!("[RUST] ✅ JSON parsed successfully");
            data
        },
        Err(e) => {
            let error_msg = format!("Failed to parse JSON: {}", e);
            println!("[RUST] ❌ {}", error_msg);
            return Err(error_msg);
        }
    };
    
    let mut all_games = Vec::new();
    if let Some(games) = games_data.as_array() {
        println!("[RUST] Processing {} games from file...", games.len());
        for game in games.iter().take(10) { // Limita a 10 giochi per test
            if let Some(appid) = game["appid"].as_u64() {
                let steam_game = SteamGame {
                    appid: appid as u32,
                    name: game["name"].as_str().unwrap_or("Unknown").to_string(),
                    playtime_forever: game["playtime_forever"].as_u64().unwrap_or(0) as u32,
                    img_icon_url: game["img_icon_url"].as_str().unwrap_or("").to_string(),
                    img_logo_url: "".to_string(),
                    last_played: 0,
                    is_installed: false,
                    is_shared: false,
                    is_vr: false,
                    engine: "Unknown".to_string(),
                    genres: Vec::new(),
                    categories: Vec::new(),
                    short_description: String::new(),
                    is_free: false,
                    header_image: String::new(),
                    library_capsule: String::new(),
                    developers: Vec::new(),
                    publishers: Vec::new(),
                    release_date: SteamApiReleaseDate::default(),
                    supported_languages: String::new(),
                    pc_requirements: SteamApiRequirements::default(),
                    dlc: Vec::new(),
                    how_long_to_beat: None,
                };
                all_games.push(steam_game);
            }
        }
        println!("[RUST] ✅ Processed {} games from file", all_games.len());
    } else {
        println!("[RUST] ⚠️ No games array found in file");
    }
    
    println!("[RUST] Returning {} games", all_games.len());
    Ok(all_games)
}

async fn parse_shared_games_xml() -> Vec<SteamGame> {
    // Simplified implementation - in real version would parse sharedconfig.vdf
    Vec::new()
}

async fn get_installed_steam_app_ids() -> HashSet<u32> {
    let mut installed = HashSet::new();
    
    // Try to find Steam path and read .acf files
    if let Some(steam_path) = find_steam_path_from_registry().await {
        let steamapps_path = Path::new(&steam_path).join("steamapps");
        
        if let Ok(entries) = std::fs::read_dir(&steamapps_path) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                        if let Some(app_id_str) = file_name.strip_prefix("appmanifest_").and_then(|s| s.strip_suffix(".acf")) {
                            if let Ok(app_id) = app_id_str.parse::<u32>() {
                                installed.insert(app_id);
                            }
                        }
                    }
                }
            }
        }
    }
    
    installed
}

async fn enrich_game_details(app_id: u32) -> Result<SteamGame, String> {
    // Check cache first
    if let Some(cached) = GAME_CACHE.get(&app_id).await {
        return Ok(cached);
    }
    
    let details_url = format!("https://store.steampowered.com/api/appdetails?appids={}&l=it", app_id);
    
    let response = HTTP_CLIENT.get(&details_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game details: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Steam Store API failed with status: {}", response.status()));
    }
    
    let data: Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse game details JSON: {}", e))?;
    
    let app_data = &data[&app_id.to_string()];
    if !app_data["success"].as_bool().unwrap_or(false) {
        return Err("Game not found in Steam Store".to_string());
    }
    
    let game_data = &app_data["data"];
    
    let mut enriched_game = SteamGame {
        appid: app_id,
        name: game_data["name"].as_str().unwrap_or("Unknown").to_string(),
        playtime_forever: 0,
        img_icon_url: String::new(),
        img_logo_url: String::new(),
        last_played: 0,
        is_installed: false,
        is_shared: false,
        is_vr: false,
        engine: "Unknown".to_string(),
        genres: Vec::new(),
        categories: Vec::new(),
        short_description: game_data["short_description"].as_str().unwrap_or("").to_string(),
        is_free: game_data["is_free"].as_bool().unwrap_or(false),
        header_image: game_data["header_image"].as_str().unwrap_or("").to_string(),
        library_capsule: String::new(),
        developers: Vec::new(),
        publishers: Vec::new(),
        release_date: SteamApiReleaseDate::default(),
        supported_languages: game_data["supported_languages"].as_str().unwrap_or("").to_string(),
        pc_requirements: SteamApiRequirements::default(),
        dlc: Vec::new(),
        how_long_to_beat: None,
    };
    
    // Parse genres
    if let Some(genres) = game_data["genres"].as_array() {
        for genre in genres {
            enriched_game.genres.push(SteamApiGenre {
                id: genre["id"].as_str().unwrap_or("").to_string(),
                description: genre["description"].as_str().unwrap_or("").to_string(),
            });
        }
    }
    
    // Parse categories
    if let Some(categories) = game_data["categories"].as_array() {
        for category in categories {
            enriched_game.categories.push(SteamApiCategory {
                id: category["id"].as_u64().unwrap_or(0) as u32,
                description: category["description"].as_str().unwrap_or("").to_string(),
            });
        }
        
        // Check for VR support
        enriched_game.is_vr = enriched_game.categories.iter().any(|c| {
            c.description.to_lowercase().contains("vr") || 
            c.description.to_lowercase().contains("virtual reality")
        });
    }
    
    // Parse developers
    if let Some(developers) = game_data["developers"].as_array() {
        enriched_game.developers = developers.iter()
            .filter_map(|d| d.as_str())
            .map(|s| s.to_string())
            .collect();
    }
    
    // Parse publishers
    if let Some(publishers) = game_data["publishers"].as_array() {
        enriched_game.publishers = publishers.iter()
            .filter_map(|p| p.as_str())
            .map(|s| s.to_string())
            .collect();
    }
    
    // Parse release date
    if let Some(release_date) = game_data["release_date"].as_object() {
        enriched_game.release_date = SteamApiReleaseDate {
            coming_soon: release_date["coming_soon"].as_bool().unwrap_or(false),
            date: release_date["date"].as_str().unwrap_or("").to_string(),
        };
    }
    
    // Parse PC requirements
    if let Some(pc_req) = game_data["pc_requirements"].as_object() {
        enriched_game.pc_requirements = SteamApiRequirements {
            minimum: pc_req["minimum"].as_str().unwrap_or("").to_string(),
            recommended: pc_req["recommended"].as_str().unwrap_or("").to_string(),
        };
    }
    
    // Cache the result
    GAME_CACHE.insert(app_id, enriched_game.clone()).await;
    
    Ok(enriched_game)
}

#[tauri::command]
pub async fn fix_steam_id(_session: State<'_, SessionState>, _new_steam_id: String) -> Result<(), String> {
    // TODO: Implement logic using sqlx
    log::info!("🔧 fix_steam_id chiamato");
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn get_game_details(appid: String) -> Result<serde_json::Value, String> {
    use std::collections::HashMap;
    
    log::info!("🔍 Recupero dettagli per AppID: {}", appid);
    
    // Verifica cache
    static DETAILS_CACHE: once_cell::sync::Lazy<moka::future::Cache<String, serde_json::Value>> = 
        once_cell::sync::Lazy::new(|| {
            moka::future::Cache::builder()
                .max_capacity(1000)
                .time_to_live(std::time::Duration::from_secs(3600)) // 1 ora
                .build()
        });
    
    if let Some(cached) = DETAILS_CACHE.get(&appid).await {
        log::info!("📋 Dettagli per {} trovati nella cache", appid);
        return Ok(cached);
    }
    
    // Chiamata API Steam Store
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", appid);
    let client = reqwest::Client::new();
    
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status() == 403 || response.status() == 429 {
                log::warn!("⚠️ Rate limit raggiunto per {} (Status: {})", appid, response.status());
                return Err("Rate limited by Steam".to_string());
            }
            
            if !response.status().is_success() {
                return Err(format!("Errore HTTP dalla API di Steam: {}", response.status()));
            }
            
            match response.json::<serde_json::Value>().await {
                Ok(data) => {
                    if let Some(game_data) = data.get(&appid) {
                        if let Some(success) = game_data.get("success").and_then(|v| v.as_bool()) {
                            if success {
                                if let Some(game_info) = game_data.get("data") {
                                    // Estrai lingue supportate
                                    let supported_languages = if let Some(lang_str) = game_info.get("supported_languages").and_then(|v| v.as_str()) {
                                        parse_supported_languages(lang_str)
                                    } else {
                                        Vec::new()
                                    };
                                    
                                    let details = serde_json::json!({
                                        "supported_languages": supported_languages,
                                        "game_engine": serde_json::Value::Null
                                    });
                                    
                                    // Cache solo se abbiamo trovato lingue
                                    if !supported_languages.is_empty() {
                                        DETAILS_CACHE.insert(appid.clone(), details.clone()).await;
                                    }
                                    
                                    log::info!("✅ Dettagli recuperati per {}: {} lingue", appid, supported_languages.len());
                                    return Ok(details);
                                }
                            }
                        }
                    }
                    Err("Nessun dettaglio valido trovato per questo AppID".to_string())
                }
                Err(e) => Err(format!("Errore parsing JSON: {}", e))
            }
        }
        Err(e) => {
            log::error!("❌ Errore durante il recupero dei dettagli per {}: {}", appid, e);
            Err(format!("Errore di rete: {}", e))
        }
    }
}

// Funzione helper per parsare le lingue supportate
fn parse_supported_languages(languages_string: &str) -> Vec<String> {
    if languages_string.is_empty() {
        return Vec::new();
    }
    
    // Rimuovi tutto dopo <br>
    let relevant_string = languages_string.split("<br>").next().unwrap_or("");
    
    // Pulisci HTML e asterischi usando regex
    let re_html = regex::Regex::new(r"<[^>]*>").unwrap();
    let cleaned = re_html.replace_all(relevant_string, "");
    let cleaned = cleaned.replace("*", "");
    
    // Dividi per virgola e pulisci
    let languages: Vec<String> = cleaned
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    
    // Rimuovi duplicati
    let mut unique_languages = Vec::new();
    for lang in languages {
        if !unique_languages.contains(&lang) {
            unique_languages.push(lang);
        }
    }
    
    unique_languages
}

#[tauri::command]
pub async fn get_steam_cover(appid: String) -> Result<String, String> {
    log::info!("🖼️ Recupero copertina per Steam App ID: {}", appid);
    
    // URL copertina Steam standard (460x215)
    let cover_url = format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid);
    
    // Verifica che l'immagine esista facendo una HEAD request
    match HTTP_CLIENT.head(&cover_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                log::info!("✅ Copertina trovata per App ID {}: {}", appid, cover_url);
                Ok(cover_url)
            } else {
                log::warn!("⚠️ Copertina non trovata per App ID {}, status: {}", appid, response.status());
                // Fallback a copertina placeholder
                Ok(format!("https://via.placeholder.com/460x215/1a1a2e/16213e?text=Steam+Game+{}", appid))
            }
        }
        Err(e) => {
            log::error!("❌ Errore verifica copertina per App ID {}: {}", appid, e);
            // Fallback a copertina placeholder
            Ok(format!("https://via.placeholder.com/460x215/1a1a2e/16213e?text=Steam+Game+{}", appid))
        }
    }
}

#[tauri::command]
pub async fn get_steam_covers_batch(appids: Vec<String>) -> Result<HashMap<String, String>, String> {
    log::info!("🖼️ Recupero copertine batch per {} giochi", appids.len());
    
    let mut covers = HashMap::new();
    
    // Processa in batch di 10 per evitare troppi request simultanei
    for chunk in appids.chunks(10) {
        let mut tasks = Vec::new();
        
        for appid in chunk {
            let appid_clone = appid.clone();
            let task = tokio::spawn(async move {
                let cover_url = format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid_clone);
                
                match HTTP_CLIENT.head(&cover_url).send().await {
                    Ok(response) if response.status().is_success() => {
                        (appid_clone.clone(), cover_url)
                    }
                    _ => {
                        // Fallback a copertina placeholder
                        (appid_clone.clone(), format!("https://via.placeholder.com/460x215/1a1a2e/16213e?text=Steam+Game+{}", appid_clone))
                    }
                }
            });
            tasks.push(task);
        }
        
        // Attendi tutti i task del chunk
        for task in tasks {
            if let Ok((appid, cover_url)) = task.await {
                covers.insert(appid, cover_url);
            }
        }
        
        // Piccola pausa tra i batch per essere gentili con Steam
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    log::info!("✅ Recuperate {} copertine", covers.len());
    Ok(covers)
}
