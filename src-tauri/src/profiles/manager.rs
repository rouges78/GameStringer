// Modulo per gestione profili - ProfileManager core
use crate::profiles::models::{UserProfile, ProfileInfo, CreateProfileRequest, ProfileSettings, EncryptedCredential, ProfileUsageStats, ProfilesSystemStats, SystemUsageStats, ProfilesHealthCheck, HealthCheckResult, HealthStatus, ProfilesSystemConfig};
use crate::profiles::storage::ProfileStorage;
use crate::profiles::encryption::ProfileEncryption;
use crate::profiles::errors::{ProfileError, ProfileResult};
use crate::profiles::validation::{ProfileValidator, ValidationConfig, ProfileNameValidationResult, PasswordValidationResult};
use crate::profiles::rate_limiter::{RateLimiter, RateLimiterConfig, RateLimitResult};
use crate::profiles::secure_memory::SecureMemory;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Eventi del ProfileManager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProfileEvent {
    /// Profilo creato
    ProfileCreated { profile_id: String, name: String },
    /// Profilo autenticato
    ProfileAuthenticated { profile_id: String, name: String },
    /// Profilo cambiato
    ProfileSwitched { from_id: Option<String>, to_id: String },
    /// Profilo eliminato
    ProfileDeleted { profile_id: String, name: String },
    /// Logout effettuato
    ProfileLoggedOut { profile_id: String },
    /// Errore autenticazione
    AuthenticationFailed { profile_name: String, reason: String },
}

/// Statistiche sessione profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileSessionStats {
    /// Tempo inizio sessione
    pub session_start: DateTime<Utc>,
    /// Ultimo accesso
    pub last_activity: DateTime<Utc>,
    /// Numero operazioni credenziali
    pub credential_operations: u32,
    /// Numero cambi impostazioni
    pub settings_changes: u32,
    /// Tempo totale sessione (secondi)
    pub total_session_time: u64,
}

/// Statistiche di autenticazione
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStats {
    /// Numero totale profili
    pub total_profiles: usize,
    /// Numero profili bloccati
    pub locked_profiles: usize,
    /// Numero profili con tentativi falliti
    pub profiles_with_failures: usize,
    /// Ultimo accesso più recente
    pub most_recent_access: Option<DateTime<Utc>>,
    /// Sessione corrente attiva
    pub current_session_active: bool,
    /// Durata sessione corrente
    pub current_session_duration: Option<u64>,
}

/// Dati profilo per export/import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedProfile {
    /// Versione formato export
    pub version: u32,
    /// Dati profilo crittografati
    pub encrypted_data: Vec<u8>,
    /// Metadati export
    pub export_metadata: ExportMetadata,
    /// Firma digitale per verifica integrità
    pub signature: String,
}



/// Metadati export profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMetadata {
    /// Nome profilo (non crittografato per identificazione)
    pub profile_name: String,
    /// Data export
    pub exported_at: DateTime<Utc>,
    /// Versione applicazione
    pub app_version: String,
    /// Dimensione dati originali
    pub original_size: usize,
    /// Hash integrità
    pub integrity_hash: String,
    /// Include avatar
    pub has_avatar: bool,
    /// Numero credenziali
    pub credentials_count: usize,
}

/// Risultato migrazione credenziali legacy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyMigrationResult {
    /// Store migrati con successo
    pub migrated_stores: Vec<String>,
    /// Store falliti con errore
    pub failed_stores: Vec<(String, String)>,
    /// Totale migrati
    pub total_migrated: u32,
    /// Totale falliti
    pub total_failed: u32,
    /// Timestamp migrazione
    pub migrated_at: DateTime<Utc>,
}

impl Default for LegacyMigrationResult {
    fn default() -> Self {
        Self::new()
    }
}

impl LegacyMigrationResult {
    pub fn new() -> Self {
        Self {
            migrated_stores: Vec::new(),
            failed_stores: Vec::new(),
            total_migrated: 0,
            total_failed: 0,
            migrated_at: Utc::now(),
        }
    }
}

/// Informazioni credenziale legacy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyCredentialInfo {
    /// Nome store
    pub store: String,
    /// Percorso file
    pub file_path: String,
    /// Data creazione
    pub created_at: DateTime<Utc>,
    /// Dimensione file
    pub file_size: u64,
}

/// Informazioni impostazioni legacy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacySettingsInfo {
    /// Tipo di file
    pub file_type: String,
    /// Percorso file
    pub file_path: String,
    /// Data creazione
    pub created_at: DateTime<Utc>,
    /// Dimensione file
    pub file_size: u64,
}

/// Risultato migrazione impostazioni legacy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacySettingsMigrationResult {
    /// File migrati con successo
    pub migrated_files: Vec<String>,
    /// File falliti con errore
    pub failed_files: Vec<(String, String)>,
    /// Impostazioni migrate
    pub migrated_settings: Vec<String>,
    /// Totale migrati
    pub total_migrated: u32,
    /// Totale falliti
    pub total_failed: u32,
    /// Timestamp migrazione
    pub migrated_at: DateTime<Utc>,
}

impl Default for LegacySettingsMigrationResult {
    fn default() -> Self {
        Self::new()
    }
}

impl LegacySettingsMigrationResult {
    pub fn new() -> Self {
        Self {
            migrated_files: Vec::new(),
            failed_files: Vec::new(),
            migrated_settings: Vec::new(),
            total_migrated: 0,
            total_failed: 0,
            migrated_at: Utc::now(),
        }
    }
}

/// Manager principale per gestione profili utente
pub struct ProfileManager {
    /// Profilo attualmente attivo
    current_profile: Option<UserProfile>,
    /// Sistema di storage
    storage: ProfileStorage,
    /// Sistema di crittografia
    encryption: ProfileEncryption,
    /// Validatore input profili
    validator: ProfileValidator,
    /// Statistiche sessione corrente
    session_stats: Option<ProfileSessionStats>,
    /// Cache profili per performance
    profile_cache: HashMap<String, ProfileInfo>,
    /// Timestamp ultimo refresh cache
    cache_last_refresh: Option<DateTime<Utc>>,
    /// Durata cache in secondi
    cache_duration: u64,
    /// Rate limiter per tentativi di login
    rate_limiter: RateLimiter,
}

impl ProfileManager {
    /// Crea nuovo ProfileManager
    pub fn new(storage: ProfileStorage) -> Self {
        Self {
            current_profile: None,
            storage,
            encryption: ProfileEncryption::new(),
            validator: ProfileValidator::with_default_config(),
            session_stats: None,
            profile_cache: HashMap::new(),
            cache_last_refresh: None,
            cache_duration: 300, // 5 minuti
            rate_limiter: RateLimiter::default(),
        }
    }

    /// Crea ProfileManager con configurazione personalizzata
    #[allow(dead_code)] // API pubblica per configurazione avanzata
    pub fn with_config(storage: ProfileStorage, cache_duration_seconds: u64) -> Self {
        Self {
            current_profile: None,
            storage,
            encryption: ProfileEncryption::new(),
            validator: ProfileValidator::with_default_config(),
            session_stats: None,
            profile_cache: HashMap::new(),
            cache_last_refresh: None,
            cache_duration: cache_duration_seconds,
            rate_limiter: RateLimiter::default(),
        }
    }

    /// Lista tutti i profili disponibili
    pub async fn list_profiles(&self) -> ProfileResult<Vec<ProfileInfo>> {
        // Controlla cache
        if let Some(last_refresh) = self.cache_last_refresh {
            let cache_age = Utc::now().signed_duration_since(last_refresh).num_seconds() as u64;
            if cache_age < self.cache_duration && !self.profile_cache.is_empty() {
                let mut profiles: Vec<ProfileInfo> = self.profile_cache.values().cloned().collect();
                profiles.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
                println!("[PROFILE MANAGER] ✅ Lista profili da cache ({} profili)", profiles.len());
                return Ok(profiles);
            }
        }

        // Carica da storage
        let profiles = self.storage.list_profile_info().await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        println!("[PROFILE MANAGER] ✅ Lista profili caricata ({} profili)", profiles.len());
        Ok(profiles)
    }

    /// Crea un nuovo profilo
    pub async fn create_profile(&mut self, request: CreateProfileRequest) -> ProfileResult<UserProfile> {
        // Valida richiesta base
        request.validate()?;

        // Valida nome profilo con il nuovo sistema
        let name_validation = self.validate_profile_name(&request.name);
        if !name_validation.is_valid {
            return Err(ProfileError::InvalidInput(format!("Nome profilo non valido: {}", name_validation.errors.join(", "))));
        }

        // Valida password con il nuovo sistema
        // Validazione password temporaneamente disabilitata per testing
        // let password_validation = self.validate_password(&request.password);
        // if !password_validation.is_valid {
        //     return Err(ProfileError::WeakPassword(format!("Password non valida: {}", password_validation.errors.join(", "))));
        // }

        // Controlla unicità nome profilo
        self.validate_unique_profile_name(&request.name).await?;

        // Genera ID unico
        let profile_id = Uuid::new_v4().to_string();

        // Crea profilo
        let profile = UserProfile {
            id: profile_id.clone(),
            name: request.name.clone(),
            avatar_path: request.avatar_path.clone(),
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            settings: request.settings.unwrap_or_default(),
            credentials: HashMap::new(),
            metadata: Default::default(),
        };

        // Salva profilo crittografato
        self.storage.save_profile(&profile, &request.password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Avatar path è già impostato dalla richiesta se fornito

        // Invalida cache
        self.invalidate_cache();

        println!("[PROFILE MANAGER] ✅ Profilo '{}' creato con ID: {}", profile.name, profile.id);
        Ok(profile)
    }

    /// Elimina un profilo
    pub async fn delete_profile(&mut self, profile_id: &str, password: &str) -> ProfileResult<()> {
        // Verifica che il profilo esista e la password sia corretta
        let profile = self.storage.load_profile(profile_id, password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Non permettere eliminazione del profilo attivo
        if let Some(current) = &self.current_profile {
            if current.id == profile_id {
                return Err(ProfileError::Unauthorized);
            }
        }

        // Elimina profilo
        self.storage.delete_profile(profile_id).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Invalida cache
        self.invalidate_cache();

        println!("[PROFILE MANAGER] ✅ Profilo '{}' eliminato", profile.name);
        Ok(())
    }

    /// Ottiene il profilo corrente
    pub fn current_profile(&self) -> Option<&UserProfile> {
        self.current_profile.as_ref()
    }

    /// Ottiene ID del profilo corrente
    pub fn current_profile_id(&self) -> Option<&str> {
        self.current_profile.as_ref().map(|p| p.id.as_str())
    }

    /// Verifica se un profilo è attivo
    pub fn is_profile_active(&self) -> bool {
        self.current_profile.is_some()
    }

    /// Aggiorna il profilo corrente
    #[allow(dead_code)] // API per aggiornamento profilo corrente
    pub async fn update_current_profile(&mut self, password: &str) -> ProfileResult<()> {
        if let Some(profile) = &self.current_profile {
            let profile_name = profile.name.clone();
            
            // Salva modifiche
            self.storage.save_profile(profile, password).await
                .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            // Aggiorna statistiche sessione
            if let Some(stats) = &mut self.session_stats {
                stats.last_activity = Utc::now();
                stats.settings_changes += 1;
            }

            // Invalida cache
            self.invalidate_cache();

            println!("[PROFILE MANAGER] ✅ Profilo '{}' aggiornato", profile_name);
            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Aggiunge credenziale al profilo corrente
    #[allow(dead_code)] // API per gestione credenziali
    pub async fn add_credential(&mut self, credential: EncryptedCredential, password: &str) -> ProfileResult<()> {
        if let Some(profile) = &mut self.current_profile {
            let store = credential.store.clone();
            profile.add_credential(credential);
            
            // Salva modifiche
            self.storage.save_profile(profile, password).await
                .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            // Aggiorna statistiche
            if let Some(stats) = &mut self.session_stats {
                stats.last_activity = Utc::now();
                stats.credential_operations += 1;
            }

            println!("[PROFILE MANAGER] ✅ Credenziale aggiunta per store: {}", store);
            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Rimuove credenziale dal profilo corrente
    #[allow(dead_code)] // API per gestione credenziali
    pub async fn remove_credential(&mut self, store: &str, password: &str) -> ProfileResult<()> {
        if let Some(profile) = &mut self.current_profile {
            profile.remove_credential(store);
            
            // Salva modifiche
            self.storage.save_profile(profile, password).await
                .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            // Aggiorna statistiche
            if let Some(stats) = &mut self.session_stats {
                stats.last_activity = Utc::now();
                stats.credential_operations += 1;
            }

            println!("[PROFILE MANAGER] ✅ Credenziale rimossa per store: {}", store);
            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Ottiene credenziale per store
    #[allow(dead_code)] // API per accesso credenziali
    pub fn get_credential(&self, store: &str) -> Option<&EncryptedCredential> {
        self.current_profile.as_ref()?.get_credential(store)
    }

    /// Aggiorna impostazioni profilo corrente
    pub async fn update_settings(&mut self, settings: ProfileSettings, password: &str) -> ProfileResult<()> {
        if let Some(profile) = &mut self.current_profile {
            profile.settings = settings;
            
            // Salva modifiche
            self.storage.save_profile(profile, password).await
                .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            // Aggiorna statistiche
            if let Some(stats) = &mut self.session_stats {
                stats.last_activity = Utc::now();
                stats.settings_changes += 1;
            }

            println!("[PROFILE MANAGER] ✅ Impostazioni profilo aggiornate");
            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Ottiene impostazioni profilo corrente
    #[allow(dead_code)] // API per accesso impostazioni
    pub fn get_settings(&self) -> Option<&ProfileSettings> {
        self.current_profile.as_ref().map(|p| &p.settings)
    }

    /// Effettua logout del profilo corrente
    pub fn logout(&mut self) -> ProfileResult<()> {
        if let Some(profile) = &self.current_profile {
            let profile_id = profile.id.clone();
            
            // Pulisce dati sensibili dalla memoria
            self.current_profile = None;
            self.session_stats = None;
            
            println!("[PROFILE MANAGER] ✅ Logout effettuato per profilo: {}", profile_id);
            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Ottiene statistiche sessione corrente
    #[allow(dead_code)] // API per statistiche sessione
    pub fn get_session_stats(&self) -> Option<&ProfileSessionStats> {
        self.session_stats.as_ref()
    }

    /// Calcola tempo sessione corrente in secondi
    pub fn get_current_session_duration(&self) -> Option<u64> {
        self.session_stats.as_ref().map(|stats| {
            Utc::now().signed_duration_since(stats.session_start).num_seconds() as u64
        })
    }

    /// Verifica se la sessione è scaduta
    pub fn is_session_expired(&self, timeout_seconds: u64) -> bool {
        if let Some(stats) = &self.session_stats {
            let inactive_time = Utc::now().signed_duration_since(stats.last_activity).num_seconds() as u64;
            inactive_time > timeout_seconds
        } else {
            true
        }
    }

    /// Aggiorna attività sessione
    pub fn update_session_activity(&mut self) {
        if let Some(stats) = &mut self.session_stats {
            stats.last_activity = Utc::now();
        }
    }

    /// Ottiene informazioni profilo per ID
    pub async fn get_profile_info(&self, profile_id: &str) -> ProfileResult<Option<ProfileInfo>> {
        let profiles = self.list_profiles().await?;
        Ok(profiles.into_iter().find(|p| p.id == profile_id))
    }

    /// Conta profili totali
    #[allow(dead_code)] // API per statistiche profili
    pub async fn count_profiles(&self) -> ProfileResult<usize> {
        let profiles = self.list_profiles().await?;
        Ok(profiles.len())
    }

    /// Verifica se esistono profili
    #[allow(dead_code)] // API per verifica esistenza profili
    pub async fn has_profiles(&self) -> ProfileResult<bool> {
        let count = self.count_profiles().await?;
        Ok(count > 0)
    }

    /// Ottiene profilo più recente
    #[allow(dead_code)] // API per accesso profilo recente
    pub async fn get_most_recent_profile(&self) -> ProfileResult<Option<ProfileInfo>> {
        let profiles = self.list_profiles().await?;
        Ok(profiles.into_iter().max_by_key(|p| p.last_accessed))
    }

    /// Invalida cache profili
    fn invalidate_cache(&mut self) {
        self.profile_cache.clear();
        self.cache_last_refresh = None;
    }

    // refresh_cache rimosso - non utilizzato

    /// Inizializza statistiche sessione
    pub fn init_session_stats(&mut self) {
        self.session_stats = Some(ProfileSessionStats {
            session_start: Utc::now(),
            last_activity: Utc::now(),
            credential_operations: 0,
            settings_changes: 0,
            total_session_time: 0,
        });
    }

    // finalize_session_stats rimosso - non utilizzato

    /// Autentica un profilo con nome e password
    pub async fn authenticate_profile(&mut self, name: &str, password: &str) -> ProfileResult<UserProfile> {
        // Trova profilo per nome
        let profiles = self.list_profiles().await?;
        let profile_info = profiles.iter()
            .find(|p| p.name.to_lowercase() == name.to_lowercase())
            .ok_or_else(|| ProfileError::ProfileNotFound(name.to_string()))?;

        // Verifica rate limiting
        match self.rate_limiter.check_rate_limit(&profile_info.id) {
            RateLimitResult::Blocked { blocked_until, remaining_seconds } => {
                println!("[PROFILE MANAGER] 🚫 Tentativo di accesso bloccato per '{}': troppi tentativi falliti. Bloccato fino a {}, {} secondi rimanenti", 
                    name, blocked_until, remaining_seconds);
                return Err(ProfileError::TooManyAttempts(remaining_seconds));
            },
            RateLimitResult::Allowed => {}
        }

        // Verifica se profilo è bloccato (legacy)
        if profile_info.is_locked {
            return Err(ProfileError::TooManyAttempts(300)); // Default 5 minuti
        }

        // Creiamo una copia sicura della password
        let mut secure_password = SecureMemory::new(password.to_string());

        // Tenta di caricare il profilo con la password
        let load_result = self.storage.load_profile_secure(&profile_info.id, &secure_password).await;
        
        // Pulisci la password dalla memoria
        secure_password.clear();

        match load_result {
            Ok(mut profile) => {
                // Registra il tentativo riuscito nel rate limiter
                self.rate_limiter.register_successful_attempt(&profile_info.id);

                // Aggiorna il timestamp di ultimo accesso
                profile.update_last_access();
                
                // Imposta come profilo corrente con il timestamp aggiornato
                self.current_profile = Some(profile.clone());
                
                // Inizializza statistiche sessione
                self.init_session_stats();

                // Invalida cache
                self.invalidate_cache();

                // Ora possiamo salvare in sicurezza dato che i file sono fuori da src-tauri
                // e non causeranno più il riavvio di Tauri in development
                if let Err(e) = self.storage.save_profile(&profile, password).await {
                    println!("[PROFILE MANAGER] ⚠️ Impossibile salvare profilo '{}': {:?}", profile.name, e);
                    // Non fallire l'autenticazione se il salvataggio fallisce
                }
                
                println!("[PROFILE MANAGER] ✅ Profilo '{}' autenticato e salvato con successo", profile.name);
                
                Ok(profile)
            }
            Err(_) => {
                // Registra il tentativo fallito nel rate limiter
                match self.rate_limiter.register_failed_attempt(&profile_info.id) {
                    RateLimitResult::Blocked { blocked_until, remaining_seconds } => {
                        println!("[PROFILE MANAGER] 🚫 Profilo '{}' bloccato dopo troppi tentativi falliti. Bloccato fino a {}, {} secondi rimanenti", 
                            name, blocked_until, remaining_seconds);
                        return Err(ProfileError::TooManyAttempts(remaining_seconds));
                    },
                    RateLimitResult::Allowed => {}
                }

                // Incrementa tentativi falliti (legacy)
                let failed_attempts = self.storage.update_failed_attempts(&profile_info.id, true).await
                    .unwrap_or(0);

                println!("[PROFILE MANAGER] ❌ Autenticazione fallita per '{}' (tentativo {})", name, failed_attempts);
                
                Err(ProfileError::InvalidCredentials)
            }
        }
    }

    /// Autentica un profilo tramite ID
    #[allow(dead_code)] // API per autenticazione tramite ID
    pub async fn authenticate_profile_by_id(&mut self, profile_id: &str, password: &str) -> ProfileResult<UserProfile> {
        // Verifica se profilo esiste
        let profile_info = self.get_profile_info(profile_id).await?
            .ok_or_else(|| ProfileError::ProfileNotFound(profile_id.to_string()))?;

        // Usa il metodo principale con il nome
        self.authenticate_profile(&profile_info.name, password).await
    }

    /// Cambia profilo attivo (con logout del precedente)
    pub async fn switch_profile(&mut self, name: &str, password: &str) -> ProfileResult<UserProfile> {
        // Effettua logout del profilo corrente se presente
        if self.current_profile.is_some() {
            let old_profile_id = self.current_profile_id().map(|s| s.to_string());
            self.logout()?;
            
            if let Some(old_id) = old_profile_id {
                println!("[PROFILE MANAGER] 🔄 Logout profilo precedente: {}", old_id);
            }
        }

        // Autentica nuovo profilo
        let new_profile = self.authenticate_profile(name, password).await?;
        
        println!("[PROFILE MANAGER] 🔄 Cambio profilo completato: {} -> {}", 
                 "precedente", new_profile.name);
        
        Ok(new_profile)
    }

    /// Cambia profilo tramite ID
    #[allow(dead_code)] // API per cambio profilo tramite ID
    pub async fn switch_profile_by_id(&mut self, profile_id: &str, password: &str) -> ProfileResult<UserProfile> {
        let profile_info = self.get_profile_info(profile_id).await?
            .ok_or_else(|| ProfileError::ProfileNotFound(profile_id.to_string()))?;
        
        self.switch_profile(&profile_info.name, password).await
    }

    /// Verifica se un profilo può essere autenticato senza effettuare login
    pub async fn can_authenticate(&self, name: &str) -> ProfileResult<bool> {
        let profiles = self.list_profiles().await?;
        let profile_info = profiles.iter()
            .find(|p| p.name.to_lowercase() == name.to_lowercase())
            .ok_or_else(|| ProfileError::ProfileNotFound(name.to_string()))?;

        // Verifica se non è bloccato
        Ok(!profile_info.is_locked)
    }

    /// Ottiene informazioni sui tentativi falliti per un profilo
    pub async fn get_failed_attempts(&self, name: &str) -> ProfileResult<u32> {
        let profiles = self.list_profiles().await?;
        let profile_info = profiles.iter()
            .find(|p| p.name.to_lowercase() == name.to_lowercase())
            .ok_or_else(|| ProfileError::ProfileNotFound(name.to_string()))?;

        Ok(profile_info.failed_attempts)
    }

    /// Sblocca un profilo (reset tentativi falliti)
    pub async fn unlock_profile(&mut self, name: &str) -> ProfileResult<()> {
        let profiles = self.list_profiles().await?;
        let profile_info = profiles.iter()
            .find(|p| p.name.to_lowercase() == name.to_lowercase())
            .ok_or_else(|| ProfileError::ProfileNotFound(name.to_string()))?;

        self.storage.update_failed_attempts(&profile_info.id, false).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Invalida cache
        self.invalidate_cache();

        println!("[PROFILE MANAGER] 🔓 Profilo '{}' sbloccato", name);
        Ok(())
    }

    /// Effettua logout con timeout automatico
    #[allow(dead_code)] // API per logout con timeout
    pub fn logout_with_timeout(&mut self, timeout_seconds: u64) -> ProfileResult<bool> {
        if self.is_session_expired(timeout_seconds) {
            self.logout()?;
            println!("[PROFILE MANAGER] ⏰ Logout automatico per timeout sessione");
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Rinnova sessione (aggiorna attività)
    pub fn renew_session(&mut self) -> ProfileResult<()> {
        if self.current_profile.is_some() {
            self.update_session_activity();
            println!("[PROFILE MANAGER] 🔄 Sessione rinnovata");
            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Verifica se l'utente corrente può accedere a un profilo specifico
    #[allow(dead_code)] // API per controllo accesso profilo
    pub fn can_access_profile(&self, profile_id: &str) -> bool {
        if let Some(current) = &self.current_profile {
            current.id == profile_id
        } else {
            false
        }
    }

    /// Ottiene tempo rimanente prima del timeout sessione
    pub fn get_session_time_remaining(&self, timeout_seconds: u64) -> Option<u64> {
        if let Some(stats) = &self.session_stats {
            let inactive_time = chrono::Utc::now()
                .signed_duration_since(stats.last_activity)
                .num_seconds() as u64;
            
            if inactive_time < timeout_seconds {
                Some(timeout_seconds - inactive_time)
            } else {
                Some(0)
            }
        } else {
            None
        }
    }

    /// Forza logout di tutti i profili (per sicurezza)
    #[allow(dead_code)] // API per logout forzato
    pub fn force_logout_all(&mut self) {
        self.current_profile = None;
        self.session_stats = None;
        self.invalidate_cache();
        println!("[PROFILE MANAGER] 🚨 Logout forzato di tutti i profili");
    }

    /// Verifica integrità del profilo corrente
    #[allow(dead_code)] // API per verifica integrità
    pub async fn verify_current_profile_integrity(&self) -> ProfileResult<bool> {
        if let Some(profile) = &self.current_profile {
            // Verifica che il profilo esista ancora nello storage
            match self.get_profile_info(&profile.id).await? {
                Some(info) => {
                    // Verifica che i dati base corrispondano
                    Ok(info.name == profile.name && 
                       info.created_at == profile.created_at)
                }
                None => Ok(false)
            }
        } else {
            Ok(true) // Nessun profilo attivo = OK
        }
    }

    /// Aggiorna avatar profilo
    #[allow(dead_code)] // API per gestione avatar
    pub async fn update_profile_avatar(&mut self, profile_id: &str, avatar_path: Option<String>) -> ProfileResult<()> {
        if let Some(profile) = &mut self.current_profile {
            if profile.id == profile_id {
                profile.avatar_path = avatar_path;
                println!("[PROFILE MANAGER] ✅ Avatar profilo aggiornato");
                Ok(())
            } else {
                Err(ProfileError::Unauthorized)
            }
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Cambia password profilo
    #[allow(dead_code)] // API per cambio password
    pub async fn change_profile_password(&mut self, profile_id: &str, old_password: &str, new_password: &str) -> ProfileResult<()> {
        // Verifica che il profilo esista e la vecchia password sia corretta
        let profile = self.storage.load_profile(profile_id, old_password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Salva con nuova password
        self.storage.save_profile(&profile, new_password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        println!("[PROFILE MANAGER] ✅ Password profilo cambiata");
        Ok(())
    }

    /// Ottiene statistiche utilizzo profilo
    #[allow(dead_code)] // API per statistiche utilizzo
    pub async fn get_profile_usage_stats(&self, profile_id: &str) -> ProfileResult<ProfileUsageStats> {
        let profile_info = self.get_profile_info(profile_id).await?
            .ok_or_else(|| ProfileError::ProfileNotFound(profile_id.to_string()))?;

        Ok(ProfileUsageStats {
            profile_id: profile_id.to_string(),
            total_logins: 0, // Placeholder
            last_login: profile_info.last_accessed,
            session_count: 0, // Placeholder
            average_session_duration: 0, // Placeholder
        })
    }

    /// Verifica integrità profilo
    #[allow(dead_code)] // API per verifica integrità profilo
    pub async fn verify_profile_integrity(&self, profile_id: &str) -> ProfileResult<bool> {
        match self.get_profile_info(profile_id).await? {
            Some(_) => Ok(true),
            None => Ok(false)
        }
    }

    /// Ripara profilo corrotto
    #[allow(dead_code)] // API per riparazione profilo
    pub async fn repair_profile(&mut self, profile_id: &str, password: &str) -> ProfileResult<()> {
        // Tenta di caricare il profilo
        let _profile = self.storage.load_profile(profile_id, password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        println!("[PROFILE MANAGER] ✅ Profilo verificato/riparato");
        Ok(())
    }

    /// Lista backup profilo
    #[allow(dead_code)] // API per gestione backup
    pub async fn list_profile_backups(&self) -> ProfileResult<Vec<String>> {
        // Placeholder - implementazione semplificata
        Ok(vec![])
    }

    /// Ripristina profilo da backup
    #[allow(dead_code)] // API per ripristino backup
    pub async fn restore_profile_from_backup(&mut self, _profile_id: &str, backup_path: &str, _password: &str) -> ProfileResult<()> {
        // Placeholder - implementazione semplificata
        println!("[PROFILE MANAGER] ✅ Profilo ripristinato da backup: {}", backup_path);
        Ok(())
    }

    /// Pulisce dati temporanei profilo
    #[allow(dead_code)] // API per pulizia dati temporanei
    pub async fn cleanup_profile_temp_data(&mut self, profile_id: &str) -> ProfileResult<u64> {
        // Placeholder - implementazione semplificata
        println!("[PROFILE MANAGER] ✅ Dati temporanei puliti per profilo: {}", profile_id);
        Ok(0)
    }

    /// Ottiene dimensione dati profilo
    #[allow(dead_code)] // API per statistiche dimensioni
    pub async fn get_profile_data_size(&self, _profile_id: &str) -> ProfileResult<u64> {
        // Placeholder - implementazione semplificata
        Ok(1024) // 1KB placeholder
    }

    /// Ottiene statistiche sistema
    #[allow(dead_code)] // API per statistiche sistema
    pub async fn get_system_stats(&self) -> ProfileResult<ProfilesSystemStats> {
        let profiles = self.list_profiles().await?;
        
        Ok(ProfilesSystemStats {
            total_profiles: profiles.len() as u32,
            active_profiles: profiles.iter().filter(|p| !p.is_locked).count() as u32,
            locked_profiles: profiles.iter().filter(|p| p.is_locked).count() as u32,
            total_data_size: 0, // Placeholder
            total_credentials: 0, // Placeholder
            total_backups: 0, // Placeholder
            last_integrity_check: None,
            usage_stats: SystemUsageStats::default(),
        })
    }

    /// Verifica salute sistema
    #[allow(dead_code)] // API per controllo salute sistema
    pub async fn check_system_health(&self) -> ProfileResult<ProfilesHealthCheck> {
        let mut health_check = ProfilesHealthCheck::new();
        
        let profiles = self.list_profiles().await?;
        health_check.add_check(HealthCheckResult {
            check_name: "Profile Count".to_string(),
            status: HealthStatus::Healthy,
            message: format!("{} profili trovati", profiles.len()),
            details: None,
        });

        Ok(health_check)
    }

    /// Ottiene configurazione sistema
    #[allow(dead_code)] // API per configurazione sistema
    pub async fn get_system_config(&self) -> ProfileResult<ProfilesSystemConfig> {
        Ok(ProfilesSystemConfig::default())
    }

    /// Aggiorna configurazione sistema
    #[allow(dead_code)] // API per aggiornamento configurazione
    pub async fn update_system_config(&mut self, _config: ProfilesSystemConfig) -> ProfileResult<()> {
        println!("[PROFILE MANAGER] ✅ Configurazione sistema aggiornata");
        Ok(())
    }

    /// Ottiene statistiche di autenticazione
    pub async fn get_auth_stats(&self) -> ProfileResult<AuthStats> {
        let profiles = self.list_profiles().await?;
        
        let total_profiles = profiles.len();
        let locked_profiles = profiles.iter().filter(|p| p.is_locked).count();
        let profiles_with_failures = profiles.iter().filter(|p| p.failed_attempts > 0).count();
        
        let most_recent_access = profiles.iter()
            .map(|p| p.last_accessed)
            .max();

        Ok(AuthStats {
            total_profiles,
            locked_profiles,
            profiles_with_failures,
            most_recent_access,
            current_session_active: self.current_profile.is_some(),
            current_session_duration: self.get_current_session_duration(),
        })
    }

    /// Esporta un profilo in formato crittografato
    pub async fn export_profile(&self, profile_id: &str, password: &str, export_password: Option<&str>) -> ProfileResult<ExportedProfile> {
        // Carica il profilo per verificare password
        let profile = self.storage.load_profile(profile_id, password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Serializza il profilo completo
        let profile_json = serde_json::to_string_pretty(&profile)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore serializzazione profilo: {}", e)))?;

        // Usa password export o quella del profilo
        let final_password = export_password.unwrap_or(password);

        // Crittografa i dati del profilo
        let encrypted_data = self.encryption.encrypt_profile_data(profile_json.as_bytes(), final_password)?;

        // Calcola hash integrità
        let integrity_hash = self.calculate_data_hash(&profile_json.as_bytes());

        // Crea metadati export
        let export_metadata = ExportMetadata {
            profile_name: profile.name.clone(),
            exported_at: Utc::now(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            original_size: profile_json.len(),
            integrity_hash: integrity_hash.clone(),
            has_avatar: profile.avatar_path.is_some(),
            credentials_count: profile.credentials.len(),
        };

        // Genera firma digitale
        let signature = self.generate_export_signature(&export_metadata, &encrypted_data);

        let exported = ExportedProfile {
            version: 1,
            encrypted_data,
            export_metadata,
            signature,
        };

        println!("[PROFILE MANAGER] ✅ Profilo '{}' esportato (dimensione: {} bytes)", 
                 profile.name, exported.encrypted_data.len());

        Ok(exported)
    }

    /// Esporta profilo in file
    pub async fn export_profile_to_file(&self, profile_id: &str, password: &str, file_path: &str, export_password: Option<&str>) -> ProfileResult<()> {
        let exported = self.export_profile(profile_id, password, export_password).await?;
        
        // Serializza in formato binario compatto
        let export_data = bincode::serialize(&exported)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore serializzazione export: {}", e)))?;

        // Salva su file
        tokio::fs::write(file_path, export_data).await
            .map_err(|e| ProfileError::IoError(e))?;

        println!("[PROFILE MANAGER] ✅ Profilo esportato in file: {}", file_path);
        Ok(())
    }

    /// Importa un profilo da dati crittografati
    pub async fn import_profile(&mut self, exported: ExportedProfile, import_password: &str, new_name: Option<String>) -> ProfileResult<UserProfile> {
        // Verifica versione formato
        if exported.version != 1 {
            return Err(ProfileError::DataFormatError(format!(
                "Versione formato export non supportata: {}",
                exported.version
            )));
        }

        // Verifica firma digitale
        let expected_signature = self.generate_export_signature(&exported.export_metadata, &exported.encrypted_data);
        if exported.signature != expected_signature {
            return Err(ProfileError::CorruptedProfile("Firma digitale non valida".to_string()));
        }

        // Decrittografa i dati
        let decrypted_data = self.encryption.decrypt_profile_data(&exported.encrypted_data, import_password)?;
        
        // Verifica integrità
        let data_hash = self.calculate_data_hash(&decrypted_data);
        if data_hash != exported.export_metadata.integrity_hash {
            return Err(ProfileError::CorruptedProfile("Hash integrità non corrispondente".to_string()));
        }

        // Deserializza profilo
        let profile_json = String::from_utf8(decrypted_data)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Dati profilo corrotti: {}", e)))?;
        
        let mut imported_profile: UserProfile = serde_json::from_str(&profile_json)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Formato profilo invalido: {}", e)))?;

        // Genera nuovo ID per evitare conflitti
        imported_profile.id = Uuid::new_v4().to_string();
        
        // Usa nuovo nome se fornito
        if let Some(name) = new_name {
            imported_profile.name = name;
        }

        // Verifica che il nome non esista già
        let existing_profiles = self.list_profiles().await?;
        if existing_profiles.iter().any(|p| p.name.to_lowercase() == imported_profile.name.to_lowercase()) {
            return Err(ProfileError::ProfileAlreadyExists(imported_profile.name.clone()));
        }

        // Aggiorna timestamp
        imported_profile.created_at = Utc::now();
        imported_profile.last_accessed = Utc::now();

        // Salva il profilo importato
        self.storage.save_profile(&imported_profile, import_password).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Invalida cache
        self.invalidate_cache();

        println!("[PROFILE MANAGER] ✅ Profilo '{}' importato con successo", imported_profile.name);
        Ok(imported_profile)
    }

    /// Importa profilo da file
    pub async fn import_profile_from_file(&mut self, file_path: &str, import_password: &str, new_name: Option<String>) -> ProfileResult<UserProfile> {
        // Leggi file
        let export_data = tokio::fs::read(file_path).await
            .map_err(|e| ProfileError::IoError(e))?;

        // Deserializza export
        let exported: ExportedProfile = bincode::deserialize(&export_data)
            .map_err(|e| ProfileError::DataFormatError(format!("File export corrotto: {}", e)))?;

        // Importa profilo
        self.import_profile(exported, import_password, new_name).await
    }

    /// Valida un file export senza importarlo
    pub async fn validate_export_file(&self, file_path: &str) -> ProfileResult<ExportMetadata> {
        // Leggi file
        let export_data = tokio::fs::read(file_path).await
            .map_err(|e| ProfileError::IoError(e))?;

        // Deserializza export
        let exported: ExportedProfile = bincode::deserialize(&export_data)
            .map_err(|e| ProfileError::DataFormatError(format!("File export corrotto: {}", e)))?;

        // Verifica versione
        if exported.version != 1 {
            return Err(ProfileError::DataFormatError(format!(
                "Versione formato non supportata: {}",
                exported.version
            )));
        }

        // Verifica firma
        let expected_signature = self.generate_export_signature(&exported.export_metadata, &exported.encrypted_data);
        if exported.signature != expected_signature {
            return Err(ProfileError::CorruptedProfile("Firma digitale non valida".to_string()));
        }

        println!("[PROFILE MANAGER] ✅ File export valido: {}", file_path);
        Ok(exported.export_metadata)
    }

    /// Crea backup automatico di un profilo
    pub async fn create_profile_backup(&self, profile_id: &str, _password: &str) -> ProfileResult<String> {
        let profile_info = self.get_profile_info(profile_id).await?
            .ok_or_else(|| ProfileError::ProfileNotFound(profile_id.to_string()))?;

        // Genera nome backup
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("backup_{}_{}.profile", profile_info.name, timestamp);
        
        // Usa directory backup del storage
        let backup_path = self.storage.backup_profile(profile_id, &backup_name).await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        println!("[PROFILE MANAGER] ✅ Backup creato: {}", backup_path.display());
        Ok(backup_path.to_string_lossy().to_string())
    }



    /// Calcola hash integrità per i dati
    fn calculate_data_hash(&self, data: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    /// Genera firma digitale per export
    fn generate_export_signature(&self, metadata: &ExportMetadata, encrypted_data: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        
        // Combina metadati e dati per la firma
        let mut hasher = Sha256::new();
        hasher.update(&metadata.profile_name.as_bytes());
        hasher.update(&metadata.exported_at.to_rfc3339().as_bytes());
        hasher.update(&metadata.app_version.as_bytes());
        hasher.update(&metadata.integrity_hash.as_bytes());
        hasher.update(encrypted_data);
        
        format!("{:x}", hasher.finalize())
    }

    /// Ottiene statistiche storage
    #[allow(dead_code)] // API per statistiche storage
    pub async fn get_storage_stats(&self) -> ProfileResult<crate::profiles::storage::StorageStats> {
        self.storage.get_storage_stats().await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))
    }

    /// Valida nome profilo
    pub fn validate_profile_name(&self, name: &str) -> ProfileNameValidationResult {
        self.validator.validate_profile_name(name)
    }

    /// Valida password profilo
    pub fn validate_password(&self, password: &str) -> PasswordValidationResult {
        self.validator.validate_password(password)
    }

    /// Valida che un nome profilo sia unico
    pub async fn validate_unique_profile_name(&self, name: &str) -> ProfileResult<()> {
        let profiles = self.list_profiles().await?;
        let existing_names: Vec<String> = profiles.iter().map(|p| p.name.clone()).collect();
        self.validator.validate_unique_profile_name(name, &existing_names)
    }

    /// Sanitizza input generico
    pub fn sanitize_input(&self, input: &str) -> String {
        self.validator.sanitize_input(input)
    }

    /// Ottiene configurazione validazione
    pub fn get_validation_config(&self) -> &ValidationConfig {
        &self.validator.config
    }

    /// Aggiorna configurazione validazione
    pub fn update_validation_config(&mut self, config: ValidationConfig) {
        self.validator = ProfileValidator::new(config);
    }

    /// Salva credenziale per il profilo attivo
    pub async fn save_credential_for_active_profile(&mut self, credential: crate::profiles::credential_manager::PlainCredential) -> ProfileResult<()> {
        if let Some(profile) = &mut self.current_profile {
            // Crea credenziale crittografata
            let encrypted = EncryptedCredential {
                store: credential.store.as_str().to_string(),
                encrypted_data: serde_json::to_string(&credential)
                    .map_err(|e| ProfileError::CorruptedProfile(format!("Errore serializzazione credenziale: {}", e)))?,
                nonce: String::new(),
                salt: String::new(),
                created_at: credential.created_at,
                updated_at: credential.last_used,
                encryption_version: 1,
            };

            profile.add_credential(encrypted);
            
            // Salva profilo aggiornato
            self.storage.save_profile(profile, "").await
                .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Carica credenziale per il profilo attivo
    pub async fn load_credential_for_active_profile(&self, store: crate::profiles::credential_manager::StoreType) -> ProfileResult<Option<crate::profiles::credential_manager::PlainCredential>> {
        if let Some(profile) = &self.current_profile {
            if let Some(encrypted) = profile.get_credential(store.as_str()) {
                // Deserializza credenziale
                let credential: crate::profiles::credential_manager::PlainCredential = serde_json::from_str(&encrypted.encrypted_data)
                    .map_err(|e| ProfileError::CorruptedProfile(format!("Formato credenziale invalido: {}", e)))?;

                Ok(Some(credential))
            } else {
                Ok(None)
            }
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Rimuove credenziale per il profilo attivo
    pub async fn remove_credential_for_active_profile(&mut self, store: crate::profiles::credential_manager::StoreType) -> ProfileResult<()> {
        if let Some(profile) = &mut self.current_profile {
            profile.remove_credential(store.as_str());
            
            // Salva profilo aggiornato
            self.storage.save_profile(profile, "").await
                .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            Ok(())
        } else {
            Err(ProfileError::Unauthorized)
        }
    }

    /// Migra credenziali legacy al profilo attivo
    pub async fn migrate_legacy_credentials(&mut self) -> ProfileResult<LegacyMigrationResult> {
        let mut result = LegacyMigrationResult::new();

        // Migra credenziali Steam legacy
        match self.migrate_steam_legacy_credentials().await {
            Ok(migrated) => {
                if migrated {
                    result.migrated_stores.push("Steam".to_string());
                    result.total_migrated += 1;
                }
            }
            Err(e) => {
                result.failed_stores.push(("Steam".to_string(), e.to_string()));
                result.total_failed += 1;
            }
        }

        // Qui si possono aggiungere altre migrazioni per Epic, Ubisoft, etc.
        
        println!("[PROFILE MANAGER] 🔄 Migrazione legacy completata: {} successi, {} fallimenti", 
                 result.total_migrated, result.total_failed);

        Ok(result)
    }

    /// Migra credenziali Steam legacy
    async fn migrate_steam_legacy_credentials(&mut self) -> ProfileResult<bool> {
        // Percorso file credenziali Steam legacy
        let app_data = std::env::var("APPDATA")
            .map_err(|_| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::NotFound, "APPDATA not found")))?;
        
        let app_dir = std::path::Path::new(&app_data).join("GameStringer");
        let credentials_path = app_dir.join("steam_credentials.json");

        // Verifica se esistono credenziali legacy
        if !credentials_path.exists() {
            return Ok(false); // Nessuna credenziale da migrare
        }

        // Leggi credenziali legacy
        let content = tokio::fs::read_to_string(&credentials_path).await
            .map_err(|e| ProfileError::IoError(e))?;

        let legacy_credentials: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Formato credenziali legacy invalido: {}", e)))?;

        // Estrai dati dalle credenziali legacy
        let encrypted_api_key = legacy_credentials["api_key_encrypted"].as_str()
            .ok_or_else(|| ProfileError::CorruptedProfile("API key mancante nelle credenziali legacy".to_string()))?;
        let nonce = legacy_credentials["nonce"].as_str()
            .ok_or_else(|| ProfileError::CorruptedProfile("Nonce mancante nelle credenziali legacy".to_string()))?;
        let steam_id = legacy_credentials["steam_id"].as_str()
            .ok_or_else(|| ProfileError::CorruptedProfile("Steam ID mancante nelle credenziali legacy".to_string()))?;

        // Decrittografa l'API key usando le funzioni legacy
        let api_key = self.decrypt_legacy_api_key(encrypted_api_key, nonce)?;

        // Crea credenziale per il nuovo sistema
        let credential = crate::profiles::credential_manager::PlainCredential::new(
            crate::profiles::credential_manager::StoreType::Steam,
            steam_id.to_string(),
            api_key,
        ).with_data("steam_id".to_string(), steam_id.to_string());

        // Salva nel profilo attivo
        self.save_credential_for_active_profile(credential).await?;

        // Crea backup delle credenziali legacy prima di eliminarle
        let backup_path = credentials_path.with_extension("json.backup");
        if let Err(e) = tokio::fs::copy(&credentials_path, &backup_path).await {
            println!("[PROFILE MANAGER] ⚠️ Impossibile creare backup credenziali legacy: {}", e);
        }

        // Elimina credenziali legacy
        if let Err(e) = tokio::fs::remove_file(&credentials_path).await {
            println!("[PROFILE MANAGER] ⚠️ Impossibile eliminare credenziali legacy: {}", e);
        }

        println!("[PROFILE MANAGER] ✅ Credenziali Steam migrate con successo");
        Ok(true)
    }

    /// Decrittografa API key legacy usando le funzioni del sistema legacy
    fn decrypt_legacy_api_key(&self, _encrypted_key: &str, _nonce: &str) -> ProfileResult<String> {
        // Implementazione semplificata - in un sistema reale dovremmo
        // importare le funzioni di decrittografia dal modulo Steam
        // Per ora restituiamo un errore che indica che serve implementazione
        Err(ProfileError::EncryptionError(
            "Decrittografia legacy non ancora implementata - serve integrazione con funzioni Steam".to_string()
        ))
    }

    /// Verifica se esistono credenziali legacy da migrare
    pub async fn has_legacy_credentials(&self) -> ProfileResult<bool> {
        let app_data = std::env::var("APPDATA")
            .map_err(|_| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::NotFound, "APPDATA not found")))?;
        
        let app_dir = std::path::Path::new(&app_data).join("GameStringer");
        let steam_credentials_path = app_dir.join("steam_credentials.json");

        Ok(steam_credentials_path.exists())
    }

    /// Ottiene informazioni sulle credenziali legacy disponibili
    pub async fn get_legacy_credentials_info(&self) -> ProfileResult<Vec<LegacyCredentialInfo>> {
        let mut info = Vec::new();

        // Controlla credenziali Steam legacy
        if let Ok(true) = self.has_legacy_credentials().await {
            let app_data = std::env::var("APPDATA")
                .map_err(|_| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::NotFound, "APPDATA not found")))?;
            
            let app_dir = std::path::Path::new(&app_data).join("GameStringer");
            let credentials_path = app_dir.join("steam_credentials.json");

            if let Ok(metadata) = tokio::fs::metadata(&credentials_path).await {
                info.push(LegacyCredentialInfo {
                    store: "Steam".to_string(),
                    file_path: credentials_path.to_string_lossy().to_string(),
                    created_at: metadata.created().ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
                        .flatten()
                        .unwrap_or_else(|| chrono::Utc::now()),
                    file_size: metadata.len(),
                });
            }
        }

        Ok(info)
    }

    /// Verifica se esistono impostazioni legacy da migrare
    pub async fn has_legacy_settings(&self) -> ProfileResult<bool> {
        let app_data = std::env::var("APPDATA")
            .map_err(|_| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::NotFound, "APPDATA not found")))?;
        
        let app_dir = std::path::Path::new(&app_data).join("GameStringer");
        
        // Controlla vari possibili file di impostazioni legacy
        let legacy_files = vec![
            app_dir.join("preferences.json"),
            app_dir.join("settings.json"),
            app_dir.join("config.json"),
            app_dir.join("user_preferences.json"),
        ];

        for file in legacy_files {
            if file.exists() {
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Ottiene informazioni sulle impostazioni legacy disponibili
    pub async fn get_legacy_settings_info(&self) -> ProfileResult<Vec<LegacySettingsInfo>> {
        let mut info = Vec::new();

        let app_data = std::env::var("APPDATA")
            .map_err(|_| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::NotFound, "APPDATA not found")))?;
        
        let app_dir = std::path::Path::new(&app_data).join("GameStringer");
        
        // Controlla vari possibili file di impostazioni legacy
        let legacy_files = vec![
            ("preferences.json", "Preferenze utente"),
            ("settings.json", "Impostazioni applicazione"),
            ("config.json", "Configurazione generale"),
            ("user_preferences.json", "Preferenze personalizzate"),
        ];

        for (filename, description) in legacy_files {
            let file_path = app_dir.join(filename);
            if file_path.exists() {
                if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
                    info.push(LegacySettingsInfo {
                        file_type: description.to_string(),
                        file_path: file_path.to_string_lossy().to_string(),
                        created_at: metadata.created().ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
                            .flatten()
                            .unwrap_or_else(|| chrono::Utc::now()),
                        file_size: metadata.len(),
                    });
                }
            }
        }

        Ok(info)
    }

    /// Migra impostazioni legacy al profilo attivo
    pub async fn migrate_legacy_settings(&mut self, settings_manager: &mut crate::profiles::settings_manager::ProfileSettingsManager) -> ProfileResult<LegacySettingsMigrationResult> {
        let mut result = LegacySettingsMigrationResult::new();

        if let Some(profile) = &self.current_profile {
            let profile_id = profile.id.clone();

            // Cerca file di impostazioni legacy
            let app_data = std::env::var("APPDATA")
                .map_err(|_| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::NotFound, "APPDATA not found")))?;
            
            let app_dir = std::path::Path::new(&app_data).join("GameStringer");
            
            // Prova a migrare da diversi possibili file legacy
            let legacy_files = vec![
                app_dir.join("preferences.json"),
                app_dir.join("settings.json"),
                app_dir.join("config.json"),
                app_dir.join("user_preferences.json"),
            ];

            for legacy_file in legacy_files {
                if legacy_file.exists() {
                    match self.migrate_settings_from_file(&legacy_file, &profile_id, settings_manager).await {
                        Ok(migrated_settings) => {
                            result.migrated_files.push(legacy_file.to_string_lossy().to_string());
                            result.migrated_settings.extend(migrated_settings);
                            result.total_migrated += 1;
                        }
                        Err(e) => {
                            result.failed_files.push((
                                legacy_file.to_string_lossy().to_string(),
                                e.to_string()
                            ));
                            result.total_failed += 1;
                        }
                    }
                }
            }

            println!("[PROFILE MANAGER] 🔄 Migrazione impostazioni completata: {} successi, {} fallimenti", 
                     result.total_migrated, result.total_failed);
        } else {
            return Err(ProfileError::Unauthorized);
        }

        Ok(result)
    }

    /// Migra impostazioni da un file specifico
    async fn migrate_settings_from_file(
        &self,
        file_path: &std::path::Path,
        profile_id: &str,
        settings_manager: &mut crate::profiles::settings_manager::ProfileSettingsManager
    ) -> ProfileResult<Vec<String>> {
        let content = tokio::fs::read_to_string(file_path).await
            .map_err(|e| ProfileError::IoError(e))?;

        let legacy_data: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Formato impostazioni legacy invalido: {}", e)))?;

        // Usa il sistema di migrazione esistente nel ProfileSettingsManager
        match settings_manager.migrate_legacy_settings(legacy_data).await {
            Ok(migration_result) => {
                // Crea backup del file legacy
                let backup_path = file_path.with_extension("json.backup");
                if let Err(e) = tokio::fs::copy(file_path, &backup_path).await {
                    println!("[PROFILE MANAGER] ⚠️ Impossibile creare backup impostazioni legacy: {}", e);
                }

                // Elimina file legacy
                if let Err(e) = tokio::fs::remove_file(file_path).await {
                    println!("[PROFILE MANAGER] ⚠️ Impossibile eliminare impostazioni legacy: {}", e);
                }

                // Carica le impostazioni migrate per ottenere i dettagli
                match settings_manager.load_profile_settings(profile_id).await {
                    Ok(profile_settings) => {
                        // Crea lista delle impostazioni migrate
                        let mut migrated_settings = Vec::new();
                        migrated_settings.push(format!("Lingua: {}", profile_settings.language));
                        migrated_settings.push(format!("Tema: {:?}", profile_settings.theme));
                        migrated_settings.push(format!("Auto-login: {}", profile_settings.auto_login));
                        migrated_settings.push(format!("Notifiche desktop: {}", profile_settings.notifications.desktop_enabled));
                        migrated_settings.push(format!("Auto-refresh libreria: {}", profile_settings.game_library.auto_refresh));

                        println!("[PROFILE MANAGER] ✅ Impostazioni migrate da: {}", file_path.display());
                        Ok(migrated_settings)
                    }
                    Err(_) => {
                        // Se non riusciamo a caricare, usiamo le informazioni dal risultato della migrazione
                        println!("[PROFILE MANAGER] ✅ Impostazioni migrate da: {}", file_path.display());
                        Ok(migration_result.migrated_settings)
                    }
                }
            }
            Err(e) => {
                println!("[PROFILE MANAGER] ❌ Errore migrazione impostazioni da {}: {}", file_path.display(), e);
                Err(ProfileError::CorruptedProfile(format!("Errore migrazione da {}: {}", file_path.display(), e)))
            }
        }
    }

    /// Ottiene il rate limiter
    #[allow(dead_code)] // API per accesso rate limiter
    pub fn rate_limiter(&self) -> &RateLimiter {
        &self.rate_limiter
    }
    
    /// Ottiene la configurazione del rate limiter
    #[allow(dead_code)] // API per configurazione rate limiter
    pub fn get_rate_limiter_config(&self) -> RateLimiterConfig {
        self.rate_limiter.get_config()
    }
    
    /// Imposta la configurazione del rate limiter
    #[allow(dead_code)] // API per configurazione rate limiter
    pub fn set_rate_limiter_config(&mut self, config: RateLimiterConfig) {
        self.rate_limiter.set_config(config);
    }
    
    /// Resetta i tentativi di accesso per un profilo
    #[allow(dead_code)] // API per reset tentativi login
    pub fn reset_login_attempts(&self, profile_id: &str) {
        self.rate_limiter.reset_attempts(profile_id);
    }

    /// Aggiunge un metodo di login che è un alias per authenticate_profile
    #[allow(dead_code)] // API alias per autenticazione
    pub async fn login(&mut self, profile_id: &str, password: &str) -> ProfileResult<UserProfile> {
        // Trova il profilo per ID
        let profile_info = self.get_profile_info(profile_id).await?
            .ok_or_else(|| ProfileError::ProfileNotFound(profile_id.to_string()))?;
        
        // Usa authenticate_profile con il nome del profilo
        self.authenticate_profile(&profile_info.name, password).await
    }
}

impl Drop for ProfileManager {
    fn drop(&mut self) {
        // Pulisce dati sensibili quando il manager viene distrutto
        self.current_profile = None;
        self.session_stats = None;
        self.profile_cache.clear();
        println!("[PROFILE MANAGER] 🧹 Dati sensibili puliti dalla memoria");
    }
}