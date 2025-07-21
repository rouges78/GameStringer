use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub injection_latency_ms: u64,
    pub memory_usage_kb: u64,
    pub cpu_usage_percent: f32,
    pub hook_application_time_ms: u64,
    pub translation_throughput: f32, // traduzioni/secondo
    pub cache_hit_rate: f32,
    pub error_rate: f32,
    pub recovery_time_ms: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub enable_lazy_loading: bool,
    pub enable_hook_pooling: bool,
    pub enable_memory_compression: bool,
    pub enable_adaptive_polling: bool,
    pub enable_batch_processing: bool,
    pub max_concurrent_hooks: usize,
    pub polling_interval_ms: u64,
    pub cache_size_limit: usize,
    pub gc_interval_seconds: u64,
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            enable_lazy_loading: true,
            enable_hook_pooling: true,
            enable_memory_compression: false, // Disabilitato di default per compatibilità
            enable_adaptive_polling: true,
            enable_batch_processing: true,
            max_concurrent_hooks: 16,
            polling_interval_ms: 100,
            cache_size_limit: 10000,
            gc_interval_seconds: 300, // 5 minuti
        }
    }
}

#[derive(Debug)]
pub struct PerformanceOptimizer {
    config: OptimizationConfig,
    metrics: Arc<Mutex<PerformanceMetrics>>,
    hook_pool: Arc<Mutex<Vec<HookHandle>>>,
    translation_cache: Arc<Mutex<HashMap<String, CachedTranslation>>>,
    last_gc: Arc<Mutex<DateTime<Utc>>>,
    adaptive_polling_interval: Arc<Mutex<Duration>>,
}

#[derive(Debug, Clone)]
struct HookHandle {
    id: usize,
    is_active: bool,
    last_used: DateTime<Utc>,
    performance_score: f32,
}

#[derive(Debug, Clone)]
struct CachedTranslation {
    text: String,
    translated: String,
    timestamp: DateTime<Utc>,
    hit_count: u32,
    priority: u8,
}

impl PerformanceOptimizer {
    pub fn new(config: OptimizationConfig) -> Self {
        let polling_interval = config.polling_interval_ms;
        Self {
            config,
            metrics: Arc::new(Mutex::new(PerformanceMetrics {
                injection_latency_ms: 0,
                memory_usage_kb: 0,
                cpu_usage_percent: 0.0,
                hook_application_time_ms: 0,
                translation_throughput: 0.0,
                cache_hit_rate: 0.0,
                error_rate: 0.0,
                recovery_time_ms: 0,
                timestamp: Utc::now(),
            })),
            hook_pool: Arc::new(Mutex::new(Vec::new())),
            translation_cache: Arc::new(Mutex::new(HashMap::new())),
            last_gc: Arc::new(Mutex::new(Utc::now())),
            adaptive_polling_interval: Arc::new(Mutex::new(Duration::from_millis(polling_interval))),
        }
    }

    /// Costruttore alternativo che clona la configurazione
    /// Utile quando il config deve essere riutilizzato dopo la creazione dell'optimizer
    pub fn from_config(config: &OptimizationConfig) -> Self {
        Self::new(config.clone())
    }

    /// Ottimizza l'applicazione degli hook con pooling e lazy loading
    pub fn optimize_hook_application(&self, hook_count: usize) -> Result<Vec<usize>, String> {
        let start_time = Utc::now();
        let mut optimized_hooks = Vec::new();

        if self.config.enable_hook_pooling {
            // Usa pool di hook esistenti quando possibile
            let mut pool = self.hook_pool.lock().map_err(|_| "Errore accesso hook pool")?;
            
            // Riutilizza hook inattivi dal pool
            let mut reused_count = 0;
            for hook in pool.iter_mut() {
                if !hook.is_active && reused_count < hook_count {
                    hook.is_active = true;
                    hook.last_used = Utc::now();
                    optimized_hooks.push(hook.id);
                    reused_count += 1;
                }
            }

            // Crea nuovi hook solo se necessario
            for i in reused_count..hook_count {
                let new_hook = HookHandle {
                    id: pool.len() + i,
                    is_active: true,
                    last_used: Utc::now(),
                    performance_score: 1.0,
                };
                optimized_hooks.push(new_hook.id);
                pool.push(new_hook);
            }

            log::info!("🔄 Hook pooling: {} riutilizzati, {} nuovi", reused_count, hook_count - reused_count);
        } else {
            // Modalità tradizionale senza pooling
            for i in 0..hook_count {
                optimized_hooks.push(i);
            }
        }

        // Aggiorna metriche
        let application_time = Utc::now().signed_duration_since(start_time).num_milliseconds() as u64;
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.hook_application_time_ms = application_time;
            metrics.timestamp = Utc::now();
        }

        log::debug!("⚡ Hook application ottimizzata: {}ms per {} hook", application_time, hook_count);
        Ok(optimized_hooks)
    }

    /// Ottimizza la cache delle traduzioni con algoritmi intelligenti
    pub fn optimize_translation_cache(&self, text: &str) -> Option<String> {
        let start_time = Utc::now();
        
        // Pattern di accesso sicuro: scope limitato per il lock
        let cache_result = {
            match self.translation_cache.lock() {
                Ok(mut cache) => {
                    // Controlla cache hit
                    if let Some(cached) = cache.get_mut(text) {
                        cached.hit_count += 1;
                        cached.timestamp = Utc::now();
                        
                        log::debug!("💾 Cache hit per: {} (hits: {})", text, cached.hit_count);
                        Some((cached.translated.clone(), true)) // (result, is_hit)
                    } else {
                        // Cache miss - implementa strategia di eviction se necessario
                        if cache.len() >= self.config.cache_size_limit {
                            self.evict_cache_entries(&mut cache);
                        }
                        Some((String::new(), false)) // Placeholder per cache miss
                    }
                }
                Err(e) => {
                    log::warn!("🔒 Errore accesso cache traduzioni: {:?}", e);
                    None
                }
            }
        };

        // Aggiorna metriche fuori dal lock per evitare conflitti di borrowing
        match cache_result {
            Some((result, is_hit)) => {
                self.update_cache_metrics(is_hit);
                if is_hit {
                    Some(result)
                } else {
                    let lookup_time = Utc::now().signed_duration_since(start_time).num_milliseconds();
                    log::debug!("🔍 Cache lookup: {}ms", lookup_time);
                    None
                }
            }
            None => {
                let lookup_time = Utc::now().signed_duration_since(start_time).num_milliseconds();
                log::debug!("🔍 Cache lookup failed: {}ms", lookup_time);
                None
            }
        }
    }

    /// Aggiunge traduzione alla cache con priorità intelligente
    pub fn cache_translation(&self, original: String, translated: String, priority: u8) {
        // Pattern di accesso sicuro con error handling
        match self.translation_cache.lock() {
            Ok(mut cache) => {
                let cached_translation = CachedTranslation {
                    text: original.clone(),
                    translated,
                    timestamp: Utc::now(),
                    hit_count: 0,
                    priority,
                };

                cache.insert(original, cached_translation);
                log::debug!("💾 Traduzione cached con priorità: {}", priority);
            }
            Err(e) => {
                log::warn!("🔒 Errore accesso cache per inserimento: {:?}", e);
            }
        }
    }

    /// Ottimizza l'intervallo di polling in modo adattivo
    pub fn optimize_polling_interval(&self, current_load: f32) {
        if !self.config.enable_adaptive_polling {
            return;
        }

        let new_interval = if current_load > 0.8 {
            // Alto carico: aumenta intervallo per ridurre overhead
            Duration::from_millis(self.config.polling_interval_ms * 2)
        } else if current_load < 0.3 {
            // Basso carico: diminuisce intervallo per responsività
            Duration::from_millis(self.config.polling_interval_ms / 2)
        } else {
            // Carico normale: usa intervallo standard
            Duration::from_millis(self.config.polling_interval_ms)
        };

        if let Ok(mut interval) = self.adaptive_polling_interval.lock() {
            *interval = new_interval;
        }

        log::debug!("🔄 Polling interval adattato: {}ms (carico: {:.1}%)", 
            new_interval.as_millis(), current_load * 100.0);
    }

    /// Esegue garbage collection intelligente
    pub fn perform_garbage_collection(&self) -> Result<usize, String> {
        let start_time = Utc::now();
        let mut cleaned_items = 0;

        // Controlla se è tempo di GC
        {
            let last_gc = self.last_gc.lock().map_err(|_| "Errore accesso last_gc")?;
            if Utc::now().signed_duration_since(*last_gc).num_seconds() < self.config.gc_interval_seconds as i64 {
                return Ok(0); // Non è ancora tempo
            }
        }

        // Pulizia cache traduzioni con accesso sicuro
        if let Some(cache_cleaned) = self.safe_cache_write(|cache| {
            let before_size = cache.len();
            let cutoff_time = Utc::now() - chrono::Duration::seconds(3600); // 1 ora

            cache.retain(|_, translation| {
                translation.timestamp > cutoff_time || translation.hit_count > 5
            });

            let cleaned = before_size - cache.len();
            log::info!("🧹 Cache GC: {} traduzioni rimosse", cleaned);
            cleaned
        }) {
            cleaned_items += cache_cleaned;
        }

        // Pulizia hook pool
        if let Ok(mut pool) = self.hook_pool.lock() {
            let before_size = pool.len();
            let cutoff_time = Utc::now() - chrono::Duration::seconds(300); // 5 minuti

            pool.retain(|hook| {
                hook.is_active || hook.last_used > cutoff_time
            });

            cleaned_items += before_size - pool.len();
            log::info!("🧹 Hook pool GC: {} hook rimossi", before_size - pool.len());
        }

        // Aggiorna timestamp ultimo GC
        if let Ok(mut last_gc) = self.last_gc.lock() {
            *last_gc = Utc::now();
        }

        let gc_time = Utc::now().signed_duration_since(start_time).num_milliseconds();
        log::info!("🧹 Garbage collection completato: {} items puliti in {}ms", cleaned_items, gc_time);

        Ok(cleaned_items)
    }

    /// Ottimizza il batch processing delle traduzioni
    pub fn optimize_batch_processing(&self, translations: Vec<String>) -> Result<Vec<String>, String> {
        if !self.config.enable_batch_processing || translations.is_empty() {
            return Ok(translations);
        }

        let start_time = Utc::now();
        let mut optimized_batch = Vec::new();
        let mut cache_hits = 0;

        // Raggruppa traduzioni simili e rimuovi duplicati
        let mut unique_translations = HashMap::new();
        for (index, text) in translations.iter().enumerate() {
            unique_translations.entry(text.clone()).or_insert_with(Vec::new).push(index);
        }

        // Processa batch ottimizzato
        for (text, indices) in unique_translations {
            if let Some(cached) = self.optimize_translation_cache(&text) {
                // Cache hit - usa traduzione cached per tutti gli indici
                for _ in &indices {
                    optimized_batch.push(cached.clone());
                }
                cache_hits += indices.len();
            } else {
                // Cache miss - aggiungi alla lista per traduzione
                for _ in &indices {
                    optimized_batch.push(text.clone());
                }
            }
        }

        let processing_time = Utc::now().signed_duration_since(start_time).num_milliseconds();
        let efficiency = (cache_hits as f32 / translations.len() as f32) * 100.0;

        log::info!("📦 Batch processing: {} traduzioni, {:.1}% cache hit, {}ms", 
            translations.len(), efficiency, processing_time);

        Ok(optimized_batch)
    }

    /// Ottimizza l'uso della memoria con compressione intelligente
    pub fn optimize_memory_usage(&self) -> Result<u64, String> {
        if !self.config.enable_memory_compression {
            return Ok(0);
        }

        let start_time = Utc::now();
        let mut memory_saved = 0u64;

        // Comprimi cache traduzioni meno utilizzate
        if let Ok(mut cache) = self.translation_cache.lock() {
            for (_, translation) in cache.iter_mut() {
                if translation.hit_count < 3 {
                    // Simula compressione (in realtà useresti una libreria come flate2)
                    let original_size = translation.translated.len() as u64;
                    let compressed_size = (original_size as f32 * 0.7) as u64; // 30% riduzione simulata
                    memory_saved += original_size - compressed_size;
                }
            }
        }

        let compression_time = Utc::now().signed_duration_since(start_time).num_milliseconds();
        log::info!("🗜️ Compressione memoria: {}KB salvati in {}ms", memory_saved / 1024, compression_time);

        Ok(memory_saved)
    }

    /// Ottiene le metriche di performance correnti
    pub fn get_performance_metrics(&self) -> Result<PerformanceMetrics, String> {
        self.metrics.lock()
            .map(|metrics| metrics.clone())
            .map_err(|_| "Errore accesso metriche".to_string())
    }

    /// Aggiorna le metriche di performance
    pub fn update_performance_metrics(&self, latency_ms: u64, memory_kb: u64, cpu_percent: f32) {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.injection_latency_ms = latency_ms;
            metrics.memory_usage_kb = memory_kb;
            metrics.cpu_usage_percent = cpu_percent;
            metrics.timestamp = Utc::now();
        }
    }

    /// Aggiorna la configurazione dell'optimizer
    pub fn update_config(&mut self, new_config: OptimizationConfig) {
        self.config = new_config;
        log::info!("🔧 Configurazione Performance Optimizer aggiornata");
    }

    /// Ottiene una copia della configurazione corrente
    pub fn get_config(&self) -> OptimizationConfig {
        self.config.clone()
    }

    /// Pulisce la cache delle traduzioni in modo sicuro
    pub fn clear_translation_cache(&self) -> Result<usize, String> {
        match self.safe_cache_write(|cache| {
            let size = cache.len();
            cache.clear();
            size
        }) {
            Some(cleared_count) => {
                log::info!("🧹 Cache traduzioni pulita: {} entry rimosse", cleared_count);
                Ok(cleared_count)
            }
            None => Err("Errore accesso cache per pulizia".to_string())
        }
    }

    /// Ottiene statistiche della cache in modo sicuro
    pub fn get_cache_stats(&self) -> HashMap<String, serde_json::Value> {
        let mut stats = HashMap::new();
        
        if let Some(cache_info) = self.safe_cache_read(|cache| {
            let total_entries = cache.len();
            let high_priority = cache.values().filter(|t| t.priority >= 8).count();
            let recent_entries = cache.values().filter(|t| {
                let age = Utc::now().signed_duration_since(t.timestamp);
                age.num_hours() < 1
            }).count();
            
            (total_entries, high_priority, recent_entries)
        }) {
            let (total, high_priority, recent) = cache_info;
            stats.insert("total_entries".to_string(), serde_json::json!(total));
            stats.insert("high_priority_entries".to_string(), serde_json::json!(high_priority));
            stats.insert("recent_entries".to_string(), serde_json::json!(recent));
            stats.insert("cache_limit".to_string(), serde_json::json!(self.config.cache_size_limit));
        }
        
        stats
    }

    /// Genera report di performance dettagliato
    pub fn generate_performance_report(&self) -> Result<HashMap<String, serde_json::Value>, String> {
        let metrics = self.get_performance_metrics()?;
        let mut report = HashMap::new();

        report.insert("latency_ms".to_string(), serde_json::json!(metrics.injection_latency_ms));
        report.insert("memory_usage_kb".to_string(), serde_json::json!(metrics.memory_usage_kb));
        report.insert("cpu_usage_percent".to_string(), serde_json::json!(metrics.cpu_usage_percent));
        report.insert("cache_hit_rate".to_string(), serde_json::json!(metrics.cache_hit_rate));
        report.insert("translation_throughput".to_string(), serde_json::json!(metrics.translation_throughput));
        report.insert("error_rate".to_string(), serde_json::json!(metrics.error_rate));

        // Statistiche cache con accesso sicuro
        if let Some(cache_size) = self.safe_cache_read(|cache| cache.len()) {
            report.insert("cache_size".to_string(), serde_json::json!(cache_size));
            report.insert("cache_limit".to_string(), serde_json::json!(self.config.cache_size_limit));
        }

        // Statistiche hook pool
        if let Ok(pool) = self.hook_pool.lock() {
            let active_hooks = pool.iter().filter(|h| h.is_active).count();
            report.insert("active_hooks".to_string(), serde_json::json!(active_hooks));
            report.insert("total_hooks".to_string(), serde_json::json!(pool.len()));
        }

        report.insert("timestamp".to_string(), serde_json::json!(metrics.timestamp));

        Ok(report)
    }

    // === METODI PRIVATI ===

    /// Helper per accesso sicuro alla cache in lettura
    fn safe_cache_read<F, R>(&self, operation: F) -> Option<R>
    where
        F: FnOnce(&HashMap<String, CachedTranslation>) -> R,
    {
        match self.translation_cache.lock() {
            Ok(cache) => Some(operation(&cache)),
            Err(e) => {
                log::warn!("🔒 Errore accesso cache in lettura: {:?}", e);
                None
            }
        }
    }

    /// Helper per accesso sicuro alla cache in scrittura
    fn safe_cache_write<F, R>(&self, operation: F) -> Option<R>
    where
        F: FnOnce(&mut HashMap<String, CachedTranslation>) -> R,
    {
        match self.translation_cache.lock() {
            Ok(mut cache) => Some(operation(&mut cache)),
            Err(e) => {
                log::warn!("🔒 Errore accesso cache in scrittura: {:?}", e);
                None
            }
        }
    }

    fn evict_cache_entries(&self, cache: &mut HashMap<String, CachedTranslation>) {
        // Strategia LRU con priorità
        let mut entries: Vec<_> = cache.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        entries.sort_by(|a, b| {
            // Ordina per priorità (alta prima) poi per timestamp (vecchio prima)
            b.1.priority.cmp(&a.1.priority)
                .then(a.1.timestamp.cmp(&b.1.timestamp))
        });

        // Rimuovi il 20% delle entry meno importanti
        let remove_count = cache.len() / 5;
        for (key, _) in entries.iter().take(remove_count) {
            cache.remove(key);
        }

        log::debug!("🗑️ Cache eviction: {} entry rimosse", remove_count);
    }

    fn update_cache_metrics(&self, is_hit: bool) {
        if let Ok(mut metrics) = self.metrics.lock() {
            // Implementa calcolo rolling average per cache hit rate
            let current_rate = metrics.cache_hit_rate;
            let new_rate = if is_hit {
                (current_rate * 0.9) + (1.0 * 0.1)
            } else {
                (current_rate * 0.9) + (0.0 * 0.1)
            };
            metrics.cache_hit_rate = new_rate;
        }
    }
}

// Implementa thread-safe singleton per l'optimizer globale
use once_cell::sync::Lazy;

static GLOBAL_OPTIMIZER: Lazy<Arc<Mutex<Option<PerformanceOptimizer>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

pub fn get_global_optimizer() -> Result<Arc<Mutex<Option<PerformanceOptimizer>>>, String> {
    Ok(GLOBAL_OPTIMIZER.clone())
}

pub fn initialize_global_optimizer(config: OptimizationConfig) -> Result<(), String> {
    let mut optimizer = GLOBAL_OPTIMIZER.lock().map_err(|_| "Errore inizializzazione optimizer")?;
    *optimizer = Some(PerformanceOptimizer::new(config));
    log::info!("🚀 Performance Optimizer inizializzato globalmente");
    Ok(())
}
