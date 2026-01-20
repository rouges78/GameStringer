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

    #[tokio::test]
    async fn test_enhanced_notification_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_enhanced_creation.db");
        
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        // Test validazione avanzata
        let invalid_request = CreateNotificationRequest {
            profile_id: "".to_string(), // Profile ID vuoto
            notification_type: NotificationType::System,
            title: "Test".to_string(),
            message: "Test message".to_string(),
            icon: None,
            action_url: None,
            priority: None,
            expires_at: None,
            metadata: None,
        };
        
        // Dovrebbe fallire per profile ID vuoto
        assert!(manager.create_notification(invalid_request).await.is_err());
        
        // Test creazione con preferenze che bloccano la notifica
        let mut preferences = manager.get_preferences("test_profile").await.unwrap();
        preferences.global_enabled = false; // Disabilita tutte le notifiche
        manager.update_preferences(preferences).await.unwrap();
        
        let request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Blocked Notification".to_string(),
            message: "This should be blocked".to_string(),
            icon: None,
            action_url: None,
            priority: None,
            expires_at: None,
            metadata: None,
        };
        
        // Dovrebbe fallire perché le notifiche sono disabilitate
        assert!(manager.create_notification(request).await.is_err());
    }

    #[tokio::test]
    async fn test_advanced_notification_management() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_advanced_management.db");
        
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        // Crea diverse notifiche per testare le funzionalità avanzate
        let requests = vec![
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::System,
                title: "System 1".to_string(),
                message: "System message 1".to_string(),
                icon: None,
                action_url: None,
                priority: Some(NotificationPriority::High),
                expires_at: None,
                metadata: None,
            },
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::Profile,
                title: "Profile 1".to_string(),
                message: "Profile message 1".to_string(),
                icon: None,
                action_url: None,
                priority: Some(NotificationPriority::Normal),
                expires_at: None,
                metadata: None,
            },
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::Security,
                title: "Security 1".to_string(),
                message: "Security message 1".to_string(),
                icon: None,
                action_url: None,
                priority: Some(NotificationPriority::Urgent),
                expires_at: None,
                metadata: None,
            },
        ];
        
        let mut notification_ids = Vec::new();
        for request in requests {
            let notification = manager.create_notification(request).await.unwrap();
            notification_ids.push(notification.id);
        }
        
        // Test ordinamento per priorità
        let sorted_notifications = manager.get_notifications_sorted(
            "test_profile", 
            crate::notifications::models::NotificationSortBy::Priority, 
            false, // Decrescente (priorità più alta prima)
            None
        ).await.unwrap();
        
        assert_eq!(sorted_notifications.len(), 3);
        assert_eq!(sorted_notifications[0].priority, NotificationPriority::Urgent);
        assert_eq!(sorted_notifications[1].priority, NotificationPriority::High);
        assert_eq!(sorted_notifications[2].priority, NotificationPriority::Normal);
        
        // Test notifiche ad alta priorità non lette
        let high_priority = manager.get_high_priority_unread("test_profile").await.unwrap();
        assert_eq!(high_priority.len(), 2); // High e Urgent
        
        // Test marca multiple come lette
        let marked_count = manager.mark_multiple_as_read(
            vec![notification_ids[0].clone(), notification_ids[1].clone()], 
            "test_profile"
        ).await.unwrap();
        assert_eq!(marked_count, 2);
        
        // Test conteggi dettagliati
        let counts = manager.get_notification_counts("test_profile").await.unwrap();
        assert_eq!(counts.total, 3);
        assert_eq!(counts.unread, 1); // Solo una rimasta non letta
        assert_eq!(counts.urgent_unread, 1); // La security è ancora non letta
        
        // Test marca tutte come lette
        let marked_all = manager.mark_all_as_read("test_profile").await.unwrap();
        assert_eq!(marked_all, 1); // Solo una era rimasta non letta
        
        // Verifica che tutte siano lette
        let final_counts = manager.get_notification_counts("test_profile").await.unwrap();
        assert_eq!(final_counts.unread, 0);
    }

    #[tokio::test]
    async fn test_preferences_management() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_preferences_management.db");
        
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        // Test aggiornamenti parziali
        let partial_updates = crate::notifications::models::PartialNotificationPreferences {
            global_enabled: Some(false),
            sound_enabled: Some(false),
            max_notifications: Some(25),
            ..Default::default()
        };
        
        let updated_preferences = manager.update_partial_preferences(
            "test_profile", 
            partial_updates
        ).await.unwrap();
        
        assert!(!updated_preferences.global_enabled);
        assert!(!updated_preferences.sound_enabled);
        assert_eq!(updated_preferences.max_notifications, 25);
        assert!(updated_preferences.desktop_enabled); // Non modificato, dovrebbe rimanere true
        
        // Test toggle tipo notifica
        manager.toggle_notification_type(
            "test_profile", 
            NotificationType::System, 
            false
        ).await.unwrap();
        
        let preferences = manager.get_preferences("test_profile").await.unwrap();
        let system_preference = preferences.type_settings.get(&NotificationType::System).unwrap();
        assert!(!system_preference.enabled);
        
        // Test reset a default
        let default_preferences = manager.reset_preferences_to_default("test_profile").await.unwrap();
        assert!(default_preferences.global_enabled);
        assert!(default_preferences.sound_enabled);
        assert_eq!(default_preferences.max_notifications, 50);
        
        // Test export/import
        let exported = manager.export_preferences("test_profile").await.unwrap();
        assert!(exported.contains("test_profile"));
        
        // Modifica le preferenze
        manager.toggle_notification_type("test_profile", NotificationType::Profile, false).await.unwrap();
        
        // Importa le preferenze esportate (dovrebbe ripristinare)
        let imported_preferences = manager.import_preferences("test_profile", &exported).await.unwrap();
        let profile_preference = imported_preferences.type_settings.get(&NotificationType::Profile).unwrap();
        assert!(profile_preference.enabled); // Dovrebbe essere ripristinato a true
    }
}