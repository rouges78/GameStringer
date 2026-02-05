use serde_json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct HltbSearchRequest {
    #[serde(rename = "searchType")]
    search_type: String,
    #[serde(rename = "searchTerms")]
    search_terms: Vec<String>,
    #[serde(rename = "searchPage")]
    search_page: i32,
    size: i32,
    #[serde(rename = "searchOptions")]
    search_options: HltbSearchOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct HltbSearchOptions {
    games: HltbGamesOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct HltbGamesOptions {
    #[serde(rename = "userId")]
    user_id: i32,
    platform: String,
    #[serde(rename = "sortCategory")]
    sort_category: String,
    #[serde(rename = "rangeCategory")]
    range_category: String,
    #[serde(rename = "rangeTime")]
    range_time: HltbRangeTime,
    gameplay: HltbGameplay,
    modifier: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct HltbRangeTime {
    min: i32,
    max: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct HltbGameplay {
    perspective: String,
    flow: String,
    genre: String,
}

#[tauri::command]
pub async fn get_howlongtobeat_info(game_name: String) -> Result<serde_json::Value, String> {
    log::info!("🕐 HowLongToBeat ricerca per: {}", game_name);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    
    // Metodo 1: Scraping HTML della pagina di ricerca (come HLTB for Deck)
    let search_url = format!(
        "https://howlongtobeat.com/?q={}",
        urlencoding::encode(&game_name)
    );
    
    let response = client
        .get(&search_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.5")
        .send()
        .await
        .map_err(|e| format!("Errore richiesta HLTB: {}", e))?;
    
    let status = response.status();
    log::info!("🕐 HLTB HTML response status: {}", status);
    
    if !status.is_success() {
        log::warn!("⚠️ HLTB risposta non OK: {}", status);
        return Ok(serde_json::json!({
            "found": false,
            "message": format!("HowLongToBeat non disponibile ({})", status),
            "url": search_url
        }));
    }
    
    let html = response.text().await
        .map_err(|e| format!("Errore lettura HLTB: {}", e))?;
    
    // Parse HTML per estrarre i dati (cerca pattern nei data attributes o nel JSON embedded)
    // Pattern: cerca "comp_main":XXX, "comp_plus":XXX, "comp_100":XXX nel HTML/JS
    
    // Cerca il primo game_id nel HTML
    let game_id_regex = regex::Regex::new(r#"game_id["\s:]+(\d+)"#).ok();
    let game_id = game_id_regex.and_then(|re| {
        re.captures(&html).and_then(|cap| cap.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0)))
    }).unwrap_or(0);
    
    if game_id == 0 {
        // Prova pattern alternativo per link al gioco
        let link_regex = regex::Regex::new(r#"/game/(\d+)"#).ok();
        let alt_game_id = link_regex.and_then(|re| {
            re.captures(&html).and_then(|cap| cap.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0)))
        }).unwrap_or(0);
        
        if alt_game_id > 0 {
            // Fetch pagina specifica del gioco per dati completi
            return fetch_hltb_game_page(&client, alt_game_id, &game_name).await;
        }
        
        log::info!("ℹ️ HLTB nessun risultato per: {}", game_name);
        return Ok(serde_json::json!({
            "found": false,
            "url": search_url
        }));
    }
    
    // Fetch pagina specifica del gioco
    fetch_hltb_game_page(&client, game_id, &game_name).await
}

async fn fetch_hltb_game_page(client: &reqwest::Client, game_id: i64, game_name: &str) -> Result<serde_json::Value, String> {
    let game_url = format!("https://howlongtobeat.com/game/{}", game_id);
    
    let response = client
        .get(&game_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("Errore fetch game page: {}", e))?;
    
    if !response.status().is_success() {
        return Ok(serde_json::json!({
            "found": false,
            "url": game_url
        }));
    }
    
    let html = response.text().await.unwrap_or_default();
    
    // Estrai i tempi dal HTML - cerca pattern come "Main Story" seguito da ore
    // Pattern tipico: <div>Main Story</div>...<div>X Hours</div>
    
    let extract_hours = |label: &str, html: &str| -> i64 {
        // Cerca pattern: label seguito da numero + "Hours" o "½"
        let pattern = format!(r#"{}[^0-9]*?(\d+)\s*(?:½\s*)?Hours?"#, regex::escape(label));
        if let Ok(re) = regex::Regex::new(&pattern) {
            if let Some(cap) = re.captures(html) {
                return cap.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0)).unwrap_or(0);
            }
        }
        0
    };
    
    let main = extract_hours("Main Story", &html);
    let main_extra = extract_hours("Main \\+ Extras", &html).max(extract_hours("Main Story \\+ Extras", &html));
    let completionist = extract_hours("Completionist", &html).max(extract_hours("100%", &html));
    let all_styles = extract_hours("All Styles", &html).max(extract_hours("All PlayStyles", &html));
    
    // Se non trova con regex, cerca pattern JSON embedded
    let (main, main_extra, completionist, all_styles) = if main == 0 && main_extra == 0 {
        // Cerca comp_main, comp_plus, comp_100, comp_all nel HTML (potrebbero essere in JSON)
        let comp_main = regex::Regex::new(r#"comp_main["\s:]+(\d+)"#).ok()
            .and_then(|re| re.captures(&html).and_then(|c| c.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0) / 3600)))
            .unwrap_or(0);
        let comp_plus = regex::Regex::new(r#"comp_plus["\s:]+(\d+)"#).ok()
            .and_then(|re| re.captures(&html).and_then(|c| c.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0) / 3600)))
            .unwrap_or(0);
        let comp_100 = regex::Regex::new(r#"comp_100["\s:]+(\d+)"#).ok()
            .and_then(|re| re.captures(&html).and_then(|c| c.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0) / 3600)))
            .unwrap_or(0);
        let comp_all = regex::Regex::new(r#"comp_all["\s:]+(\d+)"#).ok()
            .and_then(|re| re.captures(&html).and_then(|c| c.get(1).map(|m| m.as_str().parse::<i64>().unwrap_or(0) / 3600)))
            .unwrap_or(0);
        (comp_main, comp_plus, comp_100, comp_all)
    } else {
        (main, main_extra, completionist, all_styles)
    };
    
    if main > 0 || main_extra > 0 || completionist > 0 || all_styles > 0 {
        log::info!("✅ HLTB trovato: {} - Main: {}h, Extra: {}h, 100%: {}h, All: {}h", 
            game_name, main, main_extra, completionist, all_styles);
        
        return Ok(serde_json::json!({
            "found": true,
            "game_name": game_name,
            "main": main,
            "main_extra": main_extra,
            "completionist": completionist,
            "all_styles": all_styles,
            "url": game_url
        }));
    }
    
    log::info!("ℹ️ HLTB pagina trovata ma senza tempi per: {}", game_name);
    Ok(serde_json::json!({
        "found": false,
        "url": game_url
    }))
}

#[tauri::command]
pub async fn get_steamgriddb_artwork(app_id: String, artwork_type: String, api_key: Option<String>) -> Result<serde_json::Value, String> {
    log::info!("🎨 Ricerca artwork SteamGridDB per AppID: {} (tipo: {})", app_id, artwork_type);
    
    let api_key = match api_key {
        Some(key) if !key.is_empty() => key,
        _ => {
            return Ok(serde_json::json!({
                "found": false,
                "message": "API Key SteamGridDB non configurata"
            }));
        }
    };
    
    let client = reqwest::Client::new();
    
    // Prima cerca il game_id tramite Steam AppID
    let search_url = format!("https://www.steamgriddb.com/api/v2/games/steam/{}", app_id);
    let search_response = client
        .get(&search_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Errore ricerca SteamGridDB: {}", e))?;
    
    if !search_response.status().is_success() {
        log::warn!("⚠️ SteamGridDB game non trovato per AppID: {}", app_id);
        return Ok(serde_json::json!({
            "found": false,
            "message": "Gioco non trovato su SteamGridDB"
        }));
    }
    
    let game_data: serde_json::Value = search_response.json().await
        .map_err(|e| format!("Errore parsing SteamGridDB: {}", e))?;
    
    let game_id = game_data.get("data")
        .and_then(|d| d.get("id"))
        .and_then(|id| id.as_i64())
        .ok_or("Game ID non trovato")?;
    
    // Ora cerca l'artwork del tipo richiesto
    let artwork_endpoint = match artwork_type.as_str() {
        "grid" => "grids",
        "hero" => "heroes",
        "logo" => "logos",
        "icon" => "icons",
        _ => "grids"
    };
    
    let artwork_url = format!("https://www.steamgriddb.com/api/v2/{}/game/{}", artwork_endpoint, game_id);
    let artwork_response = client
        .get(&artwork_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Errore artwork SteamGridDB: {}", e))?;
    
    if !artwork_response.status().is_success() {
        return Ok(serde_json::json!({
            "found": false,
            "message": "Artwork non trovato"
        }));
    }
    
    let artwork_data: serde_json::Value = artwork_response.json().await
        .map_err(|e| format!("Errore parsing artwork: {}", e))?;
    
    if let Some(artworks) = artwork_data.get("data").and_then(|d| d.as_array()) {
        if let Some(first) = artworks.first() {
            let url = first.get("url").and_then(|u| u.as_str()).unwrap_or("");
            let thumb = first.get("thumb").and_then(|t| t.as_str()).unwrap_or(url);
            
            log::info!("✅ SteamGridDB artwork trovato: {}", url);
            return Ok(serde_json::json!({
                "found": true,
                "url": url,
                "thumb": thumb,
                "artwork_type": artwork_type,
                "game_id": game_id,
                "total_results": artworks.len()
            }));
        }
    }
    
    Ok(serde_json::json!({
        "found": false,
        "message": "Nessun artwork disponibile"
    }))
}

#[tauri::command]
pub async fn get_preferences(
    profile_manager_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>,
    settings_state: tauri::State<'_, crate::commands::profile_settings::ProfileSettingsManagerState>,
) -> Result<serde_json::Value, String> {
    log::info!("⚙️ Recupero preferenze utente");
    
    // Prova a ottenere le preferenze dal profilo corrente
    let profile_manager = profile_manager_state.manager.lock().await;
    let current_profile = profile_manager.current_profile();
    
    if let Some(profile) = current_profile {
        // Carica settings dal profilo corrente
        let settings_manager = settings_state.manager.lock().await;
        match settings_manager.load_profile_settings(&profile.id).await {
            Ok(profile_settings) => {
                let preferences = settings_manager.profile_settings_to_legacy_format(&profile_settings);
                log::info!("✅ Preferenze caricate dal profilo: {}", profile.name);
                return Ok(preferences);
            },
            Err(e) => {
                log::warn!("⚠️ Errore caricamento settings profilo: {}", e);
            }
        }
    }
    
    // Fallback a preferenze di default se non c'è profilo attivo
    let default_preferences = serde_json::json!({
        "language": "it",
        "theme": "dark",
        "auto_scan": true,
        "cache_enabled": true,
        "cache_duration_hours": 24,
        "steam_api_key": "",
        "steamgriddb_api_key": "",
        "howlongtobeat_enabled": true,
        "notifications_enabled": true,
        "auto_update_check": true
    });
    
    log::info!("✅ Preferenze caricate (default - nessun profilo attivo)");
    Ok(default_preferences)
}

#[tauri::command]
pub async fn update_preferences(
    preferences: serde_json::Value,
    profile_manager_state: tauri::State<'_, crate::commands::profiles::ProfileManagerState>,
    settings_state: tauri::State<'_, crate::commands::profile_settings::ProfileSettingsManagerState>,
) -> Result<(), String> {
    log::info!("💾 Aggiornamento preferenze utente");
    
    // Prova a salvare le preferenze nel profilo corrente
    let profile_manager = profile_manager_state.manager.lock().await;
    let current_profile = profile_manager.current_profile();
    
    if let Some(profile) = current_profile {
        let settings_manager = settings_state.manager.lock().await;
        
        // Carica settings attuali del profilo
        let mut profile_settings = match settings_manager.load_profile_settings(&profile.id).await {
            Ok(settings) => settings,
            Err(_) => crate::profiles::models::ProfileSettings::default(),
        };
        
        // Aggiorna settings con i nuovi valori
        if let Some(language) = preferences.get("language").and_then(|v| v.as_str()) {
            profile_settings.language = language.to_string();
        }
        
        if let Some(theme_str) = preferences.get("theme").and_then(|v| v.as_str()) {
            profile_settings.theme = match theme_str {
                "light" => crate::profiles::models::Theme::Light,
                "dark" => crate::profiles::models::Theme::Dark,
                "auto" => crate::profiles::models::Theme::Auto,
                _ => profile_settings.theme,
            };
        }
        
        if let Some(auto_scan) = preferences.get("auto_scan").and_then(|v| v.as_bool()) {
            profile_settings.game_library.auto_refresh = auto_scan;
        }
        
        if let Some(notifications) = preferences.get("notifications_enabled").and_then(|v| v.as_bool()) {
            profile_settings.notifications.desktop_enabled = notifications;
            profile_settings.notifications.sound_enabled = notifications;
        }
        
        // Aggiorna settings specifici del profilo se presenti
        if let Some(profile_prefs) = preferences.get("profile_settings") {
            if let Some(auto_login) = profile_prefs.get("auto_login").and_then(|v| v.as_bool()) {
                profile_settings.auto_login = auto_login;
            }
            
            if let Some(timeout) = profile_prefs.get("session_timeout").and_then(|v| v.as_u64()) {
                profile_settings.security.session_timeout = timeout as u32;
            }
            
            if let Some(view_str) = profile_prefs.get("library_view").and_then(|v| v.as_str()) {
                profile_settings.game_library.default_view = match view_str {
                    "grid" => crate::profiles::models::LibraryView::Grid,
                    "list" => crate::profiles::models::LibraryView::List,
                    _ => profile_settings.game_library.default_view,
                };
            }
            
            if let Some(sort_str) = profile_prefs.get("library_sort").and_then(|v| v.as_str()) {
                profile_settings.game_library.default_sort = match sort_str {
                    "alphabetical" => crate::profiles::models::LibrarySort::Alphabetical,
                    "last_played" => crate::profiles::models::LibrarySort::LastPlayed,
                    "recently_added" => crate::profiles::models::LibrarySort::RecentlyAdded,
                    "platform" => crate::profiles::models::LibrarySort::Platform,
                    _ => profile_settings.game_library.default_sort,
                };
            }
        }
        
        // Salva settings aggiornati
        match settings_manager.save_profile_settings(&profile.id, &profile_settings).await {
            Ok(_) => {
                log::info!("✅ Preferenze salvate nel profilo: {}", profile.name);
                return Ok(());
            },
            Err(e) => {
                log::error!("❌ Errore salvataggio settings profilo: {}", e);
                return Err(format!("Errore salvataggio settings: {}", e));
            }
        }
    }
    
    // Se non c'è profilo attivo, logga solo le preferenze
    log::info!("📝 Nuove preferenze ricevute (nessun profilo attivo): {}", preferences);
    log::warn!("⚠️ Nessun profilo attivo - preferenze non salvate");
    Ok(())
}

/// Salva impostazioni app su file persistente
#[tauri::command]
pub async fn save_app_settings(settings: serde_json::Value) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;
    
    // Usa directory fissa per GameStringer
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer");
    
    fs::create_dir_all(&app_dir).map_err(|e| format!("Errore creazione dir: {}", e))?;
    
    let settings_path = app_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    log::info!("✅ Impostazioni salvate in: {:?}", settings_path);
    Ok(())
}

/// Carica impostazioni app da file persistente
#[tauri::command]
pub async fn load_app_settings() -> Result<serde_json::Value, String> {
    use std::fs;
    use std::path::PathBuf;
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer");
    
    let settings_path = app_dir.join("settings.json");
    
    if !settings_path.exists() {
        log::info!("📂 Nessun file impostazioni trovato, uso default");
        return Ok(serde_json::json!({}));
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let settings: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    
    log::info!("✅ Impostazioni caricate da: {:?}", settings_path);
    Ok(settings)
}

#[tauri::command]
pub async fn clear_cache() -> Result<(), String> {
    log::info!("🧹 Pulizia cache");
    
    // TODO: Implementare pulizia cache per Steam, HowLongToBeat, SteamGridDB
    // Per ora simuliamo la pulizia
    
    log::info!("✅ Cache pulita (simulata)");
    Ok(())
}

#[tauri::command]
pub async fn get_cache_stats() -> Result<serde_json::Value, String> {
    use std::fs;
    
    log::info!("📊 Recupero statistiche cache e spazio disco");
    
    let mut stats = serde_json::json!({
        "cache_size_mb": 0.0,
        "cover_count": 0,
        "disk_free_gb": 0.0,
        "disk_total_gb": 0.0,
        "app_data_size_mb": 0.0
    });
    
    if let Some(data_dir) = dirs::data_local_dir() {
        let gs_dir = data_dir.join("GameStringer");
        
        // Calcola dimensione totale cartella GameStringer
        if gs_dir.exists() {
            let total_size = calculate_dir_size(&gs_dir);
            stats["app_data_size_mb"] = serde_json::json!((total_size as f64) / (1024.0 * 1024.0));
        }
        
        // Conta cover in cache
        let cover_cache = gs_dir.join("covers").join("cover_cache.json");
        if cover_cache.exists() {
            if let Ok(json) = fs::read_to_string(&cover_cache) {
                if let Ok(cache) = serde_json::from_str::<std::collections::HashMap<String, String>>(&json) {
                    stats["cover_count"] = serde_json::json!(cache.len());
                }
            }
        }
        
        // Dimensione cartella covers
        let covers_dir = gs_dir.join("covers");
        if covers_dir.exists() {
            let size = calculate_dir_size(&covers_dir);
            stats["cache_size_mb"] = serde_json::json!((size as f64) / (1024.0 * 1024.0));
        }
        
        // Spazio disco Windows
        #[cfg(windows)]
        {
            let path = data_dir.to_string_lossy();
            let drive = if path.len() >= 2 { &path[0..2] } else { "C:" };
            
            if let Ok(output) = std::process::Command::new("wmic")
                .args(["logicaldisk", "where", &format!("DeviceID='{}'", drive), "get", "FreeSpace,Size", "/format:csv"])
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines().skip(1) {
                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 3 {
                        if let (Ok(free), Ok(total)) = (parts[1].trim().parse::<u64>(), parts[2].trim().parse::<u64>()) {
                            stats["disk_free_gb"] = serde_json::json!((free as f64) / (1024.0 * 1024.0 * 1024.0));
                            stats["disk_total_gb"] = serde_json::json!((total as f64) / (1024.0 * 1024.0 * 1024.0));
                        }
                    }
                }
            }
        }
    }
    
    log::info!("✅ Statistiche cache recuperate: {:?}", stats);
    Ok(stats)
}

fn calculate_dir_size(path: &std::path::Path) -> u64 {
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    size += metadata.len();
                } else if metadata.is_dir() {
                    size += calculate_dir_size(&entry.path());
                }
            }
        }
    }
    size
}

#[tauri::command]
pub async fn check_path_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    let exists = Path::new(&path).exists();
    log::debug!("🔍 Check path exists: {} = {}", path, exists);
    Ok(exists)
}

/// 🔍 Trova file per estensione in una cartella (ricorsivo)
#[tauri::command]
pub async fn find_files_by_extension(folder_path: String, extension: String) -> Result<Vec<String>, String> {
    use std::path::Path;
    use walkdir::WalkDir;
    
    let folder = Path::new(&folder_path);
    if !folder.exists() {
        return Err(format!("Cartella non trovata: {}", folder_path));
    }
    
    let ext = extension.trim_start_matches('.');
    let mut files: Vec<String> = Vec::new();
    
    for entry in WalkDir::new(folder)
        .max_depth(5) // Limita profondità per performance
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(file_ext) = path.extension() {
                if file_ext.to_string_lossy().eq_ignore_ascii_case(ext) {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
    
    log::info!("🔍 Trovati {} file .{} in {}", files.len(), ext, folder_path);
    Ok(files)
}

#[tauri::command]
pub async fn create_directory_backup(source_path: String, backup_path: String) -> Result<(), String> {
    use std::path::Path;
    
    let source = Path::new(&source_path);
    let backup = Path::new(&backup_path);
    
    if !source.exists() {
        return Err(format!("Cartella sorgente non trovata: {}", source_path));
    }
    
    if backup.exists() {
        return Err("Backup già esistente. Elimina prima il backup esistente.".to_string());
    }
    
    log::info!("💾 Creazione backup: {} -> {}", source_path, backup_path);
    
    // Copy directory recursively
    copy_dir_recursive(source, backup).map_err(|e| format!("Errore copia: {}", e))?;
    
    log::info!("✅ Backup creato con successo");
    Ok(())
}

#[tauri::command]
pub async fn restore_directory_backup(backup_path: String, target_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    let backup = Path::new(&backup_path);
    let target = Path::new(&target_path);
    
    if !backup.exists() {
        return Err(format!("Backup non trovato: {}", backup_path));
    }
    
    log::info!("🔄 Ripristino backup: {} -> {}", backup_path, target_path);
    
    // Remove existing target if exists
    if target.exists() {
        fs::remove_dir_all(target).map_err(|e| format!("Errore rimozione target: {}", e))?;
    }
    
    // Copy backup to target
    copy_dir_recursive(backup, target).map_err(|e| format!("Errore ripristino: {}", e))?;
    
    log::info!("✅ Backup ripristinato con successo");
    Ok(())
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    use std::fs;
    
    fs::create_dir_all(dst)?;
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if ty.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    
    Ok(())
}

/// Ottiene gli achievement di un gioco Steam per un utente
#[tauri::command]
pub async fn get_steam_achievements(steam_id: String, app_id: String, api_key: String) -> Result<serde_json::Value, String> {
    log::info!("🏆 Recupero achievements Steam per AppID: {} (User: {})", app_id, steam_id);
    
    if api_key.is_empty() || steam_id.is_empty() {
        return Ok(serde_json::json!({
            "found": false,
            "message": "Steam API Key o Steam ID non configurati"
        }));
    }
    
    let client = reqwest::Client::new();
    
    // Ottieni achievements dell'utente per questo gioco
    let url = format!(
        "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key={}&steamid={}&appid={}",
        api_key, steam_id, app_id
    );
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Errore richiesta Steam: {}", e))?;
    
    if !response.status().is_success() {
        log::warn!("⚠️ Steam Achievements non disponibili per AppID: {}", app_id);
        return Ok(serde_json::json!({
            "found": false,
            "message": "Achievements non disponibili per questo gioco"
        }));
    }
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Errore parsing Steam: {}", e))?;
    
    if let Some(playerstats) = data.get("playerstats") {
        if let Some(achievements) = playerstats.get("achievements").and_then(|a| a.as_array()) {
            let total = achievements.len();
            let unlocked = achievements.iter()
                .filter(|a| a.get("achieved").and_then(|v| v.as_i64()).unwrap_or(0) == 1)
                .count();
            
            let game_name = playerstats.get("gameName").and_then(|n| n.as_str()).unwrap_or("Unknown");
            
            log::info!("✅ Achievements trovati: {}/{} per {}", unlocked, total, game_name);
            
            return Ok(serde_json::json!({
                "found": true,
                "game_name": game_name,
                "total": total,
                "unlocked": unlocked,
                "percentage": if total > 0 { (unlocked as f64 / total as f64 * 100.0).round() } else { 0.0 },
                "achievements": achievements
            }));
        }
    }
    
    Ok(serde_json::json!({
        "found": false,
        "message": "Nessun achievement trovato"
    }))
}

/// Ottiene le statistiche di tempo di gioco Steam
#[tauri::command]
pub async fn get_steam_playtime(steam_id: String, api_key: String) -> Result<serde_json::Value, String> {
    log::info!("⏱️ Recupero playtime Steam per User: {}", steam_id);
    
    if api_key.is_empty() || steam_id.is_empty() {
        return Ok(serde_json::json!({
            "found": false,
            "message": "Steam API Key o Steam ID non configurati"
        }));
    }
    
    let client = reqwest::Client::new();
    
    // Ottieni tutti i giochi con tempo di gioco
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&include_appinfo=1&include_played_free_games=1",
        api_key, steam_id
    );
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Errore richiesta Steam: {}", e))?;
    
    if !response.status().is_success() {
        log::warn!("⚠️ Steam Playtime non disponibile");
        return Ok(serde_json::json!({
            "found": false,
            "message": "Playtime non disponibile"
        }));
    }
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Errore parsing Steam: {}", e))?;
    
    if let Some(response_data) = data.get("response") {
        let game_count = response_data.get("game_count").and_then(|c| c.as_i64()).unwrap_or(0);
        
        if let Some(games) = response_data.get("games").and_then(|g| g.as_array()) {
            let total_playtime: i64 = games.iter()
                .map(|g| g.get("playtime_forever").and_then(|p| p.as_i64()).unwrap_or(0))
                .sum();
            
            // Ordina per tempo di gioco e prendi i top 10
            let mut games_sorted: Vec<_> = games.iter().collect();
            games_sorted.sort_by(|a, b| {
                let pa = a.get("playtime_forever").and_then(|p| p.as_i64()).unwrap_or(0);
                let pb = b.get("playtime_forever").and_then(|p| p.as_i64()).unwrap_or(0);
                pb.cmp(&pa)
            });
            
            let top_games: Vec<serde_json::Value> = games_sorted.iter().take(10).map(|g| {
                let name = g.get("name").and_then(|n| n.as_str()).unwrap_or("Unknown");
                let playtime = g.get("playtime_forever").and_then(|p| p.as_i64()).unwrap_or(0);
                let appid = g.get("appid").and_then(|a| a.as_i64()).unwrap_or(0);
                serde_json::json!({
                    "name": name,
                    "appid": appid,
                    "playtime_hours": playtime / 60,
                    "playtime_minutes": playtime % 60
                })
            }).collect();
            
            log::info!("✅ Playtime trovato: {} giochi, {} ore totali", game_count, total_playtime / 60);
            
            return Ok(serde_json::json!({
                "found": true,
                "total_games": game_count,
                "total_playtime_hours": total_playtime / 60,
                "total_playtime_minutes": total_playtime % 60,
                "top_games": top_games
            }));
        }
    }
    
    Ok(serde_json::json!({
        "found": false,
        "message": "Nessun dato playtime trovato"
    }))
}

/// Scansiona i file traducibili in una cartella di gioco
#[tauri::command]
pub async fn scan_translatable_files(game_path: String) -> Result<Vec<String>, String> {
    use std::path::Path;
    use walkdir::WalkDir;
    
    log::info!("🔍 Scansione file traducibili in: {}", game_path);
    
    let path = Path::new(&game_path);
    if !path.exists() {
        return Err(format!("Path non esistente: {}", game_path));
    }
    
    let translatable_extensions = [
        "json", "xml", "txt", "csv", "po", "pot", "resx", "xliff", "xlf",
        "yaml", "yml", "ini", "cfg", "lang", "loc", "strings", "properties",
        "srt", "vtt", "ass", "ssa", "sub",
        "lua", "rpy", "ks", "scn",
        "langdb", "landb", "dlog",
        "tres", "tscn", "translation"
    ];
    
    let mut found_files: Vec<String> = Vec::new();
    
    for entry in WalkDir::new(path)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if translatable_extensions.contains(&ext_lower.as_str()) {
                    if let Some(path_str) = entry.path().to_str() {
                        found_files.push(path_str.to_string());
                    }
                }
            }
        }
    }
    
    log::info!("✅ Trovati {} file traducibili", found_files.len());
    Ok(found_files)
}

/// Applica una patch di traduzione al gioco
#[tauri::command]
pub async fn apply_translation_patch(
    game_path: String,
    game_name: String,
    game_id: String,
) -> Result<bool, String> {
    use std::path::Path;
    use std::fs;
    
    log::info!("🎮 Applicando patch traduzione per: {} ({})", game_name, game_id);
    
    let path = Path::new(&game_path);
    if !path.exists() {
        return Err(format!("Path gioco non trovato: {}", game_path));
    }
    
    // Cerca cartella traduzioni salvate
    let app_data = dirs::data_local_dir()
        .ok_or("Impossibile trovare cartella dati locali")?;
    
    let translations_dir = app_data
        .join("GameStringer")
        .join("translations")
        .join(&game_id);
    
    if !translations_dir.exists() {
        log::warn!("⚠️ Nessuna traduzione salvata per {}", game_id);
        return Ok(false);
    }
    
    // Crea backup prima di applicare
    let backup_dir = app_data
        .join("GameStringer")
        .join("backups")
        .join(&game_id);
    
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Errore creazione backup: {}", e))?;
    }
    
    // Copia file tradotti nella cartella del gioco
    let mut applied_count = 0;
    for entry in walkdir::WalkDir::new(&translations_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let relative_path = entry.path()
                .strip_prefix(&translations_dir)
                .map_err(|e| e.to_string())?;
            
            let target_path = path.join(relative_path);
            
            // Backup file originale se esiste
            if target_path.exists() {
                let backup_path = backup_dir.join(relative_path);
                if let Some(parent) = backup_path.parent() {
                    fs::create_dir_all(parent).ok();
                }
                fs::copy(&target_path, &backup_path).ok();
            }
            
            // Copia file tradotto
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).ok();
            }
            
            fs::copy(entry.path(), &target_path)
                .map_err(|e| format!("Errore copia file: {}", e))?;
            
            applied_count += 1;
        }
    }
    
    log::info!("✅ Patch applicata: {} file copiati", applied_count);
    Ok(applied_count > 0)
}
