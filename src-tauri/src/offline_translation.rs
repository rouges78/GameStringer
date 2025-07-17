use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::{Path, PathBuf};
use std::fs;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineTranslationResult {
    pub translated_text: String,
    pub source_language: String,
    pub target_language: String,
    pub confidence: f32,
    pub processing_time_ms: u64,
    pub model_used: String,
    pub model_version: String,
    pub character_count: usize,
    pub timestamp: DateTime<Utc>,
    pub offline_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageModel {
    pub from_language: String,
    pub to_language: String,
    pub model_name: String,
    pub model_version: String,
    pub model_size_mb: f32,
    pub download_url: Option<String>,
    pub local_path: Option<PathBuf>,
    pub is_installed: bool,
    pub last_used: Option<DateTime<Utc>>,
    pub usage_count: u64,
    pub accuracy_score: f32, // 0.0 - 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineTranslationConfig {
    pub enabled: bool,
    pub models_directory: PathBuf,
    pub auto_download_models: bool,
    pub max_model_cache_size_gb: f32,
    pub fallback_to_online: bool,
    pub preferred_model_quality: ModelQuality,
    pub supported_language_pairs: Vec<(String, String)>,
    pub model_cleanup_interval_hours: u64,
    pub preload_popular_models: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelQuality {
    Fast,    // Modelli più piccoli e veloci
    Balanced, // Bilanciamento tra velocità e qualità
    High,    // Modelli più grandi e accurati
}

impl Default for OfflineTranslationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            models_directory: PathBuf::from("./translation_models"),
            auto_download_models: true,
            max_model_cache_size_gb: 2.0,
            fallback_to_online: true,
            preferred_model_quality: ModelQuality::Balanced,
            supported_language_pairs: vec![
                ("en".to_string(), "it".to_string()),
                ("it".to_string(), "en".to_string()),
                ("en".to_string(), "fr".to_string()),
                ("fr".to_string(), "en".to_string()),
                ("en".to_string(), "de".to_string()),
                ("de".to_string(), "en".to_string()),
                ("en".to_string(), "es".to_string()),
                ("es".to_string(), "en".to_string()),
                ("en".to_string(), "ja".to_string()),
                ("ja".to_string(), "en".to_string()),
                ("en".to_string(), "ko".to_string()),
                ("ko".to_string(), "en".to_string()),
                ("en".to_string(), "zh".to_string()),
                ("zh".to_string(), "en".to_string()),
                ("en".to_string(), "ru".to_string()),
                ("ru".to_string(), "en".to_string()),
            ],
            model_cleanup_interval_hours: 24,
            preload_popular_models: true,
        }
    }
}

#[derive(Debug, Clone)]
struct ModelMetrics {
    pub total_translations: u64,
    pub successful_translations: u64,
    pub failed_translations: u64,
    pub average_processing_time: f32,
    pub average_confidence: f32,
    pub total_characters_processed: u64,
    pub last_used: Option<DateTime<Utc>>,
}

pub struct OfflineTranslationManager {
    config: OfflineTranslationConfig,
    available_models: Arc<Mutex<HashMap<String, LanguageModel>>>,
    loaded_models: Arc<Mutex<HashMap<String, Box<dyn ArgosTranslateModel>>>>,
    model_metrics: Arc<Mutex<HashMap<String, ModelMetrics>>>,
    translation_cache: Arc<Mutex<HashMap<String, OfflineTranslationResult>>>,
}

// Trait per astrazione modelli Argos Translate
trait ArgosTranslateModel: Send + Sync {
    fn translate(&self, text: &str) -> Result<String, String>;
    fn get_confidence(&self, text: &str, translation: &str) -> f32;
    fn get_model_info(&self) -> (String, String); // (name, version)
}

// Implementazione simulata di Argos Translate
struct SimulatedArgosModel {
    from_lang: String,
    to_lang: String,
    model_name: String,
    model_version: String,
}

impl ArgosTranslateModel for SimulatedArgosModel {
    fn translate(&self, text: &str) -> Result<String, String> {
        // Simula traduzione Argos Translate
        let translated = match (self.from_lang.as_str(), self.to_lang.as_str()) {
            ("en", "it") => format!("[Argos EN→IT] {}", text),
            ("it", "en") => format!("[Argos IT→EN] {}", text),
            ("en", "fr") => format!("[Argos EN→FR] {}", text),
            ("fr", "en") => format!("[Argos FR→EN] {}", text),
            ("en", "de") => format!("[Argos EN→DE] {}", text),
            ("de", "en") => format!("[Argos DE→EN] {}", text),
            ("en", "es") => format!("[Argos EN→ES] {}", text),
            ("es", "en") => format!("[Argos ES→EN] {}", text),
            ("en", "ja") => format!("[Argos EN→JA] {}", text),
            ("ja", "en") => format!("[Argos JA→EN] {}", text),
            ("en", "ko") => format!("[Argos EN→KO] {}", text),
            ("ko", "en") => format!("[Argos KO→EN] {}", text),
            ("en", "zh") => format!("[Argos EN→ZH] {}", text),
            ("zh", "en") => format!("[Argos ZH→EN] {}", text),
            ("en", "ru") => format!("[Argos EN→RU] {}", text),
            ("ru", "en") => format!("[Argos RU→EN] {}", text),
            _ => format!("[Argos {}→{}] {}", self.from_lang, self.to_lang, text),
        };
        
        // Simula tempo di processing
        std::thread::sleep(Duration::from_millis(50 + (text.len() as u64 * 2)));
        
        Ok(translated)
    }
    
    fn get_confidence(&self, text: &str, translation: &str) -> f32 {
        // Simula confidence basato su lunghezza e complessità
        let base_confidence = 0.75;
        let length_factor = if text.len() > 100 { -0.1 } else { 0.1 };
        let complexity_factor = if text.contains(&['.', '!', '?'][..]) { 0.05 } else { -0.05 };
        
        (base_confidence + length_factor + complexity_factor + (rand::random::<f32>() * 0.2 - 0.1))
            .max(0.0).min(1.0)
    }
    
    fn get_model_info(&self) -> (String, String) {
        (self.model_name.clone(), self.model_version.clone())
    }
}

impl OfflineTranslationManager {
    pub fn new(config: OfflineTranslationConfig) -> Result<Self, String> {
        // Crea directory modelli se non esiste
        if !config.models_directory.exists() {
            fs::create_dir_all(&config.models_directory)
                .map_err(|e| format!("Errore creazione directory modelli: {}", e))?;
        }
        
        let manager = Self {
            config,
            available_models: Arc::new(Mutex::new(HashMap::new())),
            loaded_models: Arc::new(Mutex::new(HashMap::new())),
            model_metrics: Arc::new(Mutex::new(HashMap::new())),
            translation_cache: Arc::new(Mutex::new(HashMap::new())),
        };
        
        // Inizializza modelli disponibili
        manager.initialize_available_models()?;
        
        Ok(manager)
    }
    
    /// Traduce testo usando modelli offline
    pub async fn translate_offline(
        &self,
        text: &str,
        source_lang: &str,
        target_lang: &str
    ) -> Result<OfflineTranslationResult, String> {
        let start_time = Instant::now();
        
        if !self.config.enabled {
            return Err("Traduzione offline disabilitata".to_string());
        }
        
        // Controlla cache prima
        let cache_key = format!("{}:{}:{}", source_lang, target_lang, text);
        if let Some(cached_result) = self.get_cached_translation(&cache_key) {
            return Ok(cached_result);
        }
        
        // Trova modello appropriato
        let model_key = format!("{}-{}", source_lang, target_lang);
        let model = self.get_or_load_model(&model_key).await?;
        
        // Esegui traduzione
        let translated_text = model.translate(text)
            .map_err(|e| format!("Errore traduzione: {}", e))?;
        
        let confidence = model.get_confidence(text, &translated_text);
        let (model_name, model_version) = model.get_model_info();
        
        let processing_time = start_time.elapsed().as_millis() as u64;
        
        let result = OfflineTranslationResult {
            translated_text,
            source_language: source_lang.to_string(),
            target_language: target_lang.to_string(),
            confidence,
            processing_time_ms: processing_time,
            model_used: model_name,
            model_version,
            character_count: text.len(),
            timestamp: Utc::now(),
            offline_mode: true,
        };
        
        // Salva in cache
        self.cache_translation(cache_key, &result);
        
        // Aggiorna metriche
        self.update_model_metrics(&model_key, &result, true);
        
        log::info!("🔄 Traduzione offline completata: {} caratteri in {}ms (Modello: {}, Confidence: {:.2})", 
            text.len(), processing_time, model_name, confidence);
        
        Ok(result)
    }
    
    /// Traduzione batch offline
    pub async fn translate_batch_offline(
        &self,
        texts: Vec<String>,
        source_lang: &str,
        target_lang: &str
    ) -> Result<Vec<OfflineTranslationResult>, String> {
        let mut results = Vec::new();
        
        for text in texts {
            match self.translate_offline(&text, source_lang, target_lang).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    log::warn!("❌ Errore traduzione batch offline: {}", e);
                    // Continua con le altre traduzioni
                }
            }
        }
        
        Ok(results)
    }
    
    /// Controlla se una coppia di lingue è supportata offline
    pub fn is_language_pair_supported(&self, source_lang: &str, target_lang: &str) -> bool {
        self.config.supported_language_pairs.contains(&(source_lang.to_string(), target_lang.to_string()))
    }
    
    /// Ottiene modelli disponibili
    pub fn get_available_models(&self) -> Result<Vec<LanguageModel>, String> {
        let models = self.available_models.lock()
            .map_err(|_| "Errore accesso modelli disponibili")?;
        
        Ok(models.values().cloned().collect())
    }
    
    /// Scarica e installa un modello
    pub async fn download_model(&self, from_lang: &str, to_lang: &str) -> Result<String, String> {
        let model_key = format!("{}-{}", from_lang, to_lang);
        
        log::info!("📥 Inizio download modello: {}", model_key);
        
        // Simula download modello
        tokio::time::sleep(Duration::from_millis(1000)).await;
        
        let model_path = self.config.models_directory.join(format!("{}.model", model_key));
        
        // Simula creazione file modello
        fs::write(&model_path, format!("Modello simulato per {}", model_key))
            .map_err(|e| format!("Errore salvataggio modello: {}", e))?;
        
        // Aggiorna modello disponibile
        let mut models = self.available_models.lock()
            .map_err(|_| "Errore accesso modelli")?;
        
        if let Some(model) = models.get_mut(&model_key) {
            model.local_path = Some(model_path);
            model.is_installed = true;
        }
        
        log::info!("✅ Modello {} scaricato e installato", model_key);
        Ok(format!("Modello {} installato con successo", model_key))
    }
    
    /// Rimuove un modello installato
    pub fn remove_model(&self, from_lang: &str, to_lang: &str) -> Result<String, String> {
        let model_key = format!("{}-{}", from_lang, to_lang);
        
        let mut models = self.available_models.lock()
            .map_err(|_| "Errore accesso modelli")?;
        
        if let Some(model) = models.get_mut(&model_key) {
            if let Some(path) = &model.local_path {
                if path.exists() {
                    fs::remove_file(path)
                        .map_err(|e| format!("Errore rimozione file modello: {}", e))?;
                }
            }
            
            model.local_path = None;
            model.is_installed = false;
            
            // Rimuovi da modelli caricati
            let mut loaded = self.loaded_models.lock()
                .map_err(|_| "Errore accesso modelli caricati")?;
            loaded.remove(&model_key);
            
            log::info!("🗑️ Modello {} rimosso", model_key);
            Ok(format!("Modello {} rimosso con successo", model_key))
        } else {
            Err(format!("Modello {} non trovato", model_key))
        }
    }
    
    /// Ottiene metriche dei modelli
    pub fn get_model_metrics(&self) -> Result<HashMap<String, ModelMetrics>, String> {
        self.model_metrics.lock()
            .map(|metrics| metrics.clone())
            .map_err(|_| "Errore accesso metriche modelli".to_string())
    }
    
    /// Pulisce cache traduzioni
    pub fn clear_translation_cache(&self) {
        if let Ok(mut cache) = self.translation_cache.lock() {
            cache.clear();
        }
    }
    
    /// Ottiene configurazione corrente
    pub fn get_config(&self) -> &OfflineTranslationConfig {
        &self.config
    }
    
    /// Aggiorna configurazione
    pub fn update_config(&mut self, new_config: OfflineTranslationConfig) {
        self.config = new_config;
    }
    
    /// Cleanup automatico modelli non utilizzati
    pub async fn cleanup_unused_models(&self) -> Result<String, String> {
        log::info!("🧹 Inizio cleanup modelli non utilizzati...");
        
        let mut removed_count = 0;
        let cutoff_time = Utc::now() - chrono::Duration::hours(self.config.model_cleanup_interval_hours as i64);
        
        let mut models = self.available_models.lock()
            .map_err(|_| "Errore accesso modelli")?;
        
        let models_to_remove: Vec<String> = models.iter()
            .filter(|(_, model)| {
                model.is_installed && 
                model.last_used.map_or(true, |last_used| last_used < cutoff_time) &&
                model.usage_count < 5 // Rimuovi solo modelli poco utilizzati
            })
            .map(|(key, _)| key.clone())
            .collect();
        
        for model_key in models_to_remove {
            if let Some(model) = models.get_mut(&model_key) {
                if let Some(path) = &model.local_path {
                    if path.exists() {
                        if let Err(e) = fs::remove_file(path) {
                            log::warn!("⚠️ Errore rimozione modello {}: {}", model_key, e);
                            continue;
                        }
                    }
                }
                
                model.local_path = None;
                model.is_installed = false;
                removed_count += 1;
                
                log::info!("🗑️ Modello {} rimosso durante cleanup", model_key);
            }
        }
        
        // Rimuovi da modelli caricati
        let mut loaded = self.loaded_models.lock()
            .map_err(|_| "Errore accesso modelli caricati")?;
        for model_key in &models_to_remove {
            loaded.remove(model_key);
        }
        
        log::info!("✅ Cleanup completato: {} modelli rimossi", removed_count);
        Ok(format!("Cleanup completato: {} modelli rimossi", removed_count))
    }
    
    /// Precarica modelli popolari
    pub async fn preload_popular_models(&self) -> Result<String, String> {
        if !self.config.preload_popular_models {
            return Ok("Preload modelli disabilitato".to_string());
        }
        
        log::info!("🚀 Preload modelli popolari...");
        
        // Modelli più comuni da precaricare
        let popular_pairs = vec![
            ("en", "it"),
            ("it", "en"),
            ("en", "fr"),
            ("en", "de"),
            ("en", "es"),
            ("en", "ja"),
        ];
        
        let mut loaded_count = 0;
        
        for (from_lang, to_lang) in popular_pairs {
            if self.is_language_pair_supported(from_lang, to_lang) {
                let model_key = format!("{}-{}", from_lang, to_lang);
                
                // Controlla se modello è installato
                let is_installed = {
                    let models = self.available_models.lock()
                        .map_err(|_| "Errore accesso modelli")?;
                    models.get(&model_key).map_or(false, |m| m.is_installed)
                };
                
                if !is_installed {
                    // Scarica modello se non installato
                    if let Err(e) = self.download_model(from_lang, to_lang).await {
                        log::warn!("⚠️ Errore download modello {}: {}", model_key, e);
                        continue;
                    }
                }
                
                // Carica modello in memoria
                if let Err(e) = self.get_or_load_model(&model_key).await {
                    log::warn!("⚠️ Errore caricamento modello {}: {}", model_key, e);
                    continue;
                }
                
                loaded_count += 1;
                log::info!("✅ Modello {} precaricato", model_key);
            }
        }
        
        log::info!("🎯 Preload completato: {} modelli caricati", loaded_count);
        Ok(format!("Preload completato: {} modelli caricati", loaded_count))
    }
    
    // === METODI PRIVATI ===
    
    fn initialize_available_models(&self) -> Result<(), String> {
        let mut models = self.available_models.lock()
            .map_err(|_| "Errore accesso modelli")?;
        
        // Inizializza modelli per tutte le coppie supportate
        for (from_lang, to_lang) in &self.config.supported_language_pairs {
            let model_key = format!("{}-{}", from_lang, to_lang);
            let model_path = self.config.models_directory.join(format!("{}.model", model_key));
            
            let model = LanguageModel {
                from_language: from_lang.clone(),
                to_language: to_lang.clone(),
                model_name: format!("argos-translate-{}-{}", from_lang, to_lang),
                model_version: "1.0.0".to_string(),
                model_size_mb: match self.config.preferred_model_quality {
                    ModelQuality::Fast => 25.0,
                    ModelQuality::Balanced => 50.0,
                    ModelQuality::High => 100.0,
                },
                download_url: Some(format!("https://github.com/argosopentech/argos-translate/releases/download/v1.0.0/{}.argosmodel", model_key)),
                local_path: if model_path.exists() { Some(model_path) } else { None },
                is_installed: model_path.exists(),
                last_used: None,
                usage_count: 0,
                accuracy_score: match self.config.preferred_model_quality {
                    ModelQuality::Fast => 0.75,
                    ModelQuality::Balanced => 0.85,
                    ModelQuality::High => 0.95,
                },
            };
            
            models.insert(model_key, model);
        }
        
        log::info!("📚 Inizializzati {} modelli disponibili", models.len());
        Ok(())
    }
    
    async fn get_or_load_model(&self, model_key: &str) -> Result<Box<dyn ArgosTranslateModel>, String> {
        // Controlla se modello è già caricato
        {
            let loaded = self.loaded_models.lock()
                .map_err(|_| "Errore accesso modelli caricati")?;
            
            if loaded.contains_key(model_key) {
                // Modello già caricato, ma non possiamo restituire reference
                // In una implementazione reale, useresti Arc<dyn ArgosTranslateModel>
            }
        }
        
        // Carica modello
        let models = self.available_models.lock()
            .map_err(|_| "Errore accesso modelli")?;
        
        let model_info = models.get(model_key)
            .ok_or_else(|| format!("Modello {} non trovato", model_key))?;
        
        if !model_info.is_installed {
            return Err(format!("Modello {} non installato", model_key));
        }
        
        // Crea modello simulato
        let parts: Vec<&str> = model_key.split('-').collect();
        if parts.len() != 2 {
            return Err(format!("Formato model_key non valido: {}", model_key));
        }
        
        let simulated_model = SimulatedArgosModel {
            from_lang: parts[0].to_string(),
            to_lang: parts[1].to_string(),
            model_name: model_info.model_name.clone(),
            model_version: model_info.model_version.clone(),
        };
        
        let boxed_model: Box<dyn ArgosTranslateModel> = Box::new(simulated_model);
        
        // Salva in cache modelli caricati
        let mut loaded = self.loaded_models.lock()
            .map_err(|_| "Errore accesso modelli caricati")?;
        // Non possiamo clonare il Box, quindi in una implementazione reale useresti Arc
        
        log::debug!("📦 Modello {} caricato in memoria", model_key);
        
        Ok(boxed_model)
    }
    
    fn get_cached_translation(&self, cache_key: &str) -> Option<OfflineTranslationResult> {
        if let Ok(cache) = self.translation_cache.lock() {
            cache.get(cache_key).cloned()
        } else {
            None
        }
    }
    
    fn cache_translation(&self, cache_key: String, result: &OfflineTranslationResult) {
        if let Ok(mut cache) = self.translation_cache.lock() {
            cache.insert(cache_key, result.clone());
        }
    }
    
    fn update_model_metrics(&self, model_key: &str, result: &OfflineTranslationResult, success: bool) {
        if let Ok(mut metrics) = self.model_metrics.lock() {
            let model_metrics = metrics.entry(model_key.to_string()).or_insert(ModelMetrics {
                total_translations: 0,
                successful_translations: 0,
                failed_translations: 0,
                average_processing_time: 0.0,
                average_confidence: 0.0,
                total_characters_processed: 0,
                last_used: None,
            });
            
            model_metrics.total_translations += 1;
            if success {
                model_metrics.successful_translations += 1;
            } else {
                model_metrics.failed_translations += 1;
            }
            
            // Aggiorna medie
            let total = model_metrics.total_translations as f32;
            model_metrics.average_processing_time = 
                (model_metrics.average_processing_time * (total - 1.0) + result.processing_time_ms as f32) / total;
            model_metrics.average_confidence = 
                (model_metrics.average_confidence * (total - 1.0) + result.confidence) / total;
            
            model_metrics.total_characters_processed += result.character_count as u64;
            model_metrics.last_used = Some(result.timestamp);
        }
        
        // Aggiorna anche last_used nel modello
        if let Ok(mut models) = self.available_models.lock() {
            if let Some(model) = models.get_mut(model_key) {
                model.last_used = Some(result.timestamp);
                model.usage_count += 1;
            }
        }
    }
}
