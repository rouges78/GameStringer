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
    log::info!("🕐 HowLongToBeat temporaneamente disabilitato per: {}", game_name);
    
    // HLTB API ha cambiato formato, la libreria non è aggiornata
    // Disabilitato temporaneamente fino a quando non sarà disponibile una soluzione
    Ok(serde_json::json!({
        "found": false,
        "message": "HowLongToBeat temporaneamente non disponibile",
        "url": format!("https://howlongtobeat.com/?q={}", urlencoding::encode(&game_name))
    }))
}

#[tauri::command]
pub async fn get_steamgriddb_artwork(app_id: String, artwork_type: String) -> Result<serde_json::Value, String> {
    log::info!("🎨 Ricerca artwork SteamGridDB per AppID: {} (tipo: {})", app_id, artwork_type);
    
    // TODO: Implementare integrazione con SteamGridDB API
    // Per ora restituiamo un placeholder
    let response = serde_json::json!({
        "found": false,
        "message": "Servizio SteamGridDB non ancora implementato",
        "artwork_type": artwork_type,
        "app_id": app_id
    });
    
    log::warn!("⚠️ SteamGridDB non ancora implementato");
    Ok(response)
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
    log::info!("📊 Recupero statistiche cache (sistema cache intelligente rimosso)");
    
    // Sistema cache intelligente rimosso per cleanup warning (Task 4.2)
    // Manteniamo solo statistiche base per compatibilità
    let stats = serde_json::json!({
        "cache_system_status": "removed",
        "translation_cache_active": true,
        "intelligent_cache_active": false,
        "note": "Sistema cache intelligente rimosso per cleanup warning"
    });
    
    log::info!("✅ Statistiche cache base recuperate");
    Ok(stats)
}

#[tauri::command]
pub async fn check_path_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    let exists = Path::new(&path).exists();
    log::debug!("🔍 Check path exists: {} = {}", path, exists);
    Ok(exists)
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
