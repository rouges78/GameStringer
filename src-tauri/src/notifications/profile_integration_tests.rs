#[cfg(test)]
mod profile_integration_tests {
    use super::*;
    use crate::notifications::{
        manager::NotificationManager,
        storage::NotificationStorage,
        profile_integration::ProfileNotificationIntegration,
        models::{NotificationFilter, NotificationType, NotificationPriority},
        errors::NotificationError,
    };
    use crate::profiles::manager::ProfileEvent;
    use tempfile::tempdir;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    /// Helper per creare un'integrazione di test
    async fn create_test_integration() -> (NotificationManager, ProfileNotificationIntegration) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_integration.db");
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        let manager_arc = Arc::new(Mutex::new(manager));
        let integration = ProfileNotificationIntegration::new(Arc::clone(&manager_arc));
        
        // Estrai il manager per i test
        let manager = Arc::try_unwrap(manager_arc).unwrap().into_inner();
        
        (manager, integration)
    }

    /// Helper per creare un'integrazione con manager condiviso
    async fn create_shared_integration() -> (Arc<Mutex<NotificationManager>>, ProfileNotificationIntegration) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_shared_integration.db");
        let storage = NotificationStorage::new(db_path);
        let manager = NotificationManager::new(storage);
        manager.initialize().await.unwrap();
        
        let manager_arc = Arc::new(Mutex::new(manager));
        let integration = ProfileNotificationIntegration::new(Arc::clone(&manager_arc));
        
        (manager_arc, integration)
    }

    #[tokio::test]
    async fn test_profile_created_event() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Simula evento di creazione profilo
        let event = ProfileEvent::ProfileCreated {
            profile_id: "new_profile_123".to_string(),
            name: "Test User".to_string(),
        };
        
        let result = integration.handle_profile_event(event).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di benvenuto
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("new_profile_123", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let welcome_notification = &notifications[0];
        assert_eq!(welcome_notification.title, "Benvenuto in GameStringer!");
        assert!(welcome_notification.message.contains("Test User"));
        assert_eq!(welcome_notification.notification_type, NotificationType::Profile);
        assert_eq!(welcome_notification.priority, NotificationPriority::Normal);
        assert!(welcome_notification.icon.as_ref().unwrap().contains("user-plus"));
        assert!(welcome_notification.action_url.as_ref().unwrap().contains("/settings/stores"));
        
        // Verifica metadati
        assert_eq!(welcome_notification.metadata.source, "profile_manager");
        assert_eq!(welcome_notification.metadata.category, "profile_lifecycle");
        assert!(welcome_notification.metadata.tags.contains(&"welcome".to_string()));
        assert!(welcome_notification.metadata.tags.contains(&"new_profile".to_string()));
        
        // Verifica custom_data
        if let Some(ref custom_data) = welcome_notification.metadata.custom_data {
            assert_eq!(custom_data.get("profile_name").unwrap().as_str().unwrap(), "Test User");
            assert_eq!(custom_data.get("event_type").unwrap().as_str().unwrap(), "profile_created");
        }
        
        // Verifica che la notifica scada dopo una settimana
        assert!(welcome_notification.expires_at.is_some());
    }

    #[tokio::test]
    async fn test_profile_authenticated_event() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Simula evento di autenticazione
        let event = ProfileEvent::ProfileAuthenticated {
            profile_id: "auth_profile_456".to_string(),
            name: "Authenticated User".to_string(),
        };
        
        let result = integration.handle_profile_event(event).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di accesso
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("auth_profile_456", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let auth_notification = &notifications[0];
        assert_eq!(auth_notification.title, "Accesso effettuato");
        assert!(auth_notification.message.contains("Authenticated User"));
        assert_eq!(auth_notification.priority, NotificationPriority::Low);
        assert!(auth_notification.icon.as_ref().unwrap().contains("user-check"));
        
        // Verifica metadati
        assert_eq!(auth_notification.metadata.category, "authentication");
        assert!(auth_notification.metadata.tags.contains(&"login".to_string()));
        assert!(auth_notification.metadata.tags.contains(&"success".to_string()));
        
        // Verifica che scada dopo un'ora
        assert!(auth_notification.expires_at.is_some());
    }

    #[tokio::test]
    async fn test_profile_switched_event() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Simula evento di cambio profilo
        let event = ProfileEvent::ProfileSwitched {
            from_id: Some("old_profile".to_string()),
            to_id: "new_profile_789".to_string(),
        };
        
        let result = integration.handle_profile_event(event).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di cambio profilo
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("new_profile_789", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let switch_notification = &notifications[0];
        assert_eq!(switch_notification.title, "Profilo cambiato");
        assert!(switch_notification.message.contains("cambiato profilo con successo"));
        assert_eq!(switch_notification.priority, NotificationPriority::Low);
        assert!(switch_notification.icon.as_ref().unwrap().contains("user-switch"));
        
        // Verifica metadati
        assert_eq!(switch_notification.metadata.category, "profile_lifecycle");
        assert!(switch_notification.metadata.tags.contains(&"switch".to_string()));
        assert!(switch_notification.metadata.tags.contains(&"profile_change".to_string()));
        
        // Verifica che scada dopo 30 minuti
        assert!(switch_notification.expires_at.is_some());
    }

    #[tokio::test]
    async fn test_profile_logged_out_event() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Simula evento di logout
        let event = ProfileEvent::ProfileLoggedOut {
            profile_id: "logout_profile_101".to_string(),
        };
        
        let result = integration.handle_profile_event(event).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di logout
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("logout_profile_101", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let logout_notification = &notifications[0];
        assert_eq!(logout_notification.title, "Logout effettuato");
        assert!(logout_notification.message.contains("logout con successo"));
        assert_eq!(logout_notification.priority, NotificationPriority::Low);
        assert!(logout_notification.icon.as_ref().unwrap().contains("user-x"));
        
        // Verifica metadati
        assert_eq!(logout_notification.metadata.category, "authentication");
        assert!(logout_notification.metadata.tags.contains(&"logout".to_string()));
        assert!(logout_notification.metadata.tags.contains(&"session_end".to_string()));
        
        // Verifica che scada dopo 15 minuti
        assert!(logout_notification.expires_at.is_some());
    }

    #[tokio::test]
    async fn test_profile_deleted_event() {
        let (_, integration) = create_shared_integration().await;
        
        // Simula evento di eliminazione profilo
        let event = ProfileEvent::ProfileDeleted {
            profile_id: "deleted_profile".to_string(),
            name: "Deleted User".to_string(),
        };
        
        // L'evento dovrebbe essere gestito senza errori ma senza creare notifiche
        let result = integration.handle_profile_event(event).await;
        assert!(result.is_ok());
        
        // Non possiamo verificare notifiche perché il profilo è stato eliminato
        // Questo test verifica solo che l'evento sia gestito correttamente
    }

    #[tokio::test]
    async fn test_authentication_failed_event() {
        let (_, integration) = create_shared_integration().await;
        
        // Simula evento di autenticazione fallita
        let event = ProfileEvent::AuthenticationFailed {
            profile_name: "Failed User".to_string(),
            reason: "Password incorretta".to_string(),
        };
        
        // L'evento dovrebbe essere gestito senza errori
        let result = integration.handle_profile_event(event).await;
        assert!(result.is_ok());
        
        // Questo evento viene solo loggato, non crea notifiche
        // perché non abbiamo un profile_id valido
    }

    #[tokio::test]
    async fn test_authentication_error_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di errore di autenticazione
        let result = integration.create_authentication_error_notification(
            "error_profile_202",
            "Credenziali non valide"
        ).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di sicurezza
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Security),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("error_profile_202", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let error_notification = &notifications[0];
        assert_eq!(error_notification.title, "Errore di autenticazione");
        assert!(error_notification.message.contains("Credenziali non valide"));
        assert_eq!(error_notification.notification_type, NotificationType::Security);
        assert_eq!(error_notification.priority, NotificationPriority::High);
        assert!(error_notification.icon.as_ref().unwrap().contains("alert-triangle"));
        assert!(error_notification.action_url.as_ref().unwrap().contains("/auth/login"));
        
        // Verifica metadati
        assert_eq!(error_notification.metadata.category, "security");
        assert!(error_notification.metadata.tags.contains(&"error".to_string()));
        assert!(error_notification.metadata.tags.contains(&"authentication".to_string()));
        assert!(error_notification.metadata.tags.contains(&"security".to_string()));
        
        // Verifica che scada dopo 24 ore
        assert!(error_notification.expires_at.is_some());
    }

    #[tokio::test]
    async fn test_profile_locked_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di profilo bloccato
        let remaining_seconds = 300; // 5 minuti
        let result = integration.create_profile_locked_notification(
            "locked_profile_303",
            remaining_seconds
        ).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di sicurezza
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Security),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("locked_profile_303", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let locked_notification = &notifications[0];
        assert_eq!(locked_notification.title, "Profilo temporaneamente bloccato");
        assert!(locked_notification.message.contains("5 minuti e 0 secondi"));
        assert_eq!(locked_notification.priority, NotificationPriority::High);
        assert!(locked_notification.icon.as_ref().unwrap().contains("lock"));
        
        // Verifica metadati
        assert_eq!(locked_notification.metadata.category, "security");
        assert!(locked_notification.metadata.tags.contains(&"locked".to_string()));
        assert!(locked_notification.metadata.tags.contains(&"security".to_string()));
        assert!(locked_notification.metadata.tags.contains(&"rate_limit".to_string()));
        
        // Verifica custom_data
        if let Some(ref custom_data) = locked_notification.metadata.custom_data {
            assert_eq!(custom_data.get("remaining_seconds").unwrap().as_u64().unwrap(), 300);
            assert_eq!(custom_data.get("event_type").unwrap().as_str().unwrap(), "profile_locked");
        }
    }

    #[tokio::test]
    async fn test_credential_operation_success_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di operazione credenziali riuscita
        let result = integration.create_credential_operation_notification(
            "cred_profile_404",
            "Steam",
            "aggiornate",
            true
        ).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di profilo
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("cred_profile_404", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let cred_notification = &notifications[0];
        assert_eq!(cred_notification.title, "Credenziali Steam aggiornate");
        assert!(cred_notification.message.contains("Steam sono state aggiornate con successo"));
        assert_eq!(cred_notification.priority, NotificationPriority::Low);
        assert!(cred_notification.icon.as_ref().unwrap().contains("key"));
        assert!(cred_notification.action_url.as_ref().unwrap().contains("/settings/stores"));
        
        // Verifica metadati
        assert_eq!(cred_notification.metadata.category, "credentials");
        assert!(cred_notification.metadata.tags.contains(&"credentials".to_string()));
        assert!(cred_notification.metadata.tags.contains(&"Steam".to_string()));
        assert!(cred_notification.metadata.tags.contains(&"aggiornate".to_string()));
        assert!(cred_notification.metadata.tags.contains(&"success".to_string()));
    }

    #[tokio::test]
    async fn test_credential_operation_error_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di errore operazione credenziali
        let result = integration.create_credential_operation_notification(
            "cred_error_profile_505",
            "Epic Games",
            "salvate",
            false
        ).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di sicurezza
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Security),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("cred_error_profile_505", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let error_notification = &notifications[0];
        assert_eq!(error_notification.title, "Errore credenziali Epic Games");
        assert!(error_notification.message.contains("errore durante l'operazione"));
        assert_eq!(error_notification.priority, NotificationPriority::High);
        assert!(error_notification.icon.as_ref().unwrap().contains("alert-circle"));
        
        // Verifica metadati
        assert_eq!(error_notification.metadata.category, "credentials");
        assert!(error_notification.metadata.tags.contains(&"Epic Games".to_string()));
        assert!(error_notification.metadata.tags.contains(&"error".to_string()));
    }

    #[tokio::test]
    async fn test_settings_update_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di aggiornamento impostazioni
        let result = integration.create_settings_update_notification("settings_profile_606").await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di profilo
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("settings_profile_606", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let settings_notification = &notifications[0];
        assert_eq!(settings_notification.title, "Impostazioni aggiornate");
        assert!(settings_notification.message.contains("aggiornate con successo"));
        assert_eq!(settings_notification.priority, NotificationPriority::Low);
        assert!(settings_notification.icon.as_ref().unwrap().contains("settings"));
        assert!(settings_notification.action_url.as_ref().unwrap().contains("/settings/profile"));
        
        // Verifica metadati
        assert_eq!(settings_notification.metadata.category, "settings");
        assert!(settings_notification.metadata.tags.contains(&"settings".to_string()));
        assert!(settings_notification.metadata.tags.contains(&"update".to_string()));
        
        // Verifica che scada dopo 30 minuti
        assert!(settings_notification.expires_at.is_some());
    }

    #[tokio::test]
    async fn test_backup_success_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di backup riuscito
        let backup_path = "/path/to/backup/profile_backup_2024.zip";
        let result = integration.create_backup_notification(
            "backup_profile_707",
            backup_path,
            true
        ).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di profilo
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("backup_profile_707", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let backup_notification = &notifications[0];
        assert_eq!(backup_notification.title, "Backup completato");
        assert!(backup_notification.message.contains(backup_path));
        assert_eq!(backup_notification.priority, NotificationPriority::Normal);
        assert!(backup_notification.icon.as_ref().unwrap().contains("download"));
        assert!(backup_notification.action_url.as_ref().unwrap().contains("/settings/backup"));
        
        // Verifica metadati
        assert_eq!(backup_notification.metadata.category, "backup");
        assert!(backup_notification.metadata.tags.contains(&"backup".to_string()));
        assert!(backup_notification.metadata.tags.contains(&"success".to_string()));
        
        // Verifica custom_data
        if let Some(ref custom_data) = backup_notification.metadata.custom_data {
            assert_eq!(custom_data.get("backup_path").unwrap().as_str().unwrap(), backup_path);
            assert_eq!(custom_data.get("success").unwrap().as_bool().unwrap(), true);
            assert_eq!(custom_data.get("event_type").unwrap().as_str().unwrap(), "backup_operation");
        }
    }

    #[tokio::test]
    async fn test_backup_error_notification() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea notifica di errore backup
        let result = integration.create_backup_notification(
            "backup_error_profile_808",
            "", // Path vuoto per errore
            false
        ).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata creata una notifica di profilo
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications("backup_error_profile_808", filter).await.unwrap();
        assert_eq!(notifications.len(), 1);
        
        let error_notification = &notifications[0];
        assert_eq!(error_notification.title, "Errore backup");
        assert!(error_notification.message.contains("errore durante la creazione"));
        assert_eq!(error_notification.priority, NotificationPriority::High);
        assert!(error_notification.icon.as_ref().unwrap().contains("alert-triangle"));
        assert!(error_notification.action_url.is_none()); // Nessuna azione per errori
        
        // Verifica metadati
        assert_eq!(error_notification.metadata.category, "backup");
        assert!(error_notification.metadata.tags.contains(&"backup".to_string()));
        assert!(error_notification.metadata.tags.contains(&"error".to_string()));
        
        // Verifica custom_data
        if let Some(ref custom_data) = error_notification.metadata.custom_data {
            assert_eq!(custom_data.get("success").unwrap().as_bool().unwrap(), false);
            assert_eq!(custom_data.get("event_type").unwrap().as_str().unwrap(), "backup_operation");
        }
    }

    #[tokio::test]
    async fn test_multiple_profile_events_sequence() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Simula una sequenza di eventi per lo stesso profilo
        let profile_id = "sequence_profile_909";
        let profile_name = "Sequence User";
        
        // 1. Creazione profilo
        let create_event = ProfileEvent::ProfileCreated {
            profile_id: profile_id.to_string(),
            name: profile_name.to_string(),
        };
        integration.handle_profile_event(create_event).await.unwrap();
        
        // 2. Autenticazione
        let auth_event = ProfileEvent::ProfileAuthenticated {
            profile_id: profile_id.to_string(),
            name: profile_name.to_string(),
        };
        integration.handle_profile_event(auth_event).await.unwrap();
        
        // 3. Aggiornamento impostazioni
        integration.create_settings_update_notification(profile_id).await.unwrap();
        
        // 4. Operazione credenziali
        integration.create_credential_operation_notification(
            profile_id,
            "Steam",
            "aggiunte",
            true
        ).await.unwrap();
        
        // 5. Logout
        let logout_event = ProfileEvent::ProfileLoggedOut {
            profile_id: profile_id.to_string(),
        };
        integration.handle_profile_event(logout_event).await.unwrap();
        
        // Verifica che siano state create tutte le notifiche
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications(profile_id, filter).await.unwrap();
        assert_eq!(notifications.len(), 5);
        
        // Verifica che ci siano notifiche di diversi tipi
        let profile_notifications: Vec<_> = notifications.iter()
            .filter(|n| n.notification_type == NotificationType::Profile)
            .collect();
        assert_eq!(profile_notifications.len(), 5); // Tutte dovrebbero essere di tipo Profile
        
        // Verifica che ci siano diverse categorie
        let categories: std::collections::HashSet<_> = notifications.iter()
            .map(|n| &n.metadata.category)
            .collect();
        assert!(categories.contains(&"profile_lifecycle".to_string()));
        assert!(categories.contains(&"authentication".to_string()));
        assert!(categories.contains(&"settings".to_string()));
        assert!(categories.contains(&"credentials".to_string()));
    }

    #[tokio::test]
    async fn test_profile_isolation_in_integration() {
        let (manager_arc, integration) = create_shared_integration().await;
        
        // Crea eventi per profili diversi
        let profile_a = "isolation_profile_a";
        let profile_b = "isolation_profile_b";
        
        // Eventi per profilo A
        let event_a = ProfileEvent::ProfileCreated {
            profile_id: profile_a.to_string(),
            name: "User A".to_string(),
        };
        integration.handle_profile_event(event_a).await.unwrap();
        
        integration.create_authentication_error_notification(
            profile_a,
            "Test error A"
        ).await.unwrap();
        
        // Eventi per profilo B
        let event_b = ProfileEvent::ProfileCreated {
            profile_id: profile_b.to_string(),
            name: "User B".to_string(),
        };
        integration.handle_profile_event(event_b).await.unwrap();
        
        integration.create_authentication_error_notification(
            profile_b,
            "Test error B"
        ).await.unwrap();
        
        // Verifica isolamento: ogni profilo vede solo le proprie notifiche
        let manager = manager_arc.lock().await;
        let filter = NotificationFilter::default();
        
        let notifications_a = manager.get_notifications(profile_a, filter.clone()).await.unwrap();
        let notifications_b = manager.get_notifications(profile_b, filter).await.unwrap();
        
        assert_eq!(notifications_a.len(), 2); // Welcome + error
        assert_eq!(notifications_b.len(), 2); // Welcome + error
        
        // Verifica che ogni profilo abbia solo le proprie notifiche
        for notification in &notifications_a {
            assert_eq!(notification.profile_id, profile_a);
        }
        
        for notification in &notifications_b {
            assert_eq!(notification.profile_id, profile_b);
        }
        
        // Verifica che i messaggi siano diversi
        let error_a = notifications_a.iter()
            .find(|n| n.notification_type == NotificationType::Security)
            .unwrap();
        let error_b = notifications_b.iter()
            .find(|n| n.notification_type == NotificationType::Security)
            .unwrap();
        
        assert!(error_a.message.contains("Test error A"));
        assert!(error_b.message.contains("Test error B"));
    }
}

