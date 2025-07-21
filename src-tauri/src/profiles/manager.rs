// Modulo per gestione profili - ProfileManager core
use crate::profiles::models::{UserProfile, ProfileInfo, CreateProfileRequest, ProfileSettings, EncryptedCredential};
use crate::profiles::storage::ProfileStorage;
use crate::profiles::encryption::ProfileEncryption;
use crate::profiles::errors::{ProfileError, ProfileResult};
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

/// Manager principale per gestione profili utente
pub struct ProfileManager {
    /// Profilo attualmente attivo
    current_profile: Option<UserProfile>,
    /// Sistema di storage
    storage: ProfileStorage,
    /// Sistema di crittografia
    encryption: ProfileEncryption,
    /// Statistiche sessione corrente
    session_stats: Option<ProfileSessionStats>,
    /// Cache profili per performance
    profile_cache: HashMap<String, ProfileInfo>,
    /// Timestamp ultimo refresh cache
    cache_last_refresh: Option<DateTime<Utc>>,
    /// Durata cache in secondi
    cache_duration: u64,
}

impl ProfileManager {
    /// Crea nuovo ProfileManager
    pub fn new(storage: ProfileStorage) -> Self {
        Self {
            current_profile: None,
            storage,
            encryption: ProfileEncryption::new(),
            session_stats: None,
            profile_cache: HashMap::new(),
            cache_last_refresh: None,
            cache_duration: 300, // 5 minuti
        }
    }

    /// Crea ProfileManager con configurazione personalizzata
    pub fn with_config(storage: ProfileStorage, cache_duration_seconds: u64) -> Self {
        Self {
            current_profile: None,
            storage,
            encryption: ProfileEncryption::new(),
            session_stats: None,
            profile_cache: HashMap::new(),
            cache_last_refresh: None,
            cache_duration: cache_duration_seconds,
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
        // Valida richiesta
        request.validate()?;

        // Verifica forza password
        self.encryption.validate_password_strength(&request.password)?;

        // Controlla se profilo esiste già
        let existing_profiles = self.list_profiles().await?;
        if existing_profiles.iter().any(|p| p.name.to_lowercase() == request.name.to_lowercase()) {
            return Err(ProfileError::ProfileAlreadyExists(request.name));
        }

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
    pub async fn count_profiles(&self) -> ProfileResult<usize> {
        let profiles = self.list_profiles().await?;
        Ok(profiles.len())
    }

    /// Verifica se esistono profili
    pub async fn has_profiles(&self) -> ProfileResult<bool> {
        let count = self.count_profiles().await?;
        Ok(count > 0)
    }

    /// Ottiene profilo più recente
    pub async fn get_most_recent_profile(&self) -> ProfileResult<Option<ProfileInfo>> {
        let profiles = self.list_profiles().await?;
        Ok(profiles.into_iter().max_by_key(|p| p.last_accessed))
    }

    /// Invalida cache profili
    fn invalidate_cache(&mut self) {
        self.profile_cache.clear();
        self.cache_last_refresh = None;
    }

    /// Aggiorna cache profili
    async fn refresh_cache(&mut self) -> ProfileResult<()> {
        let profiles = self.storage.list_profile_info().await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        self.profile_cache.clear();
        for profile in profiles {
            self.profile_cache.insert(profile.id.clone(), profile);
        }
        self.cache_last_refresh = Some(Utc::now());

        Ok(())
    }

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

    /// Finalizza statistiche sessione
    fn finalize_session_stats(&mut self) {
        if let Some(stats) = &mut self.session_stats {
            stats.total_session_time = Utc::now()
                .signed_duration_since(stats.session_start)
                .num_seconds() as u64;
        }
    }

    /// Autentica un profilo con nome e password
    pub async fn authenticate_profile(&mut self, name: &str, password: &str) -> ProfileResult<UserProfile> {
        // Trova profilo per nome
        let profiles = self.list_profiles().await?;
        let profile_info = profiles.iter()
            .find(|p| p.name.to_lowercase() == name.to_lowercase())
            .ok_or_else(|| ProfileError::ProfileNotFound(name.to_string()))?;

        // Verifica se profilo è bloccato
        if profile_info.is_locked {
            return Err(ProfileError::TooManyAttempts);
        }

        // Tenta di caricare il profilo con la password
        match self.storage.load_profile(&profile_info.id, password).await {
            Ok(mut profile) => {
                // Reset tentativi falliti
                let _ = self.storage.update_failed_attempts(&profile_info.id, false).await;

                // Aggiorna ultimo accesso
                profile.update_last_access();
                
                // Salva aggiornamento ultimo accesso
                let _ = self.storage.save_profile(&profile, password).await;

                // Imposta come profilo corrente
                self.current_profile = Some(profile.clone());
                
                // Inizializza statistiche sessione
                self.init_session_stats();

                // Invalida cache
                self.invalidate_cache();

                println!("[PROFILE MANAGER] ✅ Profilo '{}' autenticato con successo", profile.name);
                Ok(profile)
            }
            Err(_) => {
                // Incrementa tentativi falliti
                let failed_attempts = self.storage.update_failed_attempts(&profile_info.id, true).await
                    .unwrap_or(0);

                println!("[PROFILE MANAGER] ❌ Autenticazione fallita per '{}' (tentativo {})", name, failed_attempts);
                
                if failed_attempts >= 5 {
                    Err(ProfileError::TooManyAttempts)
                } else {
                    Err(ProfileError::InvalidPassword)
                }
            }
        }
    }

    /// Autentica un profilo tramite ID
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
    pub fn force_logout_all(&mut self) {
        self.current_profile = None;
        self.session_stats = None;
        self.invalidate_cache();
        println!("[PROFILE MANAGER] 🚨 Logout forzato di tutti i profili");
    }

    /// Verifica integrità del profilo corrente
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

    /// Lista tutti i backup disponibili
    pub async fn list_profile_backups(&self) -> ProfileResult<Vec<String>> {
        // Implementazione semplificata - in un sistema reale si potrebbe
        // scansionare la directory backup per trovare tutti i file
        println!("[PROFILE MANAGER] ℹ️ Lista backup non implementata completamente");
        Ok(vec![])
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
    pub async fn get_storage_stats(&self) -> ProfileResult<crate::profiles::storage::StorageStats> {
        self.storage.get_storage_stats().await
            .map_err(|e| ProfileError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))
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