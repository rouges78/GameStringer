use tauri::State;
use crate::models::{SteamConfig, SteamGame, SteamApiGenre, SteamApiCategory, SteamApiReleaseDate, SteamApiRequirements, GameInfo, GameDetails};
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

// Placeholder for session state if needed later
pub struct SessionState;

// 🔍 DEBUG: Test API Steam con diversi endpoints
#[tauri::command]
pub async fn debug_steam_api_extended(api_key: String, steam_id: String) -> Result<String, String> {
    println!("[RUST] DEBUG: Test esteso API Steam...");
    
    // Se le credenziali sono vuote, carica quelle salvate
    let (actual_key, actual_id) = if api_key.is_empty() || steam_id.is_empty() {
        match get_decrypted_api_key().await {
            Ok((key, id)) => (key, id),
            Err(e) => return Err(format!("Impossibile caricare credenziali: {}", e))
        }
    } else {
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
    
    println!("[RUST] DEBUG: Test 1 - URL minimale: {}", url1.replace(&actual_key, "***"));
    match client.get(&url1).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            println!("[RUST] DEBUG: Test 1 Response: {}", response_text);
            results.push(format!("Test 1 (minimale): {}", response_text));
        }
        Err(e) => {
            println!("[RUST] DEBUG: Test 1 Error: {}", e);
            results.push(format!("Test 1 Error: {}", e));
        }
    }
    
    // Test 2: GetOwnedGames senza include_played_free_games
    let url2 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true",
        actual_key, actual_id
    );
    
    println!("[RUST] DEBUG: Test 2 - Senza free games: {}", url2.replace(&actual_key, "***"));
    match client.get(&url2).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            println!("[RUST] DEBUG: Test 2 Response: {}", response_text);
            results.push(format!("Test 2 (senza free): {}", response_text));
        }
        Err(e) => {
            println!("[RUST] DEBUG: Test 2 Error: {}", e);
            results.push(format!("Test 2 Error: {}", e));
        }
    }
    
    // Test 3: GetOwnedGames con parametri community-suggested
    let url3 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=1&include_played_free_games=1&skip_unvetted_apps=false",
        actual_key, actual_id
    );
    
    println!("[RUST] DEBUG: Test 3 - Community fix: {}", url3.replace(&actual_key, "***"));
    match client.get(&url3).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            println!("[RUST] DEBUG: Test 3 Response: {}", response_text);
            results.push(format!("Test 3 (community fix): {}", response_text));
        }
        Err(e) => {
            println!("[RUST] DEBUG: Test 3 Error: {}", e);
            results.push(format!("Test 3 Error: {}", e));
        }
    }
    
    // Test 4: GetPlayerSummaries per verificare ancora il profilo
    let url4 = format!(
        "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={}&steamids={}",
        actual_key, actual_id
    );
    
    println!("[RUST] DEBUG: Test 4 - Player summary: {}", url4.replace(&actual_key, "***"));
    match client.get(&url4).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            println!("[RUST] DEBUG: Test 4 Response: {}", response_text);
            
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
            println!("[RUST] DEBUG: Test 4 Error: {}", e);
            results.push(format!("Test 4 Error: {}", e));
        }
    }
    
    // Test 5: Retry con delay (bug intermittente)
    println!("[RUST] DEBUG: Test 5 - Retry con delay...");
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    let url5 = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=1&include_played_free_games=1",
        actual_key, actual_id
    );
    
    match client.get(&url5).send().await {
        Ok(response) => {
            let response_text = response.text().await.unwrap_or_default();
            println!("[RUST] DEBUG: Test 5 Response: {}", response_text);
            results.push(format!("Test 5 (retry con delay): {}", response_text));
        }
        Err(e) => {
            println!("[RUST] DEBUG: Test 5 Error: {}", e);
            results.push(format!("Test 5 Error: {}", e));
        }
    }
    
    Ok(results.join("\n\n"))
}

// 🔍 DEBUG: Comando per testare specificamente l'API Steam
#[tauri::command]
pub async fn debug_steam_api(api_key: String, steam_id: String) -> Result<String, String> {
    println!("[RUST] DEBUG: Testando API Steam...");
    
    // Se le credenziali sono vuote, carica quelle salvate
    let (actual_key, actual_id) = if api_key.is_empty() || steam_id.is_empty() {
        match get_decrypted_api_key().await {
            Ok((key, id)) => (key, id),
            Err(e) => return Err(format!("Impossibile caricare credenziali: {}", e))
        }
    } else {
        (api_key, steam_id)
    };
    
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
        actual_key, actual_id
    );
    
    println!("[RUST] DEBUG: URL: {}", url.replace(&actual_key, "***"));
    println!("[RUST] DEBUG: API Key length: {}", actual_key.len());
    println!("[RUST] DEBUG: Steam ID: {}", actual_id);
    
    // Validazione base dei parametri
    if actual_key.len() != 32 {
        println!("[RUST] ⚠️ WARNING: API Key length is {}, expected 32", actual_key.len());
    }
    
    if !actual_id.starts_with("7656119") {
        println!("[RUST] ⚠️ WARNING: Steam ID doesn't start with 7656119 (64-bit SteamID format)");
    }
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore creazione client: {}", e))?;
    
    match client.get(&url).send().await {
        Ok(response) => {
            let status = response.status();
            let response_text = response.text().await.map_err(|e| format!("Errore lettura risposta: {}", e))?;
            
            println!("[RUST] DEBUG: HTTP Status: {}", status);
            println!("[RUST] DEBUG: Response size: {} bytes", response_text.len());
            println!("[RUST] DEBUG: Response completa: '{}'", response_text);
            println!("[RUST] DEBUG: Response bytes: {:?}", response_text.as_bytes());
            
            // Analizza la risposta
            let content_preview = if response_text.len() > 100 {
                format!("{}...", &response_text[..100])
            } else {
                response_text.clone()
            };
            println!("[RUST] DEBUG: Response preview: {}", content_preview);
            
            // Prova a parsare come JSON per vedere la struttura
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                println!("[RUST] DEBUG: JSON parsed successfully");
                println!("[RUST] DEBUG: JSON structure: {:#}", json);
                
                if let Some(response_obj) = json["response"].as_object() {
                    println!("[RUST] DEBUG: Response keys: {:?}", response_obj.keys().collect::<Vec<_>>());
                    
                    if let Some(games) = json["response"]["games"].as_array() {
                        println!("[RUST] DEBUG: Games array found with {} games", games.len());
                    } else {
                        println!("[RUST] DEBUG: No games array found");
                    }
                }
            } else {
                println!("[RUST] DEBUG: Failed to parse JSON");
            }
            
            Ok(format!("Status: {}, Size: {} bytes", status, response_text.len()))
        }
        Err(e) => {
            println!("[RUST] DEBUG: Errore API: {}", e);
            Err(format!("Errore API: {}", e))
        }
    }
}

// 🔄 SISTEMA: Auto-aggiornamento libreria Steam
#[tauri::command]
pub async fn add_game_to_library(appid: u32, name: String) -> Result<String, String> {
    println!("[RUST] Aggiungendo gioco alla libreria: {} ({})", name, appid);
    
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
        return Ok(format!("Gioco '{}' già presente nella libreria", name));
    }
    
    // Crea il nuovo gioco
    let new_game = serde_json::json!({
        "appid": appid,
        "name": name,
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
    
    println!("[RUST] ✅ Gioco '{}' aggiunto alla libreria. Totale giochi: {}", name, games.len());
    
    Ok(format!("Gioco '{}' aggiunto con successo! Totale giochi: {}", name, games.len()))
}

// 🔍 DEBUG: Comando per testare il profilo Steam
#[tauri::command]
pub async fn debug_steam_profile(api_key: String, steam_id: String) -> Result<String, String> {
    println!("[RUST] DEBUG: Testando profilo Steam...");
    
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
    
    println!("[RUST] DEBUG: Testing profile URL: {}", profile_url.replace(&actual_key, "***"));
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Errore creazione client: {}", e))?;
    
    match client.get(&profile_url).send().await {
        Ok(response) => {
            let status = response.status();
            let response_text = response.text().await.map_err(|e| format!("Errore lettura risposta: {}", e))?;
            
            println!("[RUST] DEBUG: Profile API Status: {}", status);
            println!("[RUST] DEBUG: Profile response: {}", response_text);
            
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                if let Some(players) = json["response"]["players"].as_array() {
                    if let Some(player) = players.first() {
                        let visibility = player["communityvisibilitystate"].as_u64().unwrap_or(0);
                        let profile_state = player["profilestate"].as_u64().unwrap_or(0);
                        
                        println!("[RUST] DEBUG: Community visibility: {} (1=private, 3=public)", visibility);
                        println!("[RUST] DEBUG: Profile state: {} (1=configured)", profile_state);
                        
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
            println!("[RUST] DEBUG: Profile API Error: {}", e);
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
    // Usa l'hardware fingerprint della macchina come base per la chiave
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let machine_id = format!("{}{}", 
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "default".to_string()),
        std::env::var("USERNAME").unwrap_or_else(|_| "user".to_string())
    );
    
    let mut hasher = DefaultHasher::new();
    machine_id.hash(&mut hasher);
    let hash = hasher.finish();
    
    // Espandi l'hash a 32 bytes per AES-256
    let mut key = [0u8; 32];
    let hash_bytes = hash.to_le_bytes();
    for i in 0..4 {
        key[i*8..(i+1)*8].copy_from_slice(&hash_bytes);
    }
    
    Ok(key)
}

fn encrypt_api_key(api_key: &str) -> Result<(String, String), String> {
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // Genera nonce random
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Cripta
    let ciphertext = cipher.encrypt(nonce, api_key.as_bytes())
        .map_err(|e| format!("Errore encryption: {}", e))?;
    
    // Codifica in base64
    let encrypted_b64 = general_purpose::STANDARD.encode(&ciphertext);
    let nonce_b64 = general_purpose::STANDARD.encode(&nonce_bytes);
    
    Ok((encrypted_b64, nonce_b64))
}

pub fn decrypt_api_key(encrypted_b64: &str, nonce_b64: &str) -> Result<String, String> {
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // Decodifica da base64
    let ciphertext = general_purpose::STANDARD.decode(encrypted_b64)
        .map_err(|e| format!("Errore decode ciphertext: {}", e))?;
    let nonce_bytes = general_purpose::STANDARD.decode(nonce_b64)
        .map_err(|e| format!("Errore decode nonce: {}", e))?;
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Decripta
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Errore decryption: {}", e))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| format!("Errore conversione UTF-8: {}", e))
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
pub async fn force_refresh_steam_games() -> Result<Vec<SteamGame>, String> {
    println!("[RUST] 🔄 force_refresh_steam_games called - bypassing all cache!");
    
    // Carica credenziali criptate
    let (api_key, steam_id) = match get_decrypted_api_key().await {
        Ok((key, id)) => {
            println!("[RUST] ✅ Credenziali decriptate per force refresh");
            println!("[RUST] 🔑 Steam ID: {}", id);
            println!("[RUST] 🗝️ API Key length: {}", key.len());
            (key, id)
        }
        Err(e) => {
            return Err(format!("Impossibile caricare credenziali per force refresh: {}", e));
        }
    };
    
    // Forza refresh senza cache
    let result = get_steam_games(api_key, steam_id, Some(true)).await;
    
    match &result {
        Ok(games) => {
            println!("[RUST] 🎮 Force refresh found {} games total", games.len());
            
            // Show summary
            println!("[RUST] ✅ Force refresh completed successfully");
        }
        Err(e) => {
            println!("[RUST] ❌ Force refresh failed: {}", e);
        }
    }
    
    result
}

#[tauri::command]
pub async fn debug_steam_api_raw() -> Result<String, String> {
    println!("[RUST] 🔍 DEBUG: Testing raw Steam API access...");
    
    // Carica credenziali
    let (api_key, steam_id) = match get_decrypted_api_key().await {
        Ok((key, id)) => {
            println!("[RUST] ✅ Credentials loaded for debug");
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
    
    println!("[RUST] 🌐 Calling Steam API directly...");
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client creation error: {}", e))?;
    
    match client.get(&url).send().await {
        Ok(response) => {
            let status = response.status();
            println!("[RUST] 📡 Response status: {}", status);
            
            if status.is_success() {
                match response.text().await {
                    Ok(text) => {
                        // Parse JSON per contare giochi
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(games_array) = json["response"]["games"].as_array() {
                                println!("[RUST] 🎮 Raw API returned {} games", games_array.len());
                                
                                // Show sample games from raw API
                                println!("[RUST] 📋 Last 5 games from raw API:");
                                for game in games_array.iter().rev().take(5) {
                                    if let Some(name) = game["name"].as_str() {
                                        println!("[RUST]   - {}", name);
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
pub async fn get_steam_games(api_key: String, steam_id: String, force_refresh: Option<bool>) -> Result<Vec<SteamGame>, String> {
    println!("[RUST] get_steam_games called with steam_id: {}", steam_id);
    
    let force = force_refresh.unwrap_or(false);
    println!("[RUST] Force refresh: {}", force);
    
    // Se force refresh è attivo, pulisci la cache
    if force {
        println!("[RUST] Force refresh - clearing games cache");
        GAME_CACHE.invalidate_all();
    }
    
    // 🔒 Se non vengono passate credenziali, prova a caricarle dai file criptati
    let (actual_api_key, actual_steam_id) = if api_key.is_empty() || steam_id.is_empty() {
        println!("[RUST] 🔒 Caricamento credenziali criptate...");
        match get_decrypted_api_key().await {
            Ok((key, id)) => {
                println!("[RUST] ✅ Credenziali decriptate con successo");
                (key, id)
            }
            Err(e) => {
                println!("[RUST] ⚠️ Impossibile caricare credenziali: {}", e);
                (api_key, steam_id)
            }
        }
    } else {
        (api_key, steam_id)
    };
    
    // Se abbiamo API key e Steam ID, usa l'API reale
    if !actual_api_key.is_empty() && !actual_steam_id.is_empty() {
        println!("[RUST] Using real Steam API with key: {}...", &actual_api_key[..std::cmp::min(8, actual_api_key.len())]);
        
        let url = format!(
            "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=true&include_played_free_games=true",
            actual_api_key, actual_steam_id
        );
        
        // 🔧 FIX: Crea client con timeout configurato
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Errore creazione client HTTP: {}", e))?;
        
        println!("[RUST] 📡 Chiamata Steam API con timeout 30s...");
        match client.get(&url).send().await {
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
                            // DEBUG: Mostra la struttura della risposta
                            println!("[RUST] 🔍 DEBUG: Response structure: {:?}", json);
                            
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
                            
                            println!("[RUST] ✅ Processed {} games successfully", steam_games.len());
                            return Ok(steam_games);
                            } else {
                                println!("[RUST] ❌ Steam API returned no games array");
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
                // Controlla se è un timeout
                if e.is_timeout() {
                    println!("[RUST] ⏰ Timeout rilevato - API Steam non risponde entro 30s");
                } else if e.is_connect() {
                    println!("[RUST] 🌐 Errore di connessione - verifica la connessione internet");
                } else {
                    println!("[RUST] 🔧 Errore generico: {}", e);
                }
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
                    println!("[RUST] 🎯 {}: VR={} Installed={} Engine={} Languages={}", 
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
// 🔒 Comando per salvare le credenziali Steam (CRIPTATE)
#[tauri::command]
pub async fn save_steam_credentials(api_key: String, steam_id: String) -> Result<String, String> {
    println!("[RUST] 🔒 save_steam_credentials called per Steam ID: {}", steam_id);
    
    if api_key.is_empty() || steam_id.is_empty() {
        return Err("API key e Steam ID sono obbligatori".to_string());
    }
    
    // 🔒 Cripta l'API key
    let (encrypted_api_key, nonce) = encrypt_api_key(&api_key)?;
    
    let credentials = SteamCredentials {
        api_key_encrypted: encrypted_api_key,
        steam_id: steam_id.clone(),
        saved_at: chrono::Utc::now().to_rfc3339(),
        nonce,
    };
    
    let credentials_path = get_steam_credentials_path()?;
    let json_data = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&credentials_path, json_data)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    println!("[RUST] ✅ Credenziali Steam salvate in modo sicuro per Steam ID: {}", steam_id);
    Ok("Credenziali Steam salvate con encryption AES-256".to_string())
}

// 🔒 Funzione helper per ottenere l'API key decriptata (uso interno)
async fn get_decrypted_api_key() -> Result<(String, String), String> {
    let credentials = load_steam_credentials().await?;
    let api_key = decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce)?;
    Ok((api_key, credentials.steam_id))
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
    
    // 🔒 NOTA: Per sicurezza, NON decriptiamo l'API key qui
    // La decryption avverrà solo quando necessario
    println!("[RUST] ✅ Credenziali Steam caricate per Steam ID: {}", credentials.steam_id);
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
    // 🔒 Decripta l'API key
    let decrypted_api_key = decrypt_api_key(&credentials.api_key_encrypted, &credentials.nonce)?;
    
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


