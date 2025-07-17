use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResult {
    pub translated_text: String,
    pub source_language: Option<String>,
    pub target_language: String,
    pub backend: TranslationBackend,
    pub confidence: f32,
    pub processing_time_ms: u64,
    pub cost_estimate: Option<f32>, // in USD
    pub character_count: usize,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash, Eq)]
pub enum TranslationBackend {
    DeepL,
    Yandex,
    Papago,
    GoogleTranslate,
    Combined, // Risultato combinato da più backend
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    pub enabled: bool,
    pub api_key: Option<String>,
    pub api_url: Option<String>,
    pub rate_limit_per_minute: u32,
    pub max_characters_per_request: usize,
    pub timeout_seconds: u64,
    pub priority: u8, // 1 = highest, 10 = lowest
    pub cost_per_character: f32, // in USD
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            api_key: None,
            api_url: None,
            rate_limit_per_minute: 100,
            max_characters_per_request: 5000,
            timeout_seconds: 30,
            priority: 5,
            cost_per_character: 0.00002, // $0.02 per 1000 characters
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationConfig {
    pub backends: HashMap<TranslationBackend, BackendConfig>,
    pub fallback_enabled: bool,
    pub quality_threshold: f32,
    pub cost_optimization: bool,
    pub parallel_translation: bool,
    pub cache_enabled: bool,
    pub auto_language_detection: bool,
    pub supported_languages: Vec<String>,
}

impl Default for TranslationConfig {
    fn default() -> Self {
        let mut backends = HashMap::new();
        
        // DeepL Configuration
        backends.insert(TranslationBackend::DeepL, BackendConfig {
            enabled: true,
            api_key: None,
            api_url: Some("https://api-free.deepl.com/v2/translate".to_string()),
            rate_limit_per_minute: 500,
            max_characters_per_request: 5000,
            timeout_seconds: 30,
            priority: 1, // Highest priority
            cost_per_character: 0.00002,
        });

        // Yandex Configuration
        backends.insert(TranslationBackend::Yandex, BackendConfig {
            enabled: true,
            api_key: None,
            api_url: Some("https://translate.api.cloud.yandex.net/translate/v2/translate".to_string()),
            rate_limit_per_minute: 1000,
            max_characters_per_request: 10000,
            timeout_seconds: 25,
            priority: 2,
            cost_per_character: 0.000015,
        });

        // Papago Configuration
        backends.insert(TranslationBackend::Papago, BackendConfig {
            enabled: true,
            api_key: None,
            api_url: Some("https://openapi.naver.com/v1/papago/n2mt".to_string()),
            rate_limit_per_minute: 10000,
            max_characters_per_request: 5000,
            timeout_seconds: 20,
            priority: 3,
            cost_per_character: 0.00001,
        });

        // Google Translate Configuration
        backends.insert(TranslationBackend::GoogleTranslate, BackendConfig {
            enabled: true,
            api_key: None,
            api_url: Some("https://translation.googleapis.com/language/translate/v2".to_string()),
            rate_limit_per_minute: 100,
            max_characters_per_request: 5000,
            timeout_seconds: 30,
            priority: 4,
            cost_per_character: 0.00002,
        });

        Self {
            backends,
            fallback_enabled: true,
            quality_threshold: 0.8,
            cost_optimization: true,
            parallel_translation: false, // Disabilitato di default per evitare costi
            cache_enabled: true,
            auto_language_detection: true,
            supported_languages: vec![
                "en".to_string(), "it".to_string(), "fr".to_string(), "de".to_string(),
                "es".to_string(), "ja".to_string(), "ko".to_string(), "zh".to_string(),
                "ru".to_string(), "ar".to_string(), "pt".to_string(), "nl".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone)]
struct RateLimiter {
    requests: Vec<Instant>,
    limit_per_minute: u32,
}

impl RateLimiter {
    fn new(limit_per_minute: u32) -> Self {
        Self {
            requests: Vec::new(),
            limit_per_minute,
        }
    }

    fn can_make_request(&mut self) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - Duration::from_secs(60);
        
        // Rimuovi richieste più vecchie di 1 minuto
        self.requests.retain(|&time| time > one_minute_ago);
        
        self.requests.len() < self.limit_per_minute as usize
    }

    fn record_request(&mut self) {
        self.requests.push(Instant::now());
    }
}

pub struct TranslationBackendManager {
    config: TranslationConfig,
    http_client: Client,
    rate_limiters: Arc<Mutex<HashMap<TranslationBackend, RateLimiter>>>,
    translation_cache: Arc<Mutex<HashMap<String, TranslationResult>>>,
    performance_metrics: Arc<Mutex<BackendMetrics>>,
}

#[derive(Debug, Clone)]
struct BackendMetrics {
    pub total_requests: HashMap<TranslationBackend, u64>,
    pub successful_requests: HashMap<TranslationBackend, u64>,
    pub failed_requests: HashMap<TranslationBackend, u64>,
    pub average_response_time: HashMap<TranslationBackend, f32>,
    pub total_cost: HashMap<TranslationBackend, f32>,
    pub cache_hit_rate: f32,
}

impl TranslationBackendManager {
    pub fn new(config: TranslationConfig) -> Self {
        let mut rate_limiters = HashMap::new();
        
        for (backend, backend_config) in &config.backends {
            rate_limiters.insert(
                backend.clone(),
                RateLimiter::new(backend_config.rate_limit_per_minute)
            );
        }

        Self {
            config,
            http_client: Client::new(),
            rate_limiters: Arc::new(Mutex::new(rate_limiters)),
            translation_cache: Arc::new(Mutex::new(HashMap::new())),
            performance_metrics: Arc::new(Mutex::new(BackendMetrics {
                total_requests: HashMap::new(),
                successful_requests: HashMap::new(),
                failed_requests: HashMap::new(),
                average_response_time: HashMap::new(),
                total_cost: HashMap::new(),
                cache_hit_rate: 0.0,
            })),
        }
    }

    /// Traduce testo usando il miglior backend disponibile
    pub async fn translate(
        &self,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str,
        preferred_backend: Option<TranslationBackend>
    ) -> Result<TranslationResult, String> {
        let start_time = Instant::now();
        
        // Controlla cache prima
        let cache_key = format!("{}:{}:{}", 
            source_lang.unwrap_or("auto"), target_lang, text);
        
        if self.config.cache_enabled {
            if let Some(cached_result) = self.get_cached_translation(&cache_key) {
                self.update_cache_metrics(true);
                return Ok(cached_result);
            }
        }
        
        self.update_cache_metrics(false);

        // Determina backend da utilizzare
        let backend = if let Some(preferred) = preferred_backend {
            preferred
        } else {
            self.select_best_backend(text.len()).await?
        };

        // Esegui traduzione
        let result = if self.config.parallel_translation {
            self.translate_parallel(text, source_lang, target_lang).await?
        } else {
            self.translate_with_backend(&backend, text, source_lang, target_lang).await?
        };

        // Salva in cache
        if self.config.cache_enabled {
            self.cache_translation(cache_key, &result);
        }

        let total_time = start_time.elapsed().as_millis() as u64;
        log::info!("🌐 Traduzione completata: {} caratteri in {}ms (Backend: {:?}, Confidence: {:.2})", 
            text.len(), total_time, result.backend, result.confidence);

        Ok(result)
    }

    /// Traduzione parallela con più backend per massima qualità
    async fn translate_parallel(
        &self,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<TranslationResult, String> {
        let mut results = Vec::new();
        let enabled_backends = self.get_enabled_backends();

        // Esegui traduzione con tutti i backend abilitati
        for backend in enabled_backends {
            match self.translate_with_backend(&backend, text, source_lang, target_lang).await {
                Ok(result) => results.push(result),
                Err(e) => log::warn!("❌ Errore backend {:?}: {}", backend, e),
            }
        }

        if results.is_empty() {
            return Err("Tutti i backend di traduzione hanno fallito".to_string());
        }

        // Seleziona il miglior risultato basato su confidence e qualità
        let best_result = self.select_best_translation_result(results)?;
        
        Ok(best_result)
    }

    /// Traduce con un backend specifico
    async fn translate_with_backend(
        &self,
        backend: &TranslationBackend,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<TranslationResult, String> {
        let start_time = Instant::now();
        
        // Controlla rate limiting
        if !self.can_make_request(backend)? {
            return Err(format!("Rate limit raggiunto per backend {:?}", backend));
        }

        // Registra richiesta
        self.record_request(backend)?;
        self.update_metrics_request(backend);

        // Esegui traduzione specifica per backend
        let result = match backend {
            TranslationBackend::DeepL => self.translate_deepl(text, source_lang, target_lang).await?,
            TranslationBackend::Yandex => self.translate_yandex(text, source_lang, target_lang).await?,
            TranslationBackend::Papago => self.translate_papago(text, source_lang, target_lang).await?,
            TranslationBackend::GoogleTranslate => self.translate_google(text, source_lang, target_lang).await?,
            TranslationBackend::Combined => return Err("Combined backend non supportato per traduzione diretta".to_string()),
        };

        let processing_time = start_time.elapsed().as_millis() as u64;
        
        // Calcola costo
        let backend_config = self.config.backends.get(backend).unwrap();
        let cost = text.len() as f32 * backend_config.cost_per_character;

        let translation_result = TranslationResult {
            translated_text: result.0,
            source_language: result.1,
            target_language: target_lang.to_string(),
            backend: backend.clone(),
            confidence: result.2,
            processing_time_ms: processing_time,
            cost_estimate: Some(cost),
            character_count: text.len(),
            timestamp: Utc::now(),
        };

        // Aggiorna metriche
        self.update_metrics_success(backend, processing_time, cost);
        
        Ok(translation_result)
    }

    /// Traduzione con DeepL
    async fn translate_deepl(
        &self,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<(String, Option<String>, f32), String> {
        let backend_config = self.config.backends.get(&TranslationBackend::DeepL)
            .ok_or("Configurazione DeepL non trovata")?;

        let api_key = backend_config.api_key.as_ref()
            .ok_or("API key DeepL non configurata")?;

        let api_url = backend_config.api_url.as_ref()
            .ok_or("URL API DeepL non configurato")?;

        // Simula chiamata API DeepL
        // In produzione useresti le API reali
        let translated_text = format!("[DeepL] {}", text);
        let detected_lang = source_lang.map(|s| s.to_string());
        let confidence = 0.92 + (rand::random::<f32>() * 0.07); // 0.92-0.99

        log::debug!("🔵 DeepL: {} caratteri tradotti (confidence: {:.3})", text.len(), confidence);
        
        Ok((translated_text, detected_lang, confidence))
    }

    /// Traduzione con Yandex
    async fn translate_yandex(
        &self,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<(String, Option<String>, f32), String> {
        let backend_config = self.config.backends.get(&TranslationBackend::Yandex)
            .ok_or("Configurazione Yandex non trovata")?;

        let api_key = backend_config.api_key.as_ref()
            .ok_or("API key Yandex non configurata")?;

        // Simula chiamata API Yandex
        let translated_text = format!("[Yandex] {}", text);
        let detected_lang = source_lang.map(|s| s.to_string());
        let confidence = 0.88 + (rand::random::<f32>() * 0.10); // 0.88-0.98

        log::debug!("🟡 Yandex: {} caratteri tradotti (confidence: {:.3})", text.len(), confidence);
        
        Ok((translated_text, detected_lang, confidence))
    }

    /// Traduzione con Naver Papago
    async fn translate_papago(
        &self,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<(String, Option<String>, f32), String> {
        let backend_config = self.config.backends.get(&TranslationBackend::Papago)
            .ok_or("Configurazione Papago non trovata")?;

        let api_key = backend_config.api_key.as_ref()
            .ok_or("API key Papago non configurata")?;

        // Simula chiamata API Papago
        let translated_text = format!("[Papago] {}", text);
        let detected_lang = source_lang.map(|s| s.to_string());
        let confidence = 0.85 + (rand::random::<f32>() * 0.12); // 0.85-0.97

        log::debug!("🟢 Papago: {} caratteri tradotti (confidence: {:.3})", text.len(), confidence);
        
        Ok((translated_text, detected_lang, confidence))
    }

    /// Traduzione con Google Translate
    async fn translate_google(
        &self,
        text: &str,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<(String, Option<String>, f32), String> {
        let backend_config = self.config.backends.get(&TranslationBackend::GoogleTranslate)
            .ok_or("Configurazione Google non trovata")?;

        let api_key = backend_config.api_key.as_ref()
            .ok_or("API key Google non configurata")?;

        // Simula chiamata API Google
        let translated_text = format!("[Google] {}", text);
        let detected_lang = source_lang.map(|s| s.to_string());
        let confidence = 0.90 + (rand::random::<f32>() * 0.08); // 0.90-0.98

        log::debug!("🔴 Google: {} caratteri tradotti (confidence: {:.3})", text.len(), confidence);
        
        Ok((translated_text, detected_lang, confidence))
    }

    /// Seleziona il miglior backend basato su metriche e costo
    async fn select_best_backend(&self, text_length: usize) -> Result<TranslationBackend, String> {
        let enabled_backends = self.get_enabled_backends();
        
        if enabled_backends.is_empty() {
            return Err("Nessun backend abilitato".to_string());
        }

        // Ordina per priorità e performance
        let mut scored_backends = Vec::new();
        
        for backend in enabled_backends {
            let config = self.config.backends.get(&backend).unwrap();
            let mut score = 10.0 - config.priority as f32; // Priorità più alta = score più alto
            
            // Fattore costo se ottimizzazione abilitata
            if self.config.cost_optimization {
                let cost = text_length as f32 * config.cost_per_character;
                score -= cost * 1000.0; // Penalizza costi alti
            }

            // Fattore performance dalle metriche
            if let Ok(metrics) = self.performance_metrics.lock() {
                if let Some(success_rate) = metrics.successful_requests.get(&backend) {
                    let total = metrics.total_requests.get(&backend).unwrap_or(&1);
                    let rate = *success_rate as f32 / *total as f32;
                    score += rate * 2.0; // Bonus per alta success rate
                }
            }

            scored_backends.push((backend, score));
        }

        // Ordina per score decrescente
        scored_backends.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        Ok(scored_backends[0].0.clone())
    }

    /// Seleziona il miglior risultato da traduzioni parallele
    fn select_best_translation_result(&self, results: Vec<TranslationResult>) -> Result<TranslationResult, String> {
        if results.is_empty() {
            return Err("Nessun risultato di traduzione disponibile".to_string());
        }

        // Ordina per confidence e qualità
        let mut scored_results: Vec<_> = results.into_iter()
            .map(|result| {
                let mut score = result.confidence;
                
                // Bonus per backend di alta qualità
                match result.backend {
                    TranslationBackend::DeepL => score += 0.05,
                    TranslationBackend::GoogleTranslate => score += 0.03,
                    TranslationBackend::Yandex => score += 0.02,
                    TranslationBackend::Papago => score += 0.01,
                    _ => {}
                }
                
                // Penalizza traduzioni troppo brevi o lunghe
                let length_ratio = result.translated_text.len() as f32 / result.character_count as f32;
                if length_ratio < 0.5 || length_ratio > 2.0 {
                    score -= 0.1;
                }
                
                (result, score)
            })
            .collect();

        scored_results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let mut best_result = scored_results.into_iter().next().unwrap().0;
        best_result.backend = TranslationBackend::Combined;
        
        Ok(best_result)
    }

    /// Batch translation per multiple stringhe
    pub async fn translate_batch(
        &self,
        texts: Vec<String>,
        source_lang: Option<&str>,
        target_lang: &str
    ) -> Result<Vec<TranslationResult>, String> {
        let mut results = Vec::new();
        
        for text in texts {
            match self.translate(&text, source_lang, target_lang, None).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    log::warn!("❌ Errore traduzione batch: {}", e);
                    // Continua con le altre traduzioni
                }
            }
        }
        
        Ok(results)
    }

    // === METODI PRIVATI ===

    fn get_enabled_backends(&self) -> Vec<TranslationBackend> {
        self.config.backends.iter()
            .filter(|(_, config)| config.enabled)
            .map(|(backend, _)| backend.clone())
            .collect()
    }

    fn can_make_request(&self, backend: &TranslationBackend) -> Result<bool, String> {
        let mut limiters = self.rate_limiters.lock()
            .map_err(|_| "Errore accesso rate limiters")?;
        
        if let Some(limiter) = limiters.get_mut(backend) {
            Ok(limiter.can_make_request())
        } else {
            Err(format!("Rate limiter non trovato per backend {:?}", backend))
        }
    }

    fn record_request(&self, backend: &TranslationBackend) -> Result<(), String> {
        let mut limiters = self.rate_limiters.lock()
            .map_err(|_| "Errore accesso rate limiters")?;
        
        if let Some(limiter) = limiters.get_mut(backend) {
            limiter.record_request();
            Ok(())
        } else {
            Err(format!("Rate limiter non trovato per backend {:?}", backend))
        }
    }

    fn get_cached_translation(&self, cache_key: &str) -> Option<TranslationResult> {
        if let Ok(cache) = self.translation_cache.lock() {
            cache.get(cache_key).cloned()
        } else {
            None
        }
    }

    fn cache_translation(&self, cache_key: String, result: &TranslationResult) {
        if let Ok(mut cache) = self.translation_cache.lock() {
            cache.insert(cache_key, result.clone());
        }
    }

    fn update_cache_metrics(&self, is_hit: bool) {
        if let Ok(mut metrics) = self.performance_metrics.lock() {
            let current_rate = metrics.cache_hit_rate;
            let new_rate = if is_hit {
                (current_rate * 0.9) + (1.0 * 0.1)
            } else {
                (current_rate * 0.9) + (0.0 * 0.1)
            };
            metrics.cache_hit_rate = new_rate;
        }
    }

    fn update_metrics_request(&self, backend: &TranslationBackend) {
        if let Ok(mut metrics) = self.performance_metrics.lock() {
            *metrics.total_requests.entry(backend.clone()).or_insert(0) += 1;
        }
    }

    fn update_metrics_success(&self, backend: &TranslationBackend, response_time: u64, cost: f32) {
        if let Ok(mut metrics) = self.performance_metrics.lock() {
            *metrics.successful_requests.entry(backend.clone()).or_insert(0) += 1;
            *metrics.total_cost.entry(backend.clone()).or_insert(0.0) += cost;
            
            // Aggiorna tempo medio di risposta
            let current_avg = metrics.average_response_time.get(backend).unwrap_or(&0.0);
            let total_requests = metrics.total_requests.get(backend).unwrap_or(&1);
            let new_avg = (current_avg * (*total_requests - 1) as f32 + response_time as f32) / *total_requests as f32;
            metrics.average_response_time.insert(backend.clone(), new_avg);
        }
    }

    fn update_metrics_failure(&self, backend: &TranslationBackend) {
        if let Ok(mut metrics) = self.performance_metrics.lock() {
            *metrics.failed_requests.entry(backend.clone()).or_insert(0) += 1;
        }
    }

    /// Ottiene metriche performance
    pub fn get_performance_metrics(&self) -> Result<BackendMetrics, String> {
        self.performance_metrics.lock()
            .map(|metrics| metrics.clone())
            .map_err(|_| "Errore accesso metriche".to_string())
    }

    /// Pulisce cache traduzioni
    pub fn clear_cache(&self) {
        if let Ok(mut cache) = self.translation_cache.lock() {
            cache.clear();
        }
    }

    /// Ottiene configurazione corrente
    pub fn get_config(&self) -> &TranslationConfig {
        &self.config
    }

    /// Aggiorna configurazione
    pub fn update_config(&mut self, new_config: TranslationConfig) {
        self.config = new_config;
        
        // Aggiorna rate limiters
        if let Ok(mut limiters) = self.rate_limiters.lock() {
            limiters.clear();
            for (backend, backend_config) in &self.config.backends {
                limiters.insert(
                    backend.clone(),
                    RateLimiter::new(backend_config.rate_limit_per_minute)
                );
            }
        }
    }
}
