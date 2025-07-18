use std::sync::{Arc, Mutex};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

use crate::advanced_ocr::{AdvancedOCRManager, OCRRequest, OCRResult};
use crate::translation_backends::{TranslationBackendManager, TranslationRequest as BackendRequest};
use crate::offline_translation::{OfflineTranslationManager, OfflineTranslationRequest};
use crate::translation_logger::{TranslationLogger, TranslationEntry};
use crate::low_latency_optimizer::{LowLatencyOptimizer, TranslationRequest as OptimizerRequest, Priority};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineConfig {
    pub enabled: bool,
    pub use_ocr: bool,
    pub use_online_backends: bool,
    pub use_offline_fallback: bool,
    pub use_logging: bool,
    pub use_optimization: bool,
    pub target_latency_ms: u64,
    pub quality_threshold: f32,
    pub auto_fallback: bool,
    pub parallel_processing: bool,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            use_ocr: true,
            use_online_backends: true,
            use_offline_fallback: true,
            use_logging: true,
            use_optimization: true,
            target_latency_ms: 100,
            quality_threshold: 0.8,
            auto_fallback: true,
            parallel_processing: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineRequest {
    pub id: String,
    pub input_type: InputType,
    pub input_data: String, // Testo o percorso immagine
    pub source_language: String,
    pub target_language: String,
    pub priority: Priority,
    pub context: Option<PipelineContext>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InputType {
    Text,
    Image,
    ScreenCapture,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineContext {
    pub game_name: Option<String>,
    pub ui_element_type: Option<String>,
    pub screen_position: Option<(u32, u32)>,
    pub surrounding_text: Option<String>,
    pub game_state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineResult {
    pub request_id: String,
    pub success: bool,
    pub translated_text: String,
    pub total_latency_ms: u64,
    pub quality_score: f32,
    pub pipeline_stages: Vec<PipelineStage>,
    pub fallback_used: bool,
    pub error_message: Option<String>,
    pub performance_metrics: PipelineMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStage {
    pub stage_name: String,
    pub duration_ms: u64,
    pub success: bool,
    pub output: Option<String>,
    pub quality_score: Option<f32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineMetrics {
    pub ocr_time_ms: u64,
    pub translation_time_ms: u64,
    pub optimization_time_ms: u64,
    pub logging_time_ms: u64,
    pub total_processing_time_ms: u64,
    pub cache_hits: u32,
    pub fallbacks_used: u32,
    pub quality_improvements: u32,
}

pub struct TranslationPipeline {
    config: PipelineConfig,
    ocr_manager: Option<Arc<Mutex<AdvancedOCRManager>>>,
    backend_manager: Option<Arc<Mutex<TranslationBackendManager>>>,
    offline_manager: Option<Arc<Mutex<OfflineTranslationManager>>>,
    logger: Option<Arc<Mutex<TranslationLogger>>>,
    optimizer: Option<Arc<Mutex<LowLatencyOptimizer>>>,
    stats: Arc<Mutex<PipelineStats>>,
}

#[derive(Debug, Clone)]
struct PipelineStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_latency_ms: f32,
    pub average_quality_score: f32,
    pub ocr_success_rate: f32,
    pub online_success_rate: f32,
    pub offline_fallback_rate: f32,
    pub cache_hit_rate: f32,
}

impl TranslationPipeline {
    pub fn new(config: PipelineConfig) -> Self {
        Self {
            config,
            ocr_manager: None,
            backend_manager: None,
            offline_manager: None,
            logger: None,
            optimizer: None,
            stats: Arc::new(Mutex::new(PipelineStats {
                total_requests: 0,
                successful_requests: 0,
                failed_requests: 0,
                average_latency_ms: 0.0,
                average_quality_score: 0.0,
                ocr_success_rate: 0.0,
                online_success_rate: 0.0,
                offline_fallback_rate: 0.0,
                cache_hit_rate: 0.0,
            })),
        }
    }
    
    /// Inizializza tutti i componenti della pipeline
    pub async fn initialize(&mut self) -> Result<String, String> {
        log::info!("🚀 Inizializzazione pipeline traduzione completa...");
        
        let mut initialized_components = Vec::new();
        
        // Inizializza OCR Manager
        if self.config.use_ocr {
            let ocr_manager = AdvancedOCRManager::new(Default::default());
            self.ocr_manager = Some(Arc::new(Mutex::new(ocr_manager)));
            initialized_components.push("OCR Manager");
        }
        
        // Inizializza Backend Manager
        if self.config.use_online_backends {
            let backend_manager = TranslationBackendManager::new(Default::default());
            self.backend_manager = Some(Arc::new(Mutex::new(backend_manager)));
            initialized_components.push("Backend Manager");
        }
        
        // Inizializza Offline Manager
        if self.config.use_offline_fallback {
            let offline_manager = OfflineTranslationManager::new(Default::default());
            self.offline_manager = Some(Arc::new(Mutex::new(offline_manager)));
            initialized_components.push("Offline Manager");
        }
        
        // Inizializza Logger
        if self.config.use_logging {
            let logger = TranslationLogger::new(Default::default());
            self.logger = Some(Arc::new(Mutex::new(logger)));
            initialized_components.push("Translation Logger");
        }
        
        // Inizializza Optimizer
        if self.config.use_optimization {
            let optimizer = LowLatencyOptimizer::new(Default::default());
            self.optimizer = Some(Arc::new(Mutex::new(optimizer)));
            initialized_components.push("Low Latency Optimizer");
        }
        
        log::info!("✅ Pipeline inizializzata: {}", initialized_components.join(", "));
        Ok(format!("Pipeline inizializzata con {} componenti", initialized_components.len()))
    }
    
    /// Processa richiesta attraverso l'intera pipeline
    pub async fn process_request(&self, request: PipelineRequest) -> Result<PipelineResult, String> {
        let start_time = Instant::now();
        let mut stages = Vec::new();
        let mut metrics = PipelineMetrics {
            ocr_time_ms: 0,
            translation_time_ms: 0,
            optimization_time_ms: 0,
            logging_time_ms: 0,
            total_processing_time_ms: 0,
            cache_hits: 0,
            fallbacks_used: 0,
            quality_improvements: 0,
        };
        
        log::info!("🔄 Processing pipeline request: {} ({:?} -> {})", 
            request.id, request.input_type, request.target_language);
        
        // Stage 1: Estrazione testo (OCR se necessario)
        let extracted_text = match request.input_type {
            InputType::Text => {
                stages.push(PipelineStage {
                    stage_name: "Text Input".to_string(),
                    duration_ms: 0,
                    success: true,
                    output: Some(request.input_data.clone()),
                    quality_score: Some(1.0),
                    error: None,
                });
                request.input_data
            },
            InputType::Image | InputType::ScreenCapture => {
                let ocr_start = Instant::now();
                let text = self.extract_text_with_ocr(&request).await?;
                let ocr_duration = ocr_start.elapsed().as_millis() as u64;
                metrics.ocr_time_ms = ocr_duration;
                
                stages.push(PipelineStage {
                    stage_name: "OCR Extraction".to_string(),
                    duration_ms: ocr_duration,
                    success: true,
                    output: Some(text.clone()),
                    quality_score: Some(0.9), // Simulato
                    error: None,
                });
                text
            }
        };
        
        // Stage 2: Traduzione ottimizzata
        let translation_start = Instant::now();
        let (translated_text, translation_quality, fallback_used) = 
            self.translate_with_optimization(&request, &extracted_text).await?;
        let translation_duration = translation_start.elapsed().as_millis() as u64;
        metrics.translation_time_ms = translation_duration;
        
        if fallback_used {
            metrics.fallbacks_used += 1;
        }
        
        stages.push(PipelineStage {
            stage_name: if fallback_used { "Translation (Offline Fallback)" } else { "Translation (Online)" }.to_string(),
            duration_ms: translation_duration,
            success: true,
            output: Some(translated_text.clone()),
            quality_score: Some(translation_quality),
            error: None,
        });
        
        // Stage 3: Logging (se abilitato)
        if self.config.use_logging {
            let logging_start = Instant::now();
            self.log_translation_result(&request, &extracted_text, &translated_text, translation_quality).await?;
            let logging_duration = logging_start.elapsed().as_millis() as u64;
            metrics.logging_time_ms = logging_duration;
            
            stages.push(PipelineStage {
                stage_name: "Translation Logging".to_string(),
                duration_ms: logging_duration,
                success: true,
                output: None,
                quality_score: None,
                error: None,
            });
        }
        
        // Calcola metriche finali
        let total_latency = start_time.elapsed().as_millis() as u64;
        metrics.total_processing_time_ms = total_latency;
        
        // Aggiorna statistiche
        self.update_pipeline_stats(true, total_latency, translation_quality, fallback_used).await;
        
        // Verifica se target latenza è raggiunto
        let target_achieved = total_latency <= self.config.target_latency_ms;
        let quality_achieved = translation_quality >= self.config.quality_threshold;
        
        log::info!("✅ Pipeline completata: {}ms (target: {}ms), qualità: {:.2} (target: {:.2})", 
            total_latency, self.config.target_latency_ms, translation_quality, self.config.quality_threshold);
        
        Ok(PipelineResult {
            request_id: request.id,
            success: true,
            translated_text,
            total_latency_ms: total_latency,
            quality_score: translation_quality,
            pipeline_stages: stages,
            fallback_used,
            error_message: None,
            performance_metrics: metrics,
        })
    }
    
    /// Processa batch di richieste con ottimizzazioni
    pub async fn process_batch(&self, requests: Vec<PipelineRequest>) -> Result<Vec<PipelineResult>, String> {
        log::info!("📦 Processing batch: {} richieste", requests.len());
        
        if self.config.parallel_processing {
            // Processing parallelo (simulato)
            let mut results = Vec::new();
            for request in requests {
                let result = self.process_request(request).await?;
                results.push(result);
            }
            Ok(results)
        } else {
            // Processing sequenziale
            let mut results = Vec::new();
            for request in requests {
                let result = self.process_request(request).await?;
                results.push(result);
            }
            Ok(results)
        }
    }
    
    /// Ottiene statistiche pipeline
    pub async fn get_pipeline_stats(&self) -> Result<PipelineStats, String> {
        self.stats.lock()
            .map(|stats| stats.clone())
            .map_err(|_| "Errore accesso statistiche pipeline".to_string())
    }
    
    /// Ottimizza configurazione pipeline basata su metriche
    pub async fn auto_optimize_pipeline(&mut self) -> Result<String, String> {
        let stats = self.get_pipeline_stats().await?;
        let mut optimizations = Vec::new();
        
        // Ottimizza target latenza
        if stats.average_latency_ms > self.config.target_latency_ms as f32 * 1.2 {
            self.config.target_latency_ms = (stats.average_latency_ms * 1.1) as u64;
            optimizations.push("increased_target_latency".to_string());
        }
        
        // Ottimizza soglia qualità
        if stats.average_quality_score < self.config.quality_threshold {
            self.config.quality_threshold = (stats.average_quality_score * 0.9).max(0.5);
            optimizations.push("adjusted_quality_threshold".to_string());
        }
        
        // Abilita fallback se necessario
        if stats.online_success_rate < 0.8 && !self.config.use_offline_fallback {
            self.config.use_offline_fallback = true;
            optimizations.push("enabled_offline_fallback".to_string());
        }
        
        // Abilita processing parallelo se latenza alta
        if stats.average_latency_ms > 200.0 && !self.config.parallel_processing {
            self.config.parallel_processing = true;
            optimizations.push("enabled_parallel_processing".to_string());
        }
        
        log::info!("🔧 Pipeline auto-ottimizzata: {:?}", optimizations);
        Ok(format!("Ottimizzazioni pipeline: {}", optimizations.join(", ")))
    }
    
    // === METODI PRIVATI ===
    
    async fn extract_text_with_ocr(&self, request: &PipelineRequest) -> Result<String, String> {
        if let Some(ocr_manager) = &self.ocr_manager {
            let ocr_request = OCRRequest {
                id: format!("{}_ocr", request.id),
                image_path: request.input_data.clone(),
                language: Some(request.source_language.clone()),
                preprocessing_enabled: true,
                timestamp: request.timestamp,
            };
            
            let ocr_manager = ocr_manager.lock()
                .map_err(|_| "Errore accesso OCR manager")?;
            
            let result = ocr_manager.process_ocr_request(ocr_request).await?;
            Ok(result.extracted_text)
        } else {
            Err("OCR manager non inizializzato".to_string())
        }
    }
    
    async fn translate_with_optimization(
        &self, 
        request: &PipelineRequest, 
        text: &str
    ) -> Result<(String, f32, bool), String> {
        // Prova prima con ottimizzatore se disponibile
        if let Some(optimizer) = &self.optimizer {
            let optimizer_request = OptimizerRequest {
                id: format!("{}_opt", request.id),
                text: text.to_string(),
                source_lang: request.source_language.clone(),
                target_lang: request.target_language.clone(),
                priority: request.priority.clone(),
                timestamp: request.timestamp,
                context: request.context.as_ref().map(|c| c.game_name.clone().unwrap_or_default()),
            };
            
            let optimizer = optimizer.lock()
                .map_err(|_| "Errore accesso optimizer")?;
            
            if let Ok(result) = optimizer.process_translation_request(optimizer_request).await {
                return Ok((result.translated_text, 0.9, false)); // Qualità alta con optimizer
            }
        }
        
        // Fallback a backend online
        if let Some(backend_manager) = &self.backend_manager {
            let backend_request = BackendRequest {
                id: format!("{}_backend", request.id),
                text: text.to_string(),
                source_language: request.source_language.clone(),
                target_language: request.target_language.clone(),
                priority: match request.priority {
                    Priority::Critical => crate::translation_backends::Priority::High,
                    Priority::High => crate::translation_backends::Priority::High,
                    Priority::Medium => crate::translation_backends::Priority::Medium,
                    Priority::Low => crate::translation_backends::Priority::Low,
                },
                context: request.context.as_ref().map(|c| c.game_name.clone().unwrap_or_default()),
                timestamp: request.timestamp,
            };
            
            let backend_manager = backend_manager.lock()
                .map_err(|_| "Errore accesso backend manager")?;
            
            if let Ok(result) = backend_manager.translate_request(backend_request).await {
                return Ok((result.translated_text, result.quality_score, false));
            }
        }
        
        // Fallback finale a offline
        if self.config.use_offline_fallback {
            if let Some(offline_manager) = &self.offline_manager {
                let offline_request = OfflineTranslationRequest {
                    id: format!("{}_offline", request.id),
                    text: text.to_string(),
                    source_language: request.source_language.clone(),
                    target_language: request.target_language.clone(),
                    quality_level: crate::offline_translation::QualityLevel::Balanced,
                    timestamp: request.timestamp,
                };
                
                let offline_manager = offline_manager.lock()
                    .map_err(|_| "Errore accesso offline manager")?;
                
                if let Ok(result) = offline_manager.translate_offline(offline_request).await {
                    return Ok((result.translated_text, result.confidence_score, true));
                }
            }
        }
        
        Err("Tutti i metodi di traduzione falliti".to_string())
    }
    
    async fn log_translation_result(
        &self,
        request: &PipelineRequest,
        original_text: &str,
        translated_text: &str,
        quality_score: f32
    ) -> Result<(), String> {
        if let Some(logger) = &self.logger {
            let log_entry = TranslationEntry {
                id: format!("{}_log", request.id),
                original_text: original_text.to_string(),
                translated_text: translated_text.to_string(),
                source_language: request.source_language.clone(),
                target_language: request.target_language.clone(),
                translation_method: "pipeline".to_string(),
                quality_metrics: crate::translation_logger::QualityMetrics {
                    fluency: quality_score,
                    accuracy: quality_score,
                    context_relevance: quality_score,
                    grammar: quality_score,
                    terminology: quality_score,
                    readability: quality_score,
                },
                context: crate::translation_logger::TranslationContext {
                    game_name: request.context.as_ref().and_then(|c| c.game_name.clone()),
                    ui_element_type: request.context.as_ref().and_then(|c| c.ui_element_type.clone()),
                    screen_position: request.context.as_ref().and_then(|c| c.screen_position),
                    surrounding_text: request.context.as_ref().and_then(|c| c.surrounding_text.clone()),
                    game_state: request.context.as_ref().and_then(|c| c.game_state.clone()),
                },
                timestamp: request.timestamp,
            };
            
            let logger = logger.lock()
                .map_err(|_| "Errore accesso logger")?;
            
            logger.log_translation(log_entry).await?;
        }
        
        Ok(())
    }
    
    async fn update_pipeline_stats(
        &self,
        success: bool,
        latency_ms: u64,
        quality_score: f32,
        fallback_used: bool
    ) {
        if let Ok(mut stats) = self.stats.lock() {
            stats.total_requests += 1;
            
            if success {
                stats.successful_requests += 1;
            } else {
                stats.failed_requests += 1;
            }
            
            // Aggiorna latenza media
            let total = stats.total_requests as f32;
            stats.average_latency_ms = (stats.average_latency_ms * (total - 1.0) + latency_ms as f32) / total;
            
            // Aggiorna qualità media
            stats.average_quality_score = (stats.average_quality_score * (total - 1.0) + quality_score) / total;
            
            // Aggiorna rate fallback
            if fallback_used {
                stats.offline_fallback_rate = (stats.offline_fallback_rate * (total - 1.0) + 1.0) / total;
            } else {
                stats.online_success_rate = (stats.online_success_rate * (total - 1.0) + 1.0) / total;
            }
        }
    }
}
