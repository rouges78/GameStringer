#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::{
        models::{CreateNotificationRequest, NotificationFilter, NotificationMetadata, NotificationType, NotificationPriority},
        storage::NotificationStorage,
        manager::NotificationManager,
    };
    use tempfile::tempdir;
    use tokio;

    #[tokio::test]
    async fn test_notification_system_integration() {
        // Crea un database temporaneo
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_notifications.db");
        
        // Inizializza il sistema
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        
        // Inizializza il database
        assert!(manager.initialize().await.is_ok());
        
        // Crea una notifica di test
        let request = CreateNotificationRequest {
            profile_id: "test_profile_123".to_string(),
            notification_type: NotificationType::System,
            title: "Test Notification".to_string(),
            message: "This is a test notification for the system".to_string(),
            icon: Some("system-icon".to_string()),
            action_url: Some("/settings".to_string()),
            priority: Some(NotificationPriority::High),
            expires_at: None,
            metadata: Some(NotificationMetadata {
                source: "test_system".to_string(),
                category: "integration_test".to_string(),
                tags: vec!["test".to_string(), "integration".to_string()],
                custom_data: None,
            }),
        };
        
        // Crea la notifica
        let notification = manager.create_notification(request).await.unwrap();
        assert_eq!(notification.title, "Test Notification");
        assert_eq!(notification.profile_id, "test_profile_123");
        assert_eq!(notification.notification_type, NotificationType::System);
        assert_eq!(notification.priority, NotificationPriority::High);
        
        // Verifica che la notifica sia stata salvata
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("test_profile_123", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        assert_eq!(notifications[0].title, "Test Notification");
        assert!(!notifications[0].is_read());
        
        // Verifica il conteggio delle notifiche non lette
        let unread_count = manager.get_unread_count("test_profile_123").await.unwrap();
        assert_eq!(unread_count, 1);
        
        // Marca la notifica come letta
        assert!(manager.mark_as_read(&notification.id, "test_profile_123").await.is_ok());
        
        // Verifica che sia stata marcata come letta
        let unread_count = manager.get_unread_count("test_profile_123").await.unwrap();
        assert_eq!(unread_count, 0);
        
        // Testa le preferenze
        let preferences = manager.get_preferences("test_profile_123").await.unwrap();
        assert_eq!(preferences.profile_id, "test_profile_123");
        assert!(preferences.global_enabled);
        assert!(preferences.sound_enabled);
        
        // Elimina la notifica
        assert!(manager.delete_notification(&notification.id, "test_profile_123").await.is_ok());
        
        // Verifica che sia stata eliminata
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("test_profile_123", filter).await.unwrap();
        assert_eq!(notifications.len(), 0);
    }

    #[tokio::test]
    async fn test_notification_filtering() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_filtering.db");
        
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        // Crea diverse notifiche
        let requests = vec![
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::System,
                title: "System Notification".to_string(),
                message: "System message".to_string(),
                icon: None,
                action_url: None,
                priority: Some(NotificationPriority::High),
                expires_at: None,
                metadata: Some(NotificationMetadata {
                    source: "system".to_string(),
                    category: "system".to_string(),
                    tags: vec![],
                    custom_data: None,
                }),
            },
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::Profile,
                title: "Profile Notification".to_string(),
                message: "Profile message".to_string(),
                icon: None,
                action_url: None,
                priority: Some(NotificationPriority::Normal),
                expires_at: None,
                metadata: Some(NotificationMetadata {
                    source: "profile".to_string(),
                    category: "profile".to_string(),
                    tags: vec![],
                    custom_data: None,
                }),
            },
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::Security,
                title: "Security Alert".to_string(),
                message: "Security message".to_string(),
                icon: None,
                action_url: None,
                priority: Some(NotificationPriority::Urgent),
                expires_at: None,
                metadata: Some(NotificationMetadata {
                    source: "security".to_string(),
                    category: "security".to_string(),
                    tags: vec![],
                    custom_data: None,
                }),
            },
        ];
        
        // Crea tutte le notifiche
        for request in requests {
            manager.create_notification(request).await.unwrap();
        }
        
        // Test filtro per tipo
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::System),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let system_notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(system_notifications.len(), 1);
        assert_eq!(system_notifications[0].notification_type, NotificationType::System);
        
        // Test filtro per priorità
        let filter = NotificationFilter {
            notification_type: None,
            priority: Some(NotificationPriority::Urgent),
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let urgent_notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(urgent_notifications.len(), 1);
        assert_eq!(urgent_notifications[0].priority, NotificationPriority::Urgent);
        
        // Test filtro solo non lette
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: Some(true),
            category: None,
            limit: None,
            offset: None,
        };
        
        let unread_notifications = manager.get_notifications("test_profile", filter.clone()).await.unwrap();
        assert_eq!(unread_notifications.len(), 3); // Tutte non lette
        
        // Marca una come letta
        manager.mark_as_read(&system_notifications[0].id, "test_profile").await.unwrap();
        
        let unread_notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(unread_notifications.len(), 2); // Una in meno
    }

    #[tokio::test]
    async fn test_notification_preferences() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_preferences.db");
        
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        // Ottieni le preferenze predefinite
        let mut preferences = manager.get_preferences("test_profile").await.unwrap();
        assert!(preferences.global_enabled);
        assert_eq!(preferences.max_notifications, 50);
        assert_eq!(preferences.auto_delete_after_days, 30);
        
        // Modifica le preferenze
        preferences.global_enabled = false;
        preferences.sound_enabled = false;
        preferences.max_notifications = 100;
        
        // Salva le modifiche
        manager.update_preferences(preferences.clone()).await.unwrap();
        
        // Verifica che siano state salvate
        let updated_preferences = manager.get_preferences("test_profile").await.unwrap();
        assert!(!updated_preferences.global_enabled);
        assert!(!updated_preferences.sound_enabled);
        assert_eq!(updated_preferences.max_notifications, 100);
    }
}