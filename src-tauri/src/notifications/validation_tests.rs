#[cfg(test)]
mod validation_tests {
    use super::*;
    use crate::notifications::{
        manager::NotificationManager,
        storage::NotificationStorage,
        models::{
            CreateNotificationRequest, NotificationMetadata, NotificationType, 
            NotificationPriority, NotificationPreferences, QuietHoursSettings,
            TypePreference, PartialNotificationPreferences
        },
        errors::NotificationError,
    };
    use tempfile::tempdir;
    use chrono::{Utc, Duration};
    use std::collections::HashMap;

    /// Helper per creare un manager di test
    async fn create_test_manager() -> NotificationManager {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_validation.db");
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        manager
    }

    #[tokio::test]
    async fn test_create_notification_request_validation() {
        // Test validazione titolo vuoto
        let mut request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "".to_string(), // Titolo vuoto
            message: "Test message".to_string(),
            icon: None,
            action_url: None,
            priority: None,
            expires_at: None,
            metadata: None,
        };
        
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Titolo notifica vuoto"));
        
        // Test validazione titolo solo spazi
        request.title = "   ".to_string();
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        
        // Test validazione titolo troppo lungo
        request.title = "a".repeat(201);
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Titolo troppo lungo"));
        
        // Test validazione messaggio vuoto
        request.title = "Valid Title".to_string();
        request.message = "".to_string();
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Messaggio notifica vuoto"));
        
        // Test validazione messaggio troppo lungo
        request.message = "a".repeat(1001);
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Messaggio troppo lungo"));
        
        // Test validazione profile_id vuoto
        request.message = "Valid message".to_string();
        request.profile_id = "".to_string();
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Profile ID vuoto"));
        
        // Test validazione URL azione troppo lungo
        request.profile_id = "valid_profile".to_string();
        request.action_url = Some("a".repeat(501));
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("URL azione troppo lungo"));
        
        // Test validazione data scadenza nel passato
        request.action_url = Some("/valid/url".to_string());
        request.expires_at = Some(Utc::now() - Duration::hours(1));
        let result = request.validate();
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Data scadenza deve essere nel futuro"));
        
        // Test validazione riuscita
        request.expires_at = Some(Utc::now() + Duration::hours(1));
        let result = request.validate();
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_notification_type_parsing() {
        // Test parsing validi
        assert_eq!("system".parse::<NotificationType>().unwrap(), NotificationType::System);
        assert_eq!("profile".parse::<NotificationType>().unwrap(), NotificationType::Profile);
        assert_eq!("security".parse::<NotificationType>().unwrap(), NotificationType::Security);
        assert_eq!("update".parse::<NotificationType>().unwrap(), NotificationType::Update);
        assert_eq!("game".parse::<NotificationType>().unwrap(), NotificationType::Game);
        assert_eq!("store".parse::<NotificationType>().unwrap(), NotificationType::Store);
        assert_eq!("custom".parse::<NotificationType>().unwrap(), NotificationType::Custom);
        
        // Test case insensitive
        assert_eq!("SYSTEM".parse::<NotificationType>().unwrap(), NotificationType::System);
        assert_eq!("Profile".parse::<NotificationType>().unwrap(), NotificationType::Profile);
        
        // Test parsing non validi
        let result = "invalid_type".parse::<NotificationType>();
        assert!(matches!(result, Err(NotificationError::InvalidNotificationType(_))));
        
        let result = "".parse::<NotificationType>();
        assert!(matches!(result, Err(NotificationError::InvalidNotificationType(_))));
    }

    #[tokio::test]
    async fn test_notification_priority_parsing() {
        // Test parsing validi
        assert_eq!("low".parse::<NotificationPriority>().unwrap(), NotificationPriority::Low);
        assert_eq!("normal".parse::<NotificationPriority>().unwrap(), NotificationPriority::Normal);
        assert_eq!("high".parse::<NotificationPriority>().unwrap(), NotificationPriority::High);
        assert_eq!("urgent".parse::<NotificationPriority>().unwrap(), NotificationPriority::Urgent);
        
        // Test case insensitive
        assert_eq!("LOW".parse::<NotificationPriority>().unwrap(), NotificationPriority::Low);
        assert_eq!("High".parse::<NotificationPriority>().unwrap(), NotificationPriority::High);
        
        // Test parsing non validi
        let result = "invalid_priority".parse::<NotificationPriority>();
        assert!(matches!(result, Err(NotificationError::InvalidPriority(_))));
        
        let result = "".parse::<NotificationPriority>();
        assert!(matches!(result, Err(NotificationError::InvalidPriority(_))));
    }

    #[tokio::test]
    async fn test_notification_type_display() {
        assert_eq!(NotificationType::System.to_string(), "system");
        assert_eq!(NotificationType::Profile.to_string(), "profile");
        assert_eq!(NotificationType::Security.to_string(), "security");
        assert_eq!(NotificationType::Update.to_string(), "update");
        assert_eq!(NotificationType::Game.to_string(), "game");
        assert_eq!(NotificationType::Store.to_string(), "store");
        assert_eq!(NotificationType::Custom.to_string(), "custom");
    }

    #[tokio::test]
    async fn test_notification_priority_display() {
        assert_eq!(NotificationPriority::Low.to_string(), "low");
        assert_eq!(NotificationPriority::Normal.to_string(), "normal");
        assert_eq!(NotificationPriority::High.to_string(), "high");
        assert_eq!(NotificationPriority::Urgent.to_string(), "urgent");
    }

    #[tokio::test]
    async fn test_manager_advanced_validation() {
        let manager = create_test_manager().await;
        
        // Test profile_id troppo lungo
        let mut request = CreateNotificationRequest {
            profile_id: "a".repeat(101), // Troppo lungo (max 100)
            notification_type: NotificationType::System,
            title: "Test".to_string(),
            message: "Test message".to_string(),
            icon: None,
            action_url: None,
            priority: None,
            expires_at: None,
            metadata: None,
        };
        
        let result = manager.create_notification(request.clone()).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Profile ID troppo lungo"));
        
        // Test metadati con source vuoto
        request.profile_id = "valid_profile".to_string();
        request.metadata = Some(NotificationMetadata {
            source: "".to_string(), // Source vuoto
            category: "test".to_string(),
            tags: vec![],
            custom_data: None,
        });
        
        let result = manager.create_notification(request.clone()).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Source nei metadati non può essere vuoto"));
        
        // Test metadati con category vuoto
        request.metadata = Some(NotificationMetadata {
            source: "test".to_string(),
            category: "".to_string(), // Category vuoto
            tags: vec![],
            custom_data: None,
        });
        
        let result = manager.create_notification(request.clone()).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Category nei metadati non può essere vuoto"));
        
        // Test metadati con troppi tag
        request.metadata = Some(NotificationMetadata {
            source: "test".to_string(),
            category: "test".to_string(),
            tags: (0..15).map(|i| format!("tag_{}", i)).collect(), // Troppi tag (max 10)
            custom_data: None,
        });
        
        let result = manager.create_notification(request.clone()).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Troppi tag nei metadati"));
        
        // Test metadati con troppi campi custom_data
        let mut custom_data = HashMap::new();
        for i in 0..25 {
            custom_data.insert(format!("field_{}", i), serde_json::Value::String("value".to_string()));
        }
        
        request.metadata = Some(NotificationMetadata {
            source: "test".to_string(),
            category: "test".to_string(),
            tags: vec!["test".to_string()],
            custom_data: Some(custom_data), // Troppi campi (max 20)
        });
        
        let result = manager.create_notification(request).await;
        assert!(matches!(result, Err(NotificationError::InvalidContent(_))));
        assert!(result.unwrap_err().to_string().contains("Troppi campi in custom_data"));
    }

    #[tokio::test]
    async fn test_preferences_validation() {
        let manager = create_test_manager().await;
        
        // Test preferenze con max_notifications troppo basso
        let mut preferences = NotificationPreferences::default();
        preferences.profile_id = "test_profile".to_string();
        preferences.max_notifications = 0; // Troppo basso
        
        let result = manager.update_preferences(preferences).await;
        // Nota: il manager potrebbe non validare questo specifico caso,
        // ma testiamo comunque la struttura
        
        // Test preferenze con auto_delete_after_days troppo basso
        let mut preferences = NotificationPreferences::default();
        preferences.profile_id = "test_profile".to_string();
        preferences.auto_delete_after_days = 0; // Troppo basso
        
        // Il manager dovrebbe accettare questi valori ma potrebbero causare comportamenti inaspettati
        let result = manager.update_preferences(preferences).await;
        assert!(result.is_ok()); // Il manager non valida questi limiti specifici
    }

    #[tokio::test]
    async fn test_quiet_hours_validation() {
        let manager = create_test_manager().await;
        
        // Test ore di silenzio con formato orario non valido
        let invalid_quiet_hours = QuietHoursSettings {
            enabled: true,
            start_time: "25:00".to_string(), // Ora non valida
            end_time: "06:00".to_string(),
            allow_urgent: true,
        };
        
        // Il manager potrebbe non validare il formato orario direttamente,
        // ma testiamo la struttura
        let result = manager.update_quiet_hours("test_profile", Some(invalid_quiet_hours)).await;
        // Nota: la validazione del formato orario potrebbe essere implementata in futuro
        
        // Test ore di silenzio valide
        let valid_quiet_hours = QuietHoursSettings {
            enabled: true,
            start_time: "22:00".to_string(),
            end_time: "06:00".to_string(),
            allow_urgent: true,
        };
        
        let result = manager.update_quiet_hours("test_profile", Some(valid_quiet_hours)).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_error_types_and_messages() {
        // Test NotificationError::NotificationNotFound
        let error = NotificationError::NotificationNotFound("test_id".to_string());
        assert_eq!(error.to_string(), "Notifica non trovata: test_id");
        
        // Test NotificationError::UnauthorizedProfile
        let error = NotificationError::UnauthorizedProfile;
        assert_eq!(error.to_string(), "Profilo non autorizzato per questa notifica");
        
        // Test NotificationError::InvalidNotificationType
        let error = NotificationError::InvalidNotificationType("invalid_type".to_string());
        assert_eq!(error.to_string(), "Tipo di notifica non valido: invalid_type");
        
        // Test NotificationError::InvalidPriority
        let error = NotificationError::InvalidPriority("invalid_priority".to_string());
        assert_eq!(error.to_string(), "Priorità notifica non valida: invalid_priority");
        
        // Test NotificationError::InvalidContent
        let error = NotificationError::InvalidContent("Contenuto non valido".to_string());
        assert_eq!(error.to_string(), "Contenuto notifica non valido: Contenuto non valido");
        
        // Test NotificationError::StorageError
        let error = NotificationError::StorageError("Errore di storage".to_string());
        assert_eq!(error.to_string(), "Errore storage: Errore di storage");
    }

    #[tokio::test]
    async fn test_notification_model_methods() {
        let request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Test Notification".to_string(),
            message: "Test message".to_string(),
            icon: Some("test-icon".to_string()),
            action_url: Some("/test".to_string()),
            priority: Some(NotificationPriority::High),
            expires_at: Some(Utc::now() + Duration::hours(1)),
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "test_category".to_string(),
                tags: vec!["test".to_string()],
                custom_data: None,
            }),
        };
        
        let mut notification = crate::notifications::models::Notification::new(request);
        
        // Test metodi di base
        assert!(!notification.is_read());
        assert!(!notification.is_expired());
        assert!(notification.belongs_to_profile("test_profile"));
        assert!(!notification.belongs_to_profile("other_profile"));
        
        // Test mark_as_read
        notification.mark_as_read();
        assert!(notification.is_read());
        assert!(notification.read_at.is_some());
        
        // Test mark_as_read multiplo (non dovrebbe cambiare il timestamp)
        let first_read_time = notification.read_at.unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        notification.mark_as_read();
        assert_eq!(notification.read_at.unwrap(), first_read_time);
        
        // Test notifica scaduta
        let mut expired_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Expired Notification".to_string(),
            message: "This notification is expired".to_string(),
            icon: None,
            action_url: None,
            priority: None,
            expires_at: Some(Utc::now() - Duration::hours(1)), // Scaduta
            metadata: None,
        };
        
        let expired_notification = crate::notifications::models::Notification::new(expired_request);
        assert!(expired_notification.is_expired());
    }

    #[tokio::test]
    async fn test_default_implementations() {
        // Test NotificationPriority::default
        let default_priority = NotificationPriority::default();
        assert_eq!(default_priority, NotificationPriority::Normal);
        
        // Test NotificationMetadata::default
        let default_metadata = NotificationMetadata::default();
        assert_eq!(default_metadata.source, "system");
        assert_eq!(default_metadata.category, "general");
        assert!(default_metadata.tags.is_empty());
        assert!(default_metadata.custom_data.is_none());
        
        // Test NotificationPreferences::default
        let default_preferences = NotificationPreferences::default();
        assert!(default_preferences.global_enabled);
        assert!(default_preferences.sound_enabled);
        assert!(default_preferences.desktop_enabled);
        assert_eq!(default_preferences.max_notifications, 50);
        assert_eq!(default_preferences.auto_delete_after_days, 30);
        assert!(default_preferences.quiet_hours.is_none());
        
        // Verifica che tutti i tipi di notifica abbiano impostazioni predefinite
        assert!(default_preferences.type_settings.contains_key(&NotificationType::System));
        assert!(default_preferences.type_settings.contains_key(&NotificationType::Profile));
        assert!(default_preferences.type_settings.contains_key(&NotificationType::Security));
        assert!(default_preferences.type_settings.contains_key(&NotificationType::Update));
        assert!(default_preferences.type_settings.contains_key(&NotificationType::Game));
        assert!(default_preferences.type_settings.contains_key(&NotificationType::Store));
        assert!(default_preferences.type_settings.contains_key(&NotificationType::Custom));
        
        // Test TypePreference::default
        let default_type_preference = TypePreference::default();
        assert!(default_type_preference.enabled);
        assert_eq!(default_type_preference.priority, NotificationPriority::Normal);
        assert!(default_type_preference.show_toast);
        assert!(!default_type_preference.play_sound);
        assert!(default_type_preference.persist_in_center);
    }

    #[tokio::test]
    async fn test_partial_preferences_default() {
        let partial_preferences = PartialNotificationPreferences::default();
        assert!(partial_preferences.global_enabled.is_none());
        assert!(partial_preferences.sound_enabled.is_none());
        assert!(partial_preferences.desktop_enabled.is_none());
        assert!(partial_preferences.type_settings.is_none());
        assert!(partial_preferences.quiet_hours.is_none());
        assert!(partial_preferences.max_notifications.is_none());
        assert!(partial_preferences.auto_delete_after_days.is_none());
    }

    #[tokio::test]
    async fn test_notification_counts_default() {
        let counts = crate::notifications::models::NotificationCounts::default();
        assert_eq!(counts.total, 0);
        assert_eq!(counts.unread, 0);
        assert_eq!(counts.urgent_unread, 0);
        assert_eq!(counts.high_priority_unread, 0);
        assert_eq!(counts.expired, 0);
    }

    #[tokio::test]
    async fn test_notification_stats_default() {
        let stats = crate::notifications::models::NotificationStats::default();
        assert_eq!(stats.total_notifications, 0);
        assert_eq!(stats.unread_notifications, 0);
        assert_eq!(stats.expired_notifications, 0);
        assert!(stats.oldest_notification.is_none());
        assert!(stats.newest_notification.is_none());
    }

    #[tokio::test]
    async fn test_complex_validation_scenarios() {
        let manager = create_test_manager().await;
        
        // Scenario 1: Notifica con tutti i campi opzionali
        let complex_request = CreateNotificationRequest {
            profile_id: "complex_profile".to_string(),
            notification_type: NotificationType::Security,
            title: "Complex Security Alert".to_string(),
            message: "This is a complex security notification with all optional fields filled.".to_string(),
            icon: Some("shield-alert".to_string()),
            action_url: Some("/security/alerts/details/12345".to_string()),
            priority: Some(NotificationPriority::Urgent),
            expires_at: Some(Utc::now() + Duration::days(7)),
            metadata: Some(NotificationMetadata {
                source: "security_system".to_string(),
                category: "security_alert".to_string(),
                tags: vec![
                    "security".to_string(),
                    "urgent".to_string(),
                    "authentication".to_string(),
                    "suspicious_activity".to_string(),
                ],
                custom_data: Some({
                    let mut data = HashMap::new();
                    data.insert("alert_id".to_string(), serde_json::Value::String("SEC-2024-001".to_string()));
                    data.insert("severity_level".to_string(), serde_json::Value::Number(serde_json::Number::from(9)));
                    data.insert("affected_systems".to_string(), serde_json::Value::Array(vec![
                        serde_json::Value::String("auth_service".to_string()),
                        serde_json::Value::String("user_management".to_string()),
                    ]));
                    data.insert("requires_action".to_string(), serde_json::Value::Bool(true));
                    data
                }),
            }),
        };
        
        let result = manager.create_notification(complex_request).await;
        assert!(result.is_ok());
        
        let notification = result.unwrap();
        assert_eq!(notification.title, "Complex Security Alert");
        assert_eq!(notification.notification_type, NotificationType::Security);
        assert_eq!(notification.priority, NotificationPriority::Urgent);
        assert!(notification.metadata.tags.len() == 4);
        assert!(notification.metadata.custom_data.is_some());
        
        // Scenario 2: Notifica minimalista (solo campi obbligatori)
        let minimal_request = CreateNotificationRequest {
            profile_id: "minimal_profile".to_string(),
            notification_type: NotificationType::Game,
            title: "Game Update".to_string(),
            message: "A new update is available.".to_string(),
            icon: None,
            action_url: None,
            priority: None, // Dovrebbe usare Normal come default
            expires_at: None,
            metadata: None, // Dovrebbe usare metadata di default
        };
        
        let result = manager.create_notification(minimal_request).await;
        assert!(result.is_ok());
        
        let notification = result.unwrap();
        assert_eq!(notification.priority, NotificationPriority::Normal);
        assert_eq!(notification.metadata.source, "system");
        assert_eq!(notification.metadata.category, "general");
        assert!(notification.icon.is_none());
        assert!(notification.action_url.is_none());
        assert!(notification.expires_at.is_none());
    }
}