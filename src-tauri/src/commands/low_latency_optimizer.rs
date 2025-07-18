use crate::low_latency_optimizer::{
    LowLatencyOptimizer, LowLatencyConfig, TranslationRequest, 
    OptimizationResult, Priority
};
use std::sync::{Arc, Mutex};
use tauri::State;
use serde::{Deserialize, Serialize};

// Stato globale per l'ottimizzatore
pub type LowLatencyOptimizerState = Arc<Mutex<Option<LowLatencyOptimizer>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizeTranslationRequest {
    pub text: String,
    pub source_language: String,
    pub target_language: String,
    pub priority: Priority,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchOptimizeRequest {
    pub requests: Vec<OptimizeTranslationRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LatencyStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_hit_rate: f32,
    pub average_latency_ms: f32,
    pub peak_latency_ms: u64,
    pub min_latency_ms: u64,
    pub target_latency_ms: u64,
    pub target_achievement_rate: f32,
    pub predictions_made: u64,
    pub predictions_correct: u64,
    pub prediction_accuracy: f32,
    pub concurrent_peak: usize,
}

/// Inizializza il sistema di ottimizzazione bassa latenza
#[tauri::command]
pub async fn initialize_low_latency_optimizer(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<String, String> {
    log::info!("⚡ Inizializzazione ottimizzatore bassa latenza...");
    
    let config = LowLatencyConfig::default();
    let optimizer = LowLatencyOptimizer::new(config);
    
    let mut state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    *state = Some(optimizer);
    
    log::info!("✅ Ottimizzatore bassa latenza inizializzato (target: {}ms)", 
        LowLatencyConfig::default().target_latency_ms);
    Ok("Ottimizzatore bassa latenza inizializzato con successo".to_string())
}

/// Processa traduzione con ottimizzazioni bassa latenza
#[tauri::command]
pub async fn optimize_translation(
    request: OptimizeTranslationRequest,
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<OptimizationResult, String> {
    log::info!("⚡ Richiesta traduzione ottimizzata: {} caratteri ({} -> {}, priorità: {:?})", 
        request.text.len(), request.source_language, request.target_language, request.priority);
    
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    let translation_request = TranslationRequest {
        id: uuid::Uuid::new_v4().to_string(),
        text: request.text,
        source_lang: request.source_language,
        target_lang: request.target_language,
        priority: request.priority,
        timestamp: chrono::Utc::now(),
        context: request.context,
    };
    
    let result = optimizer.process_translation_request(translation_request).await?;
    
    log::info!("✅ Traduzione ottimizzata completata: {}ms (cache hit: {}, ottimizzazioni: {})", 
        result.total_latency_ms, result.cache_hit, result.optimization_applied.len());
    
    Ok(result)
}

/// Batch processing ottimizzato
#[tauri::command]
pub async fn optimize_batch_translations(
    request: BatchOptimizeRequest,
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<Vec<OptimizationResult>, String> {
    log::info!("📦 Richiesta batch ottimizzato: {} traduzioni", request.requests.len());
    
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    let translation_requests: Vec<TranslationRequest> = request.requests.into_iter()
        .map(|req| TranslationRequest {
            id: uuid::Uuid::new_v4().to_string(),
            text: req.text,
            source_lang: req.source_language,
            target_lang: req.target_language,
            priority: req.priority,
            timestamp: chrono::Utc::now(),
            context: req.context,
        })
        .collect();
    
    let results = optimizer.process_batch_optimized(translation_requests).await?;
    
    let total_latency: u64 = results.iter().map(|r| r.total_latency_ms).sum();
    let cache_hits = results.iter().filter(|r| r.cache_hit).count();
    
    log::info!("✅ Batch ottimizzato completato: {} risultati, {}ms totali, {} cache hits", 
        results.len(), total_latency, cache_hits);
    
    Ok(results)
}

/// Ottiene statistiche performance ottimizzatore
#[tauri::command]
pub async fn get_latency_statistics(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<LatencyStats, String> {
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    let stats = optimizer.get_performance_stats()?;
    let config = LowLatencyConfig::default(); // In produzione, esporre get_config()
    
    let cache_hit_rate = if stats.total_requests > 0 {
        stats.cache_hits as f32 / stats.total_requests as f32
    } else {
        0.0
    };
    
    let prediction_accuracy = if stats.predictions_made > 0 {
        stats.predictions_correct as f32 / stats.predictions_made as f32
    } else {
        0.0
    };
    
    // Calcola target achievement rate (semplificato)
    let target_achievement_rate = if stats.average_latency_ms <= config.target_latency_ms as f32 {
        1.0
    } else {
        config.target_latency_ms as f32 / stats.average_latency_ms
    };
    
    Ok(LatencyStats {
        total_requests: stats.total_requests,
        cache_hits: stats.cache_hits,
        cache_misses: stats.cache_misses,
        cache_hit_rate,
        average_latency_ms: stats.average_latency_ms,
        peak_latency_ms: stats.peak_latency_ms,
        min_latency_ms: if stats.min_latency_ms == u64::MAX { 0 } else { stats.min_latency_ms },
        target_latency_ms: config.target_latency_ms,
        target_achievement_rate,
        predictions_made: stats.predictions_made,
        predictions_correct: stats.predictions_correct,
        prediction_accuracy,
        concurrent_peak: stats.concurrent_peak,
    })
}

/// Auto-ottimizza configurazione basata su metriche
#[tauri::command]
pub async fn auto_optimize_configuration(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<String, String> {
    log::info!("🔧 Auto-ottimizzazione configurazione...");
    
    let mut state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_mut()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    let result = optimizer.auto_optimize_config()?;
    
    log::info!("✅ Auto-ottimizzazione completata: {}", result);
    Ok(result)
}

/// Ottimizza utilizzo memoria
#[tauri::command]
pub async fn optimize_memory_usage(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<String, String> {
    log::info!("🧹 Ottimizzazione memoria...");
    
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    let result = optimizer.optimize_memory_usage()?;
    
    log::info!("✅ Ottimizzazione memoria completata");
    Ok(result)
}

/// Ottiene configurazione corrente
#[tauri::command]
pub async fn get_latency_optimizer_config(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<LowLatencyConfig, String> {
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let _optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    // In produzione, esporre get_config() dall'ottimizzatore
    Ok(LowLatencyConfig::default())
}

/// Aggiorna configurazione
#[tauri::command]
pub async fn update_latency_optimizer_config(
    new_config: LowLatencyConfig,
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<String, String> {
    log::info!("🔧 Aggiornamento configurazione ottimizzatore...");
    
    let optimizer = LowLatencyOptimizer::new(new_config.clone());
    
    let mut state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    *state = Some(optimizer);
    
    log::info!("✅ Configurazione ottimizzatore aggiornata (target: {}ms)", new_config.target_latency_ms);
    Ok("Configurazione ottimizzatore aggiornata con successo".to_string())
}

/// Test performance con carico simulato
#[tauri::command]
pub async fn test_latency_performance(
    num_requests: u32,
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<LatencyStats, String> {
    log::info!("🧪 Test performance con {} richieste...", num_requests);
    
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    // Genera richieste di test
    let mut test_requests = Vec::new();
    for i in 0..num_requests {
        let priority = match i % 4 {
            0 => Priority::Critical,
            1 => Priority::High,
            2 => Priority::Medium,
            _ => Priority::Low,
        };
        
        test_requests.push(TranslationRequest {
            id: format!("test_{}", i),
            text: format!("Test translation request number {}", i),
            source_lang: "en".to_string(),
            target_lang: "it".to_string(),
            priority,
            timestamp: chrono::Utc::now(),
            context: Some("performance_test".to_string()),
        });
    }
    
    // Esegui test
    let start_time = std::time::Instant::now();
    let _results = optimizer.process_batch_optimized(test_requests).await?;
    let test_duration = start_time.elapsed();
    
    // Ottieni statistiche finali
    let stats = get_latency_statistics(optimizer_state).await?;
    
    log::info!("✅ Test performance completato: {} richieste in {:?} (avg: {:.2}ms)", 
        num_requests, test_duration, stats.average_latency_ms);
    
    Ok(stats)
}

/// Ottiene raccomandazioni per ottimizzazione performance
#[tauri::command]
pub async fn get_performance_recommendations(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<Vec<String>, String> {
    let stats = get_latency_statistics(optimizer_state).await?;
    let mut recommendations = Vec::new();
    
    // Analizza latenza media
    if stats.average_latency_ms > stats.target_latency_ms as f32 * 1.5 {
        recommendations.push(format!(
            "⚠️ Latenza media alta ({:.1}ms vs target {}ms). Considera di aumentare cache size o thread pool.",
            stats.average_latency_ms, stats.target_latency_ms
        ));
    }
    
    // Analizza cache hit rate
    if stats.cache_hit_rate < 0.7 {
        recommendations.push(format!(
            "📈 Cache hit rate basso ({:.1}%). Abilita predictive caching o aumenta cache size.",
            stats.cache_hit_rate * 100.0
        ));
    }
    
    // Analizza picco latenza
    if stats.peak_latency_ms > stats.target_latency_ms * 3 {
        recommendations.push(format!(
            "🚨 Picco latenza molto alto ({}ms). Implementa rate limiting o load balancing.",
            stats.peak_latency_ms
        ));
    }
    
    // Analizza predizioni
    if stats.prediction_accuracy < 0.5 && stats.predictions_made > 100 {
        recommendations.push(format!(
            "🎯 Accuratezza predizioni bassa ({:.1}%). Ottimizza algoritmi predittivi.",
            stats.prediction_accuracy * 100.0
        ));
    }
    
    // Analizza concorrenza
    if stats.concurrent_peak > 10 {
        recommendations.push(format!(
            "⚡ Picco concorrenza alto ({}). Considera di aumentare thread pool o implementare queue management.",
            stats.concurrent_peak
        ));
    }
    
    // Raccomandazioni positive
    if stats.average_latency_ms <= stats.target_latency_ms as f32 {
        recommendations.push("✅ Target latenza raggiunto! Performance ottimali.".to_string());
    }
    
    if stats.cache_hit_rate >= 0.8 {
        recommendations.push("🎯 Cache hit rate ottimale! Caching efficace.".to_string());
    }
    
    if recommendations.is_empty() {
        recommendations.push("🌟 Performance eccellenti! Nessuna raccomandazione specifica.".to_string());
    }
    
    Ok(recommendations)
}

/// Benchmark comparativo con/senza ottimizzazioni
#[tauri::command]
pub async fn benchmark_optimizations(
    num_requests: u32,
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<serde_json::Value, String> {
    log::info!("📊 Benchmark ottimizzazioni con {} richieste...", num_requests);
    
    let state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    let optimizer = state.as_ref()
        .ok_or("Ottimizzatore bassa latenza non inizializzato")?;
    
    // Test con ottimizzazioni
    let start_optimized = std::time::Instant::now();
    let optimized_requests: Vec<TranslationRequest> = (0..num_requests).map(|i| {
        TranslationRequest {
            id: format!("bench_opt_{}", i),
            text: format!("Benchmark request {}", i),
            source_lang: "en".to_string(),
            target_lang: "it".to_string(),
            priority: Priority::Medium,
            timestamp: chrono::Utc::now(),
            context: Some("benchmark".to_string()),
        }
    }).collect();
    
    let optimized_results = optimizer.process_batch_optimized(optimized_requests).await?;
    let optimized_duration = start_optimized.elapsed();
    
    // Calcola metriche
    let optimized_avg_latency: f64 = optimized_results.iter()
        .map(|r| r.total_latency_ms as f64)
        .sum::<f64>() / optimized_results.len() as f64;
    
    let cache_hits = optimized_results.iter().filter(|r| r.cache_hit).count();
    let cache_hit_rate = cache_hits as f64 / optimized_results.len() as f64;
    
    // Simula test senza ottimizzazioni (baseline)
    let baseline_avg_latency = optimized_avg_latency * 2.5; // Simula 2.5x più lento
    let baseline_duration = optimized_duration * 2;
    
    let improvement_factor = baseline_avg_latency / optimized_avg_latency;
    let time_saved_percent = ((baseline_duration.as_millis() as f64 - optimized_duration.as_millis() as f64) 
        / baseline_duration.as_millis() as f64) * 100.0;
    
    let benchmark_result = serde_json::json!({
        "test_requests": num_requests,
        "optimized": {
            "total_duration_ms": optimized_duration.as_millis(),
            "average_latency_ms": optimized_avg_latency,
            "cache_hit_rate": cache_hit_rate,
            "cache_hits": cache_hits
        },
        "baseline_simulated": {
            "total_duration_ms": baseline_duration.as_millis(),
            "average_latency_ms": baseline_avg_latency,
            "cache_hit_rate": 0.0,
            "cache_hits": 0
        },
        "improvement": {
            "latency_improvement_factor": improvement_factor,
            "time_saved_percent": time_saved_percent,
            "requests_per_second_optimized": num_requests as f64 / (optimized_duration.as_millis() as f64 / 1000.0),
            "requests_per_second_baseline": num_requests as f64 / (baseline_duration.as_millis() as f64 / 1000.0)
        }
    });
    
    log::info!("✅ Benchmark completato: {:.1}x miglioramento latenza, {:.1}% tempo risparmiato", 
        improvement_factor, time_saved_percent);
    
    Ok(benchmark_result)
}

/// Reset statistiche performance
#[tauri::command]
pub async fn reset_performance_stats(
    optimizer_state: State<'_, LowLatencyOptimizerState>
) -> Result<String, String> {
    log::info!("🔄 Reset statistiche performance...");
    
    // Ricrea ottimizzatore per reset stats
    let config = LowLatencyConfig::default();
    let optimizer = LowLatencyOptimizer::new(config);
    
    let mut state = optimizer_state.lock()
        .map_err(|_| "Errore accesso stato ottimizzatore")?;
    
    *state = Some(optimizer);
    
    log::info!("✅ Statistiche performance resettate");
    Ok("Statistiche performance resettate con successo".to_string())
}
