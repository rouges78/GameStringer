#[cfg(test)]
mod manager_tests {
    use super::*;
    use crate::notifications::{
        manager::NotificationManager,
        storage::NotificationStorage,
        models::{
            CreateNotificationRequest, NotificationFilter, NotificationMetadata, 
            NotificationType, NotificationPriority, NotificationPreferences,
            PartialNotificationPreferences, QuietHoursSettings, TypePreference,
            NotificationSortBy
        },
        cleanup::{CleanupConfig, CleanupStats},
        errors::NotificationError,
    };
    use tempfile::tempdir;
    use chrono::{Utc, Duration};
    use std::collections::HashMap;

    /// Helper per creare un manager di test
    async fn create_test_manager() -> NotificationManager {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_notifications.db");
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        manager
    }

    /// Helper per creare un manager con cleanup automatico
    async fn create_test_manager_with_cleanup() -> NotificationManager {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_notifications_cleanup.db");
        let storage = NotificationStorage::new(db_path);
        
        let cleanup_config = CleanupConfig {
            cleanup_interval_minutes: 1440, // 24 ore in minuti
            max_cleanup_batch_size: 50,
            auto_cleanup_enabled: true,
            default_retention_days: 30,
            cleanup_old_read_notifications: true,
            read_notifications_retention_days: 7,
        };
        
        let manager = NotificationManager::new_with_cleanup(storage, cleanup_config);
        manager.initialize().await.unwrap();
        manager
    }

    /// Helper per creare una richiesta di notifica di test
    fn create_test_notification_request(profile_id: &str) -> CreateNotificationRequest {
        CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: NotificationType::System,
            title: "Test Notification".to_string(),
            message: "This is a test notification".to_string(),
            icon: Some("test-icon".to_string()),
            action_url: Some("/test".to_string()),
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "test_category".to_string(),
                tags: vec!["test".to_string()],
                custom_data: None,
            }),
        }
    }

    #[tokio::test]
    async fn test_manager_initialization() {
        let manager = create_test_manager().await;
        
        // Il manager dovrebbe essere inizializzato correttamente
        // Testiamo creando una notifica
        let request = create_test_notification_request("test_profile");
        let result = manager.create_notification(request).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_notification_success() {
        let manager = create_test_manager().await;
        let request = create_test_notification_request("test_profile");
        
        let notification = manager.create_notification(request).await.unwrap();
        
        assert_eq!(notification.title, "Test Notification");
        assert_eq!(notification.profile_id, "test_profile");
        assert_eq!(notification.notification_type, NotificationType::System);
        assert_eq!(notification.priority, NotificationPriority::Normal);
        assert!(!notification.is_read());
        assert!(!notification.is_expired());
    }

    #[tokio::test]
    async fn test_create_notification_validation_errors() {
        let manager = create_test_manager().await;
        
        // Test titolo vuoto
        let mut request = create_test_notification_request("test_profile");
        request.title = "".to_string();
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test messaggio vuoto
        let mut request = create_test_notification_request("test_profile");
        request.message = "".to_string();
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test profile_id vuoto
        let mut request = create_test_notification_request("test_profile");
        request.profile_id = "".to_string();
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test titolo troppo lungo
        let mut request = create_test_notification_request("test_profile");
        request.title = "a".repeat(201);
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test messaggio troppo lungo
        let mut request = create_test_notification_request("test_profile");
        request.message = "a".repeat(1001);
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
    }

    #[tokio::test]
    async fn test_create_notification_with_preferences_blocking() {
        let manager = create_test_manager().await;
        
        // Disabilita le notifiche globalmente
        let mut preferences = manager.get_preferences("test_profile").await.unwrap();
        preferences.global_enabled = false;
        manager.update_preferences(preferences).await.unwrap();
        
        // Prova a creare una notifica
        let request = create_test_notification_request("test_profile");
        let result = manager.create_notification(request).await;
        
        // Dovrebbe fallire perché le notifiche sono disabilitate
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
    }

    #[tokio::test]
    async fn test_get_notifications_with_filters() {
        let manager = create_test_manager().await;
        
        // Crea diverse notifiche
        let requests = vec![
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::System,
                title: "System Notification".to_string(),
                message: "System message".to_string(),
                priority: Some(NotificationPriority::High),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::Profile,
                title: "Profile Notification".to_string(),
                message: "Profile message".to_string(),
                priority: Some(NotificationPriority::Normal),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                profile_id: "test_profile".to_string(),
                notification_type: NotificationType::Security,
                title: "Security Alert".to_string(),
                message: "Security message".to_string(),
                priority: Some(NotificationPriority::Urgent),
                ..create_test_notification_request("test_profile")
            },
        ];
        
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
        
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        assert_eq!(notifications[0].notification_type, NotificationType::System);
        
        // Test filtro per priorità
        let filter = NotificationFilter {
            notification_type: None,
            priority: Some(NotificationPriority::Urgent),
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        assert_eq!(notifications[0].priority, NotificationPriority::Urgent);
        
        // Test filtro solo non lette
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: Some(true),
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 3); // Tutte non lette
    }

    #[tokio::test]
    async fn test_mark_as_read_functionality() {
        let manager = create_test_manager().await;
        let request = create_test_notification_request("test_profile");
        let notification = manager.create_notification(request).await.unwrap();
        
        // Verifica che sia inizialmente non letta
        assert!(!notification.is_read());
        let unread_count = manager.get_unread_count("test_profile").await.unwrap();
        assert_eq!(unread_count, 1);
        
        // Marca come letta
        manager.mark_as_read(&notification.id, "test_profile").await.unwrap();
        
        // Verifica che sia stata marcata come letta
        let unread_count = manager.get_unread_count("test_profile").await.unwrap();
        assert_eq!(unread_count, 0);
        
        // Verifica che marcare di nuovo come letta non dia errore
        let result = manager.mark_as_read(&notification.id, "test_profile").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_mark_multiple_as_read() {
        let manager = create_test_manager().await;
        
        // Crea tre notifiche
        let mut notification_ids = Vec::new();
        for i in 0..3 {
            let mut request = create_test_notification_request("test_profile");
            request.title = format!("Notification {}", i);
            let notification = manager.create_notification(request).await.unwrap();
            notification_ids.push(notification.id);
        }
        
        // Verifica che ci siano 3 notifiche non lette
        let unread_count = manager.get_unread_count("test_profile").await.unwrap();
        assert_eq!(unread_count, 3);
        
        // Marca due come lette
        let marked_count = manager.mark_multiple_as_read(
            vec![notification_ids[0].clone(), notification_ids[1].clone()],
            "test_profile"
        ).await.unwrap();
        
        assert_eq!(marked_count, 2);
        
        // Verifica che rimanga solo una non letta
        let unread_count = manager.get_unread_count("test_profile").await.unwrap();
        assert_eq!(unread_count, 1);
    }

    #[tokio::test]
    async fn test_mark_all_as_read() {
        let manager = create_test_manager().await;
        
        // Crea cinque notifiche
        for i in 0..5 {
            let mut request = create_test_notification_request("test_profile");
            request.title = format!("Notification {}", i);
            manager.create_notification(request).await.unwrap();
        }
        
        // Verifica che ci siano 5 notifiche non lette
        let unread_count = manager.get_unread_count("test_profile").await.unwrap();
        assert_eq!(unread_count, 5);
        
        // Marca tutte come lette
        let marked_count = manager.mark_all_as_read("test_profile").await.unwrap();
        assert_eq!(marked_count, 5);
        
        // Verifica che non ci siano più notifiche non lette
        let unread_count = manager.get_unread_count("test_profile").await.unwrap();
        assert_eq!(unread_count, 0);
    }

    #[tokio::test]
    async fn test_delete_notification() {
        let manager = create_test_manager().await;
        let request = create_test_notification_request("test_profile");
        let notification = manager.create_notification(request).await.unwrap();
        
        // Verifica che la notifica esista
        let filter = NotificationFilter::default();
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        // Elimina la notifica
        manager.delete_notification(&notification.id, "test_profile").await.unwrap();
        
        // Verifica che sia stata eliminata
        let filter = NotificationFilter::default();
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 0);
    }

    #[tokio::test]
    async fn test_delete_nonexistent_notification() {
        let manager = create_test_manager().await;
        
        // Prova a eliminare una notifica inesistente
        let result = manager.delete_notification("nonexistent_id", "test_profile").await;
        assert!(matches!(result, Err(NotificationError::NotificationNotFound(_))));
    }

    #[tokio::test]
    async fn test_unauthorized_profile_access() {
        let manager = create_test_manager().await;
        let request = create_test_notification_request("profile_a");
        let notification = manager.create_notification(request).await.unwrap();
        
        // Prova ad accedere con un profilo diverso
        let result = manager.mark_as_read(&notification.id, "profile_b").await;
        assert!(matches!(result, Err(NotificationError::UnauthorizedProfile)));
        
        let result = manager.delete_notification(&notification.id, "profile_b").await;
        assert!(matches!(result, Err(NotificationError::UnauthorizedProfile)));
    }

    #[tokio::test]
    async fn test_notification_counts() {
        let manager = create_test_manager().await;
        
        // Crea notifiche con diverse priorità
        let requests = vec![
            CreateNotificationRequest {
                priority: Some(NotificationPriority::Urgent),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                priority: Some(NotificationPriority::High),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                priority: Some(NotificationPriority::Normal),
                ..create_test_notification_request("test_profile")
            },
        ];
        
        let mut notification_ids = Vec::new();
        for request in requests {
            let notification = manager.create_notification(request).await.unwrap();
            notification_ids.push(notification.id);
        }
        
        // Verifica i conteggi
        let counts = manager.get_notification_counts("test_profile").await.unwrap();
        assert_eq!(counts.total, 3);
        assert_eq!(counts.unread, 3);
        assert_eq!(counts.urgent_unread, 1);
        assert_eq!(counts.high_priority_unread, 1);
        
        // Marca una come letta
        manager.mark_as_read(&notification_ids[0], "test_profile").await.unwrap();
        
        let counts = manager.get_notification_counts("test_profile").await.unwrap();
        assert_eq!(counts.total, 3);
        assert_eq!(counts.unread, 2);
        assert_eq!(counts.urgent_unread, 0); // Era quella urgente
    }

    #[tokio::test]
    async fn test_preferences_management() {
        let manager = create_test_manager().await;
        
        // Ottieni le preferenze predefinite
        let preferences = manager.get_preferences("test_profile").await.unwrap();
        assert!(preferences.global_enabled);
        assert!(preferences.sound_enabled);
        assert_eq!(preferences.max_notifications, 50);
        
        // Modifica le preferenze
        let mut updated_preferences = preferences.clone();
        updated_preferences.global_enabled = false;
        updated_preferences.sound_enabled = false;
        updated_preferences.max_notifications = 25;
        
        manager.update_preferences(updated_preferences).await.unwrap();
        
        // Verifica che siano state salvate
        let saved_preferences = manager.get_preferences("test_profile").await.unwrap();
        assert!(!saved_preferences.global_enabled);
        assert!(!saved_preferences.sound_enabled);
        assert_eq!(saved_preferences.max_notifications, 25);
    }

    #[tokio::test]
    async fn test_partial_preferences_update() {
        let manager = create_test_manager().await;
        
        // Aggiornamento parziale
        let partial_update = PartialNotificationPreferences {
            global_enabled: Some(false),
            max_notifications: Some(75),
            ..Default::default()
        };
        
        let updated_preferences = manager.update_partial_preferences(
            "test_profile", 
            partial_update
        ).await.unwrap();
        
        assert!(!updated_preferences.global_enabled);
        assert_eq!(updated_preferences.max_notifications, 75);
        assert!(updated_preferences.sound_enabled); // Non modificato, dovrebbe rimanere true
    }

    #[tokio::test]
    async fn test_toggle_notification_type() {
        let manager = create_test_manager().await;
        
        // Disabilita le notifiche di sistema
        manager.toggle_notification_type(
            "test_profile", 
            NotificationType::System, 
            false
        ).await.unwrap();
        
        let preferences = manager.get_preferences("test_profile").await.unwrap();
        let system_preference = preferences.type_settings.get(&NotificationType::System).unwrap();
        assert!(!system_preference.enabled);
        
        // Riabilita
        manager.toggle_notification_type(
            "test_profile", 
            NotificationType::System, 
            true
        ).await.unwrap();
        
        let preferences = manager.get_preferences("test_profile").await.unwrap();
        let system_preference = preferences.type_settings.get(&NotificationType::System).unwrap();
        assert!(system_preference.enabled);
    }

    #[tokio::test]
    async fn test_quiet_hours_functionality() {
        let manager = create_test_manager().await;
        
        // Configura ore di silenzio
        let quiet_hours = QuietHoursSettings {
            enabled: true,
            start_time: "22:00".to_string(),
            end_time: "06:00".to_string(),
            allow_urgent: true,
        };
        
        manager.update_quiet_hours("test_profile", Some(quiet_hours)).await.unwrap();
        
        let preferences = manager.get_preferences("test_profile").await.unwrap();
        assert!(preferences.quiet_hours.is_some());
        
        let qh = preferences.quiet_hours.unwrap();
        assert!(qh.enabled);
        assert_eq!(qh.start_time, "22:00");
        assert_eq!(qh.end_time, "06:00");
        assert!(qh.allow_urgent);
    }

    #[tokio::test]
    async fn test_notification_sorting() {
        let manager = create_test_manager().await;
        
        // Crea notifiche con diverse priorità
        let requests = vec![
            CreateNotificationRequest {
                title: "Low Priority".to_string(),
                priority: Some(NotificationPriority::Low),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                title: "Urgent Priority".to_string(),
                priority: Some(NotificationPriority::Urgent),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                title: "Normal Priority".to_string(),
                priority: Some(NotificationPriority::Normal),
                ..create_test_notification_request("test_profile")
            },
        ];
        
        for request in requests {
            manager.create_notification(request).await.unwrap();
        }
        
        // Test ordinamento per priorità (decrescente)
        let sorted_notifications = manager.get_notifications_sorted(
            "test_profile",
            NotificationSortBy::Priority,
            false, // Decrescente
            None
        ).await.unwrap();
        
        assert_eq!(sorted_notifications.len(), 3);
        assert_eq!(sorted_notifications[0].priority, NotificationPriority::Urgent);
        assert_eq!(sorted_notifications[1].priority, NotificationPriority::Normal);
        assert_eq!(sorted_notifications[2].priority, NotificationPriority::Low);
    }

    #[tokio::test]
    async fn test_high_priority_unread_notifications() {
        let manager = create_test_manager().await;
        
        // Crea notifiche con diverse priorità
        let requests = vec![
            CreateNotificationRequest {
                priority: Some(NotificationPriority::Low),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                priority: Some(NotificationPriority::High),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                priority: Some(NotificationPriority::Urgent),
                ..create_test_notification_request("test_profile")
            },
            CreateNotificationRequest {
                priority: Some(NotificationPriority::Normal),
                ..create_test_notification_request("test_profile")
            },
        ];
        
        for request in requests {
            manager.create_notification(request).await.unwrap();
        }
        
        // Ottieni solo le notifiche ad alta priorità non lette
        let high_priority = manager.get_high_priority_unread("test_profile").await.unwrap();
        
        assert_eq!(high_priority.len(), 2); // High e Urgent
        assert!(high_priority.iter().any(|n| n.priority == NotificationPriority::High));
        assert!(high_priority.iter().any(|n| n.priority == NotificationPriority::Urgent));
        
        // Verifica che siano ordinate correttamente (urgenti prima)
        assert_eq!(high_priority[0].priority, NotificationPriority::Urgent);
    }

    #[tokio::test]
    async fn test_clear_all_notifications() {
        let manager = create_test_manager().await;
        
        // Crea diverse notifiche
        for i in 0..5 {
            let mut request = create_test_notification_request("test_profile");
            request.title = format!("Notification {}", i);
            manager.create_notification(request).await.unwrap();
        }
        
        // Verifica che ci siano 5 notifiche
        let filter = NotificationFilter::default();
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 5);
        
        // Elimina tutte le notifiche
        let deleted_count = manager.clear_all_notifications("test_profile").await.unwrap();
        assert_eq!(deleted_count, 5);
        
        // Verifica che non ci siano più notifiche
        let filter = NotificationFilter::default();
        let notifications = manager.get_notifications("test_profile", filter).await.unwrap();
        assert_eq!(notifications.len(), 0);
    }

    #[tokio::test]
    async fn test_reset_preferences_to_default() {
        let manager = create_test_manager().await;
        
        // Modifica le preferenze
        let mut preferences = manager.get_preferences("test_profile").await.unwrap();
        preferences.global_enabled = false;
        preferences.sound_enabled = false;
        preferences.max_notifications = 10;
        manager.update_preferences(preferences).await.unwrap();
        
        // Verifica che siano state modificate
        let modified_preferences = manager.get_preferences("test_profile").await.unwrap();
        assert!(!modified_preferences.global_enabled);
        assert!(!modified_preferences.sound_enabled);
        assert_eq!(modified_preferences.max_notifications, 10);
        
        // Reset a default
        let default_preferences = manager.reset_preferences_to_default("test_profile").await.unwrap();
        
        // Verifica che siano tornate ai valori predefiniti
        assert!(default_preferences.global_enabled);
        assert!(default_preferences.sound_enabled);
        assert_eq!(default_preferences.max_notifications, 50);
    }

    #[tokio::test]
    async fn test_notification_expiration() {
        let manager = create_test_manager().await;
        
        // Crea una notifica già scaduta
        let mut request = create_test_notification_request("test_profile");
        request.expires_at = Some(Utc::now() - Duration::hours(1)); // Scaduta un'ora fa
        
        let notification = manager.create_notification(request).await.unwrap();
        assert!(notification.is_expired());
        
        // Crea una notifica che scade in futuro
        let mut request = create_test_notification_request("test_profile");
        request.expires_at = Some(Utc::now() + Duration::hours(1)); // Scade tra un'ora
        
        let notification = manager.create_notification(request).await.unwrap();
        assert!(!notification.is_expired());
    }

    #[tokio::test]
    async fn test_notification_metadata_validation() {
        let manager = create_test_manager().await;
        
        // Test metadati con troppi tag
        let mut request = create_test_notification_request("test_profile");
        request.metadata = Some(NotificationMetadata {
            source: "test".to_string(),
            category: "test".to_string(),
            tags: (0..15).map(|i| format!("tag_{}", i)).collect(), // Troppi tag (max 10)
            custom_data: None,
        });
        
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test metadati con source vuoto
        let mut request = create_test_notification_request("test_profile");
        request.metadata = Some(NotificationMetadata {
            source: "".to_string(), // Source vuoto
            category: "test".to_string(),
            tags: vec![],
            custom_data: None,
        });
        
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
    }

    #[tokio::test]
    async fn test_manager_with_cleanup() {
        let manager = create_test_manager_with_cleanup().await;
        
        // Il manager con cleanup dovrebbe funzionare normalmente
        let request = create_test_notification_request("test_profile");
        let notification = manager.create_notification(request).await.unwrap();
        
        assert_eq!(notification.title, "Test Notification");
        assert_eq!(notification.profile_id, "test_profile");
    }

    #[tokio::test]
    async fn test_filter_validation() {
        let manager = create_test_manager().await;
        
        // Test limite troppo alto
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: Some(2000), // Troppo alto (max 1000)
            offset: None,
        };
        
        let result = manager.get_notifications("test_profile", filter).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test offset troppo alto
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: Some(200000), // Troppo alto (max 100000)
        };
        
        let result = manager.get_notifications("test_profile", filter).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
    }
}

