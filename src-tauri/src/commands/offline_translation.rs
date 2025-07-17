use crate::offline_translation::{
    OfflineTranslationManager, OfflineTranslationConfig, OfflineTranslationResult,
    LanguageModel, ModelQuality
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::State;
use serde::{Deserialize, Serialize};

// Stato globale per il manager offline
pub type OfflineTranslationState = Arc<Mutex<Option<OfflineTranslationManager>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct OfflineTranslationRequest {
    pub text: String,
    pub source_language: String,
    pub target_language: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchOfflineTranslationRequest {
    pub texts: Vec<String>,
    pub source_language: String,
    pub target_language: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelDownloadRequest {
    pub from_language: String,
    pub to_language: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OfflineTranslationStats {
    pub total_models_available: usize,
    pub models_installed: usize,
    pub models_loaded: usize,
    pub total_translations: u64,
    pub successful_translations: u64,
    pub failed_translations: u64,
    pub cache_size: usize,
    pub total_storage_used_mb: f32,
    pub supported_language_pairs: Vec<(String, String)>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub model_key: String,
    pub from_language: String,
    pub to_language: String,
    pub model_name: String,
    pub model_version: String,
    pub model_size_mb: f32,
    pub is_installed: bool,
    pub is_loaded: bool,
    pub usage_count: u64,
    pub accuracy_score: f32,
    pub last_used: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LanguagePairSupport {
    pub from_language: String,
    pub to_language: String,
    pub is_supported: bool,
    pub model_available: bool,
    pub model_installed: bool,
    pub estimated_quality: f32,
}

/// Inizializza il sistema di traduzione offline
#[tauri::command]
pub async fn initialize_offline_translation(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("🔄 Inizializzazione sistema traduzione offline...");
    
    let config = OfflineTranslationConfig::default();
    
    let manager = OfflineTranslationManager::new(config)
        .map_err(|e| format!("Errore inizializzazione: {}", e))?;
    
    let mut state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    *state = Some(manager);
    
    log::info!("✅ Sistema traduzione offline inizializzato");
    Ok("Sistema traduzione offline inizializzato con successo".to_string())
}

/// Traduce testo usando modelli offline
#[tauri::command]
pub async fn translate_offline(
    request: OfflineTranslationRequest,
    offline_state: State<'_, OfflineTranslationState>
) -> Result<OfflineTranslationResult, String> {
    log::info!("🔄 Richiesta traduzione offline: {} caratteri ({} -> {})", 
        request.text.len(), request.source_language, request.target_language);
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let result = manager.translate_offline(
        &request.text,
        &request.source_language,
        &request.target_language
    ).await?;
    
    log::info!("✅ Traduzione offline completata: modello {}, confidence {:.2}, {}ms", 
        result.model_used, result.confidence, result.processing_time_ms);
    
    Ok(result)
}

/// Traduzione batch offline
#[tauri::command]
pub async fn translate_batch_offline(
    request: BatchOfflineTranslationRequest,
    offline_state: State<'_, OfflineTranslationState>
) -> Result<Vec<OfflineTranslationResult>, String> {
    log::info!("📦 Richiesta traduzione batch offline: {} testi ({} -> {})", 
        request.texts.len(), request.source_language, request.target_language);
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let results = manager.translate_batch_offline(
        request.texts,
        &request.source_language,
        &request.target_language
    ).await?;
    
    let successful = results.len();
    let total_chars: usize = results.iter().map(|r| r.character_count).sum();
    
    log::info!("✅ Traduzione batch offline completata: {} successi, {} caratteri totali", 
        successful, total_chars);
    
    Ok(results)
}

/// Controlla se una coppia di lingue è supportata offline
#[tauri::command]
pub async fn is_language_pair_supported_offline(
    source_language: String,
    target_language: String,
    offline_state: State<'_, OfflineTranslationState>
) -> Result<bool, String> {
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let supported = manager.is_language_pair_supported(&source_language, &target_language);
    
    Ok(supported)
}

/// Ottiene tutti i modelli disponibili
#[tauri::command]
pub async fn get_available_offline_models(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<Vec<ModelInfo>, String> {
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let models = manager.get_available_models()?;
    
    let model_infos: Vec<ModelInfo> = models.into_iter().map(|model| {
        ModelInfo {
            model_key: format!("{}-{}", model.from_language, model.to_language),
            from_language: model.from_language,
            to_language: model.to_language,
            model_name: model.model_name,
            model_version: model.model_version,
            model_size_mb: model.model_size_mb,
            is_installed: model.is_installed,
            is_loaded: false, // Semplificato per ora
            usage_count: model.usage_count,
            accuracy_score: model.accuracy_score,
            last_used: model.last_used.map(|dt| dt.to_rfc3339()),
        }
    }).collect();
    
    Ok(model_infos)
}

/// Scarica e installa un modello
#[tauri::command]
pub async fn download_offline_model(
    request: ModelDownloadRequest,
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("📥 Richiesta download modello: {} -> {}", 
        request.from_language, request.to_language);
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let result = manager.download_model(&request.from_language, &request.to_language).await?;
    
    log::info!("✅ Download modello completato: {} -> {}", 
        request.from_language, request.to_language);
    
    Ok(result)
}

/// Rimuove un modello installato
#[tauri::command]
pub async fn remove_offline_model(
    request: ModelDownloadRequest,
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("🗑️ Richiesta rimozione modello: {} -> {}", 
        request.from_language, request.to_language);
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let result = manager.remove_model(&request.from_language, &request.to_language)?;
    
    log::info!("✅ Rimozione modello completata: {} -> {}", 
        request.from_language, request.to_language);
    
    Ok(result)
}

/// Ottiene statistiche del sistema offline
#[tauri::command]
pub async fn get_offline_translation_stats(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<OfflineTranslationStats, String> {
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let models = manager.get_available_models()?;
    let metrics = manager.get_model_metrics()?;
    let config = manager.get_config();
    
    let models_installed = models.iter().filter(|m| m.is_installed).count();
    let total_storage_used_mb: f32 = models.iter()
        .filter(|m| m.is_installed)
        .map(|m| m.model_size_mb)
        .sum();
    
    let total_translations: u64 = metrics.values().map(|m| m.total_translations).sum();
    let successful_translations: u64 = metrics.values().map(|m| m.successful_translations).sum();
    let failed_translations: u64 = metrics.values().map(|m| m.failed_translations).sum();
    
    Ok(OfflineTranslationStats {
        total_models_available: models.len(),
        models_installed,
        models_loaded: 0, // Semplificato
        total_translations,
        successful_translations,
        failed_translations,
        cache_size: 0, // Semplificato
        total_storage_used_mb,
        supported_language_pairs: config.supported_language_pairs.clone(),
    })
}

/// Ottiene supporto per coppie di lingue
#[tauri::command]
pub async fn get_language_pair_support(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<Vec<LanguagePairSupport>, String> {
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let models = manager.get_available_models()?;
    let config = manager.get_config();
    
    let mut support_info = Vec::new();
    
    for (from_lang, to_lang) in &config.supported_language_pairs {
        let model_key = format!("{}-{}", from_lang, to_lang);
        let model = models.iter().find(|m| 
            m.from_language == *from_lang && m.to_language == *to_lang
        );
        
        support_info.push(LanguagePairSupport {
            from_language: from_lang.clone(),
            to_language: to_lang.clone(),
            is_supported: true,
            model_available: model.is_some(),
            model_installed: model.map_or(false, |m| m.is_installed),
            estimated_quality: model.map_or(0.0, |m| m.accuracy_score),
        });
    }
    
    Ok(support_info)
}

/// Ottiene configurazione corrente
#[tauri::command]
pub async fn get_offline_translation_config(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<OfflineTranslationConfig, String> {
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    Ok(manager.get_config().clone())
}

/// Aggiorna configurazione
#[tauri::command]
pub async fn update_offline_translation_config(
    new_config: OfflineTranslationConfig,
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("🔧 Aggiornamento configurazione traduzione offline...");
    
    let mut state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_mut()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    manager.update_config(new_config);
    
    log::info!("✅ Configurazione traduzione offline aggiornata");
    Ok("Configurazione aggiornata con successo".to_string())
}

/// Pulisce cache traduzioni
#[tauri::command]
pub async fn clear_offline_translation_cache(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("🧹 Pulizia cache traduzioni offline...");
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    manager.clear_translation_cache();
    
    log::info!("✅ Cache traduzioni offline pulita");
    Ok("Cache traduzioni offline pulita".to_string())
}

/// Cleanup automatico modelli non utilizzati
#[tauri::command]
pub async fn cleanup_unused_offline_models(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("🧹 Cleanup modelli non utilizzati...");
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let result = manager.cleanup_unused_models().await?;
    
    log::info!("✅ Cleanup modelli completato");
    Ok(result)
}

/// Precarica modelli popolari
#[tauri::command]
pub async fn preload_popular_offline_models(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<String, String> {
    log::info!("🚀 Preload modelli popolari...");
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let result = manager.preload_popular_models().await?;
    
    log::info!("✅ Preload modelli completato");
    Ok(result)
}

/// Test traduzione offline con testo di esempio
#[tauri::command]
pub async fn test_offline_translation_quality(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<Vec<OfflineTranslationResult>, String> {
    log::info!("🎯 Test qualità traduzione offline...");
    
    let test_text = "Hello, this is a test translation to verify the quality and accuracy of our offline translation models.";
    let test_pairs = vec![
        ("en", "it"),
        ("en", "fr"),
        ("en", "de"),
        ("en", "es"),
    ];
    
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let mut results = Vec::new();
    
    for (source_lang, target_lang) in test_pairs {
        if manager.is_language_pair_supported(source_lang, target_lang) {
            match manager.translate_offline(test_text, source_lang, target_lang).await {
                Ok(result) => {
                    log::info!("✅ Test {} -> {}: confidence {:.2}, {}ms", 
                        source_lang, target_lang, result.confidence, result.processing_time_ms);
                    results.push(result);
                }
                Err(e) => {
                    log::warn!("❌ Test {} -> {} fallito: {}", source_lang, target_lang, e);
                }
            }
        }
    }
    
    // Ordina per confidence
    results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
    
    log::info!("✅ Test qualità offline completato: {} risultati", results.len());
    Ok(results)
}

/// Ottiene metriche dettagliate dei modelli
#[tauri::command]
pub async fn get_offline_model_metrics(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<HashMap<String, serde_json::Value>, String> {
    let state = offline_state.lock()
        .map_err(|_| "Errore accesso stato offline")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema traduzione offline non inizializzato")?;
    
    let metrics = manager.get_model_metrics()?;
    
    // Converti in formato JSON serializzabile
    let mut json_metrics = HashMap::new();
    
    for (model_key, model_metrics) in metrics {
        let json_value = serde_json::json!({
            "total_translations": model_metrics.total_translations,
            "successful_translations": model_metrics.successful_translations,
            "failed_translations": model_metrics.failed_translations,
            "success_rate": if model_metrics.total_translations > 0 {
                model_metrics.successful_translations as f32 / model_metrics.total_translations as f32
            } else {
                0.0
            },
            "average_processing_time": model_metrics.average_processing_time,
            "average_confidence": model_metrics.average_confidence,
            "total_characters_processed": model_metrics.total_characters_processed,
            "last_used": model_metrics.last_used.map(|dt| dt.to_rfc3339()),
        });
        
        json_metrics.insert(model_key, json_value);
    }
    
    Ok(json_metrics)
}

/// Ottiene raccomandazioni per ottimizzazione storage
#[tauri::command]
pub async fn get_offline_storage_recommendations(
    offline_state: State<'_, OfflineTranslationState>
) -> Result<Vec<String>, String> {
    let stats = get_offline_translation_stats(offline_state).await?;
    let mut recommendations = Vec::new();
    
    // Analizza utilizzo storage
    if stats.total_storage_used_mb > 1000.0 {
        recommendations.push(format!(
            "💾 Utilizzo storage elevato ({:.1} MB). Considera di rimuovere modelli non utilizzati.",
            stats.total_storage_used_mb
        ));
    }
    
    // Raccomandazioni modelli
    if stats.models_installed < 3 {
        recommendations.push(
            "📥 Pochi modelli installati. Considera di scaricare modelli per le lingue più utilizzate.".to_string()
        );
    }
    
    // Raccomandazioni performance
    if stats.total_translations > 0 {
        let success_rate = stats.successful_translations as f32 / stats.total_translations as f32;
        if success_rate < 0.9 {
            recommendations.push(format!(
                "⚠️ Success rate basso ({:.1}%). Verifica qualità modelli installati.",
                success_rate * 100.0
            ));
        }
    }
    
    // Raccomandazioni generali
    if stats.models_installed == 0 {
        recommendations.push(
            "🚀 Nessun modello installato. Usa 'Preload Modelli Popolari' per iniziare.".to_string()
        );
    }
    
    if recommendations.is_empty() {
        recommendations.push("✅ Configurazione ottimale! Nessuna raccomandazione di ottimizzazione.".to_string());
    }
    
    Ok(recommendations)
}
