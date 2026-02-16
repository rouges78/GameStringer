use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc};
use crate::notifications::{
    manager::NotificationManager,
    models::{
        CreateNotificationRequest, NotificationType, NotificationPriority, NotificationMetadata
    },
    errors::NotificationResult,
};

/// Eventi di sistema che possono generare notifiche
#[derive(Debug, Clone)]
pub enum SystemEvent {
    /// Aggiornamento applicazione disponibile
    UpdateAvailable {
        version: String,
        release_notes: String,
        download_url: Option<String>,
        is_critical: bool,
    },
    /// Aggiornamento installato con successo
    UpdateInstalled {
        version: String,
        previous_version: String,
    },
    /// Errore durante aggiornamento
    UpdateError {
        version: String,
        error_message: String,
    },
    /// Manutenzione programmata
    MaintenanceScheduled {
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
        description: String,
    },
    /// Manutenzione iniziata
    MaintenanceStarted {
        description: String,
        estimated_duration: u64, // minuti
    },
    /// Manutenzione completata
    MaintenanceCompleted {
        description: String,
        actual_duration: u64, // minuti
    },
    /// Errore di sistema critico
    SystemError {
        error_code: String,
        error_message: String,
        component: String,
        is_recoverable: bool,
    },
    /// Avviso di sicurezza
    SecurityAlert {
        alert_type: String,
        severity: SecuritySeverity,
        description: String,
        action_required: bool,
    },
    /// Operazione background completata
    BackgroundOperationCompleted {
        operation_type: String,
        operation_id: String,
        success: bool,
        details: String,
    },
    /// Operazione background fallita
    BackgroundOperationFailed {
        operation_type: String,
        operation_id: String,
        error_message: String,
        retry_count: u32,
    },
    /// Stato sistema cambiato
    SystemStatusChanged {
        old_status: String,
        new_status: String,
        reason: String,
    },
    /// Risorsa sistema in esaurimento
    ResourceWarning {
        resource_type: String,
        current_usage: f64,
        threshold: f64,
        unit: String,
    },
    /// Database corrotto o problemi di integrità
    DatabaseIssue {
        database_name: String,
        issue_type: String,
        severity: String,
        auto_fixed: bool,
    },
    /// Connessione di rete persa/ripristinata
    NetworkStatusChanged {
        is_online: bool,
        previous_status: bool,
        affected_services: Vec<String>,
    },
}

/// Livelli di severità per avvisi di sicurezza
#[derive(Debug, Clone)]
pub enum SecuritySeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Handler per eventi di sistema
pub struct SystemEventHandler {
    notification_manager: Arc<Mutex<NotificationManager>>,
    /// Lista di profili attivi per notifiche broadcast
    active_profiles: Arc<Mutex<Vec<String>>>,
}

impl SystemEventHandler {
    /// Crea un nuovo handler per eventi di sistema
    pub fn new(notification_manager: Arc<Mutex<NotificationManager>>) -> Self {
        Self {
            notification_manager,
            active_profiles: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Aggiorna la lista dei profili attivi
    pub async fn update_active_profiles(&self, profile_ids: Vec<String>) {
        let mut profiles = self.active_profiles.lock().await;
        *profiles = profile_ids;
    }

    /// Aggiunge un profilo alla lista degli attivi
    pub async fn add_active_profile(&self, profile_id: String) {
        let mut profiles = self.active_profiles.lock().await;
        if !profiles.contains(&profile_id) {
            profiles.push(profile_id);
        }
    }

    /// Rimuove un profilo dalla lista degli attivi
    pub async fn remove_active_profile(&self, profile_id: &str) {
        let mut profiles = self.active_profiles.lock().await;
        profiles.retain(|id| id != profile_id);
    }

    /// Gestisce un evento di sistema
    pub async fn handle_system_event(&self, event: SystemEvent) -> NotificationResult<Vec<String>> {
        match event {
            SystemEvent::UpdateAvailable { version, release_notes, download_url, is_critical } => {
                self.handle_update_available(version, release_notes, download_url, is_critical).await
            }
            SystemEvent::UpdateInstalled { version, previous_version } => {
                self.handle_update_installed(version, previous_version).await
            }
            SystemEvent::UpdateError { version, error_message } => {
                self.handle_update_error(version, error_message).await
            }
            SystemEvent::MaintenanceScheduled { start_time, end_time, description } => {
                self.handle_maintenance_scheduled(start_time, end_time, description).await
            }
            SystemEvent::MaintenanceStarted { description, estimated_duration } => {
                self.handle_maintenance_started(description, estimated_duration).await
            }
            SystemEvent::MaintenanceCompleted { description, actual_duration } => {
                self.handle_maintenance_completed(description, actual_duration).await
            }
            SystemEvent::SystemError { error_code, error_message, component, is_recoverable } => {
                self.handle_system_error(error_code, error_message, component, is_recoverable).await
            }
            SystemEvent::SecurityAlert { alert_type, severity, description, action_required } => {
                self.handle_security_alert(alert_type, severity, description, action_required).await
            }
            SystemEvent::BackgroundOperationCompleted { operation_type, operation_id, success, details } => {
                self.handle_background_operation_completed(operation_type, operation_id, success, details).await
            }
            SystemEvent::BackgroundOperationFailed { operation_type, operation_id, error_message, retry_count } => {
                self.handle_background_operation_failed(operation_type, operation_id, error_message, retry_count).await
            }
            SystemEvent::SystemStatusChanged { old_status, new_status, reason } => {
                self.handle_system_status_changed(old_status, new_status, reason).await
            }
            SystemEvent::ResourceWarning { resource_type, current_usage, threshold, unit } => {
                self.handle_resource_warning(resource_type, current_usage, threshold, unit).await
            }
            SystemEvent::DatabaseIssue { database_name, issue_type, severity, auto_fixed } => {
                self.handle_database_issue(database_name, issue_type, severity, auto_fixed).await
            }
            SystemEvent::NetworkStatusChanged { is_online, previous_status, affected_services } => {
                self.handle_network_status_changed(is_online, previous_status, affected_services).await
            }
        }
    }

    /// Crea notifica broadcast per tutti i profili attivi
    async fn create_broadcast_notification(&self, request: CreateNotificationRequest) -> NotificationResult<Vec<String>> {
        let profiles = self.active_profiles.lock().await.clone();
        let mut created_notifications = Vec::new();
        
        let manager = self.notification_manager.lock().await;
        
        for profile_id in profiles {
            let mut profile_request = request.clone();
            profile_request.profile_id = profile_id.clone();
            
            match manager.create_notification(profile_request).await {
                Ok(notification) => {
                    created_notifications.push(notification.id);
                }
                Err(e) => {
                    eprintln!("[SYSTEM EVENT HANDLER] Errore creazione notifica per profilo {}: {}", profile_id, e);
                }
            }
        }
        
        Ok(created_notifications)
    }

    /// Gestisce aggiornamento disponibile
    async fn handle_update_available(&self, version: String, release_notes: String, download_url: Option<String>, is_critical: bool) -> NotificationResult<Vec<String>> {
        let priority = if is_critical { NotificationPriority::Urgent } else { NotificationPriority::High };
        let title = if is_critical {
            format!("Aggiornamento Critico Disponibile - v{}", version)
        } else {
            format!("Nuovo Aggiornamento Disponibile - v{}", version)
        };
        
        let request = CreateNotificationRequest {
            profile_id: String::new(), // Sarà impostato per ogni profilo
            notification_type: NotificationType::Update,
            title,
            message: format!("È disponibile la versione {}. {}", version, release_notes),
            icon: Some("download".to_string()),
            action_url: download_url.or_else(|| Some("/settings/updates".to_string())),
            priority: Some(priority),
            expires_at: Some(Utc::now() + chrono::Duration::days(if is_critical { 1 } else { 7 })),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "updates".to_string(),
                tags: vec![
                    "update".to_string(),
                    "available".to_string(),
                    if is_critical { "critical".to_string() } else { "normal".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("version".to_string(), serde_json::Value::String(version));
                    data.insert("is_critical".to_string(), serde_json::Value::Bool(is_critical));
                    data.insert("release_notes".to_string(), serde_json::Value::String(release_notes));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce aggiornamento installato
    async fn handle_update_installed(&self, version: String, previous_version: String) -> NotificationResult<Vec<String>> {
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::Update,
            title: format!("Aggiornamento Completato - v{}", version),
            message: format!("GameStringer è stato aggiornato con successo dalla versione {} alla versione {}.", previous_version, version),
            icon: Some("check-circle".to_string()),
            action_url: Some("/changelog".to_string()),
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() + chrono::Duration::days(3)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "updates".to_string(),
                tags: vec!["update".to_string(), "installed".to_string(), "success".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("new_version".to_string(), serde_json::Value::String(version));
                    data.insert("previous_version".to_string(), serde_json::Value::String(previous_version));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce errore aggiornamento
    async fn handle_update_error(&self, version: String, error_message: String) -> NotificationResult<Vec<String>> {
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title: format!("Errore Aggiornamento - v{}", version),
            message: format!("Si è verificato un errore durante l'aggiornamento: {}", error_message),
            icon: Some("alert-triangle".to_string()),
            action_url: Some("/settings/updates".to_string()),
            priority: Some(NotificationPriority::High),
            expires_at: Some(Utc::now() + chrono::Duration::days(7)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "updates".to_string(),
                tags: vec!["update".to_string(), "error".to_string(), "failed".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("version".to_string(), serde_json::Value::String(version));
                    data.insert("error_message".to_string(), serde_json::Value::String(error_message));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce manutenzione programmata
    async fn handle_maintenance_scheduled(&self, start_time: DateTime<Utc>, end_time: DateTime<Utc>, description: String) -> NotificationResult<Vec<String>> {
        let duration_hours = (end_time - start_time).num_hours();
        
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title: "Manutenzione Programmata".to_string(),
            message: format!("È programmata una manutenzione di {} ore a partire dal {}. {}", 
                           duration_hours, 
                           start_time.format("%d/%m/%Y alle %H:%M"), 
                           description),
            icon: Some("tool".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(end_time + chrono::Duration::hours(1)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "maintenance".to_string(),
                tags: vec!["maintenance".to_string(), "scheduled".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("start_time".to_string(), serde_json::Value::String(start_time.to_rfc3339()));
                    data.insert("end_time".to_string(), serde_json::Value::String(end_time.to_rfc3339()));
                    data.insert("description".to_string(), serde_json::Value::String(description));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce inizio manutenzione
    async fn handle_maintenance_started(&self, description: String, estimated_duration: u64) -> NotificationResult<Vec<String>> {
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title: "Manutenzione in Corso".to_string(),
            message: format!("La manutenzione è iniziata e dovrebbe durare circa {} minuti. {}", estimated_duration, description),
            icon: Some("settings".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::High),
            expires_at: Some(Utc::now() + chrono::Duration::minutes(estimated_duration as i64 + 30)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "maintenance".to_string(),
                tags: vec!["maintenance".to_string(), "started".to_string(), "active".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("estimated_duration".to_string(), serde_json::Value::Number(serde_json::Number::from(estimated_duration)));
                    data.insert("description".to_string(), serde_json::Value::String(description));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce completamento manutenzione
    async fn handle_maintenance_completed(&self, description: String, actual_duration: u64) -> NotificationResult<Vec<String>> {
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title: "Manutenzione Completata".to_string(),
            message: format!("La manutenzione è stata completata in {} minuti. {}", actual_duration, description),
            icon: Some("check-circle".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() + chrono::Duration::hours(6)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "maintenance".to_string(),
                tags: vec!["maintenance".to_string(), "completed".to_string(), "success".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("actual_duration".to_string(), serde_json::Value::Number(serde_json::Number::from(actual_duration)));
                    data.insert("description".to_string(), serde_json::Value::String(description));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce errori di sistema
    async fn handle_system_error(&self, error_code: String, error_message: String, component: String, is_recoverable: bool) -> NotificationResult<Vec<String>> {
        let priority = if is_recoverable { NotificationPriority::High } else { NotificationPriority::Urgent };
        let title = if is_recoverable {
            format!("Errore Sistema Recuperabile - {}", component)
        } else {
            format!("Errore Sistema Critico - {}", component)
        };
        
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title,
            message: format!("Errore {} nel componente {}: {}", error_code, component, error_message),
            icon: Some("alert-circle".to_string()),
            action_url: Some("/support".to_string()),
            priority: Some(priority),
            expires_at: Some(Utc::now() + chrono::Duration::days(if is_recoverable { 1 } else { 7 })),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "errors".to_string(),
                tags: vec![
                    "error".to_string(),
                    "system".to_string(),
                    component.clone(),
                    if is_recoverable { "recoverable".to_string() } else { "critical".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("error_code".to_string(), serde_json::Value::String(error_code));
                    data.insert("component".to_string(), serde_json::Value::String(component));
                    data.insert("is_recoverable".to_string(), serde_json::Value::Bool(is_recoverable));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce avvisi di sicurezza
    async fn handle_security_alert(&self, alert_type: String, severity: SecuritySeverity, description: String, action_required: bool) -> NotificationResult<Vec<String>> {
        let (priority, severity_str) = match severity {
            SecuritySeverity::Low => (NotificationPriority::Low, "Bassa"),
            SecuritySeverity::Medium => (NotificationPriority::Normal, "Media"),
            SecuritySeverity::High => (NotificationPriority::High, "Alta"),
            SecuritySeverity::Critical => (NotificationPriority::Urgent, "Critica"),
        };
        
        let title = format!("Avviso Sicurezza - {} ({})", alert_type, severity_str);
        let message = if action_required {
            format!("{} È richiesta un'azione immediata.", description)
        } else {
            description
        };
        
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::Security,
            title,
            message,
            icon: Some("shield-alert".to_string()),
            action_url: if action_required { Some("/security".to_string()) } else { None },
            priority: Some(priority),
            expires_at: Some(Utc::now() + chrono::Duration::days(match severity {
                SecuritySeverity::Critical => 30,
                SecuritySeverity::High => 14,
                SecuritySeverity::Medium => 7,
                SecuritySeverity::Low => 3,
            })),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "security".to_string(),
                tags: vec![
                    "security".to_string(),
                    "alert".to_string(),
                    alert_type.clone(),
                    severity_str.to_lowercase(),
                    if action_required { "action_required".to_string() } else { "informational".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("alert_type".to_string(), serde_json::Value::String(alert_type));
                    data.insert("severity".to_string(), serde_json::Value::String(severity_str.to_string()));
                    data.insert("action_required".to_string(), serde_json::Value::Bool(action_required));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce operazioni background completate
    async fn handle_background_operation_completed(&self, operation_type: String, operation_id: String, success: bool, details: String) -> NotificationResult<Vec<String>> {
        // Solo notifica se l'operazione è importante o è fallita
        if !success || self.is_important_operation(&operation_type) {
            let (title, priority, icon) = if success {
                (format!("Operazione {} Completata", operation_type), NotificationPriority::Low, "check-circle")
            } else {
                (format!("Operazione {} Fallita", operation_type), NotificationPriority::High, "x-circle")
            };
            
            let request = CreateNotificationRequest {
                profile_id: String::new(),
                notification_type: NotificationType::System,
                title,
                message: format!("Operazione {}: {}", operation_type, details),
                icon: Some(icon.to_string()),
                action_url: None,
                priority: Some(priority),
                expires_at: Some(Utc::now() + chrono::Duration::hours(if success { 2 } else { 24 })),
                metadata: Some(NotificationMetadata {
                    source: "system".to_string(),
                    category: "background_operations".to_string(),
                    tags: vec![
                        "background".to_string(),
                        "operation".to_string(),
                        operation_type.clone(),
                        if success { "success".to_string() } else { "failed".to_string() }
                    ],
                    custom_data: Some({
                        let mut data = std::collections::HashMap::new();
                        data.insert("operation_type".to_string(), serde_json::Value::String(operation_type));
                        data.insert("operation_id".to_string(), serde_json::Value::String(operation_id));
                        data.insert("success".to_string(), serde_json::Value::Bool(success));
                        data.insert("details".to_string(), serde_json::Value::String(details));
                        data
                    }),
                }),
            };
            
            self.create_broadcast_notification(request).await
        } else {
            Ok(Vec::new()) // Non crea notifiche per operazioni di successo non importanti
        }
    }

    /// Gestisce operazioni background fallite
    async fn handle_background_operation_failed(&self, operation_type: String, operation_id: String, error_message: String, retry_count: u32) -> NotificationResult<Vec<String>> {
        let title = if retry_count > 0 {
            format!("Operazione {} Fallita (Tentativo {})", operation_type, retry_count + 1)
        } else {
            format!("Operazione {} Fallita", operation_type)
        };
        
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title,
            message: format!("Errore nell'operazione {}: {}", operation_type, error_message),
            icon: Some("alert-triangle".to_string()),
            action_url: Some("/logs".to_string()),
            priority: Some(if retry_count > 2 { NotificationPriority::High } else { NotificationPriority::Normal }),
            expires_at: Some(Utc::now() + chrono::Duration::hours(24)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "background_operations".to_string(),
                tags: vec![
                    "background".to_string(),
                    "operation".to_string(),
                    "failed".to_string(),
                    operation_type.clone(),
                    if retry_count > 2 { "multiple_failures".to_string() } else { "single_failure".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("operation_type".to_string(), serde_json::Value::String(operation_type));
                    data.insert("operation_id".to_string(), serde_json::Value::String(operation_id));
                    data.insert("error_message".to_string(), serde_json::Value::String(error_message));
                    data.insert("retry_count".to_string(), serde_json::Value::Number(serde_json::Number::from(retry_count)));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce cambi di stato sistema
    async fn handle_system_status_changed(&self, old_status: String, new_status: String, reason: String) -> NotificationResult<Vec<String>> {
        // Solo notifica per cambi di stato importanti
        if self.is_important_status_change(&old_status, &new_status) {
            let priority = if new_status.contains("error") || new_status.contains("offline") {
                NotificationPriority::High
            } else {
                NotificationPriority::Normal
            };
            
            let request = CreateNotificationRequest {
                profile_id: String::new(),
                notification_type: NotificationType::System,
                title: "Stato Sistema Cambiato".to_string(),
                message: format!("Lo stato del sistema è cambiato da '{}' a '{}'. Motivo: {}", old_status, new_status, reason),
                icon: Some("activity".to_string()),
                action_url: Some("/system/status".to_string()),
                priority: Some(priority),
                expires_at: Some(Utc::now() + chrono::Duration::hours(6)),
                metadata: Some(NotificationMetadata {
                    source: "system".to_string(),
                    category: "status".to_string(),
                    tags: vec!["status".to_string(), "change".to_string(), new_status.clone()],
                    custom_data: Some({
                        let mut data = std::collections::HashMap::new();
                        data.insert("old_status".to_string(), serde_json::Value::String(old_status));
                        data.insert("new_status".to_string(), serde_json::Value::String(new_status));
                        data.insert("reason".to_string(), serde_json::Value::String(reason));
                        data
                    }),
                }),
            };
            
            self.create_broadcast_notification(request).await
        } else {
            Ok(Vec::new())
        }
    }

    /// Gestisce avvisi risorse
    async fn handle_resource_warning(&self, resource_type: String, current_usage: f64, threshold: f64, unit: String) -> NotificationResult<Vec<String>> {
        let usage_percentage = (current_usage / threshold) * 100.0;
        let priority = if usage_percentage > 95.0 {
            NotificationPriority::Urgent
        } else if usage_percentage > 85.0 {
            NotificationPriority::High
        } else {
            NotificationPriority::Normal
        };
        
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title: format!("Avviso Risorsa: {}", resource_type),
            message: format!("L'utilizzo di {} ha raggiunto {:.1}{} su {:.1}{} ({:.1}%)", 
                           resource_type, current_usage, unit, threshold, unit, usage_percentage),
            icon: Some("alert-triangle".to_string()),
            action_url: Some("/system/resources".to_string()),
            priority: Some(priority),
            expires_at: Some(Utc::now() + chrono::Duration::hours(12)),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "resources".to_string(),
                tags: vec!["resource".to_string(), "warning".to_string(), resource_type.clone()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("resource_type".to_string(), serde_json::Value::String(resource_type));
                    data.insert("current_usage".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(current_usage).unwrap()));
                    data.insert("threshold".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(threshold).unwrap()));
                    data.insert("unit".to_string(), serde_json::Value::String(unit));
                    data.insert("usage_percentage".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(usage_percentage).unwrap()));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce problemi database
    async fn handle_database_issue(&self, database_name: String, issue_type: String, severity: String, auto_fixed: bool) -> NotificationResult<Vec<String>> {
        let priority = match severity.to_lowercase().as_str() {
            "critical" => NotificationPriority::Urgent,
            "high" => NotificationPriority::High,
            "medium" => NotificationPriority::Normal,
            _ => NotificationPriority::Low,
        };
        
        let title = if auto_fixed {
            format!("Problema Database Risolto - {}", database_name)
        } else {
            format!("Problema Database - {}", database_name)
        };
        
        let message = if auto_fixed {
            format!("Problema {} nel database {} è stato risolto automaticamente.", issue_type, database_name)
        } else {
            format!("Rilevato problema {} nel database {}. Potrebbe essere necessario un intervento manuale.", issue_type, database_name)
        };
        
        let request = CreateNotificationRequest {
            profile_id: String::new(),
            notification_type: NotificationType::System,
            title,
            message,
            icon: Some(if auto_fixed { "check-circle" } else { "database" }.to_string()),
            action_url: if auto_fixed { None } else { Some("/system/database".to_string()) },
            priority: Some(if auto_fixed { NotificationPriority::Low } else { priority }),
            expires_at: Some(Utc::now() + chrono::Duration::hours(if auto_fixed { 6 } else { 48 })),
            metadata: Some(NotificationMetadata {
                source: "system".to_string(),
                category: "database".to_string(),
                tags: vec![
                    "database".to_string(),
                    "issue".to_string(),
                    severity.clone(),
                    if auto_fixed { "auto_fixed".to_string() } else { "manual_action_needed".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("database_name".to_string(), serde_json::Value::String(database_name));
                    data.insert("issue_type".to_string(), serde_json::Value::String(issue_type));
                    data.insert("severity".to_string(), serde_json::Value::String(severity));
                    data.insert("auto_fixed".to_string(), serde_json::Value::Bool(auto_fixed));
                    data
                }),
            }),
        };
        
        self.create_broadcast_notification(request).await
    }

    /// Gestisce cambi stato rete
    async fn handle_network_status_changed(&self, is_online: bool, previous_status: bool, affected_services: Vec<String>) -> NotificationResult<Vec<String>> {
        // Solo notifica se c'è un cambio di stato significativo
        if is_online != previous_status {
            let (title, message, priority, icon) = if is_online {
                (
                    "Connessione Ripristinata".to_string(),
                    "La connessione di rete è stata ripristinata. Tutti i servizi dovrebbero essere nuovamente disponibili.".to_string(),
                    NotificationPriority::Normal,
                    "wifi"
                )
            } else {
                (
                    "Connessione Persa".to_string(),
                    format!("La connessione di rete è stata persa. Servizi interessati: {}", affected_services.join(", ")),
                    NotificationPriority::High,
                    "wifi-off"
                )
            };
            
            let request = CreateNotificationRequest {
                profile_id: String::new(),
                notification_type: NotificationType::System,
                title,
                message,
                icon: Some(icon.to_string()),
                action_url: Some("/system/network".to_string()),
                priority: Some(priority),
                expires_at: Some(Utc::now() + chrono::Duration::hours(if is_online { 2 } else { 12 })),
                metadata: Some(NotificationMetadata {
                    source: "system".to_string(),
                    category: "network".to_string(),
                    tags: vec![
                        "network".to_string(),
                        "status".to_string(),
                        if is_online { "online".to_string() } else { "offline".to_string() }
                    ],
                    custom_data: Some({
                        let mut data = std::collections::HashMap::new();
                        data.insert("is_online".to_string(), serde_json::Value::Bool(is_online));
                        data.insert("previous_status".to_string(), serde_json::Value::Bool(previous_status));
                        data.insert("affected_services".to_string(), serde_json::Value::Array(
                            affected_services.into_iter().map(serde_json::Value::String).collect()
                        ));
                        data
                    }),
                }),
            };
            
            self.create_broadcast_notification(request).await
        } else {
            Ok(Vec::new())
        }
    }

    /// Verifica se un'operazione è importante e merita una notifica
    fn is_important_operation(&self, operation_type: &str) -> bool {
        matches!(operation_type.to_lowercase().as_str(), 
            "backup" | "restore" | "migration" | "sync" | "update" | "cleanup" | "repair"
        )
    }

    /// Verifica se un cambio di stato è importante
    fn is_important_status_change(&self, old_status: &str, new_status: &str) -> bool {
        // Notifica per cambi verso stati problematici o di ripristino
        new_status.contains("error") || 
        new_status.contains("offline") || 
        new_status.contains("maintenance") ||
        (old_status.contains("error") && new_status.contains("online")) ||
        (old_status.contains("offline") && new_status.contains("online"))
    }

    /// Ottiene la lista dei profili attivi
    pub async fn get_active_profiles(&self) -> Vec<String> {
        self.active_profiles.lock().await.clone()
    }

    /// Ottiene statistiche del sistema eventi
    pub async fn get_system_event_stats(&self) -> SystemEventStats {
        let active_profiles_count = self.active_profiles.lock().await.len();
        
        SystemEventStats {
            active_profiles_count,
        }
    }
}

/// Statistiche del sistema eventi di sistema
#[derive(Debug, Clone)]
pub struct SystemEventStats {
    /// Numero di profili attivi che ricevono notifiche broadcast
    pub active_profiles_count: usize,
}