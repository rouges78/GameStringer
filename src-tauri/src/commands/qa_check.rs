use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;

/// 🔍 QA Check System - Verifica qualità traduzioni
/// 
/// Controlla automaticamente:
/// - Tag HTML/XML mancanti o sbilanciati
/// - Placeholder non tradotti ({0}, %s, etc.)
/// - Lunghezza testo (troppo lungo/corto)
/// - Encoding problemi
/// - Punteggiatura finale
/// - Numeri modificati
/// - Spazi extra

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QAIssue {
    pub id: String,
    pub issue_type: QAIssueType,
    pub severity: QASeverity,
    pub message: String,
    pub source_text: String,
    pub target_text: String,
    pub position: Option<usize>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum QAIssueType {
    MissingTag,
    ExtraTag,
    MismatchedTag,
    MissingPlaceholder,
    ExtraPlaceholder,
    LengthTooLong,
    LengthTooShort,
    PunctuationMismatch,
    NumberMismatch,
    LeadingWhitespace,
    TrailingWhitespace,
    DoubleSpace,
    EncodingIssue,
    EmptyTranslation,
    UnchangedTranslation,
    CaseMismatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum QASeverity {
    Error,      // Must fix
    Warning,    // Should fix
    Info,       // Nice to fix
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QAConfig {
    pub check_tags: bool,
    pub check_placeholders: bool,
    pub check_length: bool,
    pub check_punctuation: bool,
    pub check_numbers: bool,
    pub check_whitespace: bool,
    pub check_encoding: bool,
    pub max_length_ratio: f64,      // Max target/source length ratio (e.g., 1.5 = 50% longer)
    pub min_length_ratio: f64,      // Min target/source length ratio (e.g., 0.5 = 50% shorter)
}

impl Default for QAConfig {
    fn default() -> Self {
        Self {
            check_tags: true,
            check_placeholders: true,
            check_length: true,
            check_punctuation: true,
            check_numbers: true,
            check_whitespace: true,
            check_encoding: true,
            max_length_ratio: 1.8,
            min_length_ratio: 0.4,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QAResult {
    pub total_checked: u32,
    pub issues_found: u32,
    pub errors: u32,
    pub warnings: u32,
    pub info: u32,
    pub issues: Vec<QAIssue>,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationPair {
    pub id: String,
    pub source: String,
    pub target: String,
}

/// Esegue QA check su una coppia di traduzioni
#[tauri::command]
pub fn qa_check_translation(
    source: String,
    target: String,
    config: Option<QAConfig>
) -> Result<Vec<QAIssue>, String> {
    let cfg = config.unwrap_or_default();
    let mut issues = Vec::new();
    let id = format!("qa_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
    
    // 1. Check empty translation
    if target.trim().is_empty() && !source.trim().is_empty() {
        issues.push(QAIssue {
            id: format!("{}_empty", id),
            issue_type: QAIssueType::EmptyTranslation,
            severity: QASeverity::Error,
            message: "Traduzione vuota".to_string(),
            source_text: source.clone(),
            target_text: target.clone(),
            position: None,
            suggestion: Some("Inserisci una traduzione".to_string()),
        });
        return Ok(issues);
    }
    
    // 2. Check unchanged translation
    if source.trim() == target.trim() && !source.trim().is_empty() {
        issues.push(QAIssue {
            id: format!("{}_unchanged", id),
            issue_type: QAIssueType::UnchangedTranslation,
            severity: QASeverity::Warning,
            message: "Traduzione identica all'originale".to_string(),
            source_text: source.clone(),
            target_text: target.clone(),
            position: None,
            suggestion: None,
        });
    }
    
    // 3. Check tags
    if cfg.check_tags {
        issues.extend(check_tags(&source, &target, &id));
    }
    
    // 4. Check placeholders
    if cfg.check_placeholders {
        issues.extend(check_placeholders(&source, &target, &id));
    }
    
    // 5. Check length
    if cfg.check_length {
        issues.extend(check_length(&source, &target, &id, cfg.max_length_ratio, cfg.min_length_ratio));
    }
    
    // 6. Check punctuation
    if cfg.check_punctuation {
        issues.extend(check_punctuation(&source, &target, &id));
    }
    
    // 7. Check numbers
    if cfg.check_numbers {
        issues.extend(check_numbers(&source, &target, &id));
    }
    
    // 8. Check whitespace
    if cfg.check_whitespace {
        issues.extend(check_whitespace(&source, &target, &id));
    }
    
    // 9. Check encoding
    if cfg.check_encoding {
        issues.extend(check_encoding(&target, &id, &source));
    }
    
    Ok(issues)
}

/// Esegue QA check su multiple traduzioni
#[tauri::command]
pub fn qa_check_batch(
    translations: Vec<TranslationPair>,
    config: Option<QAConfig>
) -> Result<QAResult, String> {
    let cfg = config.unwrap_or_default();
    let mut all_issues = Vec::new();
    let mut errors = 0u32;
    let mut warnings = 0u32;
    let mut info = 0u32;
    
    for pair in &translations {
        let issues = qa_check_translation(pair.source.clone(), pair.target.clone(), Some(cfg.clone()))?;
        
        for issue in &issues {
            match issue.severity {
                QASeverity::Error => errors += 1,
                QASeverity::Warning => warnings += 1,
                QASeverity::Info => info += 1,
            }
        }
        
        all_issues.extend(issues);
    }
    
    let issues_found = all_issues.len() as u32;
    
    Ok(QAResult {
        total_checked: translations.len() as u32,
        issues_found,
        errors,
        warnings,
        info,
        issues: all_issues,
        passed: errors == 0,
    })
}

/// Verifica tag HTML/XML
fn check_tags(source: &str, target: &str, id: &str) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    // Regex per tag HTML/XML
    let tag_regex = Regex::new(r"</?[a-zA-Z][^>]*>").unwrap();
    
    let source_tags: Vec<&str> = tag_regex.find_iter(source).map(|m| m.as_str()).collect();
    let target_tags: Vec<&str> = tag_regex.find_iter(target).map(|m| m.as_str()).collect();
    
    // Conta tag nel source
    let mut source_tag_counts: HashMap<String, i32> = HashMap::new();
    for tag in &source_tags {
        *source_tag_counts.entry(tag.to_lowercase()).or_insert(0) += 1;
    }
    
    // Conta tag nel target
    let mut target_tag_counts: HashMap<String, i32> = HashMap::new();
    for tag in &target_tags {
        *target_tag_counts.entry(tag.to_lowercase()).or_insert(0) += 1;
    }
    
    // Verifica tag mancanti nel target
    for (tag, count) in &source_tag_counts {
        let target_count = target_tag_counts.get(tag).unwrap_or(&0);
        if target_count < count {
            issues.push(QAIssue {
                id: format!("{}_tag_missing", id),
                issue_type: QAIssueType::MissingTag,
                severity: QASeverity::Error,
                message: format!("Tag mancante: {}", tag),
                source_text: source.to_string(),
                target_text: target.to_string(),
                position: None,
                suggestion: Some(format!("Aggiungi {} alla traduzione", tag)),
            });
        }
    }
    
    // Verifica tag extra nel target
    for (tag, count) in &target_tag_counts {
        let source_count = source_tag_counts.get(tag).unwrap_or(&0);
        if count > source_count {
            issues.push(QAIssue {
                id: format!("{}_tag_extra", id),
                issue_type: QAIssueType::ExtraTag,
                severity: QASeverity::Warning,
                message: format!("Tag extra: {}", tag),
                source_text: source.to_string(),
                target_text: target.to_string(),
                position: None,
                suggestion: Some(format!("Rimuovi {} dalla traduzione", tag)),
            });
        }
    }
    
    issues
}

/// Verifica placeholder
fn check_placeholders(source: &str, target: &str, id: &str) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    // Pattern per vari tipi di placeholder
    let patterns = [
        r"\{[0-9]+\}",           // {0}, {1}, etc.
        r"\{\w+\}",              // {name}, {value}, etc.
        r"%[sdifoxX]",           // %s, %d, etc. (printf style)
        r"%\d+\$[sdifoxX]",      // %1$s, %2$d, etc.
        r"\$\{[^}]+\}",          // ${variable}
        r"\[\[[^\]]+\]\]",       // [[placeholder]]
        r"@@[^@]+@@",            // @@placeholder@@
    ];
    
    for pattern in &patterns {
        let regex = Regex::new(pattern).unwrap();
        
        let source_matches: Vec<&str> = regex.find_iter(source).map(|m| m.as_str()).collect();
        let target_matches: Vec<&str> = regex.find_iter(target).map(|m| m.as_str()).collect();
        
        // Conta placeholder nel source
        let mut source_counts: HashMap<&str, i32> = HashMap::new();
        for ph in &source_matches {
            *source_counts.entry(*ph).or_insert(0) += 1;
        }
        
        // Verifica placeholder mancanti
        for (ph, count) in &source_counts {
            let target_count = target_matches.iter().filter(|&&t| t == *ph).count() as i32;
            if target_count < *count {
                issues.push(QAIssue {
                    id: format!("{}_ph_missing", id),
                    issue_type: QAIssueType::MissingPlaceholder,
                    severity: QASeverity::Error,
                    message: format!("Placeholder mancante: {}", ph),
                    source_text: source.to_string(),
                    target_text: target.to_string(),
                    position: None,
                    suggestion: Some(format!("Aggiungi {} alla traduzione", ph)),
                });
            }
        }
    }
    
    issues
}

/// Verifica lunghezza
fn check_length(source: &str, target: &str, id: &str, max_ratio: f64, min_ratio: f64) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    let source_len = source.chars().count();
    let target_len = target.chars().count();
    
    if source_len == 0 {
        return issues;
    }
    
    let ratio = target_len as f64 / source_len as f64;
    
    if ratio > max_ratio {
        issues.push(QAIssue {
            id: format!("{}_length_long", id),
            issue_type: QAIssueType::LengthTooLong,
            severity: QASeverity::Warning,
            message: format!("Traduzione troppo lunga ({:.0}% dell'originale)", ratio * 100.0),
            source_text: source.to_string(),
            target_text: target.to_string(),
            position: None,
            suggestion: Some("Considera di abbreviare la traduzione".to_string()),
        });
    } else if ratio < min_ratio && source_len > 10 {
        issues.push(QAIssue {
            id: format!("{}_length_short", id),
            issue_type: QAIssueType::LengthTooShort,
            severity: QASeverity::Warning,
            message: format!("Traduzione troppo corta ({:.0}% dell'originale)", ratio * 100.0),
            source_text: source.to_string(),
            target_text: target.to_string(),
            position: None,
            suggestion: Some("Verifica che la traduzione sia completa".to_string()),
        });
    }
    
    issues
}

/// Verifica punteggiatura finale
fn check_punctuation(source: &str, target: &str, id: &str) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    let source_trimmed = source.trim();
    let target_trimmed = target.trim();
    
    if source_trimmed.is_empty() || target_trimmed.is_empty() {
        return issues;
    }
    
    let source_end = source_trimmed.chars().last().unwrap();
    let target_end = target_trimmed.chars().last().unwrap();
    
    // Gruppi di punteggiatura equivalente
    let punct_groups = [
        vec!['.', '。', '．'],           // Punti
        vec!['!', '！'],                 // Esclamativi
        vec!['?', '？'],                 // Interrogativi
        vec![':', '：'],                 // Due punti
        vec![';', '；'],                 // Punto e virgola
    ];
    
    let source_is_punct = source_end.is_ascii_punctuation() || "。！？：；".contains(source_end);
    let target_is_punct = target_end.is_ascii_punctuation() || "。！？：；".contains(target_end);
    
    if source_is_punct != target_is_punct {
        issues.push(QAIssue {
            id: format!("{}_punct", id),
            issue_type: QAIssueType::PunctuationMismatch,
            severity: QASeverity::Info,
            message: format!("Punteggiatura finale diversa: '{}' vs '{}'", source_end, target_end),
            source_text: source.to_string(),
            target_text: target.to_string(),
            position: Some(target_trimmed.len() - 1),
            suggestion: Some(format!("Considera di terminare con '{}'", source_end)),
        });
    }
    
    issues
}

/// Verifica numeri
fn check_numbers(source: &str, target: &str, id: &str) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    let number_regex = Regex::new(r"\d+(?:[.,]\d+)?").unwrap();
    
    let source_numbers: Vec<&str> = number_regex.find_iter(source).map(|m| m.as_str()).collect();
    let target_numbers: Vec<&str> = number_regex.find_iter(target).map(|m| m.as_str()).collect();
    
    // Normalizza numeri (. e , sono intercambiabili in alcuni contesti)
    let normalize = |n: &str| n.replace(',', ".");
    
    let source_normalized: Vec<String> = source_numbers.iter().map(|n| normalize(n)).collect();
    let target_normalized: Vec<String> = target_numbers.iter().map(|n| normalize(n)).collect();
    
    for num in &source_normalized {
        if !target_normalized.contains(num) {
            issues.push(QAIssue {
                id: format!("{}_number", id),
                issue_type: QAIssueType::NumberMismatch,
                severity: QASeverity::Warning,
                message: format!("Numero mancante o modificato: {}", num),
                source_text: source.to_string(),
                target_text: target.to_string(),
                position: None,
                suggestion: Some(format!("Verifica che {} sia presente nella traduzione", num)),
            });
        }
    }
    
    issues
}

/// Verifica whitespace
fn check_whitespace(source: &str, target: &str, id: &str) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    // Leading whitespace
    let source_leading = source.len() - source.trim_start().len();
    let target_leading = target.len() - target.trim_start().len();
    
    if source_leading == 0 && target_leading > 0 {
        issues.push(QAIssue {
            id: format!("{}_ws_lead", id),
            issue_type: QAIssueType::LeadingWhitespace,
            severity: QASeverity::Info,
            message: "Spazi iniziali extra nella traduzione".to_string(),
            source_text: source.to_string(),
            target_text: target.to_string(),
            position: Some(0),
            suggestion: Some("Rimuovi gli spazi iniziali".to_string()),
        });
    }
    
    // Trailing whitespace
    let source_trailing = source.len() - source.trim_end().len();
    let target_trailing = target.len() - target.trim_end().len();
    
    if source_trailing == 0 && target_trailing > 0 {
        issues.push(QAIssue {
            id: format!("{}_ws_trail", id),
            issue_type: QAIssueType::TrailingWhitespace,
            severity: QASeverity::Info,
            message: "Spazi finali extra nella traduzione".to_string(),
            source_text: source.to_string(),
            target_text: target.to_string(),
            position: Some(target.len() - 1),
            suggestion: Some("Rimuovi gli spazi finali".to_string()),
        });
    }
    
    // Double spaces
    if target.contains("  ") && !source.contains("  ") {
        issues.push(QAIssue {
            id: format!("{}_ws_double", id),
            issue_type: QAIssueType::DoubleSpace,
            severity: QASeverity::Info,
            message: "Doppi spazi nella traduzione".to_string(),
            source_text: source.to_string(),
            target_text: target.to_string(),
            position: target.find("  "),
            suggestion: Some("Sostituisci i doppi spazi con spazi singoli".to_string()),
        });
    }
    
    issues
}

/// Verifica encoding
fn check_encoding(target: &str, id: &str, source: &str) -> Vec<QAIssue> {
    let mut issues = Vec::new();
    
    // Caratteri problematici comuni
    let problematic = [
        ('\u{FFFD}', "Carattere di sostituzione Unicode"),
        ('\u{0000}', "Carattere null"),
    ];
    
    for (char, desc) in &problematic {
        if target.contains(*char) {
            issues.push(QAIssue {
                id: format!("{}_encoding", id),
                issue_type: QAIssueType::EncodingIssue,
                severity: QASeverity::Error,
                message: format!("Problema encoding: {}", desc),
                source_text: source.to_string(),
                target_text: target.to_string(),
                position: target.find(*char),
                suggestion: Some("Verifica la codifica del testo".to_string()),
            });
        }
    }
    
    issues
}

/// Auto-fix problemi comuni
#[tauri::command]
pub fn qa_auto_fix(target: String, issue_types: Vec<String>) -> Result<String, String> {
    let mut fixed = target;
    
    for issue_type in &issue_types {
        match issue_type.as_str() {
            "leading_whitespace" => {
                fixed = fixed.trim_start().to_string();
            }
            "trailing_whitespace" => {
                fixed = fixed.trim_end().to_string();
            }
            "double_space" => {
                while fixed.contains("  ") {
                    fixed = fixed.replace("  ", " ");
                }
            }
            _ => {}
        }
    }
    
    Ok(fixed)
}
