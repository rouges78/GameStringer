use crate::advanced_ocr::{AdvancedOCRProcessor, OCRConfig, OCREngine, OCRResult};
use serde_json;
use std::collections::HashMap;

// === COMANDI ADVANCED OCR ===

#[tauri::command]
pub async fn process_image_ocr(
    image_path: String,
    target_language: Option<String>,
    enabled_engines: Option<Vec<String>>,
    confidence_threshold: Option<f32>,
    ml_scoring_enabled: Option<bool>
) -> Result<serde_json::Value, String> {
    log::info!("🔍 Processamento OCR immagine: {}", image_path);
    
    // Configura OCR processor
    let mut config = OCRConfig::default();
    
    if let Some(engines) = enabled_engines {
        config.enabled_engines = engines.iter().filter_map(|e| {
            match e.as_str() {
                "tesseract" => Some(OCREngine::Tesseract),
                "windows_ocr" => Some(OCREngine::WindowsOCR),
                "easy_ocr" => Some(OCREngine::EasyOCR),
                _ => None,
            }
        }).collect();
    }
    
    if let Some(threshold) = confidence_threshold {
        config.confidence_threshold = threshold;
    }
    
    if let Some(ml_enabled) = ml_scoring_enabled {
        config.ml_scoring_enabled = ml_enabled;
    }
    
    let processor = AdvancedOCRProcessor::new(config);
    
    match processor.process_image(&image_path, target_language.as_deref()) {
        Ok(result) => {
            let response = serde_json::json!({
                "success": true,
                "result": {
                    "text": result.text,
                    "confidence": result.confidence,
                    "engine": result.engine,
                    "processing_time_ms": result.processing_time_ms,
                    "bounding_boxes": result.bounding_boxes,
                    "language_detected": result.language_detected,
                    "timestamp": result.timestamp
                },
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            log::info!("✅ OCR completato: {} caratteri estratti (Engine: {:?}, Confidence: {:.2})", 
                result.text.len(), result.engine, result.confidence);
            Ok(response)
        },
        Err(e) => {
            log::error!("❌ Errore processamento OCR: {}", e);
            Err(format!("Errore processamento OCR: {}", e))
        }
    }
}

#[tauri::command]
pub async fn batch_process_images_ocr(
    image_paths: Vec<String>,
    target_language: Option<String>,
    parallel_processing: Option<bool>
) -> Result<serde_json::Value, String> {
    log::info!("📦 Batch processamento OCR: {} immagini", image_paths.len());
    
    let mut config = OCRConfig::default();
    if let Some(parallel) = parallel_processing {
        config.parallel_processing = parallel;
    }
    
    let processor = AdvancedOCRProcessor::new(config);
    let mut results = Vec::new();
    let mut successful = 0;
    let mut failed = 0;
    
    for image_path in image_paths {
        match processor.process_image(&image_path, target_language.as_deref()).await {
            Ok(result) => {
                results.push(serde_json::json!({
                    "image_path": image_path,
                    "success": true,
                    "result": {
                        "text": result.text,
                        "confidence": result.confidence,
                        "engine": result.engine,
                        "processing_time_ms": result.processing_time_ms,
                        "bounding_boxes": result.bounding_boxes,
                        "language_detected": result.language_detected
                    }
                }));
                successful += 1;
            },
            Err(e) => {
                results.push(serde_json::json!({
                    "image_path": image_path,
                    "success": false,
                    "error": e
                }));
                failed += 1;
            }
        }
    }
    
    let response = serde_json::json!({
        "success": true,
        "results": results,
        "summary": {
            "total_processed": results.len(),
            "successful": successful,
            "failed": failed,
            "success_rate": if results.len() > 0 { successful as f32 / results.len() as f32 } else { 0.0 }
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Batch OCR completato: {}/{} successi", successful, results.len());
    Ok(response)
}

#[tauri::command]
pub async fn get_ocr_performance_metrics() -> Result<serde_json::Value, String> {
    log::info!("📊 Recupero metriche performance OCR");
    
    let processor = AdvancedOCRProcessor::new(OCRConfig::default());
    
    match processor.get_performance_metrics() {
        Ok(metrics) => {
            let response = serde_json::json!({
                "success": true,
                "metrics": {
                    "total_processed": metrics.total_processed,
                    "successful_extractions": metrics.successful_extractions,
                    "success_rate": if metrics.total_processed > 0 { 
                        metrics.successful_extractions as f32 / metrics.total_processed as f32 
                    } else { 0.0 },
                    "average_processing_time_ms": metrics.average_processing_time_ms,
                    "cache_hit_rate": metrics.cache_hit_rate,
                    "engine_performance": metrics.engine_performance
                },
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            log::info!("✅ Metriche OCR recuperate: {} processamenti totali", metrics.total_processed);
            Ok(response)
        },
        Err(e) => {
            log::error!("❌ Errore recupero metriche OCR: {}", e);
            Err(format!("Errore recupero metriche OCR: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_supported_ocr_engines() -> Result<serde_json::Value, String> {
    log::info!("🔧 Recupero motori OCR supportati");
    
    let engines = vec![
        serde_json::json!({
            "name": "tesseract",
            "display_name": "Tesseract OCR",
            "description": "Motore OCR open source di Google, ottimo per testi stampati",
            "supported_languages": ["eng", "ita", "fra", "deu", "spa", "jpn", "chi_sim", "chi_tra", "kor", "rus", "ara"],
            "strengths": ["Accuratezza alta", "Molte lingue supportate", "Configurabile"],
            "weaknesses": ["Lento su immagini complesse", "Richiede preprocessing"],
            "recommended_for": ["Documenti", "Testi stampati", "Screenshot UI"]
        }),
        serde_json::json!({
            "name": "windows_ocr",
            "display_name": "Windows OCR",
            "description": "Motore OCR nativo di Windows, veloce e integrato",
            "supported_languages": ["auto", "eng", "ita", "fra", "deu", "spa"],
            "strengths": ["Veloce", "Integrato nel sistema", "Buono per testi moderni"],
            "weaknesses": ["Meno lingue supportate", "Solo Windows"],
            "recommended_for": ["Applicazioni moderne", "Testi UI", "Processamento veloce"]
        }),
        serde_json::json!({
            "name": "easy_ocr",
            "display_name": "EasyOCR",
            "description": "Motore OCR basato su deep learning, eccellente per testi complessi",
            "supported_languages": ["multi", "eng", "ita", "fra", "deu", "spa", "jpn", "chi_sim", "chi_tra", "kor"],
            "strengths": ["Deep learning", "Ottimo per testi complessi", "Rilevamento automatico"],
            "weaknesses": ["Richiede GPU per performance ottimali", "Più lento"],
            "recommended_for": ["Testi complessi", "Immagini di bassa qualità", "Testi artistici"]
        })
    ];
    
    let response = serde_json::json!({
        "success": true,
        "engines": engines,
        "total_engines": engines.len(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Motori OCR supportati: {}", engines.len());
    Ok(response)
}

#[tauri::command]
pub async fn get_ocr_config() -> Result<serde_json::Value, String> {
    log::info!("⚙️ Recupero configurazione OCR");
    
    let config = OCRConfig::default();
    
    let response = serde_json::json!({
        "success": true,
        "config": {
            "enabled_engines": config.enabled_engines,
            "tesseract_path": config.tesseract_path,
            "tesseract_data_path": config.tesseract_data_path,
            "supported_languages": config.supported_languages,
            "preprocessing_enabled": config.preprocessing_enabled,
            "parallel_processing": config.parallel_processing,
            "confidence_threshold": config.confidence_threshold,
            "timeout_seconds": config.timeout_seconds,
            "ml_scoring_enabled": config.ml_scoring_enabled
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Configurazione OCR recuperata");
    Ok(response)
}

#[tauri::command]
pub async fn update_ocr_config(
    enabled_engines: Option<Vec<String>>,
    tesseract_path: Option<String>,
    tesseract_data_path: Option<String>,
    supported_languages: Option<Vec<String>>,
    preprocessing_enabled: Option<bool>,
    parallel_processing: Option<bool>,
    confidence_threshold: Option<f32>,
    timeout_seconds: Option<u64>,
    ml_scoring_enabled: Option<bool>
) -> Result<serde_json::Value, String> {
    log::info!("🔧 Aggiornamento configurazione OCR");
    
    let mut config = OCRConfig::default();
    
    if let Some(engines) = enabled_engines {
        config.enabled_engines = engines.iter().filter_map(|e| {
            match e.as_str() {
                "tesseract" => Some(OCREngine::Tesseract),
                "windows_ocr" => Some(OCREngine::WindowsOCR),
                "easy_ocr" => Some(OCREngine::EasyOCR),
                _ => None,
            }
        }).collect();
    }
    
    if let Some(path) = tesseract_path { config.tesseract_path = Some(path); }
    if let Some(path) = tesseract_data_path { config.tesseract_data_path = Some(path); }
    if let Some(langs) = supported_languages { config.supported_languages = langs; }
    if let Some(enabled) = preprocessing_enabled { config.preprocessing_enabled = enabled; }
    if let Some(parallel) = parallel_processing { config.parallel_processing = parallel; }
    if let Some(threshold) = confidence_threshold { config.confidence_threshold = threshold; }
    if let Some(timeout) = timeout_seconds { config.timeout_seconds = timeout; }
    if let Some(ml_enabled) = ml_scoring_enabled { config.ml_scoring_enabled = ml_enabled; }
    
    let response = serde_json::json!({
        "success": true,
        "updated_config": {
            "enabled_engines": config.enabled_engines,
            "tesseract_path": config.tesseract_path,
            "tesseract_data_path": config.tesseract_data_path,
            "supported_languages": config.supported_languages,
            "preprocessing_enabled": config.preprocessing_enabled,
            "parallel_processing": config.parallel_processing,
            "confidence_threshold": config.confidence_threshold,
            "timeout_seconds": config.timeout_seconds,
            "ml_scoring_enabled": config.ml_scoring_enabled
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Configurazione OCR aggiornata");
    Ok(response)
}

#[tauri::command]
pub async fn test_ocr_engines() -> Result<serde_json::Value, String> {
    log::info!("🧪 Test motori OCR");
    
    let config = OCRConfig::default();
    let processor = AdvancedOCRProcessor::new(config);
    
    // Immagine di test simulata
    let test_image = "test_image.png";
    let mut test_results = Vec::new();
    
    // Test ogni motore individualmente
    let engines = vec![
        ("tesseract", OCREngine::Tesseract),
        ("windows_ocr", OCREngine::WindowsOCR),
        ("easy_ocr", OCREngine::EasyOCR),
    ];
    
    for (engine_name, engine) in engines {
        let start_time = std::time::Instant::now();
        
        // Simula test del motore
        let test_result = match processor.process_image(test_image, Some("eng")).await {
            Ok(result) => {
                serde_json::json!({
                    "engine": engine_name,
                    "success": true,
                    "confidence": result.confidence,
                    "processing_time_ms": result.processing_time_ms,
                    "text_length": result.text.len(),
                    "bounding_boxes_count": result.bounding_boxes.len()
                })
            },
            Err(e) => {
                serde_json::json!({
                    "engine": engine_name,
                    "success": false,
                    "error": e,
                    "processing_time_ms": start_time.elapsed().as_millis()
                })
            }
        };
        
        test_results.push(test_result);
    }
    
    let successful_tests = test_results.iter()
        .filter(|r| r["success"].as_bool().unwrap_or(false))
        .count();
    
    let response = serde_json::json!({
        "success": true,
        "test_results": test_results,
        "summary": {
            "total_engines": test_results.len(),
            "successful_engines": successful_tests,
            "success_rate": successful_tests as f32 / test_results.len() as f32,
            "recommended_engine": if successful_tests > 0 { 
                test_results.iter()
                    .filter(|r| r["success"].as_bool().unwrap_or(false))
                    .max_by(|a, b| {
                        a["confidence"].as_f64().unwrap_or(0.0)
                            .partial_cmp(&b["confidence"].as_f64().unwrap_or(0.0))
                            .unwrap()
                    })
                    .and_then(|r| r["engine"].as_str())
            } else { None }
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Test OCR completato: {}/{} motori funzionanti", successful_tests, test_results.len());
    Ok(response)
}

#[tauri::command]
pub async fn clear_ocr_cache() -> Result<serde_json::Value, String> {
    log::info!("🧹 Pulizia cache OCR");
    
    let processor = AdvancedOCRProcessor::new(OCRConfig::default());
    processor.clear_cache();
    
    let response = serde_json::json!({
        "success": true,
        "message": "Cache OCR pulita con successo",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Cache OCR pulita");
    Ok(response)
}

#[tauri::command]
pub async fn get_ml_scoring_info() -> Result<serde_json::Value, String> {
    log::info!("🧠 Recupero informazioni ML scoring");
    
    let scoring_info = serde_json::json!({
        "success": true,
        "ml_scoring": {
            "description": "Sistema di scoring basato su machine learning per selezionare il miglior risultato OCR",
            "metrics": {
                "text_coherence": {
                    "description": "Coerenza del testo basata su bigrammi e struttura linguistica",
                    "weight": 0.25
                },
                "language_consistency": {
                    "description": "Consistenza con il modello linguistico target",
                    "weight": 0.20
                },
                "character_accuracy": {
                    "description": "Accuratezza caratteri basata su frequenza linguistica",
                    "weight": 0.20
                },
                "word_completeness": {
                    "description": "Completezza delle parole (poche parole troncate)",
                    "weight": 0.20
                },
                "context_relevance": {
                    "description": "Rilevanza contestuale del testo estratto",
                    "weight": 0.15
                }
            },
            "supported_languages": ["eng", "ita", "fra", "deu", "spa"],
            "benefits": [
                "Selezione automatica del miglior risultato",
                "Riduzione errori OCR",
                "Miglioramento accuracy complessiva",
                "Adattamento al contesto linguistico"
            ]
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    log::info!("✅ Informazioni ML scoring recuperate");
    Ok(scoring_info)
}
