#[cfg(test)]
mod profile_isolation_tests {
    use super::*;
    use crate::notifications::{
        models::{CreateNotificationRequest, NotificationType, NotificationPriority, NotificationFilter},
        storage::NotificationStorage,
        manager::NotificationManager,
        access_control::NotificationAccessControl,
    };
    use chrono::Utc;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    async fn create_test_manager() -> NotificationManager {
        let storage = NotificationStorage::new("test_profile_isolation.db".into()).unwrap();
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        manager
    }

    #[tokio::test]
    async fn test_profile_isolation_basic() {
        let manager = create_test_manager().await;
        
        // Crea notifiche per due profili diversi
        let profile1_id = "profile1";
        let profile2_id = "profile2";
        
        let request1 = CreateNotificationRequest {
            profile_id: profile1_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Notifica Profilo 1".to_string(),
            message: "Messaggio per profilo 1".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: None,
        };
        
        let request2 = CreateNotificationRequest {
            profile_id: profile2_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Notifica Profilo 2".to_string(),
            message: "Messaggio per profilo 2".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: None,
        };
        
        // Crea le notifiche
        let notification1 = manager.create_notification(request1).await.unwrap();
        let notification2 = manager.create_notification(request2).await.unwrap();
        
        // Verifica che ogni profilo veda solo le proprie notifiche
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let profile1_notifications = manager.get_notifications(profile1_id, filter.clone()).await.unwrap();
        let profile2_notifications = manager.get_notifications(profile2_id, filter).await.unwrap();
        
        // Profilo 1 dovrebbe vedere solo la sua notifica
        assert_eq!(profile1_notifications.len(), 1);
        assert_eq!(profile1_notifications[0].id, notification1.id);
        assert_eq!(profile1_notifications[0].profile_id, profile1_id);
        
        // Profilo 2 dovrebbe vedere solo la sua notifica
        assert_eq!(profile2_notifications.len(), 1);
        assert_eq!(profile2_notifications[0].id, notification2.id);
        assert_eq!(profile2_notifications[0].profile_id, profile2_id);
    }

    #[tokio::test]
    async fn test_unauthorized_access_prevention() {
        let manager = create_test_manager().await;
        
        let profile1_id = "profile1";
        let profile2_id = "profile2";
        
        // Crea una notifica per il profilo 1
        let request = CreateNotificationRequest {
            profile_id: profile1_id.to_string(),
            notification_type: NotificationType::Profile,
            title: "Notifica Privata".to_string(),
            message: "Messaggio privato".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: None,
            metadata: None,
        };
        
        let notification = manager.create_notification(request).await.unwrap();
        
        // Il profilo 2 non dovrebbe poter marcare come letta la notifica del profilo 1
        let result = manager.mark_as_read(&notification.id, profile2_id).await;
        assert!(result.is_err());
        
        // Il profilo 2 non dovrebbe poter eliminare la notifica del profilo 1
        let result = manager.delete_notification(&notification.id, profile2_id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_access_control_filtering() {
        // Crea notifiche per test
        let notifications = vec![
            crate::notifications::models::Notification {
                id: "notif1".to_string(),
                profile_id: "profile1".to_string(),
                notification_type: NotificationType::Profile,
                title: "Test 1".to_string(),
                message: "Message 1".to_string(),
                icon: None,
                action_url: None,
                priority: NotificationPriority::Normal,
                created_at: Utc::now(),
                read_at: None,
                expires_at: None,
                metadata: Default::default(),
            },
            crate::notifications::models::Notification {
                id: "notif2".to_string(),
                profile_id: "profile2".to_string(),
                notification_type: NotificationType::Profile,
                title: "Test 2".to_string(),
                message: "Message 2".to_string(),
                icon: None,
                action_url: None,
                priority: NotificationPriority::Normal,
                created_at: Utc::now(),
                read_at: None,
                expires_at: None,
                metadata: Default::default(),
            },
            crate::notifications::models::Notification {
                id: "notif3".to_string(),
                profile_id: "profile1".to_string(),
                notification_type: NotificationType::Security,
                title: "Test 3".to_string(),
                message: "Message 3".to_string(),
                icon: None,
                action_url: None,
                priority: NotificationPriority::High,
                created_at: Utc::now(),
                read_at: None,
                expires_at: None,
                metadata: Default::default(),
            },
        ];
        
        // Filtra per profilo 1
        let profile1_notifications = NotificationAccessControl::filter_notifications_for_profile("profile1", notifications.clone());
        assert_eq!(profile1_notifications.len(), 2);
        assert!(profile1_notifications.iter().all(|n| n.profile_id == "profile1"));
        
        // Filtra per profilo 2
        let profile2_notifications = NotificationAccessControl::filter_notifications_for_profile("profile2", notifications);
        assert_eq!(profile2_notifications.len(), 1);
        assert!(profile2_notifications.iter().all(|n| n.profile_id == "profile2"));
    }

    #[tokio::test]
    async fn test_profile_switch_cleanup() {
        // Test che il cambio profilo venga gestito correttamente
        let result = NotificationAccessControl::cleanup_notifications_on_profile_switch(
            Some("old_profile"),
            "new_profile"
        );
        assert!(result.is_ok());
        
        // Test primo accesso
        let result = NotificationAccessControl::cleanup_notifications_on_profile_switch(
            None,
            "new_profile"
        );
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_notification_integrity_verification() {
        // Test notifica valida
        let valid_notification = crate::notifications::models::Notification {
            id: "valid_id".to_string(),
            profile_id: "profile1".to_string(),
            notification_type: NotificationType::Profile,
            title: "Valid Title".to_string(),
            message: "Valid Message".to_string(),
            icon: None,
            action_url: None,
            priority: NotificationPriority::Normal,
            created_at: Utc::now(),
            read_at: None,
            expires_at: None,
            metadata: Default::default(),
        };
        
        let result = NotificationAccessControl::verify_notification_integrity(&valid_notification);
        assert!(result.is_ok());
        
        // Test notifica con ID vuoto
        let mut invalid_notification = valid_notification.clone();
        invalid_notification.id = String::new();
        
        let result = NotificationAccessControl::verify_notification_integrity(&invalid_notification);
        assert!(result.is_err());
        
        // Test notifica con profile_id vuoto
        let mut invalid_notification = valid_notification.clone();
        invalid_notification.profile_id = String::new();
        
        let result = NotificationAccessControl::verify_notification_integrity(&invalid_notification);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_security_report_generation() {
        let notifications = vec![
            crate::notifications::models::Notification {
                id: "notif1".to_string(),
                profile_id: "profile1".to_string(),
                notification_type: NotificationType::Profile,
                title: "Test 1".to_string(),
                message: "Message 1".to_string(),
                icon: None,
                action_url: None,
                priority: NotificationPriority::Normal,
                created_at: Utc::now(),
                read_at: None,
                expires_at: None,
                metadata: Default::default(),
            },
            crate::notifications::models::Notification {
                id: "notif2".to_string(),
                profile_id: "profile1".to_string(),
                notification_type: NotificationType::Security,
                title: "Test 2".to_string(),
                message: "Message 2".to_string(),
                icon: None,
                action_url: None,
                priority: NotificationPriority::High,
                created_at: Utc::now(),
                read_at: None,
                expires_at: None,
                metadata: Default::default(),
            },
        ];
        
        let report = NotificationAccessControl::generate_security_report("profile1", &notifications);
        
        assert_eq!(report.profile_id, "profile1");
        assert_eq!(report.total_notifications, 2);
        assert_eq!(report.integrity_violations, 0);
        assert_eq!(report.access_violations, 0);
        assert!(!report.has_security_issues());
        
        // Verifica conteggi per tipo
        assert_eq!(report.notifications_by_type.get(&NotificationType::Profile), Some(&1));
        assert_eq!(report.notifications_by_type.get(&NotificationType::Security), Some(&1));
    }

    #[tokio::test]
    async fn test_notification_quota_enforcement() {
        // Test quota normale
        let result = NotificationAccessControl::check_notification_quota("profile1", 10, 50);
        assert!(result.is_ok());
        
        // Test quota raggiunta
        let result = NotificationAccessControl::check_notification_quota("profile1", 50, 50);
        assert!(result.is_err());
        
        // Test quota superata
        let result = NotificationAccessControl::check_notification_quota("profile1", 60, 50);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_permission_checks() {
        let notification = crate::notifications::models::Notification {
            id: "test_id".to_string(),
            profile_id: "profile1".to_string(),
            notification_type: NotificationType::Profile,
            title: "Test".to_string(),
            message: "Test Message".to_string(),
            icon: None,
            action_url: None,
            priority: NotificationPriority::Normal,
            created_at: Utc::now(),
            read_at: None,
            expires_at: None,
            metadata: Default::default(),
        };
        
        // Test accesso autorizzato
        assert!(NotificationAccessControl::can_access_notification("profile1", &notification));
        assert!(NotificationAccessControl::can_delete_notification("profile1", &notification));
        assert!(NotificationAccessControl::can_mark_notification_as_read("profile1", &notification));
        
        // Test accesso non autorizzato
        assert!(!NotificationAccessControl::can_access_notification("profile2", &notification));
        assert!(!NotificationAccessControl::can_delete_notification("profile2", &notification));
        assert!(!NotificationAccessControl::can_mark_notification_as_read("profile2", &notification));
        
        // Test preferenze
        assert!(NotificationAccessControl::can_update_notification_preferences("profile1", "profile1"));
        assert!(!NotificationAccessControl::can_update_notification_preferences("profile1", "profile2"));
        
        // Test creazione notifiche
        assert!(NotificationAccessControl::can_create_notification_for_profile("profile1", "profile1"));
        assert!(!NotificationAccessControl::can_create_notification_for_profile("profile1", "profile2"));
    }
}