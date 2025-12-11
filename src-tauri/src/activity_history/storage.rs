//! Activity History Storage
//! 
//! Persistenza delle attività su file JSON.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::info;

use super::models::{Activity, ActivityFilter, ActivityPage, ActivityType};

/// Numero massimo di attività da mantenere
const MAX_ACTIVITIES: usize = 1000;

/// Storage per le attività
pub struct ActivityStorage {
    /// Path del file di storage
    path: PathBuf,
    /// Cache in memoria
    activities: Arc<RwLock<Vec<Activity>>>,
}

impl ActivityStorage {
    /// Crea un nuovo storage
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let path = data_dir.join("activity_history.json");
        
        // Crea directory se non esiste
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        
        // Carica attività esistenti
        let activities = if path.exists() {
            match fs::read_to_string(&path) {
                Ok(json) => {
                    serde_json::from_str(&json).unwrap_or_default()
                }
                Err(_) => Vec::new(),
            }
        } else {
            Vec::new()
        };
        
        info!("[ActivityStorage] Caricate {} attività", activities.len());
        
        Ok(Self {
            path,
            activities: Arc::new(RwLock::new(activities)),
        })
    }
    
    /// Aggiungi una nuova attività
    pub fn add(&self, activity: Activity) -> Result<(), String> {
        let mut activities = self.activities.write();
        
        // Aggiungi in testa (più recente prima)
        activities.insert(0, activity);
        
        // Limita il numero di attività
        if activities.len() > MAX_ACTIVITIES {
            activities.truncate(MAX_ACTIVITIES);
        }
        
        // Salva su disco
        drop(activities);
        self.save()
    }
    
    /// Ottieni attività con filtri e paginazione
    pub fn get(&self, filter: ActivityFilter) -> ActivityPage {
        let activities = self.activities.read();
        
        // Applica filtri
        let filtered: Vec<&Activity> = activities.iter()
            .filter(|a| {
                // Filtro per tipo
                if let Some(ref t) = filter.activity_type {
                    if &a.activity_type != t {
                        return false;
                    }
                }
                // Filtro per gioco
                if let Some(ref gid) = filter.game_id {
                    if a.game_id.as_ref() != Some(gid) {
                        return false;
                    }
                }
                // Filtro per data inizio
                if let Some(from) = filter.from_date {
                    if a.timestamp < from {
                        return false;
                    }
                }
                // Filtro per data fine
                if let Some(to) = filter.to_date {
                    if a.timestamp > to {
                        return false;
                    }
                }
                true
            })
            .collect();
        
        let total = filtered.len();
        let page_size = filter.limit.unwrap_or(20);
        let offset = filter.offset.unwrap_or(0);
        let page = offset / page_size;
        
        // Applica paginazione
        let paginated: Vec<Activity> = filtered
            .into_iter()
            .skip(offset)
            .take(page_size)
            .cloned()
            .collect();
        
        let has_more = offset + paginated.len() < total;
        
        ActivityPage {
            activities: paginated,
            total,
            page,
            page_size,
            has_more,
        }
    }
    
    /// Ottieni le ultime N attività
    pub fn get_recent(&self, limit: usize) -> Vec<Activity> {
        let activities = self.activities.read();
        activities.iter().take(limit).cloned().collect()
    }
    
    /// Conta attività per tipo
    pub fn count_by_type(&self) -> std::collections::HashMap<String, usize> {
        let activities = self.activities.read();
        let mut counts = std::collections::HashMap::new();
        
        for activity in activities.iter() {
            let key = format!("{:?}", activity.activity_type).to_lowercase();
            *counts.entry(key).or_insert(0) += 1;
        }
        
        counts
    }
    
    /// Cancella tutte le attività
    pub fn clear(&self) -> Result<(), String> {
        let mut activities = self.activities.write();
        activities.clear();
        drop(activities);
        self.save()
    }
    
    /// Elimina una singola attività
    pub fn delete(&self, id: &str) -> Result<bool, String> {
        let mut activities = self.activities.write();
        let len_before = activities.len();
        activities.retain(|a| a.id != id);
        let deleted = activities.len() < len_before;
        drop(activities);
        
        if deleted {
            self.save()?;
        }
        
        Ok(deleted)
    }
    
    /// Salva su disco
    fn save(&self) -> Result<(), String> {
        let activities = self.activities.read();
        let json = serde_json::to_string_pretty(&*activities)
            .map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl Default for ActivityStorage {
    fn default() -> Self {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("GameStringer");
        Self::new(data_dir).expect("Failed to create ActivityStorage")
    }
}
