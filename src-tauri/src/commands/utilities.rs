use serde_json;

#[tauri::command]
pub async fn get_howlongtobeat_info(game_name: String) -> Result<serde_json::Value, String> {
    log::info!("🕐 Ricerca HowLongToBeat per: {}", game_name);
    
    // TODO: Implementare integrazione con HowLongToBeat API
    // Per ora restituiamo un placeholder
    let response = serde_json::json!({
        "found": false,
        "message": "Servizio HowLongToBeat non ancora implementato"
    });
    
    log::warn!("⚠️ HowLongToBeat non ancora implementato");
    Ok(response)
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
    log::info!("📊 Recupero statistiche cache");
    
    // TODO: Implementare statistiche reali della cache
    let stats = serde_json::json!({
        "steam_games_cached": 0,
        "game_details_cached": 0,
        "howlongtobeat_cached": 0,
        "steamgriddb_cached": 0,
        "total_cache_size_mb": 0.0,
        "last_cleanup": null,
        "cache_hit_rate": 0.0
    });
    
    log::info!("✅ Statistiche cache recuperate");
    Ok(stats)
}
