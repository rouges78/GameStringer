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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LibraryView {
    Grid,
    List,
}

/// Ordinamento libreria
#[derive(Debug, Clone, Serialize, Deserialize)]
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