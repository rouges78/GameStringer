use std::sync::Arc;
use tokio::sync::Mutex;
use crate::profiles::manager::ProfileEvent;
use crate::notifications::{
    manager::NotificationManager,
    profile_integration::ProfileNotificationIntegration,
    errors::NotificationResult,
};

/// Handler per eventi del ProfileManager che gestisce le notifiche
pub struct ProfileEventHandler {
    notification_manager: Arc<Mutex<NotificationManager>>,
    profile_integration: Arc<Mutex<ProfileNotificationIntegration>>,
}

impl ProfileEventHandler {
    /// Crea un nuovo handler per eventi profilo
    pub fn new(
        notification_manager: Arc<Mutex<NotificationManager>>,
        profile_integration: Arc<Mutex<ProfileNotificationIntegration>>,
    ) -> Self {
        Self {
            notification_manager,
            profile_integration,
        }
    }

    /// Gestisce un evento del ProfileManager
    pub async fn handle_event(&self, event: ProfileEvent) -> NotificationResult<()> {
        // Prima gestisce l'evento per creare notifiche appropriate
        {
            let integration = self.profile_integration.lock().await;
            integration.handle_profile_event(event.clone()).await?;
        }

        // Poi gestisce eventuali operazioni di pulizia specifiche
        match &event {
            ProfileEvent::ProfileSwitched { from_id, to_id } => {
                let manager = self.notification_manager.lock().await;
                manager.handle_profile_switch(from_id.as_deref(), to_id).await?;
            },
            ProfileEvent::ProfileDeleted { profile_id, name: _ } => {
                // Pulisce tutte le notifiche del profilo eliminato
                let manager = self.notification_manager.lock().await;
                let deleted_count = manager.cleanup_profile_notifications(profile_id).await?;
                println!("[PROFILE EVENT HANDLER] Pulite {} notifiche per profilo eliminato: {}", deleted_count, profile_id);
            },
            ProfileEvent::ProfileLoggedOut { profile_id } => {
                // Opzionalmente, potremmo pulire le notifiche temporanee al logout
                // Per ora, manteniamo le notifiche per quando l'utente rientra
                println!("[PROFILE EVENT HANDLER] Logout profilo: {}", profile_id);
            },
            _ => {
                // Altri eventi sono già gestiti dall'integrazione
            }
        }

        Ok(())
    }

    /// Gestisce il cambio profilo con pulizia delle notifiche temporanee
    pub async fn handle_profile_switch_with_cleanup(&self, old_profile_id: Option<&str>, new_profile_id: &str) -> NotificationResult<()> {
        let manager = self.notification_manager.lock().await;
        
        // Gestisce il cambio profilo
        manager.handle_profile_switch(old_profile_id, new_profile_id).await?;
        
        // Opzionalmente, pulisce le notifiche scadute del nuovo profilo
        if let Ok(expired_count) = manager.cleanup_expired_notifications().await {
            if expired_count > 0 {
                println!("[PROFILE EVENT HANDLER] Pulite {} notifiche scadute per profilo: {}", expired_count, new_profile_id);
            }
        }

        Ok(())
    }

    /// Verifica l'integrità delle notifiche dopo un cambio profilo
    pub async fn verify_profile_integrity(&self, profile_id: &str) -> NotificationResult<bool> {
        let manager = self.notification_manager.lock().await;
        
        // Genera un report di sicurezza
        let security_report = manager.generate_security_report(profile_id).await?;
        
        if security_report.has_security_issues() {
            println!("[PROFILE EVENT HANDLER] Problemi di sicurezza rilevati per profilo {}: {}", 
                     profile_id, security_report.summary());
            return Ok(false);
        }

        // Verifica l'integrità delle notifiche
        let integrity_errors = manager.verify_profile_notifications_integrity(profile_id).await?;
        
        if !integrity_errors.is_empty() {
            println!("[PROFILE EVENT HANDLER] Errori di integrità rilevati per profilo {}: {:?}", 
                     profile_id, integrity_errors);
            return Ok(false);
        }

        Ok(true)
    }

    /// Pulisce le notifiche di un profilo prima dell'eliminazione
    pub async fn prepare_profile_for_deletion(&self, profile_id: &str) -> NotificationResult<u32> {
        let manager = self.notification_manager.lock().await;
        
        // Genera un report finale prima dell'eliminazione
        let security_report = manager.generate_security_report(profile_id).await?;
        println!("[PROFILE EVENT HANDLER] Report finale per profilo da eliminare {}: {}", 
                 profile_id, security_report.summary());
        
        // Pulisce tutte le notifiche
        let deleted_count = manager.cleanup_profile_notifications(profile_id).await?;
        
        println!("[PROFILE EVENT HANDLER] Preparazione eliminazione completata per profilo {}: {} notifiche rimosse", 
                 profile_id, deleted_count);
        
        Ok(deleted_count)
    }

    /// Inizializza le notifiche per un nuovo profilo
    pub async fn initialize_profile_notifications(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        // Crea le preferenze predefinite per il nuovo profilo
        let manager = self.notification_manager.lock().await;
        let _preferences = manager.get_preferences(profile_id).await?; // Questo creerà le preferenze predefinite se non esistono
        
        println!("[PROFILE EVENT HANDLER] Inizializzate notifiche per nuovo profilo: {} ({})", profile_name, profile_id);
        
        Ok(())
    }

    /// Migra le notifiche da un profilo a un altro (per operazioni di merge)
    pub async fn migrate_notifications(&self, from_profile_id: &str, to_profile_id: &str) -> NotificationResult<u32> {
        // Questa funzione potrebbe essere utile per operazioni di merge profili in futuro
        // Per ora, implementiamo una versione base che sposta le notifiche
        
        println!("[PROFILE EVENT HANDLER] Migrazione notifiche da {} a {} non ancora implementata", 
                 from_profile_id, to_profile_id);
        
        // TODO: Implementare la migrazione effettiva se necessario
        Ok(0)
    }

    /// Ottiene statistiche sulle notifiche per un profilo
    pub async fn get_profile_notification_stats(&self, profile_id: &str) -> NotificationResult<crate::notifications::models::NotificationStats> {
        let manager = self.notification_manager.lock().await;
        manager.get_notification_stats(profile_id).await
    }

    /// Esegue una pulizia completa delle notifiche per un profilo
    pub async fn full_cleanup_for_profile(&self, profile_id: &str) -> NotificationResult<(u32, u32)> {
        let manager = self.notification_manager.lock().await;
        
        // Pulisce le notifiche scadute
        let expired_count = manager.cleanup_expired_notifications().await.unwrap_or(0);
        
        // Ottiene le statistiche prima della pulizia
        let stats = manager.get_notification_stats(profile_id).await?;
        
        // Se ci sono troppe notifiche lette vecchie, le pulisce
        let old_read_count = if stats.total_notifications > 100 {
            // Per ora, non implementiamo la pulizia automatica delle notifiche lette vecchie
            // Questo potrebbe essere aggiunto in futuro come metodo pubblico del manager
            0
        } else {
            0
        };
        
        println!("[PROFILE EVENT HANDLER] Pulizia completa per profilo {}: {} scadute, {} vecchie lette", 
                 profile_id, expired_count, old_read_count);
        
        Ok((expired_count, old_read_count))
    }
}