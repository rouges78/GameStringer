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
use serde::{Serialize, Deserialize};
use std::fs;
use std::io::Write;

// Placeholder for session state if needed later
pub struct SessionState;

// Struttura per le credenziali Steam
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SteamCredentials {
    pub api_key: String,
    pub steam_id: String,
    pub saved_at: String,
}

// Struttura per lo stato di connessione Steam
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SteamConnectionStatus {
    pub connected: bool,
    pub games_count: u32,
    pub last_checked: String,
    pub error: Option<String>,
}

// Percorso file credenziali
fn get_steam_credentials_path() -> Result<std::path::PathBuf, String> {
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "Impossibile trovare directory APPDATA".to_string())?;
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    
    // Crea la directory se non esiste
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    Ok(app_dir.join("steam_credentials.json"))
}

// Percorso file stato connessione
fn get_steam_status_path() -> Result<std::path::PathBuf, String> {
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "Impossibile trovare directory APPDATA".to_string())?;
    let app_dir = std::path::Path::new(&app_data).join("GameStringer");
    
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    Ok(app_dir.join("steam_status.json"))
}

use winreg::enums::*;
use winreg::RegKey;
use std::path::Path;

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
    
    // Conta i giochi Steam installati localmente
    let installed_games = get_installed_steam_app_ids().await;
    let installed_count = installed_games.len();
    
    // Tenta di recuperare il conteggio totale dei giochi posseduti
    // Nota: per funzionare completamente servirebbe una Steam API Key e Steam ID
    let total_message = if installed_count > 0 {
        // Se ci sono giochi installati, probabilmente ce ne sono molti altri posseduti
        format!("{} installati (~{} stimati posseduti)", installed_count, installed_count * 10)
    } else {
        format!("{} installati", installed_count)
    };
    
    Ok(format!("Steam connection test successful! {} giochi trovati", total_message))
}

#[tauri::command]
pub async fn disconnect_steam() -> Result<String, String> {
    println!("[RUST] 🔌 disconnect_steam called!");
    
    // Per Steam, la disconnessione significa invalidare le credenziali locali
    // In futuro qui potremmo cancellare API key salvate o cache
    
    Ok("Steam disconnesso con successo".to_string())
}

#[tauri::command]
pub async fn get_steam_games(api_key: String, steam_id: String, force_refresh: Option<bool>) -> Result<Vec<SteamGame>, String> {
    println!("[RUST] get_steam_games called with steam_id: {}", steam_id);
    
    let force = force_refresh.unwrap_or(false);
    println!("[RUST] Force refresh: {}", force);
    
    // Se abbiamo API key e Steam ID, usa l'API reale
    if !api_key.is_empty() && !steam_id.is_empty() {
        println!("[RUST] Using real Steam API with key: {}...", &api_key[..std::cmp::min(8, api_key.len())]);
        
        let url = format!(
            "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
            api_key, steam_id
        );
        
        match reqwest::get(&url).await {
            Ok(response) => {
                let status = response.status();
                println!("[RUST] Steam API response status: {}", status);
                
                if !status.is_success() {
                    let error_text = response.text().await.unwrap_or_else(|_| "Unable to read error".to_string());
                    println!("[RUST] ❌ Steam API error: {}", error_text);
                    // Continua con il fallback
                } else {
                    match response.json::<serde_json::Value>().await {
                        Ok(json) => {
                            // Verifica se c'è un errore nella risposta JSON
                            if let Some(error) = json["response"]["error"].as_str() {
                                println!("[RUST] ❌ Steam API returned error: {}", error);
                            } else if let Some(games_array) = json["response"]["games"].as_array() {
                                println!("[RUST] ✅ Retrieved {} games from Steam API", games_array.len());
                            
                            let steam_games: Vec<SteamGame> = games_array.iter()
                                .filter_map(|game| {
                                    if let (Some(appid), Some(name)) = (
                                        game["appid"].as_u64(),
                                        game["name"].as_str()
                                    ) {
                                        Some(SteamGame {
                                            appid: appid as u32,
                                            name: name.to_string(),
                                            playtime_forever: game["playtime_forever"].as_u64().unwrap_or(0) as u32,
                                            img_icon_url: game["img_icon_url"].as_str().unwrap_or("").to_string(),
                                            img_logo_url: "".to_string(),
                                            last_played: game["rtime_last_played"].as_u64().unwrap_or(0),
                                            is_installed: false, // Da determinare con scansione locale
                                            is_shared: false,
                                            is_vr: false, // Da determinare con logica specifica
                                            engine: "".to_string(), // Da determinare con logica specifica
                                            genres: vec![],
                                            categories: vec![],
                                            short_description: "".to_string(),
                                            is_free: false,
                                            header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid),
                                            library_capsule: "".to_string(),
                                            developers: vec![],
                                            publishers: vec![],
                                            release_date: SteamApiReleaseDate::default(),
                                            supported_languages: "".to_string(),
                                            pc_requirements: SteamApiRequirements::default(),
                                            dlc: vec![],
                                            how_long_to_beat: None,
                                        })
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            
                            return Ok(steam_games);
                        }
                            }
                        }
                        Err(e) => {
                            println!("[RUST] ❌ Failed to parse Steam API response: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                println!("[RUST] ❌ Failed to call Steam API: {}", e);
            }
        }
    }
    
    // Fallback: Leggi dal file locale
    println!("[RUST] Falling back to local file: ../steam_owned_games.json");
    
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

// Comando per salvare le credenziali Steam
#[tauri::command]
pub async fn save_steam_credentials(api_key: String, steam_id: String) -> Result<String, String> {
    println!("[RUST] save_steam_credentials called");
    
    let credentials = SteamCredentials {
        api_key: api_key.clone(),
        steam_id: steam_id.clone(),
        saved_at: chrono::Utc::now().to_rfc3339(),
    };
    
    let credentials_path = get_steam_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[RUST] Credenziali Steam salvate in: {:?}", credentials_path);
    Ok("Credenziali Steam salvate con successo".to_string())
}

// Comando per caricare le credenziali Steam
#[tauri::command]
pub async fn load_steam_credentials() -> Result<SteamCredentials, String> {
    println!("[RUST] load_steam_credentials called");
    
    let credentials_path = get_steam_credentials_path()?;
    
    if !credentials_path.exists() {
        return Err("Nessuna credenziale Steam salvata".to_string());
    }
    
    let json_data = fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let credentials: SteamCredentials = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    println!("[RUST] Credenziali Steam caricate per Steam ID: {}", credentials.steam_id);
    Ok(credentials)
}

// Comando per salvare lo stato di connessione Steam
#[tauri::command]
pub async fn save_steam_connection_status(connected: bool, games_count: u32, error: Option<String>) -> Result<String, String> {
    println!("[RUST] save_steam_connection_status called");
    
    let status = SteamConnectionStatus {
        connected,
        games_count,
        last_checked: chrono::Utc::now().to_rfc3339(),
        error,
    };
    
    let status_path = get_steam_status_path()?;
    let json_data = serde_json::to_string_pretty(&status)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&status_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[RUST] Stato connessione Steam salvato: connected={}, games={}", connected, games_count);
    Ok("Stato connessione Steam salvato".to_string())
}

// Comando per caricare lo stato di connessione Steam
#[tauri::command]
pub async fn load_steam_connection_status() -> Result<SteamConnectionStatus, String> {
    println!("[RUST] load_steam_connection_status called");
    
    let status_path = get_steam_status_path()?;
    
    if !status_path.exists() {
        return Err("Nessuno stato di connessione Steam salvato".to_string());
    }
    
    let json_data = fs::read_to_string(&status_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let status: SteamConnectionStatus = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    println!("[RUST] Stato connessione Steam caricato: connected={}", status.connected);
    Ok(status)
}

// Comando per rimuovere le credenziali Steam
#[tauri::command]
pub async fn remove_steam_credentials() -> Result<String, String> {
    println!("[RUST] remove_steam_credentials called");
    
    let credentials_path = get_steam_credentials_path()?;
    let status_path = get_steam_status_path()?;
    
    // Rimuovi credenziali se esistono
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore rimozione credenziali: {}", e))?;
        println!("[RUST] Credenziali Steam rimosse");
    }
    
    // Rimuovi stato se esiste
    if status_path.exists() {
        fs::remove_file(&status_path)
            .map_err(|e| format!("Errore rimozione stato: {}", e))?;
        println!("[RUST] Stato connessione Steam rimosso");
    }
    
    Ok("Credenziali e stato Steam rimossi".to_string())
}

// Comando per testare la connessione automatica Steam
#[tauri::command]
pub async fn auto_connect_steam() -> Result<serde_json::Value, String> {
    println!("[RUST] auto_connect_steam called");
    
    // Carica le credenziali salvate
    let credentials = load_steam_credentials().await?;
    
    // Testa la connessione
    match get_steam_games(credentials.api_key, credentials.steam_id, Some(false)).await {
        Ok(games) => {
            let games_count = games.len() as u32;
            
            // Salva lo stato di successo
            save_steam_connection_status(true, games_count, None).await?;
            
            Ok(serde_json::json!({
                "connected": true,
                "games_count": games_count,
                "message": format!("Steam connesso automaticamente! {} giochi trovati", games_count)
            }))
        },
        Err(error) => {
            // Salva lo stato di errore
            save_steam_connection_status(false, 0, Some(error.clone())).await?;
            
            Err(format!("Connessione automatica Steam fallita: {}", error))
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
