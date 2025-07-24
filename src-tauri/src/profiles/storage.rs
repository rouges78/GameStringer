use crate::profiles::models::{UserProfile, ProfileInfo};
use crate::profiles::errors::{StorageError, StorageResult};
use crate::profiles::encryption::ProfileEncryption;
use crate::profiles::secure_memory::SecureMemory;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tokio::fs as async_fs;

/// Indice dei profili (non crittografato)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileIndex {
    /// Versione formato indice
    pub version: u32,
    /// Mappa ID profilo -> metadati
    pub profiles: HashMap<String, ProfileIndexEntry>,
    /// Data ultimo aggiornamento
    pub last_updated: DateTime<Utc>,
}

/// Entry nell'indice profili
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileIndexEntry {
    /// ID profilo
    pub id: String,
    /// Nome profilo
    pub name: String,
    /// Percorso file profilo crittografato
    pub file_path: String,
    /// Percorso avatar (opzionale)
    pub avatar_path: Option<String>,
    /// Data creazione
    pub created_at: DateTime<Utc>,
    /// Ultimo accesso
    pub last_accessed: DateTime<Utc>,
    /// Indica se il profilo è bloccato
    pub is_locked: bool,
    /// Numero tentativi falliti
    pub failed_attempts: u32,
    /// Data ultimo tentativo fallito
    pub last_failed_attempt: Option<DateTime<Utc>>,
    /// Hash integrità file
    pub file_hash: String,
}

/// Sistema di storage per profili utente
pub struct ProfileStorage {
    /// Directory base profili
    profiles_dir: PathBuf,
    /// Directory avatars
    avatars_dir: PathBuf,
    /// Directory backup
    backups_dir: PathBuf,
    /// Percorso file indice
    index_path: PathBuf,
    /// Sistema crittografia
    encryption: ProfileEncryption,
}

impl ProfileStorage {
    /// Crea nuovo ProfileStorage
    pub fn new(base_dir: PathBuf) -> StorageResult<Self> {
        let profiles_dir = base_dir.join("profiles");
        let avatars_dir = base_dir.join("avatars");
        let backups_dir = base_dir.join("backups").join("exported_profiles");
        let index_path = profiles_dir.join("profiles.index");
        
        let storage = Self {
            profiles_dir,
            avatars_dir,
            backups_dir,
            index_path,
            encryption: ProfileEncryption::new(),
        };
        
        // Crea directory se non esistono
        storage.ensure_directories()?;
        
        Ok(storage)
    }
    
    /// Assicura che tutte le directory esistano
    fn ensure_directories(&self) -> StorageResult<()> {
        fs::create_dir_all(&self.profiles_dir)?;
        fs::create_dir_all(&self.avatars_dir)?;
        fs::create_dir_all(&self.backups_dir)?;
        Ok(())
    }
    
    /// Salva un profilo crittografato
    pub async fn save_profile(&self, profile: &UserProfile, password: &str) -> StorageResult<()> {
        // Serializza il profilo
        let profile_json = serde_json::to_string_pretty(profile)?;
        let profile_bytes = profile_json.as_bytes();
        
        // Crittografa i dati (placeholder - sarà implementato nel task 1.3)
        let encrypted_data = match self.encryption.encrypt_profile_data(profile_bytes, password) {
            Ok(data) => data,
            Err(_) => {
                // Per ora salviamo in chiaro (SOLO PER SVILUPPO)
                println!("[PROFILE STORAGE] ⚠️ Crittografia non implementata - salvando in chiaro");
                profile_bytes.to_vec()
            }
        };
        
        // Percorso file profilo
        let profile_filename = format!("profile_{}.json.enc", profile.id);
        let profile_path = self.profiles_dir.join(&profile_filename);
        
        // Salva file profilo
        async_fs::write(&profile_path, encrypted_data).await?;
        
        // Calcola hash integrità
        let file_hash = self.calculate_file_hash(&profile_path).await?;
        
        // Aggiorna indice
        self.update_index_entry(profile, &profile_filename, &file_hash).await?;
        
        println!("[PROFILE STORAGE] ✅ Profilo '{}' salvato: {}", profile.name, profile_path.display());
        Ok(())
    }
    
    /// Carica un profilo decrittografato
    pub async fn load_profile(&self, id: &str, password: &str) -> StorageResult<UserProfile> {
        // Carica indice per trovare il file
        let index = self.load_index().await?;
        let entry = index.profiles.get(id)
            .ok_or_else(|| StorageError::FileNotFound(format!("Profilo {} non trovato nell'indice", id)))?;
        
        // Verifica se il profilo è bloccato
        if entry.is_locked {
            return Err(StorageError::PermissionDenied(format!("Profilo {} è bloccato", id)));
        }
        
        // Percorso file profilo
        let profile_path = self.profiles_dir.join(&entry.file_path);
        
        // Verifica esistenza file
        if !profile_path.exists() {
            return Err(StorageError::FileNotFound(format!("File profilo non trovato: {}", profile_path.display())));
        }
        
        // Verifica integrità file
        let current_hash = self.calculate_file_hash(&profile_path).await?;
        if current_hash != entry.file_hash {
            return Err(StorageError::FileNotFound(format!("File profilo corrotto: hash non corrispondente")));
        }
        
        // Leggi file crittografato
        let encrypted_data = async_fs::read(&profile_path).await?;
        
        // Decrittografa i dati (placeholder - sarà implementato nel task 1.3)
        let decrypted_data = match self.encryption.decrypt_profile_data(&encrypted_data, password) {
            Ok(data) => data,
            Err(_) => {
                // Per ora leggiamo in chiaro (SOLO PER SVILUPPO)
                println!("[PROFILE STORAGE] ⚠️ Decrittografia non implementata - leggendo in chiaro");
                encrypted_data
            }
        };
        
        // Deserializza profilo
        let profile_json = String::from_utf8(decrypted_data)
            .map_err(|e| StorageError::SerializationError(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e))))?;
        let mut profile: UserProfile = serde_json::from_str(&profile_json)?;
        
        // Aggiorna ultimo accesso
        profile.update_last_access();
        
        // Salva aggiornamento (senza password per evitare loop)
        tokio::spawn({
            let storage = ProfileStorage::new(self.profiles_dir.parent().unwrap().to_path_buf()).unwrap();
            let profile_clone = profile.clone();
            let password = password.to_string();
            async move {
                let _ = storage.save_profile(&profile_clone, &password).await;
            }
        });
        
        println!("[PROFILE STORAGE] ✅ Profilo '{}' caricato", profile.name);
        Ok(profile)
    }

    /// Carica un profilo decrittografato usando SecureMemory per la password
    pub async fn load_profile_secure(&self, id: &str, password: &SecureMemory<String>) -> StorageResult<UserProfile> {
        // Usa il metodo esistente con la password estratta da SecureMemory
        self.load_profile(id, &**password).await
    }
    
    /// Lista informazioni di tutti i profili
    pub async fn list_profile_info(&self) -> StorageResult<Vec<ProfileInfo>> {
        let index = self.load_index().await?;
        
        let mut profiles = Vec::new();
        for entry in index.profiles.values() {
            profiles.push(ProfileInfo {
                id: entry.id.clone(),
                name: entry.name.clone(),
                avatar_path: entry.avatar_path.clone(),
                created_at: entry.created_at,
                last_accessed: entry.last_accessed,
                is_locked: entry.is_locked,
                failed_attempts: entry.failed_attempts,
            });
        }
        
        // Ordina per ultimo accesso (più recente prima)
        profiles.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
        
        println!("[PROFILE STORAGE] ✅ Elencati {} profili", profiles.len());
        Ok(profiles)
    }
    
    /// Elimina un profilo
    pub async fn delete_profile(&self, id: &str) -> StorageResult<()> {
        // Carica indice
        let mut index = self.load_index().await?;
        
        // Trova entry profilo
        let entry = index.profiles.get(id)
            .ok_or_else(|| StorageError::FileNotFound(format!("Profilo {} non trovato", id)))?
            .clone();
        
        // Elimina file profilo
        let profile_path = self.profiles_dir.join(&entry.file_path);
        if profile_path.exists() {
            async_fs::remove_file(&profile_path).await?;
        }
        
        // Elimina avatar se esiste
        if let Some(avatar_path) = &entry.avatar_path {
            let avatar_full_path = self.avatars_dir.join(avatar_path);
            if avatar_full_path.exists() {
                let _ = async_fs::remove_file(&avatar_full_path).await;
            }
        }
        
        // Rimuovi dall'indice
        index.profiles.remove(id);
        index.last_updated = Utc::now();
        
        // Salva indice aggiornato
        self.save_index(&index).await?;
        
        println!("[PROFILE STORAGE] ✅ Profilo '{}' eliminato", entry.name);
        Ok(())
    }
    
    /// Crea backup di un profilo
    pub async fn backup_profile(&self, id: &str, backup_name: &str) -> StorageResult<PathBuf> {
        // Carica indice
        let index = self.load_index().await?;
        let entry = index.profiles.get(id)
            .ok_or_else(|| StorageError::FileNotFound(format!("Profilo {} non trovato", id)))?;
        
        // Percorsi source e destination
        let source_path = self.profiles_dir.join(&entry.file_path);
        let backup_filename = format!("{}_{}.json.enc", backup_name, Utc::now().format("%Y%m%d_%H%M%S"));
        let backup_path = self.backups_dir.join(&backup_filename);
        
        // Copia file
        async_fs::copy(&source_path, &backup_path).await?;
        
        // Copia avatar se esiste
        if let Some(avatar_path) = &entry.avatar_path {
            let source_avatar = self.avatars_dir.join(avatar_path);
            if source_avatar.exists() {
                let backup_avatar = self.backups_dir.join(format!("avatar_{}", backup_filename));
                let _ = async_fs::copy(&source_avatar, &backup_avatar).await;
            }
        }
        
        println!("[PROFILE STORAGE] ✅ Backup profilo creato: {}", backup_path.display());
        Ok(backup_path)
    }
    
    /// Salva avatar profilo
    pub async fn save_avatar(&self, profile_id: &str, avatar_data: &[u8], extension: &str) -> StorageResult<String> {
        let avatar_filename = format!("avatar_{}.{}", profile_id, extension);
        let avatar_path = self.avatars_dir.join(&avatar_filename);
        
        // Salva file avatar
        async_fs::write(&avatar_path, avatar_data).await?;
        
        println!("[PROFILE STORAGE] ✅ Avatar salvato: {}", avatar_path.display());
        Ok(avatar_filename)
    }
    
    /// Elimina avatar profilo
    pub async fn delete_avatar(&self, avatar_filename: &str) -> StorageResult<()> {
        let avatar_path = self.avatars_dir.join(avatar_filename);
        if avatar_path.exists() {
            async_fs::remove_file(&avatar_path).await?;
            println!("[PROFILE STORAGE] ✅ Avatar eliminato: {}", avatar_path.display());
        }
        Ok(())
    }
    
    /// Aggiorna tentativi falliti per un profilo
    pub async fn update_failed_attempts(&self, id: &str, increment: bool) -> StorageResult<u32> {
        let mut index = self.load_index().await?;
        
        let failed_attempts = if let Some(entry) = index.profiles.get_mut(id) {
            if increment {
                entry.failed_attempts += 1;
                entry.last_failed_attempt = Some(Utc::now());
                
                // Blocca profilo se troppi tentativi
                if entry.failed_attempts >= 5 {
                    entry.is_locked = true;
                    println!("[PROFILE STORAGE] ⚠️ Profilo '{}' bloccato per troppi tentativi", entry.name);
                }
            } else {
                entry.failed_attempts = 0;
                entry.last_failed_attempt = None;
                entry.is_locked = false;
            }
            
            entry.failed_attempts
        } else {
            return Err(StorageError::FileNotFound(format!("Profilo {} non trovato", id)));
        };
        
        index.last_updated = Utc::now();
        self.save_index(&index).await?;
        
        Ok(failed_attempts)
    }
    
    /// Carica indice profili
    async fn load_index(&self) -> StorageResult<ProfileIndex> {
        if !self.index_path.exists() {
            // Crea indice vuoto se non esiste
            let index = ProfileIndex {
                version: 1,
                profiles: HashMap::new(),
                last_updated: Utc::now(),
            };
            self.save_index(&index).await?;
            return Ok(index);
        }
        
        let index_data = async_fs::read_to_string(&self.index_path).await?;
        let index: ProfileIndex = serde_json::from_str(&index_data)?;
        Ok(index)
    }
    
    /// Salva indice profili
    async fn save_index(&self, index: &ProfileIndex) -> StorageResult<()> {
        let index_json = serde_json::to_string_pretty(index)?;
        async_fs::write(&self.index_path, index_json).await?;
        Ok(())
    }
    
    /// Aggiorna entry nell'indice
    async fn update_index_entry(&self, profile: &UserProfile, filename: &str, file_hash: &str) -> StorageResult<()> {
        let mut index = self.load_index().await?;
        
        let entry = ProfileIndexEntry {
            id: profile.id.clone(),
            name: profile.name.clone(),
            file_path: filename.to_string(),
            avatar_path: profile.avatar_path.clone(),
            created_at: profile.created_at,
            last_accessed: profile.last_accessed,
            is_locked: false,
            failed_attempts: 0,
            last_failed_attempt: None,
            file_hash: file_hash.to_string(),
        };
        
        index.profiles.insert(profile.id.clone(), entry);
        index.last_updated = Utc::now();
        
        self.save_index(&index).await?;
        Ok(())
    }
    
    /// Calcola hash integrità file
    async fn calculate_file_hash(&self, file_path: &Path) -> StorageResult<String> {
        use sha2::{Sha256, Digest};
        
        let file_data = async_fs::read(file_path).await?;
        let mut hasher = Sha256::new();
        hasher.update(&file_data);
        let hash = hasher.finalize();
        
        Ok(format!("{:x}", hash))
    }
    
    /// Ottiene statistiche storage
    pub async fn get_storage_stats(&self) -> StorageResult<StorageStats> {
        let index = self.load_index().await?;
        
        let mut total_size = 0u64;
        let mut profile_count = 0u32;
        let mut avatar_count = 0u32;
        
        // Calcola dimensioni profili
        for entry in index.profiles.values() {
            let profile_path = self.profiles_dir.join(&entry.file_path);
            if let Ok(metadata) = async_fs::metadata(&profile_path).await {
                total_size += metadata.len();
                profile_count += 1;
            }
            
            // Conta avatars
            if let Some(avatar_path) = &entry.avatar_path {
                let avatar_full_path = self.avatars_dir.join(avatar_path);
                if let Ok(metadata) = async_fs::metadata(&avatar_full_path).await {
                    total_size += metadata.len();
                    avatar_count += 1;
                }
            }
        }
        
        Ok(StorageStats {
            profile_count,
            avatar_count,
            total_size_bytes: total_size,
            last_updated: index.last_updated,
        })
    }
}

/// Statistiche storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub profile_count: u32,
    pub avatar_count: u32,
    pub total_size_bytes: u64,
    pub last_updated: DateTime<Utc>,
}

impl Default for ProfileIndex {
    fn default() -> Self {
        Self {
            version: 1,
            profiles: HashMap::new(),
            last_updated: Utc::now(),
        }
    }
}