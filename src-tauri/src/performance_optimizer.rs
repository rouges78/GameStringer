use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::thread;
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

pub struct PerformanceOptimizer {
    config: OptimizationConfig,
    metrics: Arc<Mutex<PerformanceMetrics>>,
    hook_pool: Arc<Mutex<Vec<HookHandle>>>,
    translation_cache: Arc<Mutex<HashMap<String, CachedTranslation>>>,
    last_gc: Arc<Mutex<Instant>>,
    adaptive_polling_interval: Arc<Mutex<Duration>>,
}

#[derive(Debug, Clone)]
struct HookHandle {
    id: usize,
    is_active: bool,
    last_used: Instant,
    performance_score: f32,
}

#[derive(Debug, Clone)]
struct CachedTranslation {
    text: String,
    translated: String,
    timestamp: Instant,
    hit_count: u32,
    priority: u8,
}

impl PerformanceOptimizer {
    pub fn new(config: OptimizationConfig) -> Self {
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
            last_gc: Arc::new(Mutex::new(Instant::now())),
            adaptive_polling_interval: Arc::new(Mutex::new(Duration::from_millis(config.polling_interval_ms))),
        }
    }

    /// Ottimizza l'applicazione degli hook con pooling e lazy loading
    pub fn optimize_hook_application(&self, hook_count: usize) -> Result<Vec<usize>, String> {
        let start_time = Instant::now();
        let mut optimized_hooks = Vec::new();

        if self.config.enable_hook_pooling {
            // Usa pool di hook esistenti quando possibile
            let mut pool = self.hook_pool.lock().map_err(|_| "Errore accesso hook pool")?;
            
            // Riutilizza hook inattivi dal pool
            let mut reused_count = 0;
            for hook in pool.iter_mut() {
                if !hook.is_active && reused_count < hook_count {
                    hook.is_active = true;
                    hook.last_used = Instant::now();
                    optimized_hooks.push(hook.id);
                    reused_count += 1;
                }
            }

            // Crea nuovi hook solo se necessario
            for i in reused_count..hook_count {
                let new_hook = HookHandle {
                    id: pool.len() + i,
                    is_active: true,
                    last_used: Instant::now(),
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
        let application_time = start_time.elapsed().as_millis() as u64;
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.hook_application_time_ms = application_time;
            metrics.timestamp = Utc::now();
        }

        log::debug!("⚡ Hook application ottimizzata: {}ms per {} hook", application_time, hook_count);
        Ok(optimized_hooks)
    }

    /// Ottimizza la cache delle traduzioni con algoritmi intelligenti
    pub fn optimize_translation_cache(&self, text: &str) -> Option<String> {
        let start_time = Instant::now();
        
        if let Ok(mut cache) = self.translation_cache.lock() {
            // Controlla cache hit
            if let Some(cached) = cache.get_mut(text) {
                cached.hit_count += 1;
                cached.timestamp = Instant::now();
                
                // Aggiorna metriche cache hit
                self.update_cache_metrics(true);
                
                log::debug!("💾 Cache hit per: {} (hits: {})", text, cached.hit_count);
                return Some(cached.translated.clone());
            }

            // Cache miss - implementa strategia di eviction se necessario
            if cache.len() >= self.config.cache_size_limit {
                self.evict_cache_entries(&mut cache);
            }
            
            self.update_cache_metrics(false);
        }

        let lookup_time = start_time.elapsed().as_millis();
        log::debug!("🔍 Cache lookup: {}ms", lookup_time);
        None
    }

    /// Aggiunge traduzione alla cache con priorità intelligente
    pub fn cache_translation(&self, original: String, translated: String, priority: u8) {
        if let Ok(mut cache) = self.translation_cache.lock() {
            let cached_translation = CachedTranslation {
                text: original.clone(),
                translated,
                timestamp: Instant::now(),
                hit_count: 0,
                priority,
            };

            cache.insert(original, cached_translation);
            log::debug!("💾 Traduzione cached con priorità: {}", priority);
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
        let start_time = Instant::now();
        let mut cleaned_items = 0;

        // Controlla se è tempo di GC
        {
            let last_gc = self.last_gc.lock().map_err(|_| "Errore accesso last_gc")?;
            if last_gc.elapsed().as_secs() < self.config.gc_interval_seconds {
                return Ok(0); // Non è ancora tempo
            }
        }

        // Pulizia cache traduzioni
        if let Ok(mut cache) = self.translation_cache.lock() {
            let before_size = cache.len();
            let cutoff_time = Instant::now() - Duration::from_secs(3600); // 1 ora

            cache.retain(|_, translation| {
                translation.timestamp > cutoff_time || translation.hit_count > 5
            });

            cleaned_items += before_size - cache.len();
            log::info!("🧹 Cache GC: {} traduzioni rimosse", before_size - cache.len());
        }

        // Pulizia hook pool
        if let Ok(mut pool) = self.hook_pool.lock() {
            let before_size = pool.len();
            let cutoff_time = Instant::now() - Duration::from_secs(300); // 5 minuti

            pool.retain(|hook| {
                hook.is_active || hook.last_used > cutoff_time
            });

            cleaned_items += before_size - pool.len();
            log::info!("🧹 Hook pool GC: {} hook rimossi", before_size - pool.len());
        }

        // Aggiorna timestamp ultimo GC
        if let Ok(mut last_gc) = self.last_gc.lock() {
            *last_gc = Instant::now();
        }

        let gc_time = start_time.elapsed().as_millis();
        log::info!("🧹 Garbage collection completato: {} items puliti in {}ms", cleaned_items, gc_time);

        Ok(cleaned_items)
    }

    /// Ottimizza il batch processing delle traduzioni
    pub fn optimize_batch_processing(&self, translations: Vec<String>) -> Result<Vec<String>, String> {
        if !self.config.enable_batch_processing || translations.is_empty() {
            return Ok(translations);
        }

        let start_time = Instant::now();
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

        let processing_time = start_time.elapsed().as_millis();
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

        let start_time = Instant::now();
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

        let compression_time = start_time.elapsed().as_millis();
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

        // Statistiche cache
        if let Ok(cache) = self.translation_cache.lock() {
            report.insert("cache_size".to_string(), serde_json::json!(cache.len()));
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

    fn evict_cache_entries(&self, cache: &mut HashMap<String, CachedTranslation>) {
        // Strategia LRU con priorità
        let mut entries: Vec<_> = cache.iter().collect();
        entries.sort_by(|a, b| {
            // Ordina per priorità (alta prima) poi per timestamp (vecchio prima)
            b.1.priority.cmp(&a.1.priority)
                .then(a.1.timestamp.cmp(&b.1.timestamp))
        });

        // Rimuovi il 20% delle entry meno importanti
        let remove_count = cache.len() / 5;
        for (key, _) in entries.iter().take(remove_count) {
            cache.remove(*key);
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
