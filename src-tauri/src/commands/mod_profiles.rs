//! # Mod Profiles Module
//! 
//! Sistema di profili mod per GameStringer ispirato a Vortex.
//! Permette di creare e gestire configurazioni mod separate per ogni gioco.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use log::info;
use chrono::{DateTime, Utc};

// ============================================================================
// STRUTTURE DATI
// ============================================================================

/// Una mod installata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledMod {
    /// ID univoco della mod
    pub id: String,
    /// Nome visualizzato
    pub name: String,
    /// Versione
    pub version: String,
    /// Percorso di installazione
    pub path: PathBuf,
    /// Sorgente (NexusMods, Manual, Steam Workshop, etc.)
    pub source: ModSource,
    /// URL sorgente originale
    pub source_url: Option<String>,
    /// Data installazione
    pub installed_at: DateTime<Utc>,
    /// Ultimo aggiornamento
    pub updated_at: Option<DateTime<Utc>>,
    /// Abilitata nel profilo corrente
    pub enabled: bool,
    /// Ordine di caricamento
    pub load_order: i32,
    /// File della mod
    pub files: Vec<ModFile>,
    /// Note utente
    pub notes: Option<String>,
}

/// Sorgente di una mod
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModSource {
    NexusMods,
    SteamWorkshop,
    ModDB,
    CurseForge,
    Manual,
    GitHub,
    Other(String),
}

/// File di una mod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModFile {
    pub path: PathBuf,
    pub size: u64,
    pub hash: Option<String>,
    pub is_deployed: bool,
}

/// Profilo mod per un gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModProfile {
    /// ID univoco del profilo
    pub id: String,
    /// Nome del profilo
    pub name: String,
    /// ID del gioco associato
    pub game_id: String,
    /// Descrizione
    pub description: Option<String>,
    /// Data creazione
    pub created_at: DateTime<Utc>,
    /// Ultimo utilizzo
    pub last_used: Option<DateTime<Utc>>,
    /// Mod abilitate in questo profilo (mod_id -> enabled)
    pub enabled_mods: HashMap<String, bool>,
    /// Ordine di caricamento personalizzato (mod_id -> order)
    pub load_order: HashMap<String, i32>,
    /// Impostazioni specifiche del profilo
    pub settings: HashMap<String, serde_json::Value>,
    /// È il profilo predefinito?
    pub is_default: bool,
}

/// Configurazione mod per un gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameModConfig {
    /// ID del gioco
    pub game_id: String,
    /// Nome del gioco
    pub game_name: String,
    /// Directory mod del gioco
    pub mods_directory: PathBuf,
    /// Directory staging (mod scaricate non installate)
    pub staging_directory: PathBuf,
    /// Profili disponibili
    pub profiles: Vec<ModProfile>,
    /// ID profilo attivo
    pub active_profile_id: Option<String>,
    /// Mod installate
    pub installed_mods: Vec<InstalledMod>,
}

impl GameModConfig {
    pub fn new(game_id: &str, game_name: &str, base_dir: &PathBuf) -> Self {
        let mods_dir = base_dir.join("mods").join(game_id);
        let staging_dir = base_dir.join("staging").join(game_id);
        
        // Crea profilo predefinito
        let default_profile = ModProfile {
            id: format!("{}-default", game_id),
            name: "Default".to_string(),
            game_id: game_id.to_string(),
            description: Some("Profilo predefinito".to_string()),
            created_at: Utc::now(),
            last_used: None,
            enabled_mods: HashMap::new(),
            load_order: HashMap::new(),
            settings: HashMap::new(),
            is_default: true,
        };
        
        Self {
            game_id: game_id.to_string(),
            game_name: game_name.to_string(),
            mods_directory: mods_dir,
            staging_directory: staging_dir,
            profiles: vec![default_profile.clone()],
            active_profile_id: Some(default_profile.id),
            installed_mods: Vec::new(),
        }
    }
    
    /// Ottieni il profilo attivo
    #[allow(dead_code)]
    pub fn get_active_profile(&self) -> Option<&ModProfile> {
        self.active_profile_id.as_ref()
            .and_then(|id| self.profiles.iter().find(|p| &p.id == id))
    }
    
    /// Ottieni il profilo attivo (mutabile)
    pub fn get_active_profile_mut(&mut self) -> Option<&mut ModProfile> {
        let active_id = self.active_profile_id.clone();
        active_id.and_then(move |id| self.profiles.iter_mut().find(|p| p.id == id))
    }
    
    /// Crea un nuovo profilo
    pub fn create_profile(&mut self, name: &str, description: Option<String>) -> &ModProfile {
        let id = format!("{}-{}", self.game_id, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("new"));
        
        let profile = ModProfile {
            id: id.clone(),
            name: name.to_string(),
            game_id: self.game_id.clone(),
            description,
            created_at: Utc::now(),
            last_used: None,
            enabled_mods: HashMap::new(),
            load_order: HashMap::new(),
            settings: HashMap::new(),
            is_default: false,
        };
        
        self.profiles.push(profile);
        self.profiles.last().unwrap()
    }
    
    /// Clona un profilo esistente
    pub fn clone_profile(&mut self, source_id: &str, new_name: &str) -> Result<&ModProfile, String> {
        let source = self.profiles.iter()
            .find(|p| p.id == source_id)
            .ok_or("Profilo sorgente non trovato")?
            .clone();
        
        let new_id = format!("{}-{}", self.game_id, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("clone"));
        
        let new_profile = ModProfile {
            id: new_id,
            name: new_name.to_string(),
            game_id: self.game_id.clone(),
            description: Some(format!("Clonato da '{}'", source.name)),
            created_at: Utc::now(),
            last_used: None,
            enabled_mods: source.enabled_mods,
            load_order: source.load_order,
            settings: source.settings,
            is_default: false,
        };
        
        self.profiles.push(new_profile);
        Ok(self.profiles.last().unwrap())
    }
}

// ============================================================================
// MOD PROFILE MANAGER
// ============================================================================

pub struct ModProfileManager {
    configs: HashMap<String, GameModConfig>,
    base_dir: PathBuf,
}

impl ModProfileManager {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            configs: HashMap::new(),
            base_dir,
        }
    }
    
    /// Carica configurazioni da disco
    pub async fn load(&mut self) -> Result<(), String> {
        let configs_dir = self.base_dir.join("mod_configs");
        
        if !configs_dir.exists() {
            std::fs::create_dir_all(&configs_dir).map_err(|e| e.to_string())?;
            return Ok(());
        }
        
        if let Ok(entries) = std::fs::read_dir(&configs_dir) {
            for entry in entries.flatten() {
                if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        if let Ok(config) = serde_json::from_str::<GameModConfig>(&content) {
                            self.configs.insert(config.game_id.clone(), config);
                        }
                    }
                }
            }
        }
        
        info!("[MOD_PROFILES] Caricate {} configurazioni giochi", self.configs.len());
        Ok(())
    }
    
    /// Salva configurazioni su disco
    pub async fn save(&self) -> Result<(), String> {
        let configs_dir = self.base_dir.join("mod_configs");
        std::fs::create_dir_all(&configs_dir).map_err(|e| e.to_string())?;
        
        for (game_id, config) in &self.configs {
            let file_path = configs_dir.join(format!("{}.json", game_id));
            let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
            std::fs::write(file_path, json).map_err(|e| e.to_string())?;
        }
        
        Ok(())
    }
    
    /// Ottieni o crea configurazione per un gioco
    pub fn get_or_create(&mut self, game_id: &str, game_name: &str) -> &mut GameModConfig {
        if !self.configs.contains_key(game_id) {
            let config = GameModConfig::new(game_id, game_name, &self.base_dir);
            self.configs.insert(game_id.to_string(), config);
        }
        self.configs.get_mut(game_id).unwrap()
    }
    
    /// Ottieni configurazione per un gioco
    pub fn get(&self, game_id: &str) -> Option<&GameModConfig> {
        self.configs.get(game_id)
    }
}

// ============================================================================
// COMANDI TAURI
// ============================================================================

use tokio::sync::Mutex;
use once_cell::sync::Lazy;

static MOD_PROFILE_MANAGER: Lazy<Mutex<Option<ModProfileManager>>> = Lazy::new(|| Mutex::new(None));

fn get_mod_profiles_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    
    PathBuf::from(home).join(".gamestringer")
}

/// Inizializza il sistema di profili mod
#[tauri::command]
pub async fn init_mod_profiles() -> Result<usize, String> {
    info!("[MOD_PROFILES] Inizializzazione sistema profili mod...");
    
    let base_dir = get_mod_profiles_dir();
    let mut manager = ModProfileManager::new(base_dir);
    manager.load().await?;
    
    let count = manager.configs.len();
    
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    *global = Some(manager);
    
    Ok(count)
}

/// Ottieni profili per un gioco
#[tauri::command]
pub async fn get_mod_profiles(game_id: String, game_name: String) -> Result<Vec<ModProfile>, String> {
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    
    if global.is_none() {
        let base_dir = get_mod_profiles_dir();
        let mut manager = ModProfileManager::new(base_dir);
        manager.load().await?;
        *global = Some(manager);
    }
    
    if let Some(manager) = global.as_mut() {
        let config = manager.get_or_create(&game_id, &game_name);
        Ok(config.profiles.clone())
    } else {
        Ok(Vec::new())
    }
}

/// Crea un nuovo profilo mod
#[tauri::command]
pub async fn create_mod_profile(
    game_id: String,
    game_name: String,
    profile_name: String,
    description: Option<String>,
) -> Result<ModProfile, String> {
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let config = manager.get_or_create(&game_id, &game_name);
        let profile = config.create_profile(&profile_name, description).clone();
        manager.save().await?;
        Ok(profile)
    } else {
        Err("Sistema profili non inizializzato".to_string())
    }
}

/// Attiva un profilo mod
#[tauri::command]
pub async fn activate_mod_profile(game_id: String, profile_id: String) -> Result<(), String> {
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        if let Some(config) = manager.configs.get_mut(&game_id) {
            if config.profiles.iter().any(|p| p.id == profile_id) {
                config.active_profile_id = Some(profile_id);
                manager.save().await?;
                Ok(())
            } else {
                Err("Profilo non trovato".to_string())
            }
        } else {
            Err("Gioco non configurato".to_string())
        }
    } else {
        Err("Sistema profili non inizializzato".to_string())
    }
}

/// Elimina un profilo mod
#[tauri::command]
pub async fn delete_mod_profile(game_id: String, profile_id: String) -> Result<(), String> {
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        if let Some(config) = manager.configs.get_mut(&game_id) {
            // Non permettere di eliminare il profilo predefinito
            if config.profiles.iter().any(|p| p.id == profile_id && p.is_default) {
                return Err("Non puoi eliminare il profilo predefinito".to_string());
            }
            
            config.profiles.retain(|p| p.id != profile_id);
            
            // Se il profilo eliminato era attivo, passa al default
            if config.active_profile_id.as_ref() == Some(&profile_id) {
                config.active_profile_id = config.profiles.iter()
                    .find(|p| p.is_default)
                    .map(|p| p.id.clone());
            }
            
            manager.save().await?;
            Ok(())
        } else {
            Err("Gioco non configurato".to_string())
        }
    } else {
        Err("Sistema profili non inizializzato".to_string())
    }
}

/// Clona un profilo mod
#[tauri::command]
pub async fn clone_mod_profile(
    game_id: String,
    source_profile_id: String,
    new_name: String,
) -> Result<ModProfile, String> {
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        if let Some(config) = manager.configs.get_mut(&game_id) {
            let profile = config.clone_profile(&source_profile_id, &new_name)?.clone();
            manager.save().await?;
            Ok(profile)
        } else {
            Err("Gioco non configurato".to_string())
        }
    } else {
        Err("Sistema profili non inizializzato".to_string())
    }
}

/// Ottieni mod installate per un gioco
#[tauri::command]
pub async fn get_installed_mods(game_id: String) -> Result<Vec<InstalledMod>, String> {
    let global = MOD_PROFILE_MANAGER.lock().await;
    
    if let Some(manager) = global.as_ref() {
        if let Some(config) = manager.get(&game_id) {
            Ok(config.installed_mods.clone())
        } else {
            Ok(Vec::new())
        }
    } else {
        Ok(Vec::new())
    }
}

/// Abilita/disabilita una mod nel profilo attivo
#[tauri::command]
pub async fn toggle_mod_in_profile(
    game_id: String,
    mod_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut global = MOD_PROFILE_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        if let Some(config) = manager.configs.get_mut(&game_id) {
            if let Some(profile) = config.get_active_profile_mut() {
                profile.enabled_mods.insert(mod_id, enabled);
                manager.save().await?;
                Ok(())
            } else {
                Err("Nessun profilo attivo".to_string())
            }
        } else {
            Err("Gioco non configurato".to_string())
        }
    } else {
        Err("Sistema profili non inizializzato".to_string())
    }
}
