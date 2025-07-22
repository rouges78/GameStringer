#[cfg(test)]
mod tests {
    use super::*;
    use crate::profiles::settings_manager::{ProfileSettingsManager, GlobalSettings, SettingsMigrationResult};
    use crate::profiles::models::{ProfileSettings, Theme, NotificationSettings, LibrarySettings, SecuritySettings, LibraryView, LibrarySort};
    use tempfile::TempDir;
    use tokio;

    async fn create_test_manager() -> (ProfileSettingsManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let manager = ProfileSettingsManager::new(temp_dir.path().to_path_buf()).unwrap();
        manager.initialize().await.unwrap();
        (manager, temp_dir)
    }

    #[tokio::test]
    async fn test_profile_settings_save_load() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let mut settings = ProfileSettings::default();
        settings.theme = Theme::Dark;
        settings.language = "en".to_string();
        settings.auto_login = true;
        
        // Salva settings
        manager.save_profile_settings("test_profile", &settings).await.unwrap();
        
        // Carica settings
        let loaded_settings = manager.load_profile_settings("test_profile").await.unwrap();
        
        assert_eq!(loaded_settings.theme, Theme::Dark);
        assert_eq!(loaded_settings.language, "en");
        assert_eq!(loaded_settings.auto_login, true);
    }

    #[tokio::test]
    async fn test_global_settings_save_load() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let mut global_settings = GlobalSettings::default();
        global_settings.last_profile = Some("test_profile".to_string());
        global_settings.auto_start_last_profile = true;
        global_settings.debug_mode = true;
        
        // Salva settings globali
        manager.save_global_settings(&global_settings).await.unwrap();
        
        // Carica settings globali
        let loaded_settings = manager.load_global_settings().await.unwrap();
        
        assert_eq!(loaded_settings.last_profile, Some("test_profile".to_string()));
        assert_eq!(loaded_settings.auto_start_last_profile, true);
        assert_eq!(loaded_settings.debug_mode, true);
    }

    #[tokio::test]
    async fn test_delete_profile_settings() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let settings = ProfileSettings::default();
        
        // Salva settings
        manager.save_profile_settings("test_profile", &settings).await.unwrap();
        
        // Verifica che esistano
        let loaded_settings = manager.load_profile_settings("test_profile").await.unwrap();
        assert_eq!(loaded_settings.language, settings.language);
        
        // Elimina settings
        manager.delete_profile_settings("test_profile").await.unwrap();
        
        // Verifica che siano stati eliminati (dovrebbe restituire default)
        let default_settings = manager.load_profile_settings("test_profile").await.unwrap();
        assert_eq!(default_settings.language, ProfileSettings::default().language);
    }

    #[tokio::test]
    async fn test_legacy_settings_migration() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let legacy_data = serde_json::json!({
            "language": "it",
            "theme": "dark",
            "auto_scan": true,
            "notifications_enabled": false
        });
        
        // Migra settings legacy
        let result = manager.migrate_legacy_settings(legacy_data).await.unwrap();
        
        assert!(result.created_profile.is_some());
        assert!(result.backup_path.is_some());
        assert!(result.migrated_settings.contains(&"language".to_string()));
        assert!(result.migrated_settings.contains(&"theme".to_string()));
        
        // Verifica che i settings siano stati migrati correttamente
        let profile_id = result.created_profile.unwrap();
        let migrated_settings = manager.load_profile_settings(&profile_id).await.unwrap();
        
        assert_eq!(migrated_settings.language, "it");
        assert_eq!(migrated_settings.theme, Theme::Dark);
        assert_eq!(migrated_settings.game_library.auto_refresh, true);
        assert_eq!(migrated_settings.notifications.desktop_enabled, false);
    }

    #[tokio::test]
    async fn test_profile_settings_to_legacy_format() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let mut settings = ProfileSettings::default();
        settings.theme = Theme::Light;
        settings.language = "fr".to_string();
        settings.auto_login = true;
        settings.game_library.default_view = LibraryView::List;
        settings.game_library.default_sort = LibrarySort::LastPlayed;
        
        let legacy_format = manager.profile_settings_to_legacy_format(&settings);
        
        assert_eq!(legacy_format["language"], "fr");
        assert_eq!(legacy_format["theme"], "light");
        assert_eq!(legacy_format["profile_settings"]["auto_login"], true);
        assert_eq!(legacy_format["profile_settings"]["library_view"], "list");
        assert_eq!(legacy_format["profile_settings"]["library_sort"], "last_played");
    }

    #[tokio::test]
    async fn test_list_profiles_with_settings() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let settings = ProfileSettings::default();
        
        // Crea alcuni profili con settings
        manager.save_profile_settings("profile1", &settings).await.unwrap();
        manager.save_profile_settings("profile2", &settings).await.unwrap();
        manager.save_profile_settings("profile3", &settings).await.unwrap();
        
        // Lista profili
        let profiles = manager.list_profiles_with_settings().await.unwrap();
        
        assert_eq!(profiles.len(), 3);
        assert!(profiles.contains(&"profile1".to_string()));
        assert!(profiles.contains(&"profile2".to_string()));
        assert!(profiles.contains(&"profile3".to_string()));
    }

    #[tokio::test]
    async fn test_load_nonexistent_profile_returns_default() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        // Carica settings per profilo inesistente
        let settings = manager.load_profile_settings("nonexistent").await.unwrap();
        
        // Dovrebbe restituire settings di default
        let default_settings = ProfileSettings::default();
        assert_eq!(settings.theme, default_settings.theme);
        assert_eq!(settings.language, default_settings.language);
        assert_eq!(settings.auto_login, default_settings.auto_login);
    }

    #[tokio::test]
    async fn test_complex_settings_roundtrip() {
        let (manager, _temp_dir) = create_test_manager().await;
        
        let mut settings = ProfileSettings::default();
        settings.theme = Theme::Auto;
        settings.language = "de".to_string();
        settings.auto_login = true;
        
        // Configura notifiche
        settings.notifications.desktop_enabled = true;
        settings.notifications.sound_enabled = false;
        settings.notifications.new_games = true;
        settings.notifications.updates = false;
        settings.notifications.deals = true;
        
        // Configura libreria
        settings.game_library.default_view = LibraryView::Grid;
        settings.game_library.default_sort = LibrarySort::Platform;
        settings.game_library.show_hidden = true;
        settings.game_library.auto_refresh = false;
        settings.game_library.refresh_interval = 60;
        
        // Configura sicurezza
        settings.security.session_timeout = 30;
        settings.security.require_password_for_sensitive = true;
        settings.security.auto_lock_failed_attempts = 5;
        settings.security.lock_duration = 15;
        
        // Salva e ricarica
        manager.save_profile_settings("complex_profile", &settings).await.unwrap();
        let loaded_settings = manager.load_profile_settings("complex_profile").await.unwrap();
        
        // Verifica tutti i campi
        assert_eq!(loaded_settings.theme, Theme::Auto);
        assert_eq!(loaded_settings.language, "de");
        assert_eq!(loaded_settings.auto_login, true);
        
        assert_eq!(loaded_settings.notifications.desktop_enabled, true);
        assert_eq!(loaded_settings.notifications.sound_enabled, false);
        assert_eq!(loaded_settings.notifications.new_games, true);
        assert_eq!(loaded_settings.notifications.updates, false);
        assert_eq!(loaded_settings.notifications.deals, true);
        
        assert_eq!(loaded_settings.game_library.default_view, LibraryView::Grid);
        assert_eq!(loaded_settings.game_library.default_sort, LibrarySort::Platform);
        assert_eq!(loaded_settings.game_library.show_hidden, true);
        assert_eq!(loaded_settings.game_library.auto_refresh, false);
        assert_eq!(loaded_settings.game_library.refresh_interval, 60);
        
        assert_eq!(loaded_settings.security.session_timeout, 30);
        assert_eq!(loaded_settings.security.require_password_for_sensitive, true);
        assert_eq!(loaded_settings.security.auto_lock_failed_attempts, 5);
        assert_eq!(loaded_settings.security.lock_duration, 15);
    }
}