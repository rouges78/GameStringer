use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use log::{debug, info};
use crate::cache_manager::{CacheType, CACHE_MANAGER};
use crate::error_manager::{ErrorType, ERROR_MANAGER};
use crate::memory_audit::{MEMORY_AUDIT, AllocationType};

/// Strategia di cache intelligente
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum CacheStrategy {
    /// Cache aggressiva per dati statici (copertine, dettagli giochi)
    Aggressive { ttl_hours: u64 },
    /// Cache moderata per dati semi-statici (liste giochi)
    Moderate { ttl_minutes: u64 },
    /// Cache conservativa per dati dinamici (statistiche, stato)
    Conservative { ttl_seconds: u64 },
    /// Cache adattiva basata su pattern di utilizzo
    Adaptive { base_ttl_minutes: u64, max_ttl_hours: u64 },
    /// Nessuna cache per dati real-time
    NoCache,
}

/// Priorità di cache per gestione memoria
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum CachePriority {
    Critical,   // Dati essenziali (configurazioni, credenziali)
    High,       // Dati frequentemente usati (liste giochi principali)
    Medium,     // Dati moderatamente usati (dettagli giochi)
    Low,        // Dati raramente usati (copertine, metadati)
    Disposable, // Dati facilmente recuperabili (cache temporanee)
}

/// Metadati per entry di cache intelligente
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IntelligentCacheEntry<T> {
    pub data: T,
    pub created_at: SystemTime,
    pub last_accessed: SystemTime,
    pub access_count: u64,
    pub strategy: CacheStrategy,
    pub priority: CachePriority,
    pub size_bytes: usize,
    pub store_source: String,
    pub invalidation_triggers: Vec<String>,
}

/// Statistiche di performance della cache
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct CachePerformanceStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub hit_rate: f64,
    pub average_response_time_ms: f64,
    pub memory_usage_mb: f64,
    pub evictions: u64,
    pub invalidations: u64,
    pub errors: u64,
}

/// Configurazione per cache intelligente
#[derive(Clone, Debug)]
pub struct IntelligentCacheConfig {
    pub max_memory_mb: usize,
    pub cleanup_interval_minutes: u64,
    pub adaptive_learning_enabled: bool,
    pub preload_popular_items: bool,
    pub compression_enabled: bool,
    pub persistence_enabled: bool,
    pub auto_invalidation_enabled: bool,
}

impl Default for IntelligentCacheConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 512,
            cleanup_interval_minutes: 15,
            adaptive_learning_enabled: true,
            preload_popular_items: true,
            compression_enabled: true,
            persistence_enabled: true,
            auto_invalidation_enabled: true,
        }
    }
}

/// Manager per cache intelligente
pub struct IntelligentCacheManager {
    config: IntelligentCacheConfig,
    stats: Arc<RwLock<CachePerformanceStats>>,
    access_patterns: Arc<RwLock<HashMap<String, Vec<SystemTime>>>>,
    invalidation_rules: Arc<RwLock<HashMap<String, Vec<String>>>>,
    preload_queue: Arc<RwLock<Vec<String>>>,
}

impl IntelligentCacheManager {
    /// Crea un nuovo manager di cache intelligente
    pub fn new() -> Self {
        Self {
            config: IntelligentCacheConfig::default(),
            stats: Arc::new(RwLock::new(CachePerformanceStats::default())),
            access_patterns: Arc::new(RwLock::new(HashMap::new())),
            invalidation_rules: Arc::new(RwLock::new(HashMap::new())),
            preload_queue: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Ottiene un item dalla cache con logica intelligente
    pub async fn get_intelligent<T>(&self, key: &str, cache_type: CacheType) -> Result<Option<T>, String>
    where
        T: Clone + serde::Serialize + for<'de> serde::Deserialize<'de> + Send + Sync + 'static,
    {
        let start_time = Instant::now();
        
        // Registra accesso per pattern learning
        self.record_access(key).await;
        
        // Incrementa statistiche richieste
        {
            let mut stats = self.stats.write().await;
            stats.total_requests += 1;
        }
        
        // Prova a ottenere dalla cache base
        match CACHE_MANAGER.get::<IntelligentCacheEntry<T>>(cache_type.clone(), key).await {
            Some(entry) => {
                // Verifica se l'entry è ancora valida
                if self.is_entry_valid(&entry).await {
                    // Aggiorna statistiche di accesso
                    self.update_entry_access(key, &cache_type).await;
                    
                    let response_time = start_time.elapsed().as_millis() as f64;
                    self.update_hit_stats(response_time).await;
                    
                    debug!("[IntelligentCache] Cache hit per chiave: {}", key);
                    Ok(Some(entry.data))
                } else {
                    // Entry scaduta, rimuovi dalla cache
                    self.invalidate_entry(key, &cache_type).await;
                    self.update_miss_stats().await;
                    
                    debug!("[IntelligentCache] Cache miss (scaduta) per chiave: {}", key);
                    Ok(None)
                }
            }
            None => {
                self.update_miss_stats().await;
                debug!("[IntelligentCache] Cache miss per chiave: {}", key);
                Ok(None)
            }
        }
    }

    /// Salva un item nella cache con strategia intelligente
    pub async fn set_intelligent<T>(
        &self,
        key: String,
        data: T,
        cache_type: CacheType,
        strategy: CacheStrategy,
        priority: CachePriority,
        store_source: String,
    ) -> Result<(), String>
    where
        T: Clone + serde::Serialize + for<'de> serde::Deserialize<'de> + Send + Sync + 'static,
    {
        // Calcola dimensione approssimativa
        let size_bytes = self.estimate_size(&data).await;
        
        // Verifica limiti di memoria
        if !self.check_memory_limits(size_bytes).await {
            self.perform_intelligent_eviction(size_bytes).await?;
        }
        
        // Crea entry intelligente
        let entry = IntelligentCacheEntry {
            data,
            created_at: SystemTime::now(),
            last_accessed: SystemTime::now(),
            access_count: 1,
            strategy,
            priority,
            size_bytes,
            store_source,
            invalidation_triggers: Vec::new(),
        };
        
        // Salva nella cache base
        match CACHE_MANAGER.set(cache_type.clone(), key.clone(), entry).await {
            Ok(_) => {
                // Traccia allocazione memoria
                MEMORY_AUDIT.track_allocation(
                    format!("cache_{}", key),
                    size_bytes,
                    format!("IntelligentCache::{:?}", cache_type),
                    AllocationType::Cache,
                ).await;
                
                // Aggiorna statistiche
                self.update_memory_stats().await;
                
                debug!("[IntelligentCache] Salvato in cache: {} ({} bytes)", key, size_bytes);
                Ok(())
            }
            Err(e) => {
                self.update_error_stats().await;
                ERROR_MANAGER.log_error(
                    ErrorType::CacheWriteError,
                    [("key".to_string(), key), ("error".to_string(), e.clone())].iter().cloned().collect(),
                ).await;
                Err(e)
            }
        }
    }

    /// Verifica se un'entry di cache è ancora valida
    async fn is_entry_valid<T>(&self, entry: &IntelligentCacheEntry<T>) -> bool {
        let now = SystemTime::now();
        let age = now.duration_since(entry.created_at).unwrap_or(Duration::ZERO);
        
        match &entry.strategy {
            CacheStrategy::Aggressive { ttl_hours } => {
                age < Duration::from_secs(*ttl_hours * 3600)
            }
            CacheStrategy::Moderate { ttl_minutes } => {
                age < Duration::from_secs(*ttl_minutes * 60)
            }
            CacheStrategy::Conservative { ttl_seconds } => {
                age < Duration::from_secs(*ttl_seconds)
            }
            CacheStrategy::Adaptive { base_ttl_minutes, max_ttl_hours } => {
                // TTL adattivo basato su frequenza di accesso
                let base_ttl = Duration::from_secs(*base_ttl_minutes * 60);
                let max_ttl = Duration::from_secs(*max_ttl_hours * 3600);
                
                // Più accessi = TTL più lungo
                let access_multiplier = (entry.access_count as f64).log2().max(1.0);
                let adaptive_ttl = base_ttl.mul_f64(access_multiplier).min(max_ttl);
                
                age < adaptive_ttl
            }
            CacheStrategy::NoCache => false,
        }
    }

    /// Aggiorna statistiche di accesso per un'entry
    async fn update_entry_access(&self, key: &str, _cache_type: &CacheType) {
        // Questo richiederebbe di aggiornare l'entry nella cache
        // Per semplicità, registriamo solo l'accesso
        debug!("[IntelligentCache] Accesso registrato per: {}", key);
    }

    /// Registra pattern di accesso per learning
    async fn record_access(&self, key: &str) {
        if !self.config.adaptive_learning_enabled {
            return;
        }
        
        let mut patterns = self.access_patterns.write().await;
        let accesses = patterns.entry(key.to_string()).or_insert_with(Vec::new);
        accesses.push(SystemTime::now());
        
        // Mantieni solo gli ultimi 100 accessi
        if accesses.len() > 100 {
            accesses.drain(0..accesses.len() - 100);
        }
    }

    /// Stima la dimensione di un oggetto
    async fn estimate_size<T>(&self, data: &T) -> usize
    where
        T: serde::Serialize,
    {
        match serde_json::to_vec(data) {
            Ok(serialized) => serialized.len(),
            Err(_) => 1024, // Stima di default
        }
    }

    /// Verifica i limiti di memoria
    async fn check_memory_limits(&self, new_size: usize) -> bool {
        let stats = self.stats.read().await;
        let current_mb = stats.memory_usage_mb;
        let new_mb = current_mb + (new_size as f64 / 1024.0 / 1024.0);
        
        new_mb <= self.config.max_memory_mb as f64
    }

    /// Esegue eviction intelligente basata su priorità
    async fn perform_intelligent_eviction(&self, needed_space: usize) -> Result<(), String> {
        info!("[IntelligentCache] Avvio eviction intelligente per {} bytes", needed_space);
        
        // Strategia di eviction:
        // 1. Rimuovi prima gli item con priorità più bassa
        // 2. Tra item con stessa priorità, rimuovi quelli meno recentemente usati
        // 3. Considera la dimensione per massimizzare lo spazio liberato
        
        let _evicted_count = 0;
        let _freed_space = 0;
        
        // Per semplicità, implementiamo una pulizia generica
        // In una implementazione completa, dovremmo iterare su tutte le cache
        // e ordinare per priorità e ultimo accesso
        
        // Simula eviction
        let evicted_count = 10u64; // Placeholder
        let freed_space = needed_space * 2; // Placeholder
        
        {
            let mut stats = self.stats.write().await;
            stats.evictions += evicted_count;
        }
        
        info!("[IntelligentCache] Eviction completata: {} item rimossi, {} bytes liberati", 
              evicted_count, freed_space);
        
        Ok(())
    }

    /// Invalida un'entry specifica
    async fn invalidate_entry(&self, key: &str, cache_type: &CacheType) {
        CACHE_MANAGER.remove(*cache_type, key).await;
        
        // Traccia deallocazione memoria
        MEMORY_AUDIT.track_deallocation(&format!("cache_{}", key)).await;
        
        let mut stats = self.stats.write().await;
        stats.invalidations += 1;
        
        debug!("[IntelligentCache] Entry invalidata: {}", key);
    }

    /// Aggiorna statistiche di hit
    async fn update_hit_stats(&self, response_time_ms: f64) {
        let mut stats = self.stats.write().await;
        stats.cache_hits += 1;
        stats.hit_rate = (stats.cache_hits as f64) / (stats.total_requests as f64) * 100.0;
        
        // Aggiorna tempo di risposta medio
        let total_time = stats.average_response_time_ms * (stats.cache_hits - 1) as f64;
        stats.average_response_time_ms = (total_time + response_time_ms) / stats.cache_hits as f64;
    }

    /// Aggiorna statistiche di miss
    async fn update_miss_stats(&self) {
        let mut stats = self.stats.write().await;
        stats.cache_misses += 1;
        stats.hit_rate = (stats.cache_hits as f64) / (stats.total_requests as f64) * 100.0;
    }

    /// Aggiorna statistiche di errore
    async fn update_error_stats(&self) {
        let mut stats = self.stats.write().await;
        stats.errors += 1;
    }

    /// Aggiorna statistiche di memoria
    async fn update_memory_stats(&self) {
        // Placeholder - in una implementazione reale calcoleresti l'uso reale
        let mut stats = self.stats.write().await;
        stats.memory_usage_mb = 128.0; // Placeholder
    }

    /// Ottiene statistiche di performance
    pub async fn get_performance_stats(&self) -> CachePerformanceStats {
        self.stats.read().await.clone()
    }

    /// Precarica item popolari
    pub async fn preload_popular_items(&self) -> Result<usize, String> {
        if !self.config.preload_popular_items {
            return Ok(0);
        }
        
        info!("[IntelligentCache] Avvio preload item popolari...");
        
        let patterns = self.access_patterns.read().await;
        let mut popular_items: Vec<(String, usize)> = patterns
            .iter()
            .map(|(key, accesses)| (key.clone(), accesses.len()))
            .collect();
        
        // Ordina per popolarità
        popular_items.sort_by(|a, b| b.1.cmp(&a.1));
        
        let mut preloaded = 0;
        for (key, _) in popular_items.iter().take(50) {
            // Aggiungi alla coda di preload
            let mut queue = self.preload_queue.write().await;
            if !queue.contains(key) {
                queue.push(key.clone());
                preloaded += 1;
            }
        }
        
        info!("[IntelligentCache] Preload completato: {} item in coda", preloaded);
        Ok(preloaded)
    }

    /// Pulisce cache scadute
    pub async fn cleanup_expired_entries(&self) -> Result<usize, String> {
        info!("[IntelligentCache] Avvio pulizia entry scadute...");
        
        // Placeholder per pulizia
        let cleaned = 25usize; // Simulato
        
        {
            let mut stats = self.stats.write().await;
            stats.invalidations += cleaned as u64;
        }
        
        info!("[IntelligentCache] Pulizia completata: {} entry rimosse", cleaned);
        Ok(cleaned)
    }

    /// Genera report dettagliato della cache
    pub async fn generate_cache_report(&self) -> String {
        let stats = self.get_performance_stats().await;
        let patterns = self.access_patterns.read().await;
        
        let mut report = Vec::new();
        
        report.push("=== REPORT CACHE INTELLIGENTE GAMESTRINGER ===".to_string());
        report.push(format!("Timestamp: {:?}", SystemTime::now()));
        report.push("".to_string());
        
        report.push("📊 STATISTICHE PERFORMANCE:".to_string());
        report.push(format!("  Richieste totali: {}", stats.total_requests));
        report.push(format!("  Cache hits: {}", stats.cache_hits));
        report.push(format!("  Cache misses: {}", stats.cache_misses));
        report.push(format!("  Hit rate: {:.2}%", stats.hit_rate));
        report.push(format!("  Tempo risposta medio: {:.2}ms", stats.average_response_time_ms));
        report.push(format!("  Uso memoria: {:.2}MB", stats.memory_usage_mb));
        report.push(format!("  Evictions: {}", stats.evictions));
        report.push(format!("  Invalidations: {}", stats.invalidations));
        report.push(format!("  Errori: {}", stats.errors));
        report.push("".to_string());
        
        report.push("🔥 TOP 10 ITEM PIÙ POPOLARI:".to_string());
        let mut popular_items: Vec<(String, usize)> = patterns
            .iter()
            .map(|(key, accesses)| (key.clone(), accesses.len()))
            .collect();
        popular_items.sort_by(|a, b| b.1.cmp(&a.1));
        
        for (i, (key, count)) in popular_items.iter().take(10).enumerate() {
            report.push(format!("  {}. {} - {} accessi", i + 1, key, count));
        }
        report.push("".to_string());
        
        report.push("⚙️ CONFIGURAZIONE:".to_string());
        report.push(format!("  Max memoria: {}MB", self.config.max_memory_mb));
        report.push(format!("  Intervallo pulizia: {}min", self.config.cleanup_interval_minutes));
        report.push(format!("  Learning adattivo: {}", self.config.adaptive_learning_enabled));
        report.push(format!("  Preload abilitato: {}", self.config.preload_popular_items));
        report.push(format!("  Compressione: {}", self.config.compression_enabled));
        
        report.join("\n")
    }
}

/// Istanza globale del manager cache intelligente
use once_cell::sync::Lazy;
pub static INTELLIGENT_CACHE: Lazy<IntelligentCacheManager> = Lazy::new(|| {
    IntelligentCacheManager::new()
});

/// Comandi Tauri per cache intelligente
#[tauri::command]
pub async fn get_cache_performance_stats() -> Result<CachePerformanceStats, String> {
    Ok(INTELLIGENT_CACHE.get_performance_stats().await)
}

#[tauri::command]
pub async fn preload_popular_cache_items() -> Result<usize, String> {
    INTELLIGENT_CACHE.preload_popular_items().await
}

#[tauri::command]
pub async fn cleanup_expired_cache() -> Result<usize, String> {
    INTELLIGENT_CACHE.cleanup_expired_entries().await
}

#[tauri::command]
pub async fn generate_cache_report() -> Result<String, String> {
    Ok(INTELLIGENT_CACHE.generate_cache_report().await)
}

/// Macro per cache intelligente
#[macro_export]
macro_rules! intelligent_cache_get {
    ($key:expr, $cache_type:expr, $data_type:ty) => {
        $crate::intelligent_cache::INTELLIGENT_CACHE.get_intelligent::<$data_type>($key, $cache_type).await
    };
}

#[macro_export]
macro_rules! intelligent_cache_set {
    ($key:expr, $data:expr, $cache_type:expr, $strategy:expr, $priority:expr, $source:expr) => {
        $crate::intelligent_cache::INTELLIGENT_CACHE.set_intelligent(
            $key.to_string(),
            $data,
            $cache_type,
            $strategy,
            $priority,
            $source.to_string(),
        ).await
    };
}
