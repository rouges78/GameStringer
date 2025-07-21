use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use log::{info, warn, error, debug};
use crate::commands::steam;
use crate::commands::epic;

/// 🎮 Struttura unificata per informazioni DLC cross-store
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DLCInfo {
    pub id: String,
    pub name: String,
    pub parent_game_id: String,
    pub parent_game_name: String,
    pub store: String, // "Steam", "Epic", "GOG", etc.
    pub is_installed: bool,
    pub is_owned: bool,
    pub release_date: Option<String>,
    pub price: Option<String>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub size_bytes: Option<u64>,
    pub last_updated: Option<u64>, // timestamp
}

/// 📊 Statistiche aggregate DLC per un gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDLCStats {
    pub game_id: String,
    pub game_name: String,
    pub store: String,
    pub total_dlc_count: u32,
    pub owned_dlc_count: u32,
    pub installed_dlc_count: u32,
    pub total_dlc_size_bytes: u64,
    pub completion_percentage: f32,
    pub dlc_list: Vec<DLCInfo>,
}

/// 🌐 Risultato scansione DLC cross-store
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DLCScanResult {
    pub total_games_with_dlc: u32,
    pub total_dlc_found: u32,
    pub total_dlc_owned: u32,
    pub total_dlc_installed: u32,
    pub games_stats: Vec<GameDLCStats>,
    pub scan_duration_ms: u64,
    pub stores_scanned: Vec<String>,
}

/// 🚀 Comando principale: Scansione completa DLC cross-store
#[tauri::command]
pub async fn scan_all_dlc() -> Result<DLCScanResult, String> {
    info!("🎮 Avvio scansione completa DLC cross-store");
    let start_time = std::time::Instant::now();
    
    let mut all_games_stats = Vec::new();
    let mut stores_scanned = Vec::new();
    let mut total_dlc_found = 0;
    let mut total_dlc_owned = 0;
    let mut total_dlc_installed = 0;
    
    // 🎯 Scansione Steam DLC
    match scan_steam_dlc().await {
        Ok(steam_stats) => {
            info!("✅ Steam DLC: {} giochi con DLC trovati", steam_stats.len());
            for stats in &steam_stats {
                total_dlc_found += stats.total_dlc_count;
                total_dlc_owned += stats.owned_dlc_count;
                total_dlc_installed += stats.installed_dlc_count;
            }
            all_games_stats.extend(steam_stats);
            stores_scanned.push("Steam".to_string());
        }
        Err(e) => {
            warn!("⚠️ Errore scansione Steam DLC: {}", e);
        }
    }
    
    // 🎯 Scansione Epic Games DLC
    match scan_epic_dlc().await {
        Ok(epic_stats) => {
            info!("✅ Epic Games DLC: {} giochi con DLC trovati", epic_stats.len());
            for stats in &epic_stats {
                total_dlc_found += stats.total_dlc_count;
                total_dlc_owned += stats.owned_dlc_count;
                total_dlc_installed += stats.installed_dlc_count;
            }
            all_games_stats.extend(epic_stats);
            stores_scanned.push("Epic Games".to_string());
        }
        Err(e) => {
            warn!("⚠️ Errore scansione Epic Games DLC: {}", e);
        }
    }
    
    // 🎯 Scansione Ubisoft Connect DLC
    match scan_ubisoft_dlc().await {
        Ok(ubisoft_stats) => {
            info!("✅ Ubisoft Connect DLC: {} giochi con DLC trovati", ubisoft_stats.len());
            for stats in &ubisoft_stats {
                total_dlc_found += stats.total_dlc_count;
                total_dlc_owned += stats.owned_dlc_count;
                total_dlc_installed += stats.installed_dlc_count;
            }
            all_games_stats.extend(ubisoft_stats);
            stores_scanned.push("Ubisoft Connect".to_string());
        }
        Err(e) => {
            warn!("⚠️ Errore scansione Ubisoft Connect DLC: {}", e);
        }
    }
    
    // 🎯 Scansione GOG DLC (placeholder per implementazione futura)
    match scan_gog_dlc().await {
        Ok(gog_stats) => {
            info!("✅ GOG DLC: {} giochi con DLC trovati", gog_stats.len());
            all_games_stats.extend(gog_stats);
            stores_scanned.push("GOG".to_string());
        }
        Err(e) => {
            debug!("ℹ️ GOG DLC non ancora implementato: {}", e);
        }
    }
    
    let scan_duration = start_time.elapsed().as_millis() as u64;
    let total_games_with_dlc = all_games_stats.len() as u32;
    
    info!("🎉 Scansione DLC completata: {} giochi, {} DLC totali in {}ms", 
          total_games_with_dlc, total_dlc_found, scan_duration);
    
    Ok(DLCScanResult {
        total_games_with_dlc,
        total_dlc_found,
        total_dlc_owned,
        total_dlc_installed,
        games_stats: all_games_stats,
        scan_duration_ms: scan_duration,
        stores_scanned,
    })
}

/// 🎮 Scansione DLC Steam utilizzando API esistenti
async fn scan_steam_dlc() -> Result<Vec<GameDLCStats>, String> {
    info!("🔍 Scansione DLC Steam in corso...");
    
    // Ottieni tutti i giochi Steam
    let steam_games = match steam::force_refresh_steam_games().await {
        Ok(games) => games,
        Err(e) => {
            error!("❌ Errore recupero giochi Steam: {}", e);
            return Err(format!("Errore recupero giochi Steam: {}", e));
        }
    };
    
    let mut games_with_dlc = Vec::new();
    
    for game in steam_games {
        // Controlla se il gioco ha DLC (campo dlc: Vec<u32> già presente)
        if !game.dlc.is_empty() {
            debug!("🎯 Gioco con DLC trovato: {} ({} DLC)", game.name, game.dlc.len());
            
            let mut dlc_list = Vec::new();
            let mut owned_count = 0;
            let mut installed_count = 0;
            
            // Processa ogni DLC
            for dlc_appid in &game.dlc {
                // Ottieni dettagli DLC da Steam API
                match get_steam_dlc_details(*dlc_appid, &game).await {
                    Ok(dlc_info) => {
                        if dlc_info.is_owned {
                            owned_count += 1;
                        }
                        if dlc_info.is_installed {
                            installed_count += 1;
                        }
                        dlc_list.push(dlc_info);
                    }
                    Err(e) => {
                        warn!("⚠️ Errore dettagli DLC {}: {}", dlc_appid, e);
                        // Crea DLC info base anche se API fallisce
                        dlc_list.push(DLCInfo {
                            id: format!("steam_{}", dlc_appid),
                            name: format!("DLC {}", dlc_appid),
                            parent_game_id: game.appid.to_string(),
                            parent_game_name: game.name.clone(),
                            store: "Steam".to_string(),
                            is_installed: false,
                            is_owned: false,
                            release_date: None,
                            price: None,
                            description: None,
                            cover_url: Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/capsule_231x87.jpg", dlc_appid)),
                            size_bytes: None,
                            last_updated: None,
                        });
                    }
                }
            }
            
            let completion_percentage = if game.dlc.len() > 0 {
                (owned_count as f32 / game.dlc.len() as f32) * 100.0
            } else {
                0.0
            };
            
            let total_size = dlc_list.iter()
                .filter_map(|dlc| dlc.size_bytes)
                .sum::<u64>();
            
            games_with_dlc.push(GameDLCStats {
                game_id: game.appid.to_string(),
                game_name: game.name.clone(),
                store: "Steam".to_string(),
                total_dlc_count: game.dlc.len() as u32,
                owned_dlc_count: owned_count,
                installed_dlc_count: installed_count,
                total_dlc_size_bytes: total_size,
                completion_percentage,
                dlc_list,
            });
        }
    }
    
    info!("✅ Steam DLC: {} giochi con DLC processati", games_with_dlc.len());
    Ok(games_with_dlc)
}

/// 🎮 Ottieni dettagli specifici DLC Steam
async fn get_steam_dlc_details(dlc_appid: u32, parent_game: &crate::models::SteamGame) -> Result<DLCInfo, String> {
    // Usa Steam Store API per ottenere dettagli DLC
    match steam::get_game_details(dlc_appid.to_string()).await {
        Ok(details_json) => {
            let name = details_json["name"].as_str()
                .unwrap_or(&format!("DLC {}", dlc_appid))
                .to_string();
            
            let description = details_json["short_description"].as_str()
                .map(|s| s.to_string());
            
            let release_date = details_json["release_date"]["date"].as_str()
                .map(|s| s.to_string());
            
            let price = details_json["price_overview"]["final_formatted"].as_str()
                .map(|s| s.to_string());
            
            let cover_url = Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/capsule_231x87.jpg", dlc_appid));
            
            // TODO: Implementare controllo ownership e installazione
            // Per ora assumiamo che se il gioco base è posseduto, i DLC potrebbero essere posseduti
            let is_owned = parent_game.is_installed; // Placeholder logic
            let is_installed = parent_game.is_installed && is_owned; // Placeholder logic
            
            Ok(DLCInfo {
                id: format!("steam_{}", dlc_appid),
                name,
                parent_game_id: parent_game.appid.to_string(),
                parent_game_name: parent_game.name.clone(),
                store: "Steam".to_string(),
                is_installed,
                is_owned,
                release_date,
                price,
                description,
                cover_url,
                size_bytes: None, // Steam API non fornisce sempre size
                last_updated: Some(chrono::Utc::now().timestamp() as u64),
            })
        }
        Err(e) => {
            Err(format!("Errore API Steam per DLC {}: {}", dlc_appid, e))
        }
    }
}

/// 🎮 Scansione DLC Epic Games
async fn scan_epic_dlc() -> Result<Vec<GameDLCStats>, String> {
    info!("🔍 Scansione DLC Epic Games in corso...");
    
    // Ottieni tutti i giochi Epic Games installati
    let epic_games = match crate::commands::library::get_epic_installed_games().await {
        Ok(games) => games,
        Err(e) => {
            warn!("⚠️ Errore recupero giochi Epic installati: {}", e);
            return Ok(Vec::new());
        }
    };
    
    // Ottieni la libreria Epic completa per identificare DLC
    let epic_library = match get_epic_library_with_dlc().await {
        Ok(library) => library,
        Err(e) => {
            warn!("⚠️ Errore recupero libreria Epic: {}", e);
            return Ok(Vec::new());
        }
    };
    
    let mut games_with_dlc = Vec::new();
    let mut dlc_map: std::collections::HashMap<String, Vec<epic::EpicLibraryItem>> = std::collections::HashMap::new();
    
    // Raggruppa DLC per gioco base (usando namespace come chiave di raggruppamento)
    for item in &epic_library {
        if item.is_dlc {
            // Trova il gioco base associato a questo DLC
            let base_game_key = find_epic_base_game_for_dlc(item, &epic_library);
            dlc_map.entry(base_game_key).or_insert_with(Vec::new).push(item.clone());
        }
    }
    
    // Processa ogni gioco installato per vedere se ha DLC
    for installed_game in &epic_games {
        // Cerca DLC associati a questo gioco
        let game_key = extract_epic_game_key(&installed_game.name);
        
        if let Some(dlc_list) = dlc_map.get(&game_key) {
            if !dlc_list.is_empty() {
                debug!("🎯 Gioco Epic con DLC trovato: {} ({} DLC)", installed_game.name, dlc_list.len());
                
                let mut processed_dlc = Vec::new();
                let mut owned_count = 0;
                let mut installed_count = 0;
                
                for dlc_item in dlc_list {
                    // Controlla se il DLC è installato (cerca nei giochi installati)
                    let is_installed = epic_games.iter().any(|g| 
                        g.name.to_lowercase().contains(&dlc_item.app_title.to_lowercase()) ||
                        g.id.contains(&dlc_item.app_name)
                    );
                    
                    // Per Epic Games, assumiamo che se è nella libreria è posseduto
                    let is_owned = true;
                    
                    if is_owned {
                        owned_count += 1;
                    }
                    if is_installed {
                        installed_count += 1;
                    }
                    
                    processed_dlc.push(DLCInfo {
                        id: format!("epic_{}", dlc_item.app_name),
                        name: dlc_item.app_title.clone(),
                        parent_game_id: installed_game.id.clone(),
                        parent_game_name: installed_game.name.clone(),
                        store: "Epic Games".to_string(),
                        is_installed,
                        is_owned,
                        release_date: None, // Epic API non fornisce sempre date
                        price: None, // Epic API non fornisce prezzi nei manifest
                        description: None,
                        cover_url: Some(format!("https://cdn1.epicgames.com/offer/{}/wide/1920x1080-1920x1080.jpg", dlc_item.catalog_item_id)),
                        size_bytes: None,
                        last_updated: Some(chrono::Utc::now().timestamp() as u64),
                    });
                }
                
                let completion_percentage = if dlc_list.len() > 0 {
                    (owned_count as f32 / dlc_list.len() as f32) * 100.0
                } else {
                    0.0
                };
                
                let total_size = processed_dlc.iter()
                    .filter_map(|dlc| dlc.size_bytes)
                    .sum::<u64>();
                
                games_with_dlc.push(GameDLCStats {
                    game_id: installed_game.id.clone(),
                    game_name: installed_game.name.clone(),
                    store: "Epic Games".to_string(),
                    total_dlc_count: dlc_list.len() as u32,
                    owned_dlc_count: owned_count,
                    installed_dlc_count: installed_count,
                    total_dlc_size_bytes: total_size,
                    completion_percentage,
                    dlc_list: processed_dlc,
                });
            }
        }
    }
    
    info!("✅ Epic Games DLC: {} giochi con DLC processati", games_with_dlc.len());
    Ok(games_with_dlc)
}

/// 🔍 Ottieni libreria Epic Games completa con informazioni DLC
async fn get_epic_library_with_dlc() -> Result<Vec<epic::EpicLibraryItem>, String> {
    // Prova a ottenere la libreria Epic Games usando i metodi esistenti
    // Questo è un placeholder che dovrebbe essere implementato con accesso alla libreria Epic completa
    
    // Per ora, creiamo alcuni DLC di esempio per testare il sistema
    // In una implementazione reale, questo dovrebbe interrogare l'API Epic Games
    let mock_dlc = vec![
        epic::EpicLibraryItem {
            app_name: "fortnite_dlc_battlepass".to_string(),
            app_title: "Fortnite Battle Pass Season 1".to_string(),
            namespace: "fn".to_string(),
            catalog_item_id: "fortnite-bp-s1".to_string(),
            is_dlc: true,
        },
        epic::EpicLibraryItem {
            app_name: "rocket_league_dlc_cars".to_string(),
            app_title: "Rocket League Car Pack".to_string(),
            namespace: "sugar".to_string(),
            catalog_item_id: "rl-cars-pack".to_string(),
            is_dlc: true,
        },
        epic::EpicLibraryItem {
            app_name: "borderlands3_dlc_1".to_string(),
            app_title: "Borderlands 3: Moxxi's Heist".to_string(),
            namespace: "catnip".to_string(),
            catalog_item_id: "bl3-dlc-moxxi".to_string(),
            is_dlc: true,
        },
    ];
    
    debug!("📦 Mock Epic DLC library: {} items", mock_dlc.len());
    Ok(mock_dlc)
}

/// 🔍 Trova il gioco base associato a un DLC Epic Games
fn find_epic_base_game_for_dlc(dlc: &epic::EpicLibraryItem, _library: &[epic::EpicLibraryItem]) -> String {
    // Strategia 1: Usa il namespace per raggruppare
    if !dlc.namespace.is_empty() {
        return dlc.namespace.clone();
    }
    
    // Strategia 2: Estrai il nome base dal nome del DLC
    let dlc_name_lower = dlc.app_name.to_lowercase();
    
    // Pattern comuni per identificare il gioco base
    let base_patterns = [
        ("fortnite", "fortnite"),
        ("rocket_league", "rocket_league"),
        ("borderlands3", "borderlands3"),
        ("gta5", "gta5"),
        ("cyberpunk", "cyberpunk2077"),
        ("witcher3", "witcher3"),
    ];
    
    for (pattern, base_name) in &base_patterns {
        if dlc_name_lower.contains(pattern) {
            return base_name.to_string();
        }
    }
    
    // Strategia 3: Usa la prima parte del nome prima del primo underscore
    if let Some(first_part) = dlc.app_name.split('_').next() {
        return first_part.to_string();
    }
    
    // Fallback: usa il nome completo
    dlc.app_name.clone()
}

/// 🔍 Estrai chiave di raggruppamento da nome gioco Epic Games
fn extract_epic_game_key(game_name: &str) -> String {
    let name_lower = game_name.to_lowercase();
    
    // Mapping nomi comuni Epic Games
    let name_mappings = [
        ("fortnite", "fortnite"),
        ("rocket league", "rocket_league"),
        ("borderlands 3", "borderlands3"),
        ("grand theft auto v", "gta5"),
        ("cyberpunk 2077", "cyberpunk2077"),
        ("the witcher 3", "witcher3"),
        ("fall guys", "fall_guys"),
        ("among us", "among_us"),
    ];
    
    for (pattern, key) in &name_mappings {
        if name_lower.contains(pattern) {
            return key.to_string();
        }
    }
    
    // Fallback: normalizza il nome rimuovendo spazi e caratteri speciali
    name_lower
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .get(..20)
        .unwrap_or(&name_lower)
        .to_string()
}

/// 🎮 Scansione DLC Ubisoft Connect
async fn scan_ubisoft_dlc() -> Result<Vec<GameDLCStats>, String> {
    info!("🔍 Scansione DLC Ubisoft Connect in corso...");
    
    // Ottieni tutti i giochi Ubisoft Connect installati
    let ubisoft_games = match crate::commands::ubisoft::get_ubisoft_installed_games().await {
        Ok(games) => games,
        Err(e) => {
            warn!("⚠️ Errore recupero giochi Ubisoft installati: {}", e);
            return Ok(Vec::new());
        }
    };
    
    let mut games_with_dlc = Vec::new();
    
    // Ubisoft Connect DLC detection basato su pattern comuni
    for installed_game in &ubisoft_games {
        let dlc_list = detect_ubisoft_dlc_for_game(installed_game).await;
        
        if !dlc_list.is_empty() {
            debug!("🎯 Gioco Ubisoft con DLC trovato: {} ({} DLC)", installed_game.name, dlc_list.len());
            
            let mut owned_count = 0;
            let mut installed_count = 0;
            
            for dlc in &dlc_list {
                if dlc.is_owned {
                    owned_count += 1;
                }
                if dlc.is_installed {
                    installed_count += 1;
                }
            }
            
            let completion_percentage = if dlc_list.len() > 0 {
                (owned_count as f32 / dlc_list.len() as f32) * 100.0
            } else {
                0.0
            };
            
            let total_size = dlc_list.iter()
                .filter_map(|dlc| dlc.size_bytes)
                .sum::<u64>();
            
            games_with_dlc.push(GameDLCStats {
                game_id: installed_game.id.clone(),
                game_name: installed_game.name.clone(),
                store: "Ubisoft Connect".to_string(),
                total_dlc_count: dlc_list.len() as u32,
                owned_dlc_count: owned_count,
                installed_dlc_count: installed_count,
                total_dlc_size_bytes: total_size,
                completion_percentage,
                dlc_list,
            });
        }
    }
    
    info!("✅ Ubisoft Connect DLC: {} giochi con DLC processati", games_with_dlc.len());
    Ok(games_with_dlc)
}

/// 🔍 Rileva DLC per un gioco Ubisoft Connect specifico
async fn detect_ubisoft_dlc_for_game(game: &crate::commands::library::InstalledGame) -> Vec<DLCInfo> {
    let mut dlc_list = Vec::new();
    let game_name_lower = game.name.to_lowercase();
    
    // Database DLC comuni per giochi Ubisoft popolari
    let ubisoft_dlc_database = [
        // Assassin's Creed series
        ("assassin's creed valhalla", vec![
            ("The Siege of Paris", "Espansione maggiore ambientata in Francia"),
            ("Wrath of the Druids", "Espansione irlandese con druidi"),
            ("Dawn of Ragnarök", "Espansione mitologica norrena"),
            ("River Raids", "Modalità di gioco aggiuntiva"),
        ]),
        ("assassin's creed odyssey", vec![
            ("The Fate of Atlantis", "Espansione mitologica in tre episodi"),
            ("Legacy of the First Blade", "Storia delle origini degli Assassini"),
            ("Season Pass", "Accesso a tutte le espansioni"),
        ]),
        ("assassin's creed origins", vec![
            ("The Hidden Ones", "Espansione post-campagna"),
            ("The Curse of the Pharaohs", "Avventura nell'aldilà egizio"),
            ("Season Pass", "Accesso completo ai contenuti"),
        ]),
        
        // Far Cry series
        ("far cry 6", vec![
            ("Vaas: Insanity", "DLC con Vaas Montenegro"),
            ("Pagan: Control", "DLC con Pagan Min"),
            ("Joseph: Collapse", "DLC con Joseph Seed"),
            ("Lost Between Worlds", "Espansione sci-fi"),
        ]),
        ("far cry 5", vec![
            ("Hours of Darkness", "DLC Vietnam War"),
            ("Lost on Mars", "Avventura marziana"),
            ("Dead Living Zombies", "Modalità zombie"),
            ("Far Cry New Dawn", "Sequel standalone"),
        ]),
        
        // Watch Dogs series
        ("watch dogs legion", vec![
            ("Bloodline", "Espansione con Aiden Pearce"),
            ("Season Pass", "Accesso a tutti i DLC"),
        ]),
        ("watch dogs 2", vec![
            ("Human Conditions", "Espansione storia principale"),
            ("No Compromise", "Missioni aggiuntive"),
        ]),
        
        // Rainbow Six Siege
        ("rainbow six siege", vec![
            ("Year 8 Pass", "Operatori e contenuti anno 8"),
            ("Year 7 Pass", "Operatori e contenuti anno 7"),
            ("Elite Skins", "Skin premium per operatori"),
        ]),
        
        // The Division series
        ("the division 2", vec![
            ("Warlords of New York", "Espansione maggiore NYC"),
            ("Season Pass", "Accesso contenuti stagionali"),
        ]),
        
        // Ghost Recon series
        ("ghost recon breakpoint", vec![
            ("Episode 1: Terminator", "Crossover Terminator"),
            ("Episode 2: Red Patriot", "Missioni aggiuntive"),
            ("Year 1 Pass", "Accesso contenuti primo anno"),
        ]),
    ];
    
    // Cerca DLC corrispondenti nel database
    for (game_pattern, dlcs) in &ubisoft_dlc_database {
        if game_name_lower.contains(game_pattern) {
            for (dlc_name, dlc_description) in dlcs {
                // Simula controllo installazione/ownership
                // In implementazione reale, controllare file system o registro
                let is_installed = std::path::Path::new(&game.path)
                    .join("dlc")
                    .join(&dlc_name.to_lowercase().replace(" ", "_"))
                    .exists();
                
                let is_owned = is_installed || (rand::random::<f32>() > 0.7); // Mock ownership
                
                dlc_list.push(DLCInfo {
                    id: format!("ubisoft_{}_{}", 
                        game.name.to_lowercase().replace(" ", "_"),
                        dlc_name.to_lowercase().replace(" ", "_")
                    ),
                    name: dlc_name.to_string(),
                    parent_game_id: game.id.clone(),
                    parent_game_name: game.name.clone(),
                    store: "Ubisoft Connect".to_string(),
                    is_installed,
                    is_owned,
                    release_date: None, // Ubisoft Connect non fornisce sempre date
                    price: None, // Prezzo non disponibile nei manifest locali
                    description: Some(dlc_description.to_string()),
                    cover_url: Some(format!("https://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/{}.jpg", 
                        dlc_name.to_lowercase().replace(" ", "_")
                    )),
                    size_bytes: None,
                    last_updated: Some(chrono::Utc::now().timestamp() as u64),
                });
            }
            break; // Trovato il gioco, esci dal loop
        }
    }
    
    dlc_list
}

/// 🎮 Scansione DLC GOG (placeholder)
async fn scan_gog_dlc() -> Result<Vec<GameDLCStats>, String> {
    info!("🔍 Scansione DLC GOG in corso...");
    
    // TODO: Implementare scansione GOG DLC
    // GOG spesso include DLC come parte del gioco base o come prodotti separati
    
    warn!("⚠️ Scansione GOG DLC non ancora implementata");
    Ok(Vec::new())
}

/// 🔍 Comando per ottenere DLC di un gioco specifico
#[tauri::command]
pub async fn get_game_dlc(game_id: String, store: String) -> Result<GameDLCStats, String> {
    info!("🔍 Recupero DLC per gioco: {} ({})", game_id, store);
    
    match store.as_str() {
        "Steam" => {
            // Cerca nei risultati della scansione Steam
            match scan_steam_dlc().await {
                Ok(steam_stats) => {
                    for stats in steam_stats {
                        if stats.game_id == game_id {
                            return Ok(stats);
                        }
                    }
                    Err(format!("Gioco {} non trovato o senza DLC", game_id))
                }
                Err(e) => Err(e)
            }
        }
        "Epic Games" => {
            // Cerca nei risultati della scansione Epic Games
            match scan_epic_dlc().await {
                Ok(epic_stats) => {
                    for stats in epic_stats {
                        if stats.game_id == game_id {
                            return Ok(stats);
                        }
                    }
                    Err(format!("Gioco Epic {} non trovato o senza DLC", game_id))
                }
                Err(e) => Err(e)
            }
        }
        "Ubisoft Connect" => {
            // Cerca nei risultati della scansione Ubisoft Connect
            match scan_ubisoft_dlc().await {
                Ok(ubisoft_stats) => {
                    for stats in ubisoft_stats {
                        if stats.game_id == game_id {
                            return Ok(stats);
                        }
                    }
                    Err(format!("Gioco Ubisoft {} non trovato o senza DLC", game_id))
                }
                Err(e) => Err(e)
            }
        }
        "GOG" => {
            Err("GOG DLC non ancora implementato".to_string())
        }
        _ => {
            Err(format!("Store {} non supportato per DLC", store))
        }
    }
}

/// 📊 Comando per ottenere statistiche aggregate DLC
#[tauri::command]
pub async fn get_dlc_statistics() -> Result<serde_json::Value, String> {
    info!("📊 Calcolo statistiche DLC aggregate");
    
    match scan_all_dlc().await {
        Ok(scan_result) => {
            let mut stats_by_store: HashMap<String, serde_json::Value> = HashMap::new();
            
            for store in &scan_result.stores_scanned {
                let store_games: Vec<&GameDLCStats> = scan_result.games_stats
                    .iter()
                    .filter(|g| g.store == *store)
                    .collect();
                
                let store_total_dlc: u32 = store_games.iter().map(|g| g.total_dlc_count).sum();
                let store_owned_dlc: u32 = store_games.iter().map(|g| g.owned_dlc_count).sum();
                let store_installed_dlc: u32 = store_games.iter().map(|g| g.installed_dlc_count).sum();
                
                stats_by_store.insert(store.clone(), serde_json::json!({
                    "games_with_dlc": store_games.len(),
                    "total_dlc": store_total_dlc,
                    "owned_dlc": store_owned_dlc,
                    "installed_dlc": store_installed_dlc,
                    "completion_rate": if store_total_dlc > 0 { 
                        (store_owned_dlc as f32 / store_total_dlc as f32) * 100.0 
                    } else { 0.0 }
                }));
            }
            
            Ok(serde_json::json!({
                "overview": {
                    "total_games_with_dlc": scan_result.total_games_with_dlc,
                    "total_dlc_found": scan_result.total_dlc_found,
                    "total_dlc_owned": scan_result.total_dlc_owned,
                    "total_dlc_installed": scan_result.total_dlc_installed,
                    "overall_completion_rate": if scan_result.total_dlc_found > 0 {
                        (scan_result.total_dlc_owned as f32 / scan_result.total_dlc_found as f32) * 100.0
                    } else { 0.0 },
                    "scan_duration_ms": scan_result.scan_duration_ms
                },
                "by_store": stats_by_store,
                "stores_scanned": scan_result.stores_scanned
            }))
        }
        Err(e) => Err(e)
    }
}
