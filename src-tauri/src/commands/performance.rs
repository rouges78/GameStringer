use crate::performance_optimizer::{PerformanceOptimizer, OptimizationConfig, PerformanceMetrics};
use serde_json;
use std::sync::{Arc, Mutex};

// === STATO PERFORMANCE OPTIMIZER ===

#[derive(Default)]
pub struct PerformanceOptimizerState {
    pub optimizer: Arc<Mutex<Option<PerformanceOptimizer>>>,
    pub last_metrics: Arc<Mutex<Option<PerformanceMetrics>>>,
}

impl PerformanceOptimizerState {
    pub fn new() -> Self {
        Self {
            optimizer: Arc::new(Mutex::new(Some(PerformanceOptimizer::new(OptimizationConfig::default())))),
            last_metrics: Arc::new(Mutex::new(None)),
        }
    }
}

// === COMANDI PERFORMANCE OPTIMIZATION ===

#[tauri::command]
pub async fn get_performance_metrics() -> Result<serde_json::Value, String> {
    log::info!("📊 Recupero metriche performance injection");
    
    // Crea optimizer temporaneo per demo (in produzione useremmo l'istanza globale)
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    
    match optimizer.get_performance_metrics() {
        Ok(metrics) => {
            let result = serde_json::json!({
                "injection_latency_ms": metrics.injection_latency_ms,
                "memory_usage_kb": metrics.memory_usage_kb,
                "cpu_usage_percent": metrics.cpu_usage_percent,
                "hook_application_time_ms": metrics.hook_application_time_ms,
                "translation_throughput": metrics.translation_throughput,
                "cache_hit_rate": metrics.cache_hit_rate,
                "error_rate": metrics.error_rate,
                "recovery_time_ms": metrics.recovery_time_ms,
                "timestamp": metrics.timestamp
            });
            
            log::info!("✅ Metriche performance recuperate");
            Ok(result)
        },
        Err(e) => {
            log::error!("❌ Errore recupero metriche: {}", e);
            Err(format!("Errore recupero metriche: {}", e))
        }
    }
}

#[tauri::command]
pub async fn generate_performance_report() -> Result<serde_json::Value, String> {
    log::info!("📋 Generazione report performance dettagliato");
    
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    
    match optimizer.generate_performance_report() {
        Ok(report) => {
            let result = serde_json::json!({
                "report": report,
                "generated_at": chrono::Utc::now().to_rfc3339(),
                "report_type": "performance_analysis"
            });
            
            log::info!("✅ Report performance generato con successo");
            Ok(result)
        },
        Err(e) => {
            log::error!("❌ Errore generazione report: {}", e);
            Err(format!("Errore generazione report: {}", e))
        }
    }
}

#[tauri::command]
pub async fn optimize_hook_application(hook_count: usize) -> Result<serde_json::Value, String> {
    log::info!("⚡ Ottimizzazione applicazione {} hook", hook_count);
    
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    
    match optimizer.optimize_hook_application(hook_count) {
        Ok(optimized_hooks) => {
            let result = serde_json::json!({
                "optimized_hooks": optimized_hooks,
                "hook_count": optimized_hooks.len(),
                "optimization_successful": true,
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            log::info!("✅ Hook ottimizzati: {} hook preparati", optimized_hooks.len());
            Ok(result)
        },
        Err(e) => {
            log::error!("❌ Errore ottimizzazione hook: {}", e);
            Err(format!("Errore ottimizzazione hook: {}", e))
        }
    }
}

#[tauri::command]
pub async fn optimize_translation_batch(texts: Vec<String>) -> Result<serde_json::Value, String> {
    log::info!("📦 Ottimizzazione batch {} traduzioni", texts.len());
    
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    
    match optimizer.optimize_batch_processing(texts) {
        Ok(optimized_batch) => {
            let result = serde_json::json!({
                "optimized_batch": optimized_batch,
                "original_count": optimized_batch.len(),
                "optimization_successful": true,
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            log::info!("✅ Batch ottimizzato: {} traduzioni processate", optimized_batch.len());
            Ok(result)
        },
        Err(e) => {
            log::error!("❌ Errore ottimizzazione batch: {}", e);
            Err(format!("Errore ottimizzazione batch: {}", e))
        }
    }
}

#[tauri::command]
pub async fn perform_garbage_collection() -> Result<serde_json::Value, String> {
    log::info!("🧹 Esecuzione garbage collection");
    
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    
    match optimizer.perform_garbage_collection() {
        Ok(cleaned_items) => {
            let result = serde_json::json!({
                "cleaned_items": cleaned_items,
                "gc_successful": true,
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            log::info!("✅ Garbage collection completato: {} items puliti", cleaned_items);
            Ok(result)
        },
        Err(e) => {
            log::error!("❌ Errore garbage collection: {}", e);
            Err(format!("Errore garbage collection: {}", e))
        }
    }
}

#[tauri::command]
pub async fn optimize_memory_usage() -> Result<serde_json::Value, String> {
    log::info!("🗜️ Ottimizzazione uso memoria");
    
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    
    match optimizer.optimize_memory_usage() {
        Ok(memory_saved) => {
            let result = serde_json::json!({
                "memory_saved_kb": memory_saved,
                "optimization_successful": true,
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            log::info!("✅ Memoria ottimizzata: {}KB salvati", memory_saved);
            Ok(result)
        },
        Err(e) => {
            log::error!("❌ Errore ottimizzazione memoria: {}", e);
            Err(format!("Errore ottimizzazione memoria: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_optimization_config() -> Result<serde_json::Value, String> {
    log::info!("⚙️ Recupero configurazione ottimizzazioni");
    
    let config = OptimizationConfig::default();
    
    let result = serde_json::json!({
        "enable_lazy_loading": config.enable_lazy_loading,
        "enable_hook_pooling": config.enable_hook_pooling,
        "enable_memory_compression": config.enable_memory_compression,
        "enable_adaptive_polling": config.enable_adaptive_polling,
        "enable_batch_processing": config.enable_batch_processing,
        "max_concurrent_hooks": config.max_concurrent_hooks,
        "polling_interval_ms": config.polling_interval_ms,
        "cache_size_limit": config.cache_size_limit,
        "gc_interval_seconds": config.gc_interval_seconds,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Configurazione ottimizzazioni recuperata");
    Ok(result)
}

#[tauri::command]
pub async fn update_optimization_config(
    enable_lazy_loading: Option<bool>,
    enable_hook_pooling: Option<bool>,
    enable_memory_compression: Option<bool>,
    enable_adaptive_polling: Option<bool>,
    enable_batch_processing: Option<bool>,
    max_concurrent_hooks: Option<usize>,
    polling_interval_ms: Option<u64>,
    cache_size_limit: Option<usize>,
    gc_interval_seconds: Option<u64>
) -> Result<serde_json::Value, String> {
    log::info!("🔧 Aggiornamento configurazione ottimizzazioni");
    
    let mut config = OptimizationConfig::default();
    
    // Aggiorna solo i campi forniti
    if let Some(val) = enable_lazy_loading { config.enable_lazy_loading = val; }
    if let Some(val) = enable_hook_pooling { config.enable_hook_pooling = val; }
    if let Some(val) = enable_memory_compression { config.enable_memory_compression = val; }
    if let Some(val) = enable_adaptive_polling { config.enable_adaptive_polling = val; }
    if let Some(val) = enable_batch_processing { config.enable_batch_processing = val; }
    if let Some(val) = max_concurrent_hooks { config.max_concurrent_hooks = val; }
    if let Some(val) = polling_interval_ms { config.polling_interval_ms = val; }
    if let Some(val) = cache_size_limit { config.cache_size_limit = val; }
    if let Some(val) = gc_interval_seconds { config.gc_interval_seconds = val; }
    
    let result = serde_json::json!({
        "updated_config": {
            "enable_lazy_loading": config.enable_lazy_loading,
            "enable_hook_pooling": config.enable_hook_pooling,
            "enable_memory_compression": config.enable_memory_compression,
            "enable_adaptive_polling": config.enable_adaptive_polling,
            "enable_batch_processing": config.enable_batch_processing,
            "max_concurrent_hooks": config.max_concurrent_hooks,
            "polling_interval_ms": config.polling_interval_ms,
            "cache_size_limit": config.cache_size_limit,
            "gc_interval_seconds": config.gc_interval_seconds
        },
        "update_successful": true,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Configurazione ottimizzazioni aggiornata");
    Ok(result)
}

#[tauri::command]
pub async fn test_performance_optimization() -> Result<serde_json::Value, String> {
    log::info!("🧪 Test sistema ottimizzazione performance");
    
    let optimizer = PerformanceOptimizer::new(OptimizationConfig::default());
    let mut test_results = Vec::new();
    
    // Test 1: Hook optimization
    match optimizer.optimize_hook_application(4) {
        Ok(hooks) => {
            test_results.push(serde_json::json!({
                "test": "hook_optimization",
                "success": true,
                "result": format!("{} hook ottimizzati", hooks.len())
            }));
        },
        Err(e) => {
            test_results.push(serde_json::json!({
                "test": "hook_optimization",
                "success": false,
                "error": e
            }));
        }
    }
    
    // Test 2: Batch processing
    let test_texts = vec!["Hello".to_string(), "World".to_string(), "Test".to_string()];
    match optimizer.optimize_batch_processing(test_texts) {
        Ok(batch) => {
            test_results.push(serde_json::json!({
                "test": "batch_processing",
                "success": true,
                "result": format!("{} testi processati", batch.len())
            }));
        },
        Err(e) => {
            test_results.push(serde_json::json!({
                "test": "batch_processing",
                "success": false,
                "error": e
            }));
        }
    }
    
    // Test 3: Memory optimization
    match optimizer.optimize_memory_usage() {
        Ok(saved) => {
            test_results.push(serde_json::json!({
                "test": "memory_optimization",
                "success": true,
                "result": format!("{}KB salvati", saved)
            }));
        },
        Err(e) => {
            test_results.push(serde_json::json!({
                "test": "memory_optimization",
                "success": false,
                "error": e
            }));
        }
    }
    
    // Test 4: Garbage collection
    match optimizer.perform_garbage_collection() {
        Ok(cleaned) => {
            test_results.push(serde_json::json!({
                "test": "garbage_collection",
                "success": true,
                "result": format!("{} items puliti", cleaned)
            }));
        },
        Err(e) => {
            test_results.push(serde_json::json!({
                "test": "garbage_collection",
                "success": false,
                "error": e
            }));
        }
    }
    
    let successful_tests = test_results.iter().filter(|t| t["success"].as_bool().unwrap_or(false)).count();
    
    let result = serde_json::json!({
        "test_results": test_results,
        "total_tests": test_results.len(),
        "successful_tests": successful_tests,
        "success_rate": (successful_tests as f32 / test_results.len() as f32) * 100.0,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Test performance completato: {}/{} test passati", successful_tests, test_results.len());
    Ok(result)
}
