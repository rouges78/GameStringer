#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::{
        storage::NotificationStorage,
        manager::NotificationManager,
        profile_integration::ProfileNotificationIntegration,
        event_system::NotificationEventSystem,
        auto_event_integration::AutoEventIntegration,
        models::NotificationFilter,
    };
    use crate::profiles::manager::ProfileEvent;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use chrono::Utc;

    async fn create_test_event_system() -> (NotificationEventSystem, AutoEventIntegration) {
        let storage = NotificationStorage::new("test_event_system.db".into()).unwrap();
        let manager = NotificationManager::new(storage);
        let manager_arc = Arc::new(Mutex::new(manager));
        
        let integration = ProfileNotificationIntegration::new(Arc::clone(&manager_arc));
        let integration_arc = Arc::new(Mutex::new(integration));
        
        let event_system = NotificationEventSystem::new(
            Arc::clone(&manager_arc),
            Arc::clone(&integration_arc),
        );
        
        let auto_integration = AutoEventIntegration::new(Arc::new(event_system.clone()));
        
        (event_system, auto_integration)
    }

    #[tokio::test]
    async fn test_event_system_lifecycle() {
        let (event_system, _) = create_test_event_system().await;
        
        // Verifica stato iniziale
        assert!(!event_system.is_active().await);
        
        // Avvia il sistema
        event_system.start().await.unwrap();
        assert!(event_system.is_active().await);
        
        // Ferma il sistema
        event_system.stop().await;
        assert!(!event_system.is_active().await);
    }

    #[tokio::test]
    async fn test_profile_created_event() {
        let (event_system, _) = create_test_event_system().await;
        event_system.start().await.unwrap();
        
        let profile_id = "test_profile_123";
        let profile_name = "Test Profile";
        
        // Emette evento di creazione profilo
        event_system.handle_profile_created(profile_id, profile_name).await.unwrap();
        
        // Verifica che sia stata creata una notifica di benvenuto
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(crate::notifications::models::NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications(profile_id, filter).await.unwrap();
        assert!(!notifications.is_empty());
        
        let welcome_notification = notifications.iter()
            .find(|n| n.title.contains("Benvenuto"))
            .expect("Notifica di benvenuto non trovata");
        
        assert_eq!(welcome_notification.profile_id, profile_id);
        assert!(welcome_notification.message.contains(profile_name));
    }

    #[tokio::test]
    async fn test_profile_authenticated_event() {
        let (event_system, _) = create_test_event_system().await;
        event_system.start().await.unwrap();
        
        let profile_id = "test_profile_456";
        let profile_name = "Auth Test Profile";
        
        // Emette evento di autenticazione
        event_system.handle_profile_authenticated(profile_id, profile_name).await.unwrap();
        
        // Verifica che sia stata creata una notifica di autenticazione
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(crate::notifications::models::NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications(profile_id, filter).await.unwrap();
        assert!(!notifications.is_empty());
        
        let auth_notification = notifications.iter()
            .find(|n| n.title.contains("Accesso effettuato"))
            .expect("Notifica di autenticazione non trovata");
        
        assert_eq!(auth_notification.profile_id, profile_id);
        assert!(auth_notification.message.contains(profile_name));
    }

    #[tokio::test]
    async fn test_profile_switched_event() {
        let (event_system, _) = create_test_event_system().await;
        event_system.start().await.unwrap();
        
        let from_profile_id = "old_profile";
        let to_profile_id = "new_profile";
        
        // Emette evento di cambio profilo
        event_system.handle_profile_switched(Some(from_profile_id), to_profile_id).await.unwrap();
        
        // Verifica che sia stata creata una notifica di cambio profilo
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let filter = NotificationFilter {
            notification_type: Some(crate::notifications::models::NotificationType::Profile),
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications(to_profile_id, filter).await.unwrap();
        assert!(!notifications.is_empty());
        
        let switch_notification = notifications.iter()
            .find(|n| n.title.contains("Profilo cambiato"))
            .expect("Notifica di cambio profilo non trovata");
        
        assert_eq!(switch_notification.profile_id, to_profile_id);
    }

    #[tokio::test]
    async fn test_profile_deleted_event() {
        let (event_system, _) = create_test_event_system().await;
        event_system.start().await.unwrap();
        
        let profile_id = "profile_to_delete";
        let profile_name = "Profile To Delete";
        
        // Prima crea alcune notifiche per il profilo
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let request = crate::notifications::models::CreateNotificationRequest {
            profile_id: profile_id.to_string(),
            notification_type: crate::notifications::models::NotificationType::Profile,
            title: "Test Notification".to_string(),
            message: "This should be deleted".to_string(),
            icon: None,
            action_url: None,
            priority: None,
            expires_at: None,
            metadata: None,
        };
        manager.create_notification(request).await.unwrap();
        drop(manager);
        
        // Verifica che la notifica esista
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        let notifications_before = manager.get_notifications(profile_id, filter.clone()).await.unwrap();
        assert!(!notifications_before.is_empty());
        drop(manager);
        
        // Emette evento di eliminazione profilo
        event_system.handle_profile_deleted(profile_id, profile_name).await.unwrap();
        
        // Verifica che le notifiche del profilo siano state eliminate
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let notifications_after = manager.get_notifications(profile_id, filter).await.unwrap();
        assert!(notifications_after.is_empty());
    }

    #[tokio::test]
    async fn test_authentication_failed_event() {
        let (event_system, _) = create_test_event_system().await;
        event_system.start().await.unwrap();
        
        let profile_name = "Failed Auth Profile";
        let reason = "Invalid password";
        
        // Emette evento di autenticazione fallita
        event_system.handle_authentication_failed(profile_name, reason).await.unwrap();
        
        // Verifica che l'evento sia stato processato (non crea notifiche per profili inesistenti)
        // Ma dovrebbe essere loggato
        println!("Test autenticazione fallita completato per: {}", profile_name);
    }

    #[tokio::test]
    async fn test_auto_integration_lifecycle() {
        let (_, auto_integration) = create_test_event_system().await;
        
        // Verifica stato iniziale
        let health = auto_integration.health_check().await;
        assert_eq!(health, crate::notifications::IntegrationHealthStatus::Inactive);
        
        // Avvia l'integrazione
        auto_integration.start().await.unwrap();
        
        let health = auto_integration.health_check().await;
        assert_eq!(health, crate::notifications::IntegrationHealthStatus::Healthy);
        
        // Ferma l'integrazione
        auto_integration.stop().await;
        
        let health = auto_integration.health_check().await;
        assert_eq!(health, crate::notifications::IntegrationHealthStatus::Inactive);
    }

    #[tokio::test]
    async fn test_event_system_stats() {
        let (event_system, _) = create_test_event_system().await;
        
        let stats = event_system.get_event_stats().await;
        assert!(!stats.is_active);
        assert_eq!(stats.receiver_count, 0);
        
        event_system.start().await.unwrap();
        
        let stats = event_system.get_event_stats().await;
        assert!(stats.is_active);
    }

    #[tokio::test]
    async fn test_multiple_events_sequence() {
        let (event_system, _) = create_test_event_system().await;
        event_system.start().await.unwrap();
        
        let profile_id = "sequence_test_profile";
        let profile_name = "Sequence Test Profile";
        
        // Sequenza di eventi: creazione -> autenticazione -> cambio -> logout
        event_system.handle_profile_created(profile_id, profile_name).await.unwrap();
        event_system.handle_profile_authenticated(profile_id, profile_name).await.unwrap();
        event_system.handle_profile_switched(None, profile_id).await.unwrap();
        event_system.handle_profile_logged_out(profile_id).await.unwrap();
        
        // Verifica che tutte le notifiche siano state create
        let manager = event_system.get_event_handler().notification_manager.lock().await;
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = manager.get_notifications(profile_id, filter).await.unwrap();
        
        // Dovremmo avere almeno 4 notifiche (benvenuto, autenticazione, cambio, logout)
        assert!(notifications.len() >= 4);
        
        // Verifica che ci siano notifiche di diversi tipi
        let titles: Vec<&str> = notifications.iter().map(|n| n.title.as_str()).collect();
        assert!(titles.iter().any(|&t| t.contains("Benvenuto")));
        assert!(titles.iter().any(|&t| t.contains("Accesso effettuato")));
        assert!(titles.iter().any(|&t| t.contains("Profilo cambiato")));
        assert!(titles.iter().any(|&t| t.contains("Logout effettuato")));
    }

    #[tokio::test]
    async fn test_event_listener_creation() {
        let (event_system, _) = create_test_event_system().await;
        
        // Crea un listener personalizzato
        let mut listener = event_system.create_event_listener();
        
        event_system.start().await.unwrap();
        
        // Emette un evento
        let event = ProfileEvent::ProfileCreated {
            profile_id: "listener_test".to_string(),
            name: "Listener Test".to_string(),
        };
        
        event_system.emit_profile_event(event.clone()).await.unwrap();
        
        // Il listener dovrebbe ricevere l'evento
        tokio::select! {
            received_event = listener.recv() => {
                match received_event {
                    Ok(received) => {
                        match (&received, &event) {
                            (ProfileEvent::ProfileCreated { profile_id: r_id, name: r_name }, 
                             ProfileEvent::ProfileCreated { profile_id: e_id, name: e_name }) => {
                                assert_eq!(r_id, e_id);
                                assert_eq!(r_name, e_name);
                            }
                            _ => panic!("Evento ricevuto non corrisponde a quello inviato"),
                        }
                    }
                    Err(e) => panic!("Errore ricezione evento: {}", e),
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                panic!("Timeout: evento non ricevuto dal listener");
            }
        }
    }
}