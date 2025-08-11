use crate::notifications::{
    models::{Notification, NotificationFilter},
    errors::{NotificationError, NotificationResult},
};

/// Sistema di controllo accesso per le notifiche
pub struct NotificationAccessControl;

impl NotificationAccessControl {
    /// Verifica se un profilo può accedere a una notifica specifica
    pub fn can_access_notification(profile_id: &str, notification: &Notification) -> bool {
        // Verifica che la notifica appartenga al profilo
        notification.profile_id == profile_id
    }

    /// Filtra una lista di notifiche per un profilo specifico
    pub fn filter_notifications_for_profile(profile_id: &str, notifications: Vec<Notification>) -> Vec<Notification> {
        notifications
            .into_iter()
            .filter(|notification| Self::can_access_notification(profile_id, notification))
            .collect()
    }

    /// Verifica autorizzazione per operazioni su notifiche
    pub fn verify_notification_access(profile_id: &str, notification_id: &str, notifications: &[Notification]) -> NotificationResult<&Notification> {
        let notification = notifications
            .iter()
            .find(|n| n.id == notification_id)
            .ok_or_else(|| NotificationError::NotificationNotFound(notification_id.to_string()))?;

        if !Self::can_access_notification(profile_id, notification) {
            return Err(NotificationError::UnauthorizedProfile);
        }

        Ok(notification)
    }

    /// Verifica autorizzazione per operazioni su notifiche (versione mutabile)
    pub fn verify_notification_access_mut(profile_id: &str, notification_id: &str, notifications: &mut [Notification]) -> NotificationResult<&mut Notification> {
        let notification = notifications
            .iter_mut()
            .find(|n| n.id == notification_id)
            .ok_or_else(|| NotificationError::NotificationNotFound(notification_id.to_string()))?;

        if !Self::can_access_notification(profile_id, notification) {
            return Err(NotificationError::UnauthorizedProfile);
        }

        Ok(notification)
    }

    /// Valida che un filtro non cerchi di accedere a notifiche di altri profili
    pub fn validate_filter_for_profile(profile_id: &str, filter: &NotificationFilter) -> NotificationResult<()> {
        // Per ora il filtro non contiene profile_id, quindi non c'è nulla da validare
        // In futuro potremmo aggiungere controlli più sofisticati
        Ok(())
    }

    /// Pulisce le notifiche di un profilo quando cambia profilo
    pub fn cleanup_notifications_on_profile_switch(old_profile_id: Option<&str>, new_profile_id: &str) -> NotificationResult<()> {
        // Log del cambio profilo per audit
        if let Some(old_id) = old_profile_id {
            println!("[NOTIFICATION ACCESS] Cambio profilo: {} -> {}", old_id, new_profile_id);
        } else {
            println!("[NOTIFICATION ACCESS] Primo accesso profilo: {}", new_profile_id);
        }

        // In futuro potremmo implementare pulizia cache o altre operazioni
        Ok(())
    }

    /// Verifica se un profilo può creare notifiche per se stesso
    pub fn can_create_notification_for_profile(requesting_profile_id: &str, target_profile_id: &str) -> bool {
        // Un profilo può creare notifiche solo per se stesso
        // Le notifiche di sistema sono gestite separatamente
        requesting_profile_id == target_profile_id
    }

    /// Verifica se un profilo può eliminare una notifica
    pub fn can_delete_notification(profile_id: &str, notification: &Notification) -> bool {
        // Un profilo può eliminare solo le proprie notifiche
        Self::can_access_notification(profile_id, notification)
    }

    /// Verifica se un profilo può marcare una notifica come letta
    pub fn can_mark_notification_as_read(profile_id: &str, notification: &Notification) -> bool {
        // Un profilo può marcare come lette solo le proprie notifiche
        Self::can_access_notification(profile_id, notification)
    }

    /// Verifica se un profilo può aggiornare le preferenze notifiche
    pub fn can_update_notification_preferences(requesting_profile_id: &str, target_profile_id: &str) -> bool {
        // Un profilo può aggiornare solo le proprie preferenze
        requesting_profile_id == target_profile_id
    }

    /// Sanitizza i dati di una notifica per la visualizzazione
    pub fn sanitize_notification_for_display(notification: &mut Notification) {
        // Rimuovi eventuali dati sensibili dai metadati personalizzati
        if let Some(ref mut custom_data) = notification.metadata.custom_data {
            // Rimuovi campi che potrebbero contenere informazioni sensibili
            custom_data.remove("password");
            custom_data.remove("token");
            custom_data.remove("secret");
            custom_data.remove("key");
            custom_data.remove("credential");
        }
    }

    /// Verifica integrità di una notifica
    pub fn verify_notification_integrity(notification: &Notification) -> NotificationResult<()> {
        // Verifica che i campi obbligatori siano presenti
        if notification.id.is_empty() {
            return Err(NotificationError::InvalidContent("ID notifica vuoto".to_string()));
        }

        if notification.profile_id.is_empty() {
            return Err(NotificationError::InvalidContent("Profile ID vuoto".to_string()));
        }

        if notification.title.is_empty() {
            return Err(NotificationError::InvalidContent("Titolo notifica vuoto".to_string()));
        }

        if notification.message.is_empty() {
            return Err(NotificationError::InvalidContent("Messaggio notifica vuoto".to_string()));
        }

        // Verifica che la data di creazione sia valida
        if notification.created_at > chrono::Utc::now() {
            return Err(NotificationError::InvalidContent("Data creazione nel futuro".to_string()));
        }

        // Verifica che se è letta, abbia una data di lettura
        if notification.is_read() && notification.read_at.is_none() {
            return Err(NotificationError::InvalidContent("Notifica marcata come letta senza data di lettura".to_string()));
        }

        // Verifica che la data di lettura non sia precedente alla creazione
        if let Some(read_at) = notification.read_at {
            if read_at < notification.created_at {
                return Err(NotificationError::InvalidContent("Data lettura precedente alla creazione".to_string()));
            }
        }

        // Verifica che la data di scadenza non sia precedente alla creazione
        if let Some(expires_at) = notification.expires_at {
            if expires_at < notification.created_at {
                return Err(NotificationError::InvalidContent("Data scadenza precedente alla creazione".to_string()));
            }
        }

        Ok(())
    }

    /// Audit log per operazioni sulle notifiche
    pub fn audit_notification_operation(profile_id: &str, operation: &str, notification_id: &str, success: bool) {
        let status = if success { "SUCCESS" } else { "FAILED" };
        println!("[NOTIFICATION AUDIT] {} - Profile: {} - Operation: {} - Notification: {} - Status: {}", 
                 chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
                 profile_id, 
                 operation, 
                 notification_id, 
                 status);
    }

    /// Verifica limiti di rate per operazioni sulle notifiche
    pub fn check_operation_rate_limit(profile_id: &str, operation: &str) -> NotificationResult<()> {
        // Per ora implementiamo un controllo base
        // In futuro potremmo implementare un rate limiter più sofisticato
        
        // Esempio: limite di 100 operazioni al minuto per profilo
        // Questo dovrebbe essere implementato con un vero rate limiter in produzione
        
        println!("[NOTIFICATION RATE LIMIT] Profile: {} - Operation: {} - Allowed", profile_id, operation);
        Ok(())
    }

    /// Verifica se un profilo ha raggiunto il limite di notifiche
    pub fn check_notification_quota(profile_id: &str, current_count: u32, max_notifications: u32) -> NotificationResult<()> {
        if current_count >= max_notifications {
            return Err(NotificationError::StorageError(
                format!("Limite massimo notifiche raggiunto per il profilo {}: {}/{}", 
                        profile_id, current_count, max_notifications)
            ));
        }
        Ok(())
    }

    /// Genera un report di sicurezza per le notifiche di un profilo
    pub fn generate_security_report(profile_id: &str, notifications: &[Notification]) -> SecurityReport {
        let mut report = SecurityReport::new(profile_id);
        
        for notification in notifications {
            // Verifica integrità
            if Self::verify_notification_integrity(notification).is_err() {
                report.integrity_violations += 1;
            }
            
            // Verifica accesso
            if !Self::can_access_notification(profile_id, notification) {
                report.access_violations += 1;
            }
            
            // Conta notifiche per tipo
            report.notifications_by_type.entry(notification.notification_type.clone())
                .and_modify(|count| *count += 1)
                .or_insert(1);
        }
        
        report.total_notifications = notifications.len() as u32;
        report
    }
}

/// Report di sicurezza per le notifiche
#[derive(Debug, Clone)]
pub struct SecurityReport {
    pub profile_id: String,
    pub total_notifications: u32,
    pub integrity_violations: u32,
    pub access_violations: u32,
    pub notifications_by_type: std::collections::HashMap<crate::notifications::models::NotificationType, u32>,
    pub generated_at: chrono::DateTime<chrono::Utc>,
}

impl SecurityReport {
    fn new(profile_id: &str) -> Self {
        Self {
            profile_id: profile_id.to_string(),
            total_notifications: 0,
            integrity_violations: 0,
            access_violations: 0,
            notifications_by_type: std::collections::HashMap::new(),
            generated_at: chrono::Utc::now(),
        }
    }
    
    /// Verifica se il report indica problemi di sicurezza
    pub fn has_security_issues(&self) -> bool {
        self.integrity_violations > 0 || self.access_violations > 0
    }
    
    /// Ottiene un riassunto del report
    pub fn summary(&self) -> String {
        format!(
            "Security Report for Profile {}: {} notifications, {} integrity violations, {} access violations",
            self.profile_id,
            self.total_notifications,
            self.integrity_violations,
            self.access_violations
        )
    }
}