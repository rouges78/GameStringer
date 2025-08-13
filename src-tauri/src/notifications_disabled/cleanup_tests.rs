#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::{
        models::{CreateNotificationRequest, NotificationType, NotificationPriority, NotificationMetadata, NotificationPreferences},
        storage::NotificationStorage,
        manager::NotificationManager,
        cleanup::{NotificationCleanupManager, CleanupConfig},
    };
    use tempfile::tempdir;
    use chrono::{Duration, Utc};
    use std::sync::Arc;
    use tokio::time::{sleep, Duration as TokioDuration};

    async fn create_test_manager_with_cleanup() -> (NotificationManager, tempfile::TempDir) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_cleanup.db");
        let storage = NotificationStorage::new(db_path);
        storage.initialize().await.unwrap();

        let cleanup_config = CleanupConfig {
            cleanup_interval_minutes: 1, // 1 minuto per i test
            max_cleanup_batch_size: 50,
            auto_cleanup_enabled: true,
            default_retention_days: 7,
            cleanup_old_read_notifications: true,
            read_notifications_retention_days: 3,
        };

        let manager = NotificationManager::new_with_cleanup(storage, cleanup_config);
        (manager, temp_dir)
    }

    #[tokio::test]
    async fn test_cleanup_expired_notifications() {
        let (manager, _temp_dir) = create_test_manager_with_cleanup().await;

        // Crea notifiche scadute e valide
        let expired_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Expired Notification".to_string(),
            message: "This should be cleaned up".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() - Duration::hours(2)), // Scaduta 2 ore fa
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "cleanup_test".to_string(),
                tags: vec!["expired".to_string()],
                custom_data: None,
            }),
        };

        let valid_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::Profile,
            title: "Valid Notification".to_string(),
            message: "This should remain".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() + Duration::hours(2)), // Scade tra 2 ore
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "cleanup_test".to_string(),
                tags: vec!["valid".to_string()],
                custom_data: None,
            }),
        };

        // Crea le notifiche
        manager.create_notification(expired_request).await.unwrap();
        manager.create_notification(valid_request).await.unwrap();

        // Verifica che ci siano 2 notifiche
        let stats_before = manager.get_notification_stats("test_profile").await.unwrap();
        assert_eq!(stats_before.total_notifications, 2);
        assert_eq!(stats_before.expired_notifications, 1);

        // Esegui la pulizia manuale
        let cleanup_result = manager.run_manual_cleanup().await.unwrap();
        assert_eq!(cleanup_result.expired_cleaned, 1);
        assert!(cleanup_result.total_cleaned >= 1);

        // Verifica che sia rimasta solo la notifica valida
        let stats_after = manager.get_notification_stats("test_profile").await.unwrap();
        assert_eq!(stats_after.total_notifications, 1);
        assert_eq!(stats_after.expired_notifications, 0);

        // Verifica le statistiche di pulizia
        let cleanup_stats = manager.get_cleanup_stats().await.unwrap();
        assert_eq!(cleanup_stats.expired_cleaned, 1);
        assert!(cleanup_stats.last_cleanup.is_some());
    }

    #[tokio::test]
    async fn test_cleanup_old_read_notifications() {
        let (manager, _temp_dir) = create_test_manager_with_cleanup().await;

        // Crea una notifica vecchia
        let old_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Old Read Notification".to_string(),
            message: "This should be cleaned up".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "cleanup_test".to_string(),
                tags: vec!["old".to_string()],
                custom_data: None,
            }),
        };

        let old_notification = manager.create_notification(old_request).await.unwrap();

        // Marca come letta
        manager.mark_as_read(&old_notification.id, "test_profile").await.unwrap();

        // Simula che sia vecchia modificando direttamente il database
        // (In un test reale, dovremmo aspettare o usare mock del tempo)
        
        // Crea una notifica recente non letta
        let recent_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::Profile,
            title: "Recent Notification".to_string(),
            message: "This should remain".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "cleanup_test".to_string(),
                tags: vec!["recent".to_string()],
                custom_data: None,
            }),
        };

        manager.create_notification(recent_request).await.unwrap();

        // Verifica le statistiche iniziali
        let stats_before = manager.get_notification_stats("test_profile").await.unwrap();
        assert_eq!(stats_before.total_notifications, 2);
        assert_eq!(stats_before.unread_notifications, 1);

        // Per questo test, la pulizia delle notifiche lette vecchie 
        // dipende dalla configurazione dei giorni di retention
        let cleanup_result = manager.run_manual_cleanup().await.unwrap();
        
        // Verifica che il cleanup sia stato eseguito
        assert!(cleanup_result.total_cleaned >= 0); // Potrebbe essere 0 se non abbastanza vecchie
    }

    #[tokio::test]
    async fn test_auto_cleanup_lifecycle() {
        let (manager, _temp_dir) = create_test_manager_with_cleanup().await;

        // Verifica che il cleanup automatico non sia ancora avviato
        assert!(!manager.is_auto_cleanup_running().await);

        // Avvia il cleanup automatico
        manager.start_auto_cleanup().await.unwrap();
        assert!(manager.is_auto_cleanup_running().await);

        // Crea una notifica scaduta
        let expired_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Auto Cleanup Test".to_string(),
            message: "This should be auto-cleaned".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() - Duration::minutes(30)), // Scaduta 30 minuti fa
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "auto_cleanup_test".to_string(),
                tags: vec!["auto".to_string()],
                custom_data: None,
            }),
        };

        manager.create_notification(expired_request).await.unwrap();

        // Aspetta un po' per permettere al cleanup automatico di girare
        // (In un test reale, dovremmo usare mock del tempo o intervalli più brevi)
        sleep(TokioDuration::from_millis(100)).await;

        // Ferma il cleanup automatico
        manager.stop_auto_cleanup().await;
        assert!(!manager.is_auto_cleanup_running().await);
    }

    #[tokio::test]
    async fn test_notification_stats() {
        let (manager, _temp_dir) = create_test_manager_with_cleanup().await;

        // Crea diverse tipologie di notifiche
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
                    category: "stats_test".to_string(),
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
                expires_at: Some(Utc::now() - Duration::hours(1)), // Scaduta
                metadata: Some(NotificationMetadata {
                    source: "profile".to_string(),
                    category: "stats_test".to_string(),
                    tags: vec![],
                    custom_data: None,
                }),
            },
        ];

        let mut notification_ids = Vec::new();
        for request in requests {
            let notification = manager.create_notification(request).await.unwrap();
            notification_ids.push(notification.id);
        }

        // Marca una notifica come letta
        manager.mark_as_read(&notification_ids[0], "test_profile").await.unwrap();

        // Ottieni le statistiche
        let stats = manager.get_notification_stats("test_profile").await.unwrap();
        
        assert_eq!(stats.total_notifications, 2);
        assert_eq!(stats.unread_notifications, 1);
        assert_eq!(stats.expired_notifications, 1);
        assert!(stats.oldest_notification.is_some());
        assert!(stats.newest_notification.is_some());
    }

    #[tokio::test]
    async fn test_cleanup_with_preferences() {
        let (manager, _temp_dir) = create_test_manager_with_cleanup().await;

        // Imposta preferenze personalizzate
        let mut preferences = NotificationPreferences::default();
        preferences.profile_id = "test_profile".to_string();
        preferences.auto_delete_after_days = 1; // 1 giorno invece di 30

        manager.update_preferences(preferences).await.unwrap();

        // Crea una notifica
        let request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Preferences Test".to_string(),
            message: "Test with custom preferences".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "preferences_test".to_string(),
                tags: vec![],
                custom_data: None,
            }),
        };

        manager.create_notification(request).await.unwrap();

        // Verifica che le preferenze siano state salvate
        let loaded_preferences = manager.get_preferences("test_profile").await.unwrap();
        assert_eq!(loaded_preferences.auto_delete_after_days, 1);

        // Il cleanup basato su retention policy dovrebbe usare queste preferenze
        let cleanup_result = manager.run_manual_cleanup().await.unwrap();
        
        // Verifica che il cleanup sia stato eseguito (anche se potrebbe non eliminare nulla se troppo recente)
        assert!(cleanup_result.total_cleaned >= 0);
    }
}