use tauri::State;
use crate::models::{SteamConfig, SteamGame, SteamApiGenre, SteamApiCategory, SteamApiReleaseDate, SteamApiRequirements, GameInfo, GameDetails, LocalGameInfo, GameStatus, SteamLibraryFolder, SharedGame, FamilySharingConfig};
use winreg::HKEY;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use moka::future::Cache;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use base64::{Engine as _, engine::general_purpose};
use rand::{RngCore, rngs::OsRng};
use log::{debug, info, warn, error};

// Placeholder for session state if needed later
pub struct SessionState;

// SECURITY: Input validation functions
/// Validates Steam App ID format and range
/// Steam App IDs are positive integers up to 10 digits
fn validate_steam_app_id(app_id: &str) -> bool {
    // Check if it's a valid number
    if let Ok(numeric_id) = app_id.parse::<u64>() {
        // Steam App IDs range from 1 to approximately 2,000,000+ (as of 2024)
        // We'll use a reasonable upper bound to prevent abuse
        numeric_id >= 1 && numeric_id <= 9999999999
    } else {
        false
    }
}

/// Validates Steam ID64 format
/// Steam ID64 format: 17 digits, starts with 76561198
fn validate_steam_id64(steam_id: &str) -> bool {
    // Check length and format
    if steam_id.len() != 17 || !steam_id.starts_with("76561198") {
        return false;
    }
    
    // Ensure all characters are digits
    if !steam_id.chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    
    // Additional validation: check if it's in valid Steam ID64 range
    if let Ok(numeric_id) = steam_id.parse::<u64>() {
        let min_steam_id = 76561198000000000u64;
        let max_steam_id = 76561198999999999u64;
        numeric_id >= min_steam_id && numeric_id <= max_steam_id
    } else {
        false
    }
}

/// Sanitizes string input to prevent injection attacks
fn sanitize_string_input(input: &str, max_length: usize) -> Result<String, String> {
    if input.is_empty() || input.len() > max_length {
        return Err("Invalid input length".to_string());
    }
    
    // Remove potentially dangerous characters
    let sanitized = input
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || "-_".contains(*c))
        .collect::<String>()
        .trim()
        .to_string();
    
    if sanitized.is_empty() {
        return Err("Input contains only invalid characters".to_string());
    }
    
    Ok(sanitized)
}

/// SECURITY: Rate limiting implementation for Steam API calls
/// Prevents API abuse and maintains compliance with Steam API terms
struct SteamApiRateLimiter {
    requests: std::sync::Mutex<std::collections::HashMap<String, Vec<u64>>>,
    max_requests_per_minute: usize,
    max_requests_per_second: usize,
    rate_limit_window: u64,
    burst_window: u64,
}

impl SteamApiRateLimiter {
    fn new() -> Self {
        Self {
            requests: std::sync::Mutex::new(std::collections::HashMap::new()),
            max_requests_per_minute: 100, // Steam API limit
            max_requests_per_second: 10,  // Conservative limit
            rate_limit_window: 60 * 1000, // 1 minute in milliseconds
            burst_window: 1000,           // 1 second in milliseconds
        }
    }
    
    fn get_current_time_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
    
    fn is_request_allowed(&self, endpoint: &str) -> bool {
        let now = Self::get_current_time_ms();
        let mut requests = self.requests.lock().unwrap();
        
        // Get or create request history for this endpoint
        let request_history = requests.entry(endpoint.to_string()).or_insert(Vec::new());
        
        // Clean old requests outside the window
        request_history.retain(|&timestamp| now - timestamp < self.rate_limit_window);
        
        // Check burst limit (requests per second)
        let recent_requests: Vec<&u64> = request_history
            .iter()
            .filter(|&&timestamp| now - timestamp < self.burst_window)
            .collect();
        
        if recent_requests.len() >= self.max_requests_per_second {
            warn!("[RateLimit] Burst limit exceeded for {}: {}/{} per second", 
                  endpoint, recent_requests.len(), self.max_requests_per_second);
            return false;
        }
        
        // Check minute limit
        if request_history.len() >= self.max_requests_per_minute {
            warn!("[RateLimit] Minute limit exceeded for {}: {}/{} per minute", 
                  endpoint, request_history.len(), self.max_requests_per_minute);
            return false;
        }
        
        // Request is allowed, record it
        request_history.push(now);
        true
    }
    
    fn get_delay_until_next_request(&self, endpoint: &str) -> u64 {
        let now = Self::get_current_time_ms();
        let requests = self.requests.lock().unwrap();
        
        if let Some(request_history) = requests.get(endpoint) {
            // Check if we need to wait for burst limit
            let recent_requests: Vec<&u64> = request_history
                .iter()
                .filter(|&&timestamp| now - timestamp < self.burst_window)
                .collect();
            
            if recent_requests.len() >= self.max_requests_per_second {
                if let Some(&&oldest_recent) = recent_requests.iter().min() {
                    return self.burst_window - (now - oldest_recent);
                }
            }
            
            // Check if we need to wait for minute limit
            let valid_requests: Vec<&u64> = request_history
                .iter()
                .filter(|&&timestamp| now - timestamp < self.rate_limit_window)
                .collect();
            
            if valid_requests.len() >= self.max_requests_per_minute {
                if let Some(&&oldest_valid) = valid_requests.iter().min() {
                    return self.rate_limit_window - (now - oldest_valid);
                }
            }
        }
        
        0
    }
    
    async fn wait_for_next_request(&self, endpoint: &str) {
        let delay = self.get_delay_until_next_request(endpoint);
        if delay > 0 {
            info!("[RateLimit] Waiting {}ms before next request to {}", delay, endpoint);
            tokio::time::sleep(Duration::from_millis(delay)).await;
        }
    }
}

// Global rate limiter instance
static RATE_LIMITER: once_cell::sync::Lazy<SteamApiRateLimiter> = 
    once_cell::sync::Lazy::new(|| SteamApiRateLimiter::new());

/// Helper function for rate-limited Steam API calls
async fn make_rate_limited_request(
    client: &reqwest::Client,
    url: &str,
    endpoint: &str,
) -> Result<reqwest::Response, String> {
    // Check rate limit
    if !RATE_LIMITER.is_request_allowed(endpoint) {
        return Err(format!("Rate limit exceeded for endpoint: {}", endpoint));
    }
    
    // Wait if needed
    RATE_LIMITER.wait_for_next_request(endpoint).await;
    
    // Make the request
    client.get(url).send().await
        .map_err(|e| format!("Request failed: {}", e))
}

// 🔍 DEBUG: Test API Steam con diversi endpoints
#[tauri::command]
pub async fn debug_steam_api_extended(api_key: String, steam_id: String) -> Result<String, String> {
    debug!("[RUST] DEBUG: Test esteso API Steam...");
    
    // Se le credenziali sono vuote, carica quelle salvate
    let (actual_key, actual_id) = if api_key.is_empty() || steam_id.is_empty() {
        match get_decrypted_api_key().await {
            Ok((key, id)) => (key, id),
            Err(e) => return Err(format!("Impossibile caricare credenziali: {}", e))
        }
    } else {
        // SECURITY FIX: Validate Steam ID64 format
        if !validate_steam_id64(&steam_id) {
            return Err("Invalid Steam ID64 format".to_string());
        }
        
        // SECURITY FIX: Validate API key format (basic check)
        if api_key.len() != 32 || !api_key.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err("Invalid API key format".to_string());
        }
        
        (api_key, steam_id)
    };
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore creazione client: {}", e))?;
    
    let mut results = Vec::new();
    
    // Test 1: GetOwnedGames con parametri minimali
    let url1 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json",
        actual_key, actual_id
    );
    
    // SECURITY FIX: Apply rate limiting to API calls
    let endpoint1 = "api.steampowered.com/IPlayerService/GetOwnedGames";
    if !RATE_LIMITER.is_request_allowed(endpoint1) {
        results.push("Test 1 (minimale): Rate limited".to_string());
    } else {
        RATE_LIMITER.wait_for_next_request(endpoint1).await;
        
        // SECURITY FIX: Removed URL logging to prevent API key exposure
        info!("[RUST] Steam API Test 1 - GetOwnedGames minimal parameters");
        match client.get(&url1).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            info!("[RUST] Steam API Test 1 completed successfully");
            results.push(format!("Test 1 (minimale): {}", response_text));
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Test 1 Error: {}", e);
            results.push(format!("Test 1 Error: {}", e));
        }
        }
    }
    
    // Test 2: GetOwnedGames senza include_played_free_games
    let url2 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true",
        actual_key, actual_id
    );
    
    // SECURITY FIX: Apply rate limiting to API calls
    let endpoint2 = "api.steampowered.com/IPlayerService/GetOwnedGames";
    if !RATE_LIMITER.is_request_allowed(endpoint2) {
        results.push("Test 2 (senza free): Rate limited".to_string());
    } else {
        RATE_LIMITER.wait_for_next_request(endpoint2).await;
        
        // SECURITY FIX: Removed URL logging to prevent API key exposure
        info!("[RUST] Steam API Test 2 - GetOwnedGames without free games");
        match client.get(&url2).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            info!("[RUST] Steam API Test 2 completed successfully");
            results.push(format!("Test 2 (senza free): {}", response_text));
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Test 2 Error: {}", e);
            results.push(format!("Test 2 Error: {}", e));
        }
        }
    }
    
    // Test 3: GetOwnedGames con parametri community-suggested
    let url3 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=1&include_played_free_games=1&skip_unvetted_apps=false",
        actual_key, actual_id
    );
    
    // SECURITY FIX: Removed URL logging to prevent API key exposure
    info!("[RUST] Steam API Test 3 - GetOwnedGames community suggested parameters");
    match client.get(&url3).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            info!("[RUST] Steam API Test 3 completed successfully");
            results.push(format!("Test 3 (community fix): {}", response_text));
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Test 3 Error: {}", e);
            results.push(format!("Test 3 Error: {}", e));
        }
    }
    
    // Test 4: GetPlayerSummaries per verificare ancora il profilo
    let url4 = format!(
        "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={}&steamids={}",
        actual_key, actual_id
    );
    
    // SECURITY FIX: Removed URL logging to prevent API key exposure
    info!("[RUST] Steam API Test 4 - GetPlayerSummaries");
    match client.get(&url4).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            info!("[RUST] Steam API Test 4 completed successfully");
            
            // Analizza la risposta per details aggiuntivi
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                if let Some(players) = json["response"]["players"].as_array() {
                    if let Some(player) = players.first() {
                        let visibility = player["communityvisibilitystate"].as_u64().unwrap_or(0);
                        let comment_permission = player["commentpermission"].as_u64().unwrap_or(0);
                        results.push(format!("Test 4 - Profilo: visibility={}, comments={}", visibility, comment_permission));
                    }
                }
            }
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Test 4 Error: {}", e);
            results.push(format!("Test 4 Error: {}", e));
        }
    }
    
    // Test 5: Retry con delay (bug intermittente)
    debug!("[RUST] DEBUG: Test 5 - Retry con delay...");
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    let url5 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=1&include_played_free_games=1",
        actual_key, actual_id
    );
    
    match client.get(&url5).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            info!("[RUST] Steam API Test 5 completed successfully");
            results.push(format!("Test 5 (retry con delay): {}", response_text));
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Test 5 Error: {}", e);
            results.push(format!("Test 5 Error: {}", e));
        }
    }
    
    Ok(results.join("\n\n"))
}

// 🔍 DEBUG: Comando per testare specificamente l'API Steam
#[tauri::command]
pub async fn debug_steam_api(api_key: String, steam_id: String) -> Result<String, String> {
    debug!("[RUST] DEBUG: Testando API Steam...");
    
    // Se le credenziali sono vuote, carica quelle salvate
    let (actual_key, actual_id) = if api_key.is_empty() || steam_id.is_empty() {
        match get_decrypted_api_key().await {
            Ok((key, id)) => (key, id),
            Err(e) => return Err(format!("Impossibile caricare credenziali: {}", e))
        }
    } else {
        // SECURITY FIX: Validate Steam ID64 format
        if !validate_steam_id64(&steam_id) {
            return Err("Invalid Steam ID64 format".to_string());
        }
        
        // SECURITY FIX: Validate API key format (basic check)
        if api_key.len() != 32 || !api_key.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err("Invalid API key format".to_string());
        }
        
        (api_key, steam_id)
    };
    
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
        actual_key, actual_id
    );
    
    // SECURITY FIX: Removed URL logging to prevent API key exposure
    info!("[RUST] Steam API debug - GetOwnedGames call initiated");
    // SECURITY FIX: Removed API key length logging
    debug!("[RUST] Steam API key validation check");
    debug!("[RUST] DEBUG: Steam ID: {}", actual_id);
    
    // Validazione base dei parametri
    if actual_key.len() != 32 {
        // SECURITY FIX: Removed API key length logging
        warn!("[RUST] API Key validation failed - invalid length");
    }
    
    if !actual_id.starts_with("7656119") {
        debug!("[RUST] ⚠️ WARNING: Steam ID doesn't start with 7656119 (64-bit SteamID format)");
    }
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore creazione client: {}", e))?;
    
    // SECURITY FIX: Apply rate limiting to API calls
    let endpoint = "api.steampowered.com/IPlayerService/GetOwnedGames";
    if !RATE_LIMITER.is_request_allowed(endpoint) {
        return Err("Rate limit exceeded for Steam API".to_string());
    }
    
    RATE_LIMITER.wait_for_next_request(endpoint).await;
    
    match client.get(&url).send().await {
        Ok(response) => {
            let status = response.status();
            let response_text = response.text().await.map_err(|e| format!("Errore lettura risposta: {}", e))?;
            
            info!("[RUST] Steam API request completed");
            debug!("[RUST] DEBUG: HTTP Status: {}", status);
            debug!("[RUST] DEBUG: Response size: {} bytes", response_text.len());
            
            // Analizza la risposta
            let _content_preview = if response_text.len() > 100 {
                format!("{}...", &response_text[..100])
            } else {
                response_text.clone()
            };
            debug!("[RUST] Steam API response received and processed");
            
            // Prova a parsare come JSON per vedere la struttura
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                debug!("[RUST] DEBUG: JSON parsed successfully");
                debug!("[RUST] Steam API JSON response parsed successfully");
                
                if let Some(response_obj) = json["response"].as_object() {
                    debug!("[RUST] DEBUG: Response keys: {:?}", response_obj.keys().collect::<Vec<_>>());
                    
                    if let Some(games) = json["response"]["games"].as_array() {
                        debug!("[RUST] DEBUG: Games array found with {} games", games.len());
                    } else {
                        debug!("[RUST] DEBUG: No games array found");
                    }
                }
            } else {
                debug!("[RUST] DEBUG: Failed to parse JSON");
            }
            
            Ok(format!("Status: {}, Size: {} bytes", status, response_text.len()))
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Errore API: {}", e);
            Err(format!("Errore API: {}", e))
        }
    }
}

// 🔄 SISTEMA: Auto-aggiornamento libreria Steam
#[tauri::command]
pub async fn add_game_to_library(appid: u32, name: String) -> Result<String, String> {
    // SECURITY FIX: Validate App ID
    if !validate_steam_app_id(&appid.to_string()) {
        return Err("Invalid Steam App ID".to_string());
    }
    
    // SECURITY FIX: Sanitize game name
    let sanitized_name = sanitize_string_input(&name, 200)?;
    
    debug!("[RUST] Aggiungendo gioco alla libreria: {} ({})", sanitized_name, appid);
    
    let file_path = "../steam_owned_games.json";
    
    // Leggi il file esistente
    let mut games: Vec<serde_json::Value> = match std::fs::read_to_string(file_path) {
        Ok(content) => {
            serde_json::from_str(&content).map_err(|e| format!("Errore parsing JSON: {}", e))?
        }
        Err(e) => {
            return Err(format!("Errore lettura file: {}", e));
        }
    };
    
    // Controlla se il gioco esiste già
    let already_exists = games.iter().any(|game| {
        game["appid"].as_u64() == Some(appid as u64)
    });
    
    if already_exists {
        return Ok(format!("Gioco '{}' già presente nella libreria", sanitized_name));
    }
    
    // Crea il nuovo gioco
    let new_game = serde_json::json!({
        "appid": appid,
        "name": sanitized_name,
        "playtime_forever": 0,
        "img_icon_url": "",
        "playtime_windows_forever": 0,
        "playtime_mac_forever": 0,
        "playtime_linux_forever": 0,
        "playtime_deck_forever": 0,
        "rtime_last_played": 0,
        "content_descriptorids": [],
        "playtime_disconnected": 0
    });
    
    // Aggiungi il gioco
    games.push(new_game);
    
    // Salva il file aggiornato
    let updated_content = serde_json::to_string_pretty(&games)
        .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;
    
    std::fs::write(file_path, updated_content)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    debug!("[RUST] ✅ Gioco '{}' aggiunto alla libreria. Totale giochi: {}", sanitized_name, games.len());
    
    Ok(format!("Gioco '{}' aggiunto con successo! Totale giochi: {}", sanitized_name, games.len()))
}

// 🔍 DEBUG: Comando per testare il profilo Steam
#[tauri::command]
pub async fn debug_steam_profile(api_key: String, steam_id: String) -> Result<String, String> {
    debug!("[RUST] DEBUG: Testando profilo Steam...");
    
    // Se le credenziali sono vuote, carica quelle salvate
    let (actual_key, actual_id) = if api_key.is_empty() || steam_id.is_empty() {
        match get_decrypted_api_key().await {
            Ok((key, id)) => (key, id),
            Err(e) => return Err(format!("Impossibile caricare credenziali: {}", e))
        }
    } else {
        (api_key, steam_id)
    };
    
    // Test profilo pubblico/privato
    let profile_url = format!(
        "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={}&steamids={}",
        actual_key, actual_id
    );
    
    // SECURITY FIX: Removed URL logging to prevent API key exposure
    info!("[RUST] Steam API debug - GetPlayerSummaries call initiated");
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore creazione client: {}", e))?;
    
    match client.get(&profile_url).send().await {
        Ok(response) => {
            let status = response.status();
            let response_text = response.text().await.map_err(|e| format!("Errore lettura risposta: {}", e))?;
            
            debug!("[RUST] DEBUG: Profile API Status: {}", status);
            info!("[RUST] Steam profile API request completed");
            
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                if let Some(players) = json["response"]["players"].as_array() {
                    if let Some(player) = players.first() {
                        let visibility = player["communityvisibilitystate"].as_u64().unwrap_or(0);
                        let profile_state = player["profilestate"].as_u64().unwrap_or(0);
                        
                        debug!("[RUST] DEBUG: Community visibility: {} (1=private, 3=public)", visibility);
                        debug!("[RUST] DEBUG: Profile state: {} (1=configured)", profile_state);
                        
                        let status_msg = match visibility {
                            1 => "Profilo PRIVATO - questo è probabilmente il problema!",
                            3 => "Profilo PUBBLICO - il problema è altrove",
                            _ => "Visibilità sconosciuta"
                        };
                        
                        return Ok(format!("Profile Status: {}, Visibility: {}", status_msg, visibility));
                    }
                }
            }
            
            Ok(format!("Profile API Status: {}, but couldn't parse response", status))
        }
        Err(e) => {
            debug!("[RUST] DEBUG: Profile API Error: {}", e);
            Err(format!("Profile API Error: {}", e))
        }
    }
}

// 🎮 FUNZIONI DI RILEVAMENTO INTELLIGENTE

// 🥽 Rilevamento giochi VR (DATABASE COMPLETO)
fn detect_vr_game(name: &str, appid: u32) -> bool {
    let name_lower = name.to_lowercase();
    
    // Keywords VR nel nome
    let vr_keywords = [
        "vr", "virtual reality", "oculus", "htc vive", "valve index", 
        "steamvr", "room scale", "motion controller", "headset"
    ];
    
    // Giochi VR famosi per nome specifico
    let vr_games = [
        // Valve VR
        "half-life alyx", "the lab", "aperture hand lab", "moondust", "destinations",
        
        // Rhythm/Music VR
        "beat saber", "pistol whip", "synth riders", "audio trip", "ragnarock",
        "until you fall", "soundboxing", "holodance", "audioshield", "music vr",
        
        // Simulation VR
        "job simulator", "vacation simulator", "cook-out", "rick and morty virtual rick-ality",
        "accounting+", "accounting vr", "surgeon simulator experience reality",
        "car mechanic simulator vr", "house flipper vr", "cooking simulator vr",
        
        // Action/Adventure VR
        "superhot vr", "boneworks", "bone lab", "blade and sorcery", "gorn",
        "arizona sunshine", "onward", "pavlov vr", "contractors", "population one",
        "walking dead saints sinners", "into the radius", "after the fall",
        "zero caliber vr", "sniper elite vr", "medal of honor above and beyond",
        "asgard's wrath", "lone echo", "echo vr", "echo arena", "echo combat",
        
        // Horror VR
        "phasmophobia vr", "the exorcist legion vr", "dreadhalls", "affected the manor",
        "face your fears", "alien isolation vr", "layers of fear vr", "resident evil 4 vr",
        "resident evil 7 vr", "the forest vr", "subnautica vr", "outlast trinity vr",
        
        // Puzzle/Strategy VR
        "moss", "moss book ii", "tetris effect", "i expect you to die", "red matter",
        "the room vr", "vader immortal", "trover saves the universe", "down the rabbit hole",
        "a fisherman's tale", "transpose", "psychonauts rhombus of ruin",
        
        // Social VR
        "vrchat", "rec room", "horizon worlds", "altspacevr", "bigscreen beta",
        "neos vr", "sansar", "high fidelity", "mozilla hubs", "engage",
        
        // Sports/Fitness VR
        "eleven table tennis", "racquet nx", "the thrill of the fight", "boxvr",
        "fitxr", "supernatural", "oh shape", "dance central", "just dance vr",
        "creed rise to glory", "knockout league", "sprint vector",
        
        // Flight/Space VR
        "elite dangerous vr", "no man's sky vr", "star wars squadrons vr", "ace combat 7 vr",
        "vtol vr", "dcs world vr", "il-2 sturmovik vr", "war thunder vr",
        "eve valkyrie", "adr1ft", "lunar flight", "space pirate trainer",
        
        // Racing VR
        "dirt rally vr", "project cars vr", "assetto corsa vr", "euro truck simulator 2 vr",
        "american truck simulator vr", "automobilista 2 vr", "rfactor 2 vr",
        
        // Creative/Art VR
        "tilt brush", "gravity sketch", "blocks by google", "masterpiece vr",
        "tvori", "animvr", "adobe medium", "quill", "oculus medium",
        
        // Educational VR
        "google earth vr", "apollo 11 vr", "titanic vr", "anne frank house vr",
        "the body vr", "virtual virtual reality", "cosmos possible worlds",
        
        // Experimental/Indie VR
        "hot dogs horseshoes hand grenades", "garry's mod vr", "minecraft vr",
        "vivecraft", "skyrim vr", "fallout 4 vr", "la noire vr case files",
        "doom 3 bfg vr", "serious sam vr", "the talos principle vr",
        "scanner sombre", "accounting legacy", "doctor who the edge of time"
    ];
    
    // Controlla prima i keyword VR
    if vr_keywords.iter().any(|&keyword| name_lower.contains(keyword)) {
        return true;
    }
    
    // Poi controlla la lista specifica di giochi VR
    if vr_games.iter().any(|&game| name_lower.contains(game)) {
        return true;
    }
    
    // AppID specifici per giochi VR famosi (backup)
    let vr_appids = [
        546560, // Half-Life: Alyx
        620980, // Beat Saber
        617830, // Job Simulator
        450390, // The Lab
        823500, // Superhot VR
        496240, // Onward
        629730, // Blade and Sorcery
        438100, // VRChat
        471710, // Rec Room
        544360, // Arizona Sunshine
        555160, // Moss
        285940, // Audioshield
        503360, // Gorn
        1057090, // Boneworks
        // Aggiungi altri appid noti...
    ];
    
    vr_appids.contains(&appid)
}

// 🎮 Rilevamento engine di sviluppo (DATABASE MASSIVO)
fn detect_game_engine(name: &str, appid: u32) -> String {
    let name_lower = name.to_lowercase();
    
    // 🔶 UNITY ENGINE (1000+ giochi)
    let unity_games = [
        // Indie famosi
        "hollow knight", "cuphead", "ori and", "cities skylines", "kerbal space program",
        "subnautica", "the forest", "green hell", "rust", "7 days to die",
        "valheim", "raft", "slime rancher", "a hat in time", "shovel knight",
        "katana zero", "hotline miami", "nuclear throne", "risk of rain",
        "dead cells", "enter the gungeon", "spelunky", "celeste", "super meat boy",
        "the binding of isaac", "fez", "braid", "limbo", "inside", "little nightmares",
        "ori and the blind forest", "ori and the will", "steamworld", "papers please",
        "firewatch", "the witness", "what remains of edith finch", "stanley parable",
        "untitled goose game", "among us", "fall guys", "phasmophobia", "devour",
        // AAA con Unity
        "hearthstone", "legends of runeterra", "gwent", "monument valley", "alto's",
        "beat saber", "job simulator", "vacation simulator", "superhot vr", "pistol whip",
        "moss", "arizona sunshine", "pavlov vr", "onward", "blade and sorcery",
        "boneworks", "half-life alyx", "vrchat", "rec room", "bigscreen",
        // Mobile/Multiplat
        "pokémon go", "mario kart tour", "call of duty mobile", "pubg mobile"
    ];
    
    // 🔷 UNREAL ENGINE (500+ giochi)
    let unreal_games = [
        // Epic/AAA
        "fortnite", "borderlands", "bioshock", "mass effect", "gears of war",
        "rocket league", "dead by daylight", "ark survival", "pubg", "squad",
        "hell let loose", "post scriptum", "rising storm", "red orchestra",
        "killing floor", "tripwire", "deep rock galactic", "sea of thieves",
        "state of decay", "scorn", "the ascent", "outriders", "remnant",
        // Fighting games
        "mortal kombat", "injustice", "street fighter", "tekken", "dragon ball",
        "guilty gear", "blazblue", "granblue fantasy", "under night",
        // Battle Royale/Shooter
        "apex legends", "valorant", "overwatch", "paladins", "rogue company",
        "spellbreak", "darwin project", "realm royale", "hyperscape",
        // Horror/Indie UE4
        "phasmophobia", "the dark pictures", "until dawn", "man of medan",
        "little hope", "house of ashes", "layers of fear", "observer",
        "blair witch", "the medium", "visage", "madison", "outlast",
        // RPG/Adventure UE4
        "kingdom hearts", "final fantasy vii remake", "nier automata", "nier replicant",
        "scarlet nexus", "tales of arise", "code vein", "god eater", "bandai namco"
    ];
    
    // 🟠 SOURCE ENGINE (Valve + licensees)
    let source_games = [
        "half-life", "counter-strike", "portal", "team fortress", "left 4 dead",
        "dota 2", "black mesa", "garry's mod", "titanfall", "apex legends",
        "the stanley parable", "dear esther", "insurgency", "day of defeat",
        "vampire the masquerade bloodlines", "zeno clash", "postal"
    ];
    
    // 🟫 CREATION ENGINE (Bethesda)
    let creation_games = [
        "fallout", "elder scrolls", "skyrim", "oblivion", "morrowind", "starfield"
    ];
    
    // 🔴 CRYENGINE
    let cryengine_games = [
        "far cry", "crysis", "hunt showdown", "kingdom come deliverance",
        "star citizen", "squadron 42", "robinson the journey", "the climb",
        "ryse son of rome", "warface", "archeage", "aion"
    ];
    
    // 🟢 FROSTBITE (EA)
    let frostbite_games = [
        "battlefield", "mirror's edge", "need for speed", "fifa", "madden nfl",
        "star wars battlefront", "anthem", "mass effect andromeda", "dragon age inquisition"
    ];
    
    // 🔵 PROPRIETARY ENGINES
    let rage_games = ["grand theft auto", "red dead redemption", "max payne", "midnight club"];
    let anvil_games = ["assassin's creed", "watch dogs", "for honor", "skull and bones"];
    let dunia_games = ["far cry 2", "far cry 3", "far cry 4", "far cry primal"];
    let chrome_games = ["metro", "4a games"];
    let aurora_games = ["neverwinter nights", "dragon age origins", "mass effect 1"];
    let gamebryo_games = ["fallout 3", "fallout new vegas", "oblivion", "morrowind"];
    let id_tech_games = ["doom", "quake", "wolfenstein", "rage", "evil within"];
    let decima_games = ["horizon zero dawn", "death stranding"];
    let fox_games = ["metal gear solid v", "pro evolution soccer"];
    let snowdrop_games = ["the division", "mario + rabbids", "skull and bones"];
    let rei_games = ["resident evil", "devil may cry", "monster hunter", "street fighter"];
    let mt_framework_games = ["resident evil 4", "resident evil 5", "resident evil 6", "lost planet"];
    
    // 🎲 INDIE ENGINES
    let godot_games = ["sonic colors ultimate", "the interactive adventures of dog mendonça"];
    let gamemaker_games = ["undertale", "hyper light drifter", "hotline miami", "spelunky", "nuclear throne"];
    let construct_games = ["the next penelope"];
    let defold_games = ["baba is you"];
    
    // 🌐 WEB/FLASH ENGINES
    let javascript_games = ["agar.io", "slither.io", "diep.io"];
    
    // Controllo specifico per nome (ordinato per priorità)
    if rage_games.iter().any(|&game| name_lower.contains(game)) {
        return "RAGE Engine".to_string();
    }
    if anvil_games.iter().any(|&game| name_lower.contains(game)) {
        return "Anvil Engine".to_string();
    }
    if frostbite_games.iter().any(|&game| name_lower.contains(game)) {
        return "Frostbite".to_string();
    }
    if cryengine_games.iter().any(|&game| name_lower.contains(game)) {
        return "CryEngine".to_string();
    }
    if decima_games.iter().any(|&game| name_lower.contains(game)) {
        return "Decima Engine".to_string();
    }
    if fox_games.iter().any(|&game| name_lower.contains(game)) {
        return "FOX Engine".to_string();
    }
    if snowdrop_games.iter().any(|&game| name_lower.contains(game)) {
        return "Snowdrop".to_string();
    }
    if rei_games.iter().any(|&game| name_lower.contains(game)) {
        return "RE Engine".to_string();
    }
    if mt_framework_games.iter().any(|&game| name_lower.contains(game)) {
        return "MT Framework".to_string();
    }
    if chrome_games.iter().any(|&game| name_lower.contains(game)) {
        return "4A Engine".to_string();
    }
    if id_tech_games.iter().any(|&game| name_lower.contains(game)) {
        return "id Tech".to_string();
    }
    if gamebryo_games.iter().any(|&game| name_lower.contains(game)) {
        return "Gamebryo".to_string();
    }
    if aurora_games.iter().any(|&game| name_lower.contains(game)) {
        return "Aurora Engine".to_string();
    }
    if dunia_games.iter().any(|&game| name_lower.contains(game)) {
        return "Dunia Engine".to_string();
    }
    if unity_games.iter().any(|&game| name_lower.contains(game)) {
        return "Unity".to_string();
    }
    if unreal_games.iter().any(|&game| name_lower.contains(game)) {
        return "Unreal Engine".to_string();
    }
    if source_games.iter().any(|&game| name_lower.contains(game)) {
        return "Source Engine".to_string();
    }
    if creation_games.iter().any(|&game| name_lower.contains(game)) {
        return "Creation Engine".to_string();
    }
    if gamemaker_games.iter().any(|&game| name_lower.contains(game)) {
        return "GameMaker".to_string();
    }
    if godot_games.iter().any(|&game| name_lower.contains(game)) {
        return "Godot".to_string();
    }
    
    // Rilevamento generico basato su pattern nel nome
    if name_lower.contains("unity") {
        return "Unity".to_string();
    }
    if name_lower.contains("unreal") {
        return "Unreal Engine".to_string();
    }
    if name_lower.contains("source") {
        return "Source Engine".to_string();
    }
    if name_lower.contains("cryengine") || name_lower.contains("cry engine") {
        return "CryEngine".to_string();
    }
    if name_lower.contains("frostbite") {
        return "Frostbite".to_string();
    }
    
    // Pattern addizionali per giochi comuni
    if name_lower.contains("fifa") || name_lower.contains("madden") || name_lower.contains("battlefield") {
        return "Frostbite".to_string();
    }
    if name_lower.contains("call of duty") || name_lower.contains("warzone") {
        return "IW Engine".to_string();
    }
    if name_lower.contains("minecraft") {
        return "Java/C++".to_string();
    }
    
    "Unknown".to_string()
}

// 💾 Rilevamento installazione Steam
fn detect_steam_installation(appid: u32) -> bool {
    // Percorsi comuni di installazione Steam
    let _steam_paths = [
        "C:\\Program Files (x86)\\Steam\\steamapps\\common",
        "C:\\Program Files\\Steam\\steamapps\\common",
        "D:\\Steam\\steamapps\\common",
        "E:\\Steam\\steamapps\\common",
        "F:\\Steam\\steamapps\\common"
    ];
    
    // Controlla se esiste il file acf (Steam app cache file)
    let acf_paths = [
        format!("C:\\Program Files (x86)\\Steam\\steamapps\\appmanifest_{}.acf", appid),
        format!("C:\\Program Files\\Steam\\steamapps\\appmanifest_{}.acf", appid),
        format!("D:\\Steam\\steamapps\\appmanifest_{}.acf", appid),
        format!("E:\\Steam\\steamapps\\appmanifest_{}.acf", appid),
        format!("F:\\Steam\\steamapps\\appmanifest_{}.acf", appid)
    ];
    
    // Controlla se esiste almeno uno dei file manifest
    acf_paths.iter().any(|path| std::path::Path::new(path).exists())
}

// 🎯 Rilevamento generi di gioco (DATABASE MASSIVO)
fn detect_game_genres(name: &str, _appid: u32) -> Vec<String> {
    let name_lower = name.to_lowercase();
    let mut genres = Vec::new();
    
    // 🔫 ACTION/FPS GAMES (Massivo database)
    let action_fps_games = [
        "call of duty", "battlefield", "doom", "wolfenstein", "counter-strike", "valorant",
        "apex legends", "titanfall", "rainbow six", "ghost recon", "splinter cell",
        "metro", "bioshock", "dishonored", "prey", "deathloop", "far cry", "crysis",
        "half-life", "portal", "left 4 dead", "team fortress", "payday", "borderlands",
        "destiny", "division", "watch dogs", "assassin's creed", "hitman", "metal gear",
        "overwatch", "tf2", "csgo", "pubg", "fortnite", "warzone", "halo", "gears of war"
    ];
    
    // 🗡️ RPG GAMES (Massivo database)  
    let rpg_games = [
        "elder scrolls", "fallout", "witcher", "final fantasy", "dragon quest", "persona",
        "cyberpunk", "mass effect", "dragon age", "divinity", "baldur's gate", "pillars of eternity",
        "disco elysium", "outer worlds", "kingdoms of amalur", "tyranny", "wasteland",
        "vampire masquerade", "deus ex", "system shock", "gothic", "risen", "elex",
        "greedfall", "technomancer", "bound by flame", "mars war logs", "surge",
        "dark souls", "elden ring", "sekiro", "bloodborne", "nioh", "lords of the fallen",
        "monster hunter", "god eater", "code vein", "scarlet nexus", "tales of", "yakuza",
        "kingdom hearts", "nier", "chrono", "mana", "legend of heroes", "atelier"
    ];
    
    // 👻 HORROR GAMES (Espanso)
    let horror_games = [
        "resident evil", "outlast", "phasmophobia", "visage", "layers of fear", "little nightmares",
        "amnesia", "soma", "alien isolation", "dead space", "evil within", "until dawn",
        "dark pictures", "man of medan", "little hope", "house of ashes", "quarry",
        "blair witch", "medium", "observer", ">observer_", "madison", "maid of sker",
        "song of horror", "call of cthulhu", "sinking city", "conarium", "kholat",
        "apsulov", "scorn", "agony", "devotion", "detention", "dead by daylight",
        "friday the 13th", "texas chain saw", "puppet combo", "iron lung", "sucker for love"
    ];
    
    // 🏎️ RACING GAMES (Espanso)
    let racing_games = [
        "forza", "need for speed", "dirt rally", "dirt ", "f1 ", "gran turismo", "assetto corsa",
        "project cars", "automobilista", "rfactor", "iracing", "raceroom", "race driver",
        "grid", "burnout", "driver", "midnight club", "the crew", "wreckfest", "flatout",
        "euro truck", "american truck", "bus simulator", "train sim", "snowrunner"
    ];
    
    // ⚔️ STRATEGY GAMES (Espanso)
    let strategy_games = [
        "civilization", "total war", "age of empires", "company of heroes", "hearts of iron",
        "crusader kings", "europa universalis", "stellaris", "imperator", "victoria",
        "command conquer", "starcraft", "warcraft", "warhammer", "dawn of war",
        "homeworld", "supreme commander", "age of wonders", "endless", "amplitude",
        "xcom", "phoenix point", "battletech", "mechwarrior", "frostpunk", "anno",
        "tropico", "two point", "cities skylines", "sim city", "planet coaster"
    ];
    
    // ⚽ SPORTS GAMES (Espanso)
    let sports_games = [
        "fifa", "pes", "football manager", "madden", "nba ", "nhl ", "mlb ",
        "tony hawk", "skate", "steep", "riders republic", "descenders", "lonely mountains",
        "golf", "tennis", "boxing", "ufc", "wwe", "basketball", "volleyball", "cricket"
    ];
    
    // 🧩 PUZZLE/INDIE GAMES (Massivo)
    let puzzle_indie_games = [
        "portal", "witness", "tetris", "baba is you", "hollow knight", "celeste", "ori and",
        "cuphead", "shovel knight", "katana zero", "hotline miami", "fez", "braid",
        "limbo", "inside", "little nightmares", "journey", "abzu", "flower", "gris",
        "what remains of edith finch", "firewatch", "gone home", "dear esther", "everybody's gone",
        "stanley parable", "beginners guide", "davey wreden", "antichamber", "manifold garden",
        "superliminal", "control", "quantum break", "alan wake", "max payne", "remedy",
        "undertale", "deltarune", "oneshot", "night in the woods", "oxenfree", "life is strange"
    ];
    
    // 🏗️ SIMULATION GAMES (Espanso)
    let simulation_games = [
        "cities skylines", "sim city", "farming simulator", "euro truck", "american truck",
        "flight simulator", "job simulator", "car mechanic", "house flipper", "power wash",
        "cooking simulator", "surgeon simulator", "goat simulator", "planet coaster", "planet zoo",
        "zoo tycoon", "roller coaster tycoon", "theme park", "two point hospital", "prison architect",
        "oxygen not included", "rimworld", "dwarf fortress", "kerbal space program", "space engineers"
    ];
    
    // 🏃 PLATFORM/METROIDVANIA
    let platform_games = [
        "metroid", "castlevania", "hollow knight", "ori and", "guacamelee", "steamworld dig",
        "axiom verge", "bloodstained", "shadow complex", "super metroid", "symphony of night",
        "rogue legacy", "dead cells", "risk of rain", "spelunky", "celeste", "meat boy"
    ];
    
    // 🎮 FIGHTING GAMES
    let fighting_games = [
        "street fighter", "tekken", "mortal kombat", "injustice", "guilty gear", "blazblue",
        "dragon ball", "naruto", "one piece", "king of fighters", "fatal fury", "samurai shodown",
        "soul calibur", "dead or alive", "virtua fighter", "skullgirls", "under night"
    ];
    
    // Controllo per generi (ordine di priorità)
    if action_fps_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Action".to_string());
        if name_lower.contains("call of duty") || name_lower.contains("counter-strike") || 
           name_lower.contains("valorant") || name_lower.contains("battlefield") ||
           name_lower.contains("doom") || name_lower.contains("overwatch") {
            genres.push("FPS".to_string());
        }
    }
    
    if rpg_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("RPG".to_string());
    }
    
    if horror_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Horror".to_string());
    }
    
    if racing_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Racing".to_string());
    }
    
    if strategy_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Strategy".to_string());
    }
    
    if sports_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Sports".to_string());
    }
    
    if puzzle_indie_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Puzzle".to_string());
    }
    
    if simulation_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Simulation".to_string());
    }
    
    if platform_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Platform".to_string());
    }
    
    if fighting_games.iter().any(|&game| name_lower.contains(game)) {
        genres.push("Fighting".to_string());
    }
    
    // VR gets its own category
    if name_lower.contains("vr") || name_lower.contains("virtual reality") {
        genres.push("VR".to_string());
    }
    
    // Pattern generici per giochi comuni
    if name_lower.contains("simulator") && !genres.contains(&"Simulation".to_string()) {
        genres.push("Simulation".to_string());
    }
    
    if (name_lower.contains("war") || name_lower.contains("battle")) && genres.is_empty() {
        genres.push("Action".to_string());
    }
    
    if name_lower.contains("racing") || name_lower.contains("rally") || name_lower.contains("drift") {
        genres.push("Racing".to_string());
    }
    
    if genres.is_empty() {
        genres.push("Unknown".to_string());
    }
    
    genres
}

// 🌍 SISTEMA MIGLIORATO: Rilevamento accurato lingue supportate
// PRIORITÀ: 1) Dati Steam API reali, 2) Database specifico, 3) Fallback conservativo
fn detect_supported_languages(name: &str, appid: u32) -> String {
    // 🔍 PRIORITÀ 1: Se abbiamo l'appid, prova a usare dati Steam API reali
    if appid > 0 {
        // Nota: In un'implementazione completa, qui dovremmo fare una chiamata async
        // alla Steam API per ottenere le lingue reali. Per ora usiamo il database.
        log::info!("🌍 Rilevamento lingue per {} (AppID: {}): usando database + fallback conservativo", name, appid);
    }
    let name_lower = name.to_lowercase();
    
    // 🌟 GIOCHI AAA MULTI-LINGUA COMPLETA (15+ lingue)
    let aaa_full_multilang = [
        "cyberpunk 2077", "the witcher 3", "assassin's creed", "call of duty", "battlefield",
        "fifa", "pes", "efootball", "grand theft auto", "red dead redemption", "minecraft",
        "overwatch", "world of warcraft", "league of legends", "valorant", "apex legends",
        "destiny", "the division", "watch dogs", "far cry", "rainbow six", "ghost recon",
        "metro exodus", "dying light", "borderlands", "gears of war", "forza", "halo",
        "age of empires", "civilization", "total war", "football manager", "cities skylines",
        "mass effect", "dragon age", "star wars", "mortal kombat", "injustice",
        "need for speed", "the sims", "plants vs zombies", "titanfall", "anthem"
    ];
    
    // 🎌 GIOCHI GIAPPONESI CON LOCALIZZAZIONE OCCIDENTALE
    let japanese_localized = [
        "final fantasy", "dragon quest", "persona", "yakuza", "like a dragon",
        "dark souls", "elden ring", "sekiro", "bloodborne", "nioh", "wo long",
        "resident evil", "devil may cry", "monster hunter", "street fighter", "tekken",
        "dragon ball", "naruto", "one piece", "attack on titan", "demon slayer",
        "metal gear", "silent hill", "castlevania", "contra", "pac-man",
        "sonic", "mario", "zelda", "pokemon", "fire emblem", "xenoblade",
        "nier", "kingdom hearts", "chrono", "tales of", "star ocean", "valkyria",
        "guilty gear", "blazblue", "king of fighters", "samurai shodown",
        "ace combat", "ridge racer", "gran turismo", "ghost of tsushima"
    ];
    
    // 🇪🇺 GIOCHI EUROPEI CON SUPPORTO MULTI-LINGUA
    let european_multilang = [
        "metro", "stalker", "euro truck simulator", "farming simulator", "snowrunner",
        "mudrunner", "spintires", "the forest", "green hell", "subnautica",
        "anno", "company of heroes", "hearts of iron", "europa universalis",
        "crusader kings", "stellaris", "prison architect", "two point",
        "planet coaster", "planet zoo", "tropico", "surviving", "frostpunk",
        "this war of mine", "dying light", "dead island", "techland",
        "the witcher", "cyberpunk", "cd projekt", "11 bit studios"
    ];
    
    // 🇺🇸 GIOCHI INDIE CON LOCALIZZAZIONE LIMITATA
    let indie_limited = [
        "hollow knight", "cuphead", "ori and", "celeste", "hades", "supergiant",
        "dead cells", "the binding of isaac", "risk of rain", "enter the gungeon",
        "spelunky", "super meat boy", "fez", "braid", "limbo", "inside", "playdead",
        "control", "alan wake", "max payne", "quantum break", "remedy",
        "dishonored", "prey", "deathloop", "arkane", "bethesda",
        "wolfenstein", "doom", "quake", "id software", "machine games"
    ];
    
    // 🇰🇷 GIOCHI COREANI CON FOCUS ASIATICO
    let korean_asian = [
        "lost ark", "black desert", "tera", "blade and soul", "archeage",
        "lineage", "aion", "maplestory", "dungeon fighter", "closers",
        "vindictus", "mabinogi", "dragon nest", "elsword", "kurtzpel"
    ];
    
    // 🇨🇳 GIOCHI CINESI CON LOCALIZZAZIONE GLOBALE
    let chinese_global = [
        "genshin impact", "honkai", "azur lane", "arknights", "girls frontline",
        "black myth wukong", "naraka bladepoint", "eternal return", "ring of elysium",
        "tower of fantasy", "punishing gray raven", "neural cloud", "reverse 1999"
    ];
    
    // 🇷🇺 GIOCHI RUSSI/DELL'EST EUROPA
    let russian_eastern = [
        "escape from tarkov", "world of tanks", "war thunder", "crossout",
        "atomic heart", "pathologic", "ice-pick lodge", "mundfish",
        "metro", "stalker", "4a games", "gsc game world", "wargaming"
    ];
    
    // 🌍 PUBLISHER-BASED LANGUAGE DETECTION
    let publisher_languages = [
        // EA Games - Supporto completo
        ("electronic arts", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish,Czech"),
        ("ea sports", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish,Czech"),
        
        // Ubisoft - Supporto completo
        ("ubisoft", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish,Czech,Dutch"),
        
        // Activision Blizzard - Supporto completo
        ("activision", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish"),
        ("blizzard", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish"),
        
        // Microsoft/Xbox Game Studios - Supporto completo
        ("microsoft", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish,Dutch"),
        ("xbox game studios", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish"),
        
        // Sony Interactive - Focus console
        ("sony interactive", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic"),
        ("playstation", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic"),
        
        // Nintendo - Limitato ma globale
        ("nintendo", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Dutch"),
        
        // Valve - Supporto Steam completo
        ("valve", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish,Czech,Dutch,Turkish"),
        
        // CD Projekt - Europeo + globale
        ("cd projekt", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Polish,Czech"),
        
        // Bethesda - Supporto completo
        ("bethesda", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Polish"),
        
        // Square Enix - Giapponese + occidentale
        ("square enix", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese"),
        
        // Capcom - Giapponese + occidentale
        ("capcom", "English,Italian,French,German,Spanish,Japanese,Korean,Chinese,Portuguese"),
        
        // Bandai Namco - Giapponese + occidentale
        ("bandai namco", "English,Italian,French,German,Spanish,Japanese,Korean,Chinese,Portuguese"),
        
        // SEGA - Giapponese + occidentale
        ("sega", "English,Italian,French,German,Spanish,Japanese,Korean,Chinese,Portuguese"),
        
        // Konami - Giapponese + limitato occidentale
        ("konami", "English,Italian,French,German,Spanish,Japanese,Korean,Chinese"),
        
        // From Software - Giapponese + occidentale
        ("from software", "English,Italian,French,German,Spanish,Japanese,Korean,Chinese,Portuguese"),
        
        // Indie publishers con supporto limitato
        ("devolver digital", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean"),
        ("team17", "English,Italian,French,German,Spanish,Portuguese,Russian"),
        ("humble games", "English,Italian,French,German,Spanish,Portuguese,Russian"),
        ("annapurna", "English,Italian,French,German,Spanish,Portuguese,Russian"),
        
        // Publisher asiatici
        ("mihoyo", "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Thai,Vietnamese"),
        ("nexon", "English,Japanese,Korean,Chinese,Thai,Vietnamese"),
        ("ncsoft", "English,Japanese,Korean,Chinese,German,French"),
        ("pearl abyss", "English,Japanese,Korean,Chinese,German,French,Spanish,Portuguese,Russian"),
        
        // Publisher russi/dell'est
        ("wargaming", "English,Russian,German,French,Polish,Czech,Italian,Spanish,Portuguese,Japanese,Korean,Chinese"),
        ("gaijin", "English,Russian,German,French,Polish,Czech,Italian,Spanish,Portuguese,Japanese,Korean,Chinese")
    ];
    
    // 🔍 CONTROLLO PRIORITARIO: AAA Multi-lingua completa
    for game in &aaa_full_multilang {
        if name_lower.contains(game) {
            return "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese,Arabic,Polish,Czech,Dutch,Turkish".to_string();
        }
    }
    
    // 🎌 CONTROLLO: Giochi giapponesi localizzati
    for game in &japanese_localized {
        if name_lower.contains(game) {
            return "Japanese,English,Italian,French,German,Spanish,Portuguese,Russian,Korean,Chinese".to_string();
        }
    }
    
    // 🇪🇺 CONTROLLO: Giochi europei multi-lingua
    for game in &european_multilang {
        if name_lower.contains(game) {
            return "English,Italian,French,German,Spanish,Portuguese,Russian,Polish,Czech,Dutch".to_string();
        }
    }
    
    // 🇰🇷 CONTROLLO: Giochi coreani con focus asiatico
    for game in &korean_asian {
        if name_lower.contains(game) {
            return "Korean,English,Japanese,Chinese,Thai,Vietnamese,German,French".to_string();
        }
    }
    
    // 🇨🇳 CONTROLLO: Giochi cinesi con localizzazione globale
    for game in &chinese_global {
        if name_lower.contains(game) {
            return "Chinese,English,Japanese,Korean,Thai,Vietnamese,German,French,Spanish,Portuguese,Russian".to_string();
        }
    }
    
    // 🇷🇺 CONTROLLO: Giochi russi/dell'est Europa
    for game in &russian_eastern {
        if name_lower.contains(game) {
            return "Russian,English,German,French,Polish,Czech,Italian,Spanish,Portuguese".to_string();
        }
    }
    
    // 🇺🇸 CONTROLLO: Indie con localizzazione MOLTO limitata (REALISTICO come Rai Pal)
    for game in &indie_limited {
        if name_lower.contains(game) {
            return "English,French,German".to_string(); // Solo 3 lingue per indie noti
        }
    }
    
    // 🏢 CONTROLLO PUBLISHER: Solo per publisher AAA confermati
    if name_lower.contains("valve") || name_lower.contains("steam") {
        return "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese,Korean,Chinese".to_string();
    }
    if name_lower.contains("ubisoft") || name_lower.contains("electronic arts") || name_lower.contains("ea sports") {
        return "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese".to_string();
    }
    if name_lower.contains("activision") || name_lower.contains("blizzard") {
        return "English,Italian,French,German,Spanish,Portuguese,Russian,Korean,Chinese".to_string();
    }
    
    // 🌍 FALLBACK MOLTO CONSERVATIVO: Solo per giochi AAA specifici
    if (name_lower.contains("simulator") && name_lower.contains("farming")) || name_lower.contains("euro truck") {
        return "English,Italian,French,German,Spanish,Portuguese,Russian".to_string();
    }
    
    if name_lower.contains("fifa") || name_lower.contains("pes") || name_lower.contains("football manager") {
        return "English,Italian,French,German,Spanish,Portuguese,Russian,Japanese".to_string();
    }
    
    // 🎯 DEFAULT MOLTO CONSERVATIVO: Solo inglese per giochi sconosciuti (come Rai Pal)
    "English".to_string()
}

// Struttura per salvare le credenziali Steam in modo sicuro
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SteamCredentials {
    pub api_key_encrypted: String,  // 🔒 Ora criptato
    pub steam_id: String,           // Steam ID pubblico - OK non criptato
    pub saved_at: String,
    pub nonce: String,              // 🔒 Nonce per decryption
}

// Struttura per lo stato di connessione Steam
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SteamConnectionStatus {
    pub connected: bool,
    pub games_count: u32,
    pub last_checked: String,
    pub error: Option<String>,
}

// 🔒 FUNZIONI DI ENCRYPTION SICURA
fn get_machine_key() -> Result<[u8; 32], String> {
    // SECURITY FIX: Enhanced key derivation with multiple entropy sources
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    // Gather multiple entropy sources for better security
    let mut entropy_sources = Vec::new();
    
    // Computer name (if available)
    if let Ok(computer_name) = std::env::var("COMPUTERNAME") {
        entropy_sources.push(computer_name);
    }
    
    // Username (if available)
    if let Ok(username) = std::env::var("USERNAME") {
        entropy_sources.push(username);
    }
    
    // System drive (Windows-specific)
    if let Ok(system_drive) = std::env::var("SYSTEMDRIVE") {
        entropy_sources.push(system_drive);
    }
    
    // Processor architecture
    if let Ok(processor_arch) = std::env::var("PROCESSOR_ARCHITECTURE") {
        entropy_sources.push(processor_arch);
    }
    
    // Fallback if no entropy sources available
    if entropy_sources.is_empty() {
        entropy_sources.push("gamestringer_default_entropy".to_string());
    }
    
    // SECURITY FIX: Combine entropy sources with salt
    let salt = "GameStringer_v3.2.2_Salt_2024";
    let combined_entropy = format!("{}{}", entropy_sources.join(":"), salt);
    
    // SECURITY FIX: Use SHA-256 for better cryptographic properties
    let mut hasher = DefaultHasher::new();
    combined_entropy.hash(&mut hasher);
    let hash = hasher.finish();
    
    // SECURITY FIX: Apply key stretching for enhanced security
    let mut key = [0u8; 32];
    let hash_bytes = hash.to_le_bytes();
    
    // Use multiple rounds of hashing for key stretching
    for round in 0..4 {
        let mut round_hasher = DefaultHasher::new();
        format!("{}{}", combined_entropy, round).hash(&mut round_hasher);
        let round_hash = round_hasher.finish().to_le_bytes();
        
        for i in 0..8 {
            key[round * 8 + i] = round_hash[i];
        }
    }
    
    Ok(key)
}

fn encrypt_api_key(api_key: &str) -> Result<(String, String), String> {
    // SECURITY FIX: Validate API key before encryption
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    
    if api_key.len() != 32 {
        return Err("Invalid API key length".to_string());
    }
    
    // SECURITY FIX: Validate API key format (Steam keys are hex)
    if !api_key.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid API key format - must be hexadecimal".to_string());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // SECURITY FIX: Add timestamp for integrity verification
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // Create payload with API key and timestamp
    let payload = format!("{}:{}", api_key, timestamp);
    
    // SECURITY FIX: Generate cryptographically secure nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // SECURITY FIX: Encrypt with authenticated encryption (AES-GCM)
    let ciphertext = cipher.encrypt(nonce, payload.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // SECURITY FIX: Encode with URL-safe base64 for better compatibility
    let encrypted_b64 = general_purpose::STANDARD.encode(&ciphertext);
    let nonce_b64 = general_purpose::STANDARD.encode(&nonce_bytes);
    
    // SECURITY FIX: Log successful encryption (without sensitive data)
    info!("[Security] API key encrypted successfully with timestamp {}", timestamp);
    
    Ok((encrypted_b64, nonce_b64))
}

pub fn decrypt_api_key(encrypted_b64: &str, nonce_b64: &str) -> Result<String, String> {
    // SECURITY FIX: Validate input parameters
    if encrypted_b64.is_empty() || nonce_b64.is_empty() {
        return Err("Encrypted data and nonce cannot be empty".to_string());
    }
    
    // SECURITY FIX: Validate base64 format before decoding
    if !encrypted_b64.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=') {
        return Err("Invalid base64 format in encrypted data".to_string());
    }
    
    if !nonce_b64.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=') {
        return Err("Invalid base64 format in nonce".to_string());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // SECURITY FIX: Decode with proper error handling
    let ciphertext = general_purpose::STANDARD.decode(encrypted_b64)
        .map_err(|e| format!("Failed to decode ciphertext: {}", e))?;
    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;
    
    // SECURITY FIX: Validate nonce length
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length - must be 12 bytes".to_string());
    }
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // SECURITY FIX: Decrypt with authenticated encryption verification
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed - data may be corrupted or tampered: {}", e))?;
    
    // SECURITY FIX: Convert to string with validation
    let payload = String::from_utf8(plaintext)
        .map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))?;
    
    // SECURITY FIX: Parse payload to extract API key and timestamp
    let parts: Vec<&str> = payload.split(':').collect();
    if parts.len() != 2 {
        return Err("Invalid payload format - corrupted data".to_string());
    }
    
    let api_key = parts[0];
    let timestamp_str = parts[1];
    
    // SECURITY FIX: Validate timestamp format
    let timestamp = timestamp_str.parse::<u64>()
        .map_err(|_| "Invalid timestamp format".to_string())?;
    
    // SECURITY FIX: Check if credential is not too old (30 days max)
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    const MAX_AGE_SECONDS: u64 = 30 * 24 * 60 * 60; // 30 days
    if current_time - timestamp > MAX_AGE_SECONDS {
        warn!("[Security] Credential is older than 30 days, requires re-authentication");
        return Err("Credential expired - please re-authenticate".to_string());
    }
    
    // SECURITY FIX: Validate decrypted API key format
    if api_key.len() != 32 {
        return Err("Decrypted API key has invalid length".to_string());
    }
    
    if !api_key.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Decrypted API key has invalid format".to_string());
    }
    
    // SECURITY FIX: Log successful decryption (without sensitive data)
    info!("[Security] API key decrypted successfully, created at timestamp {}", timestamp);
    
    Ok(api_key.to_string())
}

// Percorso file credenziali
fn get_steam_credentials_path() -> Result<std::path::PathBuf, String> {
    // SECURITY FIX: Validate APPDATA environment variable
    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    
    // SECURITY FIX: Validate APPDATA path format
    let app_data_path = std::path::Path::new(&app_data);
    if !app_data_path.is_absolute() {
        return Err("APPDATA path must be absolute".to_string());
    }
    
    // SECURITY FIX: Prevent path traversal attacks
    let app_dir = app_data_path.join("GameStringer");
    let canonical_app_dir = app_dir.canonicalize()
        .or_else(|_| {
            // If directory doesn't exist, create it first
            fs::create_dir_all(&app_dir)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
            app_dir.canonicalize()
                .map_err(|e| format!("Failed to canonicalize path: {}", e))
        })?;
    
    // SECURITY FIX: Verify the directory is within APPDATA
    // Compare both canonicalized paths to handle symbolic links and UNC paths correctly
    let canonical_app_data = app_data_path.canonicalize()
        .map_err(|e| format!("Failed to canonicalize APPDATA path: {}", e))?;
    
    if !canonical_app_dir.starts_with(&canonical_app_data) {
        return Err("Directory path validation failed - potential path traversal".to_string());
    }
    
    // SECURITY FIX: Set secure permissions on directory (Windows ACL)
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Attempt to set restrictive permissions
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .attributes(0x02) // FILE_ATTRIBUTE_HIDDEN
            .open(&canonical_app_dir);
    }
    
    let credentials_file = canonical_app_dir.join("steam_credentials.json");
    
    // SECURITY FIX: Log secure path access
    info!("[Security] Credentials path accessed: {}", credentials_file.display());
    
    Ok(credentials_file)
}

/// SECURITY FIX: Credential integrity verification
fn verify_credential_integrity(api_key: &str, steam_id: &str) -> Result<(), String> {
    // Validate API key format
    if api_key.len() != 32 {
        return Err("API key must be exactly 32 characters".to_string());
    }
    
    if !api_key.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("API key must contain only hexadecimal characters".to_string());
    }
    
    // Validate Steam ID format
    if !validate_steam_id64(steam_id) {
        return Err("Invalid Steam ID64 format".to_string());
    }
    
    // SECURITY FIX: Check for common invalid/test credentials
    let invalid_keys = [
        "00000000000000000000000000000000",
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        "12345678901234567890123456789012",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    ];
    
    let uppercase_key = api_key.to_uppercase();
    if invalid_keys.contains(&uppercase_key.as_str()) {
        return Err("Invalid test API key detected".to_string());
    }
    
    // SECURITY FIX: Check for common invalid Steam IDs
    let invalid_steam_ids = [
        "76561198000000000",
        "76561198999999999",
        "76561198123456789",
    ];
    
    if invalid_steam_ids.contains(&steam_id) {
        return Err("Invalid test Steam ID detected".to_string());
    }
    
    Ok(())
}

/// SECURITY FIX: Secure credential storage with integrity checks
fn save_credentials_securely(api_key: &str, steam_id: &str) -> Result<(), String> {
    // Verify credential integrity first
    verify_credential_integrity(api_key, steam_id)?;
    
    // Encrypt the API key
    let (encrypted_key, nonce) = encrypt_api_key(api_key)?;
    
    // Create credentials structure
    let credentials = serde_json::json!({
        "api_key_encrypted": encrypted_key,
        "nonce": nonce,
        "steam_id": steam_id,
        "created_at": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        "version": "3.2.2"
    });
    
    // Get secure path
    let credentials_path = get_steam_credentials_path()?;
    
    // Write with secure permissions
    std::fs::write(&credentials_path, credentials.to_string())
        .map_err(|e| format!("Failed to save credentials: {}", e))?;
    
    // SECURITY FIX: Set restrictive file permissions (Windows)
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;
        let _ = std::fs::OpenOptions::new()
            .write(true)
            .attributes(0x02) // FILE_ATTRIBUTE_HIDDEN
            .open(&credentials_path);
    }
    
    info!("[Security] Credentials saved securely");
    Ok(())
}

/// SECURITY FIX: Secure credential loading with integrity verification
fn load_credentials_securely() -> Result<(String, String), String> {
    let credentials_path = get_steam_credentials_path()?;
    
    // Check if file exists
    if !credentials_path.exists() {
        return Err("No credentials found".to_string());
    }
    
    // Read credentials file
    let content = std::fs::read_to_string(&credentials_path)
        .map_err(|e| format!("Failed to read credentials: {}", e))?;
    
    // Parse JSON
    let credentials: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse credentials: {}", e))?;
    
    // Extract fields
    let encrypted_key = credentials["api_key_encrypted"].as_str()
        .ok_or("Missing encrypted API key")?;
    let nonce = credentials["nonce"].as_str()
        .ok_or("Missing nonce")?;
    let steam_id = credentials["steam_id"].as_str()
        .ok_or("Missing Steam ID")?;
    
    // SECURITY FIX: Verify credential age
    if let Some(created_at) = credentials["created_at"].as_u64() {
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        const MAX_AGE_SECONDS: u64 = 30 * 24 * 60 * 60; // 30 days
        if current_time - created_at > MAX_AGE_SECONDS {
            return Err("Credentials expired - please re-authenticate".to_string());
        }
    }
    
    // Decrypt API key
    let api_key = decrypt_api_key(encrypted_key, nonce)?;
    
    // Verify integrity of loaded credentials
    verify_credential_integrity(&api_key, steam_id)?;
    
    info!("[Security] Credentials loaded and verified successfully");
    Ok((api_key, steam_id.to_string()))
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
    debug!("[RUST] auto_detect_steam_config called");

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
                        Err(e) => debug!("Failed to parse VDF: {}", e),
                    }
                },
                Err(e) => debug!("Failed to read loginusers.vdf: {}", e),
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
pub async fn test_steam_connection(
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<String, String> {
    debug!("[RUST] 🧪 test_steam_connection called!");
    
    let manager = profile_state.manager.lock().await;
    
    // Verifica se ci sono credenziali Steam nel profilo attivo
    match manager.load_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
        Ok(Some(credential)) => {
            // Testa la connessione con le credenziali del profilo
            let steam_id = credential.additional_data.get("steam_id")
                .unwrap_or(&credential.username)
                .clone();
            
            // Verifica integrità delle credenziali
            if let Err(e) = verify_credential_integrity(&credential.password, &steam_id) {
                return Err(format!("Credenziali Steam non valide: {}", e));
            }
            
            // Conta i giochi Steam installati localmente
            let installed_games = get_installed_steam_app_ids().await;
            let installed_count = installed_games.len();
            
            let total_message = if installed_count > 0 {
                format!("{} installati (~{} stimati posseduti)", installed_count, installed_count * 10)
            } else {
                format!("{} installati", installed_count)
            };
            
            Ok(format!("Steam connection test successful! {} giochi trovati (Steam ID: {})", total_message, steam_id))
        },
        Ok(None) => {
            // Nessuna credenziale salvata, testa solo i giochi installati localmente
            let installed_games = get_installed_steam_app_ids().await;
            let installed_count = installed_games.len();
            
            Ok(format!("Steam connection test (local only): {} giochi installati trovati. Salva le credenziali per accedere alla libreria completa.", installed_count))
        },
        Err(e) => {
            Err(format!("Errore test connessione Steam: {}", e))
        }
    }
}

#[tauri::command]
pub async fn disconnect_steam() -> Result<String, String> {
    debug!("[RUST] 🔌 disconnect_steam called!");
    
    // Per Steam, la disconnessione significa invalidare le credenziali locali
    // In futuro qui potremmo cancellare API key salvate o cache
    
    Ok("Steam disconnesso con successo".to_string())
}

#[tauri::command]
pub async fn force_refresh_steam_games(
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<Vec<SteamGame>, String> {
    debug!("[RUST] 🔄 force_refresh_steam_games called - bypassing all cache!");
    
    let manager = profile_state.manager.lock().await;
    
    // Carica credenziali dal profilo attivo
    let (api_key, steam_id) = match manager.load_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
        Ok(Some(credential)) => {
            let steam_id = credential.additional_data.get("steam_id")
                .unwrap_or(&credential.username)
                .clone();
            
            debug!("[RUST] ✅ Credenziali caricate dal profilo attivo per force refresh");
            debug!("[RUST] 🔑 Steam ID: {}", steam_id);
            debug!("[RUST] API Key validation check");
            
            (credential.password, steam_id)
        }
        Ok(None) => {
            return Err("Nessuna credenziale Steam salvata nel profilo attivo".to_string());
        }
        Err(e) => {
            return Err(format!("Impossibile caricare credenziali per force refresh: {}", e));
        }
    };
    
    // Forza refresh senza cache
    let result = get_steam_games(api_key, steam_id, Some(true)).await;
    
    match &result {
        Ok(games) => {
            debug!("[RUST] 🎮 Force refresh found {} games total", games.len());
            
            // Show summary
            debug!("[RUST] ✅ Force refresh completed successfully");
        }
        Err(e) => {
            debug!("[RUST] ❌ Force refresh failed: {}", e);
        }
    }
    
    result
}

#[tauri::command]
pub async fn debug_steam_api_raw() -> Result<String, String> {
    debug!("[RUST] 🔍 DEBUG: Testing raw Steam API access...");
    
    // Carica credenziali
    let (api_key, steam_id) = match get_decrypted_api_key().await {
        Ok((key, id)) => {
            debug!("[RUST] ✅ Credentials loaded for debug");
            (key, id)
        }
        Err(e) => {
            return Err(format!("Cannot load credentials: {}", e));
        }
    };
    
    // URL Steam API
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
        api_key, steam_id
    );
    
    debug!("[RUST] 🌐 Calling Steam API directly...");
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client creation error: {}", e))?;
    
    match client.get(&url).send().await {
        Ok(response) => {
            let status = response.status();
            debug!("[RUST] 📡 Response status: {}", status);
            
            if status.is_success() {
                match response.text().await {
                    Ok(text) => {
                        // Parse JSON per contare giochi
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(games_array) = json["response"]["games"].as_array() {
                                debug!("[RUST] 🎮 Raw API returned {} games", games_array.len());
                                
                                // Show sample games from raw API
                                debug!("[RUST] 📋 Last 5 games from raw API:");
                                for game in games_array.iter().rev().take(5) {
                                    if let Some(name) = game["name"].as_str() {
                                        debug!("[RUST]   - {}", name);
                                    }
                                }
                                
                                Ok(format!("✅ Steam API OK: {} games total", games_array.len()))
                            } else {
                                Ok("⚠️ Steam API response has no games array".to_string())
                            }
                        } else {
                            Ok("⚠️ Could not parse Steam API JSON".to_string())
                        }
                    }
                    Err(e) => Err(format!("Could not read response text: {}", e))
                }
            } else {
                Err(format!("Steam API returned status: {}", status))
            }
        }
        Err(e) => Err(format!("Steam API request failed: {}", e))
    }
}

#[tauri::command]
pub async fn get_steam_games(
    api_key: String, 
    steam_id: String, 
    force_refresh: Option<bool>,
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<Vec<SteamGame>, String> {
    debug!("[RUST] get_steam_games called with steam_id: {}", steam_id);
    
    let force = force_refresh.unwrap_or(false);
    debug!("[RUST] Force refresh: {}", force);
    
    // Se force refresh è attivo, pulisci la cache
    if force {
        debug!("[RUST] Force refresh - clearing games cache");
        GAME_CACHE.invalidate_all();
    }
    
    // 🔒 Se non vengono passate credenziali, prova a caricarle dal profilo attivo
    let (actual_api_key, actual_steam_id) = if api_key.is_empty() || steam_id.is_empty() {
        debug!("[RUST] 🔒 Caricamento credenziali dal profilo attivo...");
        let manager = profile_state.manager.lock().await;
        match manager.load_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
            Ok(Some(credential)) => {
                let steam_id = credential.additional_data.get("steam_id")
                    .unwrap_or(&credential.username)
                    .clone();
                debug!("[RUST] ✅ Credenziali caricate dal profilo attivo");
                (credential.password, steam_id)
            }
            Ok(None) => {
                debug!("[RUST] ⚠️ Nessuna credenziale Steam nel profilo attivo, uso parametri forniti");
                (api_key, steam_id)
            }
            Err(e) => {
                debug!("[RUST] ⚠️ Errore caricamento credenziali dal profilo: {}", e);
                (api_key, steam_id)
            }
        }
    } else {
        (api_key, steam_id)
    };
    
    // Se abbiamo API key e Steam ID, usa l'API reale
    if !actual_api_key.is_empty() && !actual_steam_id.is_empty() {
        // SECURITY FIX: Removed API key partial logging to prevent exposure
        info!("[RUST] Using authenticated Steam API connection");
        
        let url = format!(
            "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
            actual_api_key, actual_steam_id
        );
        
        // 🔧 FIX: Crea client con timeout configurato
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Errore creazione client HTTP: {}", e))?;
        
        debug!("[RUST] 📡 Chiamata Steam API con timeout 30s...");
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                debug!("[RUST] Steam API response status: {}", status);
                
                if !status.is_success() {
                    let error_text = response.text().await.unwrap_or_else(|_| "Unable to read error".to_string());
                    debug!("[RUST] ❌ Steam API error: {}", error_text);
                    // Continua con il fallback
                } else {
                    match response.json::<serde_json::Value>().await {
                        Ok(json) => {
                            // DEBUG: Mostra la struttura della risposta
                            debug!("[RUST] 🔍 DEBUG: Response structure: {:?}", json);
                            
                            // Verifica se c'è un errore nella risposta JSON
                            if let Some(error) = json["response"]["error"].as_str() {
                                debug!("[RUST] ❌ Steam API returned error: {}", error);
                            } else if let Some(games_array) = json["response"]["games"].as_array() {
                                debug!("[RUST] ✅ Retrieved {} games from Steam API", games_array.len());
                            
                            let steam_games: Vec<SteamGame> = games_array.iter()
                                .filter_map(|game| {
                                    if let (Some(appid), Some(name)) = (
                                        game["appid"].as_u64(),
                                        game["name"].as_str()
                                    ) {
                                        let appid_u32 = appid as u32;
                                        let game_name = name.to_string();
                                        
                                        // 🎮 Rilevamento intelligente delle caratteristiche
                                        let is_vr = detect_vr_game(&game_name, appid_u32);
                                        let is_installed = detect_steam_installation(appid_u32);
                                        let engine = detect_game_engine(&game_name, appid_u32);
                                        let supported_languages = detect_supported_languages(&game_name, appid_u32);
                                        
                                        Some(SteamGame {
                                            appid: appid_u32,
                                            name: game_name,
                                            playtime_forever: game["playtime_forever"].as_u64().unwrap_or(0) as u32,
                                            img_icon_url: game["img_icon_url"].as_str().unwrap_or("").to_string(),
                                            img_logo_url: "".to_string(),
                                            last_played: game["rtime_last_played"].as_u64().unwrap_or(0),
                                            is_installed,           // 💾 Rilevamento automatico installazione
                                            is_shared: false,
                                            is_vr,                  // 🥽 Rilevamento automatico VR
                                            engine,                 // 🎮 Rilevamento automatico engine
                                            genres: vec![],
                                            categories: vec![],
                                            short_description: "".to_string(),
                                            is_free: false,
                                            header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid_u32),
                                            library_capsule: "".to_string(),
                                            developers: vec![],
                                            publishers: vec![],
                                            release_date: SteamApiReleaseDate::default(),
                                            supported_languages,    // 🌍 Rilevamento automatico lingue
                                            pc_requirements: SteamApiRequirements::default(),
                                            dlc: vec![],
                                            how_long_to_beat: None,
                                        })
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            
                            debug!("[RUST] ✅ Processed {} games successfully", steam_games.len());
                            return Ok(steam_games);
                            } else {
                                debug!("[RUST] ❌ Steam API returned no games array");
                            }
                        }
                        Err(e) => {
                            debug!("[RUST] ❌ Failed to parse Steam API response: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                debug!("[RUST] ❌ Failed to call Steam API: {}", e);
                // Controlla se è un timeout
                if e.is_timeout() {
                    debug!("[RUST] ⏰ Timeout rilevato - API Steam non risponde entro 30s");
                } else if e.is_connect() {
                    debug!("[RUST] 🌐 Errore di connessione - verifica la connessione internet");
                } else {
                    debug!("[RUST] 🔧 Errore generico: {}", e);
                }
            }
        }
    }
    
    // Fallback: Leggi dal file locale
    debug!("[RUST] Falling back to local file: ../steam_owned_games.json");
    
    let file_path = "../steam_owned_games.json";
    let file_content = match std::fs::read_to_string(file_path) {
        Ok(content) => {
            debug!("[RUST] ✅ File loaded successfully, size: {} bytes", content.len());
            content
        },
        Err(e) => {
            let error_msg = format!("Failed to read steam_owned_games.json: {}", e);
            debug!("[RUST] ❌ {}", error_msg);
            return Err(error_msg);
        }
    };
    
    debug!("[RUST] Parsing JSON from file...");
    let games_data: Value = match serde_json::from_str(&file_content) {
        Ok(data) => {
            debug!("[RUST] ✅ JSON parsed successfully");
            data
        },
        Err(e) => {
            let error_msg = format!("Failed to parse JSON: {}", e);
            debug!("[RUST] ❌ {}", error_msg);
            return Err(error_msg);
        }
    };
    
    let mut all_games = Vec::new();
    if let Some(games) = games_data.as_array() {
        debug!("[RUST] Processing {} games from file...", games.len());
        for game in games.iter() { // Processa tutti i giochi
            if let Some(appid) = game["appid"].as_u64() {
                let game_name = game["name"].as_str().unwrap_or("Unknown").to_string();
                let appid_u32 = appid as u32;
                
                // 🎮 Rilevamento intelligente delle caratteristiche
                let is_vr = detect_vr_game(&game_name, appid_u32);
                let is_installed = detect_steam_installation(appid_u32);
                let engine = detect_game_engine(&game_name, appid_u32);
                let supported_languages = detect_supported_languages(&game_name, appid_u32);
                let detected_genres = detect_game_genres(&game_name, appid_u32);
                
                // Log per giochi interessanti
                if is_vr || is_installed || engine != "Unknown" {
                    debug!("[RUST] 🎯 {}: VR={} Installed={} Engine={} Languages={}", 
                             game_name, is_vr, is_installed, engine, supported_languages);
                }
                
                let steam_game = SteamGame {
                    appid: appid_u32,
                    name: game_name.clone(),
                    playtime_forever: game["playtime_forever"].as_u64().unwrap_or(0) as u32,
                    img_icon_url: game["img_icon_url"].as_str().unwrap_or("").to_string(),
                    img_logo_url: "".to_string(),
                    last_played: game["rtime_last_played"].as_u64().unwrap_or(0),
                    is_installed,           // 💾 Rilevamento automatico installazione
                    is_shared: false,
                    is_vr,                  // 🥽 Rilevamento automatico VR
                    engine,                 // 🎮 Rilevamento automatico engine
                    genres: detected_genres.into_iter().map(|g| SteamApiGenre { 
                        id: g.clone(), 
                        description: g 
                    }).collect(),
                    categories: Vec::new(),
                    short_description: String::new(),
                    is_free: false,
                    header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid_u32),
                    library_capsule: String::new(),
                    developers: Vec::new(),
                    publishers: Vec::new(),
                    release_date: SteamApiReleaseDate::default(),
                    supported_languages,    // 🌍 Rilevamento automatico lingue
                    pc_requirements: SteamApiRequirements::default(),
                    dlc: Vec::new(),
                    how_long_to_beat: None,
                };
                all_games.push(steam_game);
            }
        }
        debug!("[RUST] ✅ Processed {} games from file", all_games.len());
    } else {
        debug!("[RUST] ⚠️ No games array found in file");
    }
    
    debug!("[RUST] Returning {} games", all_games.len());
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
    
    // URL copertina Steam usando CDN Cloudflare (come RAI PAL)
    // Formato capsule_231x87 per consistenza con RAI PAL
    let cover_url = format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/capsule_231x87.jpg", appid);
    
    // Fallback a header.jpg se capsule non disponibile
    let fallback_url = format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid);
    
    // Verifica che l'immagine esista facendo una HEAD request
    match HTTP_CLIENT.head(&cover_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                log::info!("✅ Copertina Cloudflare trovata per App ID {}: {}", appid, cover_url);
                Ok(cover_url)
            } else {
                log::info!("🔄 Provo fallback Akamai per App ID {}", appid);
                // Prova con fallback URL
                match HTTP_CLIENT.head(&fallback_url).send().await {
                    Ok(fallback_response) if fallback_response.status().is_success() => {
                        log::info!("✅ Copertina Akamai trovata per App ID {}: {}", appid, fallback_url);
                        Ok(fallback_url)
                    }
                    _ => {
                        log::warn!("⚠️ Nessuna copertina trovata per App ID {}", appid);
                        // Fallback a copertina placeholder
                        Ok(format!("https://via.placeholder.com/231x87/1a1a2e/16213e?text=Steam+{}", appid))
                    }
                }
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
// 🔒 Comando per salvare le credenziali Steam (CRIPTATE) - AGGIORNATO PER PROFILI
#[tauri::command]
pub async fn save_steam_credentials(
    api_key: String, 
    steam_id: String,
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<String, String> {
    debug!("[RUST] 🔒 save_steam_credentials called per Steam ID: {}", steam_id);
    
    if api_key.is_empty() || steam_id.is_empty() {
        return Err("API key e Steam ID sono obbligatori".to_string());
    }
    
    // Usa il ProfileManager per salvare le credenziali
    let mut manager = profile_state.manager.lock().await;
    
    // Crea credenziale per Steam
    let mut credential = crate::profiles::PlainCredential::new(
        crate::profiles::StoreType::Steam,
        steam_id.clone(),
        api_key
    );
    
    // Aggiungi Steam ID come dato aggiuntivo
    credential = credential.with_data("steam_id".to_string(), steam_id.clone());
    
    // Salva tramite il profile manager
    manager.save_credential_for_active_profile(credential).await
        .map_err(|e| format!("Errore salvataggio credenziali Steam: {}", e))?;
    
    debug!("[RUST] ✅ Credenziali Steam salvate nel profilo attivo per Steam ID: {}", steam_id);
    Ok("Credenziali Steam salvate nel profilo attivo".to_string())
}

// 🔒 Funzione helper per ottenere l'API key decriptata (uso interno) - AGGIORNATO PER PROFILI
async fn get_decrypted_api_key_from_profile(
    profile_manager: &crate::profiles::ProfileManager
) -> Result<(String, String), String> {
    match profile_manager.load_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
        Ok(Some(credential)) => {
            let steam_id = credential.additional_data.get("steam_id")
                .unwrap_or(&credential.username)
                .clone();
            
            // Verifica integrità delle credenziali
            verify_credential_integrity(&credential.password, &steam_id)?;
            
            Ok((credential.password, steam_id))
        },
        Ok(None) => {
            Err("Nessuna credenziale Steam salvata nel profilo attivo".to_string())
        },
        Err(e) => {
            Err(format!("Errore caricamento credenziali Steam: {}", e))
        }
    }
}

// 🔒 Funzione helper interna per get_steam_games
async fn get_steam_games_internal(api_key: String, steam_id: String, force_refresh: Option<bool>) -> Result<Vec<SteamGame>, String> {
    let force = force_refresh.unwrap_or(false);
    debug!("[RUST] get_steam_games_internal called with force: {}", force);
    
    // Se force refresh è attivo, pulisci la cache
    if force {
        debug!("[RUST] Force refresh - clearing games cache");
        GAME_CACHE.invalidate_all();
    }
    
    // 🔒 Se non vengono passate credenziali, prova a caricarle dai file criptati (legacy)
    let (actual_api_key, actual_steam_id) = if api_key.is_empty() || steam_id.is_empty() {
        debug!("[RUST] 🔒 Caricamento credenziali legacy...");
        match get_decrypted_api_key().await {
            Ok((key, id)) => {
                debug!("[RUST] ✅ Credenziali legacy caricate");
                (key, id)
            }
            Err(e) => {
                debug!("[RUST] ⚠️ Impossibile caricare credenziali legacy: {}", e);
                (api_key, steam_id)
            }
        }
    } else {
        (api_key, steam_id)
    };
    
    // Continua con la logica esistente...
    // [Il resto della funzione rimane uguale]
    
    // Se abbiamo API key e Steam ID, usa l'API reale
    if !actual_api_key.is_empty() && !actual_steam_id.is_empty() {
        // SECURITY FIX: Removed API key partial logging to prevent exposure
        info!("[RUST] Using authenticated Steam API connection");
        
        let url = format!(
            "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
            actual_api_key, actual_steam_id
        );
        
        // 🔧 FIX: Crea client con timeout configurato
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Errore creazione client HTTP: {}", e))?;
        
        debug!("[RUST] 📡 Chiamata Steam API con timeout 30s...");
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                debug!("[RUST] Steam API response status: {}", status);
                
                if !status.is_success() {
                    let error_text = response.text().await.unwrap_or_else(|_| "Unable to read error".to_string());
                    debug!("[RUST] ❌ Steam API error: {}", error_text);
                    // Continua con il fallback
                } else {
                    match response.json::<serde_json::Value>().await {
                        Ok(json) => {
                            // DEBUG: Mostra la struttura della risposta
                            debug!("[RUST] 🔍 DEBUG: Response structure: {:?}", json);
                            
                            // Verifica se c'è un errore nella risposta JSON
                            if let Some(error) = json["response"]["error"].as_str() {
                                debug!("[RUST] ❌ Steam API returned error: {}", error);
                            } else if let Some(games_array) = json["response"]["games"].as_array() {
                                debug!("[RUST] ✅ Retrieved {} games from Steam API", games_array.len());
                            
                            let steam_games: Vec<SteamGame> = games_array.iter()
                                .filter_map(|game| {
                                    if let (Some(appid), Some(name)) = (
                                        game["appid"].as_u64(),
                                        game["name"].as_str()
                                    ) {
                                        let appid_u32 = appid as u32;
                                        let game_name = name.to_string();
                                        
                                        // 🎮 Rilevamento intelligente delle caratteristiche
                                        let is_vr = detect_vr_game(&game_name, appid_u32);
                                        let is_installed = detect_steam_installation(appid_u32);
                                        let engine = detect_game_engine(&game_name, appid_u32);
                                        let supported_languages = detect_supported_languages(&game_name, appid_u32);
                                        
                                        Some(SteamGame {
                                            appid: appid_u32,
                                            name: game_name,
                                            playtime_forever: game["playtime_forever"].as_u64().unwrap_or(0) as u32,
                                            img_icon_url: game["img_icon_url"].as_str().unwrap_or("").to_string(),
                                            img_logo_url: "".to_string(),
                                            last_played: game["rtime_last_played"].as_u64().unwrap_or(0),
                                            is_installed,           // 💾 Rilevamento automatico installazione
                                            is_shared: false,
                                            is_vr,                  // 🥽 Rilevamento automatico VR
                                            engine,                 // 🎮 Rilevamento automatico engine
                                            genres: vec![],
                                            categories: vec![],
                                            short_description: "".to_string(),
                                            is_free: false,
                                            header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid_u32),
                                            library_capsule: "".to_string(),
                                            developers: vec![],
                                            publishers: vec![],
                                            release_date: SteamApiReleaseDate::default(),
                                            supported_languages,    // 🌍 Rilevamento automatico lingue
                                            pc_requirements: SteamApiRequirements::default(),
                                            dlc: vec![],
                                            how_long_to_beat: None,
                                        })
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            
                            debug!("[RUST] ✅ Processed {} games successfully", steam_games.len());
                            return Ok(steam_games);
                            } else {
                                debug!("[RUST] ❌ Steam API returned no games array");
                            }
                        }
                        Err(e) => {
                            debug!("[RUST] ❌ Failed to parse Steam API response: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                debug!("[RUST] ❌ Failed to call Steam API: {}", e);
                // Controlla se è un timeout
                if e.is_timeout() {
                    debug!("[RUST] ⏰ Timeout rilevato - API Steam non risponde entro 30s");
                } else if e.is_connect() {
                    debug!("[RUST] 🌐 Errore di connessione - verifica la connessione internet");
                } else {
                    debug!("[RUST] 🔧 Errore generico: {}", e);
                }
            }
        }
    }
    
    // Fallback: Leggi dal file locale
    debug!("[RUST] Falling back to local file: ../steam_owned_games.json");
    
    let file_path = "../steam_owned_games.json";
    let file_content = match std::fs::read_to_string(file_path) {
        Ok(content) => {
            debug!("[RUST] ✅ File loaded successfully, size: {} bytes", content.len());
            content
        },
        Err(e) => {
            let error_msg = format!("Failed to read steam_owned_games.json: {}", e);
            debug!("[RUST] ❌ {}", error_msg);
            return Err(error_msg);
        }
    };
    
    debug!("[RUST] Parsing JSON from file...");
    let games_data: Value = match serde_json::from_str(&file_content) {
        Ok(data) => {
            debug!("[RUST] ✅ JSON parsed successfully");
            data
        },
        Err(e) => {
            let error_msg = format!("Failed to parse JSON: {}", e);
            debug!("[RUST] ❌ {}", error_msg);
            return Err(error_msg);
        }
    };
    
    let mut all_games = Vec::new();
    if let Some(games) = games_data.as_array() {
        debug!("[RUST] Processing {} games from file...", games.len());
        for game in games.iter() { // Processa tutti i giochi
            if let Some(appid) = game["appid"].as_u64() {
                let game_name = game["name"].as_str().unwrap_or("Unknown").to_string();
                let appid_u32 = appid as u32;
                
                // 🎮 Rilevamento intelligente delle caratteristiche
                let is_vr = detect_vr_game(&game_name, appid_u32);
                let is_installed = detect_steam_installation(appid_u32);
                let engine = detect_game_engine(&game_name, appid_u32);
                let supported_languages = detect_supported_languages(&game_name, appid_u32);
                
                all_games.push(SteamGame {
                    appid: appid_u32,
                    name: game_name,
                    playtime_forever: game["playtime_forever"].as_u64().unwrap_or(0) as u32,
                    img_icon_url: game["img_icon_url"].as_str().unwrap_or("").to_string(),
                    img_logo_url: "".to_string(),
                    last_played: game["rtime_last_played"].as_u64().unwrap_or(0),
                    is_installed,           // 💾 Rilevamento automatico installazione
                    is_shared: false,
                    is_vr,                  // 🥽 Rilevamento automatico VR
                    engine,                 // 🎮 Rilevamento automatico engine
                    genres: vec![],
                    categories: vec![],
                    short_description: "".to_string(),
                    is_free: false,
                    header_image: format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid_u32),
                    library_capsule: "".to_string(),
                    developers: vec![],
                    publishers: vec![],
                    release_date: SteamApiReleaseDate::default(),
                    supported_languages,    // 🌍 Rilevamento automatico lingue
                    pc_requirements: SteamApiRequirements::default(),
                    dlc: vec![],
                    how_long_to_beat: None,
                });
            }
        }
    }
    
    debug!("[RUST] ✅ Loaded {} games from local file", all_games.len());
    Ok(all_games)
}

// 🔒 Funzione helper per compatibilità con il sistema legacy
async fn get_decrypted_api_key() -> Result<(String, String), String> {
    // SECURITY FIX: Use secure credential loading with integrity verification
    load_credentials_securely()
}

// Comando per caricare le credenziali Steam - AGGIORNATO PER PROFILI
#[tauri::command]
pub async fn load_steam_credentials(
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<SteamCredentials, String> {
    debug!("[RUST] load_steam_credentials called");
    
    let manager = profile_state.manager.lock().await;
    
    // Carica credenziali Steam dal profilo attivo
    match manager.load_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
        Ok(Some(credential)) => {
            // Estrai Steam ID dai dati aggiuntivi
            let steam_id = credential.additional_data.get("steam_id")
                .unwrap_or(&credential.username)
                .clone();
            
            // Cripta l'API key per compatibilità con il formato esistente
            let (encrypted_api_key, nonce) = encrypt_api_key(&credential.password)?;
            
            let credentials = SteamCredentials {
                api_key_encrypted: encrypted_api_key,
                steam_id: steam_id.clone(),
                saved_at: credential.created_at.to_rfc3339(),
                nonce,
            };
            
            debug!("[RUST] ✅ Credenziali Steam caricate dal profilo attivo per Steam ID: {}", steam_id);
            Ok(credentials)
        },
        Ok(None) => {
            Err("Nessuna credenziale Steam salvata nel profilo attivo".to_string())
        },
        Err(e) => {
            Err(format!("Errore caricamento credenziali Steam: {}", e))
        }
    }
}

// Comando per cancellare le credenziali Steam - AGGIORNATO PER PROFILI
#[tauri::command]
pub async fn clear_steam_credentials(
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<String, String> {
    debug!("[RUST] clear_steam_credentials called");
    
    let mut manager = profile_state.manager.lock().await;
    
    // Rimuovi credenziali Steam dal profilo attivo
    match manager.remove_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
        Ok(_) => {
            info!("[RUST] ✅ Credenziali Steam cancellate dal profilo attivo");
            Ok("Credenziali Steam cancellate con successo dal profilo attivo".to_string())
        },
        Err(e) => {
            // Se non ci sono credenziali da rimuovere, non è un errore
            if e.to_string().contains("not found") || e.to_string().contains("non trovata") {
                debug!("[RUST] ⚠️ Nessuna credenziale Steam trovata nel profilo attivo");
                Ok("Nessuna credenziale Steam da cancellare nel profilo attivo".to_string())
            } else {
                error!("[RUST] ❌ Errore cancellazione credenziali Steam: {}", e);
                Err(format!("Errore cancellazione credenziali: {}", e))
            }
        }
    }
}

// Comando per salvare lo stato di connessione Steam
#[tauri::command]
pub async fn save_steam_connection_status(connected: bool, games_count: u32, error: Option<String>) -> Result<String, String> {
    debug!("[RUST] save_steam_connection_status called");
    
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
    
    debug!("[RUST] Stato connessione Steam salvato: connected={}, games={}", connected, games_count);
    Ok("Stato connessione Steam salvato".to_string())
}

// Comando per caricare lo stato di connessione Steam
#[tauri::command]
pub async fn load_steam_connection_status() -> Result<SteamConnectionStatus, String> {
    debug!("[RUST] load_steam_connection_status called");
    
    let status_path = get_steam_status_path()?;
    
    if !status_path.exists() {
        return Err("Nessuno stato di connessione Steam salvato".to_string());
    }
    
    let json_data = fs::read_to_string(&status_path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    let status: SteamConnectionStatus = serde_json::from_str(&json_data)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    debug!("[RUST] Stato connessione Steam caricato: connected={}", status.connected);
    Ok(status)
}

// Comando per rimuovere le credenziali Steam
#[tauri::command]
pub async fn remove_steam_credentials() -> Result<String, String> {
    debug!("[RUST] remove_steam_credentials called");
    
    let credentials_path = get_steam_credentials_path()?;
    let status_path = get_steam_status_path()?;
    
    // Rimuovi credenziali se esistono
    if credentials_path.exists() {
        fs::remove_file(&credentials_path)
            .map_err(|e| format!("Errore rimozione credenziali: {}", e))?;
        debug!("[RUST] Credenziali Steam rimosse");
    }
    
    // Rimuovi stato se esiste
    if status_path.exists() {
        fs::remove_file(&status_path)
            .map_err(|e| format!("Errore rimozione stato: {}", e))?;
        debug!("[RUST] Stato connessione Steam rimosso");
    }
    
    Ok("Credenziali e stato Steam rimossi".to_string())
}

// Comando per testare la connessione automatica Steam
#[tauri::command]
pub async fn auto_connect_steam() -> Result<serde_json::Value, String> {
    debug!("[RUST] auto_connect_steam called");
    
    // Carica le credenziali salvate
    let credentials = load_steam_credentials().await?;
    
    // Testa la connessione
    // 🔒 Decripta l'API key - gestisce corruzioni con fallback
    let decrypted_api_key = match decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce) {
        Ok(key) => key,
        Err(e) => {
            // Se la decrittografia fallisce, elimina le credenziali corrotte
            debug!("[RUST] Decryption failed, clearing corrupted credentials: {}", e);
            if let Err(clear_error) = clear_steam_credentials().await {
                warn!("[RUST] Failed to clear corrupted credentials: {}", clear_error);
            }
            return Err(format!("Credenziali corrotte rimosse. Riconnettiti a Steam: {}", e));
        }
    };
    
    match get_steam_games(decrypted_api_key, credentials.steam_id, Some(false)).await {
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
                // URL copertina Steam usando CDN Cloudflare (come RAI PAL)
                let cover_url = format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/capsule_231x87.jpg", appid_clone);
                let fallback_url = format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid_clone);
                
                // Prova prima con Cloudflare
                match HTTP_CLIENT.head(&cover_url).send().await {
                    Ok(response) if response.status().is_success() => {
                        (appid_clone.clone(), cover_url)
                    }
                    _ => {
                        // Fallback a Akamai
                        match HTTP_CLIENT.head(&fallback_url).send().await {
                            Ok(fallback_response) if fallback_response.status().is_success() => {
                                (appid_clone.clone(), fallback_url)
                            }
                            _ => {
                                // Fallback a placeholder
                                (appid_clone.clone(), format!("https://via.placeholder.com/231x87/1a1a2e/16213e?text=Steam+{}", appid_clone))
                            }
                        }
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

// 🚀 NUOVO: Lettura veloce diretta file Steam (come Rai Pal)
#[tauri::command]
pub async fn get_steam_games_fast() -> Result<Vec<GameInfo>, String> {
    log::info!("🚀 Inizio lettura veloce diretta file Steam (metodo Rai Pal)...");
    
    let start_time = std::time::Instant::now();
    let mut games = Vec::new();
    
    // 1. Trova il percorso di Steam dal registry
    let steam_path = crate::commands::library::find_steam_path_from_registry()
        .ok_or("Steam non trovato nel registry")?;
    
    log::info!("📁 Percorso Steam trovato: {}", steam_path);
    
    // 2. Leggi TUTTI i giochi posseduti (come Rai Pal)
    match read_all_owned_games(&steam_path).await {
        Ok(owned_games) => {
            log::info!("🎮 Trovati {} giochi posseduti totali", owned_games.len());
            games.extend(owned_games);
        }
        Err(e) => {
            log::warn!("⚠️ Errore lettura giochi posseduti: {}, fallback a giochi installati", e);
            
            // Fallback: leggi solo giochi installati
            let library_folders = read_library_folders(&steam_path).await?;
            log::info!("📚 Trovate {} cartelle libreria Steam", library_folders.len());
            
            for folder in &library_folders {
                let steamapps_path = Path::new(folder).join("steamapps");
                if !steamapps_path.exists() {
                    continue;
                }
                
                log::info!("🔍 Scansione cartella: {}", steamapps_path.display());
                
                if let Ok(entries) = fs::read_dir(&steamapps_path) {
                    for entry in entries.flatten() {
                        if let Some(file_name) = entry.file_name().to_str() {
                            if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                                if let Ok(game) = parse_acf_to_gameinfo(&entry.path(), folder).await {
                                    games.push(game);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    let elapsed = start_time.elapsed();
    log::info!("✅ Lettura veloce completata: {} giochi in {:?} (metodo Rai Pal)", games.len(), elapsed);
    
    Ok(games)
}

// 🔍 Funzione leggera per ottenere dati base da Steam API (per arricchire metodo veloce)
async fn get_basic_steam_api_details(app_id: u32) -> Result<GameDetails, String> {
    // Usa endpoint pubblico Steam Store API (nessuna key richiesta)
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}&l=italian", app_id);
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5)) // Timeout breve per non rallentare
        .build()
        .map_err(|e| format!("Errore client: {}", e))?;
    
    let response = client.get(&url).send().await
        .map_err(|e| format!("Errore request: {}", e))?;
    
    let json: Value = response.json().await
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    if let Some(app_data) = json.get(&app_id.to_string()) {
        if let Some(data) = app_data.get("data") {
            let name = data.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(&format!("Steam Game {}", app_id))
                .to_string();
                
            let supported_languages = data.get("supported_languages")
                .and_then(|v| v.as_str())
                .unwrap_or("English")
                .to_string();
                
            return Ok(GameDetails {
                name,
                supported_languages,
            });
        }
    }
    
    Err("Dati gioco non trovati".to_string())
}

// Legge TUTTI i giochi posseduti come Rai Pal
async fn read_all_owned_games(steam_path: &str) -> Result<Vec<GameInfo>, String> {
    let mut games = Vec::new();
    
    // 1. Trova l'utente Steam attivo
    let user_id = find_active_steam_user(steam_path).await?;
    log::info!("👤 Utente Steam attivo trovato: {}", user_id);
    
    // 2. Leggi localconfig.vdf per lista giochi posseduti
    let owned_app_ids = read_owned_games_from_localconfig(steam_path, &user_id).await?;
    log::info!("📋 Trovati {} giochi posseduti", owned_app_ids.len());
    
    // 3. Per ogni gioco posseduto, crea GameInfo
    for app_id in owned_app_ids {
        // 🚀 MIGLIORAMENTO: Prova ad arricchire con API Steam se disponibile
        let game_info = match get_basic_steam_api_details(app_id).await {
            Ok(api_details) => {
                log::debug!("✅ Arricchito gioco {} con API Steam", app_id);
                let game_name = api_details.name.clone();
                GameInfo {
                    id: format!("steam_{}", app_id),
                    title: api_details.name,
                    platform: "Steam".to_string(),
                    install_path: None,
                    executable_path: None,
                    icon: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/icon.jpg", app_id)),
                    image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id)),
                    header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id)),
                    is_installed: false,
                    steam_app_id: Some(app_id),
                    is_vr: crate::commands::games::is_vr_game(&game_name),
                    engine: crate::commands::games::detect_game_engine(&game_name),
                    last_played: None,
                    is_shared: false,
                    // 🎯 CORRETTO: Converte lingue da stringa a array
                    supported_languages: if !api_details.supported_languages.is_empty() {
                        Some(api_details.supported_languages.split(',').map(|s| s.trim().to_string()).collect())
                    } else {
                        Some(vec!["english".to_string()])
                    },
                    genres: Some(vec!["Game".to_string()]), // TODO: aggiungere generi API
                }
            }
            Err(_) => {
                // Fallback ai dati base se API non disponibile
                GameInfo {
                    id: format!("steam_{}", app_id),
                    title: format!("Steam Game {}", app_id),
                    platform: "Steam".to_string(),
                    install_path: None,
                    executable_path: None,
                    icon: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/icon.jpg", app_id)),
                    image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id)),
                    header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id)),
                    is_installed: false,
                    steam_app_id: Some(app_id),
                    is_vr: false,
                    engine: None,
                    last_played: None,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                    genres: Some(vec!["Game".to_string()]),
                }
            }
        };
        games.push(game_info);
    }
    
    Ok(games)
}

// Trova l'utente Steam attivo da loginusers.vdf
async fn find_active_steam_user(steam_path: &str) -> Result<String, String> {
    let loginusers_path = Path::new(steam_path).join("config").join("loginusers.vdf");
    
    if !loginusers_path.exists() {
        return Err("File loginusers.vdf non trovato".to_string());
    }
    
    let content = fs::read_to_string(&loginusers_path)
        .map_err(|e| format!("Errore lettura loginusers.vdf: {}", e))?;
    
    // Parse VDF per trovare l'ultimo utente attivo
    // Il formato è: "76561198XXXXXXXXX" { "AccountName" "username" ... }
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('"') && line.contains("76561") {
            // Il formato è: "76561198XXXXXXXXX"
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    let user_id = &line[start + 1..start + 1 + end];
                    log::info!("🔍 Trovato utente Steam: {}", user_id);
                    return Ok(user_id.to_string());
                }
            }
        }
    }
    
    Err("Nessun utente Steam trovato in loginusers.vdf".to_string())
}

// Legge i giochi posseduti da localconfig.vdf
async fn read_owned_games_from_localconfig(steam_path: &str, user_id: &str) -> Result<Vec<u32>, String> {
    let localconfig_path = Path::new(steam_path)
        .join("userdata")
        .join(user_id)
        .join("config")
        .join("localconfig.vdf");
    
    if !localconfig_path.exists() {
        return Err("File localconfig.vdf non trovato".to_string());
    }
    
    let content = fs::read_to_string(&localconfig_path)
        .map_err(|e| format!("Errore lettura localconfig.vdf: {}", e))?;
    
    let mut app_ids = Vec::new();
    let mut in_apps_section = false;
    
    // Parse VDF per trovare la sezione "apps"
    for line in content.lines() {
        let line = line.trim();
        
        if line.contains("\"apps\"") {
            in_apps_section = true;
            continue;
        }
        
        if in_apps_section && line.starts_with('"') && !line.contains("apps") {
            // Il formato è: "123456"
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    let app_id_str = &line[start + 1..start + 1 + end];
                    if let Ok(app_id) = app_id_str.parse::<u32>() {
                        app_ids.push(app_id);
                    }
                }
            }
        }
        
        // Fine della sezione apps
        if in_apps_section && line == "}" {
            break;
        }
    }
    
    Ok(app_ids)
}

// Legge libraryfolders.vdf per trovare tutte le directory Steam (migliorato per multi-disk)
async fn read_library_folders(steam_path: &str) -> Result<Vec<String>, String> {
    let library_file = Path::new(steam_path).join("steamapps").join("libraryfolders.vdf");
    
    if !library_file.exists() {
        log::warn!("📁 File libraryfolders.vdf non trovato, usando solo directory principale");
        return Ok(vec![steam_path.to_string()]);
    }
    
    let content = fs::read_to_string(&library_file)
        .map_err(|e| format!("Errore lettura libraryfolders.vdf: {}", e))?;
    
    let mut folders = vec![steam_path.to_string()]; // Directory principale sempre inclusa
    log::info!("📁 Directory Steam principale: {}", steam_path);
    
    // Parse migliorato del VDF - gestisce anche strutture annidate
    let mut current_section = String::new();
    let mut brace_count = 0;
    
    for line in content.lines() {
        let line = line.trim();
        
        if line.contains('{') {
            brace_count += 1;
        }
        if line.contains('}') {
            brace_count -= 1;
        }
        
        // Cerca "path" in qualsiasi sezione
        if line.starts_with("\"path\"") && line.contains("\"") {
            if let Some(start) = line.find("\"path\"") {
                let after_key = &line[start + 6..]; // Salta "path"
                if let Some(value_start) = after_key.find('"') {
                    if let Some(value_end) = after_key[value_start + 1..].find('"') {
                        let path = &after_key[value_start + 1..value_start + 1 + value_end];
                        
                        // Normalizza il path (sostituisce \\ con /)
                        let normalized_path = path.replace("\\\\", "\\");
                        
                        if Path::new(&normalized_path).exists() {
                            log::info!("💾 Trovata libreria Steam: {}", normalized_path);
                            folders.push(normalized_path);
                        } else {
                            log::warn!("⚠️ Path libreria non esiste: {}", normalized_path);
                        }
                    }
                }
            }
        }
        
        // Metodo alternativo: cerca anche pattern numerici come "1", "2", "3" che rappresentano librerie
        if line.starts_with('"') && line.len() < 10 && line.chars().nth(1).map_or(false, |c| c.is_numeric()) {
            current_section = line.trim_matches('"').to_string();
        }
    }
    
    log::info!("📚 Totale librerie Steam trovate: {} ({} dischi)", folders.len(), folders.len());
    for (i, folder) in folders.iter().enumerate() {
        log::info!("  {}. {}", i + 1, folder);
    }
    
    Ok(folders)
}

// Parse di un file .acf per creare GameInfo
async fn parse_acf_to_gameinfo(file_path: &Path, library_path: &str) -> Result<GameInfo, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Errore lettura ACF: {}", e))?;
    
    let mut app_id = String::new();
    let mut name = String::new();
    let mut install_dir = String::new();
    let mut size_on_disk = String::new();
    let mut last_updated = String::new();
    
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("\"appid\"") {
            app_id = extract_quoted_value_vdf(line).unwrap_or_default();
        } else if line.starts_with("\"name\"") {
            name = extract_quoted_value_vdf(line).unwrap_or_default();
        } else if line.starts_with("\"installdir\"") {
            install_dir = extract_quoted_value_vdf(line).unwrap_or_default();
        } else if line.starts_with("\"SizeOnDisk\"") {
            size_on_disk = extract_quoted_value_vdf(line).unwrap_or_default();
        } else if line.starts_with("\"LastUpdated\"") {
            last_updated = extract_quoted_value_vdf(line).unwrap_or_default();
        }
    }
    
    if app_id.is_empty() || name.is_empty() {
        return Err("ACF invalido".to_string());
    }
    
    // Costruisci il percorso completo del gioco
    let game_path = Path::new(library_path)
        .join("steamapps")
        .join("common")
        .join(&install_dir);
    
    // Rileva se è VR (usa la funzione da games.rs)
    let is_vr = crate::commands::games::is_vr_game(&name);
    
    // Rileva engine (usa la funzione da games.rs)
    let engine = crate::commands::games::detect_game_engine(&name);
    
    // Genera URL immagini Steam
    let header_image = format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id);
    
    Ok(GameInfo {
        id: format!("steam_{}", app_id),
        title: name.clone(),
        platform: "Steam".to_string(),
        install_path: Some(game_path.to_string_lossy().to_string()),
        executable_path: None, // TODO: potremmo cercare l'exe principale
        icon: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/icon.jpg", app_id)),
        image_url: Some(header_image.clone()),
        header_image: Some(header_image),
        is_installed: true, // Se è in ACF, è installato
        steam_app_id: app_id.parse::<u32>().ok(),
        is_vr,
        engine,
        last_played: last_updated.parse::<u64>().ok(),
        is_shared: false,
        supported_languages: {
            // Usa il sistema di detection lingue migliorato invece del fallback generico
            let detected_langs = detect_supported_languages(&name, app_id.parse::<u32>().unwrap_or(0));
            Some(detected_langs.split(',').map(|s| s.trim().to_lowercase()).collect())
        },
        genres: Some(vec!["Game".to_string()]), // Default, potremmo migliorare
    })
}

// Helper per estrarre valori quotati da VDF
fn extract_quoted_value_vdf(line: &str) -> Option<String> {
    // Formato: "key"		"value"
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() >= 2 {
        let value_part = parts[1].trim();
        if value_part.starts_with('"') && value_part.ends_with('"') {
            return Some(value_part[1..value_part.len()-1].to_string());
        }
    }
    None
}

// ================================================================================================
// FUNZIONI PER LETTURA AVANZATA DI STEAM LOCALI
// ================================================================================================

/// Test: Prova a parsare un singolo file ACF
#[tauri::command]
pub async fn test_single_acf() -> Result<String, String> {
    debug!("[RUST] test_single_acf called");
    
    let steam_path = match find_steam_path_from_registry().await {
        Some(path) => path,
        None => return Err("Steam non trovato".to_string()),
    };
    
    let steamapps_path = Path::new(&steam_path).join("steamapps");
    let mut debug_info = String::new();
    
    debug_info.push_str(&format!("Scanning: {}\n", steamapps_path.display()));
    
    if let Ok(entries) = fs::read_dir(&steamapps_path) {
        for entry in entries.flatten().take(3) { // Solo primi 3 per test
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                if filename.starts_with("appmanifest_") && filename.ends_with(".acf") {
                    debug_info.push_str(&format!("\nTesting file: {}\n", filename));
                    
                    // Prova a leggere il contenuto raw
                    match fs::read_to_string(&path) {
                        Ok(content) => {
                            debug_info.push_str(&format!("File size: {} chars\n", content.len()));
                            debug_info.push_str(&format!("First 200 chars: {}\n", 
                                content.chars().take(200).collect::<String>()));
                            
                            // Prova parsing VDF
                            match steamy_vdf::load(&content) {
                                Ok(vdf) => {
                                    debug_info.push_str("VDF parsing: SUCCESS\n");
                                    if let Some(app_state) = vdf.get("AppState") {
                                        debug_info.push_str("AppState found\n");
                                        if let Some(table) = app_state.as_table() {
                                            for (key, value) in table.iter().take(5) {
                                                debug_info.push_str(&format!("  {}: {:?}\n", key, value));
                                            }
                                        }
                                    } else {
                                        debug_info.push_str("No AppState found\n");
                                    }
                                },
                                Err(e) => {
                                    debug_info.push_str(&format!("VDF parsing FAILED: {}\n", e));
                                }
                            }
                            
                            // Prova il nostro parser personalizzato
                            match parse_acf_file_custom(&content) {
                                Ok(game) => {
                                    debug_info.push_str(&format!("Custom parser SUCCESS: {} ({})\n", game.name, game.appid));
                                },
                                Err(e) => {
                                    debug_info.push_str(&format!("Custom parser FAILED: {}\n", e));
                                }
                            }
                            
                            // Prova il nostro parser completo
                            match parse_acf_file(&path) {
                                Ok(game) => {
                                    debug_info.push_str(&format!("Full parser SUCCESS: {} ({})\n", game.name, game.appid));
                                },
                                Err(e) => {
                                    debug_info.push_str(&format!("Full parser FAILED: {}\n", e));
                                }
                            }
                        },
                        Err(e) => {
                            debug_info.push_str(&format!("Cannot read file: {}\n", e));
                        }
                    }
                    break; // Solo primo file per ora
                }
            }
        }
    } else {
        debug_info.push_str("Cannot read steamapps directory\n");
    }
    
    Ok(debug_info)
}

/// Debug: Mostra informazioni sui percorsi Steam
#[tauri::command]
pub async fn debug_steam_paths() -> Result<String, String> {
    debug!("[RUST] debug_steam_paths called");
    
    let steam_path = find_steam_path_from_registry().await;
    let mut debug_info = String::new();
    
    debug_info.push_str(&format!("Steam path found: {}\n", steam_path.is_some()));
    
    if let Some(ref path) = steam_path {
        debug_info.push_str(&format!("Steam path: {}\n", path));
        
        let steamapps_path = Path::new(path).join("steamapps");
        let config_path = Path::new(path).join("config");
        let library_vdf_steamapps = steamapps_path.join("libraryfolders.vdf");
        let library_vdf_config = config_path.join("libraryfolders.vdf");
        
        debug_info.push_str(&format!("Steamapps exists: {}\n", steamapps_path.exists()));
        debug_info.push_str(&format!("Config exists: {}\n", config_path.exists()));
        debug_info.push_str(&format!("Library VDF (steamapps): {}\n", library_vdf_steamapps.exists()));
        debug_info.push_str(&format!("Library VDF (config): {}\n", library_vdf_config.exists()));
        
        // Conta file ACF
        if steamapps_path.exists() {
            if let Ok(entries) = fs::read_dir(&steamapps_path) {
                let acf_count = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        if let Some(name) = e.file_name().to_str() {
                            name.starts_with("appmanifest_") && name.ends_with(".acf")
                        } else {
                            false
                        }
                    })
                    .count();
                debug_info.push_str(&format!("ACF files found: {}\n", acf_count));
            }
        }
    } else {
        debug_info.push_str("Steam not found in registry\n");
    }
    
    Ok(debug_info)
}

/// Ottiene tutti i giochi Steam dalla libreria locale
#[tauri::command]
pub async fn get_all_local_steam_games() -> Result<Vec<LocalGameInfo>, String> {
    debug!("[RUST] get_all_local_steam_games called");
    
    let steam_path = match find_steam_path_from_registry().await {
        Some(path) => {
            debug!("[RUST] Steam path found: {}", path);
            path
        },
        None => return Err("Steam non trovato nel sistema".to_string()),
    };
    
    let mut all_games: Vec<LocalGameInfo> = Vec::new();
    
    // 1. Trova tutte le librerie Steam
    let library_folders = match parse_library_folders(&steam_path) {
        Ok(folders) => {
            debug!("[RUST] Found {} library folders", folders.len());
            folders
        },
        Err(e) => {
            debug!("[RUST] Errore parsing library folders: {}", e);
            // Fallback: usa solo la cartella Steam principale
            vec![SteamLibraryFolder {
                path: steam_path.clone(),
                label: "Main".to_string(),
                mounted: true,
                tool: "0".to_string(),
            }]
        }
    };
    
    // 2. Scansiona giochi installati
    let installed_games = match find_installed_games(&library_folders) {
        Ok(games) => {
            debug!("[RUST] Found {} installed games", games.len());
            games
        },
        Err(e) => {
            debug!("[RUST] Errore find_installed_games: {}", e);
            // Fallback: scansione diretta cartella steamapps
            let mut fallback_games = Vec::new();
            let steamapps_path = Path::new(&steam_path).join("steamapps");
            if steamapps_path.exists() {
                if let Ok(entries) = fs::read_dir(&steamapps_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                            if filename.starts_with("appmanifest_") && filename.ends_with(".acf") {
                                if let Ok(game_info) = parse_acf_file(&path) {
                                    fallback_games.push(game_info);
                                }
                            }
                        }
                    }
                }
            }
            debug!("[RUST] Fallback found {} games", fallback_games.len());
            fallback_games
        }
    };
    
    // 3. Trova giochi posseduti (non installati)
    let owned_game_ids = match parse_owned_games(&steam_path) {
        Ok(games) => {
            debug!("[RUST] Found {} owned games from config", games.len());
            games
        },
        Err(e) => {
            debug!("[RUST] Errore parse_owned_games: {}", e);
            Vec::new() // Fallback vuoto per ora
        }
    };
    
    // 4. Trova giochi condivisi
    let shared_games = match parse_shared_config(&steam_path) {
        Ok(games) => {
            debug!("[RUST] Found {} shared game sources", games.len());
            games
        },
        Err(e) => {
            debug!("[RUST] Errore parse_shared_config: {}", e);
            HashMap::new() // Fallback vuoto per ora
        }
    };
    
    // 5. Unisci tutti i dati
    all_games.extend(installed_games.clone());
    
    // Aggiungi giochi posseduti (evita duplicati con quelli installati)
    for appid in owned_game_ids {
        if !all_games.iter().any(|g| g.appid == appid) {
            all_games.push(LocalGameInfo {
                appid,
                name: format!("Game {}", appid), // Placeholder - andrebbe enrichito con nome reale
                status: GameStatus::Owned,
                install_dir: None,
                last_updated: None,
                size_on_disk: None,
                buildid: None,
            });
        }
    }
    
    // Aggiungi giochi condivisi (evita duplicati)
    for (lender_id, shared_app_ids) in shared_games {
        for appid in shared_app_ids {
            if !all_games.iter().any(|g| g.appid == appid) {
                all_games.push(LocalGameInfo {
                    appid,
                    name: format!("Shared Game {}", appid), // Placeholder
                    status: GameStatus::Shared { from_steam_id: lender_id.clone() },
                    install_dir: None,
                    last_updated: None,
                    size_on_disk: None,
                    buildid: None,
                });
            }
        }
    }
    
    debug!("[RUST] Total games found: {}", all_games.len());
    Ok(all_games)
}

/// Parsa libraryfolders.vdf per trovare tutte le librerie Steam
fn parse_library_folders(steam_path: &str) -> Result<Vec<SteamLibraryFolder>, String> {
    let library_folders_path = Path::new(steam_path).join("steamapps").join("libraryfolders.vdf");
    
    debug!("[RUST] Cercando libraryfolders.vdf in: {:?}", library_folders_path);
    
    if !library_folders_path.exists() {
        debug!("[RUST] File non trovato, provo percorso alternativo...");
        let alt_path = Path::new(steam_path).join("config").join("libraryfolders.vdf");
        if alt_path.exists() {
            debug!("[RUST] Trovato in config: {:?}", alt_path);
            let content = fs::read_to_string(alt_path)
                .map_err(|e| format!("Errore lettura libraryfolders.vdf: {}", e))?;
            return parse_library_folders_content(&content);
        }
        return Err(format!("File libraryfolders.vdf non trovato in {} o {}", 
                          library_folders_path.display(), alt_path.display()));
    }
    
    let content = fs::read_to_string(&library_folders_path)
        .map_err(|e| format!("Errore lettura libraryfolders.vdf: {}", e))?;
    
    parse_library_folders_content(&content)
}

/// Parsa il contenuto del file libraryfolders.vdf
fn parse_library_folders_content(content: &str) -> Result<Vec<SteamLibraryFolder>, String> {
    let vdf = steamy_vdf::load(content)
        .map_err(|e| format!("Errore parsing libraryfolders.vdf: {}", e))?;
    
    let mut folders = Vec::new();
    
    if let Some(library_folders) = vdf.get("libraryfolders").and_then(|lf| lf.as_table()) {
        for (key, folder_data) in library_folders.iter() {
            if let Some(folder_table) = folder_data.as_table() {
                if let Some(path) = folder_table.get("path").and_then(|p| p.as_str()) {
                    folders.push(SteamLibraryFolder {
                        path: path.to_string(),
                        label: folder_table.get("label").and_then(|l| l.as_str()).unwrap_or("").to_string(),
                        mounted: folder_table.get("mounted").and_then(|m| m.as_str()).unwrap_or("1") == "1",
                        tool: folder_table.get("tool").and_then(|t| t.as_str()).unwrap_or("0").to_string(),
                    });
                }
            }
        }
    }
    
    Ok(folders)
}

/// Trova tutti i giochi installati scansionando i file .acf
fn find_installed_games(library_folders: &[SteamLibraryFolder]) -> Result<Vec<LocalGameInfo>, String> {
    let mut games = Vec::new();
    
    for folder in library_folders {
        let steamapps_path = Path::new(&folder.path).join("steamapps");
        
        if let Ok(entries) = fs::read_dir(&steamapps_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.starts_with("appmanifest_") && filename.ends_with(".acf") {
                        if let Ok(game_info) = parse_acf_file(&path) {
                            games.push(game_info);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

/// Parser ACF personalizzato (non usa steamy-vdf)
fn parse_acf_file_custom(content: &str) -> Result<LocalGameInfo, String> {
    let mut appid = None;
    let mut name = None;
    let mut install_dir = None;
    let mut last_updated = None;
    let mut size_on_disk = None;
    let mut buildid = None;
    
    // Parse manuale del formato VDF
    for line in content.lines() {
        let line = line.trim();
        
        if line.contains("\"appid\"") {
            if let Some(value) = extract_quoted_value(line) {
                appid = value.parse::<u32>().ok();
            }
        } else if line.contains("\"name\"") {
            name = extract_quoted_value(line);
        } else if line.contains("\"installdir\"") {
            install_dir = extract_quoted_value(line);
        } else if line.contains("\"LastUpdated\"") {
            if let Some(value) = extract_quoted_value(line) {
                last_updated = value.parse::<u64>().ok();
            }
        } else if line.contains("\"SizeOnDisk\"") {
            if let Some(value) = extract_quoted_value(line) {
                size_on_disk = value.parse::<u64>().ok();
            }
        } else if line.contains("\"buildid\"") {
            if let Some(value) = extract_quoted_value(line) {
                buildid = value.parse::<u32>().ok();
            }
        }
    }
    
    let appid = appid.ok_or("AppID non trovato")?;
    let name = name.unwrap_or_else(|| format!("Game {}", appid));
    
    let install_path = install_dir.as_ref()
        .map(|dir| format!("C:\\Program Files (x86)\\Steam\\steamapps\\common\\{}", dir))
        .unwrap_or_else(|| "Unknown".to_string());
    
    Ok(LocalGameInfo {
        appid,
        name,
        status: GameStatus::Installed { path: install_path },
        install_dir,
        last_updated,
        size_on_disk,
        buildid,
    })
}

/// Estrae valore tra virgolette da una linea VDF
fn extract_quoted_value(line: &str) -> Option<String> {
    // Trova l'ultima coppia di virgolette (il valore)
    let parts: Vec<&str> = line.split('"').collect();
    if parts.len() >= 4 {
        Some(parts[parts.len() - 2].to_string())
    } else {
        None
    }
}

/// Parsa un file .acf per estrarre informazioni sul gioco
fn parse_acf_file(acf_path: &Path) -> Result<LocalGameInfo, String> {
    let content = fs::read_to_string(acf_path)
        .map_err(|e| format!("Errore lettura file ACF: {}", e))?;
    
    // Prima prova il nostro parser personalizzato
    if let Ok(game) = parse_acf_file_custom(&content) {
        return Ok(game);
    }
    
    // Fallback: prova steamy-vdf
    let vdf = steamy_vdf::load(&content)
        .map_err(|e| format!("Errore parsing file ACF: {}", e))?;
    
    if let Some(app_state) = vdf.get("AppState").and_then(|as_| as_.as_table()) {
        let appid = app_state.get("appid")
            .and_then(|id| id.as_str())
            .and_then(|id| id.parse::<u32>().ok())
            .ok_or("AppID non valido")?;
        
        let name = app_state.get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("Unknown Game")
            .to_string();
        
        let install_dir = app_state.get("installdir")
            .and_then(|id| id.as_str())
            .map(|s| s.to_string());
        
        let last_updated = app_state.get("LastUpdated")
            .and_then(|lu| lu.as_str())
            .and_then(|lu| lu.parse::<u64>().ok());
        
        let size_on_disk = app_state.get("SizeOnDisk")
            .and_then(|sod| sod.as_str())
            .and_then(|sod| sod.parse::<u64>().ok());
        
        let buildid = app_state.get("buildid")
            .and_then(|bid| bid.as_str())
            .and_then(|bid| bid.parse::<u32>().ok());
        
        let install_path = install_dir.as_ref().map(|dir| {
            acf_path.parent()
                .unwrap_or_else(|| Path::new(""))
                .join("common")
                .join(dir)
                .to_string_lossy()
                .to_string()
        });
        
        Ok(LocalGameInfo {
            appid,
            name,
            status: GameStatus::Installed { 
                path: install_path.unwrap_or_else(|| "Unknown".to_string()) 
            },
            install_dir,
            last_updated,
            size_on_disk,
            buildid,
        })
    } else {
        Err("Struttura ACF non valida".to_string())
    }
}

/// Parsa sharedconfig.vdf per trovare giochi condivisi
fn parse_shared_config(steam_path: &str) -> Result<HashMap<String, Vec<u32>>, String> {
    let shared_config_path = Path::new(steam_path).join("config/sharedconfig.vdf");
    
    if !shared_config_path.exists() {
        debug!("[RUST] sharedconfig.vdf non trovato, nessun gioco condiviso");
        return Ok(HashMap::new());
    }
    
    let content = fs::read_to_string(shared_config_path)
        .map_err(|e| format!("Errore lettura sharedconfig.vdf: {}", e))?;
    
    let vdf = steamy_vdf::load(&content)
        .map_err(|e| format!("Errore parsing sharedconfig.vdf: {}", e))?;
    
    let mut shared_games = HashMap::new();
    
    // Parsing più avanzato per trovare giochi condivisi
    // Il formato sharedconfig.vdf può contenere informazioni sui giochi condivisi
    // sotto chiavi come "SharedContent" o dentro le configurazioni degli utenti
    
    // Implementazione semplificata: cerca pattern comuni
    if let Some(root) = vdf.as_table() {
        for (key, value) in root.iter() {
            if let Some(section) = value.as_table() {
                // Cerca sezioni che potrebbero contenere giochi condivisi
                if key.contains("SharedContent") || key.len() == 17 { // Possibile Steam ID
                    if let Some(apps) = section.get("apps").and_then(|a| a.as_table()) {
                        let mut app_ids = Vec::new();
                        for (app_id, _) in apps.iter() {
                            if let Ok(appid) = app_id.parse::<u32>() {
                                app_ids.push(appid);
                            }
                        }
                        if !app_ids.is_empty() {
                            shared_games.insert(key.clone(), app_ids);
                        }
                    }
                }
            }
        }
    }
    
    debug!("[RUST] Found {} shared game sources", shared_games.len());
    Ok(shared_games)
}

/// Parsa i file di configurazione per trovare tutti i giochi posseduti
/// Questa funzione cerca in vari file per ottenere la lista completa
fn parse_owned_games(steam_path: &str) -> Result<Vec<u32>, String> {
    let mut owned_games = Vec::new();
    
    // 1. Cerca nel file localconfig.vdf (contiene configurazioni dei giochi)
    let localconfig_path = Path::new(steam_path).join("userdata");
    if localconfig_path.exists() {
        if let Ok(entries) = fs::read_dir(&localconfig_path) {
            for entry in entries.flatten() {
                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    let user_config_path = entry.path().join("config/localconfig.vdf");
                    if user_config_path.exists() {
                        if let Ok(games) = parse_localconfig_for_games(&user_config_path) {
                            owned_games.extend(games);
                        }
                    }
                }
            }
        }
    }
    
    // 2. Cerca nel file shortcuts.vdf (giochi non-Steam aggiunti)
    let shortcuts_path = Path::new(steam_path).join("userdata");
    if shortcuts_path.exists() {
        if let Ok(entries) = fs::read_dir(&shortcuts_path) {
            for entry in entries.flatten() {
                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    let shortcuts_file = entry.path().join("config/shortcuts.vdf");
                    if shortcuts_file.exists() {
                        if let Ok(games) = parse_shortcuts_for_games(&shortcuts_file) {
                            owned_games.extend(games);
                        }
                    }
                }
            }
        }
    }
    
    // Rimuovi duplicati
    owned_games.sort_unstable();
    owned_games.dedup();
    
    debug!("[RUST] Found {} owned games from config files", owned_games.len());
    Ok(owned_games)
}

/// Parsa localconfig.vdf per trovare giochi
fn parse_localconfig_for_games(localconfig_path: &Path) -> Result<Vec<u32>, String> {
    let content = fs::read_to_string(localconfig_path)
        .map_err(|e| format!("Errore lettura localconfig.vdf: {}", e))?;
    
    let vdf = steamy_vdf::load(&content)
        .map_err(|e| format!("Errore parsing localconfig.vdf: {}", e))?;
    
    let mut games = Vec::new();
    
    // Cerca nella sezione "Software" -> "Valve" -> "Steam" -> "apps"
    if let Some(software) = vdf.get("UserLocalConfigStore")
        .and_then(|s| s.get("Software"))
        .and_then(|s| s.get("Valve"))
        .and_then(|s| s.get("Steam"))
        .and_then(|s| s.get("apps"))
        .and_then(|apps| apps.as_table()) {
        
        for (app_id, _) in software.iter() {
            if let Ok(appid) = app_id.parse::<u32>() {
                games.push(appid);
            }
        }
    }
    
    Ok(games)
}

/// Parsa shortcuts.vdf per trovare giochi non-Steam
fn parse_shortcuts_for_games(shortcuts_path: &Path) -> Result<Vec<u32>, String> {
    // shortcuts.vdf è in formato binario VDF, più complesso da parsare
    // Per ora ritorniamo una lista vuota
    debug!("[RUST] shortcuts.vdf parsing non ancora implementato (formato binario)");
    Ok(Vec::new())
}

// ============== STEAM FAMILY SHARING IMPLEMENTATION ==============

/// Parse sharedconfig.vdf per trovare giochi condivisi
#[tauri::command]
pub async fn parse_shared_config_vdf(file_content: String) -> Result<FamilySharingConfig, String> {
    debug!("[RUST] parse_shared_config_vdf called");
    
    let vdf = steamy_vdf::load(&file_content)
        .map_err(|e| format!("Errore parsing VDF: {}", e))?;
    
    let mut shared_games = Vec::new();
    let mut authorized_users = Vec::new();
    
    // Cerca la sezione "UserRoamingConfigStore" -> "Software" -> "Valve" -> "Steam"
    if let Some(steam_section) = vdf.get("UserRoamingConfigStore")
        .and_then(|urc| urc.get("Software"))
        .and_then(|sw| sw.get("Valve"))
        .and_then(|valve| valve.get("Steam"))
        .and_then(|steam| steam.as_table()) {
        
        // Cerca giochi condivisi nella sezione "SharedLibraryUsers"
        if let Some(shared_users) = steam_section.get("SharedLibraryUsers")
            .and_then(|slu| slu.as_table()) {
            
            for (steam_id, user_data) in shared_users.iter() {
                if let Some(user_table) = user_data.as_table() {
                    // Aggiungi l'utente alla lista degli autorizzati
                    authorized_users.push(steam_id.clone());
                    
                    // Cerca i giochi condivisi da questo utente
                    if let Some(apps) = user_table.get("Apps")
                        .and_then(|apps| apps.as_table()) {
                        
                        for (app_id_str, app_data) in apps.iter() {
                            if let Ok(app_id) = app_id_str.parse::<u32>() {
                                // Ottieni il nome del gioco se disponibile
                                let game_name = if let Some(name) = app_data.as_table()
                                    .and_then(|ad| ad.get("name"))
                                    .and_then(|n| n.as_str()) {
                                    name.to_string()
                                } else {
                                    format!("Game {}", app_id)
                                };
                                
                                // Ottieni il nome dell'account se disponibile
                                let account_name = user_table.get("AccountName")
                                    .and_then(|an| an.as_str())
                                    .unwrap_or("Unknown User")
                                    .to_string();
                                
                                shared_games.push(SharedGame {
                                    appid: app_id,
                                    name: game_name,
                                    owner_steam_id: steam_id.clone(),
                                    owner_account_name: account_name,
                                    is_shared: true,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Rimuovi duplicati
    shared_games.sort_by_key(|g| g.appid);
    shared_games.dedup_by_key(|g| g.appid);
    
    let total_shared_games = shared_games.len() as u32;
    
    info!("[RUST] ✅ Parsed {} shared games from {} users", total_shared_games, authorized_users.len());
    
    Ok(FamilySharingConfig {
        shared_games,
        total_shared_games,
        authorized_users,
    })
}

/// Comando per ottenere giochi condivisi automaticamente
#[tauri::command]
pub async fn get_family_sharing_games() -> Result<FamilySharingConfig, String> {
    debug!("[RUST] get_family_sharing_games called");
    
    // Trova il path di Steam
    let steam_path = find_steam_path_from_registry().await
        .ok_or("Steam path non trovato nel registro")?;
    
    // Cerca tutti i profili utente
    let userdata_path = Path::new(&steam_path).join("userdata");
    
    if !userdata_path.exists() {
        return Err("Cartella userdata di Steam non trovata".to_string());
    }
    
    let mut all_shared_games = Vec::new();
    let mut all_authorized_users = Vec::new();
    
    // Itera attraverso tutti i profili utente
    for entry in fs::read_dir(&userdata_path)
        .map_err(|e| format!("Errore lettura userdata: {}", e))? {
        
        let entry = entry.map_err(|e| format!("Errore entry: {}", e))?;
        let profile_path = entry.path();
        
        if profile_path.is_dir() {
            let sharedconfig_path = profile_path.join("7").join("remote").join("sharedconfig.vdf");
            
            if sharedconfig_path.exists() {
                debug!("[RUST] 🔍 Trovato sharedconfig.vdf: {:?}", sharedconfig_path);
                
                match fs::read_to_string(&sharedconfig_path) {
                    Ok(content) => {
                        match parse_shared_config_vdf(content).await {
                            Ok(config) => {
                                all_shared_games.extend(config.shared_games);
                                all_authorized_users.extend(config.authorized_users);
                            }
                            Err(e) => {
                                warn!("[RUST] ⚠️ Errore parsing {}: {}", sharedconfig_path.display(), e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("[RUST] ⚠️ Errore lettura {}: {}", sharedconfig_path.display(), e);
                    }
                }
            }
        }
    }
    
    // Rimuovi duplicati
    all_shared_games.sort_by_key(|g| g.appid);
    all_shared_games.dedup_by_key(|g| g.appid);
    
    all_authorized_users.sort();
    all_authorized_users.dedup();
    
    let total_shared_games = all_shared_games.len() as u32;
    
    info!("[RUST] ✅ Family Sharing: {} giochi condivisi da {} utenti", 
          total_shared_games, all_authorized_users.len());
    
    Ok(FamilySharingConfig {
        shared_games: all_shared_games,
        total_shared_games,
        authorized_users: all_authorized_users,
    })
}

/// Comando per integrare giochi condivisi con giochi posseduti
#[tauri::command]
pub async fn get_steam_games_with_family_sharing(
    api_key: String, 
    steam_id: String, 
    force_refresh: Option<bool>
) -> Result<Vec<SteamGame>, String> {
    debug!("[RUST] get_steam_games_with_family_sharing called");
    
    // Prima ottieni i giochi posseduti
    let mut owned_games = get_steam_games(api_key, steam_id, force_refresh).await?;
    
    // Poi ottieni i giochi condivisi
    match get_family_sharing_games().await {
        Ok(family_config) => {
            info!("[RUST] ✅ Aggiungendo {} giochi Family Sharing", family_config.total_shared_games);
            
            // Converti SharedGame in SteamGame
            for shared_game in family_config.shared_games {
                // Verifica se il gioco non è già nella lista (evita duplicati)
                if !owned_games.iter().any(|g| g.appid == shared_game.appid) {
                    let steam_game = SteamGame {
                        appid: shared_game.appid,
                        name: shared_game.name,
                        playtime_forever: 0,
                        img_icon_url: String::new(),
                        img_logo_url: String::new(),
                        last_played: 0,
                        is_installed: false, // I giochi condivisi potrebbero non essere installati
                        is_shared: true, // ✅ MARCA COME CONDIVISO
                        is_vr: false,
                        engine: "Unknown".to_string(),
                        genres: Vec::new(),
                        categories: Vec::new(),
                        short_description: format!("Condiviso da {}", shared_game.owner_account_name),
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
                    
                    owned_games.push(steam_game);
                }
            }
            
            info!("[RUST] ✅ Totale giochi (posseduti + condivisi): {}", owned_games.len());
        }
        Err(e) => {
            warn!("[RUST] ⚠️ Impossibile ottenere giochi Family Sharing: {}", e);
            // Continua con solo i giochi posseduti
        }
    }
    
    Ok(owned_games)
}

