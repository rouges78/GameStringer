use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::profiles::errors::ProfileError;

/// Profilo utente completo con tutti i dati
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    /// ID univoco del profilo
    pub id: String,
    /// Nome visualizzato del profilo
    pub name: String,
    /// Percorso opzionale dell'avatar
    pub avatar_path: Option<String>,
    /// Data di creazione del profilo
    pub created_at: DateTime<Utc>,
    /// Ultimo accesso al profilo
    pub last_accessed: DateTime<Utc>,
    /// Impostazioni personalizzate del profilo
    pub settings: ProfileSettings,
    /// Credenziali crittografate per i vari store
    pub credentials: HashMap<String, EncryptedCredential>,
    /// Metadati aggiuntivi del profilo
    pub metadata: ProfileMetadata,
}

/// Informazioni base del profilo (per lista profili)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInfo {
    /// ID univoco del profilo
    pub id: String,
    /// Nome visualizzato del profilo
    pub name: String,
    /// Percorso opzionale dell'avatar
    pub avatar_path: Option<String>,
    /// Data di creazione del profilo
    pub created_at: DateTime<Utc>,
    /// Ultimo accesso al profilo
    pub last_accessed: DateTime<Utc>,
    /// Indica se il profilo è bloccato
    pub is_locked: bool,
    /// Numero di tentativi di accesso falliti
    pub failed_attempts: u32,
}

/// Richiesta per creare un nuovo profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProfileRequest {
    /// Nome del profilo
    pub name: String,
    /// Password per il profilo
    pub password: String,
    /// Percorso opzionale dell'avatar
    pub avatar_path: Option<String>,
    /// Impostazioni iniziali (opzionali)
    pub settings: Option<ProfileSettings>,
}

/// Impostazioni personalizzate del profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileSettings {
    /// Tema dell'interfaccia
    pub theme: Theme,
    /// Lingua dell'interfaccia
    pub language: String,
    /// Login automatico
    pub auto_login: bool,
    /// Impostazioni notifiche
    pub notifications: NotificationSettings,
    /// Impostazioni libreria giochi
    pub game_library: LibrarySettings,
    /// Impostazioni sicurezza
    pub security: SecuritySettings,
}

/// Tema dell'interfaccia
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Theme {
    Light,
    Dark,
    Auto,
}

/// Impostazioni notifiche
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    /// Notifiche desktop abilitate
    pub desktop_enabled: bool,
    /// Notifiche suoni abilitati
    pub sound_enabled: bool,
    /// Notifiche per nuovi giochi
    pub new_games: bool,
    /// Notifiche per aggiornamenti
    pub updates: bool,
    /// Notifiche per offerte
    pub deals: bool,
}

/// Impostazioni libreria giochi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibrarySettings {
    /// Vista predefinita (griglia/lista)
    pub default_view: LibraryView,
    /// Ordinamento predefinito
    pub default_sort: LibrarySort,
    /// Mostra giochi nascosti
    pub show_hidden: bool,
    /// Aggiornamento automatico libreria
    pub auto_refresh: bool,
    /// Intervallo aggiornamento (minuti)
    pub refresh_interval: u32,
}

/// Vista libreria
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LibraryView {
    Grid,
    List,
}

/// Ordinamento libreria
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LibrarySort {
    Alphabetical,
    LastPlayed,
    RecentlyAdded,
    Platform,
}

/// Impostazioni sicurezza
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecuritySettings {
    /// Timeout sessione (minuti)
    pub session_timeout: u32,
    /// Richiedi password per operazioni sensibili
    pub require_password_for_sensitive: bool,
    /// Blocco automatico dopo tentativi falliti
    pub auto_lock_failed_attempts: u32,
    /// Durata blocco (minuti)
    pub lock_duration: u32,
}

/// Credenziale crittografata per uno store
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredential {
    /// Nome dello store
    pub store: String,
    /// Dati crittografati
    pub encrypted_data: String,
    /// Nonce per la crittografia
    pub nonce: String,
    /// Salt per la derivazione chiave
    pub salt: String,
    /// Data di creazione
    pub created_at: DateTime<Utc>,
    /// Data ultimo aggiornamento
    pub updated_at: DateTime<Utc>,
    /// Versione formato crittografia
    pub encryption_version: u32,
}

/// Metadati del profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileMetadata {
    /// Versione formato profilo
    pub version: u32,
    /// Dimensione dati profilo (bytes)
    pub data_size: u64,
    /// Hash integrità dati
    pub integrity_hash: String,
    /// Numero di accessi
    pub access_count: u64,
    /// Statistiche utilizzo
    pub usage_stats: UsageStats,
}

/// Statistiche utilizzo profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    /// Tempo totale utilizzo (secondi)
    pub total_usage_time: u64,
    /// Numero giochi aggiunti
    pub games_added: u32,
    /// Numero store connessi
    pub stores_connected: u32,
    /// Ultimo backup
    pub last_backup: Option<DateTime<Utc>>,
}

/// Implementazioni di default
impl Default for ProfileSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Auto,
            language: "it".to_string(),
            auto_login: false,
            notifications: NotificationSettings::default(),
            game_library: LibrarySettings::default(),
            security: SecuritySettings::default(),
        }
    }
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            desktop_enabled: true,
            sound_enabled: true,
            new_games: true,
            updates: true,
            deals: false,
        }
    }
}

impl Default for LibrarySettings {
    fn default() -> Self {
        Self {
            default_view: LibraryView::Grid,
            default_sort: LibrarySort::Alphabetical,
            show_hidden: false,
            auto_refresh: true,
            refresh_interval: 30,
        }
    }
}

impl Default for SecuritySettings {
    fn default() -> Self {
        Self {
            session_timeout: 60, // 1 ora
            require_password_for_sensitive: true,
            auto_lock_failed_attempts: 5,
            lock_duration: 15, // 15 minuti
        }
    }
}

impl Default for ProfileMetadata {
    fn default() -> Self {
        Self {
            version: 1,
            data_size: 0,
            integrity_hash: String::new(),
            access_count: 0,
            usage_stats: UsageStats::default(),
        }
    }
}

impl Default for UsageStats {
    fn default() -> Self {
        Self {
            total_usage_time: 0,
            games_added: 0,
            stores_connected: 0,
            last_backup: None,
        }
    }
}

/// Implementazioni per UserProfile
impl UserProfile {
    /// Crea un nuovo profilo
    pub fn new(name: String, avatar_path: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            avatar_path,
            created_at: now,
            last_accessed: now,
            settings: ProfileSettings::default(),
            credentials: HashMap::new(),
            metadata: ProfileMetadata::default(),
        }
    }
    
    /// Aggiorna ultimo accesso
    pub fn update_last_access(&mut self) {
        self.last_accessed = Utc::now();
        self.metadata.access_count += 1;
    }
    
    /// Aggiunge una credenziale crittografata
    pub fn add_credential(&mut self, credential: EncryptedCredential) {
        self.credentials.insert(credential.store.clone(), credential);
    }
    
    /// Rimuove una credenziale
    pub fn remove_credential(&mut self, store: &str) -> Option<EncryptedCredential> {
        self.credentials.remove(store)
    }
    
    /// Ottiene una credenziale per uno store
    pub fn get_credential(&self, store: &str) -> Option<&EncryptedCredential> {
        self.credentials.get(store)
    }
    
    /// Aggiorna le statistiche di utilizzo
    pub fn update_usage_stats(&mut self, session_duration: u64) {
        self.metadata.usage_stats.total_usage_time += session_duration;
    }
}

/// Implementazioni per ProfileInfo
impl From<&UserProfile> for ProfileInfo {
    fn from(profile: &UserProfile) -> Self {
        Self {
            id: profile.id.clone(),
            name: profile.name.clone(),
            avatar_path: profile.avatar_path.clone(),
            created_at: profile.created_at,
            last_accessed: profile.last_accessed,
            is_locked: false, // TODO: implementare logica blocco
            failed_attempts: 0, // TODO: implementare conteggio tentativi
        }
    }
}

/// Validazione dati profilo
impl CreateProfileRequest {
    /// Valida la richiesta di creazione profilo
    pub fn validate(&self) -> Result<(), ProfileError> {
        // Valida nome profilo
        if self.name.trim().is_empty() {
            return Err(ProfileError::InvalidProfileName("Nome profilo vuoto".to_string()));
        }
        
        if self.name.len() > 50 {
            return Err(ProfileError::InvalidProfileName("Nome profilo troppo lungo (max 50 caratteri)".to_string()));
        }
        
        // Caratteri non permessi nel nome
        if self.name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
            return Err(ProfileError::InvalidProfileName("Nome profilo contiene caratteri non validi".to_string()));
        }
        
        // Valida password
        if self.password.len() < 8 {
            return Err(ProfileError::WeakPassword("Password deve essere di almeno 8 caratteri".to_string()));
        }
        
        if self.password.len() > 128 {
            return Err(ProfileError::WeakPassword("Password troppo lunga (max 128 caratteri)".to_string()));
        }
        
        // Controlla complessità password
        let has_upper = self.password.chars().any(|c| c.is_uppercase());
        let has_lower = self.password.chars().any(|c| c.is_lowercase());
        let has_digit = self.password.chars().any(|c| c.is_numeric());
        let has_special = self.password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c));
        
        let complexity_score = [has_upper, has_lower, has_digit, has_special].iter().filter(|&&x| x).count();
        
        if complexity_score < 3 {
            return Err(ProfileError::WeakPassword("Password deve contenere almeno 3 tipi di caratteri (maiuscole, minuscole, numeri, simboli)".to_string()));
        }
        
        Ok(())
    }
}

/// Statistiche generali del sistema profili
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilesSystemStats {
    /// Numero totale di profili
    pub total_profiles: u32,
    /// Numero di profili attivi (usati di recente)
    pub active_profiles: u32,
    /// Numero di profili bloccati
    pub locked_profiles: u32,
    /// Dimensione totale dati profili (in bytes)
    pub total_data_size: u64,
    /// Numero totale di credenziali salvate
    pub total_credentials: u32,
    /// Numero totale di backup
    pub total_backups: u32,
    /// Ultimo controllo integrità
    pub last_integrity_check: Option<DateTime<Utc>>,
    /// Statistiche di utilizzo
    pub usage_stats: SystemUsageStats,
}

/// Statistiche di utilizzo del sistema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemUsageStats {
    /// Tempo totale di utilizzo (in secondi)
    pub total_usage_time: u64,
    /// Numero di autenticazioni totali
    pub total_authentications: u64,
    /// Numero di cambi profilo
    pub profile_switches: u64,
    /// Numero di export/import
    pub export_import_operations: u64,
    /// Errori di autenticazione
    pub authentication_errors: u64,
}

/// Controllo salute del sistema profili
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilesHealthCheck {
    /// Stato generale del sistema
    pub overall_status: HealthStatus,
    /// Controlli individuali
    pub checks: Vec<HealthCheckResult>,
    /// Raccomandazioni per miglioramenti
    pub recommendations: Vec<String>,
    /// Timestamp del controllo
    pub checked_at: DateTime<Utc>,
}

/// Stato di salute
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    /// Tutto funziona correttamente
    Healthy,
    /// Ci sono avvisi ma il sistema funziona
    Warning,
    /// Ci sono errori critici
    Critical,
}

/// Risultato di un controllo di salute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    /// Nome del controllo
    pub check_name: String,
    /// Stato del controllo
    pub status: HealthStatus,
    /// Messaggio descrittivo
    pub message: String,
    /// Dettagli aggiuntivi
    pub details: Option<String>,
}

/// Configurazione del sistema profili
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilesSystemConfig {
    /// Timeout sessione di default (in minuti)
    pub default_session_timeout: u32,
    /// Numero massimo di tentativi di autenticazione
    pub max_auth_attempts: u32,
    /// Durata blocco dopo tentativi falliti (in minuti)
    pub lockout_duration: u32,
    /// Abilita backup automatico
    pub auto_backup_enabled: bool,
    /// Intervallo backup automatico (in ore)
    pub auto_backup_interval: u32,
    /// Numero massimo di backup da mantenere
    pub max_backups_to_keep: u32,
    /// Abilita controlli integrità automatici
    pub auto_integrity_check: bool,
    /// Intervallo controlli integrità (in ore)
    pub integrity_check_interval: u32,
    /// Abilita pulizia automatica dati temporanei
    pub auto_cleanup_temp_data: bool,
    /// Intervallo pulizia dati temporanei (in ore)
    pub cleanup_interval: u32,
    /// Dimensione massima cache per profilo (in MB)
    pub max_cache_size_mb: u32,
    /// Abilita logging dettagliato
    pub verbose_logging: bool,
}

impl Default for ProfilesSystemStats {
    fn default() -> Self {
        Self {
            total_profiles: 0,
            active_profiles: 0,
            locked_profiles: 0,
            total_data_size: 0,
            total_credentials: 0,
            total_backups: 0,
            last_integrity_check: None,
            usage_stats: SystemUsageStats::default(),
        }
    }
}

impl Default for SystemUsageStats {
    fn default() -> Self {
        Self {
            total_usage_time: 0,
            total_authentications: 0,
            profile_switches: 0,
            export_import_operations: 0,
            authentication_errors: 0,
        }
    }
}

impl Default for ProfilesSystemConfig {
    fn default() -> Self {
        Self {
            default_session_timeout: 60, // 1 ora
            max_auth_attempts: 5,
            lockout_duration: 15, // 15 minuti
            auto_backup_enabled: true,
            auto_backup_interval: 24, // 24 ore
            max_backups_to_keep: 10,
            auto_integrity_check: true,
            integrity_check_interval: 168, // 1 settimana
            auto_cleanup_temp_data: true,
            cleanup_interval: 24, // 24 ore
            max_cache_size_mb: 100,
            verbose_logging: false,
        }
    }
}

/// Statistiche utilizzo profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileUsageStats {
    pub profile_id: String,
    pub total_logins: u64,
    pub last_login: DateTime<Utc>,
    pub session_count: u64,
    pub average_session_duration: u64,
}

impl ProfilesHealthCheck {
    /// Crea un nuovo controllo di salute
    pub fn new() -> Self {
        Self {
            overall_status: HealthStatus::Healthy,
            checks: Vec::new(),
            recommendations: Vec::new(),
            checked_at: Utc::now(),
        }
    }
    
    /// Aggiunge un controllo
    pub fn add_check(&mut self, check: HealthCheckResult) {
        // Aggiorna lo stato generale basandosi sui controlli
        match check.status {
            HealthStatus::Critical => self.overall_status = HealthStatus::Critical,
            HealthStatus::Warning if self.overall_status == HealthStatus::Healthy => {
                self.overall_status = HealthStatus::Warning;
            },
            _ => {}
        }
        
        self.checks.push(check);
    }
    
    /// Aggiunge una raccomandazione
    pub fn add_recommendation(&mut self, recommendation: String) {
        self.recommendations.push(recommendation);
    }
}