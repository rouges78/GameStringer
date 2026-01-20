//! # Load Order Management Module
//! 
//! Sistema di gestione dell'ordine di caricamento mod per GameStringer.
//! Ispirato a Vortex/LOOT per gestire conflitti e dipendenze tra mod.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use log::info;

// ============================================================================
// STRUTTURE DATI
// ============================================================================

/// Regola per l'ordine di caricamento
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadOrderRule {
    /// ID della regola
    pub id: String,
    /// Mod che deve essere caricata PRIMA
    pub load_before: String,
    /// Mod che deve essere caricata DOPO
    pub load_after: String,
    /// Descrizione della regola
    pub description: Option<String>,
    /// È una regola automatica (da dipendenze) o manuale?
    pub is_automatic: bool,
}

/// Conflitto tra mod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModConflict {
    /// ID del conflitto
    pub id: String,
    /// Prima mod coinvolta
    pub mod_a: String,
    /// Seconda mod coinvolta
    pub mod_b: String,
    /// File in conflitto
    pub conflicting_files: Vec<String>,
    /// Severità (info, warning, error)
    pub severity: ConflictSeverity,
    /// Risoluzione scelta
    pub resolution: Option<ConflictResolution>,
}

/// Severità di un conflitto
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictSeverity {
    Info,
    Warning,
    Error,
}

/// Risoluzione di un conflitto
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    /// Mod A vince (file di A sovrascrivono B)
    PreferModA,
    /// Mod B vince
    PreferModB,
    /// Ignora il conflitto
    Ignore,
    /// Merge manuale
    ManualMerge,
}

/// Entry nell'ordine di caricamento
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadOrderEntry {
    /// ID della mod
    pub mod_id: String,
    /// Nome della mod
    pub mod_name: String,
    /// Posizione nell'ordine (0 = primo)
    pub position: i32,
    /// È abilitata?
    pub enabled: bool,
    /// È bloccata (non può essere spostata)?
    pub locked: bool,
    /// Dipendenze (mod che devono essere caricate prima)
    pub dependencies: Vec<String>,
    /// Mod che dipendono da questa
    pub dependents: Vec<String>,
}

/// Configurazione ordine di caricamento per un gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameLoadOrder {
    /// ID del gioco
    pub game_id: String,
    /// ID del profilo associato
    pub profile_id: String,
    /// Entries ordinate
    pub entries: Vec<LoadOrderEntry>,
    /// Regole personalizzate
    pub rules: Vec<LoadOrderRule>,
    /// Conflitti rilevati
    pub conflicts: Vec<ModConflict>,
    /// Ultimo aggiornamento
    pub last_updated: String,
}

impl GameLoadOrder {
    pub fn new(game_id: &str, profile_id: &str) -> Self {
        Self {
            game_id: game_id.to_string(),
            profile_id: profile_id.to_string(),
            entries: Vec::new(),
            rules: Vec::new(),
            conflicts: Vec::new(),
            last_updated: chrono::Utc::now().to_rfc3339(),
        }
    }
    
    /// Aggiungi una mod all'ordine
    #[allow(dead_code)]
    pub fn add_mod(&mut self, mod_id: &str, mod_name: &str, dependencies: Vec<String>) {
        // Trova la posizione corretta basata sulle dipendenze
        let position = self.calculate_position(mod_id, &dependencies);
        
        let entry = LoadOrderEntry {
            mod_id: mod_id.to_string(),
            mod_name: mod_name.to_string(),
            position,
            enabled: true,
            locked: false,
            dependencies,
            dependents: Vec::new(),
        };
        
        self.entries.push(entry);
        self.recalculate_positions();
    }
    
    /// Rimuovi una mod dall'ordine
    #[allow(dead_code)]
    pub fn remove_mod(&mut self, mod_id: &str) {
        self.entries.retain(|e| e.mod_id != mod_id);
        self.recalculate_positions();
    }
    
    /// Sposta una mod nella posizione specificata
    pub fn move_mod(&mut self, mod_id: &str, new_position: i32) -> Result<(), String> {
        // Verifica che la mod esista
        let entry_idx = self.entries.iter()
            .position(|e| e.mod_id == mod_id)
            .ok_or("Mod non trovata")?;
        
        // Verifica che non sia bloccata
        if self.entries[entry_idx].locked {
            return Err("Questa mod è bloccata e non può essere spostata".to_string());
        }
        
        // Verifica che la nuova posizione rispetti le dipendenze
        if !self.is_valid_position(mod_id, new_position) {
            return Err("La nuova posizione viola le dipendenze".to_string());
        }
        
        // Sposta
        let entry = self.entries.remove(entry_idx);
        let insert_idx = (new_position as usize).min(self.entries.len());
        self.entries.insert(insert_idx, entry);
        
        self.recalculate_positions();
        Ok(())
    }
    
    /// Calcola la posizione per una nuova mod
    #[allow(dead_code)]
    fn calculate_position(&self, _mod_id: &str, dependencies: &[String]) -> i32 {
        if dependencies.is_empty() {
            return self.entries.len() as i32;
        }
        
        // Trova la posizione massima delle dipendenze
        let max_dep_pos = dependencies.iter()
            .filter_map(|dep| self.entries.iter().find(|e| &e.mod_id == dep))
            .map(|e| e.position)
            .max()
            .unwrap_or(-1);
        
        max_dep_pos + 1
    }
    
    /// Verifica se una posizione è valida per una mod
    fn is_valid_position(&self, mod_id: &str, position: i32) -> bool {
        let entry = match self.entries.iter().find(|e| e.mod_id == mod_id) {
            Some(e) => e,
            None => return false,
        };
        
        // Verifica che tutte le dipendenze siano prima
        for dep in &entry.dependencies {
            if let Some(dep_entry) = self.entries.iter().find(|e| &e.mod_id == dep) {
                if dep_entry.position >= position {
                    return false;
                }
            }
        }
        
        // Verifica che tutti i dipendenti siano dopo
        for dependent in &entry.dependents {
            if let Some(dep_entry) = self.entries.iter().find(|e| &e.mod_id == dependent) {
                if dep_entry.position <= position {
                    return false;
                }
            }
        }
        
        true
    }
    
    /// Ricalcola le posizioni
    fn recalculate_positions(&mut self) {
        for (i, entry) in self.entries.iter_mut().enumerate() {
            entry.position = i as i32;
        }
        self.last_updated = chrono::Utc::now().to_rfc3339();
    }
    
    /// Ordina automaticamente basandosi sulle dipendenze
    pub fn auto_sort(&mut self) -> Result<(), String> {
        // Algoritmo di ordinamento topologico
        let mut sorted = Vec::new();
        let mut visited = HashSet::new();
        let mut temp_visited = HashSet::new();
        
        let entries_map: HashMap<String, &LoadOrderEntry> = self.entries.iter()
            .map(|e| (e.mod_id.clone(), e))
            .collect();
        
        fn visit(
            mod_id: &str,
            entries_map: &HashMap<String, &LoadOrderEntry>,
            visited: &mut HashSet<String>,
            temp_visited: &mut HashSet<String>,
            sorted: &mut Vec<String>,
        ) -> Result<(), String> {
            if temp_visited.contains(mod_id) {
                return Err(format!("Dipendenza circolare rilevata per: {}", mod_id));
            }
            
            if visited.contains(mod_id) {
                return Ok(());
            }
            
            temp_visited.insert(mod_id.to_string());
            
            if let Some(entry) = entries_map.get(mod_id) {
                for dep in &entry.dependencies {
                    visit(dep, entries_map, visited, temp_visited, sorted)?;
                }
            }
            
            temp_visited.remove(mod_id);
            visited.insert(mod_id.to_string());
            sorted.push(mod_id.to_string());
            
            Ok(())
        }
        
        for entry in &self.entries {
            visit(&entry.mod_id, &entries_map, &mut visited, &mut temp_visited, &mut sorted)?;
        }
        
        // Riordina entries
        let mut new_entries = Vec::new();
        for mod_id in sorted {
            if let Some(entry) = self.entries.iter().find(|e| e.mod_id == mod_id) {
                new_entries.push(entry.clone());
            }
        }
        self.entries = new_entries;
        
        self.recalculate_positions();
        Ok(())
    }
    
    /// Rileva conflitti tra mod
    pub fn detect_conflicts(&mut self, mod_files: &HashMap<String, Vec<String>>) {
        self.conflicts.clear();
        
        let mut file_owners: HashMap<String, Vec<String>> = HashMap::new();
        
        // Mappa file -> mod che lo usano
        for (mod_id, files) in mod_files {
            for file in files {
                file_owners.entry(file.clone())
                    .or_insert_with(Vec::new)
                    .push(mod_id.clone());
            }
        }
        
        // Trova conflitti
        for (file, owners) in &file_owners {
            if owners.len() > 1 {
                // Crea conflitto per ogni coppia di mod
                for i in 0..owners.len() {
                    for j in (i + 1)..owners.len() {
                        let conflict_id = format!("{}_{}_conflict", owners[i], owners[j]);
                        
                        // Controlla se già esiste
                        if self.conflicts.iter().any(|c| c.id == conflict_id) {
                            continue;
                        }
                        
                        let conflict = ModConflict {
                            id: conflict_id,
                            mod_a: owners[i].clone(),
                            mod_b: owners[j].clone(),
                            conflicting_files: vec![file.clone()],
                            severity: ConflictSeverity::Warning,
                            resolution: None,
                        };
                        
                        self.conflicts.push(conflict);
                    }
                }
            }
        }
    }
    
    /// Risolvi un conflitto
    pub fn resolve_conflict(&mut self, conflict_id: &str, resolution: ConflictResolution) -> Result<(), String> {
        if let Some(conflict) = self.conflicts.iter_mut().find(|c| c.id == conflict_id) {
            conflict.resolution = Some(resolution);
            Ok(())
        } else {
            Err("Conflitto non trovato".to_string())
        }
    }
}

// ============================================================================
// LOAD ORDER MANAGER
// ============================================================================

pub struct LoadOrderManager {
    orders: HashMap<String, GameLoadOrder>,
    base_dir: PathBuf,
}

impl LoadOrderManager {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            orders: HashMap::new(),
            base_dir,
        }
    }
    
    /// Carica ordini da disco
    pub async fn load(&mut self) -> Result<(), String> {
        let orders_dir = self.base_dir.join("load_orders");
        
        if !orders_dir.exists() {
            std::fs::create_dir_all(&orders_dir).map_err(|e| e.to_string())?;
            return Ok(());
        }
        
        if let Ok(entries) = std::fs::read_dir(&orders_dir) {
            for entry in entries.flatten() {
                if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        if let Ok(order) = serde_json::from_str::<GameLoadOrder>(&content) {
                            let key = format!("{}_{}", order.game_id, order.profile_id);
                            self.orders.insert(key, order);
                        }
                    }
                }
            }
        }
        
        info!("[LOAD_ORDER] Caricati {} ordini di caricamento", self.orders.len());
        Ok(())
    }
    
    /// Salva ordini su disco
    pub async fn save(&self) -> Result<(), String> {
        let orders_dir = self.base_dir.join("load_orders");
        std::fs::create_dir_all(&orders_dir).map_err(|e| e.to_string())?;
        
        for (key, order) in &self.orders {
            let file_path = orders_dir.join(format!("{}.json", key));
            let json = serde_json::to_string_pretty(order).map_err(|e| e.to_string())?;
            std::fs::write(file_path, json).map_err(|e| e.to_string())?;
        }
        
        Ok(())
    }
    
    /// Ottieni o crea ordine per gioco/profilo
    pub fn get_or_create(&mut self, game_id: &str, profile_id: &str) -> &mut GameLoadOrder {
        let key = format!("{}_{}", game_id, profile_id);
        
        if !self.orders.contains_key(&key) {
            let order = GameLoadOrder::new(game_id, profile_id);
            self.orders.insert(key.clone(), order);
        }
        
        self.orders.get_mut(&key).unwrap()
    }
    
    /// Ottieni ordine
    #[allow(dead_code)]
    pub fn get(&self, game_id: &str, profile_id: &str) -> Option<&GameLoadOrder> {
        let key = format!("{}_{}", game_id, profile_id);
        self.orders.get(&key)
    }
}

// ============================================================================
// COMANDI TAURI
// ============================================================================

use tokio::sync::Mutex;
use once_cell::sync::Lazy;

static LOAD_ORDER_MANAGER: Lazy<Mutex<Option<LoadOrderManager>>> = Lazy::new(|| Mutex::new(None));

fn get_load_order_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    
    PathBuf::from(home).join(".gamestringer")
}

/// Inizializza il sistema di load order
#[tauri::command]
pub async fn init_load_order() -> Result<usize, String> {
    info!("[LOAD_ORDER] Inizializzazione sistema load order...");
    
    let base_dir = get_load_order_dir();
    let mut manager = LoadOrderManager::new(base_dir);
    manager.load().await?;
    
    let count = manager.orders.len();
    
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    *global = Some(manager);
    
    Ok(count)
}

/// Ottieni ordine di caricamento per gioco/profilo
#[tauri::command]
pub async fn get_load_order(game_id: String, profile_id: String) -> Result<GameLoadOrder, String> {
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if global.is_none() {
        let base_dir = get_load_order_dir();
        let mut manager = LoadOrderManager::new(base_dir);
        manager.load().await?;
        *global = Some(manager);
    }
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id).clone();
        Ok(order)
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}

/// Sposta una mod nell'ordine
#[tauri::command]
pub async fn move_mod_in_order(
    game_id: String,
    profile_id: String,
    mod_id: String,
    new_position: i32,
) -> Result<(), String> {
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id);
        order.move_mod(&mod_id, new_position)?;
        manager.save().await?;
        Ok(())
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}

/// Ordina automaticamente le mod
#[tauri::command]
pub async fn auto_sort_load_order(game_id: String, profile_id: String) -> Result<GameLoadOrder, String> {
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id);
        order.auto_sort()?;
        let result = order.clone();
        manager.save().await?;
        Ok(result)
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}

/// Rileva conflitti tra mod
#[tauri::command]
pub async fn detect_mod_conflicts(
    game_id: String,
    profile_id: String,
    mod_files: HashMap<String, Vec<String>>,
) -> Result<Vec<ModConflict>, String> {
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id);
        order.detect_conflicts(&mod_files);
        let result = order.conflicts.clone();
        manager.save().await?;
        Ok(result)
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}

/// Risolvi un conflitto
#[tauri::command]
pub async fn resolve_mod_conflict(
    game_id: String,
    profile_id: String,
    conflict_id: String,
    resolution: String,
) -> Result<(), String> {
    let res = match resolution.as_str() {
        "prefer_a" => ConflictResolution::PreferModA,
        "prefer_b" => ConflictResolution::PreferModB,
        "ignore" => ConflictResolution::Ignore,
        "manual" => ConflictResolution::ManualMerge,
        _ => return Err("Risoluzione non valida".to_string()),
    };
    
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id);
        order.resolve_conflict(&conflict_id, res)?;
        manager.save().await?;
        Ok(())
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}

/// Aggiungi regola di ordinamento
#[tauri::command]
pub async fn add_load_order_rule(
    game_id: String,
    profile_id: String,
    load_before: String,
    load_after: String,
    description: Option<String>,
) -> Result<(), String> {
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id);
        
        let rule = LoadOrderRule {
            id: format!("rule_{}_{}", load_before, load_after),
            load_before,
            load_after,
            description,
            is_automatic: false,
        };
        
        order.rules.push(rule);
        manager.save().await?;
        Ok(())
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}

/// Rimuovi regola di ordinamento
#[tauri::command]
pub async fn remove_load_order_rule(
    game_id: String,
    profile_id: String,
    rule_id: String,
) -> Result<(), String> {
    let mut global = LOAD_ORDER_MANAGER.lock().await;
    
    if let Some(manager) = global.as_mut() {
        let order = manager.get_or_create(&game_id, &profile_id);
        order.rules.retain(|r| r.id != rule_id);
        manager.save().await?;
        Ok(())
    } else {
        Err("Sistema load order non inizializzato".to_string())
    }
}
