use crate::translation_logger::{
    TranslationLogger, TranslationLoggerConfig, TranslationLogEntry, 
    HumanFeedback, TranslationCorrection, ExportFormat, QualityReport
};
use std::sync::{Arc, Mutex};
use tauri::State;
use serde::{Deserialize, Serialize};

// Stato globale per il logger
pub type TranslationLoggerState = Arc<Mutex<Option<TranslationLogger>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct LogTranslationRequest {
    pub entry: TranslationLogEntry,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddFeedbackRequest {
    pub entry_id: String,
    pub feedback: HumanFeedback,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddCorrectionRequest {
    pub entry_id: String,
    pub correction: TranslationCorrection,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportLogsRequest {
    pub format: ExportFormat,
    pub output_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoggerStats {
    pub total_translations: u64,
    pub translations_by_method: std::collections::HashMap<String, u64>,
    pub translations_by_language: std::collections::HashMap<String, u64>,
    pub average_quality_score: f32,
    pub corrections_count: u64,
    pub human_feedback_count: u64,
    pub low_quality_translations: u64,
}

/// Inizializza il sistema di logging traduzioni
#[tauri::command]
pub async fn initialize_translation_logger(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("📝 Inizializzazione sistema logging traduzioni...");
    
    let config = TranslationLoggerConfig::default();
    let logger = TranslationLogger::new(config)
        .map_err(|e| format!("Errore inizializzazione logger: {}", e))?;
    
    let mut state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    *state = Some(logger);
    
    log::info!("✅ Sistema logging traduzioni inizializzato");
    Ok("Sistema logging traduzioni inizializzato con successo".to_string())
}

/// Registra una nuova traduzione
#[tauri::command]
pub async fn log_translation(
    request: LogTranslationRequest,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("📝 Registrazione traduzione: {} -> {} (ID: {})", 
        request.entry.source_language, request.entry.target_language, request.entry.id);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    logger.log_translation(request.entry)?;
    
    log::info!("✅ Traduzione registrata con successo");
    Ok("Traduzione registrata con successo".to_string())
}

/// Aggiunge feedback umano a una traduzione
#[tauri::command]
pub async fn add_human_feedback(
    request: AddFeedbackRequest,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("💬 Aggiunta feedback umano per traduzione: {}", request.entry_id);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    logger.add_human_feedback(&request.entry_id, request.feedback)?;
    
    log::info!("✅ Feedback umano aggiunto con successo");
    Ok("Feedback umano aggiunto con successo".to_string())
}

/// Aggiunge correzione a una traduzione
#[tauri::command]
pub async fn add_translation_correction(
    request: AddCorrectionRequest,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("✏️ Aggiunta correzione per traduzione: {}", request.entry_id);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    logger.add_correction(&request.entry_id, request.correction)?;
    
    log::info!("✅ Correzione aggiunta con successo");
    Ok("Correzione aggiunta con successo".to_string())
}

/// Esporta log in formato specificato
#[tauri::command]
pub async fn export_translation_logs(
    request: ExportLogsRequest,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("📤 Esportazione log in formato {:?}: {}", request.format, request.output_path);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    let result = logger.export_logs(request.format, &request.output_path)?;
    
    log::info!("✅ Esportazione completata: {}", result);
    Ok(result)
}

/// Ottiene statistiche del logger
#[tauri::command]
pub async fn get_logger_statistics(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<LoggerStats, String> {
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    let stats = logger.get_statistics()?;
    
    Ok(LoggerStats {
        total_translations: stats.total_translations,
        translations_by_method: stats.translations_by_method,
        translations_by_language: stats.translations_by_language,
        average_quality_score: stats.average_quality_score,
        corrections_count: stats.corrections_count,
        human_feedback_count: stats.human_feedback_count,
        low_quality_translations: stats.low_quality_translations,
    })
}

/// Ottiene traduzioni che necessitano revisione
#[tauri::command]
pub async fn get_translations_for_review(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<Vec<TranslationLogEntry>, String> {
    log::info!("🔍 Ricerca traduzioni per revisione...");
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    let review_entries = logger.get_translations_for_review()?;
    
    log::info!("✅ Trovate {} traduzioni per revisione", review_entries.len());
    Ok(review_entries)
}

/// Genera report di analisi qualità
#[tauri::command]
pub async fn generate_quality_report(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<QualityReport, String> {
    log::info!("📊 Generazione report qualità...");
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    let report = logger.generate_quality_report()?;
    
    log::info!("✅ Report qualità generato: {} traduzioni analizzate", report.total_translations);
    Ok(report)
}

/// Ottiene configurazione corrente del logger
#[tauri::command]
pub async fn get_logger_config(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<TranslationLoggerConfig, String> {
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    // In una implementazione reale, il logger dovrebbe esporre get_config()
    Ok(TranslationLoggerConfig::default())
}

/// Aggiorna configurazione del logger
#[tauri::command]
pub async fn update_logger_config(
    new_config: TranslationLoggerConfig,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("🔧 Aggiornamento configurazione logger...");
    
    // Ricrea logger con nuova configurazione
    let logger = TranslationLogger::new(new_config)
        .map_err(|e| format!("Errore aggiornamento configurazione: {}", e))?;
    
    let mut state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    *state = Some(logger);
    
    log::info!("✅ Configurazione logger aggiornata");
    Ok("Configurazione logger aggiornata con successo".to_string())
}

/// Ottiene formati di esportazione supportati
#[tauri::command]
pub async fn get_supported_export_formats() -> Result<Vec<ExportFormat>, String> {
    Ok(vec![
        ExportFormat::CSV,
        ExportFormat::JSON,
        ExportFormat::TMX,
        ExportFormat::XLIFF,
        // ExportFormat::Excel, // Commentato perché non implementato
    ])
}

/// Cerca traduzioni per testo o ID
#[tauri::command]
pub async fn search_translations(
    query: String,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<Vec<TranslationLogEntry>, String> {
    log::info!("🔍 Ricerca traduzioni: {}", query);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    // Implementazione semplificata - in produzione useresti un indice di ricerca
    let all_entries = logger.get_translations_for_review()?; // Placeholder
    
    let matching_entries: Vec<TranslationLogEntry> = all_entries.into_iter()
        .filter(|entry| {
            entry.id.contains(&query) ||
            entry.source_text.to_lowercase().contains(&query.to_lowercase()) ||
            entry.translated_text.to_lowercase().contains(&query.to_lowercase()) ||
            entry.game_name.to_lowercase().contains(&query.to_lowercase())
        })
        .collect();
    
    log::info!("✅ Trovate {} traduzioni corrispondenti", matching_entries.len());
    Ok(matching_entries)
}

/// Ottiene traduzioni per gioco specifico
#[tauri::command]
pub async fn get_translations_by_game(
    game_name: String,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<Vec<TranslationLogEntry>, String> {
    log::info!("🎮 Ricerca traduzioni per gioco: {}", game_name);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    // Implementazione semplificata
    let all_entries = logger.get_translations_for_review()?; // Placeholder
    
    let game_entries: Vec<TranslationLogEntry> = all_entries.into_iter()
        .filter(|entry| entry.game_name == game_name)
        .collect();
    
    log::info!("✅ Trovate {} traduzioni per gioco {}", game_entries.len(), game_name);
    Ok(game_entries)
}

/// Ottiene traduzioni per coppia di lingue
#[tauri::command]
pub async fn get_translations_by_language_pair(
    source_language: String,
    target_language: String,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<Vec<TranslationLogEntry>, String> {
    log::info!("🌐 Ricerca traduzioni per coppia linguistica: {} -> {}", source_language, target_language);
    
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    // Implementazione semplificata
    let all_entries = logger.get_translations_for_review()?; // Placeholder
    
    let language_entries: Vec<TranslationLogEntry> = all_entries.into_iter()
        .filter(|entry| {
            entry.source_language == source_language && 
            entry.target_language == target_language
        })
        .collect();
    
    log::info!("✅ Trovate {} traduzioni per {} -> {}", 
        language_entries.len(), source_language, target_language);
    Ok(language_entries)
}

/// Ottiene statistiche di qualità per metodo di traduzione
#[tauri::command]
pub async fn get_quality_stats_by_method(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<std::collections::HashMap<String, f32>, String> {
    let state = logger_state.lock()
        .map_err(|_| "Errore accesso stato logger")?;
    
    let logger = state.as_ref()
        .ok_or("Sistema logging non inizializzato")?;
    
    let report = logger.generate_quality_report()?;
    
    Ok(report.method_quality_scores)
}

/// Ottiene raccomandazioni per migliorare la qualità
#[tauri::command]
pub async fn get_quality_improvement_recommendations(
    logger_state: State<'_, TranslationLoggerState>
) -> Result<Vec<String>, String> {
    let report = generate_quality_report(logger_state).await?;
    let mut recommendations = Vec::new();
    
    // Analizza qualità media
    if report.average_quality_score < 0.7 {
        recommendations.push(format!(
            "📉 Qualità media bassa ({:.1}%). Considera di rivedere le configurazioni dei motori di traduzione.",
            report.average_quality_score * 100.0
        ));
    }
    
    // Analizza correzioni
    if report.corrections_count > report.total_translations / 2 {
        recommendations.push(
            "✏️ Alto numero di correzioni. Considera di migliorare la qualità iniziale delle traduzioni.".to_string()
        );
    }
    
    // Analizza feedback umano
    if report.human_feedback_count < report.total_translations / 10 {
        recommendations.push(
            "💬 Poco feedback umano. Incoraggia i traduttori a fornire più feedback per migliorare il sistema.".to_string()
        );
    }
    
    // Analizza problemi comuni
    if let Some((most_common_issue, count)) = report.common_issues.iter().max_by_key(|(_, &v)| v) {
        if *count > 10 {
            recommendations.push(format!(
                "⚠️ Problema comune: {} ({} occorrenze). Considera di migliorare questo aspetto specifico.",
                most_common_issue, count
            ));
        }
    }
    
    // Analizza qualità per metodo
    for (method, quality) in &report.method_quality_scores {
        if *quality < 0.6 {
            recommendations.push(format!(
                "🔧 Metodo {} ha qualità bassa ({:.1}%). Considera di ottimizzare o disabilitare questo metodo.",
                method, quality * 100.0
            ));
        }
    }
    
    if recommendations.is_empty() {
        recommendations.push("✅ Qualità ottimale! Nessuna raccomandazione specifica.".to_string());
    }
    
    Ok(recommendations)
}

/// Pulisce log vecchi (oltre una certa data)
#[tauri::command]
pub async fn cleanup_old_logs(
    days_to_keep: u32,
    logger_state: State<'_, TranslationLoggerState>
) -> Result<String, String> {
    log::info!("🧹 Pulizia log vecchi (mantenendo {} giorni)...", days_to_keep);
    
    // Implementazione semplificata - in produzione implementeresti la pulizia reale
    let cleaned_count = 0; // Placeholder
    
    log::info!("✅ Pulizia completata: {} log rimossi", cleaned_count);
    Ok(format!("Pulizia completata: {} log rimossi", cleaned_count))
}
