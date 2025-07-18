use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use std::fs::{File, OpenOptions};
use std::io::{Write, BufWriter};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationLogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub game_name: String,
    pub source_text: String,
    pub translated_text: String,
    pub source_language: String,
    pub target_language: String,
    pub translation_method: TranslationMethod,
    pub confidence_score: f32,
    pub processing_time_ms: u64,
    pub context: TranslationContext,
    pub quality_metrics: QualityMetrics,
    pub human_feedback: Option<HumanFeedback>,
    pub corrections: Vec<TranslationCorrection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TranslationMethod {
    OCR { engine: String, preprocessing: Vec<String> },
    Online { backend: String, fallback_used: bool },
    Offline { model: String, model_version: String },
    Hybrid { primary: String, fallback: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationContext {
    pub ui_element_type: String, // dialog, menu, subtitle, etc.
    pub screen_position: Option<(u32, u32)>,
    pub surrounding_text: Option<String>,
    pub game_state: Option<String>,
    pub character_speaking: Option<String>,
    pub scene_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityMetrics {
    pub fluency_score: f32,
    pub accuracy_score: f32,
    pub context_relevance: f32,
    pub grammar_score: f32,
    pub terminology_consistency: f32,
    pub readability_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HumanFeedback {
    pub translator_id: String,
    pub rating: u8, // 1-5 stars
    pub feedback_text: Option<String>,
    pub improvement_suggestions: Vec<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationCorrection {
    pub original_text: String,
    pub corrected_text: String,
    pub correction_type: CorrectionType,
    pub reason: String,
    pub corrector_id: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CorrectionType {
    Grammar,
    Terminology,
    Context,
    Fluency,
    Accuracy,
    Style,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationLoggerConfig {
    pub enabled: bool,
    pub log_directory: PathBuf,
    pub max_log_file_size_mb: u64,
    pub max_log_files: u32,
    pub log_format: LogFormat,
    pub include_screenshots: bool,
    pub auto_export_interval_hours: u64,
    pub quality_threshold_for_review: f32,
    pub export_formats: Vec<ExportFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogFormat {
    JSON,
    CSV,
    XML,
    TMX, // Translation Memory eXchange
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    CSV,
    Excel,
    TMX,
    XLIFF, // XML Localization Interchange File Format
    JSON,
}

impl Default for TranslationLoggerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            log_directory: PathBuf::from("./translation_logs"),
            max_log_file_size_mb: 100,
            max_log_files: 50,
            log_format: LogFormat::JSON,
            include_screenshots: true,
            auto_export_interval_hours: 24,
            quality_threshold_for_review: 0.7,
            export_formats: vec![ExportFormat::CSV, ExportFormat::TMX],
        }
    }
}

pub struct TranslationLogger {
    config: TranslationLoggerConfig,
    log_entries: Arc<Mutex<Vec<TranslationLogEntry>>>,
    current_log_file: Arc<Mutex<Option<BufWriter<File>>>>,
    statistics: Arc<Mutex<LoggerStatistics>>,
}

#[derive(Debug, Clone)]
struct LoggerStatistics {
    pub total_translations: u64,
    pub translations_by_method: HashMap<String, u64>,
    pub translations_by_language: HashMap<String, u64>,
    pub average_quality_score: f32,
    pub corrections_count: u64,
    pub human_feedback_count: u64,
    pub low_quality_translations: u64,
}

impl TranslationLogger {
    pub fn new(config: TranslationLoggerConfig) -> Result<Self, String> {
        // Crea directory log se non esiste
        if !config.log_directory.exists() {
            std::fs::create_dir_all(&config.log_directory)
                .map_err(|e| format!("Errore creazione directory log: {}", e))?;
        }

        let logger = Self {
            config,
            log_entries: Arc::new(Mutex::new(Vec::new())),
            current_log_file: Arc::new(Mutex::new(None)),
            statistics: Arc::new(Mutex::new(LoggerStatistics {
                total_translations: 0,
                translations_by_method: HashMap::new(),
                translations_by_language: HashMap::new(),
                average_quality_score: 0.0,
                corrections_count: 0,
                human_feedback_count: 0,
                low_quality_translations: 0,
            })),
        };

        // Inizializza file di log
        logger.initialize_log_file()?;

        Ok(logger)
    }

    /// Registra una nuova traduzione
    pub fn log_translation(&self, entry: TranslationLogEntry) -> Result<(), String> {
        if !self.config.enabled {
            return Ok(());
        }

        // Aggiorna statistiche
        self.update_statistics(&entry);

        // Salva in memoria
        {
            let mut entries = self.log_entries.lock()
                .map_err(|_| "Errore accesso log entries")?;
            entries.push(entry.clone());
        }

        // Scrivi su file
        self.write_to_file(&entry)?;

        log::info!("📝 Traduzione registrata: {} -> {} (ID: {})", 
            entry.source_language, entry.target_language, entry.id);

        Ok(())
    }

    /// Aggiunge feedback umano a una traduzione
    pub fn add_human_feedback(&self, entry_id: &str, feedback: HumanFeedback) -> Result<(), String> {
        let mut entries = self.log_entries.lock()
            .map_err(|_| "Errore accesso log entries")?;

        if let Some(entry) = entries.iter_mut().find(|e| e.id == entry_id) {
            entry.human_feedback = Some(feedback);
            
            // Aggiorna statistiche
            let mut stats = self.statistics.lock()
                .map_err(|_| "Errore accesso statistiche")?;
            stats.human_feedback_count += 1;

            log::info!("💬 Feedback umano aggiunto per traduzione: {}", entry_id);
            Ok(())
        } else {
            Err(format!("Traduzione con ID {} non trovata", entry_id))
        }
    }

    /// Aggiunge correzione a una traduzione
    pub fn add_correction(&self, entry_id: &str, correction: TranslationCorrection) -> Result<(), String> {
        let mut entries = self.log_entries.lock()
            .map_err(|_| "Errore accesso log entries")?;

        if let Some(entry) = entries.iter_mut().find(|e| e.id == entry_id) {
            entry.corrections.push(correction);
            
            // Aggiorna statistiche
            let mut stats = self.statistics.lock()
                .map_err(|_| "Errore accesso statistiche")?;
            stats.corrections_count += 1;

            log::info!("✏️ Correzione aggiunta per traduzione: {}", entry_id);
            Ok(())
        } else {
            Err(format!("Traduzione con ID {} non trovata", entry_id))
        }
    }

    /// Esporta log in formato specificato
    pub fn export_logs(&self, format: ExportFormat, output_path: &str) -> Result<String, String> {
        let entries = self.log_entries.lock()
            .map_err(|_| "Errore accesso log entries")?;

        match format {
            ExportFormat::CSV => self.export_to_csv(&entries, output_path),
            ExportFormat::JSON => self.export_to_json(&entries, output_path),
            ExportFormat::TMX => self.export_to_tmx(&entries, output_path),
            ExportFormat::XLIFF => self.export_to_xliff(&entries, output_path),
            ExportFormat::Excel => self.export_to_excel(&entries, output_path),
        }
    }

    /// Ottiene statistiche del logger
    pub fn get_statistics(&self) -> Result<LoggerStatistics, String> {
        self.statistics.lock()
            .map(|stats| stats.clone())
            .map_err(|_| "Errore accesso statistiche".to_string())
    }

    /// Ottiene traduzioni che necessitano revisione
    pub fn get_translations_for_review(&self) -> Result<Vec<TranslationLogEntry>, String> {
        let entries = self.log_entries.lock()
            .map_err(|_| "Errore accesso log entries")?;

        let threshold = self.config.quality_threshold_for_review;
        let review_entries: Vec<TranslationLogEntry> = entries.iter()
            .filter(|entry| {
                let avg_quality = (entry.quality_metrics.fluency_score + 
                                 entry.quality_metrics.accuracy_score + 
                                 entry.quality_metrics.context_relevance) / 3.0;
                avg_quality < threshold || entry.human_feedback.is_none()
            })
            .cloned()
            .collect();

        Ok(review_entries)
    }

    /// Genera report di analisi qualità
    pub fn generate_quality_report(&self) -> Result<QualityReport, String> {
        let entries = self.log_entries.lock()
            .map_err(|_| "Errore accesso log entries")?;
        let stats = self.get_statistics()?;

        let mut method_quality = HashMap::new();
        let mut language_quality = HashMap::new();
        let mut common_issues = HashMap::new();

        for entry in entries.iter() {
            // Analizza qualità per metodo
            let method_key = match &entry.translation_method {
                TranslationMethod::OCR { engine, .. } => format!("OCR-{}", engine),
                TranslationMethod::Online { backend, .. } => format!("Online-{}", backend),
                TranslationMethod::Offline { model, .. } => format!("Offline-{}", model),
                TranslationMethod::Hybrid { primary, .. } => format!("Hybrid-{}", primary),
            };

            let avg_quality = (entry.quality_metrics.fluency_score + 
                             entry.quality_metrics.accuracy_score + 
                             entry.quality_metrics.context_relevance) / 3.0;

            method_quality.entry(method_key).or_insert(Vec::new()).push(avg_quality);

            // Analizza qualità per lingua
            let lang_pair = format!("{}-{}", entry.source_language, entry.target_language);
            language_quality.entry(lang_pair).or_insert(Vec::new()).push(avg_quality);

            // Analizza problemi comuni
            for correction in &entry.corrections {
                let issue_key = format!("{:?}", correction.correction_type);
                *common_issues.entry(issue_key).or_insert(0) += 1;
            }
        }

        Ok(QualityReport {
            total_translations: stats.total_translations,
            average_quality_score: stats.average_quality_score,
            method_quality_scores: method_quality.into_iter()
                .map(|(k, v)| (k, v.iter().sum::<f32>() / v.len() as f32))
                .collect(),
            language_quality_scores: language_quality.into_iter()
                .map(|(k, v)| (k, v.iter().sum::<f32>() / v.len() as f32))
                .collect(),
            common_issues,
            corrections_count: stats.corrections_count,
            human_feedback_count: stats.human_feedback_count,
            low_quality_count: stats.low_quality_translations,
        })
    }

    // === METODI PRIVATI ===

    fn initialize_log_file(&self) -> Result<(), String> {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("translation_log_{}.json", timestamp);
        let filepath = self.config.log_directory.join(filename);

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&filepath)
            .map_err(|e| format!("Errore apertura file log: {}", e))?;

        let writer = BufWriter::new(file);
        
        let mut current_file = self.current_log_file.lock()
            .map_err(|_| "Errore accesso file log")?;
        *current_file = Some(writer);

        Ok(())
    }

    fn write_to_file(&self, entry: &TranslationLogEntry) -> Result<(), String> {
        let mut file_guard = self.current_log_file.lock()
            .map_err(|_| "Errore accesso file log")?;

        if let Some(ref mut writer) = *file_guard {
            let json_line = serde_json::to_string(entry)
                .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;
            
            writeln!(writer, "{}", json_line)
                .map_err(|e| format!("Errore scrittura file: {}", e))?;
            
            writer.flush()
                .map_err(|e| format!("Errore flush file: {}", e))?;
        }

        Ok(())
    }

    fn update_statistics(&self, entry: &TranslationLogEntry) {
        if let Ok(mut stats) = self.statistics.lock() {
            stats.total_translations += 1;

            // Aggiorna contatori per metodo
            let method_key = match &entry.translation_method {
                TranslationMethod::OCR { engine, .. } => format!("OCR-{}", engine),
                TranslationMethod::Online { backend, .. } => format!("Online-{}", backend),
                TranslationMethod::Offline { model, .. } => format!("Offline-{}", model),
                TranslationMethod::Hybrid { primary, .. } => format!("Hybrid-{}", primary),
            };
            *stats.translations_by_method.entry(method_key).or_insert(0) += 1;

            // Aggiorna contatori per lingua
            let lang_pair = format!("{}-{}", entry.source_language, entry.target_language);
            *stats.translations_by_language.entry(lang_pair).or_insert(0) += 1;

            // Aggiorna qualità media
            let avg_quality = (entry.quality_metrics.fluency_score + 
                             entry.quality_metrics.accuracy_score + 
                             entry.quality_metrics.context_relevance) / 3.0;
            
            let total = stats.total_translations as f32;
            stats.average_quality_score = (stats.average_quality_score * (total - 1.0) + avg_quality) / total;

            // Conta traduzioni di bassa qualità
            if avg_quality < self.config.quality_threshold_for_review {
                stats.low_quality_translations += 1;
            }
        }
    }

    fn export_to_csv(&self, entries: &[TranslationLogEntry], output_path: &str) -> Result<String, String> {
        let mut csv_content = String::new();
        csv_content.push_str("ID,Timestamp,Game,Source Text,Translated Text,Source Lang,Target Lang,Method,Confidence,Quality Score\n");

        for entry in entries {
            let avg_quality = (entry.quality_metrics.fluency_score + 
                             entry.quality_metrics.accuracy_score + 
                             entry.quality_metrics.context_relevance) / 3.0;
            
            csv_content.push_str(&format!(
                "{},{},{},{},{},{},{},{},{:.2},{:.2}\n",
                entry.id,
                entry.timestamp.to_rfc3339(),
                entry.game_name,
                entry.source_text.replace(',', ';'),
                entry.translated_text.replace(',', ';'),
                entry.source_language,
                entry.target_language,
                format!("{:?}", entry.translation_method).replace(',', ';'),
                entry.confidence_score,
                avg_quality
            ));
        }

        std::fs::write(output_path, csv_content)
            .map_err(|e| format!("Errore scrittura CSV: {}", e))?;

        Ok(format!("Esportate {} traduzioni in CSV", entries.len()))
    }

    fn export_to_json(&self, entries: &[TranslationLogEntry], output_path: &str) -> Result<String, String> {
        let json_content = serde_json::to_string_pretty(entries)
            .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;

        std::fs::write(output_path, json_content)
            .map_err(|e| format!("Errore scrittura JSON: {}", e))?;

        Ok(format!("Esportate {} traduzioni in JSON", entries.len()))
    }

    fn export_to_tmx(&self, entries: &[TranslationLogEntry], output_path: &str) -> Result<String, String> {
        let mut tmx_content = String::new();
        tmx_content.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        tmx_content.push_str("<tmx version=\"1.4\">\n");
        tmx_content.push_str("<header>\n");
        tmx_content.push_str("<prop type=\"x-filename\">GameStringer_Translation_Memory.tmx</prop>\n");
        tmx_content.push_str("</header>\n");
        tmx_content.push_str("<body>\n");

        for entry in entries {
            tmx_content.push_str(&format!(
                "<tu tuid=\"{}\">\n",
                entry.id
            ));
            tmx_content.push_str(&format!(
                "<tuv xml:lang=\"{}\">\n<seg>{}</seg>\n</tuv>\n",
                entry.source_language,
                entry.source_text
            ));
            tmx_content.push_str(&format!(
                "<tuv xml:lang=\"{}\">\n<seg>{}</seg>\n</tuv>\n",
                entry.target_language,
                entry.translated_text
            ));
            tmx_content.push_str("</tu>\n");
        }

        tmx_content.push_str("</body>\n");
        tmx_content.push_str("</tmx>\n");

        std::fs::write(output_path, tmx_content)
            .map_err(|e| format!("Errore scrittura TMX: {}", e))?;

        Ok(format!("Esportate {} traduzioni in TMX", entries.len()))
    }

    fn export_to_xliff(&self, entries: &[TranslationLogEntry], output_path: &str) -> Result<String, String> {
        // Implementazione semplificata XLIFF
        let mut xliff_content = String::new();
        xliff_content.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xliff_content.push_str("<xliff version=\"1.2\">\n");
        xliff_content.push_str("<file original=\"GameStringer\" datatype=\"plaintext\">\n");
        xliff_content.push_str("<body>\n");

        for entry in entries {
            xliff_content.push_str(&format!(
                "<trans-unit id=\"{}\">\n",
                entry.id
            ));
            xliff_content.push_str(&format!(
                "<source xml:lang=\"{}\">{}</source>\n",
                entry.source_language,
                entry.source_text
            ));
            xliff_content.push_str(&format!(
                "<target xml:lang=\"{}\">{}</target>\n",
                entry.target_language,
                entry.translated_text
            ));
            xliff_content.push_str("</trans-unit>\n");
        }

        xliff_content.push_str("</body>\n");
        xliff_content.push_str("</file>\n");
        xliff_content.push_str("</xliff>\n");

        std::fs::write(output_path, xliff_content)
            .map_err(|e| format!("Errore scrittura XLIFF: {}", e))?;

        Ok(format!("Esportate {} traduzioni in XLIFF", entries.len()))
    }

    fn export_to_excel(&self, _entries: &[TranslationLogEntry], _output_path: &str) -> Result<String, String> {
        // Implementazione semplificata - in produzione useresti una libreria Excel
        Err("Esportazione Excel non ancora implementata".to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityReport {
    pub total_translations: u64,
    pub average_quality_score: f32,
    pub method_quality_scores: HashMap<String, f32>,
    pub language_quality_scores: HashMap<String, f32>,
    pub common_issues: HashMap<String, u32>,
    pub corrections_count: u64,
    pub human_feedback_count: u64,
    pub low_quality_count: u64,
}
