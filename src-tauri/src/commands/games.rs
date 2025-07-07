use crate::commands::{steam, epic, gog, origin, ubisoft, battlenet, itchio, library};
use crate::models::*;
use log;
use serde_json;
use std::path::Path;
use tokio::fs;
use std::collections::HashMap;

// Funzione helper per rilevare giochi VR dal nome
fn is_vr_game(game_name: &str) -> bool {
    let name_lower = game_name.to_lowercase();
    
    // Giochi con "VR" nel titolo
    if name_lower.contains("vr") || name_lower.contains("virtual reality") {
        return true;
    }
    
    // Giochi VR famosi senza "VR" nel titolo
    let vr_games = [
        "half-life: alyx",
        "beat saber",
        "pavlov",
        "vrchat",
        "job simulator",
        "rec room",
        "blade and sorcery",
        "boneworks",
        "bonelab",
        "phasmophobia",
        "arizona sunshine",
        "the walking dead: saints & sinners",
        "moss",
        "astro bot rescue mission",
        "superhot", // Nota: anche la versione non-VR esiste
        "pistol whip",
        "until you fall",
        "the climb",
        "robo recall",
        "lone echo",
        "echo arena",
        "echo combat",
        "asgard's wrath",
        "stormland",
        "medal of honor: above and beyond",
        "resident evil 4", // Versione VR
        "no man's sky", // Supporta VR
        "elite dangerous", // Supporta VR
        "dirt rally", // Supporta VR
        "project cars", // Supporta VR
        "assetto corsa", // Supporta VR
        "microsoft flight simulator", // Supporta VR
        "eleven table tennis",
        "thrill of the fight",
        "gorn",
        "vacation simulator",
        "i expect you to die",
        "keep talking and nobody explodes", // Supporta VR
        "tilt brush",
        "google earth", // Google Earth VR
    ];
    
    vr_games.iter().any(|&vr_game| name_lower.contains(vr_game))
}

// Funzione helper per caricare giochi Steam dal file JSON (fallback)
async fn load_steam_games_from_json() -> Result<Vec<GameInfo>, String> {
    let steam_games_path = r"C:\dev\GameStringer\steam_owned_games.json";
    
    match tokio::fs::read_to_string(steam_games_path).await {
        Ok(data) => {
            match serde_json::from_str::<Vec<serde_json::Value>>(&data) {
                Ok(steam_games) => {
                    let mut games = Vec::new();
                    
                    for game in steam_games {
                        if let (Some(appid), Some(name)) = (
                            game["appid"].as_u64(),
                            game["name"].as_str()
                        ) {
                            let game_info = GameInfo {
                                id: format!("steam_{}", appid),
                                title: name.to_string(),
                                platform: "Steam".to_string(),
                                install_path: None,
                                executable_path: None,
                                icon: game["img_icon_url"].as_str().map(|icon| {
                                    format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", appid, icon)
                                }),
                                image_url: game["img_icon_url"].as_str().map(|icon| {
                                    format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", appid, icon)
                                }),
                                header_image: Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                is_installed: false,
                                steam_app_id: Some(appid as u32),
                                is_vr: is_vr_game(name),
                                engine: detect_game_engine(name),
                                last_played: game["rtime_last_played"].as_u64()
                                    .and_then(|timestamp| {
                                        if timestamp > 0 {
                                            Some(timestamp)
                                        } else {
                                            None
                                        }
                                    }),
                                is_shared: false,
                                // Lingue di default per fallback
                                supported_languages: Some(vec![
                                    "english".to_string(),
                                    "italian".to_string(),
                                    "french".to_string(),
                                    "german".to_string(),
                                    "spanish".to_string(),
                                ]),
                            };
                            games.push(game_info);
                        }
                    }
                    
                    log::info!("✅ Caricati {} giochi Steam da file JSON (fallback)", games.len());
                    Ok(games)
                }
                Err(e) => Err(format!("Errore parsing JSON Steam: {}", e))
            }
        }
        Err(e) => Err(format!("Errore lettura file Steam: {}", e))
    }
}

// Funzione helper per rilevare l'engine dal nome del gioco
fn detect_game_engine(game_name: &str) -> Option<String> {
    let name_lower = game_name.to_lowercase();
    
    // Engine comuni rilevabili dal nome
    if name_lower.contains("unreal") || 
       name_lower.contains("fortnite") ||
       name_lower.contains("rocket league") ||
       name_lower.contains("borderlands") ||
       name_lower.contains("gears") {
        Some("Unreal Engine".to_string())
    } else if name_lower.contains("unity") ||
              name_lower.contains("hearthstone") ||
              name_lower.contains("ori and") ||
              name_lower.contains("cuphead") {
        Some("Unity".to_string())
    } else if name_lower.contains("source") ||
              name_lower.contains("half-life") ||
              name_lower.contains("portal") ||
              name_lower.contains("team fortress") ||
              name_lower.contains("counter-strike") ||
              name_lower.contains("left 4 dead") {
        Some("Source Engine".to_string())
    } else if name_lower.contains("creation engine") ||
              name_lower.contains("skyrim") ||
              name_lower.contains("fallout 4") ||
              name_lower.contains("fallout 76") {
        Some("Creation Engine".to_string())
    } else if name_lower.contains("id tech") ||
              name_lower.contains("doom") ||
              name_lower.contains("quake") {
        Some("id Tech".to_string())
    } else {
        None
    }
}



#[tauri::command]
pub async fn get_games() -> Result<Vec<GameInfo>, String> {
    log::info!("🎮 Recupero lista giochi completa...");
    
    let mut all_games = Vec::new();
    
    // Prima prova a caricare giochi Steam con metadati completi
    match steam::load_steam_credentials().await {
        Ok(credentials) => {
            log::info!("🔑 Credenziali Steam trovate, recupero giochi con metadati completi...");
            match steam::get_steam_games(credentials.api_key, credentials.steam_id, Some(false)).await {
                Ok(steam_games) => {
                    log::info!("✅ Trovati {} giochi Steam con metadati completi", steam_games.len());
                    
                    // Converti SteamGame in GameInfo con tutti i metadati
                    for steam_game in steam_games {
                        let game_info = GameInfo {
                            id: format!("steam_{}", steam_game.appid),
                            title: steam_game.name.clone(),
                            platform: "Steam".to_string(),
                            install_path: None,
                            executable_path: None,
                            icon: if !steam_game.img_icon_url.is_empty() {
                                Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                            } else {
                                None
                            },
                            image_url: if !steam_game.img_icon_url.is_empty() {
                                Some(format!("https://media.steampowered.com/steamcommunity/public/images/apps/{}/{}.jpg", steam_game.appid, steam_game.img_icon_url))
                            } else {
                                None
                            },
                            header_image: if !steam_game.header_image.is_empty() {
                                Some(steam_game.header_image.clone())
                            } else {
                                Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", steam_game.appid))
                            },
                            is_installed: steam_game.is_installed,
                            steam_app_id: Some(steam_game.appid),
                            // Usa i metadati reali di Steam API
                            is_vr: steam_game.is_vr,
                            engine: if !steam_game.engine.is_empty() {
                                Some(steam_game.engine.clone())
                            } else {
                                detect_game_engine(&steam_game.name)
                            },
                            last_played: if steam_game.last_played > 0 {
                                Some(steam_game.last_played)
                            } else {
                                None
                            },
                            is_shared: steam_game.is_shared,
                            // Usa le lingue reali di Steam API
                            supported_languages: if !steam_game.supported_languages.is_empty() {
                                Some(steam_game.supported_languages.split(',').map(|s| s.trim().to_string()).collect())
                            } else {
                                Some(vec!["english".to_string()])
                            },
                        };
                        all_games.push(game_info);
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ Errore recupero giochi Steam API: {}, fallback a file JSON", e);
                    // Fallback al file JSON se Steam API fallisce
                    if let Ok(fallback_games) = load_steam_games_from_json().await {
                        all_games.extend(fallback_games);
                    }
                }
            }
        }
        Err(_) => {
            log::info!("🔄 Nessuna credenziale Steam, carico da file JSON...");
            // Fallback al file JSON se non ci sono credenziali
            if let Ok(fallback_games) = load_steam_games_from_json().await {
                all_games.extend(fallback_games);
            }
        }
    }

    // Aggiungi giochi Epic Games installati
    match library::get_epic_installed_games().await {
        Ok(epic_games) => {
                            log::info!("🎮 Trovati {} giochi Epic Games installati", epic_games.len());
                            
                            // Raccogli gli app_name per recuperare le copertine
                            let epic_app_names: Vec<String> = epic_games.iter()
                                .map(|g| g.name.clone())
                                .collect();
                            
                            // Recupera le copertine Epic in batch
                            let epic_covers = match epic::get_epic_covers_batch(epic_app_names).await {
                                Ok(covers) => covers,
                                Err(e) => {
                                    log::warn!("⚠️ Errore recupero copertine Epic: {}", e);
                                    HashMap::new()
                                }
                            };
                            
                            // Converti i giochi Epic in GameInfo
                            for epic_game in epic_games {
                                let header_image = epic_covers.get(&epic_game.name).cloned();
                                
                                let game_info = GameInfo {
                                    id: epic_game.id.clone(),
                                    title: epic_game.name.clone(),
                                    platform: "Epic Games".to_string(),
                                    install_path: Some(epic_game.path.clone()),
                                    executable_path: epic_game.executable.clone(),
                                    icon: None,
                                    image_url: header_image.clone(),
                                    header_image,
                                    is_installed: true,
                                    steam_app_id: None,
                                    is_vr: epic_game.name.to_lowercase().contains("vr") || epic_game.name.to_lowercase().contains("virtual reality"),
                                    engine: if epic_game.name.to_lowercase().contains("unreal") { Some("Unreal Engine".to_string()) } else { None },
                                    last_played: epic_game.last_modified,
                                    is_shared: false,
                                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Epic: {}", e);
        }
    }

    // Aggiungi giochi GOG installati
    match gog::get_gog_installed_games().await {
        Ok(gog_games) => {
            log::info!("🎮 Trovati {} giochi GOG installati", gog_games.len());
            
            // Raccogli gli ID per recuperare le copertine
            let gog_game_ids: Vec<String> = gog_games.iter()
                .map(|g| g.id.replace("gog_", ""))
                .collect();
            
            // Recupera le copertine GOG in batch
            let gog_covers = match gog::get_gog_covers_batch(gog_game_ids).await {
                Ok(covers) => covers,
                Err(e) => {
                    log::warn!("⚠️ Errore recupero copertine GOG: {}", e);
                    HashMap::new()
                }
            };
            
            // Converti i giochi GOG in GameInfo
            for gog_game in gog_games {
                let game_id_clean = gog_game.id.replace("gog_", "");
                let header_image = gog_covers.get(&game_id_clean).cloned();
                
                let game_info = GameInfo {
                    id: gog_game.id.clone(),
                    title: gog_game.name.clone(),
                    platform: "GOG".to_string(),
                    install_path: Some(gog_game.path.clone()),
                    executable_path: gog_game.executable.clone(),
                    icon: None,
                    image_url: header_image.clone(),
                    header_image,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: gog_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string(), "italian".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi GOG: {}", e);
        }
    }

    // Aggiungi giochi Origin/EA App installati
    match origin::get_origin_installed_games().await {
        Ok(origin_games) => {
            log::info!("🎮 Trovati {} giochi Origin/EA App installati", origin_games.len());
            
            // Origin/EA App non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi Origin in GameInfo
            for origin_game in origin_games {
                let game_info = GameInfo {
                    id: origin_game.id.clone(),
                    title: origin_game.name.clone(),
                    platform: origin_game.platform.clone(),
                    install_path: Some(origin_game.path.clone()),
                    executable_path: origin_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: origin_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Origin/EA App: {}", e);
        }
    }

    // Aggiungi giochi Ubisoft Connect installati
    match ubisoft::get_ubisoft_installed_games().await {
        Ok(ubisoft_games) => {
            log::info!("🎮 Trovati {} giochi Ubisoft Connect installati", ubisoft_games.len());
            
            // Ubisoft Connect non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi Ubisoft in GameInfo
            for ubisoft_game in ubisoft_games {
                let game_info = GameInfo {
                    id: ubisoft_game.id.clone(),
                    title: ubisoft_game.name.clone(),
                    platform: ubisoft_game.platform.clone(),
                    install_path: Some(ubisoft_game.path.clone()),
                    executable_path: ubisoft_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: ubisoft_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Ubisoft Connect: {}", e);
        }
    }

    // Aggiungi giochi Battle.net installati
    match battlenet::get_battlenet_installed_games().await {
        Ok(battlenet_games) => {
            log::info!("🎮 Trovati {} giochi Battle.net installati", battlenet_games.len());
            
            // Battle.net non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi Battle.net in GameInfo
            for battlenet_game in battlenet_games {
                let game_info = GameInfo {
                    id: battlenet_game.id.clone(),
                    title: battlenet_game.name.clone(),
                    platform: battlenet_game.platform.clone(),
                    install_path: Some(battlenet_game.path.clone()),
                    executable_path: battlenet_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: battlenet_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi Battle.net: {}", e);
        }
    }

    // Aggiungi giochi itch.io installati
    match itchio::get_itchio_installed_games().await {
        Ok(itchio_games) => {
            log::info!("🎮 Trovati {} giochi itch.io installati", itchio_games.len());
            
            // itch.io non ha API pubblica per le copertine
            // Usiamo placeholder per ora
            
            // Converti i giochi itch.io in GameInfo
            for itchio_game in itchio_games {
                let game_info = GameInfo {
                    id: itchio_game.id.clone(),
                    title: itchio_game.name.clone(),
                    platform: itchio_game.platform.clone(),
                    install_path: Some(itchio_game.path.clone()),
                    executable_path: itchio_game.executable.clone(),
                    icon: None,
                    image_url: None, // Nessuna API pubblica per le copertine
                    header_image: None,
                    is_installed: true,
                    steam_app_id: None,
                    is_vr: false,
                    engine: None,
                    last_played: itchio_game.last_modified,
                    is_shared: false,
                    supported_languages: Some(vec!["english".to_string()]),
                };
                all_games.push(game_info);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Errore caricamento giochi itch.io: {}", e);
        }
    }

    log::info!("✅ Totale giochi caricati: {}", all_games.len());
    Ok(all_games)
}

#[tauri::command]
pub async fn get_game_by_id(game_id: String) -> Result<Option<GameInfo>, String> {
    log::info!("🔍 Recupero gioco con ID: {}", game_id);
    
    // TODO: Implementare query database per ID specifico
    // Per ora restituiamo None come placeholder
    log::warn!("⚠️ Funzione get_game_by_id non ancora implementata");
    Ok(None)
}

#[tauri::command]
pub async fn scan_games() -> Result<Vec<GameScanResult>, String> {
    log::info!("🔎 Avvio scansione giochi...");
    
    let mut scan_results = Vec::new();
    
    // Scansiona giochi Steam
    match scan_steam_games().await {
        Ok(mut steam_games) => {
            log::info!("✅ Trovati {} giochi Steam", steam_games.len());
            scan_results.append(&mut steam_games);
        }
        Err(e) => {
            log::error!("❌ Errore scansione Steam: {}", e);
        }
    }
    
    // TODO: Aggiungere scansione per altri launcher (GOG, Origin, etc.)
// Epic Games è già implementato nella funzione get_games()
    
    log::info!("🎯 Scansione completata: {} giochi totali", scan_results.len());
    Ok(scan_results)
}

// Funzione helper per scansionare giochi Steam
async fn scan_steam_games() -> Result<Vec<GameScanResult>, String> {
    let mut games = Vec::new();
    
    // Ottieni percorsi librerie Steam
    let library_paths = get_steam_library_folders().await?;
    
    for library_path in library_paths {
        let steamapps_path = format!("{}/steamapps", library_path);
        
        match scan_steam_library(&steamapps_path).await {
            Ok(mut library_games) => {
                games.append(&mut library_games);
            }
            Err(e) => {
                log::warn!("⚠️ Errore scansione libreria {}: {}", steamapps_path, e);
            }
        }
    }
    
    Ok(games)
}

// Funzione per ottenere percorsi librerie Steam
async fn get_steam_library_folders() -> Result<Vec<String>, String> {
    let steam_path = "C:/Program Files (x86)/Steam";
    let library_folders_vdf = format!("{}/steamapps/libraryfolders.vdf", steam_path);
    
    let mut library_paths = vec![steam_path.to_string()];
    
    match fs::read_to_string(&library_folders_vdf).await {
        Ok(data) => {
            for line in data.lines() {
                if let Some(captures) = regex::Regex::new(r#""path"\s+"(.+?)""#)
                    .unwrap()
                    .captures(line) 
                {
                    if let Some(path) = captures.get(1) {
                        let normalized_path = path.as_str().replace("\\\\", "/");
                        library_paths.push(normalized_path);
                    }
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ Impossibile leggere libraryfolders.vdf: {}", e);
        }
    }
    
    // Rimuovi duplicati
    library_paths.sort();
    library_paths.dedup();
    
    Ok(library_paths)
}

// Funzione per scansionare una singola libreria Steam
async fn scan_steam_library(steamapps_path: &str) -> Result<Vec<GameScanResult>, String> {
    let mut games = Vec::new();
    
    match fs::read_dir(steamapps_path).await {
        Ok(mut entries) => {
            while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
                let path = entry.path();
                
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                        match parse_steam_manifest(&path).await {
                            Ok(Some(game)) => {
                                games.push(game);
                            }
                            Ok(None) => {
                                // Manifest non valido o gioco non installato
                            }
                            Err(e) => {
                                log::warn!("⚠️ Errore parsing manifest {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Impossibile leggere directory {}: {}", steamapps_path, e));
        }
    }
    
    Ok(games)
}

// Funzione per parsare un manifest Steam
async fn parse_steam_manifest(manifest_path: &Path) -> Result<Option<GameScanResult>, String> {
    let content = fs::read_to_string(manifest_path).await
        .map_err(|e| format!("Errore lettura manifest: {}", e))?;
    
    let mut app_id: Option<String> = None;
    let mut name = None;
    let mut install_dir = None;
    let mut state_flags: Option<u32> = None;
    
    for line in content.lines() {
        let line = line.trim();
        
        if line.starts_with("\"appid\"") {
            if let Some(captures) = regex::Regex::new(r#""appid"\s+"(\d+)""#)
                .unwrap()
                .captures(line) 
            {
                app_id = captures.get(1).and_then(|m| m.as_str().parse().ok());
            }
        } else if line.starts_with("\"name\"") {
            if let Some(captures) = regex::Regex::new(r#""name"\s+"(.+?)""#)
                .unwrap()
                .captures(line) 
            {
                name = captures.get(1).map(|m| m.as_str().to_string());
            }
        } else if line.starts_with("\"installdir\"") {
            if let Some(captures) = regex::Regex::new(r#""installdir"\s+"(.+?)""#)
                .unwrap()
                .captures(line) 
            {
                install_dir = captures.get(1).map(|m| m.as_str().to_string());
            }
        } else if line.starts_with("\"StateFlags\"") {
            if let Some(captures) = regex::Regex::new(r#""StateFlags"\s+"(\d+)""#)
                .unwrap()
                .captures(line) 
            {
                state_flags = captures.get(1).and_then(|m| m.as_str().parse().ok());
            }
        }
    }
    
    if let (Some(app_id), Some(name), Some(install_dir)) = (app_id, name, install_dir) {
        // Verifica se il gioco è installato (StateFlags & 4 == 4)
        let is_installed = state_flags.map_or(false, |flags| flags & 4 == 4);
        
        if is_installed {
            let library_path = manifest_path.parent()
                .and_then(|p| p.parent())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let install_path = format!("{}/steamapps/common/{}", library_path, install_dir);
            
            // Trova l'eseguibile principale
            let executable_path = find_largest_exe(&install_path).await
                .unwrap_or_else(|| format!("{}/game.exe", install_path));
            
            let game_result = GameScanResult {
                title: name,
                path: install_path,
                executable_path: Some(executable_path),
                app_id: Some(app_id.to_string()),
                source: "Steam".to_string(),
                is_installed: true,
            };
            
            return Ok(Some(game_result));
        }
    }
    
    Ok(None)
}

// Funzione per trovare l'eseguibile più grande in una directory
async fn find_largest_exe(dir: &str) -> Option<String> {
    match fs::read_dir(dir).await {
        Ok(mut entries) => {
            let mut largest_exe = None;
            let mut largest_size = 0;
            
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                
                if let Some(extension) = path.extension() {
                    if extension.to_string_lossy().to_lowercase() == "exe" {
                        if let Ok(metadata) = entry.metadata().await {
                            if metadata.len() > largest_size {
                                largest_size = metadata.len();
                                largest_exe = Some(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
            
            largest_exe
        }
        Err(_) => None,
    }
}
