use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::path::Path;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResult {
    pub text: String,
    pub confidence: f32,
    pub engine: OCREngine,
    pub processing_time_ms: u64,
    pub bounding_boxes: Vec<BoundingBox>,
    pub language_detected: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub text: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OCREngine {
    Tesseract,
    WindowsOCR,
    EasyOCR,
    Combined, // Risultato combinato da più engine
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRConfig {
    pub enabled_engines: Vec<OCREngine>,
    pub tesseract_path: Option<String>,
    pub tesseract_data_path: Option<String>,
    pub supported_languages: Vec<String>,
    pub preprocessing_enabled: bool,
    pub parallel_processing: bool,
    pub confidence_threshold: f32,
    pub timeout_seconds: u64,
    pub ml_scoring_enabled: bool,
}

impl Default for OCRConfig {
    fn default() -> Self {
        Self {
            enabled_engines: vec![OCREngine::Tesseract, OCREngine::WindowsOCR],
            tesseract_path: None, // Auto-detect
            tesseract_data_path: None, // Auto-detect
            supported_languages: vec![
                "eng".to_string(), "ita".to_string(), "fra".to_string(), 
                "deu".to_string(), "spa".to_string(), "jpn".to_string(),
                "chi_sim".to_string(), "chi_tra".to_string(), "kor".to_string(),
                "rus".to_string(), "ara".to_string()
            ],
            preprocessing_enabled: true,
            parallel_processing: true,
            confidence_threshold: 0.6,
            timeout_seconds: 30,
            ml_scoring_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLScoringMetrics {
    pub text_coherence: f32,
    pub language_consistency: f32,
    pub character_accuracy: f32,
    pub word_completeness: f32,
    pub context_relevance: f32,
    pub final_score: f32,
}

pub struct AdvancedOCRProcessor {
    config: OCRConfig,
    results_cache: Arc<Mutex<HashMap<String, OCRResult>>>,
    ml_scorer: MLScorer,
    performance_metrics: Arc<Mutex<OCRPerformanceMetrics>>,
}

#[derive(Debug, Clone)]
struct OCRPerformanceMetrics {
    pub total_processed: u64,
    pub successful_extractions: u64,
    pub average_processing_time_ms: f32,
    pub engine_performance: HashMap<OCREngine, EngineMetrics>,
    pub cache_hit_rate: f32,
}

#[derive(Debug, Clone)]
struct EngineMetrics {
    pub processed_count: u64,
    pub success_rate: f32,
    pub average_confidence: f32,
    pub average_time_ms: f32,
}

struct MLScorer {
    language_models: HashMap<String, LanguageModel>,
    scoring_weights: ScoringWeights,
}

#[derive(Debug, Clone)]
struct LanguageModel {
    pub common_words: Vec<String>,
    pub character_frequency: HashMap<char, f32>,
    pub bigram_frequency: HashMap<String, f32>,
}

#[derive(Debug, Clone)]
struct ScoringWeights {
    pub text_coherence: f32,
    pub language_consistency: f32,
    pub character_accuracy: f32,
    pub word_completeness: f32,
    pub context_relevance: f32,
}

impl Default for ScoringWeights {
    fn default() -> Self {
        Self {
            text_coherence: 0.25,
            language_consistency: 0.20,
            character_accuracy: 0.20,
            word_completeness: 0.20,
            context_relevance: 0.15,
        }
    }
}

impl AdvancedOCRProcessor {
    pub fn new(config: OCRConfig) -> Self {
        let ml_scorer = MLScorer::new();
        
        Self {
            config,
            results_cache: Arc::new(Mutex::new(HashMap::new())),
            ml_scorer,
            performance_metrics: Arc::new(Mutex::new(OCRPerformanceMetrics {
                total_processed: 0,
                successful_extractions: 0,
                average_processing_time_ms: 0.0,
                engine_performance: HashMap::new(),
                cache_hit_rate: 0.0,
            })),
        }
    }

    /// Processa un'immagine con tutti i motori OCR abilitati
    pub async fn process_image(&self, image_path: &str, target_language: Option<&str>) -> Result<OCRResult, String> {
        let start_time = Instant::now();
        
        // Controlla cache prima
        let cache_key = format!("{}_{}", image_path, target_language.unwrap_or("auto"));
        if let Some(cached_result) = self.get_cached_result(&cache_key) {
            self.update_cache_metrics(true);
            return Ok(cached_result);
        }
        
        self.update_cache_metrics(false);
        
        // Preprocessing dell'immagine se abilitato
        let processed_image_path = if self.config.preprocessing_enabled {
            self.preprocess_image(image_path).await?
        } else {
            image_path.to_string()
        };

        // Esegui OCR con tutti i motori abilitati
        let mut results = Vec::new();
        
        if self.config.parallel_processing {
            // Processamento parallelo
            results = self.process_parallel(&processed_image_path, target_language).await?;
        } else {
            // Processamento sequenziale
            results = self.process_sequential(&processed_image_path, target_language).await?;
        }

        // Applica ML scoring se abilitato
        let best_result = if self.config.ml_scoring_enabled && results.len() > 1 {
            self.apply_ml_scoring(results, target_language).await?
        } else {
            // Seleziona il risultato con confidence più alta
            results.into_iter()
                .max_by(|a, b| a.confidence.partial_cmp(&b.confidence).unwrap())
                .ok_or("Nessun risultato OCR valido")?
        };

        // Aggiorna metriche performance
        let processing_time = start_time.elapsed().as_millis() as u64;
        self.update_performance_metrics(&best_result, processing_time);

        // Salva in cache
        self.cache_result(cache_key, &best_result);

        log::info!("🔍 OCR completato: {} caratteri estratti in {}ms (Engine: {:?}, Confidence: {:.2})", 
            best_result.text.len(), processing_time, best_result.engine, best_result.confidence);

        Ok(best_result)
    }

    /// Processamento parallelo con tutti i motori
    async fn process_parallel(&self, image_path: &str, target_language: Option<&str>) -> Result<Vec<OCRResult>, String> {
        let mut results = Vec::new();
        
        // Simula processamento parallelo (in produzione useresti tokio::spawn)
        for engine in &self.config.enabled_engines {
            match self.process_with_engine(engine, image_path, target_language).await {
                Ok(result) => results.push(result),
                Err(e) => log::warn!("❌ Errore engine {:?}: {}", engine, e),
            }
        }

        if results.is_empty() {
            return Err("Tutti i motori OCR hanno fallito".to_string());
        }

        Ok(results)
    }

    /// Processamento sequenziale con fallback
    async fn process_sequential(&self, image_path: &str, target_language: Option<&str>) -> Result<Vec<OCRResult>, String> {
        let mut results = Vec::new();
        
        for engine in &self.config.enabled_engines {
            match self.process_with_engine(engine, image_path, target_language).await {
                Ok(result) => {
                    results.push(result);
                    // Se il risultato è buono, possiamo fermarci
                    if results.last().unwrap().confidence > 0.8 {
                        break;
                    }
                },
                Err(e) => {
                    log::warn!("❌ Errore engine {:?}: {}", engine, e);
                    continue;
                }
            }
        }

        if results.is_empty() {
            return Err("Tutti i motori OCR hanno fallito".to_string());
        }

        Ok(results)
    }

    /// Processa con un singolo motore OCR
    async fn process_with_engine(&self, engine: &OCREngine, image_path: &str, target_language: Option<&str>) -> Result<OCRResult, String> {
        let start_time = Instant::now();
        
        let result = match engine {
            OCREngine::Tesseract => self.process_tesseract(image_path, target_language).await?,
            OCREngine::WindowsOCR => self.process_windows_ocr(image_path, target_language).await?,
            OCREngine::EasyOCR => self.process_easy_ocr(image_path, target_language).await?,
            OCREngine::Combined => return Err("Combined engine non supportato per processamento singolo".to_string()),
        };

        let processing_time = start_time.elapsed().as_millis() as u64;
        
        Ok(OCRResult {
            text: result.0,
            confidence: result.1,
            engine: engine.clone(),
            processing_time_ms: processing_time,
            bounding_boxes: result.2,
            language_detected: result.3,
            timestamp: Utc::now(),
        })
    }

    /// Processamento con Tesseract OCR
    async fn process_tesseract(&self, image_path: &str, target_language: Option<&str>) -> Result<(String, f32, Vec<BoundingBox>, Option<String>), String> {
        // Simula processamento Tesseract
        // In produzione useresti la libreria tesseract-rs o chiamate al binario
        
        let lang = target_language.unwrap_or("eng");
        
        // Simula estrazione testo con bounding boxes
        let text = format!("Testo estratto da Tesseract per {}", image_path);
        let confidence = 0.75 + (rand::random::<f32>() * 0.2); // 0.75-0.95
        
        let bounding_boxes = vec![
            BoundingBox {
                x: 10, y: 10, width: 200, height: 30,
                text: "Testo estratto".to_string(),
                confidence: confidence,
            },
            BoundingBox {
                x: 10, y: 50, width: 150, height: 30,
                text: "da Tesseract".to_string(),
                confidence: confidence - 0.1,
            },
        ];

        log::debug!("🔤 Tesseract: {} caratteri estratti (confidence: {:.2})", text.len(), confidence);
        
        Ok((text, confidence, bounding_boxes, Some(lang.to_string())))
    }

    /// Processamento con Windows OCR
    async fn process_windows_ocr(&self, image_path: &str, target_language: Option<&str>) -> Result<(String, f32, Vec<BoundingBox>, Option<String>), String> {
        // Simula processamento Windows OCR
        // In produzione useresti le API Windows.Media.Ocr
        
        let text = format!("Testo estratto da Windows OCR per {}", image_path);
        let confidence = 0.80 + (rand::random::<f32>() * 0.15); // 0.80-0.95
        
        let bounding_boxes = vec![
            BoundingBox {
                x: 12, y: 12, width: 195, height: 28,
                text: "Testo estratto da".to_string(),
                confidence: confidence,
            },
            BoundingBox {
                x: 12, y: 48, width: 140, height: 28,
                text: "Windows OCR".to_string(),
                confidence: confidence - 0.05,
            },
        ];

        log::debug!("🪟 Windows OCR: {} caratteri estratti (confidence: {:.2})", text.len(), confidence);
        
        Ok((text, confidence, bounding_boxes, Some("auto".to_string())))
    }

    /// Processamento con EasyOCR
    async fn process_easy_ocr(&self, image_path: &str, target_language: Option<&str>) -> Result<(String, f32, Vec<BoundingBox>, Option<String>), String> {
        // Simula processamento EasyOCR
        // In produzione useresti easyocr-rs o chiamate Python
        
        let text = format!("Testo estratto da EasyOCR per {}", image_path);
        let confidence = 0.85 + (rand::random::<f32>() * 0.1); // 0.85-0.95
        
        let bounding_boxes = vec![
            BoundingBox {
                x: 8, y: 8, width: 205, height: 32,
                text: "Testo estratto da EasyOCR".to_string(),
                confidence: confidence,
            },
        ];

        log::debug!("🤖 EasyOCR: {} caratteri estratti (confidence: {:.2})", text.len(), confidence);
        
        Ok((text, confidence, bounding_boxes, Some("multi".to_string())))
    }

    /// Applica ML scoring per selezionare il miglior risultato
    async fn apply_ml_scoring(&self, results: Vec<OCRResult>, target_language: Option<&str>) -> Result<OCRResult, String> {
        let mut scored_results = Vec::new();
        
        for result in results {
            let ml_metrics = self.ml_scorer.score_result(&result, target_language);
            scored_results.push((result, ml_metrics));
        }

        // Seleziona il risultato con il punteggio ML più alto
        let best_result = scored_results.into_iter()
            .max_by(|a, b| a.1.final_score.partial_cmp(&b.1.final_score).unwrap())
            .ok_or("Nessun risultato valido dopo ML scoring")?;

        log::info!("🧠 ML Scoring: Miglior risultato da {:?} (Score: {:.3})", 
            best_result.0.engine, best_result.1.final_score);

        // Crea risultato combinato se il punteggio è significativamente migliore
        let mut final_result = best_result.0;
        if best_result.1.final_score > 0.8 {
            final_result.engine = OCREngine::Combined;
            final_result.confidence = best_result.1.final_score;
        }

        Ok(final_result)
    }

    /// Preprocessing dell'immagine per migliorare OCR
    async fn preprocess_image(&self, image_path: &str) -> Result<String, String> {
        // Simula preprocessing (in produzione useresti image-rs o opencv)
        let processed_path = format!("{}_processed.png", image_path);
        
        // Simula operazioni di preprocessing:
        // - Ridimensionamento
        // - Conversione grayscale
        // - Miglioramento contrasto
        // - Riduzione rumore
        // - Binarizzazione
        
        log::debug!("🔧 Preprocessing immagine: {} -> {}", image_path, processed_path);
        
        Ok(processed_path)
    }

    /// Ottiene risultato dalla cache
    fn get_cached_result(&self, cache_key: &str) -> Option<OCRResult> {
        if let Ok(cache) = self.results_cache.lock() {
            cache.get(cache_key).cloned()
        } else {
            None
        }
    }

    /// Salva risultato in cache
    fn cache_result(&self, cache_key: String, result: &OCRResult) {
        if let Ok(mut cache) = self.results_cache.lock() {
            cache.insert(cache_key, result.clone());
        }
    }

    /// Aggiorna metriche performance
    fn update_performance_metrics(&self, result: &OCRResult, processing_time: u64) {
        if let Ok(mut metrics) = self.performance_metrics.lock() {
            metrics.total_processed += 1;
            
            if result.confidence > self.config.confidence_threshold {
                metrics.successful_extractions += 1;
            }

            // Aggiorna media tempo processamento
            let total_time = metrics.average_processing_time_ms * (metrics.total_processed - 1) as f32 + processing_time as f32;
            metrics.average_processing_time_ms = total_time / metrics.total_processed as f32;

            // Aggiorna metriche per engine
            let engine_metrics = metrics.engine_performance.entry(result.engine.clone()).or_insert(EngineMetrics {
                processed_count: 0,
                success_rate: 0.0,
                average_confidence: 0.0,
                average_time_ms: 0.0,
            });

            engine_metrics.processed_count += 1;
            engine_metrics.success_rate = if result.confidence > self.config.confidence_threshold {
                (engine_metrics.success_rate * (engine_metrics.processed_count - 1) as f32 + 1.0) / engine_metrics.processed_count as f32
            } else {
                (engine_metrics.success_rate * (engine_metrics.processed_count - 1) as f32) / engine_metrics.processed_count as f32
            };

            let total_confidence = engine_metrics.average_confidence * (engine_metrics.processed_count - 1) as f32 + result.confidence;
            engine_metrics.average_confidence = total_confidence / engine_metrics.processed_count as f32;

            let total_time = engine_metrics.average_time_ms * (engine_metrics.processed_count - 1) as f32 + processing_time as f32;
            engine_metrics.average_time_ms = total_time / engine_metrics.processed_count as f32;
        }
    }

    /// Aggiorna metriche cache
    fn update_cache_metrics(&self, is_hit: bool) {
        if let Ok(mut metrics) = self.performance_metrics.lock() {
            let current_rate = metrics.cache_hit_rate;
            let total_requests = metrics.total_processed + 1;
            
            if is_hit {
                metrics.cache_hit_rate = (current_rate * (total_requests - 1) as f32 + 1.0) / total_requests as f32;
            } else {
                metrics.cache_hit_rate = (current_rate * (total_requests - 1) as f32) / total_requests as f32;
            }
        }
    }

    /// Ottiene metriche performance
    pub fn get_performance_metrics(&self) -> Result<OCRPerformanceMetrics, String> {
        self.performance_metrics.lock()
            .map(|metrics| metrics.clone())
            .map_err(|_| "Errore accesso metriche".to_string())
    }

    /// Pulisce cache
    pub fn clear_cache(&self) {
        if let Ok(mut cache) = self.results_cache.lock() {
            cache.clear();
        }
    }
}

impl MLScorer {
    fn new() -> Self {
        Self {
            language_models: Self::initialize_language_models(),
            scoring_weights: ScoringWeights::default(),
        }
    }

    fn initialize_language_models() -> HashMap<String, LanguageModel> {
        let mut models = HashMap::new();
        
        // Modello inglese semplificato
        models.insert("eng".to_string(), LanguageModel {
            common_words: vec![
                "the".to_string(), "and".to_string(), "you".to_string(), "that".to_string(),
                "was".to_string(), "for".to_string(), "are".to_string(), "with".to_string(),
                "his".to_string(), "they".to_string(), "have".to_string(), "this".to_string(),
            ],
            character_frequency: [
                ('e', 0.127), ('t', 0.091), ('a', 0.082), ('o', 0.075), ('i', 0.070),
                ('n', 0.067), ('s', 0.063), ('h', 0.061), ('r', 0.060), ('d', 0.043),
            ].iter().cloned().collect(),
            bigram_frequency: [
                ("th".to_string(), 0.031), ("he".to_string(), 0.028), ("in".to_string(), 0.022),
                ("er".to_string(), 0.020), ("an".to_string(), 0.019), ("re".to_string(), 0.018),
            ].iter().cloned().collect(),
        });

        // Modello italiano semplificato
        models.insert("ita".to_string(), LanguageModel {
            common_words: vec![
                "che".to_string(), "per".to_string(), "una".to_string(), "con".to_string(),
                "non".to_string(), "del".to_string(), "alla".to_string(), "nel".to_string(),
                "anche".to_string(), "come".to_string(), "più".to_string(), "tutto".to_string(),
            ],
            character_frequency: [
                ('e', 0.118), ('a', 0.117), ('i', 0.111), ('o', 0.098), ('n', 0.069),
                ('t', 0.056), ('r', 0.055), ('l', 0.051), ('s', 0.050), ('c', 0.045),
            ].iter().cloned().collect(),
            bigram_frequency: [
                ("ch".to_string(), 0.025), ("he".to_string(), 0.023), ("er".to_string(), 0.021),
                ("re".to_string(), 0.020), ("an".to_string(), 0.019), ("in".to_string(), 0.018),
            ].iter().cloned().collect(),
        });

        models
    }

    fn score_result(&self, result: &OCRResult, target_language: Option<&str>) -> MLScoringMetrics {
        let text = &result.text;
        let lang = target_language.unwrap_or("eng");
        
        let text_coherence = self.calculate_text_coherence(text, lang);
        let language_consistency = self.calculate_language_consistency(text, lang);
        let character_accuracy = self.calculate_character_accuracy(text, lang);
        let word_completeness = self.calculate_word_completeness(text, lang);
        let context_relevance = self.calculate_context_relevance(text, lang);

        let final_score = 
            text_coherence * self.scoring_weights.text_coherence +
            language_consistency * self.scoring_weights.language_consistency +
            character_accuracy * self.scoring_weights.character_accuracy +
            word_completeness * self.scoring_weights.word_completeness +
            context_relevance * self.scoring_weights.context_relevance;

        MLScoringMetrics {
            text_coherence,
            language_consistency,
            character_accuracy,
            word_completeness,
            context_relevance,
            final_score,
        }
    }

    fn calculate_text_coherence(&self, text: &str, lang: &str) -> f32 {
        // Calcola coerenza del testo basata su bigram e struttura
        if let Some(model) = self.language_models.get(lang) {
            let words: Vec<&str> = text.split_whitespace().collect();
            if words.len() < 2 { return 0.5; }

            let mut coherence_score = 0.0;
            let mut total_bigrams = 0;

            for i in 0..words.len()-1 {
                let bigram = format!("{}{}", 
                    words[i].chars().last().unwrap_or(' '),
                    words[i+1].chars().next().unwrap_or(' ')
                );
                
                if model.bigram_frequency.contains_key(&bigram) {
                    coherence_score += model.bigram_frequency[&bigram];
                }
                total_bigrams += 1;
            }

            if total_bigrams > 0 {
                coherence_score / total_bigrams as f32
            } else {
                0.5
            }
        } else {
            0.5 // Lingua non supportata
        }
    }

    fn calculate_language_consistency(&self, text: &str, lang: &str) -> f32 {
        // Verifica consistenza con il modello linguistico
        if let Some(model) = self.language_models.get(lang) {
            let words: Vec<&str> = text.split_whitespace().collect();
            let common_words_found = words.iter()
                .filter(|word| model.common_words.contains(&word.to_lowercase()))
                .count();

            if words.len() > 0 {
                common_words_found as f32 / words.len() as f32
            } else {
                0.0
            }
        } else {
            0.5
        }
    }

    fn calculate_character_accuracy(&self, text: &str, lang: &str) -> f32 {
        // Verifica accuratezza caratteri basata su frequenza
        if let Some(model) = self.language_models.get(lang) {
            let mut accuracy_score = 0.0;
            let mut total_chars = 0;

            for ch in text.chars() {
                if ch.is_alphabetic() {
                    let ch_lower = ch.to_lowercase().next().unwrap_or(ch);
                    if let Some(expected_freq) = model.character_frequency.get(&ch_lower) {
                        accuracy_score += expected_freq;
                    }
                    total_chars += 1;
                }
            }

            if total_chars > 0 {
                (accuracy_score / total_chars as f32).min(1.0)
            } else {
                0.0
            }
        } else {
            0.5
        }
    }

    fn calculate_word_completeness(&self, text: &str, _lang: &str) -> f32 {
        // Verifica completezza parole (poche parole troncate/incomplete)
        let words: Vec<&str> = text.split_whitespace().collect();
        if words.is_empty() { return 0.0; }

        let complete_words = words.iter()
            .filter(|word| {
                word.len() > 1 && 
                word.chars().all(|c| c.is_alphabetic() || c.is_numeric() || ".,!?;:".contains(c))
            })
            .count();

        complete_words as f32 / words.len() as f32
    }

    fn calculate_context_relevance(&self, text: &str, _lang: &str) -> f32 {
        // Calcola rilevanza contestuale (per ora semplificato)
        let has_punctuation = text.chars().any(|c| ".,!?;:".contains(c));
        let has_mixed_case = text.chars().any(|c| c.is_uppercase()) && text.chars().any(|c| c.is_lowercase());
        let reasonable_length = text.len() > 5 && text.len() < 1000;

        let mut score = 0.0;
        if has_punctuation { score += 0.3; }
        if has_mixed_case { score += 0.3; }
        if reasonable_length { score += 0.4; }

        score
    }
}
