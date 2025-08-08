use std::sync::Arc;
use crate::notifications::{
    errors::{NotificationError, NotificationResult},
    models::{CreateNotificationRequest, Notification, NotificationFilter, NotificationPreferences, NotificationStats},
    storage::NotificationStorage,
    cleanup::{NotificationCleanupManager, CleanupConfig, CleanupStats, CleanupResult},
};

/// Manager principale per il sistema di notifiche
pub struct NotificationManager {
    storage: Arc<NotificationStorage>,
    cleanup_manager: Option<NotificationCleanupManager>,
}

impl NotificationManager {
    /// Crea una nuova istanza del NotificationManager
    pub fn new(storage: NotificationStorage) -> Self {
        Self { 
            storage: Arc::new(storage),
            cleanup_manager: None,
        }
    }

    /// Crea una nuova istanza con sistema di pulizia automatica
    pub fn new_with_cleanup(storage: NotificationStorage, cleanup_config: CleanupConfig) -> Self {
        let storage_arc = Arc::new(storage);
        let cleanup_manager = NotificationCleanupManager::new(Arc::clone(&storage_arc), cleanup_config);
        
        Self { 
            storage: storage_arc,
            cleanup_manager: Some(cleanup_manager),
        }
    }

    /// Inizializza il manager
    pub async fn initialize(&self) -> NotificationResult<()> {
        self.storage.initialize().await
    }

    /// Crea una nuova notifica
    pub async fn create_notification(&self, request: CreateNotificationRequest) -> NotificationResult<Notification> {
        // Valida la richiesta
        request.validate()?;
        
        // Crea la notifica
        let notification = Notification::new(request);
        
        // Salva nel storage
        self.storage.save_notification(&notification).await?;
        
        Ok(notification)
    }

    /// Ottiene le notifiche per un profilo
    pub async fn get_notifications(&self, profile_id: &str, filter: NotificationFilter) -> NotificationResult<Vec<Notification>> {
        self.storage.load_notifications(profile_id, &filter).await
    }

    /// Marca una notifica come letta
    pub async fn mark_as_read(&self, notification_id: &str, profile_id: &str) -> NotificationResult<()> {
        // Carica la notifica
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let mut notification = notifications
            .into_iter()
            .find(|n| n.id == notification_id)
            .ok_or_else(|| NotificationError::NotificationNotFound(notification_id.to_string()))?;

        // Verifica che appartenga al profilo
        if !notification.belongs_to_profile(profile_id) {
            return Err(NotificationError::UnauthorizedProfile);
        }

        // Marca come letta
        notification.mark_as_read();
        
        // Salva l'aggiornamento
        self.storage.update_notification(&notification).await?;
        
        Ok(())
    }

    /// Elimina una notifica
    pub async fn delete_notification(&self, notification_id: &str, profile_id: &str) -> NotificationResult<()> {
        // Verifica che la notifica appartenga al profilo
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let notification = notifications
            .into_iter()
            .find(|n| n.id == notification_id)
            .ok_or_else(|| NotificationError::NotificationNotFound(notification_id.to_string()))?;

        if !notification.belongs_to_profile(profile_id) {
            return Err(NotificationError::UnauthorizedProfile);
        }

        // Elimina la notifica
        self.storage.delete_notification(notification_id).await
    }

    /// Ottiene il conteggio delle notifiche non lette
    pub async fn get_unread_count(&self, profile_id: &str) -> NotificationResult<u32> {
        self.storage.count_unread_notifications(profile_id).await
    }

    /// Elimina tutte le notifiche di un profilo
    pub async fn clear_all_notifications(&self, profile_id: &str) -> NotificationResult<u32> {
        self.storage.delete_all_notifications(profile_id).await
    }

    /// Aggiorna le preferenze notifiche
    pub async fn update_preferences(&self, preferences: NotificationPreferences) -> NotificationResult<()> {
        self.storage.save_preferences(&preferences).await
    }

    /// Ottiene le preferenze notifiche per un profilo
    pub async fn get_preferences(&self, profile_id: &str) -> NotificationResult<NotificationPreferences> {
        match self.storage.load_preferences(profile_id).await? {
            Some(preferences) => Ok(preferences),
            None => {
                // Crea preferenze predefinite
                let mut default_preferences = NotificationPreferences::default();
                default_preferences.profile_id = profile_id.to_string();
                
                // Salva le preferenze predefinite
                self.storage.save_preferences(&default_preferences).await?;
                
                Ok(default_preferences)
            }
        }
    }

    /// Pulisce le notifiche scadute
    pub async fn cleanup_expired_notifications(&self) -> NotificationResult<u32> {
        self.storage.cleanup_expired().await
    }

    /// Avvia il sistema di pulizia automatica
    pub async fn start_auto_cleanup(&self) -> NotificationResult<()> {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.start_auto_cleanup().await
        } else {
            Err(NotificationError::StorageError("Sistema di pulizia non configurato".to_string()))
        }
    }

    /// Ferma il sistema di pulizia automatica
    pub async fn stop_auto_cleanup(&self) {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.stop_auto_cleanup().await;
        }
    }

    /// Esegue una pulizia manuale completa
    pub async fn run_manual_cleanup(&self) -> NotificationResult<CleanupResult> {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.run_manual_cleanup().await
        } else {
            // Fallback: esegui solo la pulizia delle scadute
            let expired_count = self.storage.cleanup_expired().await?;
            Ok(CleanupResult {
                total_cleaned: expired_count,
                expired_cleaned: expired_count,
                old_read_cleaned: 0,
                retention_cleaned: 0,
            })
        }
    }

    /// Ottiene le statistiche di pulizia
    pub async fn get_cleanup_stats(&self) -> Option<CleanupStats> {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            Some(cleanup_manager.get_cleanup_stats().await)
        } else {
            None
        }
    }

    /// Ottiene le statistiche delle notifiche per un profilo
    pub async fn get_notification_stats(&self, profile_id: &str) -> NotificationResult<NotificationStats> {
        self.storage.get_notification_stats(profile_id).await
    }

    /// Verifica se il cleanup automatico è attivo
    pub async fn is_auto_cleanup_running(&self) -> bool {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.is_auto_cleanup_running().await
        } else {
            false
        }
    }
}