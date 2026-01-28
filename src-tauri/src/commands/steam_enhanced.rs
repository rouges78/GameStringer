use steamlocate::SteamDir;
use crate::models::GameInfo;
use log::{info, warn, error};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// 🚀 STEAMLOCATE-RS INTEGRATION
/// Nuova implementazione per scansione Steam più robusta e veloce

#[derive(Debug, Serialize, Deserialize)]
pub struct EnhancedSteamInfo {
    pub steam_path: String,
    pub libraries_count: usize,
    pub total_apps: usize,
    pub installed_apps: usize,
}

/// 🎮 Scansione Steam migliorata con steamlocate-rs
/// Questa funzione sostituisce la logica custom con una libreria dedicata
#[tauri::command]
pub async fn scan_steam_with_steamlocate() -> Result<Vec<GameInfo>, String> {
    info!("🚀 Avvio scansione Steam con steamlocate-rs");
    
    // Localizza l'installazione Steam
    let steam_dir = match SteamDir::locate() {
        Ok(dir) => {
            info!("✅ Steam trovato in: {}", dir.path().display());
            dir
        },
        Err(e) => {
            warn!("❌ Steam non trovato sul sistema: {:?}", e);
            return Err("Steam non installato o non trovato".to_string());
        }
    };

    let mut games = Vec::new();
    let mut total_libraries = 0;
    let mut total_apps = 0;
    let mut installed_apps = 0;

    // Itera su tutte le librerie Steam
    match steam_dir.libraries() {
        Ok(libraries) => {
            for library_result in libraries {
                match library_result {
                    Ok(library) => {
                        total_libraries += 1;
                        info!("📚 Scansione libreria: {}", library.path().display());
                        
                        // Itera su tutte le app nella libreria
                        for app_result in library.apps() {
                            match app_result {
                                Ok(app) => {
                                    total_apps += 1;
                                    
                                    // Converti SteamApp in GameInfo
                                    let game_info = convert_steam_app_to_game_info(&app, &library.path().display().to_string());
                                    
                                    // Controlla se è installato
                                    if app.name.is_some() {
                                        installed_apps += 1;
                                    }
                                    
                                    games.push(game_info);
                                },
                                Err(e) => {
                                    warn!("⚠️ Errore lettura app: {}", e);
                                }
                            }
                        }
                    },
                    Err(e) => {
                        warn!("⚠️ Errore lettura libreria: {}", e);
                    }
                }
            }
        },
        Err(e) => {
            error!("❌ Errore accesso librerie Steam: {}", e);
            return Err(format!("Errore accesso librerie Steam: {}", e));
        }
    }

    info!("✅ Scansione completata: {} librerie, {} app totali, {} installate", 
          total_libraries, total_apps, installed_apps);

    Ok(games)
}

/// 🔍 Trova un gioco specifico per App ID
#[tauri::command]
pub async fn find_steam_game_by_id(app_id: u32) -> Result<Option<GameInfo>, String> {
    info!("🔍 Ricerca gioco Steam con ID: {}", app_id);
    
    let steam_dir = match SteamDir::locate() {
        Ok(dir) => dir,
        Err(_) => return Err("Steam non trovato".to_string()),
    };

    match steam_dir.find_app(app_id) {
        Ok(Some((app, library))) => {
            info!("✅ Gioco trovato: {:?} in libreria: {}", app.name, library.path().display());
            let game_info = convert_steam_app_to_game_info(&app, &library.path().display().to_string());
            Ok(Some(game_info))
        },
        Ok(None) => {
            info!("❌ Gioco con ID {} non trovato", app_id);
            Ok(None)
        },
        Err(e) => {
            error!("❌ Errore ricerca gioco: {}", e);
            Err(format!("Errore ricerca gioco: {}", e))
        }
    }
}

/// 📊 Ottieni informazioni dettagliate su Steam
#[tauri::command]
pub async fn get_enhanced_steam_info() -> Result<EnhancedSteamInfo, String> {
    info!("📊 Raccolta informazioni Steam avanzate");
    
    let steam_dir = match SteamDir::locate() {
        Ok(dir) => dir,
        Err(_) => return Err("Steam non trovato".to_string()),
    };

    let steam_path = steam_dir.path().display().to_string();
    let mut libraries_count = 0;
    let mut total_apps = 0;
    let mut installed_apps = 0;

    // Conta librerie e app
    match steam_dir.libraries() {
        Ok(libraries) => {
            for library_result in libraries {
                match library_result {
                    Ok(library) => {
                        libraries_count += 1;
                        
                        for app_result in library.apps() {
                            match app_result {
                                Ok(app) => {
                                    total_apps += 1;
                                    if app.name.is_some() {
                                        installed_apps += 1;
                                    }
                                },
                                Err(_) => {}
                            }
                        }
                    },
                    Err(_) => {}
                }
            }
        },
        Err(e) => {
            warn!("⚠️ Errore conteggio librerie: {}", e);
        }
    }

    let info = EnhancedSteamInfo {
        steam_path,
        libraries_count,
        total_apps,
        installed_apps,
    };

    info!("📊 Steam Info: {} librerie, {} app totali, {} installate", 
          info.libraries_count, info.total_apps, info.installed_apps);

    Ok(info)
}

/// 🔄 Converti SteamApp in GameInfo
// Funzione temporanea semplificata - da implementare quando SteamApp sarà disponibile
fn convert_steam_app_to_game_info(app: &steamlocate::App, library_path: &str) -> GameInfo {
    let app_id_str = app.app_id.to_string();
    let name = app.name.clone().unwrap_or_else(|| format!("App {}", app.app_id));
    use std::fs;
    
    // Leggi data di aggiunta dal file appmanifest
    let added_date = {
        let manifest_path = std::path::Path::new(library_path).join("steamapps").join(format!("appmanifest_{}.acf", app.app_id));
        if manifest_path.exists() {
            fs::metadata(&manifest_path)
                .ok()
                .and_then(|m| m.created().ok())
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
        } else {
            None
        }
    };
    
    GameInfo {
        id: app_id_str.clone(),
        title: name,
        platform: "Steam".to_string(),
        install_path: Some(library_path.to_string()),
        executable_path: None,
        icon: None,
        image_url: None,
        header_image: None,
        is_installed: true,
        steam_app_id: Some(app.app_id),
        is_vr: false, // Default, da implementare rilevamento
        engine: None, // Default, da implementare rilevamento
        last_played: None,
        is_shared: false,
        supported_languages: None, // Default, da implementare rilevamento
        genres: None, // Default, da implementare rilevamento
        added_date,
        }
}

/// 🎯 Test della nuova implementazione steamlocate
#[tauri::command]
pub async fn test_steamlocate_integration() -> Result<String, String> {
    info!("🧪 Test integrazione steamlocate-rs");
    
    let steam_dir = match SteamDir::locate() {
        Ok(dir) => dir,
        Err(_) => return Ok("❌ Steam non trovato per il test".to_string()),
    };

    let mut report = String::new();
    report.push_str(&format!("✅ Steam trovato in: {}\n", steam_dir.path().display()));
    
    // Test conteggio librerie
    match steam_dir.libraries() {
        Ok(libraries) => {
            let mut lib_count = 0;
            let mut app_count = 0;
            
            for library_result in libraries {
                match library_result {
                    Ok(library) => {
                        lib_count += 1;
                        report.push_str(&format!("📚 Libreria {}: {}\n", lib_count, library.path().display()));
                        
                        let mut local_app_count = 0;
                        for app_result in library.apps() {
                            match app_result {
                                Ok(app) => {
                                    app_count += 1;
                                    local_app_count += 1;
                                    
                                    // Mostra solo i primi 3 giochi per libreria
                                    if local_app_count <= 3 {
                                        let name = app.name.as_deref().unwrap_or("Senza nome");
                                        report.push_str(&format!("  🎮 {} (ID: {})\n", name, app.app_id));
                                    }
                                },
                                Err(_) => {}
                            }
                        }
                        
                        if local_app_count > 3 {
                            report.push_str(&format!("  ... e altri {} giochi\n", local_app_count - 3));
                        }
                        report.push_str(&format!("  Totale app in questa libreria: {}\n\n", local_app_count));
                    },
                    Err(e) => {
                        report.push_str(&format!("⚠️ Errore libreria: {}\n", e));
                    }
                }
            }
            
            report.push_str(&format!("📊 RIEPILOGO:\n"));
            report.push_str(&format!("  - Librerie trovate: {}\n", lib_count));
            report.push_str(&format!("  - App totali: {}\n", app_count));
            report.push_str(&format!("✅ Test steamlocate-rs completato con successo!\n"));
        },
        Err(e) => {
            report.push_str(&format!("❌ Errore accesso librerie: {}\n", e));
        }
    }
    
    Ok(report)
}

/// Informazioni su un'app Steam (nome + tipo)
struct AppInfoData {
    name: String,
    is_dlc: bool,
    _parent_appid: Option<u32>,
}

/// 📖 Legge i nomi e tipi dei giochi da appinfo.vdf (cache Steam con TUTTI i nomi)
fn load_game_info_from_appinfo(steam_path: &std::path::Path) -> HashMap<u32, AppInfoData> {
    use new_vdf_parser::appinfo_vdf_parser::open_appinfo_vdf;
    use std::path::PathBuf;
    
    let mut app_info: HashMap<u32, AppInfoData> = HashMap::new();
    let appinfo_path: PathBuf = steam_path.join("appcache").join("appinfo.vdf");
    
    if !appinfo_path.exists() {
        warn!("⚠️ appinfo.vdf non trovato: {}", appinfo_path.display());
        return app_info;
    }
    
    info!("📖 Parsing appinfo.vdf per nomi e tipi giochi...");
    
    // open_appinfo_vdf prende &PathBuf e Option<bool> per filter
    let apps = open_appinfo_vdf(&appinfo_path, None);
    
    for (appid_str, app_data) in apps.iter() {
        if let Ok(appid) = appid_str.parse::<u32>() {
            let common = app_data.get("common");
            
            // Cerca il nome
            let name = common
                .and_then(|c| c.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            
            if name.is_empty() {
                continue;
            }
            
            // Controlla se è un DLC
            let app_type = common
                .and_then(|c| c.get("type"))
                .and_then(|t| t.as_str())
                .unwrap_or("game");
            
            let is_dlc = app_type.eq_ignore_ascii_case("dlc") || 
                         app_type.eq_ignore_ascii_case("music") ||
                         app_type.eq_ignore_ascii_case("tool") ||
                         app_type.eq_ignore_ascii_case("demo") ||
                         app_type.eq_ignore_ascii_case("advertising") ||
                         app_type.eq_ignore_ascii_case("mod");
            
            // Cerca il parent appid per i DLC
            let parent_appid = common
                .and_then(|c| c.get("parent"))
                .and_then(|p| p.as_str())
                .and_then(|s| s.parse::<u32>().ok());
            
            app_info.insert(appid, AppInfoData {
                name,
                is_dlc,
                _parent_appid: parent_appid,
            });
        }
    }
    
    let dlc_count = app_info.values().filter(|a| a.is_dlc).count();
    let game_count = app_info.len() - dlc_count;
    info!("✅ Caricati {} giochi + {} DLC da appinfo.vdf", game_count, dlc_count);
    
    app_info
}

/// 🌐 Scarica il nome di un gioco da Steam Store API
async fn fetch_game_name_from_steam(appid: u32) -> Option<String> {
    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", appid);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;
    
    let response = client.get(&url).send().await.ok()?;
    let json: serde_json::Value = response.json().await.ok()?;
    
    json.get(&appid.to_string())?
        .get("data")?
        .get("name")?
        .as_str()
        .map(|s| s.to_string())
}

/// 🌐 Scarica nomi di più giochi in batch da Steam Store API
#[allow(dead_code)]
pub async fn fetch_game_names_batch(appids: Vec<u32>) -> HashMap<u32, String> {
    use futures::future::join_all;
    
    let mut results = HashMap::new();
    
    // Limita a 50 richieste per non sovraccaricare
    let batch: Vec<_> = appids.into_iter().take(50).collect();
    
    info!("🌐 Scaricando nomi per {} giochi da Steam API...", batch.len());
    
    let futures: Vec<_> = batch.iter().map(|&appid| async move {
        (appid, fetch_game_name_from_steam(appid).await)
    }).collect();
    
    let responses = join_all(futures).await;
    
    for (appid, name_opt) in responses {
        if let Some(name) = name_opt {
            results.insert(appid, name);
        }
    }
    
    info!("✅ Scaricati {} nomi da Steam API", results.len());
    results
}

/// 👤 Ottiene lo Steam ID dell'utente corrente da loginusers.vdf
fn get_current_steam_id(steam_path: &std::path::Path) -> Option<String> {
    use std::fs;
    use regex::Regex;
    
    let loginusers_path = steam_path.join("config").join("loginusers.vdf");
    if !loginusers_path.exists() {
        return None;
    }
    
    if let Ok(content) = fs::read_to_string(&loginusers_path) {
        // Cerca l'utente con MostRecent = 1 (utente attivo)
        // Formato: "steamid" { ... "MostRecent" "1" ... }
        let steamid_regex = Regex::new(r#""(\d{17})"\s*\{[^}]*"MostRecent"\s*"1""#).ok()?;
        if let Some(cap) = steamid_regex.captures(&content) {
            return cap.get(1).map(|m| m.as_str().to_string());
        }
        
        // Fallback: prendi il primo Steam ID trovato
        let fallback_regex = Regex::new(r#""(\d{17})""#).ok()?;
        if let Some(cap) = fallback_regex.captures(&content) {
            return cap.get(1).map(|m| m.as_str().to_string());
        }
    }
    
    None
}

/// 🚀 SCAN COMPLETO - Trova TUTTI i giochi (installati + owned + family sharing)
/// Legge direttamente i file locali di Steam come fa Rai Pal
#[tauri::command]
pub async fn scan_all_steam_games_fast() -> Result<Vec<GameInfo>, String> {
    use std::fs;
    use regex::Regex;
    
    info!("🚀 SCAN COMPLETO Steam - Metodo Rai Pal style");
    
    let steam_dir = SteamDir::locate()
        .map_err(|e| format!("Steam non trovato: {:?}", e))?;
    
    let steam_path = steam_dir.path();
    info!("📂 Steam path: {}", steam_path.display());
    
    // 0️⃣ CARICA INFO DA APPINFO.VDF (nomi + tipi per filtrare DLC)
    let app_info = load_game_info_from_appinfo(steam_path);
    info!("📖 App info disponibili: {}", app_info.len());
    
    let mut all_games: HashMap<u32, GameInfo> = HashMap::new();
    
    // 0.1️⃣ CARICA PRIMA I GIOCHI FAMILY SHARING DAL CACHE (per preservarli)
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if cache_file.exists() {
            if let Ok(json_str) = fs::read_to_string(&cache_file) {
                if let Ok(cached_games) = serde_json::from_str::<Vec<GameInfo>>(&json_str) {
                    let mut family_count = 0;
                    for cached in cached_games {
                        // Carica SOLO giochi Family Sharing (con ID steam_family_*)
                        if cached.is_shared && cached.id.starts_with("steam_family_") {
                            if let Some(appid) = cached.steam_app_id {
                                all_games.insert(appid, cached);
                                family_count += 1;
                            }
                        }
                    }
                    info!("📥 Caricati {} giochi Family Sharing dal cache", family_count);
                }
            }
        }
    }
    
    // Helper per verificare se un appid è un DLC
    let is_dlc = |appid: u32| -> bool {
        app_info.get(&appid).map(|info| info.is_dlc).unwrap_or(false)
    };
    
    // Helper per ottenere il nome
    let get_name = |appid: u32| -> String {
        app_info.get(&appid)
            .map(|info| info.name.clone())
            .unwrap_or_else(|| format!("Game {}", appid))
    };
    
    // 0.5️⃣ TROVA STEAM ID UTENTE CORRENTE (per rilevare Family Sharing)
    let current_steam_id = get_current_steam_id(steam_path);
    info!("👤 Steam ID corrente: {:?}", current_steam_id);
    
    // 1️⃣ GIOCHI INSTALLATI (steamlocate) + RILEVAMENTO FAMILY SHARING
    info!("1️⃣ Scansione giochi installati...");
    if let Ok(libraries) = steam_dir.libraries() {
        for lib_result in libraries {
            if let Ok(library) = lib_result {
                let library_path = library.path();
                for app_result in library.apps() {
                    if let Ok(app) = app_result {
                        let appid = app.app_id;
                        
                        // 🚫 SALTA DLC - verranno mostrati nella pagina del gioco
                        if is_dlc(appid) {
                            continue;
                        }
                        
                        let name = app.name.clone().unwrap_or_else(|| get_name(appid));
                        
                        // Salta tool, ridistribuibili e software
                        if name.contains("Redistributable") || name.contains("Runtime") || 
                           name.contains("Proton") || name.contains("Steam Linux") ||
                           name.contains("Steamworks") || name.contains("SDK") ||
                           name.contains("RealityScan") || name.contains("Reality Scan") ||
                           name.contains("Wallpaper Engine") || name.contains("RPG Maker") ||
                           name.contains("GameMaker") || name.contains("Dedicated Server") {
                            continue;
                        }
                        
                        // Costruisci il path completo del gioco
                        let full_install_path = library_path.join("steamapps").join("common").join(&app.install_dir);
                        let full_path_str = full_install_path.to_string_lossy().to_string();
                        
                        // Rileva il motore di gioco
                        let engine = {
                            let detected = crate::engine_detector::detect_engine(&full_install_path);
                            if detected != crate::engine_detector::GameEngine::Unknown {
                                Some(detected.as_str().to_string())
                            } else {
                                None
                            }
                        };
                        
                        // 📅 Leggi data di aggiunta e LastOwner dal file appmanifest
                        let manifest_path = library_path.join("steamapps").join(format!("appmanifest_{}.acf", appid));
                        let (added_date, is_shared) = if manifest_path.exists() {
                            let added = fs::metadata(&manifest_path)
                                .ok()
                                .and_then(|m| m.created().ok())
                                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs());
                            
                            // 🔍 Leggi LastOwner per rilevare Family Sharing
                            let shared = if let Ok(content) = fs::read_to_string(&manifest_path) {
                                // Cerca "LastOwner" nel file ACF
                                let last_owner_regex = Regex::new(r#""LastOwner"\s*"(\d+)""#).unwrap();
                                if let Some(cap) = last_owner_regex.captures(&content) {
                                    if let Some(owner_match) = cap.get(1) {
                                        let owner_id = owner_match.as_str();
                                        // Se LastOwner è diverso dal nostro Steam ID, è Family Sharing
                                        if let Some(ref my_id) = current_steam_id {
                                            !owner_id.is_empty() && owner_id != "0" && owner_id != my_id
                                        } else {
                                            // Se non conosciamo il nostro ID, assumiamo shared se LastOwner è presente
                                            !owner_id.is_empty() && owner_id != "0"
                                        }
                                    } else { false }
                                } else { false }
                            } else { false };
                            
                            (added, shared)
                        } else {
                            (None, false)
                        };
                        
                        all_games.insert(appid, GameInfo {
                            id: if is_shared { format!("steam_shared_{}", appid) } else { format!("steam_{}", appid) },
                            title: name,
                            platform: "Steam".to_string(),
                            install_path: Some(full_path_str),
                            executable_path: None,
                            icon: None,
                            image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                            header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                            is_installed: true,
                            steam_app_id: Some(appid),
                            is_vr: false,
                            engine,
                            last_played: None,
                            is_shared,
                            supported_languages: None,
                            genres: None,
                            added_date,
                            });
                    }
                }
            }
        }
    }
    let shared_count = all_games.values().filter(|g| g.is_shared).count();
    info!("   ✅ Giochi installati: {} (di cui {} Family Sharing)", all_games.len(), shared_count);
    
    // 2️⃣ GIOCHI DA LOCALCONFIG.VDF (tutti i giochi giocati/posseduti + LastPlayed)
    info!("2️⃣ Scansione localconfig.vdf...");
    let userdata_path = steam_path.join("userdata");
    
    // Mappa per salvare i timestamp LastPlayed
    let mut last_played_map: HashMap<u32, u64> = HashMap::new();
    
    if userdata_path.exists() {
        if let Ok(entries) = fs::read_dir(&userdata_path) {
            for entry in entries.flatten() {
                let config_path = entry.path().join("config").join("localconfig.vdf");
                if config_path.exists() {
                    if let Ok(content) = fs::read_to_string(&config_path) {
                        // Cerca tutti gli appid e i loro LastPlayed
                        // Pattern: "appid" { ... "LastPlayed" "timestamp" ... }
                        let appid_regex = Regex::new(r#""(\d{4,7})"\s*\{([^}]*)\}"#).unwrap();
                        let lastplayed_regex = Regex::new(r#""LastPlayed"\s*"(\d+)""#).unwrap();
                        
                        for cap in appid_regex.captures_iter(&content) {
                            if let (Some(appid_match), Some(block)) = (cap.get(1), cap.get(2)) {
                                if let Ok(appid) = appid_match.as_str().parse::<u32>() {
                                    // Estrai LastPlayed dal blocco
                                    if let Some(lp_cap) = lastplayed_regex.captures(block.as_str()) {
                                        if let Some(lp_match) = lp_cap.get(1) {
                                            if let Ok(timestamp) = lp_match.as_str().parse::<u64>() {
                                                if timestamp > 0 {
                                                    last_played_map.insert(appid, timestamp);
                                                }
                                            }
                                        }
                                    }
                                    
                                    // 🚫 SALTA DLC
                                    if is_dlc(appid) {
                                        continue;
                                    }
                                    if !all_games.contains_key(&appid) && appid > 100 {
                                        let name = get_name(appid);
                                        let last_played = last_played_map.get(&appid).copied();
                                        all_games.insert(appid, GameInfo {
                                            id: format!("steam_{}", appid),
                                            title: name,
                                            platform: "Steam".to_string(),
                                            install_path: None,
                                            executable_path: None,
                                            icon: None,
                                            image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                            header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                            is_installed: false,
                                            steam_app_id: Some(appid),
                                            is_vr: false,
                                            engine: None,
                                            last_played,
                                            is_shared: false,
                                            supported_languages: None,
                                            genres: None,
                                            added_date: None, // Non installato
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
    
    // Aggiorna i giochi già trovati con i timestamp LastPlayed
    for (appid, game) in all_games.iter_mut() {
        if game.last_played.is_none() {
            if let Some(&timestamp) = last_played_map.get(appid) {
                game.last_played = Some(timestamp);
            }
        }
    }
    
    info!("   ✅ Dopo localconfig: {} giochi, {} con LastPlayed", all_games.len(), last_played_map.len());
    
    // 3️⃣ GIOCHI DA SHAREDCONFIG.VDF + FAMILYSHARING (include family sharing)
    info!("3️⃣ Scansione Family Sharing...");
    if userdata_path.exists() {
        if let Ok(entries) = fs::read_dir(&userdata_path) {
            for entry in entries.flatten() {
                // Cerca in vari percorsi possibili per Family Sharing
                let paths = vec![
                    entry.path().join("7").join("remote").join("sharedconfig.vdf"),
                    entry.path().join("config").join("sharedconfig.vdf"),
                    entry.path().join("config").join("familysharing.vdf"),
                    entry.path().join("241100").join("remote").join("sharedconfig.vdf"), // Steam Family
                ];
                
                for shared_path in paths {
                    if shared_path.exists() {
                        if let Ok(content) = fs::read_to_string(&shared_path) {
                            let appid_regex = Regex::new(r#""(\d{4,7})""#).unwrap();
                            for cap in appid_regex.captures_iter(&content) {
                                if let Some(appid_match) = cap.get(1) {
                                    if let Ok(appid) = appid_match.as_str().parse::<u32>() {
                                        // 🚫 SALTA DLC
                                        if is_dlc(appid) {
                                            continue;
                                        }
                                        if !all_games.contains_key(&appid) && appid > 100 {
                                            let name = get_name(appid);
                                            all_games.insert(appid, GameInfo {
                                                id: format!("steam_shared_{}", appid),
                                                title: name,
                                                platform: "Steam".to_string(),
                                                install_path: None,
                                                executable_path: None,
                                                icon: None,
                                                image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                                header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                                is_installed: false,
                                                steam_app_id: Some(appid),
                                                is_vr: false,
                                                engine: None,
                                                last_played: None,
                                                is_shared: true,
                                                supported_languages: None,
                                                genres: None,
                                                added_date: None, // Family sharing
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
    info!("   ✅ Dopo sharedconfig: {}", all_games.len());
    
    // 3.5️⃣ GIOCHI DA REMOTECACHE.VDF (tutti i giochi accessibili incluso Family Sharing)
    info!("3.5️⃣ Scansione remotecache.vdf...");
    if userdata_path.exists() {
        if let Ok(entries) = fs::read_dir(&userdata_path) {
            for entry in entries.flatten() {
                let remote_cache = entry.path().join("config").join("remotecache.vdf");
                if remote_cache.exists() {
                    if let Ok(content) = fs::read_to_string(&remote_cache) {
                        // Cerca appid nel formato "appid" o numeri a 6-7 cifre
                        let appid_regex = Regex::new(r#"["/](\d{5,7})["/]"#).unwrap();
                        for cap in appid_regex.captures_iter(&content) {
                            if let Some(appid_match) = cap.get(1) {
                                if let Ok(appid) = appid_match.as_str().parse::<u32>() {
                                    if is_dlc(appid) { continue; }
                                    if !all_games.contains_key(&appid) && appid > 1000 {
                                        let name = get_name(appid);
                                        // Skip se il nome è generico
                                        if name.starts_with("Game ") { continue; }
                                        all_games.insert(appid, GameInfo {
                                            id: format!("steam_shared_{}", appid),
                                            title: name,
                                            platform: "Steam".to_string(),
                                            install_path: None,
                                            executable_path: None,
                                            icon: None,
                                            image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                            header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                            is_installed: false,
                                            steam_app_id: Some(appid),
                                            is_vr: false,
                                            engine: None,
                                            last_played: None,
                                            is_shared: true,
                                            supported_languages: None,
                                            genres: None,
                                            added_date: None,
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
    info!("   ✅ Dopo remotecache: {}", all_games.len());
    
    // 3.6️⃣ GIOCHI DA USERDATA FOLDERS (cloud saves = giochi giocati/accessibili)
    info!("3.6️⃣ Scansione userdata folders (cloud saves)...");
    if userdata_path.exists() {
        if let Ok(user_entries) = fs::read_dir(&userdata_path) {
            for user_entry in user_entries.flatten() {
                let user_path = user_entry.path();
                // Ogni sottocartella numerica in userdata/<steamid32>/ è un appid
                if let Ok(app_entries) = fs::read_dir(&user_path) {
                    for app_entry in app_entries.flatten() {
                        let folder_name = app_entry.file_name().to_string_lossy().to_string();
                        // Salta cartelle speciali (config, 7, etc)
                        if folder_name == "config" || folder_name == "7" || folder_name == "ac" {
                            continue;
                        }
                        if let Ok(appid) = folder_name.parse::<u32>() {
                            if is_dlc(appid) { continue; }
                            if appid < 1000 { continue; } // Salta app di sistema
                            if !all_games.contains_key(&appid) {
                                let name = get_name(appid);
                                if name.starts_with("Game ") { continue; }
                                all_games.insert(appid, GameInfo {
                                    id: format!("steam_shared_{}", appid),
                                    title: name,
                                    platform: "Steam".to_string(),
                                    install_path: None,
                                    executable_path: None,
                                    icon: None,
                                    image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                    header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                                    is_installed: false,
                                    steam_app_id: Some(appid),
                                    is_vr: false,
                                    engine: None,
                                    last_played: None,
                                    is_shared: true,
                                    supported_languages: None,
                                    genres: None,
                                    added_date: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    info!("   ✅ Dopo userdata folders: {}", all_games.len());
    
    // 3.7️⃣ GIOCHI DA APPCACHE/APPINFO.VDF (tutti i giochi con metadata cached)
    info!("3.7️⃣ Scansione appinfo per giochi con cache...");
    // Debug: cerca Bootstrap Island (2083350)
    if let Some(bootstrap) = app_info.get(&2083350) {
        info!("🔍 DEBUG Bootstrap Island trovato in appinfo: name='{}', is_dlc={}", bootstrap.name, bootstrap.is_dlc);
    } else {
        info!("🔍 DEBUG Bootstrap Island NON trovato in appinfo");
    }
    // I giochi in app_info che non sono ancora in all_games potrebbero essere Family Sharing
    let mut appinfo_added = 0;
    for (&appid, app_data) in app_info.iter() {
        if app_data.is_dlc { continue; }
        if appid < 1000 { continue; }
        if all_games.contains_key(&appid) { continue; }
        // Aggiungi solo se ha un nome valido (significa che l'utente ha accesso)
        if !app_data.name.starts_with("Game ") && !app_data.name.is_empty() {
            appinfo_added += 1;
            all_games.insert(appid, GameInfo {
                id: format!("steam_shared_{}", appid),
                title: app_data.name.clone(),
                platform: "Steam".to_string(),
                install_path: None,
                executable_path: None,
                icon: None,
                image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                is_installed: false,
                steam_app_id: Some(appid),
                is_vr: false,
                engine: None,
                last_played: None,
                is_shared: true,
                supported_languages: None,
                genres: None,
                added_date: None,
            });
        }
    }
    info!("   ✅ Dopo appinfo scan: {} (+{} da appinfo)", all_games.len(), appinfo_added);
    
    // 4️⃣ GIOCHI DA LIBRARYCACHE (cartelle con appid = giochi posseduti)
    info!("4️⃣ Scansione librarycache...");
    let cache_path = steam_path.join("appcache").join("librarycache");
    if cache_path.exists() {
        if let Ok(entries) = fs::read_dir(&cache_path) {
            for entry in entries.flatten() {
                // Le cartelle hanno nome = appid
                let filename = entry.file_name().to_string_lossy().to_string();
                if let Ok(appid) = filename.parse::<u32>() {
                    // 🚫 SALTA DLC
                    if is_dlc(appid) {
                        continue;
                    }
                    if !all_games.contains_key(&appid) && appid > 100 {
                        let name = get_name(appid);
                        all_games.insert(appid, GameInfo {
                            id: format!("steam_{}", appid),
                            title: name,
                            platform: "Steam".to_string(),
                            install_path: None,
                            executable_path: None,
                            icon: None,
                            image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                            header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                            is_installed: false,
                            steam_app_id: Some(appid),
                            is_vr: false,
                            engine: None,
                            last_played: None,
                            is_shared: false,
                            supported_languages: None,
                            genres: None,
                            added_date: None, // Da librarycache
                            });
                    }
                }
            }
        }
    }
    info!("   ✅ Dopo librarycache: {}", all_games.len());
    
    // Converti in Vec
    let games: Vec<GameInfo> = all_games.into_values().collect();
    info!("🎮 TOTALE GIOCHI TROVATI: {}", games.len());
    
    // 5️⃣ SALVA IN CACHE per persistenza
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if let Some(parent) = cache_file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string(&games) {
            if let Err(e) = fs::write(&cache_file, json) {
                warn!("⚠️ Errore salvataggio cache: {}", e);
            } else {
                info!("💾 Cache salvata: {} giochi in {}", games.len(), cache_file.display());
            }
        }
    }
    
    Ok(games)
}

/// 📂 Carica giochi dalla cache (se esiste)
#[tauri::command]
pub async fn load_steam_games_cache() -> Result<Vec<GameInfo>, String> {
    use std::fs;
    
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if cache_file.exists() {
            match fs::read_to_string(&cache_file) {
                Ok(json) => {
                    match serde_json::from_str::<Vec<GameInfo>>(&json) {
                        Ok(games) => {
                            info!("📂 Cache caricata: {} giochi", games.len());
                            return Ok(games);
                        }
                        Err(e) => {
                            warn!("⚠️ Errore parsing cache: {}", e);
                        }
                    }
                }
                Err(e) => {
                    warn!("⚠️ Errore lettura cache: {}", e);
                }
            }
        }
    }
    
    // Cache non disponibile, ritorna lista vuota
    Ok(Vec::new())
}

/// 🎮 Fetch dettagli gioco da Steam Store API (bypass CORS)
#[derive(Debug, Serialize, Deserialize)]
pub struct SteamGameDetails {
    pub name: Option<String>,
    pub steam_appid: Option<u32>,
    pub short_description: Option<String>,
    pub detailed_description: Option<String>,
    pub about_the_game: Option<String>,
    pub header_image: Option<String>,
    pub website: Option<String>,
    pub developers: Option<Vec<String>>,
    pub publishers: Option<Vec<String>>,
    pub release_date: Option<SteamReleaseDate>,
    pub genres: Option<Vec<SteamGenre>>,
    pub categories: Option<Vec<SteamCategory>>,
    pub screenshots: Option<Vec<SteamScreenshot>>,
    pub metacritic: Option<SteamMetacritic>,
    pub recommendations: Option<SteamRecommendations>,
    pub supported_languages: Option<String>,
    pub pc_requirements: Option<SteamRequirements>,
    pub is_free: Option<bool>,
    pub background: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamReleaseDate {
    pub coming_soon: Option<bool>,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamGenre {
    pub id: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamCategory {
    pub id: Option<u32>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamScreenshot {
    pub id: Option<u32>,
    pub path_thumbnail: Option<String>,
    pub path_full: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamMetacritic {
    pub score: Option<u32>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamRecommendations {
    pub total: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamRequirements {
    pub minimum: Option<String>,
    pub recommended: Option<String>,
}

#[tauri::command]
pub async fn fetch_steam_game_details(app_id: u32) -> Result<Option<SteamGameDetails>, String> {
    info!("🎮 Fetching dettagli Steam per app_id: {}", app_id);
    
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}&l=it&cc=IT",
        app_id
    );
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| format!("Errore HTTP: {}", e))?;
    
    if !response.status().is_success() {
        // 403 = rate limiting, non è un errore critico
        if response.status().as_u16() == 403 {
            warn!("⚠️ Steam API rate limited (403) per app_id: {}", app_id);
            return Ok(None);
        }
        return Err(format!("Steam API errore: {}", response.status()));
    }
    
    let text = response.text().await.map_err(|e| format!("Errore lettura: {}", e))?;
    
    // Parse JSON response
    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    // Check if success
    let app_data = json.get(app_id.to_string());
    if let Some(data) = app_data {
        if data.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(game_data) = data.get("data") {
                let details: SteamGameDetails = serde_json::from_value(game_data.clone())
                    .map_err(|e| format!("Errore deserializzazione: {}", e))?;
                info!("✅ Dettagli trovati per: {:?}", details.name);
                return Ok(Some(details));
            }
        }
    }
    
    info!("⚠️ Nessun dettaglio trovato per app_id: {}", app_id);
    Ok(None)
}

/// 📁 Ottieni il percorso di installazione di Steam
#[tauri::command]
pub fn get_steam_install_path() -> Result<String, String> {
    info!("📁 Richiesta percorso installazione Steam");
    
    match SteamDir::locate() {
        Ok(steam_dir) => {
            let path = steam_dir.path().to_string_lossy().to_string();
            info!("✅ Percorso Steam: {}", path);
            Ok(path)
        },
        Err(e) => {
            warn!("❌ Steam non trovato: {:?}", e);
            Err("Steam non trovato sul sistema".to_string())
        }
    }
}

/// 📁 Trova il percorso di un gioco Steam dato l'appid
#[tauri::command(rename_all = "camelCase")]
pub fn find_game_path_by_appid(app_id: u32) -> Result<Option<String>, String> {
    info!("🔍 Ricerca percorso gioco per appid: {}", app_id);
    
    match SteamDir::locate() {
        Ok(steam_dir) => {
            match steam_dir.find_app(app_id) {
                Ok(Some((app, library))) => {
                    let game_path = library.path().join("steamapps").join("common").join(&app.install_dir);
                    if game_path.exists() {
                        let path_str = game_path.to_string_lossy().to_string();
                        info!("✅ Percorso trovato per appid {}: {}", app_id, path_str);
                        return Ok(Some(path_str));
                    }
                    Ok(None)
                },
                Ok(None) => {
                    info!("❌ Gioco con appid {} non trovato", app_id);
                    Ok(None)
                },
                Err(e) => {
                    warn!("❌ Errore ricerca: {:?}", e);
                    Err(format!("Errore ricerca gioco: {}", e))
                }
            }
        },
        Err(e) => {
            warn!("❌ Steam non trovato: {:?}", e);
            Err("Steam non trovato".to_string())
        }
    }
}

/// 📁 Trova il percorso reale di un gioco cercando in tutte le librerie Steam
#[tauri::command(rename_all = "camelCase")]
pub fn find_game_install_path(install_dir: String) -> Result<String, String> {
    info!("🔍 Ricerca percorso gioco: {}", install_dir);
    
    match SteamDir::locate() {
        Ok(steam_dir) => {
            // Prima cerca nella cartella principale di Steam
            let main_path = steam_dir.path().join("steamapps").join("common").join(&install_dir);
            if main_path.exists() {
                let path_str = main_path.to_string_lossy().to_string();
                info!("✅ Gioco trovato in cartella principale: {}", path_str);
                return Ok(path_str);
            }
            
            // Itera su tutte le librerie Steam secondarie
            if let Ok(libraries) = steam_dir.libraries() {
                for library in libraries {
                    if let Ok(lib) = library {
                        let game_path = lib.path().join("steamapps").join("common").join(&install_dir);
                        if game_path.exists() {
                            let path_str = game_path.to_string_lossy().to_string();
                            info!("✅ Gioco trovato in libreria secondaria: {}", path_str);
                            return Ok(path_str);
                        }
                    }
                }
            }
            
            warn!("❌ Gioco non trovato in nessuna libreria: {}", install_dir);
            Err(format!("Gioco '{}' non trovato in nessuna libreria Steam", install_dir))
        },
        Err(e) => {
            warn!("❌ Steam non trovato: {:?}", e);
            Err("Steam non trovato sul sistema".to_string())
        }
    }
}

/// 🌐 AGGIORNA DATABASE REMOTO - Scarica nomi giochi da Steam API (come RaiPal)
#[tauri::command]
pub async fn update_remote_game_database() -> Result<Vec<GameInfo>, String> {
    use std::fs;
    use futures::future::join_all;
    
    info!("🌐 AGGIORNAMENTO DATABASE REMOTO - Scarico nomi da Steam API...");
    
    // 1. Carica la cache esistente
    let mut games_map: HashMap<u32, GameInfo> = HashMap::new();
    
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if cache_file.exists() {
            if let Ok(json) = fs::read_to_string(&cache_file) {
                if let Ok(games) = serde_json::from_str::<Vec<GameInfo>>(&json) {
                    for game in games {
                        if let Some(appid) = game.steam_app_id {
                            games_map.insert(appid, game);
                        }
                    }
                }
            }
        }
    }
    
    // 2. Trova giochi senza nome valido
    let games_without_name: Vec<u32> = games_map.iter()
        .filter(|(_, g)| g.title.starts_with("Game ") || g.title.is_empty())
        .map(|(&appid, _)| appid)
        .collect();
    
    info!("📋 Trovati {} giochi senza nome valido", games_without_name.len());
    
    if games_without_name.is_empty() {
        return Ok(games_map.into_values().collect());
    }
    
    // 3. Scarica nomi in batch
    let mut updated_count = 0;
    
    for chunk in games_without_name.chunks(50) {
        info!("🌐 Scaricando batch di {} giochi...", chunk.len());
        
        let futures: Vec<_> = chunk.iter().map(|&appid| async move {
            (appid, fetch_game_name_from_steam(appid).await)
        }).collect();
        
        let results = join_all(futures).await;
        
        for (appid, name_opt) in results {
            if let Some(name) = name_opt {
                if let Some(game) = games_map.get_mut(&appid) {
                    game.title = name;
                    updated_count += 1;
                }
            }
        }
        
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    
    info!("✅ Aggiornati {} nomi", updated_count);
    
    // 4. Salva cache
    let games: Vec<GameInfo> = games_map.into_values().collect();
    
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if let Some(parent) = cache_file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string(&games) {
            let _ = fs::write(&cache_file, json);
        }
    }
    
    Ok(games)
}

/// 🔗 CARICA GIOCHI FAMILY SHARING - Carica i giochi dalla libreria del condivisore
#[tauri::command]
pub async fn load_family_sharing_games(
    sharer_id: String,
    profile_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>
) -> Result<usize, String> {
    use std::fs;
    
    info!("🔗 Caricamento giochi Family Sharing da Steam ID: {}", sharer_id);
    println!("[FAMILY] 🔗 Caricamento da Steam ID: {}", sharer_id);
    
    if sharer_id.len() != 17 || !sharer_id.chars().all(|c| c.is_ascii_digit()) {
        return Err("Steam ID non valido (deve essere 17 cifre)".to_string());
    }
    
    // Carica API key dal ProfileManager
    let api_key = {
        let manager = profile_state.manager.lock().await;
        match manager.load_credential_for_active_profile(crate::profiles::StoreType::Steam).await {
            Ok(Some(credential)) => credential.password.clone(),
            Ok(None) => return Err("API Key Steam non configurata. Vai su Settings → Stores".to_string()),
            Err(e) => return Err(format!("Errore caricamento credenziali: {}", e)),
        }
    };
    
    if api_key.is_empty() {
        return Err("API Key Steam non configurata".to_string());
    }
    
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&include_appinfo=true&include_played_free_games=true",
        api_key, sharer_id
    );
    
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await
        .map_err(|e| format!("Errore richiesta API: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API Steam errore: {}", response.status()));
    }
    
    let json: serde_json::Value = response.json().await
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    let games_array = json.get("response")
        .and_then(|r| r.get("games"))
        .and_then(|g| g.as_array())
        .ok_or("Nessun gioco trovato o profilo privato")?;
    
    info!("📥 Trovati {} giochi dal condivisore {}", games_array.len(), sharer_id);
    println!("[FAMILY] 📥 Steam ID {} → {} giochi trovati", sharer_id, games_array.len());
    
    // Usa ID stringa come chiave per permettere sia owned che family dello stesso gioco
    let mut existing_games: HashMap<String, GameInfo> = HashMap::new();
    
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if cache_file.exists() {
            if let Ok(json_str) = fs::read_to_string(&cache_file) {
                if let Ok(games) = serde_json::from_str::<Vec<GameInfo>>(&json_str) {
                    for game in games {
                        existing_games.insert(game.id.clone(), game);
                    }
                }
            }
        }
    }
    
    let mut added_count = 0;
    let total_from_api = games_array.len();
    
    for game in games_array {
        let appid = game.get("appid").and_then(|a| a.as_u64()).unwrap_or(0) as u32;
        let name = game.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
        
        if appid < 100 || name.is_empty() { continue; }
        
        let family_id = format!("steam_family_{}", appid);
        
        // Aggiungi solo se non esiste già come family (evita duplicati tra condivisori)
        if !existing_games.contains_key(&family_id) {
            existing_games.insert(family_id.clone(), GameInfo {
                id: family_id,
                title: name,
                platform: "Steam".to_string(),
                install_path: None,
                executable_path: None,
                icon: None,
                image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                is_installed: false,
                steam_app_id: Some(appid),
                is_vr: false,
                engine: None,
                last_played: None,
                is_shared: true,
                supported_languages: None,
                genres: None,
                added_date: None,
            });
            added_count += 1;
        }
    }
    
    info!("✅ Family Sharing: {} dall'API, {} nuovi aggiunti", total_from_api, added_count);
    println!("[FAMILY] ✅ Steam ID {} → {} dall'API, {} nuovi (duplicati ignorati)", sharer_id, total_from_api, added_count);
    
    let games: Vec<GameInfo> = existing_games.into_values().collect();
    
    if let Some(cache_dir) = dirs::data_local_dir() {
        let cache_file = cache_dir.join("GameStringer").join("steam_games_cache.json");
        if let Some(parent) = cache_file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json_str) = serde_json::to_string(&games) {
            let _ = fs::write(&cache_file, json_str);
        }
    }
    
    Ok(added_count)
}

/// 💾 SALVA FAMILY SHARING IDS - Persistenza locale
#[tauri::command]
pub async fn save_family_sharing_ids(ids: Vec<String>) -> Result<(), String> {
    use std::fs;
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let config_dir = data_dir.join("GameStringer");
        let _ = fs::create_dir_all(&config_dir);
        let file_path = config_dir.join("family_sharing_ids.json");
        
        let json = serde_json::to_string(&ids)
            .map_err(|e| format!("Errore serializzazione: {}", e))?;
        
        fs::write(&file_path, json)
            .map_err(|e| format!("Errore scrittura file: {}", e))?;
        
        info!("💾 Salvati {} Family Sharing IDs", ids.len());
        Ok(())
    } else {
        Err("Impossibile trovare directory dati".to_string())
    }
}

/// 🎮 OTTIENI NOME GIOCO DA STEAM API
/// Comando Tauri per ottenere il nome di un gioco dato il suo App ID
#[tauri::command]
pub async fn get_steam_game_name(app_id: u32) -> Result<Option<String>, String> {
    info!("🎮 Richiesta nome gioco per Steam App ID: {}", app_id);
    Ok(fetch_game_name_from_steam(app_id).await)
}

/// 🖼️ CERCA IMMAGINI SU STEAMGRIDDB
/// Fallback per giochi senza immagini Steam - usa API ufficiale con chiave
#[tauri::command]
pub async fn fetch_steamgriddb_image(app_id: u32, game_name: String, api_key: Option<String>) -> Result<Option<String>, String> {
    info!("🖼️ Cercando immagine su SteamGridDB per: {} ({})", game_name, app_id);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    
    // Se abbiamo API key, usa l'API ufficiale
    if let Some(key) = api_key {
        if !key.is_empty() {
            // Step 1: Cerca il gioco per Steam App ID
            let search_url = format!(
                "https://www.steamgriddb.com/api/v2/games/steam/{}",
                app_id
            );
            
            match client.get(&search_url)
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await 
            {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(game_id) = json["data"]["id"].as_u64() {
                            // Step 2: Ottieni hero/grid per questo gioco
                            let heroes_url = format!(
                                "https://www.steamgriddb.com/api/v2/heroes/game/{}",
                                game_id
                            );
                            
                            if let Ok(heroes_resp) = client.get(&heroes_url)
                                .header("Authorization", format!("Bearer {}", key))
                                .send()
                                .await 
                            {
                                if let Ok(heroes_json) = heroes_resp.json::<serde_json::Value>().await {
                                    if let Some(heroes) = heroes_json["data"].as_array() {
                                        if let Some(first_hero) = heroes.first() {
                                            if let Some(url) = first_hero["url"].as_str() {
                                                info!("✅ Trovata hero SteamGridDB: {}", url);
                                                return Ok(Some(url.to_string()));
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Fallback a grids se non ci sono heroes
                            let grids_url = format!(
                                "https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions=460x215,920x430",
                                game_id
                            );
                            
                            if let Ok(grids_resp) = client.get(&grids_url)
                                .header("Authorization", format!("Bearer {}", key))
                                .send()
                                .await 
                            {
                                if let Ok(grids_json) = grids_resp.json::<serde_json::Value>().await {
                                    if let Some(grids) = grids_json["data"].as_array() {
                                        if let Some(first_grid) = grids.first() {
                                            if let Some(url) = first_grid["url"].as_str() {
                                                info!("✅ Trovata grid SteamGridDB: {}", url);
                                                return Ok(Some(url.to_string()));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(resp) => {
                    warn!("SteamGridDB API returned status: {}", resp.status());
                }
                Err(e) => {
                    warn!("SteamGridDB API error: {}", e);
                }
            }
        }
    }
    
    info!("❌ Nessuna immagine trovata su SteamGridDB per {}", game_name);
    Ok(None)
}

/// � SALVA COVER IN CACHE LOCALE
#[tauri::command]
pub async fn save_cover_cache(game_id: String, image_url: String) -> Result<(), String> {
    use std::fs;
    use std::collections::HashMap;
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let cache_dir = data_dir.join("GameStringer").join("covers");
        fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        
        let cache_file = cache_dir.join("cover_cache.json");
        
        // Leggi cache esistente o crea nuova
        let mut cache: HashMap<String, String> = if cache_file.exists() {
            let json = fs::read_to_string(&cache_file).unwrap_or_default();
            serde_json::from_str(&json).unwrap_or_default()
        } else {
            HashMap::new()
        };
        
        cache.insert(game_id.clone(), image_url.clone());
        
        let json = serde_json::to_string_pretty(&cache).map_err(|e| e.to_string())?;
        fs::write(&cache_file, json).map_err(|e| e.to_string())?;
        
        info!("💾 Cover salvata in cache per: {}", game_id);
        Ok(())
    } else {
        Err("Directory dati non trovata".to_string())
    }
}

/// 📖 LEGGI COVER DA CACHE LOCALE
#[tauri::command]
pub async fn get_cover_cache(game_id: String) -> Result<Option<String>, String> {
    use std::fs;
    use std::collections::HashMap;
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let cache_file = data_dir.join("GameStringer").join("covers").join("cover_cache.json");
        
        if cache_file.exists() {
            let json = fs::read_to_string(&cache_file).map_err(|e| e.to_string())?;
            let cache: HashMap<String, String> = serde_json::from_str(&json).unwrap_or_default();
            
            if let Some(url) = cache.get(&game_id) {
                return Ok(Some(url.clone()));
            }
        }
    }
    
    Ok(None)
}

/// 📖 LEGGI TUTTE LE COVER DALLA CACHE
#[tauri::command]
pub async fn get_all_cover_cache() -> Result<std::collections::HashMap<String, String>, String> {
    use std::fs;
    use std::collections::HashMap;
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let cache_file = data_dir.join("GameStringer").join("covers").join("cover_cache.json");
        
        if cache_file.exists() {
            let json = fs::read_to_string(&cache_file).map_err(|e| e.to_string())?;
            let cache: HashMap<String, String> = serde_json::from_str(&json).unwrap_or_default();
            return Ok(cache);
        }
    }
    
    Ok(std::collections::HashMap::new())
}

/// �📂 CARICA FAMILY SHARING IDS - Persistenza locale
#[tauri::command]
pub async fn load_family_sharing_ids() -> Result<Vec<String>, String> {
    use std::fs;
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let file_path = data_dir.join("GameStringer").join("family_sharing_ids.json");
        
        if file_path.exists() {
            let json = fs::read_to_string(&file_path)
                .map_err(|e| format!("Errore lettura file: {}", e))?;
            
            let ids: Vec<String> = serde_json::from_str(&json)
                .map_err(|e| format!("Errore parsing JSON: {}", e))?;
            
            info!("📂 Caricati {} Family Sharing IDs", ids.len());
            Ok(ids)
        } else {
            Ok(vec![])
        }
    } else {
        Ok(vec![])
    }
}

// ============================================
// 🔐 STEAM OPENID AUTHENTICATION
// ============================================

use std::sync::Arc;
use tokio::sync::Mutex;
use std::net::TcpListener;
use std::io::{Read, Write};

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamOpenIdConfig {
    pub auth_url: String,
    pub return_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SteamUser {
    pub steam_id: String,
    pub persona_name: String,
    pub avatar: String,
    pub avatar_full: String,
    pub profile_url: String,
}

// Global state for callback result
static STEAM_CALLBACK_RESULT: once_cell::sync::Lazy<Arc<Mutex<Option<String>>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// 🔐 Genera URL per Steam OpenID login
#[tauri::command]
pub async fn steam_openid_get_auth_url(return_url: String) -> Result<String, String> {
    info!("🔐 Generando URL Steam OpenID...");
    
    let params = [
        ("openid.ns", "http://specs.openid.net/auth/2.0"),
        ("openid.mode", "checkid_setup"),
        ("openid.return_to", &return_url),
        ("openid.realm", &return_url),
        ("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select"),
        ("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select"),
    ];
    
    let query = params.iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    
    let auth_url = format!("https://steamcommunity.com/openid/login?{}", query);
    
    info!("✅ URL generato: {}", auth_url);
    Ok(auth_url)
}

/// 🔐 Avvia server locale per callback Steam e restituisce URL + porta
#[tauri::command]
pub async fn steam_openid_start_server() -> Result<(String, u16), String> {
    info!("🔐 Avviando server callback Steam...");
    
    // Clear previous result
    *STEAM_CALLBACK_RESULT.lock().await = None;
    
    // Find available port
    let port = find_available_port().ok_or("No available port")?;
    let return_url = format!("http://127.0.0.1:{}/callback", port);
    
    // Generate auth URL
    let params = [
        ("openid.ns", "http://specs.openid.net/auth/2.0"),
        ("openid.mode", "checkid_setup"),
        ("openid.return_to", return_url.as_str()),
        ("openid.realm", return_url.as_str()),
        ("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select"),
        ("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select"),
    ];
    
    let query = params.iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    
    let auth_url = format!("https://steamcommunity.com/openid/login?{}", query);
    
    // Start callback server in a dedicated OS thread (not tokio)
    let port_clone = port;
    std::thread::spawn(move || {
        run_callback_server_sync(port_clone);
    });
    
    // Give server time to start
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    
    info!("✅ Server avviato su porta {}", port);
    Ok((auth_url, port))
}

/// 🔐 Attende e restituisce il risultato del callback Steam
#[tauri::command]
pub async fn steam_openid_wait_callback(timeout_secs: u64) -> Result<String, String> {
    info!("🔐 In attesa del callback Steam (timeout: {}s)...", timeout_secs);
    
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs);
    
    loop {
        // Check if we have a result
        let result = STEAM_CALLBACK_RESULT.lock().await.clone();
        if let Some(steam_id) = result {
            info!("✅ Callback ricevuto! SteamID: {}", steam_id);
            // Clear for next time
            *STEAM_CALLBACK_RESULT.lock().await = None;
            return Ok(steam_id);
        }
        
        // Check timeout
        if start.elapsed() > timeout {
            return Err("Timeout waiting for Steam callback".to_string());
        }
        
        // Wait a bit before checking again
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
}

fn find_available_port() -> Option<u16> {
    for port in 31350..31400 {
        if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

fn run_callback_server_sync(port: u16) {
    let listener = match TcpListener::bind(format!("127.0.0.1:{}", port)) {
        Ok(l) => l,
        Err(e) => {
            log::error!("Failed to bind callback server: {}", e);
            return;
        }
    };
    
    // Set timeout so we don't block forever
    listener.set_nonblocking(false).ok();
    
    info!("📡 Callback server listening on port {}", port);
    
    // Accept one connection
    if let Ok((mut stream, _)) = listener.accept() {
        let mut buffer = [0; 4096];
        if let Ok(n) = stream.read(&mut buffer) {
            let request = String::from_utf8_lossy(&buffer[..n]);
            
            // Parse the callback URL
            if let Some(query_start) = request.find("/callback?") {
                let query_end = request[query_start..].find(" HTTP").unwrap_or(request.len());
                let query = &request[query_start + 10..query_start + query_end];
                
                // Parse query params
                let params: HashMap<String, String> = query
                    .split('&')
                    .filter_map(|p| {
                        let mut parts = p.splitn(2, '=');
                        Some((
                            urlencoding::decode(parts.next()?).ok()?.to_string(),
                            urlencoding::decode(parts.next()?).ok()?.to_string(),
                        ))
                    })
                    .collect();
                
                // Extract SteamID from claimed_id
                if let Some(claimed_id) = params.get("openid.claimed_id") {
                    if let Some(steam_id) = claimed_id.split('/').last() {
                        info!("✅ Estratto SteamID dal callback: {}", steam_id);
                        *STEAM_CALLBACK_RESULT.blocking_lock() = Some(steam_id.to_string());
                    }
                }
            }
            
            // Send success response
            let html = r#"<!DOCTYPE html>
<html>
<head><title>GameStringer - Steam Login</title>
<style>
body { font-family: -apple-system, sans-serif; background: #1b2838; color: #fff; 
       display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
.card { background: #2a475e; padding: 40px; border-radius: 12px; text-align: center; }
h1 { color: #66c0f4; margin-bottom: 10px; }
p { color: #c7d5e0; }
</style>
</head>
<body>
<div class="card">
<h1>✅ Login Steam completato!</h1>
<p>Puoi chiudere questa finestra e tornare a GameStringer.</p>
</div>
</body>
</html>"#;
            
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(),
                html
            );
            
            stream.write_all(response.as_bytes()).ok();
        }
    }
    
    info!("📡 Callback server chiuso");
}

/// 🔐 Verifica risposta Steam OpenID e ottieni SteamID
#[tauri::command]
pub async fn steam_openid_verify(params: HashMap<String, String>) -> Result<String, String> {
    info!("🔐 Verificando risposta Steam OpenID...");
    
    // Estrai claimed_id per ottenere lo SteamID
    let claimed_id = params.get("openid.claimed_id")
        .ok_or("Missing openid.claimed_id")?;
    
    // Il claimed_id ha formato: https://steamcommunity.com/openid/id/76561198xxxxxxxxx
    let steam_id = claimed_id
        .split('/')
        .last()
        .ok_or("Invalid claimed_id format")?
        .to_string();
    
    // Verifica con Steam che la risposta sia autentica
    let client = reqwest::Client::new();
    
    let mut verify_params: HashMap<String, String> = params.clone();
    verify_params.insert("openid.mode".to_string(), "check_authentication".to_string());
    
    let response = client
        .post("https://steamcommunity.com/openid/login")
        .form(&verify_params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let body = response.text().await.map_err(|e| format!("Read failed: {}", e))?;
    
    if body.contains("is_valid:true") {
        info!("✅ Steam OpenID verificato! SteamID: {}", steam_id);
        Ok(steam_id)
    } else {
        warn!("❌ Steam OpenID verifica fallita");
        Err("OpenID verification failed".to_string())
    }
}

/// 🔐 Ottieni info profilo Steam da SteamID
#[tauri::command]
pub async fn steam_get_user_profile(steam_id: String, api_key: Option<String>) -> Result<SteamUser, String> {
    info!("🔐 Recuperando profilo Steam per: {}", steam_id);
    
    // Se abbiamo API key, usa l'API ufficiale
    if let Some(key) = api_key {
        if !key.is_empty() {
            let url = format!(
                "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key={}&steamids={}",
                key, steam_id
            );
            
            let client = reqwest::Client::new();
            let response = client.get(&url).send().await
                .map_err(|e| format!("Request failed: {}", e))?;
            
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await
                    .map_err(|e| format!("Parse failed: {}", e))?;
                
                if let Some(player) = json["response"]["players"].as_array().and_then(|p| p.first()) {
                    return Ok(SteamUser {
                        steam_id: steam_id.clone(),
                        persona_name: player["personaname"].as_str().unwrap_or("Unknown").to_string(),
                        avatar: player["avatar"].as_str().unwrap_or("").to_string(),
                        avatar_full: player["avatarfull"].as_str().unwrap_or("").to_string(),
                        profile_url: player["profileurl"].as_str().unwrap_or("").to_string(),
                    });
                }
            }
        }
    }
    
    // Fallback: profilo base senza API key
    Ok(SteamUser {
        steam_id: steam_id.clone(),
        persona_name: format!("Steam User {}", &steam_id[steam_id.len().saturating_sub(4)..]),
        avatar: "".to_string(),
        avatar_full: "".to_string(),
        profile_url: format!("https://steamcommunity.com/profiles/{}", steam_id),
    })
}

/// 🔐 Salva credenziali Steam autenticate
#[tauri::command]
pub async fn steam_save_auth(steam_id: String, persona_name: String) -> Result<(), String> {
    use std::fs;
    
    info!("💾 Salvando autenticazione Steam per: {} ({})", persona_name, steam_id);
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let gs_dir = data_dir.join("GameStringer");
        fs::create_dir_all(&gs_dir).map_err(|e| format!("Cannot create dir: {}", e))?;
        
        let auth_file = gs_dir.join("steam_auth.json");
        let auth_data = serde_json::json!({
            "steam_id": steam_id,
            "persona_name": persona_name,
            "authenticated_at": chrono::Utc::now().to_rfc3339()
        });
        
        fs::write(&auth_file, serde_json::to_string_pretty(&auth_data).unwrap())
            .map_err(|e| format!("Cannot write file: {}", e))?;
        
        info!("✅ Autenticazione salvata in {:?}", auth_file);
        Ok(())
    } else {
        Err("Cannot find data directory".to_string())
    }
}

/// 🔐 Carica credenziali Steam salvate
#[tauri::command]
pub async fn steam_load_auth() -> Result<Option<SteamUser>, String> {
    use std::fs;
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let auth_file = data_dir.join("GameStringer").join("steam_auth.json");
        
        if auth_file.exists() {
            let json = fs::read_to_string(&auth_file)
                .map_err(|e| format!("Read failed: {}", e))?;
            
            let data: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| format!("Parse failed: {}", e))?;
            
            let steam_id = data["steam_id"].as_str().unwrap_or("").to_string();
            let persona_name = data["persona_name"].as_str().unwrap_or("").to_string();
            
            if !steam_id.is_empty() {
                info!("✅ Caricata autenticazione Steam: {} ({})", persona_name, steam_id);
                return Ok(Some(SteamUser {
                    steam_id,
                    persona_name,
                    avatar: "".to_string(),
                    avatar_full: "".to_string(),
                    profile_url: "".to_string(),
                }));
            }
        }
    }
    
    Ok(None)
}

/// 🎮 Importa wishlist Steam
#[tauri::command]
pub async fn steam_get_wishlist(steam_id: String) -> Result<Vec<WishlistGame>, String> {
    info!("🎮 Importando wishlist Steam per: {}", steam_id);
    
    // Prova prima con profiles/ poi con id/
    let urls = vec![
        format!("https://store.steampowered.com/wishlist/profiles/{}/wishlistdata/?p=0", steam_id),
        format!("https://store.steampowered.com/wishlist/id/{}/wishlistdata/?p=0", steam_id),
    ];
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    
    let mut last_error = String::new();
    
    for url in &urls {
        info!("🔍 Tentativo URL: {}", url);
        
        let response = match client.get(url)
            .header("Accept", "application/json")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await {
                Ok(r) => r,
                Err(e) => {
                    last_error = format!("Request failed: {}", e);
                    continue;
                }
            };
        
        if response.status().is_success() {
            // Prova a parsare la risposta
            let json: serde_json::Value = match response.json().await {
                Ok(j) => j,
                Err(e) => {
                    last_error = format!("Parse failed: {}", e);
                    continue;
                }
            };
            
            // Processa la wishlist
            let mut wishlist = Vec::new();
            
            if let Some(obj) = json.as_object() {
                for (app_id, game_data) in obj {
                    if let Ok(id) = app_id.parse::<u32>() {
                        let name = game_data["name"].as_str().unwrap_or("Unknown").to_string();
                        let priority = game_data["priority"].as_u64().unwrap_or(0) as u32;
                        let added = game_data["added"].as_u64().unwrap_or(0);
                        
                        wishlist.push(WishlistGame {
                            app_id: id,
                            name,
                            priority,
                            added_timestamp: added,
                        });
                    }
                }
            }
            
            wishlist.sort_by(|a, b| a.priority.cmp(&b.priority));
            info!("✅ Importati {} giochi dalla wishlist", wishlist.len());
            return Ok(wishlist);
        } else if response.status() == 403 {
            last_error = "La wishlist Steam è privata o non accessibile. Verifica che sia impostata su 'Pubblico' nelle impostazioni privacy di Steam.".to_string();
        } else {
            last_error = format!("Steam API error: {}", response.status());
        }
    }
    
    Err(last_error)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WishlistGame {
    pub app_id: u32,
    pub name: String,
    pub priority: u32,
    pub added_timestamp: u64,
}

/// 🔐 Logout Steam - rimuovi credenziali salvate
#[tauri::command]
pub async fn steam_logout() -> Result<(), String> {
    use std::fs;
    
    info!("🔐 Logout Steam...");
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let auth_file = data_dir.join("GameStringer").join("steam_auth.json");
        
        if auth_file.exists() {
            fs::remove_file(&auth_file)
                .map_err(|e| format!("Cannot delete: {}", e))?;
            info!("✅ Credenziali Steam rimosse");
        }
    }
    
    Ok(())
}
