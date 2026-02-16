use std::sync::Arc;
use tokio::sync::Mutex;
use crate::profiles::manager::ProfileManager;
use crate::notifications::{
    event_system::NotificationEventSystem,
    errors::NotificationResult,
};

/// Integrazione automatica tra ProfileManager e sistema eventi notifiche
pub struct AutoEventIntegration {
    event_system: Arc<NotificationEventSystem>,
}

impl AutoEventIntegration {
    /// Crea una nuova integrazione automatica
    pub fn new(event_system: Arc<NotificationEventSystem>) -> Self {
        Self {
            event_system,
        }
    }

    /// Avvia l'integrazione automatica
    pub async fn start(&self) -> NotificationResult<()> {
        self.event_system.start().await?;
        println!("[AUTO EVENT INTEGRATION] Integrazione automatica avviata");
        Ok(())
    }

    /// Ferma l'integrazione automatica
    pub async fn stop(&self) {
        self.event_system.stop().await;
        println!("[AUTO EVENT INTEGRATION] Integrazione automatica fermata");
    }

    /// Hook per creazione profilo - da chiamare dopo ProfileManager::create_profile
    pub async fn on_profile_created(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        self.event_system.handle_profile_created(profile_id, profile_name).await
    }

    /// Hook per autenticazione profilo - da chiamare dopo ProfileManager::authenticate_profile
    pub async fn on_profile_authenticated(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        self.event_system.handle_profile_authenticated(profile_id, profile_name).await
    }

    /// Hook per cambio profilo - da chiamare dopo ProfileManager::switch_profile
    pub async fn on_profile_switched(&self, from_id: Option<&str>, to_id: &str) -> NotificationResult<()> {
        self.event_system.handle_profile_switched(from_id, to_id).await
    }

    /// Hook per eliminazione profilo - da chiamare prima di ProfileManager::delete_profile
    pub async fn on_profile_deleted(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        self.event_system.handle_profile_deleted(profile_id, profile_name).await
    }

    /// Hook per logout profilo - da chiamare dopo ProfileManager::logout
    pub async fn on_profile_logged_out(&self, profile_id: &str) -> NotificationResult<()> {
        self.event_system.handle_profile_logged_out(profile_id).await
    }

    /// Hook per fallimento autenticazione - da chiamare quando l'autenticazione fallisce
    pub async fn on_authentication_failed(&self, profile_name: &str, reason: &str) -> NotificationResult<()> {
        self.event_system.handle_authentication_failed(profile_name, reason).await
    }

    /// Hook per operazioni su credenziali - da chiamare dopo operazioni su credenziali
    pub async fn on_credential_operation(&self, profile_id: &str, store: &str, operation: &str, success: bool) -> NotificationResult<()> {
        // Crea l'evento direttamente attraverso il sistema di eventi
        use crate::notifications::models::{CreateNotificationRequest, NotificationType, NotificationPriority, NotificationMetadata};
        use chrono::Utc;
        
        let (title, message, priority, icon) = if success {
            (
                format!("Credenziali {} aggiornate", store),
                format!("Le credenziali per {} sono state {} con successo.", store, operation),
                NotificationPriority::Low,
                "key"
            )
        } else {
            (
                format!("Errore credenziali {}", store),
                format!("Si è verificato un errore durante l'operazione sulle credenziali per {}.", store),
                NotificationPriority::High,
                "alert-circle"
            )
        };

        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: if success { NotificationType::Profile } else { NotificationType::Security },
            title,
            message,
            icon: Some(icon.to_string()),
            action_url: Some("/settings/stores".to_string()),
            priority: Some(priority),
            expires_at: Some(Utc::now() + chrono::Duration::hours(if success { 1 } else { 24 })),
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "credentials".to_string(),
                tags: vec![
                    "credentials".to_string(), 
                    store.to_string(), 
                    operation.to_string(),
                    if success { "success".to_string() } else { "error".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("store".to_string(), serde_json::Value::String(store.to_string()));
                    data.insert("operation".to_string(), serde_json::Value::String(operation.to_string()));
                    data.insert("success".to_string(), serde_json::Value::Bool(success));
                    data.insert("event_type".to_string(), serde_json::Value::String("credential_operation".to_string()));
                    data.insert("operation_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        // Emette l'evento attraverso il sistema
        use crate::profiles::manager::ProfileEvent;
        let event = ProfileEvent::ProfileAuthenticated {
            profile_id: profile_id.to_string(),
            name: format!("Credential operation: {}", operation),
        };
        self.event_system.emit_profile_event(event).await
    }

    /// Hook per aggiornamento impostazioni - da chiamare dopo ProfileManager::update_settings
    pub async fn on_settings_updated(&self, profile_id: &str) -> NotificationResult<()> {
        use crate::profiles::manager::ProfileEvent;
        let event = ProfileEvent::ProfileAuthenticated {
            profile_id: profile_id.to_string(),
            name: "Settings updated".to_string(),
        };
        self.event_system.emit_profile_event(event).await
    }

    /// Hook per operazioni di backup - da chiamare dopo operazioni di backup
    pub async fn on_backup_operation(&self, profile_id: &str, backup_path: &str, success: bool) -> NotificationResult<()> {
        use crate::profiles::manager::ProfileEvent;
        let event = ProfileEvent::ProfileAuthenticated {
            profile_id: profile_id.to_string(),
            name: format!("Backup operation: {} ({})", if success { "success" } else { "failed" }, backup_path),
        };
        self.event_system.emit_profile_event(event).await
    }

    /// Hook per errori di autenticazione - da chiamare quando si verificano errori
    pub async fn on_authentication_error(&self, profile_id: &str, error_message: &str) -> NotificationResult<()> {
        use crate::profiles::manager::ProfileEvent;
        let event = ProfileEvent::AuthenticationFailed {
            profile_name: profile_id.to_string(),
            reason: error_message.to_string(),
        };
        self.event_system.emit_profile_event(event).await
    }

    /// Hook per profilo bloccato - da chiamare quando un profilo viene bloccato
    pub async fn on_profile_locked(&self, profile_id: &str, remaining_seconds: u64) -> NotificationResult<()> {
        use crate::profiles::manager::ProfileEvent;
        let event = ProfileEvent::AuthenticationFailed {
            profile_name: profile_id.to_string(),
            reason: format!("Profile locked for {} seconds", remaining_seconds),
        };
        self.event_system.emit_profile_event(event).await
    }

    /// Ottiene statistiche dell'integrazione
    pub async fn get_integration_stats(&self) -> IntegrationStats {
        let event_stats = self.event_system.get_event_stats().await;
        
        IntegrationStats {
            event_system_active: event_stats.is_active,
            active_listeners: event_stats.receiver_count,
        }
    }

    /// Verifica lo stato dell'integrazione
    pub async fn health_check(&self) -> IntegrationHealthStatus {
        let is_active = self.event_system.is_active().await;
        
        if is_active {
            IntegrationHealthStatus::Healthy
        } else {
            IntegrationHealthStatus::Inactive
        }
    }
}

/// Statistiche dell'integrazione automatica
#[derive(Debug, Clone)]
pub struct IntegrationStats {
    /// Se il sistema eventi è attivo
    pub event_system_active: bool,
    /// Numero di listener attivi
    pub active_listeners: usize,
}

/// Stato di salute dell'integrazione
#[derive(Debug, Clone, PartialEq)]
pub enum IntegrationHealthStatus {
    /// Integrazione funzionante
    Healthy,
    /// Integrazione inattiva
    Inactive,
    /// Integrazione con errori
    Error(String),
}

/// Wrapper per ProfileManager con integrazione automatica eventi
pub struct ProfileManagerWithEvents {
    profile_manager: Arc<Mutex<ProfileManager>>,
    auto_integration: Arc<AutoEventIntegration>,
}

impl ProfileManagerWithEvents {
    /// Crea un nuovo wrapper con integrazione eventi
    pub fn new(
        profile_manager: ProfileManager,
        auto_integration: AutoEventIntegration,
    ) -> Self {
        Self {
            profile_manager: Arc::new(Mutex::new(profile_manager)),
            auto_integration: Arc::new(auto_integration),
        }
    }

    /// Avvia l'integrazione
    pub async fn start(&self) -> NotificationResult<()> {
        self.auto_integration.start().await
    }

    /// Ferma l'integrazione
    pub async fn stop(&self) {
        self.auto_integration.stop().await;
    }

    /// Ottiene il ProfileManager sottostante
    pub fn get_profile_manager(&self) -> Arc<Mutex<ProfileManager>> {
        Arc::clone(&self.profile_manager)
    }

    /// Ottiene l'integrazione automatica
    pub fn get_auto_integration(&self) -> Arc<AutoEventIntegration> {
        Arc::clone(&self.auto_integration)
    }

    /// Crea un profilo con eventi automatici
    pub async fn create_profile_with_events(&self, request: crate::profiles::models::CreateProfileRequest) -> crate::profiles::errors::ProfileResult<crate::profiles::models::UserProfile> {
        let mut manager = self.profile_manager.lock().await;
        let profile = manager.create_profile(request).await?;
        
        // Emette evento di creazione profilo
        if let Err(e) = self.auto_integration.on_profile_created(&profile.id, &profile.name).await {
            eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento creazione profilo: {}", e);
        }
        
        Ok(profile)
    }

    /// Autentica un profilo con eventi automatici
    pub async fn authenticate_profile_with_events(&self, name: &str, password: &str) -> crate::profiles::errors::ProfileResult<crate::profiles::models::UserProfile> {
        let mut manager = self.profile_manager.lock().await;
        
        match manager.authenticate_profile(name, password).await {
            Ok(profile) => {
                // Emette evento di autenticazione riuscita
                if let Err(e) = self.auto_integration.on_profile_authenticated(&profile.id, &profile.name).await {
                    eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento autenticazione: {}", e);
                }
                Ok(profile)
            }
            Err(e) => {
                // Emette evento di autenticazione fallita
                if let Err(event_err) = self.auto_integration.on_authentication_failed(name, &e.to_string()).await {
                    eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento autenticazione fallita: {}", event_err);
                }
                Err(e)
            }
        }
    }

    /// Cambia profilo con eventi automatici
    pub async fn switch_profile_with_events(&self, name: &str, password: &str) -> crate::profiles::errors::ProfileResult<crate::profiles::models::UserProfile> {
        let old_profile_id = {
            let manager = self.profile_manager.lock().await;
            manager.current_profile_id().map(|s| s.to_string())
        };

        let mut manager = self.profile_manager.lock().await;
        let new_profile = manager.switch_profile(name, password).await?;
        
        // Emette evento di cambio profilo
        if let Err(e) = self.auto_integration.on_profile_switched(old_profile_id.as_deref(), &new_profile.id).await {
            eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento cambio profilo: {}", e);
        }
        
        Ok(new_profile)
    }

    /// Elimina un profilo con eventi automatici
    pub async fn delete_profile_with_events(&self, profile_id: &str, password: &str) -> crate::profiles::errors::ProfileResult<()> {
        // Prima ottiene il nome del profilo per l'evento
        let profile_name = {
            let manager = self.profile_manager.lock().await;
            manager.get_profile_info(profile_id).await?
                .map(|info| info.name)
                .unwrap_or_else(|| "Unknown".to_string())
        };

        // Emette evento di eliminazione profilo (prima dell'eliminazione effettiva)
        if let Err(e) = self.auto_integration.on_profile_deleted(profile_id, &profile_name).await {
            eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento eliminazione profilo: {}", e);
        }

        // Elimina il profilo
        let mut manager = self.profile_manager.lock().await;
        manager.delete_profile(profile_id, password).await
    }

    /// Effettua logout con eventi automatici
    pub async fn logout_with_events(&self) -> crate::profiles::errors::ProfileResult<()> {
        let profile_id = {
            let manager = self.profile_manager.lock().await;
            manager.current_profile_id().map(|s| s.to_string())
        };

        let mut manager = self.profile_manager.lock().await;
        manager.logout()?;
        
        // Emette evento di logout
        if let Some(id) = profile_id {
            if let Err(e) = self.auto_integration.on_profile_logged_out(&id).await {
                eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento logout: {}", e);
            }
        }
        
        Ok(())
    }

    /// Aggiorna impostazioni con eventi automatici
    pub async fn update_settings_with_events(&self, settings: crate::profiles::models::ProfileSettings, password: &str) -> crate::profiles::errors::ProfileResult<()> {
        let profile_id = {
            let manager = self.profile_manager.lock().await;
            manager.current_profile_id().map(|s| s.to_string())
        };

        let mut manager = self.profile_manager.lock().await;
        manager.update_settings(settings, password).await?;
        
        // Emette evento di aggiornamento impostazioni
        if let Some(id) = profile_id {
            if let Err(e) = self.auto_integration.on_settings_updated(&id).await {
                eprintln!("[PROFILE MANAGER WITH EVENTS] Errore evento aggiornamento impostazioni: {}", e);
            }
        }
        
        Ok(())
    }
}