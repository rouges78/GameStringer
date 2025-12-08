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
    parent_appid: Option<u32>,
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
                parent_appid,
            });
        }
    }
    
    let dlc_count = app_info.values().filter(|a| a.is_dlc).count();
    let game_count = app_info.len() - dlc_count;
    info!("✅ Caricati {} giochi + {} DLC da appinfo.vdf", game_count, dlc_count);
    
    app_info
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
    
    // 1️⃣ GIOCHI INSTALLATI (steamlocate)
    info!("1️⃣ Scansione giochi installati...");
    if let Ok(libraries) = steam_dir.libraries() {
        for lib_result in libraries {
            if let Ok(library) = lib_result {
                for app_result in library.apps() {
                    if let Ok(app) = app_result {
                        let appid = app.app_id;
                        
                        // 🚫 SALTA DLC - verranno mostrati nella pagina del gioco
                        if is_dlc(appid) {
                            continue;
                        }
                        
                        let name = app.name.clone().unwrap_or_else(|| get_name(appid));
                        
                        // Salta tool e ridistribuibili
                        if name.contains("Redistributable") || name.contains("Runtime") || 
                           name.contains("Proton") || name.contains("Steam Linux") ||
                           name.contains("Steamworks") || name.contains("SDK") {
                            continue;
                        }
                        
                        all_games.insert(appid, GameInfo {
                            id: format!("steam_{}", appid),
                            title: name,
                            platform: "Steam".to_string(),
                            install_path: Some(app.install_dir.clone()),
                            executable_path: None,
                            icon: None,
                            image_url: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                            header_image: Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", appid)),
                            is_installed: true,
                            steam_app_id: Some(appid),
                            is_vr: false,
                            engine: None,
                            last_played: None,
                            is_shared: false,
                            supported_languages: None,
                            genres: None,
                        });
                    }
                }
            }
        }
    }
    info!("   ✅ Giochi installati: {}", all_games.len());
    
    // 2️⃣ GIOCHI DA LOCALCONFIG.VDF (tutti i giochi giocati/posseduti)
    info!("2️⃣ Scansione localconfig.vdf...");
    let userdata_path = steam_path.join("userdata");
    if userdata_path.exists() {
        if let Ok(entries) = fs::read_dir(&userdata_path) {
            for entry in entries.flatten() {
                let config_path = entry.path().join("config").join("localconfig.vdf");
                if config_path.exists() {
                    if let Ok(content) = fs::read_to_string(&config_path) {
                        // Cerca tutti gli appid nel file
                        let appid_regex = Regex::new(r#""(\d{4,7})"\s*\{"#).unwrap();
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
    info!("   ✅ Dopo localconfig: {}", all_games.len());
    
    // 3️⃣ GIOCHI DA SHAREDCONFIG.VDF (include family sharing)
    info!("3️⃣ Scansione sharedconfig.vdf (Family Sharing)...");
    if userdata_path.exists() {
        if let Ok(entries) = fs::read_dir(&userdata_path) {
            for entry in entries.flatten() {
                // Cerca in vari percorsi possibili
                let paths = vec![
                    entry.path().join("7").join("remote").join("sharedconfig.vdf"),
                    entry.path().join("config").join("sharedconfig.vdf"),
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

/// 📁 Trova il percorso reale di un gioco cercando in tutte le librerie Steam
#[tauri::command]
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
