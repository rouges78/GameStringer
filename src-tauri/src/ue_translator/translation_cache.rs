//! Cache delle traduzioni per UE Translator
//! 
//! Gestisce caching persistente delle traduzioni per evitare chiamate ripetute.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Entry nella cache
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub original: String,
    pub translated: String,
    pub source_lang: String,
    pub target_lang: String,
    pub timestamp: u64,
    pub hit_count: u32,
}

/// Limite massimo entries per cache (ottimizzazione memoria)
const MAX_CACHE_ENTRIES: usize = 5000;

/// Cache delle traduzioni
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationCache {
    pub entries: HashMap<String, CacheEntry>,
    pub game_id: String,
    pub total_hits: u64,
    pub total_misses: u64,
}

impl TranslationCache {
    pub fn new(game_id: &str) -> Self {
        Self {
            entries: HashMap::new(),
            game_id: game_id.to_string(),
            total_hits: 0,
            total_misses: 0,
        }
    }
    
    /// Cerca una traduzione nella cache
    pub fn get(&mut self, original: &str, target_lang: &str) -> Option<String> {
        let key = Self::make_key(original, target_lang);
        
        if let Some(entry) = self.entries.get_mut(&key) {
            entry.hit_count += 1;
            self.total_hits += 1;
            Some(entry.translated.clone())
        } else {
            self.total_misses += 1;
            None
        }
    }
    
    /// Aggiunge una traduzione alla cache
    pub fn set(&mut self, original: &str, translated: &str, source_lang: &str, target_lang: &str) {
        // Evita cache overflow - rimuovi entries meno usate se necessario
        if self.entries.len() >= MAX_CACHE_ENTRIES {
            self.evict_least_used(MAX_CACHE_ENTRIES / 10); // Rimuovi 10%
        }
        
        let key = Self::make_key(original, target_lang);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        self.entries.insert(key, CacheEntry {
            original: original.to_string(),
            translated: translated.to_string(),
            source_lang: source_lang.to_string(),
            target_lang: target_lang.to_string(),
            timestamp,
            hit_count: 0,
        });
    }
    
    /// Rimuove le entries meno usate per liberare memoria
    fn evict_least_used(&mut self, count: usize) {
        // Ordina per hit_count e timestamp, rimuovi i più vecchi/meno usati
        let mut entries: Vec<_> = self.entries.iter()
            .map(|(k, v)| (k.clone(), v.hit_count, v.timestamp))
            .collect();
        
        // Ordina: prima per hit_count (meno usati), poi per timestamp (più vecchi)
        entries.sort_by(|a, b| {
            a.1.cmp(&b.1).then_with(|| a.2.cmp(&b.2))
        });
        
        // Rimuovi i primi 'count' entries
        for (key, _, _) in entries.into_iter().take(count) {
            self.entries.remove(&key);
        }
        
        log::debug!("🧹 Cache eviction: rimossi {} entries", count);
    }
    
    /// Crea chiave per la cache
    fn make_key(original: &str, target_lang: &str) -> String {
        format!("{}:{}", target_lang, original)
    }
    
    /// Ottiene statistiche della cache
    pub fn stats(&self) -> CacheStats {
        let hit_rate = if self.total_hits + self.total_misses > 0 {
            (self.total_hits as f64) / ((self.total_hits + self.total_misses) as f64) * 100.0
        } else {
            0.0
        };
        
        CacheStats {
            entries_count: self.entries.len(),
            total_hits: self.total_hits,
            total_misses: self.total_misses,
            hit_rate,
        }
    }
    
    /// Pulisce entries vecchie (più di 30 giorni)
    pub fn cleanup_old_entries(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        let thirty_days = 30 * 24 * 60 * 60;
        
        self.entries.retain(|_, entry| {
            now - entry.timestamp < thirty_days
        });
    }
    
    /// Salva cache su disco
    pub fn save(&self, cache_dir: &Path) -> Result<(), String> {
        fs::create_dir_all(cache_dir)
            .map_err(|e| format!("Errore creazione cartella cache: {}", e))?;
        
        let cache_file = cache_dir.join(format!("{}.json", self.game_id));
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Errore serializzazione cache: {}", e))?;
        
        fs::write(&cache_file, json)
            .map_err(|e| format!("Errore scrittura cache: {}", e))?;
        
        log::info!("💾 Cache salvata: {} entries", self.entries.len());
        Ok(())
    }
    
    /// Carica cache da disco
    pub fn load(cache_dir: &Path, game_id: &str) -> Result<Self, String> {
        let cache_file = cache_dir.join(format!("{}.json", game_id));
        
        if !cache_file.exists() {
            return Ok(Self::new(game_id));
        }
        
        let json = fs::read_to_string(&cache_file)
            .map_err(|e| format!("Errore lettura cache: {}", e))?;
        
        let cache: Self = serde_json::from_str(&json)
            .map_err(|e| format!("Errore parsing cache: {}", e))?;
        
        log::info!("📦 Cache caricata: {} entries", cache.entries.len());
        Ok(cache)
    }
    
    /// Esporta cache in formato testo (per backup/condivisione)
    pub fn export_text(&self, path: &Path) -> Result<(), String> {
        let mut content = String::new();
        content.push_str(&format!("# Translation Cache for {}\n", self.game_id));
        content.push_str(&format!("# Entries: {}\n\n", self.entries.len()));
        
        for entry in self.entries.values() {
            content.push_str(&format!("{}={}\n", entry.original, entry.translated));
        }
        
        fs::write(path, content)
            .map_err(|e| format!("Errore esportazione: {}", e))?;
        
        Ok(())
    }
    
    /// Importa traduzioni da file testo
    pub fn import_text(&mut self, path: &Path, source_lang: &str, target_lang: &str) -> Result<u32, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Errore lettura file: {}", e))?;
        
        let mut imported = 0;
        
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            
            if let Some(pos) = line.find('=') {
                let original = &line[..pos];
                let translated = &line[pos + 1..];
                
                if !original.is_empty() && !translated.is_empty() {
                    self.set(original, translated, source_lang, target_lang);
                    imported += 1;
                }
            }
        }
        
        log::info!("📥 Importate {} traduzioni", imported);
        Ok(imported)
    }
}

/// Statistiche cache
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub entries_count: usize,
    pub total_hits: u64,
    pub total_misses: u64,
    pub hit_rate: f64,
}

/// Limite massimo cache attive in memoria
const MAX_ACTIVE_CACHES: usize = 3;

/// Manager globale delle cache per tutti i giochi
pub struct CacheManager {
    cache_dir: PathBuf,
    active_caches: HashMap<String, TranslationCache>,
    access_order: Vec<String>, // Per LRU eviction
}

impl CacheManager {
    pub fn new(cache_dir: PathBuf) -> Self {
        Self {
            cache_dir,
            active_caches: HashMap::new(),
            access_order: Vec::new(),
        }
    }
    
    /// Ottiene o carica la cache per un gioco
    pub fn get_cache(&mut self, game_id: &str) -> &mut TranslationCache {
        // Aggiorna ordine accesso
        self.access_order.retain(|id| id != game_id);
        self.access_order.push(game_id.to_string());
        
        if !self.active_caches.contains_key(game_id) {
            // Evita troppe cache in memoria
            self.evict_old_caches();
            
            let cache = TranslationCache::load(&self.cache_dir, game_id)
                .unwrap_or_else(|_| TranslationCache::new(game_id));
            self.active_caches.insert(game_id.to_string(), cache);
        }
        
        self.active_caches.get_mut(game_id).unwrap()
    }
    
    /// Rimuove cache meno usate per liberare memoria
    fn evict_old_caches(&mut self) {
        while self.active_caches.len() >= MAX_ACTIVE_CACHES && !self.access_order.is_empty() {
            if let Some(oldest_id) = self.access_order.first().cloned() {
                // Salva prima di rimuovere
                if let Some(cache) = self.active_caches.get(&oldest_id) {
                    let _ = cache.save(&self.cache_dir);
                }
                self.active_caches.remove(&oldest_id);
                self.access_order.remove(0);
                log::debug!("🧹 Cache manager: rimossa cache per {}", oldest_id);
            }
        }
    }
    
    /// Salva tutte le cache attive
    pub fn save_all(&self) -> Result<(), String> {
        for cache in self.active_caches.values() {
            cache.save(&self.cache_dir)?;
        }
        Ok(())
    }
    
    /// Ottiene uso memoria stimato (bytes)
    pub fn estimated_memory_usage(&self) -> usize {
        self.active_caches.values()
            .map(|c| c.entries.len() * 200) // ~200 bytes per entry stimati
            .sum()
    }
}
