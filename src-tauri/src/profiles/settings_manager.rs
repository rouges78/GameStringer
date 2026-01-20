// Modulo per gestione settings per profili
use crate::profiles::models::{ProfileSettings, Theme, LibraryView, LibrarySort};
use crate::profiles::errors::{ProfileError, ProfileResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tokio::fs;
use chrono::Utc;

/// Gestore settings per profili
#[derive(Debug)]
pub struct ProfileSettingsManager {
    /// Directory base per i settings
    settings_dir: PathBuf,
}

/// Settings globali dell'applicazione (non legati a profili)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSettings {
    /// Ultimo profilo utilizzato
    pub last_profile: Option<String>,
    /// Avvio automatico con ultimo profilo
    pub auto_start_last_profile: bool,
    /// Posizione finestra
    pub window_position: Option<WindowPosition>,
    /// Dimensioni finestra
    pub window_size: Option<WindowSize>,
    /// Impostazioni di debug
    pub debug_mode: bool,
    /// Percorso log personalizzato
    pub custom_log_path: Option<String>,
}

/// Posizione finestra
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

/// Dimensioni finestra
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

/// Settings legacy (formato precedente)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacySettings {
    pub language: Option<String>,
    pub theme: Option<String>,
    pub auto_scan: Option<bool>,
    pub cache_enabled: Option<bool>,
    pub cache_duration_hours: Option<u32>,
    pub steam_api_key: Option<String>,
    pub steamgriddb_api_key: Option<String>,
    pub howlongtobeat_enabled: Option<bool>,
    pub notifications_enabled: Option<bool>,
    pub auto_update_check: Option<bool>,
}

/// Risultato migrazione settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsMigrationResult {
    /// Settings migrati con successo
    pub migrated_settings: Vec<String>,
    /// Settings che hanno fallito la migrazione
    pub failed_settings: Vec<String>,
    /// Profilo creato per la migrazione
    pub created_profile: Option<String>,
    /// Backup creato
    pub backup_path: Option<String>,
}

impl ProfileSettingsManager {
    /// Crea nuovo gestore settings
    pub fn new(base_dir: PathBuf) -> ProfileResult<Self> {
        let settings_dir = base_dir.join("settings");
        
        Ok(Self {
            settings_dir,
        })
    }

    /// Inizializza directory settings
    pub async fn initialize(&self) -> ProfileResult<()> {
        if !self.settings_dir.exists() {
            fs::create_dir_all(&self.settings_dir).await
                .map_err(|e| ProfileError::IoError(e))?;
        }
        Ok(())
    }

    /// Carica settings per un profilo
    pub async fn load_profile_settings(&self, profile_id: &str) -> ProfileResult<ProfileSettings> {
        let settings_path = self.settings_dir.join(format!("{}.json", profile_id));
        
        if !settings_path.exists() {
            // Restituisce settings di default se il file non esiste
            return Ok(ProfileSettings::default());
        }

        let content = fs::read_to_string(&settings_path).await
            .map_err(|e| ProfileError::IoError(e))?;
            
        let settings: ProfileSettings = serde_json::from_str(&content)
            .map_err(|e| ProfileError::SerializationError(e))?;
            
        Ok(settings)
    }

    /// Salva settings per un profilo
    pub async fn save_profile_settings(&self, profile_id: &str, settings: &ProfileSettings) -> ProfileResult<()> {
        self.initialize().await?;
        
        let settings_path = self.settings_dir.join(format!("{}.json", profile_id));
        
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| ProfileError::SerializationError(e))?;
            
        fs::write(&settings_path, content).await
            .map_err(|e| ProfileError::IoError(e))?;
            
        Ok(())
    }

    /// Elimina settings per un profilo
    pub async fn delete_profile_settings(&self, profile_id: &str) -> ProfileResult<()> {
        let settings_path = self.settings_dir.join(format!("{}.json", profile_id));
        
        if settings_path.exists() {
            fs::remove_file(&settings_path).await
                .map_err(|e| ProfileError::IoError(e))?;
        }
        
        Ok(())
    }

    /// Carica settings globali
    pub async fn load_global_settings(&self) -> ProfileResult<GlobalSettings> {
        let global_path = self.settings_dir.join("global.json");
        
        if !global_path.exists() {
            return Ok(GlobalSettings::default());
        }

        let content = fs::read_to_string(&global_path).await
            .map_err(|e| ProfileError::IoError(e))?;
            
        let settings: GlobalSettings = serde_json::from_str(&content)
            .map_err(|e| ProfileError::SerializationError(e))?;
            
        Ok(settings)
    }

    /// Salva settings globali
    pub async fn save_global_settings(&self, settings: &GlobalSettings) -> ProfileResult<()> {
        self.initialize().await?;
        
        let global_path = self.settings_dir.join("global.json");
        
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| ProfileError::SerializationError(e))?;
            
        fs::write(&global_path, content).await
            .map_err(|e| ProfileError::IoError(e))?;
            
        Ok(())
    }

    /// Migra settings legacy al nuovo sistema
    pub async fn migrate_legacy_settings(&self, legacy_data: Value) -> ProfileResult<SettingsMigrationResult> {
        let mut result = SettingsMigrationResult {
            migrated_settings: Vec::new(),
            failed_settings: Vec::new(),
            created_profile: None,
            backup_path: None,
        };

        // Crea backup dei settings legacy
        let backup_path = self.settings_dir.join(format!("legacy_backup_{}.json", Utc::now().timestamp()));
        let backup_content = serde_json::to_string_pretty(&legacy_data)
            .map_err(|e| ProfileError::SerializationError(e))?;
        
        fs::write(&backup_path, backup_content).await
            .map_err(|e| ProfileError::IoError(e))?;
        
        result.backup_path = Some(backup_path.to_string_lossy().to_string());

        // Converte settings legacy in ProfileSettings
        let legacy_settings: LegacySettings = serde_json::from_value(legacy_data)
            .unwrap_or_default();

        let mut profile_settings = ProfileSettings::default();

        // Migra tema
        if let Some(theme_str) = legacy_settings.theme {
            match theme_str.as_str() {
                "light" => {
                    profile_settings.theme = Theme::Light;
                    result.migrated_settings.push("theme".to_string());
                },
                "dark" => {
                    profile_settings.theme = Theme::Dark;
                    result.migrated_settings.push("theme".to_string());
                },
                "auto" => {
                    profile_settings.theme = Theme::Auto;
                    result.migrated_settings.push("theme".to_string());
                },
                _ => result.failed_settings.push("theme".to_string()),
            }
        }

        // Migra lingua
        if let Some(language) = legacy_settings.language {
            profile_settings.language = language;
            result.migrated_settings.push("language".to_string());
        }

        // Migra impostazioni notifiche
        if let Some(notifications_enabled) = legacy_settings.notifications_enabled {
            profile_settings.notifications.desktop_enabled = notifications_enabled;
            profile_settings.notifications.sound_enabled = notifications_enabled;
            result.migrated_settings.push("notifications".to_string());
        }

        // Migra impostazioni libreria
        if let Some(auto_scan) = legacy_settings.auto_scan {
            profile_settings.game_library.auto_refresh = auto_scan;
            result.migrated_settings.push("auto_scan".to_string());
        }

        // Salva settings migrati come profilo default
        let default_profile_id = "default";
        self.save_profile_settings(default_profile_id, &profile_settings).await?;
        result.created_profile = Some(default_profile_id.to_string());

        // Crea settings globali
        let mut global_settings = GlobalSettings::default();
        global_settings.last_profile = Some(default_profile_id.to_string());
        self.save_global_settings(&global_settings).await?;

        Ok(result)
    }

    /// Converte ProfileSettings in formato compatibile con utilities.rs
    pub fn profile_settings_to_legacy_format(&self, settings: &ProfileSettings) -> Value {
        serde_json::json!({
            "language": settings.language,
            "theme": match settings.theme {
                Theme::Light => "light",
                Theme::Dark => "dark",
                Theme::Auto => "auto",
            },
            "auto_scan": settings.game_library.auto_refresh,
            "cache_enabled": true, // Default
            "cache_duration_hours": 24, // Default
            "steam_api_key": "", // Da gestire separatamente
            "steamgriddb_api_key": "", // Da gestire separatamente
            "howlongtobeat_enabled": true, // Default
            "notifications_enabled": settings.notifications.desktop_enabled,
            "auto_update_check": true, // Default
            // Aggiungi nuove impostazioni specifiche del profilo
            "profile_settings": {
                "auto_login": settings.auto_login,
                "session_timeout": settings.security.session_timeout,
                "library_view": match settings.game_library.default_view {
                    LibraryView::Grid => "grid",
                    LibraryView::List => "list",
                },
                "library_sort": match settings.game_library.default_sort {
                    LibrarySort::Alphabetical => "alphabetical",
                    LibrarySort::LastPlayed => "last_played",
                    LibrarySort::RecentlyAdded => "recently_added",
                    LibrarySort::Platform => "platform",
                },
                "show_hidden_games": settings.game_library.show_hidden,
                "refresh_interval": settings.game_library.refresh_interval,
                "security": {
                    "require_password_for_sensitive": settings.security.require_password_for_sensitive,
                    "auto_lock_failed_attempts": settings.security.auto_lock_failed_attempts,
                    "lock_duration": settings.security.lock_duration,
                },
                "notifications": {
                    "desktop_enabled": settings.notifications.desktop_enabled,
                    "sound_enabled": settings.notifications.sound_enabled,
                    "new_games": settings.notifications.new_games,
                    "updates": settings.notifications.updates,
                    "deals": settings.notifications.deals,
                }
            }
        })
    }

    /// Lista tutti i profili con settings
    pub async fn list_profiles_with_settings(&self) -> ProfileResult<Vec<String>> {
        if !self.settings_dir.exists() {
            return Ok(Vec::new());
        }

        let mut profiles = Vec::new();
        let mut entries = fs::read_dir(&self.settings_dir).await
            .map_err(|e| ProfileError::IoError(e))?;

        while let Some(entry) = entries.next_entry().await
            .map_err(|e| ProfileError::IoError(e))? {
            
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                if let Some(file_name) = path.file_stem() {
                    let profile_id = file_name.to_string_lossy().to_string();
                    if profile_id != "global" {
                        profiles.push(profile_id);
                    }
                }
            }
        }

        Ok(profiles)
    }
}

/// Implementazioni Default
impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            last_profile: None,
            auto_start_last_profile: false,
            window_position: None,
            window_size: None,
            debug_mode: false,
            custom_log_path: None,
        }
    }
}

impl Default for LegacySettings {
    fn default() -> Self {
        Self {
            language: None,
            theme: None,
            auto_scan: None,
            cache_enabled: None,
            cache_duration_hours: None,
            steam_api_key: None,
            steamgriddb_api_key: None,
            howlongtobeat_enabled: None,
            notifications_enabled: None,
            auto_update_check: None,
        }
    }
}