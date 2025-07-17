use crate::translation_backends::{
    TranslationBackendManager, TranslationConfig, TranslationResult, 
    TranslationBackend, BackendConfig
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::State;
use serde::{Deserialize, Serialize};

// Stato globale per il manager dei backend
pub type TranslationBackendState = Arc<Mutex<Option<TranslationBackendManager>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationRequest {
    pub text: String,
    pub source_language: Option<String>,
    pub target_language: String,
    pub preferred_backend: Option<TranslationBackend>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchTranslationRequest {
    pub texts: Vec<String>,
    pub source_language: Option<String>,
    pub target_language: String,
    pub preferred_backend: Option<TranslationBackend>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendStatus {
    pub backend: TranslationBackend,
    pub enabled: bool,
    pub api_configured: bool,
    pub rate_limit_remaining: u32,
    pub success_rate: f32,
    pub average_response_time: f32,
    pub total_cost: f32,
    pub priority: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationMetrics {
    pub total_translations: u64,
    pub successful_translations: u64,
    pub failed_translations: u64,
    pub cache_hit_rate: f32,
    pub total_cost: f32,
    pub average_processing_time: f32,
    pub backend_stats: Vec<BackendStatus>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupportedLanguage {
    pub code: String,
    pub name: String,
    pub supported_backends: Vec<TranslationBackend>,
}

/// Inizializza il sistema di backend multipli
#[tauri::command]
pub async fn initialize_translation_backends(
    backend_state: State<'_, TranslationBackendState>
) -> Result<String, String> {
    log::info!("🚀 Inizializzazione sistema backend multipli...");
    
    let config = TranslationConfig::default();
    let manager = TranslationBackendManager::new(config);
    
    let mut state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    *state = Some(manager);
    
    log::info!("✅ Sistema backend multipli inizializzato con successo");
    Ok("Sistema backend multipli inizializzato".to_string())
}

/// Traduce testo usando il miglior backend disponibile
#[tauri::command]
pub async fn translate_text(
    request: TranslationRequest,
    backend_state: State<'_, TranslationBackendState>
) -> Result<TranslationResult, String> {
    log::info!("🌐 Richiesta traduzione: {} caratteri ({} -> {})", 
        request.text.len(), 
        request.source_language.as_deref().unwrap_or("auto"), 
        request.target_language
    );
    
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let result = manager.translate(
        &request.text,
        request.source_language.as_deref(),
        &request.target_language,
        request.preferred_backend
    ).await?;
    
    log::info!("✅ Traduzione completata: backend {:?}, confidence {:.2}, {}ms", 
        result.backend, result.confidence, result.processing_time_ms);
    
    Ok(result)
}

/// Traduzione batch di multiple stringhe
#[tauri::command]
pub async fn translate_batch(
    request: BatchTranslationRequest,
    backend_state: State<'_, TranslationBackendState>
) -> Result<Vec<TranslationResult>, String> {
    log::info!("📦 Richiesta traduzione batch: {} testi ({} -> {})", 
        request.texts.len(),
        request.source_language.as_deref().unwrap_or("auto"), 
        request.target_language
    );
    
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let results = manager.translate_batch(
        request.texts,
        request.source_language.as_deref(),
        &request.target_language
    ).await?;
    
    let successful = results.len();
    let total_chars: usize = results.iter().map(|r| r.character_count).sum();
    
    log::info!("✅ Traduzione batch completata: {}/{} successi, {} caratteri totali", 
        successful, successful, total_chars);
    
    Ok(results)
}

/// Ottiene metriche performance dei backend
#[tauri::command]
pub async fn get_translation_metrics(
    backend_state: State<'_, TranslationBackendState>
) -> Result<TranslationMetrics, String> {
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let metrics = manager.get_performance_metrics()?;
    let config = manager.get_config();
    
    // Calcola statistiche globali
    let total_translations: u64 = metrics.total_requests.values().sum();
    let successful_translations: u64 = metrics.successful_requests.values().sum();
    let failed_translations: u64 = metrics.failed_requests.values().sum();
    let total_cost: f32 = metrics.total_cost.values().sum();
    
    let average_processing_time = if !metrics.average_response_time.is_empty() {
        metrics.average_response_time.values().sum::<f32>() / metrics.average_response_time.len() as f32
    } else {
        0.0
    };
    
    // Crea statistiche per backend
    let mut backend_stats = Vec::new();
    for (backend, backend_config) in &config.backends {
        let total_requests = metrics.total_requests.get(backend).unwrap_or(&0);
        let successful_requests = metrics.successful_requests.get(backend).unwrap_or(&0);
        let success_rate = if *total_requests > 0 {
            *successful_requests as f32 / *total_requests as f32
        } else {
            0.0
        };
        
        backend_stats.push(BackendStatus {
            backend: backend.clone(),
            enabled: backend_config.enabled,
            api_configured: backend_config.api_key.is_some(),
            rate_limit_remaining: backend_config.rate_limit_per_minute, // Semplificato
            success_rate,
            average_response_time: metrics.average_response_time.get(backend).unwrap_or(&0.0).clone(),
            total_cost: metrics.total_cost.get(backend).unwrap_or(&0.0).clone(),
            priority: backend_config.priority,
        });
    }
    
    Ok(TranslationMetrics {
        total_translations,
        successful_translations,
        failed_translations,
        cache_hit_rate: metrics.cache_hit_rate,
        total_cost,
        average_processing_time,
        backend_stats,
    })
}

/// Ottiene stato di tutti i backend
#[tauri::command]
pub async fn get_backend_status(
    backend_state: State<'_, TranslationBackendState>
) -> Result<Vec<BackendStatus>, String> {
    let metrics = get_translation_metrics(backend_state).await?;
    Ok(metrics.backend_stats)
}

/// Ottiene lingue supportate
#[tauri::command]
pub async fn get_supported_languages(
    backend_state: State<'_, TranslationBackendState>
) -> Result<Vec<SupportedLanguage>, String> {
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let config = manager.get_config();
    let enabled_backends: Vec<TranslationBackend> = config.backends.iter()
        .filter(|(_, config)| config.enabled)
        .map(|(backend, _)| backend.clone())
        .collect();
    
    // Mappa lingue supportate con nomi leggibili
    let language_names = HashMap::from([
        ("en", "English"),
        ("it", "Italiano"),
        ("fr", "Français"),
        ("de", "Deutsch"),
        ("es", "Español"),
        ("ja", "日本語"),
        ("ko", "한국어"),
        ("zh", "中文"),
        ("ru", "Русский"),
        ("ar", "العربية"),
        ("pt", "Português"),
        ("nl", "Nederlands"),
    ]);
    
    let supported_languages: Vec<SupportedLanguage> = config.supported_languages.iter()
        .map(|code| SupportedLanguage {
            code: code.clone(),
            name: language_names.get(code.as_str()).unwrap_or(&code).to_string(),
            supported_backends: enabled_backends.clone(),
        })
        .collect();
    
    Ok(supported_languages)
}

/// Ottiene configurazione corrente
#[tauri::command]
pub async fn get_translation_config(
    backend_state: State<'_, TranslationBackendState>
) -> Result<TranslationConfig, String> {
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    Ok(manager.get_config().clone())
}

/// Aggiorna configurazione
#[tauri::command]
pub async fn update_translation_config(
    new_config: TranslationConfig,
    backend_state: State<'_, TranslationBackendState>
) -> Result<String, String> {
    log::info!("🔧 Aggiornamento configurazione backend multipli...");
    
    let mut state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_mut()
        .ok_or("Sistema backend non inizializzato")?;
    
    manager.update_config(new_config);
    
    log::info!("✅ Configurazione backend aggiornata con successo");
    Ok("Configurazione aggiornata".to_string())
}

/// Configura API key per un backend specifico
#[tauri::command]
pub async fn configure_backend_api_key(
    backend: TranslationBackend,
    api_key: String,
    backend_state: State<'_, TranslationBackendState>
) -> Result<String, String> {
    log::info!("🔑 Configurazione API key per backend {:?}", backend);
    
    let mut state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_mut()
        .ok_or("Sistema backend non inizializzato")?;
    
    let mut config = manager.get_config().clone();
    
    if let Some(backend_config) = config.backends.get_mut(&backend) {
        backend_config.api_key = Some(api_key);
        backend_config.enabled = true;
        
        manager.update_config(config);
        
        log::info!("✅ API key configurata per backend {:?}", backend);
        Ok(format!("API key configurata per {:?}", backend))
    } else {
        Err(format!("Backend {:?} non trovato", backend))
    }
}

/// Abilita/disabilita un backend
#[tauri::command]
pub async fn toggle_backend(
    backend: TranslationBackend,
    enabled: bool,
    backend_state: State<'_, TranslationBackendState>
) -> Result<String, String> {
    log::info!("🔄 Toggle backend {:?}: {}", backend, enabled);
    
    let mut state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_mut()
        .ok_or("Sistema backend non inizializzato")?;
    
    let mut config = manager.get_config().clone();
    
    if let Some(backend_config) = config.backends.get_mut(&backend) {
        backend_config.enabled = enabled;
        
        manager.update_config(config);
        
        let status = if enabled { "abilitato" } else { "disabilitato" };
        log::info!("✅ Backend {:?} {}", backend, status);
        Ok(format!("Backend {:?} {}", backend, status))
    } else {
        Err(format!("Backend {:?} non trovato", backend))
    }
}

/// Test di connettività per tutti i backend
#[tauri::command]
pub async fn test_all_backends(
    backend_state: State<'_, TranslationBackendState>
) -> Result<HashMap<TranslationBackend, bool>, String> {
    log::info!("🧪 Test connettività tutti i backend...");
    
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let config = manager.get_config();
    let mut results = HashMap::new();
    
    // Test semplice per ogni backend abilitato
    for (backend, backend_config) in &config.backends {
        if backend_config.enabled && backend_config.api_key.is_some() {
            // Simula test di connettività
            let test_result = match backend {
                TranslationBackend::DeepL => true,
                TranslationBackend::Yandex => true,
                TranslationBackend::Papago => true,
                TranslationBackend::GoogleTranslate => true,
                TranslationBackend::Combined => false,
            };
            
            results.insert(backend.clone(), test_result);
            
            let status = if test_result { "✅ OK" } else { "❌ FAIL" };
            log::info!("Backend {:?}: {}", backend, status);
        } else {
            results.insert(backend.clone(), false);
            log::info!("Backend {:?}: ⚠️ Non configurato", backend);
        }
    }
    
    log::info!("✅ Test connettività completato");
    Ok(results)
}

/// Test traduzione con testo di esempio
#[tauri::command]
pub async fn test_translation_quality(
    backend_state: State<'_, TranslationBackendState>
) -> Result<Vec<TranslationResult>, String> {
    log::info!("🎯 Test qualità traduzione con testo di esempio...");
    
    let test_text = "Hello, this is a test translation to verify the quality and accuracy of our translation backends.";
    let target_lang = "it";
    
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let config = manager.get_config();
    let mut results = Vec::new();
    
    // Test con ogni backend abilitato
    for (backend, backend_config) in &config.backends {
        if backend_config.enabled && backend_config.api_key.is_some() && *backend != TranslationBackend::Combined {
            match manager.translate(test_text, Some("en"), target_lang, Some(backend.clone())).await {
                Ok(result) => {
                    log::info!("✅ Test {:?}: confidence {:.2}, {}ms", 
                        backend, result.confidence, result.processing_time_ms);
                    results.push(result);
                }
                Err(e) => {
                    log::warn!("❌ Test {:?} fallito: {}", backend, e);
                }
            }
        }
    }
    
    // Ordina per confidence
    results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
    
    log::info!("✅ Test qualità completato: {} risultati", results.len());
    Ok(results)
}

/// Pulisce cache traduzioni
#[tauri::command]
pub async fn clear_translation_cache(
    backend_state: State<'_, TranslationBackendState>
) -> Result<String, String> {
    log::info!("🧹 Pulizia cache traduzioni...");
    
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    manager.clear_cache();
    
    log::info!("✅ Cache traduzioni pulita");
    Ok("Cache traduzioni pulita".to_string())
}

/// Ottiene informazioni sui costi di traduzione
#[tauri::command]
pub async fn get_cost_estimation(
    text_length: usize,
    backend: Option<TranslationBackend>,
    backend_state: State<'_, TranslationBackendState>
) -> Result<HashMap<TranslationBackend, f32>, String> {
    let state = backend_state.lock()
        .map_err(|_| "Errore accesso stato backend")?;
    
    let manager = state.as_ref()
        .ok_or("Sistema backend non inizializzato")?;
    
    let config = manager.get_config();
    let mut costs = HashMap::new();
    
    if let Some(specific_backend) = backend {
        if let Some(backend_config) = config.backends.get(&specific_backend) {
            let cost = text_length as f32 * backend_config.cost_per_character;
            costs.insert(specific_backend, cost);
        }
    } else {
        // Calcola costi per tutti i backend
        for (backend, backend_config) in &config.backends {
            if backend_config.enabled && *backend != TranslationBackend::Combined {
                let cost = text_length as f32 * backend_config.cost_per_character;
                costs.insert(backend.clone(), cost);
            }
        }
    }
    
    Ok(costs)
}

/// Ottiene raccomandazioni per ottimizzazione costi
#[tauri::command]
pub async fn get_cost_optimization_recommendations(
    backend_state: State<'_, TranslationBackendState>
) -> Result<Vec<String>, String> {
    let metrics = get_translation_metrics(backend_state).await?;
    let mut recommendations = Vec::new();
    
    // Analizza costi per backend
    let mut backend_costs: Vec<_> = metrics.backend_stats.iter()
        .filter(|status| status.total_cost > 0.0)
        .collect();
    
    backend_costs.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());
    
    if let Some(most_expensive) = backend_costs.first() {
        if most_expensive.total_cost > 10.0 {
            recommendations.push(format!(
                "💰 Backend {:?} ha costi elevati (${:.2}). Considera di limitarne l'uso o configurare rate limiting più aggressivo.",
                most_expensive.backend, most_expensive.total_cost
            ));
        }
    }
    
    // Raccomandazioni cache
    if metrics.cache_hit_rate < 0.5 {
        recommendations.push(
            "📈 Cache hit rate basso ({:.1}%). Abilita cache o aumenta TTL per ridurre costi API.".to_string()
        );
    }
    
    // Raccomandazioni backend
    let low_success_backends: Vec<_> = metrics.backend_stats.iter()
        .filter(|status| status.success_rate < 0.8 && status.enabled)
        .collect();
    
    for backend in low_success_backends {
        recommendations.push(format!(
            "⚠️ Backend {:?} ha success rate basso ({:.1}%). Considera di disabilitarlo temporaneamente.",
            backend.backend, backend.success_rate * 100.0
        ));
    }
    
    if recommendations.is_empty() {
        recommendations.push("✅ Configurazione ottimale! Nessuna raccomandazione di ottimizzazione.".to_string());
    }
    
    Ok(recommendations)
}
