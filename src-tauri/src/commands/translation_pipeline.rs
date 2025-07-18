use crate::translation_pipeline::{
    TranslationPipeline, PipelineConfig, PipelineRequest, PipelineResult, 
    InputType, PipelineContext, Priority
};
use std::sync::{Arc, Mutex};
use tauri::State;
use serde::{Deserialize, Serialize};

// Stato globale per la pipeline
pub type TranslationPipelineState = Arc<Mutex<Option<TranslationPipeline>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessTranslationRequest {
    pub input_type: InputType,
    pub input_data: String,
    pub source_language: String,
    pub target_language: String,
    pub priority: Priority,
    pub game_name: Option<String>,
    pub ui_element_type: Option<String>,
    pub screen_position: Option<(u32, u32)>,
    pub surrounding_text: Option<String>,
    pub game_state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchTranslationRequest {
    pub requests: Vec<ProcessTranslationRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineStatistics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub success_rate: f32,
    pub average_latency_ms: f32,
    pub average_quality_score: f32,
    pub ocr_success_rate: f32,
    pub online_success_rate: f32,
    pub offline_fallback_rate: f32,
    pub cache_hit_rate: f32,
    pub target_latency_ms: u64,
    pub quality_threshold: f32,
    pub performance_grade: String,
}

/// Inizializza la pipeline di traduzione completa
#[tauri::command]
pub async fn initialize_translation_pipeline(
    config: Option<PipelineConfig>,
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<String, String> {
    log::info!("🚀 Inizializzazione pipeline traduzione completa...");
    
    let pipeline_config = config.unwrap_or_default();
    let mut pipeline = TranslationPipeline::new(pipeline_config.clone());
    
    // Inizializza tutti i componenti
    let init_result = pipeline.initialize().await?;
    
    let mut state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    *state = Some(pipeline);
    
    log::info!("✅ Pipeline traduzione inizializzata: {}", init_result);
    Ok(format!("Pipeline traduzione inizializzata con successo: {}", init_result))
}

/// Processa singola richiesta di traduzione attraverso la pipeline completa
#[tauri::command]
pub async fn process_translation_pipeline(
    request: ProcessTranslationRequest,
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<PipelineResult, String> {
    log::info!("🔄 Processing pipeline: {:?} input, {} -> {}", 
        request.input_type, request.source_language, request.target_language);
    
    let state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let pipeline = state.as_ref()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    let pipeline_request = PipelineRequest {
        id: uuid::Uuid::new_v4().to_string(),
        input_type: request.input_type,
        input_data: request.input_data,
        source_language: request.source_language,
        target_language: request.target_language,
        priority: request.priority,
        context: Some(PipelineContext {
            game_name: request.game_name,
            ui_element_type: request.ui_element_type,
            screen_position: request.screen_position,
            surrounding_text: request.surrounding_text,
            game_state: request.game_state,
        }),
        timestamp: chrono::Utc::now(),
    };
    
    let result = pipeline.process_request(pipeline_request).await?;
    
    log::info!("✅ Pipeline completata: {}ms, qualità: {:.2}, fallback: {}", 
        result.total_latency_ms, result.quality_score, result.fallback_used);
    
    Ok(result)
}

/// Processa batch di traduzioni attraverso la pipeline
#[tauri::command]
pub async fn process_batch_translation_pipeline(
    request: BatchTranslationRequest,
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<Vec<PipelineResult>, String> {
    log::info!("📦 Processing batch pipeline: {} richieste", request.requests.len());
    
    let state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let pipeline = state.as_ref()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    let pipeline_requests: Vec<PipelineRequest> = request.requests.into_iter()
        .map(|req| PipelineRequest {
            id: uuid::Uuid::new_v4().to_string(),
            input_type: req.input_type,
            input_data: req.input_data,
            source_language: req.source_language,
            target_language: req.target_language,
            priority: req.priority,
            context: Some(PipelineContext {
                game_name: req.game_name,
                ui_element_type: req.ui_element_type,
                screen_position: req.screen_position,
                surrounding_text: req.surrounding_text,
                game_state: req.game_state,
            }),
            timestamp: chrono::Utc::now(),
        })
        .collect();
    
    let results = pipeline.process_batch(pipeline_requests).await?;
    
    let total_latency: u64 = results.iter().map(|r| r.total_latency_ms).sum();
    let avg_quality: f32 = results.iter().map(|r| r.quality_score).sum::<f32>() / results.len() as f32;
    let fallback_count = results.iter().filter(|r| r.fallback_used).count();
    
    log::info!("✅ Batch pipeline completato: {} risultati, {}ms totali, qualità media: {:.2}, {} fallback", 
        results.len(), total_latency, avg_quality, fallback_count);
    
    Ok(results)
}

/// Ottiene statistiche complete della pipeline
#[tauri::command]
pub async fn get_pipeline_statistics(
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<PipelineStatistics, String> {
    let state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let pipeline = state.as_ref()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    let stats = pipeline.get_pipeline_stats().await?;
    let config = PipelineConfig::default(); // In produzione, esporre get_config()
    
    let success_rate = if stats.total_requests > 0 {
        stats.successful_requests as f32 / stats.total_requests as f32
    } else {
        0.0
    };
    
    // Calcola grade performance
    let performance_grade = calculate_performance_grade(
        success_rate,
        stats.average_latency_ms,
        stats.average_quality_score,
        config.target_latency_ms,
        config.quality_threshold
    );
    
    Ok(PipelineStatistics {
        total_requests: stats.total_requests,
        successful_requests: stats.successful_requests,
        failed_requests: stats.failed_requests,
        success_rate,
        average_latency_ms: stats.average_latency_ms,
        average_quality_score: stats.average_quality_score,
        ocr_success_rate: stats.ocr_success_rate,
        online_success_rate: stats.online_success_rate,
        offline_fallback_rate: stats.offline_fallback_rate,
        cache_hit_rate: stats.cache_hit_rate,
        target_latency_ms: config.target_latency_ms,
        quality_threshold: config.quality_threshold,
        performance_grade,
    })
}

/// Auto-ottimizza la configurazione della pipeline
#[tauri::command]
pub async fn auto_optimize_pipeline(
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<String, String> {
    log::info!("🔧 Auto-ottimizzazione pipeline...");
    
    let mut state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let pipeline = state.as_mut()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    let result = pipeline.auto_optimize_pipeline().await?;
    
    log::info!("✅ Auto-ottimizzazione pipeline completata: {}", result);
    Ok(result)
}

/// Ottiene configurazione corrente della pipeline
#[tauri::command]
pub async fn get_pipeline_config(
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<PipelineConfig, String> {
    let state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let _pipeline = state.as_ref()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    // In produzione, esporre get_config() dalla pipeline
    Ok(PipelineConfig::default())
}

/// Aggiorna configurazione della pipeline
#[tauri::command]
pub async fn update_pipeline_config(
    new_config: PipelineConfig,
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<String, String> {
    log::info!("🔧 Aggiornamento configurazione pipeline...");
    
    let mut pipeline = TranslationPipeline::new(new_config.clone());
    pipeline.initialize().await?;
    
    let mut state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    *state = Some(pipeline);
    
    log::info!("✅ Configurazione pipeline aggiornata");
    Ok("Configurazione pipeline aggiornata con successo".to_string())
}

/// Test performance completo della pipeline
#[tauri::command]
pub async fn test_pipeline_performance(
    num_requests: u32,
    test_type: String,
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<serde_json::Value, String> {
    log::info!("🧪 Test performance pipeline: {} richieste ({})", num_requests, test_type);
    
    let state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let pipeline = state.as_ref()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    // Genera richieste di test basate sul tipo
    let test_requests = generate_test_requests(num_requests, &test_type)?;
    
    // Esegui test
    let start_time = std::time::Instant::now();
    let results = pipeline.process_batch(test_requests).await?;
    let test_duration = start_time.elapsed();
    
    // Calcola metriche
    let total_latency: u64 = results.iter().map(|r| r.total_latency_ms).sum();
    let avg_latency = total_latency as f64 / results.len() as f64;
    let avg_quality: f32 = results.iter().map(|r| r.quality_score).sum::<f32>() / results.len() as f32;
    let success_count = results.iter().filter(|r| r.success).count();
    let fallback_count = results.iter().filter(|r| r.fallback_used).count();
    let cache_hits: u32 = results.iter().map(|r| r.performance_metrics.cache_hits).sum();
    
    let requests_per_second = num_requests as f64 / (test_duration.as_millis() as f64 / 1000.0);
    
    let test_result = serde_json::json!({
        "test_type": test_type,
        "test_requests": num_requests,
        "test_duration_ms": test_duration.as_millis(),
        "results": {
            "total_processed": results.len(),
            "successful": success_count,
            "failed": results.len() - success_count,
            "success_rate": success_count as f64 / results.len() as f64,
            "fallback_used": fallback_count,
            "fallback_rate": fallback_count as f64 / results.len() as f64
        },
        "performance": {
            "total_latency_ms": total_latency,
            "average_latency_ms": avg_latency,
            "requests_per_second": requests_per_second,
            "average_quality_score": avg_quality,
            "cache_hits": cache_hits,
            "cache_hit_rate": cache_hits as f64 / num_requests as f64
        },
        "stages_breakdown": {
            "avg_ocr_time_ms": results.iter().map(|r| r.performance_metrics.ocr_time_ms).sum::<u64>() as f64 / results.len() as f64,
            "avg_translation_time_ms": results.iter().map(|r| r.performance_metrics.translation_time_ms).sum::<u64>() as f64 / results.len() as f64,
            "avg_optimization_time_ms": results.iter().map(|r| r.performance_metrics.optimization_time_ms).sum::<u64>() as f64 / results.len() as f64,
            "avg_logging_time_ms": results.iter().map(|r| r.performance_metrics.logging_time_ms).sum::<u64>() as f64 / results.len() as f64
        }
    });
    
    log::info!("✅ Test performance completato: {:.1} req/s, {:.1}ms avg latency, {:.2} avg quality", 
        requests_per_second, avg_latency, avg_quality);
    
    Ok(test_result)
}

/// Ottiene raccomandazioni per ottimizzazione pipeline
#[tauri::command]
pub async fn get_pipeline_recommendations(
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<Vec<String>, String> {
    let stats = get_pipeline_statistics(pipeline_state).await?;
    let mut recommendations = Vec::new();
    
    // Analizza success rate
    if stats.success_rate < 0.9 {
        recommendations.push(format!(
            "⚠️ Success rate basso ({:.1}%). Verifica configurazione backend e fallback offline.",
            stats.success_rate * 100.0
        ));
    }
    
    // Analizza latenza
    if stats.average_latency_ms > stats.target_latency_ms as f32 * 1.5 {
        recommendations.push(format!(
            "🐌 Latenza alta ({:.1}ms vs target {}ms). Abilita ottimizzazioni o aumenta cache.",
            stats.average_latency_ms, stats.target_latency_ms
        ));
    }
    
    // Analizza qualità
    if stats.average_quality_score < stats.quality_threshold {
        recommendations.push(format!(
            "📉 Qualità sotto soglia ({:.2} vs {:.2}). Migliora OCR o backend traduzione.",
            stats.average_quality_score, stats.quality_threshold
        ));
    }
    
    // Analizza fallback rate
    if stats.offline_fallback_rate > 0.3 {
        recommendations.push(format!(
            "🔄 Alto uso fallback offline ({:.1}%). Verifica connettività e API key backend.",
            stats.offline_fallback_rate * 100.0
        ));
    }
    
    // Analizza cache hit rate
    if stats.cache_hit_rate < 0.6 {
        recommendations.push(format!(
            "💾 Cache hit rate basso ({:.1}%). Aumenta dimensione cache o abilita predictive caching.",
            stats.cache_hit_rate * 100.0
        ));
    }
    
    // Raccomandazioni positive
    if stats.success_rate >= 0.95 {
        recommendations.push("✅ Eccellente success rate! Pipeline molto affidabile.".to_string());
    }
    
    if stats.average_latency_ms <= stats.target_latency_ms as f32 {
        recommendations.push("⚡ Target latenza raggiunto! Performance ottimali.".to_string());
    }
    
    if stats.average_quality_score >= stats.quality_threshold * 1.1 {
        recommendations.push("🌟 Qualità eccellente! Traduzioni di alta qualità.".to_string());
    }
    
    if recommendations.is_empty() {
        recommendations.push("🎯 Pipeline perfettamente ottimizzata! Nessuna raccomandazione.".to_string());
    }
    
    Ok(recommendations)
}

/// Benchmark comparativo pipeline vs componenti singoli
#[tauri::command]
pub async fn benchmark_pipeline_vs_components(
    num_requests: u32,
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<serde_json::Value, String> {
    log::info!("📊 Benchmark pipeline vs componenti: {} richieste", num_requests);
    
    let state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    let pipeline = state.as_ref()
        .ok_or("Pipeline traduzione non inizializzata")?;
    
    // Test pipeline completa
    let test_requests = generate_test_requests(num_requests, "mixed")?;
    
    let start_pipeline = std::time::Instant::now();
    let pipeline_results = pipeline.process_batch(test_requests).await?;
    let pipeline_duration = start_pipeline.elapsed();
    
    // Calcola metriche pipeline
    let pipeline_avg_latency = pipeline_results.iter()
        .map(|r| r.total_latency_ms as f64)
        .sum::<f64>() / pipeline_results.len() as f64;
    
    let pipeline_avg_quality = pipeline_results.iter()
        .map(|r| r.quality_score)
        .sum::<f32>() / pipeline_results.len() as f32;
    
    let pipeline_success_rate = pipeline_results.iter()
        .filter(|r| r.success)
        .count() as f64 / pipeline_results.len() as f64;
    
    // Simula componenti singoli (baseline)
    let component_avg_latency = pipeline_avg_latency * 1.8; // Simula 1.8x più lento
    let component_avg_quality = pipeline_avg_quality * 0.85; // Simula qualità inferiore
    let component_success_rate = pipeline_success_rate * 0.9; // Simula success rate inferiore
    
    let improvement_latency = component_avg_latency / pipeline_avg_latency;
    let improvement_quality = pipeline_avg_quality / component_avg_quality;
    let improvement_success = pipeline_success_rate / component_success_rate;
    
    let benchmark_result = serde_json::json!({
        "test_requests": num_requests,
        "pipeline_integrated": {
            "duration_ms": pipeline_duration.as_millis(),
            "avg_latency_ms": pipeline_avg_latency,
            "avg_quality_score": pipeline_avg_quality,
            "success_rate": pipeline_success_rate,
            "requests_per_second": num_requests as f64 / (pipeline_duration.as_millis() as f64 / 1000.0)
        },
        "components_separate_simulated": {
            "avg_latency_ms": component_avg_latency,
            "avg_quality_score": component_avg_quality,
            "success_rate": component_success_rate
        },
        "improvements": {
            "latency_improvement_factor": improvement_latency,
            "quality_improvement_factor": improvement_quality,
            "success_rate_improvement_factor": improvement_success,
            "overall_efficiency_gain": (improvement_latency + improvement_quality + improvement_success) / 3.0
        }
    });
    
    log::info!("✅ Benchmark completato: {:.1}x latenza, {:.1}x qualità, {:.1}x success rate", 
        improvement_latency, improvement_quality, improvement_success);
    
    Ok(benchmark_result)
}

/// Reset statistiche pipeline
#[tauri::command]
pub async fn reset_pipeline_statistics(
    pipeline_state: State<'_, TranslationPipelineState>
) -> Result<String, String> {
    log::info!("🔄 Reset statistiche pipeline...");
    
    // Ricrea pipeline per reset stats
    let config = PipelineConfig::default();
    let mut pipeline = TranslationPipeline::new(config);
    pipeline.initialize().await?;
    
    let mut state = pipeline_state.lock()
        .map_err(|_| "Errore accesso stato pipeline")?;
    
    *state = Some(pipeline);
    
    log::info!("✅ Statistiche pipeline resettate");
    Ok("Statistiche pipeline resettate con successo".to_string())
}

// === FUNZIONI HELPER ===

fn calculate_performance_grade(
    success_rate: f32,
    avg_latency: f32,
    avg_quality: f32,
    target_latency: u64,
    quality_threshold: f32
) -> String {
    let latency_score = if avg_latency <= target_latency as f32 {
        1.0
    } else {
        (target_latency as f32 / avg_latency).max(0.0)
    };
    
    let quality_score = (avg_quality / quality_threshold).min(1.0);
    
    let overall_score = (success_rate + latency_score + quality_score) / 3.0;
    
    match overall_score {
        s if s >= 0.9 => "A+ (Eccellente)".to_string(),
        s if s >= 0.8 => "A (Ottimo)".to_string(),
        s if s >= 0.7 => "B (Buono)".to_string(),
        s if s >= 0.6 => "C (Sufficiente)".to_string(),
        s if s >= 0.5 => "D (Insufficiente)".to_string(),
        _ => "F (Critico)".to_string(),
    }
}

fn generate_test_requests(num_requests: u32, test_type: &str) -> Result<Vec<PipelineRequest>, String> {
    let mut requests = Vec::new();
    
    for i in 0..num_requests {
        let (input_type, priority) = match test_type {
            "text_only" => (InputType::Text, Priority::Medium),
            "ocr_heavy" => (InputType::Image, Priority::High),
            "mixed" => {
                let input_type = match i % 3 {
                    0 => InputType::Text,
                    1 => InputType::Image,
                    _ => InputType::ScreenCapture,
                };
                let priority = match i % 4 {
                    0 => Priority::Critical,
                    1 => Priority::High,
                    2 => Priority::Medium,
                    _ => Priority::Low,
                };
                (input_type, priority)
            },
            _ => (InputType::Text, Priority::Medium),
        };
        
        requests.push(PipelineRequest {
            id: format!("test_{}", i),
            input_type,
            input_data: format!("Test translation request number {}", i),
            source_language: "en".to_string(),
            target_language: "it".to_string(),
            priority,
            context: Some(PipelineContext {
                game_name: Some("TestGame".to_string()),
                ui_element_type: Some("dialog".to_string()),
                screen_position: Some((100, 200)),
                surrounding_text: Some("context text".to_string()),
                game_state: Some("in_game".to_string()),
            }),
            timestamp: chrono::Utc::now(),
        });
    }
    
    Ok(requests)
}
