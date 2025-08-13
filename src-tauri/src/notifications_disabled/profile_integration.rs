use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use crate::profiles::manager::ProfileEvent;
use crate::notifications::{
    manager::NotificationManager,
    models::{CreateNotificationRequest, NotificationType, NotificationPriority, NotificationMetadata},
    errors::NotificationResult,
};

/// Integrazione tra ProfileManager e NotificationManager
pub struct ProfileNotificationIntegration {
    notification_manager: Arc<Mutex<NotificationManager>>,
}

impl ProfileNotificationIntegration {
    /// Crea una nuova istanza dell'integrazione
    pub fn new(notification_manager: Arc<Mutex<NotificationManager>>) -> Self {
        Self {
            notification_manager,
        }
    }

    /// Gestisce gli eventi del ProfileManager creando notifiche appropriate
    pub async fn handle_profile_event(&self, event: ProfileEvent) -> NotificationResult<()> {
        match event {
            ProfileEvent::ProfileCreated { profile_id, name } => {
                self.create_welcome_notification(&profile_id, &name).await?;
            },
            ProfileEvent::ProfileAuthenticated { profile_id, name } => {
                self.create_authentication_notification(&profile_id, &name).await?;
            },
            ProfileEvent::ProfileSwitched { from_id: _, to_id } => {
                self.create_profile_switch_notification(&to_id).await?;
            },
            ProfileEvent::ProfileDeleted { profile_id: _, name } => {
                // Per i profili eliminati, non possiamo creare notifiche perché il profilo non esiste più
                // Questa notifica potrebbe essere inviata a tutti gli altri profili se necessario
                println!("[PROFILE INTEGRATION] Profilo '{}' eliminato", name);
            },
            ProfileEvent::ProfileLoggedOut { profile_id } => {
                self.create_logout_notification(&profile_id).await?;
            },
            ProfileEvent::AuthenticationFailed { profile_name, reason } => {
                // Per i fallimenti di autenticazione, cerchiamo di trovare il profilo per ID
                // Se non riusciamo, registriamo l'evento senza creare notifica
                println!("[PROFILE INTEGRATION] Autenticazione fallita per '{}': {}", profile_name, reason);
            },
        }
        
        Ok(())
    }

    /// Crea notifica di benvenuto per nuovo profilo
    async fn create_welcome_notification(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Benvenuto in GameStringer!".to_string(),
            message: format!("Il tuo profilo '{}' è stato creato con successo. Ora puoi iniziare a configurare le tue credenziali per i vari store di giochi.", profile_name),
            icon: Some("user-plus".to_string()),
            action_url: Some("/settings/stores".to_string()),
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() + chrono::Duration::days(7)), // Scade dopo una settimana
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "profile_lifecycle".to_string(),
                tags: vec!["welcome".to_string(), "new_profile".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("profile_name".to_string(), serde_json::Value::String(profile_name.to_string()));
                    data.insert("event_type".to_string(), serde_json::Value::String("profile_created".to_string()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per autenticazione riuscita
    async fn create_authentication_notification(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Accesso effettuato".to_string(),
            message: format!("Benvenuto, {}! Hai effettuato l'accesso con successo.", profile_name),
            icon: Some("user-check".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::Low),
            expires_at: Some(Utc::now() + chrono::Duration::hours(1)), // Scade dopo un'ora
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "authentication".to_string(),
                tags: vec!["login".to_string(), "success".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("profile_name".to_string(), serde_json::Value::String(profile_name.to_string()));
                    data.insert("event_type".to_string(), serde_json::Value::String("profile_authenticated".to_string()));
                    data.insert("login_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per cambio profilo
    async fn create_profile_switch_notification(&self, to_profile_id: &str) -> NotificationResult<()> {
        let request = CreateNotificationRequest {
            profile_id: to_profile_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Profilo cambiato".to_string(),
            message: "Hai cambiato profilo con successo. Le tue impostazioni e credenziali sono ora attive.".to_string(),
            icon: Some("user-switch".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::Low),
            expires_at: Some(Utc::now() + chrono::Duration::minutes(30)), // Scade dopo 30 minuti
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "profile_lifecycle".to_string(),
                tags: vec!["switch".to_string(), "profile_change".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("event_type".to_string(), serde_json::Value::String("profile_switched".to_string()));
                    data.insert("switch_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per logout
    async fn create_logout_notification(&self, profile_id: &str) -> NotificationResult<()> {
        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Logout effettuato".to_string(),
            message: "Hai effettuato il logout con successo. I tuoi dati sono al sicuro.".to_string(),
            icon: Some("user-x".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::Low),
            expires_at: Some(Utc::now() + chrono::Duration::minutes(15)), // Scade dopo 15 minuti
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "authentication".to_string(),
                tags: vec!["logout".to_string(), "session_end".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("event_type".to_string(), serde_json::Value::String("profile_logged_out".to_string()));
                    data.insert("logout_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per errore di autenticazione
    pub async fn create_authentication_error_notification(&self, profile_id: &str, error_message: &str) -> NotificationResult<()> {
        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Security,
            title: "Errore di autenticazione".to_string(),
            message: format!("Si è verificato un errore durante l'autenticazione: {}", error_message),
            icon: Some("alert-triangle".to_string()),
            action_url: Some("/auth/login".to_string()),
            priority: Some(NotificationPriority::High),
            expires_at: Some(Utc::now() + chrono::Duration::hours(24)), // Scade dopo 24 ore
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "security".to_string(),
                tags: vec!["error".to_string(), "authentication".to_string(), "security".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("error_message".to_string(), serde_json::Value::String(error_message.to_string()));
                    data.insert("event_type".to_string(), serde_json::Value::String("authentication_error".to_string()));
                    data.insert("error_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per profilo bloccato
    pub async fn create_profile_locked_notification(&self, profile_id: &str, remaining_seconds: u64) -> NotificationResult<()> {
        let minutes = remaining_seconds / 60;
        let seconds = remaining_seconds % 60;
        
        let time_message = if minutes > 0 {
            format!("{} minuti e {} secondi", minutes, seconds)
        } else {
            format!("{} secondi", seconds)
        };

        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Security,
            title: "Profilo temporaneamente bloccato".to_string(),
            message: format!("Il tuo profilo è stato temporaneamente bloccato a causa di troppi tentativi di accesso falliti. Riprova tra {}.", time_message),
            icon: Some("lock".to_string()),
            action_url: None,
            priority: Some(NotificationPriority::High),
            expires_at: Some(Utc::now() + chrono::Duration::seconds(remaining_seconds as i64)), // Scade quando il blocco termina
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "security".to_string(),
                tags: vec!["locked".to_string(), "security".to_string(), "rate_limit".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("remaining_seconds".to_string(), serde_json::Value::Number(serde_json::Number::from(remaining_seconds)));
                    data.insert("event_type".to_string(), serde_json::Value::String("profile_locked".to_string()));
                    data.insert("lock_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per operazione su credenziali
    pub async fn create_credential_operation_notification(&self, profile_id: &str, store: &str, operation: &str, success: bool) -> NotificationResult<()> {
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

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per aggiornamento impostazioni profilo
    pub async fn create_settings_update_notification(&self, profile_id: &str) -> NotificationResult<()> {
        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Impostazioni aggiornate".to_string(),
            message: "Le impostazioni del tuo profilo sono state aggiornate con successo.".to_string(),
            icon: Some("settings".to_string()),
            action_url: Some("/settings/profile".to_string()),
            priority: Some(NotificationPriority::Low),
            expires_at: Some(Utc::now() + chrono::Duration::minutes(30)),
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "settings".to_string(),
                tags: vec!["settings".to_string(), "update".to_string()],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    data.insert("event_type".to_string(), serde_json::Value::String("settings_updated".to_string()));
                    data.insert("update_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }

    /// Crea notifica per backup profilo
    pub async fn create_backup_notification(&self, profile_id: &str, backup_path: &str, success: bool) -> NotificationResult<()> {
        let (title, message, priority, icon) = if success {
            (
                "Backup completato".to_string(),
                format!("Il backup del tuo profilo è stato creato con successo in: {}", backup_path),
                NotificationPriority::Normal,
                "download"
            )
        } else {
            (
                "Errore backup".to_string(),
                "Si è verificato un errore durante la creazione del backup del profilo.".to_string(),
                NotificationPriority::High,
                "alert-triangle"
            )
        };

        let request = CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::Profile,
            title,
            message,
            icon: Some(icon.to_string()),
            action_url: if success { Some("/settings/backup".to_string()) } else { None },
            priority: Some(priority),
            expires_at: Some(Utc::now() + chrono::Duration::hours(if success { 24 } else { 48 })),
            metadata: Some(NotificationMetadata {
                source: "profile_manager".to_string(),
                category: "backup".to_string(),
                tags: vec![
                    "backup".to_string(),
                    if success { "success".to_string() } else { "error".to_string() }
                ],
                custom_data: Some({
                    let mut data = std::collections::HashMap::new();
                    if success {
                        data.insert("backup_path".to_string(), serde_json::Value::String(backup_path.to_string()));
                    }
                    data.insert("success".to_string(), serde_json::Value::Bool(success));
                    data.insert("event_type".to_string(), serde_json::Value::String("backup_operation".to_string()));
                    data.insert("backup_time".to_string(), serde_json::Value::String(Utc::now().to_rfc3339()));
                    data
                }),
            }),
        };

        let manager = self.notification_manager.lock().await;
        manager.create_notification(request).await?;
        Ok(())
    }
}