use std::sync::Arc;
use tokio::sync::{Mutex, broadcast};
use chrono::{DateTime, Utc};
use crate::notifications::{
    system_event_handler::{SystemEvent, SystemEventHandler, SecuritySeverity},
    errors::NotificationResult,
};

/// Sistema di integrazione per eventi di sistema
pub struct SystemEventIntegration {
    /// Handler per eventi di sistema
    system_event_handler: Arc<SystemEventHandler>,
    /// Sender per eventi di sistema
    system_event_sender: broadcast::Sender<SystemEvent>,
    /// Flag per indicare se il sistema è attivo
    is_active: Arc<Mutex<bool>>,
}

impl SystemEventIntegration {
    /// Crea un nuovo sistema di integrazione eventi di sistema
    pub fn new(system_event_handler: Arc<SystemEventHandler>) -> Self {
        let (sender, _) = broadcast::channel(100);
        
        Self {
            system_event_handler,
            system_event_sender: sender,
            is_active: Arc::new(Mutex::new(false)),
        }
    }

    /// Avvia il sistema di integrazione
    pub async fn start(&self) -> NotificationResult<()> {
        let mut is_active = self.is_active.lock().await;
        if *is_active {
            return Ok(()); // Già attivo
        }

        *is_active = true;
        
        // Avvia il listener per eventi di sistema
        self.start_system_event_listener().await;
        
        println!("[SYSTEM EVENT INTEGRATION] Sistema integrazione eventi di sistema avviato");
        Ok(())
    }

    /// Ferma il sistema di integrazione
    pub async fn stop(&self) {
        let mut is_active = self.is_active.lock().await;
        *is_active = false;
        println!("[SYSTEM EVENT INTEGRATION] Sistema integrazione eventi di sistema fermato");
    }

    /// Verifica se il sistema è attivo
    pub async fn is_active(&self) -> bool {
        *self.is_active.lock().await
    }

    /// Emette un evento di sistema
    pub async fn emit_system_event(&self, event: SystemEvent) -> NotificationResult<Vec<String>> {
        if !self.is_active().await {
            return Ok(Vec::new()); // Sistema non attivo, ignora l'evento
        }

        // Invia l'evento attraverso il broadcast channel
        if let Err(e) = self.system_event_sender.send(event.clone()) {
            eprintln!("[SYSTEM EVENT INTEGRATION] Errore invio evento: {}", e);
        }

        // Gestisce immediatamente l'evento
        self.system_event_handler.handle_system_event(event).await
    }

    /// Avvia il listener per eventi di sistema in background
    async fn start_system_event_listener(&self) {
        let mut receiver = self.system_event_sender.subscribe();
        let handler = Arc::clone(&self.system_event_handler);
        let is_active = Arc::clone(&self.is_active);

        tokio::spawn(async move {
            while *is_active.lock().await {
                match receiver.recv().await {
                    Ok(event) => {
                        if let Err(e) = handler.handle_system_event(event.clone()).await {
                            eprintln!("[SYSTEM EVENT INTEGRATION] Errore gestione evento {:?}: {}", event, e);
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        println!("[SYSTEM EVENT INTEGRATION] Channel chiuso, fermando listener");
                        break;
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        eprintln!("[SYSTEM EVENT INTEGRATION] Listener in ritardo, saltati {} eventi", skipped);
                    }
                }
            }
        });
    }

    /// Aggiorna la lista dei profili attivi
    pub async fn update_active_profiles(&self, profile_ids: Vec<String>) {
        self.system_event_handler.update_active_profiles(profile_ids).await;
    }

    /// Aggiunge un profilo alla lista degli attivi
    pub async fn add_active_profile(&self, profile_id: String) {
        self.system_event_handler.add_active_profile(profile_id).await;
    }

    /// Rimuove un profilo dalla lista degli attivi
    pub async fn remove_active_profile(&self, profile_id: &str) {
        self.system_event_handler.remove_active_profile(profile_id).await;
    }

    /// Crea listener personalizzato per eventi di sistema
    pub fn create_system_event_listener(&self) -> broadcast::Receiver<SystemEvent> {
        self.system_event_sender.subscribe()
    }

    /// Ottiene statistiche del sistema
    pub async fn get_system_stats(&self) -> SystemIntegrationStats {
        let handler_stats = self.system_event_handler.get_system_event_stats().await;
        
        SystemIntegrationStats {
            is_active: self.is_active().await,
            active_profiles_count: handler_stats.active_profiles_count,
            receiver_count: self.system_event_sender.receiver_count(),
        }
    }

    // === METODI DI CONVENIENZA PER EVENTI COMUNI ===

    /// Notifica aggiornamento disponibile
    pub async fn notify_update_available(&self, version: String, release_notes: String, download_url: Option<String>, is_critical: bool) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::UpdateAvailable {
            version,
            release_notes,
            download_url,
            is_critical,
        };
        self.emit_system_event(event).await
    }

    /// Notifica aggiornamento installato
    pub async fn notify_update_installed(&self, version: String, previous_version: String) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::UpdateInstalled {
            version,
            previous_version,
        };
        self.emit_system_event(event).await
    }

    /// Notifica errore aggiornamento
    pub async fn notify_update_error(&self, version: String, error_message: String) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::UpdateError {
            version,
            error_message,
        };
        self.emit_system_event(event).await
    }

    /// Notifica manutenzione programmata
    pub async fn notify_maintenance_scheduled(&self, start_time: DateTime<Utc>, end_time: DateTime<Utc>, description: String) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::MaintenanceScheduled {
            start_time,
            end_time,
            description,
        };
        self.emit_system_event(event).await
    }

    /// Notifica inizio manutenzione
    pub async fn notify_maintenance_started(&self, description: String, estimated_duration: u64) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::MaintenanceStarted {
            description,
            estimated_duration,
        };
        self.emit_system_event(event).await
    }

    /// Notifica completamento manutenzione
    pub async fn notify_maintenance_completed(&self, description: String, actual_duration: u64) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::MaintenanceCompleted {
            description,
            actual_duration,
        };
        self.emit_system_event(event).await
    }

    /// Notifica errore di sistema
    pub async fn notify_system_error(&self, error_code: String, error_message: String, component: String, is_recoverable: bool) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::SystemError {
            error_code,
            error_message,
            component,
            is_recoverable,
        };
        self.emit_system_event(event).await
    }

    /// Notifica avviso di sicurezza
    pub async fn notify_security_alert(&self, alert_type: String, severity: SecuritySeverity, description: String, action_required: bool) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::SecurityAlert {
            alert_type,
            severity,
            description,
            action_required,
        };
        self.emit_system_event(event).await
    }

    /// Notifica operazione background completata
    pub async fn notify_background_operation_completed(&self, operation_type: String, operation_id: String, success: bool, details: String) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::BackgroundOperationCompleted {
            operation_type,
            operation_id,
            success,
            details,
        };
        self.emit_system_event(event).await
    }

    /// Notifica operazione background fallita
    pub async fn notify_background_operation_failed(&self, operation_type: String, operation_id: String, error_message: String, retry_count: u32) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::BackgroundOperationFailed {
            operation_type,
            operation_id,
            error_message,
            retry_count,
        };
        self.emit_system_event(event).await
    }

    /// Notifica cambio stato sistema
    pub async fn notify_system_status_changed(&self, old_status: String, new_status: String, reason: String) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::SystemStatusChanged {
            old_status,
            new_status,
            reason,
        };
        self.emit_system_event(event).await
    }

    /// Notifica avviso risorsa
    pub async fn notify_resource_warning(&self, resource_type: String, current_usage: f64, threshold: f64, unit: String) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::ResourceWarning {
            resource_type,
            current_usage,
            threshold,
            unit,
        };
        self.emit_system_event(event).await
    }

    /// Notifica problema database
    pub async fn notify_database_issue(&self, database_name: String, issue_type: String, severity: String, auto_fixed: bool) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::DatabaseIssue {
            database_name,
            issue_type,
            severity,
            auto_fixed,
        };
        self.emit_system_event(event).await
    }

    /// Notifica cambio stato rete
    pub async fn notify_network_status_changed(&self, is_online: bool, previous_status: bool, affected_services: Vec<String>) -> NotificationResult<Vec<String>> {
        let event = SystemEvent::NetworkStatusChanged {
            is_online,
            previous_status,
            affected_services,
        };
        self.emit_system_event(event).await
    }

    // === METODI DI CONVENIENZA PER SCENARI COMUNI ===

    /// Notifica avvio applicazione
    pub async fn notify_application_started(&self, version: String) -> NotificationResult<Vec<String>> {
        self.notify_system_status_changed(
            "stopped".to_string(),
            "running".to_string(),
            format!("Applicazione avviata - versione {}", version),
        ).await
    }

    /// Notifica arresto applicazione
    pub async fn notify_application_stopped(&self, reason: String) -> NotificationResult<Vec<String>> {
        self.notify_system_status_changed(
            "running".to_string(),
            "stopped".to_string(),
            reason,
        ).await
    }

    /// Notifica backup completato
    pub async fn notify_backup_completed(&self, backup_type: String, success: bool, details: String) -> NotificationResult<Vec<String>> {
        self.notify_background_operation_completed(
            format!("Backup {}", backup_type),
            format!("backup_{}", chrono::Utc::now().timestamp()),
            success,
            details,
        ).await
    }

    /// Notifica sincronizzazione completata
    pub async fn notify_sync_completed(&self, sync_type: String, items_synced: u32, errors: u32) -> NotificationResult<Vec<String>> {
        let success = errors == 0;
        let details = if success {
            format!("Sincronizzati {} elementi con successo", items_synced)
        } else {
            format!("Sincronizzati {} elementi con {} errori", items_synced, errors)
        };
        
        self.notify_background_operation_completed(
            format!("Sync {}", sync_type),
            format!("sync_{}", chrono::Utc::now().timestamp()),
            success,
            details,
        ).await
    }

    /// Notifica pulizia database completata
    pub async fn notify_database_cleanup_completed(&self, database_name: String, cleaned_items: u32) -> NotificationResult<Vec<String>> {
        self.notify_background_operation_completed(
            "Database Cleanup".to_string(),
            format!("cleanup_{}_{}", database_name, chrono::Utc::now().timestamp()),
            true,
            format!("Puliti {} elementi dal database {}", cleaned_items, database_name),
        ).await
    }

    /// Notifica avviso spazio disco
    pub async fn notify_disk_space_warning(&self, disk_path: String, free_space_gb: f64, total_space_gb: f64) -> NotificationResult<Vec<String>> {
        let usage_percentage = ((total_space_gb - free_space_gb) / total_space_gb) * 100.0;
        
        self.notify_resource_warning(
            format!("Spazio Disco ({})", disk_path),
            total_space_gb - free_space_gb,
            total_space_gb * 0.9, // Soglia al 90%
            "GB".to_string(),
        ).await
    }

    /// Notifica avviso memoria
    pub async fn notify_memory_warning(&self, used_memory_mb: f64, total_memory_mb: f64) -> NotificationResult<Vec<String>> {
        self.notify_resource_warning(
            "Memoria RAM".to_string(),
            used_memory_mb,
            total_memory_mb * 0.85, // Soglia all'85%
            "MB".to_string(),
        ).await
    }

    /// Notifica problema connessione database
    pub async fn notify_database_connection_issue(&self, database_name: String, error_message: String, auto_retry: bool) -> NotificationResult<Vec<String>> {
        self.notify_database_issue(
            database_name,
            "Connection Error".to_string(),
            "high".to_string(),
            auto_retry,
        ).await
    }

    /// Notifica corruzione database rilevata
    pub async fn notify_database_corruption(&self, database_name: String, corruption_details: String, auto_repair_attempted: bool) -> NotificationResult<Vec<String>> {
        self.notify_database_issue(
            database_name,
            format!("Corruption: {}", corruption_details),
            "critical".to_string(),
            auto_repair_attempted,
        ).await
    }
}

/// Statistiche del sistema di integrazione eventi di sistema
#[derive(Debug, Clone)]
pub struct SystemIntegrationStats {
    /// Se il sistema è attivo
    pub is_active: bool,
    /// Numero di profili attivi che ricevono notifiche
    pub active_profiles_count: usize,
    /// Numero di receiver attivi per eventi
    pub receiver_count: usize,
}