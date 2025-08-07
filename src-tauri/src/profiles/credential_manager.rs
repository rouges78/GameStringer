// Credential Manager integrato con sistema profili
use crate::profiles::models::EncryptedCredential;
use crate::profiles::manager::ProfileManager;
use crate::profiles::errors::{ProfileError, ProfileResult};
use crate::profiles::encryption::ProfileEncryption;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tipi di store supportati
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum StoreType {
    Steam,
    Epic,
    Ubisoft,
    Origin,
    Gog,
    Battlenet,
    Rockstar,
    Itchio,
}

impl StoreType {
    pub fn as_str(&self) -> &'static str {
        match self {
            StoreType::Steam => "steam",
            StoreType::Epic => "epic",
            StoreType::Ubisoft => "ubisoft",
            StoreType::Origin => "origin",
            StoreType::Gog => "gog",
            StoreType::Battlenet => "battlenet",
            StoreType::Rockstar => "rockstar",
            StoreType::Itchio => "itchio",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "steam" => Some(StoreType::Steam),
            "epic" => Some(StoreType::Epic),
            "ubisoft" => Some(StoreType::Ubisoft),
            "origin" => Some(StoreType::Origin),
            "gog" => Some(StoreType::Gog),
            "battlenet" => Some(StoreType::Battlenet),
            "rockstar" => Some(StoreType::Rockstar),
            "itchio" => Some(StoreType::Itchio),
            _ => None,
        }
    }
}

/// Credenziali non crittografate per uso interno
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlainCredential {
    /// Tipo di store
    pub store: StoreType,
    /// Username/email
    pub username: String,
    /// Password o API key
    pub password: String,
    /// Dati aggiuntivi specifici dello store
    pub additional_data: HashMap<String, String>,
    /// Data creazione
    pub created_at: DateTime<Utc>,
    /// Data ultimo utilizzo
    pub last_used: DateTime<Utc>,
}

impl PlainCredential {
    /// Crea nuova credenziale
    pub fn new(store: StoreType, username: String, password: String) -> Self {
        let now = Utc::now();
        Self {
            store,
            username,
            password,
            additional_data: HashMap::new(),
            created_at: now,
            last_used: now,
        }
    }

    /// Aggiunge dato aggiuntivo
    pub fn with_data(mut self, key: String, value: String) -> Self {
        self.additional_data.insert(key, value);
        self
    }

    /// Aggiorna ultimo utilizzo
    pub fn update_last_used(&mut self) {
        self.last_used = Utc::now();
    }

    /// Converte in credenziale crittografata
    pub fn encrypt(&self, encryption: &ProfileEncryption, password: &str) -> ProfileResult<EncryptedCredential> {
        // Serializza i dati della credenziale
        let credential_json = serde_json::to_string(self)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore serializzazione credenziale: {}", e)))?;

        // Crittografa i dati
        let encrypted_data = encryption.encrypt_profile_data(credential_json.as_bytes(), password)?;

        // Converte Vec<u8> in String base64
        let encrypted_data_str = base64::encode(&encrypted_data);

        Ok(EncryptedCredential {
            store: self.store.as_str().to_string(),
            encrypted_data: encrypted_data_str,
            nonce: String::new(), // Placeholder - il nonce è gestito internamente
            salt: String::new(),  // Placeholder - il salt è gestito internamente
            created_at: self.created_at,
            updated_at: self.last_used,
            encryption_version: 1,
        })
    }
}

/// Manager per credenziali integrate con profili
pub struct ProfileCredentialManager {
    /// Riferimento al profile manager
    _profile_manager: Option<ProfileManager>,  // Riservato per integrazione futura
    /// Sistema di crittografia
    _encryption: ProfileEncryption,  // Riservato per crittografia credenziali
}

impl ProfileCredentialManager {
    /// Crea nuovo credential manager
    pub fn new() -> Self {
        Self {
            _profile_manager: None,
            _encryption: ProfileEncryption::new(),
        }
    }

    /// Imposta il profile manager
    pub fn set_profile_manager(&mut self, manager: ProfileManager) {
        self._profile_manager = Some(manager);
    }

    /// Salva credenziale per il profilo attivo
    pub async fn save_credential(&mut self, credential: PlainCredential, profile_password: &str) -> ProfileResult<()> {
        let manager = self._profile_manager.as_mut()
            .ok_or(ProfileError::Unauthorized)?;

        // Verifica che ci sia un profilo attivo
        if !manager.is_profile_active() {
            return Err(ProfileError::Unauthorized);
        }

        // Crittografa la credenziale
        let encrypted = credential.encrypt(&self._encryption, profile_password)?;

        // Salva nel profilo attivo
        manager.add_credential(encrypted, profile_password).await?;

        println!("[CREDENTIAL MANAGER] ✅ Credenziale salvata per store: {}", credential.store.as_str());
        Ok(())
    }

    /// Carica credenziale per il profilo attivo
    pub async fn load_credential(&self, store: StoreType, profile_password: &str) -> ProfileResult<PlainCredential> {
        let manager = self._profile_manager.as_ref()
            .ok_or(ProfileError::Unauthorized)?;

        // Verifica che ci sia un profilo attivo
        if !manager.is_profile_active() {
            return Err(ProfileError::Unauthorized);
        }

        // Ottieni credenziale crittografata
        let encrypted = manager.get_credential(store.as_str())
            .ok_or_else(|| ProfileError::ProfileNotFound(format!("Credenziale {} non trovata", store.as_str())))?;

        // Decodifica da base64 e decrittografa i dati
        let encrypted_bytes = base64::decode(&encrypted.encrypted_data)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Errore decodifica base64: {}", e)))?;
        let decrypted_data = self._encryption.decrypt_profile_data(&encrypted_bytes, profile_password)?;

        // Deserializza credenziale
        let credential_json = String::from_utf8(decrypted_data)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Dati credenziale corrotti: {}", e)))?;

        let mut credential: PlainCredential = serde_json::from_str(&credential_json)
            .map_err(|e| ProfileError::CorruptedProfile(format!("Formato credenziale invalido: {}", e)))?;

        // Aggiorna ultimo utilizzo
        credential.update_last_used();

        println!("[CREDENTIAL MANAGER] ✅ Credenziale caricata per store: {}", store.as_str());
        Ok(credential)
    }

    /// Rimuove credenziale per il profilo attivo
    pub async fn remove_credential(&mut self, store: StoreType, profile_password: &str) -> ProfileResult<()> {
        let manager = self._profile_manager.as_mut()
            .ok_or(ProfileError::Unauthorized)?;

        // Verifica che ci sia un profilo attivo
        if !manager.is_profile_active() {
            return Err(ProfileError::Unauthorized);
        }

        // Rimuovi credenziale
        manager.remove_credential(store.as_str(), profile_password).await?;

        println!("[CREDENTIAL MANAGER] ✅ Credenziale rimossa per store: {}", store.as_str());
        Ok(())
    }

    /// Lista tutti gli store con credenziali salvate
    pub fn list_stored_credentials(&self) -> ProfileResult<Vec<StoreType>> {
        let manager = self._profile_manager.as_ref()
            .ok_or(ProfileError::Unauthorized)?;

        let profile = manager.current_profile()
            .ok_or(ProfileError::Unauthorized)?;

        let stores: Vec<StoreType> = profile.credentials.keys()
            .filter_map(|store_str| StoreType::from_str(store_str))
            .collect();

        Ok(stores)
    }

    /// Verifica se esiste credenziale per uno store
    pub fn has_credential(&self, store: StoreType) -> ProfileResult<bool> {
        let manager = self._profile_manager.as_ref()
            .ok_or(ProfileError::Unauthorized)?;

        let profile = manager.current_profile()
            .ok_or(ProfileError::Unauthorized)?;

        Ok(profile.credentials.contains_key(store.as_str()))
    }

    /// Ottiene informazioni sulle credenziali senza decrittografarle
    pub fn get_credential_info(&self, store: StoreType) -> ProfileResult<Option<CredentialInfo>> {
        let manager = self._profile_manager.as_ref()
            .ok_or(ProfileError::Unauthorized)?;

        let profile = manager.current_profile()
            .ok_or(ProfileError::Unauthorized)?;

        if let Some(encrypted) = profile.credentials.get(store.as_str()) {
            Ok(Some(CredentialInfo {
                store,
                created_at: encrypted.created_at,
                last_used: encrypted.updated_at,
                has_data: !encrypted.encrypted_data.is_empty(),
            }))
        } else {
            Ok(None)
        }
    }

    /// Migra credenziali esistenti dal sistema legacy
    pub async fn migrate_legacy_credentials(&mut self, profile_password: &str) -> ProfileResult<MigrationResult> {
        let mut result = MigrationResult::default();

        // Migra credenziali Steam
        if let Ok(steam_creds) = self.load_legacy_steam_credentials().await {
            match self.save_credential(steam_creds, profile_password).await {
                Ok(_) => result._migrated.push(StoreType::Steam),
                Err(e) => result._failed.push((StoreType::Steam, e.to_string())),
            }
        }

        // Migra credenziali Ubisoft
        if let Ok(ubisoft_creds) = self.load_legacy_ubisoft_credentials().await {
            match self.save_credential(ubisoft_creds, profile_password).await {
                Ok(_) => result._migrated.push(StoreType::Ubisoft),
                Err(e) => result._failed.push((StoreType::Ubisoft, e.to_string())),
            }
        }

        // Aggiungi altri store qui...

        println!("[CREDENTIAL MANAGER] 🔄 Migrazione completata: {} successi, {} fallimenti", 
                 result._migrated.len(), result._failed.len());

        Ok(result)
    }

    /// Carica credenziali Steam legacy
    async fn load_legacy_steam_credentials(&self) -> ProfileResult<PlainCredential> {
        // Implementazione placeholder - dovrebbe leggere dal sistema legacy
        Err(ProfileError::ProfileNotFound("Credenziali Steam legacy non trovate".to_string()))
    }

    /// Carica credenziali Ubisoft legacy
    async fn load_legacy_ubisoft_credentials(&self) -> ProfileResult<PlainCredential> {
        // Implementazione placeholder - dovrebbe leggere dal sistema legacy
        Err(ProfileError::ProfileNotFound("Credenziali Ubisoft legacy non trovate".to_string()))
    }
}

/// Informazioni credenziale senza dati sensibili
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialInfo {
    pub store: StoreType,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub has_data: bool,
}

/// Risultato migrazione credenziali legacy
#[derive(Debug, Clone, Default)]
pub struct MigrationResult {
    pub _migrated: Vec<StoreType>,  // Lista store migrati con successo
    pub _failed: Vec<(StoreType, String)>,  // Lista store falliti con errore
}

impl Default for ProfileCredentialManager {
    fn default() -> Self {
        Self::new()
    }
}