use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use log::info;

// ============================================================================
// AUDIT LOG SYSTEM - Traccia accessi e modifiche
// ============================================================================

/// Tipo di evento audit
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    // Autenticazione
    Login,
    Logout,
    LoginFailed,
    PasswordChanged,
    
    // Profilo
    ProfileCreated,
    ProfileDeleted,
    ProfileUpdated,
    
    // Dati sensibili
    ApiKeyAdded,
    ApiKeyRemoved,
    ApiKeyAccessed,
    
    // Backup
    BackupCreated,
    BackupRestored,
    BackupDeleted,
    
    // Sicurezza
    TwoFactorEnabled,
    TwoFactorDisabled,
    RecoveryKeyGenerated,
    RecoveryKeyUsed,
    
    // Sistema
    SettingsChanged,
    DataExported,
    DataImported,
    SecureDeletePerformed,
}

/// Livello di severità
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuditSeverity {
    Info,
    Warning,
    Critical,
}

/// Singolo evento audit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub id: String,
    pub timestamp: String,
    pub event_type: AuditEventType,
    pub severity: AuditSeverity,
    pub profile_id: Option<String>,
    pub description: String,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

/// Statistiche audit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditStats {
    pub total_events: u64,
    pub login_count: u64,
    pub failed_logins: u64,
    pub critical_events: u64,
    pub last_login: Option<String>,
    pub last_activity: Option<String>,
}

/// Ottiene la directory dei log audit
fn get_audit_dir() -> Result<PathBuf, String> {
    let audit_dir = dirs::data_local_dir()
        .ok_or("Impossibile trovare directory dati")?
        .join("GameStringer")
        .join("audit");
    
    if !audit_dir.exists() {
        fs::create_dir_all(&audit_dir)
            .map_err(|e| format!("Errore creazione directory audit: {}", e))?;
    }
    
    Ok(audit_dir)
}

/// Ottiene il file di log corrente (uno per mese)
fn get_current_log_file() -> Result<PathBuf, String> {
    let audit_dir = get_audit_dir()?;
    let filename = Utc::now().format("%Y-%m.audit.json").to_string();
    Ok(audit_dir.join(filename))
}

/// Carica eventi dal file di log
fn load_events_from_file(filepath: &PathBuf) -> Vec<AuditEvent> {
    if !filepath.exists() {
        return Vec::new();
    }
    
    match fs::read_to_string(filepath) {
        Ok(content) => {
            serde_json::from_str(&content).unwrap_or_default()
        }
        Err(_) => Vec::new()
    }
}

/// Salva eventi nel file di log
fn save_events_to_file(filepath: &PathBuf, events: &[AuditEvent]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(events)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(filepath, json)
        .map_err(|e| format!("Errore scrittura file: {}", e))
}

/// Registra un evento audit
#[tauri::command]
pub async fn log_audit_event(
    event_type: String,
    profile_id: Option<String>,
    description: String,
    details: Option<serde_json::Value>,
) -> Result<String, String> {
    let event_type = match event_type.as_str() {
        "login" => AuditEventType::Login,
        "logout" => AuditEventType::Logout,
        "login_failed" => AuditEventType::LoginFailed,
        "password_changed" => AuditEventType::PasswordChanged,
        "profile_created" => AuditEventType::ProfileCreated,
        "profile_deleted" => AuditEventType::ProfileDeleted,
        "profile_updated" => AuditEventType::ProfileUpdated,
        "api_key_added" => AuditEventType::ApiKeyAdded,
        "api_key_removed" => AuditEventType::ApiKeyRemoved,
        "api_key_accessed" => AuditEventType::ApiKeyAccessed,
        "backup_created" => AuditEventType::BackupCreated,
        "backup_restored" => AuditEventType::BackupRestored,
        "backup_deleted" => AuditEventType::BackupDeleted,
        "two_factor_enabled" => AuditEventType::TwoFactorEnabled,
        "two_factor_disabled" => AuditEventType::TwoFactorDisabled,
        "recovery_key_generated" => AuditEventType::RecoveryKeyGenerated,
        "recovery_key_used" => AuditEventType::RecoveryKeyUsed,
        "settings_changed" => AuditEventType::SettingsChanged,
        "data_exported" => AuditEventType::DataExported,
        "data_imported" => AuditEventType::DataImported,
        "secure_delete" => AuditEventType::SecureDeletePerformed,
        _ => return Err(format!("Tipo evento non valido: {}", event_type)),
    };
    
    let severity = match &event_type {
        AuditEventType::LoginFailed | 
        AuditEventType::ProfileDeleted |
        AuditEventType::SecureDeletePerformed => AuditSeverity::Warning,
        
        AuditEventType::PasswordChanged |
        AuditEventType::TwoFactorDisabled |
        AuditEventType::RecoveryKeyUsed |
        AuditEventType::ApiKeyRemoved => AuditSeverity::Critical,
        
        _ => AuditSeverity::Info,
    };
    
    let event_id = uuid::Uuid::new_v4().to_string();
    
    let event = AuditEvent {
        id: event_id.clone(),
        timestamp: Utc::now().to_rfc3339(),
        event_type,
        severity,
        profile_id,
        description,
        details,
        ip_address: None, // Desktop app, no IP
        user_agent: Some("GameStringer Desktop".to_string()),
    };
    
    // Carica eventi esistenti
    let log_file = get_current_log_file()?;
    let mut events = load_events_from_file(&log_file);
    
    // Aggiungi nuovo evento
    events.push(event);
    
    // Salva
    save_events_to_file(&log_file, &events)?;
    
    info!("📋 Audit event logged: {}", event_id);
    
    Ok(event_id)
}

/// Ottiene eventi audit con filtri
#[tauri::command]
pub async fn get_audit_events(
    profile_id: Option<String>,
    event_types: Option<Vec<String>>,
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<AuditEvent>, String> {
    let audit_dir = get_audit_dir()?;
    let mut all_events = Vec::new();
    
    // Leggi tutti i file di log
    if let Ok(entries) = fs::read_dir(&audit_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "json") {
                let events = load_events_from_file(&path);
                all_events.extend(events);
            }
        }
    }
    
    // Ordina per timestamp (più recenti prima)
    all_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    // Filtra per profilo
    if let Some(ref pid) = profile_id {
        all_events.retain(|e| e.profile_id.as_ref() == Some(pid));
    }
    
    // Filtra per tipo evento
    if let Some(ref types) = event_types {
        all_events.retain(|e| {
            let event_str = serde_json::to_string(&e.event_type).unwrap_or_default();
            types.iter().any(|t| event_str.contains(t))
        });
    }
    
    // Filtra per data
    if let Some(ref from) = from_date {
        all_events.retain(|e| e.timestamp >= *from);
    }
    if let Some(ref to) = to_date {
        all_events.retain(|e| e.timestamp <= *to);
    }
    
    // Limita risultati
    if let Some(lim) = limit {
        all_events.truncate(lim);
    }
    
    Ok(all_events)
}

/// Ottiene statistiche audit
#[tauri::command]
pub async fn get_audit_stats(profile_id: Option<String>) -> Result<AuditStats, String> {
    let events = get_audit_events(profile_id, None, None, None, None).await?;
    
    let login_count = events.iter()
        .filter(|e| e.event_type == AuditEventType::Login)
        .count() as u64;
    
    let failed_logins = events.iter()
        .filter(|e| e.event_type == AuditEventType::LoginFailed)
        .count() as u64;
    
    let critical_events = events.iter()
        .filter(|e| matches!(e.severity, AuditSeverity::Critical))
        .count() as u64;
    
    let last_login = events.iter()
        .find(|e| e.event_type == AuditEventType::Login)
        .map(|e| e.timestamp.clone());
    
    let last_activity = events.first()
        .map(|e| e.timestamp.clone());
    
    Ok(AuditStats {
        total_events: events.len() as u64,
        login_count,
        failed_logins,
        critical_events,
        last_login,
        last_activity,
    })
}

/// Pulisce log audit vecchi (mantieni ultimi N mesi)
#[tauri::command]
pub async fn cleanup_audit_logs(keep_months: u32) -> Result<u32, String> {
    let audit_dir = get_audit_dir()?;
    let cutoff = Utc::now() - chrono::Duration::days((keep_months * 30) as i64);
    let cutoff_str = cutoff.format("%Y-%m").to_string();
    
    let mut deleted = 0u32;
    
    if let Ok(entries) = fs::read_dir(&audit_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                // Estrai anno-mese dal filename (es: 2026-01.audit.json)
                if let Some(ym) = filename.split('.').next() {
                    if ym < cutoff_str.as_str() {
                        if fs::remove_file(&path).is_ok() {
                            deleted += 1;
                            info!("🗑️ Audit log eliminato: {}", filename);
                        }
                    }
                }
            }
        }
    }
    
    Ok(deleted)
}

/// Esporta log audit in formato CSV
#[tauri::command]
pub async fn export_audit_log(
    profile_id: Option<String>,
    format: String,
) -> Result<String, String> {
    let events = get_audit_events(profile_id, None, None, None, None).await?;
    
    let audit_dir = get_audit_dir()?;
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    
    match format.as_str() {
        "csv" => {
            let filename = format!("audit_export_{}.csv", timestamp);
            let filepath = audit_dir.join(&filename);
            
            let mut csv = String::from("ID,Timestamp,Event Type,Severity,Profile ID,Description\n");
            for event in events {
                csv.push_str(&format!(
                    "{},{},{:?},{:?},{},{}\n",
                    event.id,
                    event.timestamp,
                    event.event_type,
                    event.severity,
                    event.profile_id.unwrap_or_default(),
                    event.description.replace(",", ";")
                ));
            }
            
            fs::write(&filepath, csv)
                .map_err(|e| format!("Errore scrittura: {}", e))?;
            
            Ok(filepath.to_string_lossy().to_string())
        }
        "json" => {
            let filename = format!("audit_export_{}.json", timestamp);
            let filepath = audit_dir.join(&filename);
            
            let json = serde_json::to_string_pretty(&events)
                .map_err(|e| format!("Errore serializzazione: {}", e))?;
            
            fs::write(&filepath, json)
                .map_err(|e| format!("Errore scrittura: {}", e))?;
            
            Ok(filepath.to_string_lossy().to_string())
        }
        _ => Err(format!("Formato non supportato: {}", format))
    }
}
