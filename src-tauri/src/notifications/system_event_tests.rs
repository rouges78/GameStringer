#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::{
        storage::NotificationStorage,
        manager::NotificationManager,
        system_event_handler::{SystemEventHandler, SystemEvent, SecuritySeverity},
        system_event_integration::SystemEventIntegration,
        models::{NotificationFilter, NotificationType},
    };
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use chrono::Utc;

    async fn create_test_system_event_integration() -> SystemEventIntegration {
        let storage = NotificationStorage::new("test_system_events.db".into()).unwrap();
        let manager = NotificationManager::new(storage);
        let manager_arc = Arc::new(Mutex::new(manager));
        
        let system_handler = Arc::new(SystemEventHandler::new(manager_arc));
        SystemEventIntegration::new(system_handler)
    }

    #[tokio::test]
    async fn test_system_event_integration_lifecycle() {
        let integration = create_test_system_event_integration().await;
        
        // Verifica stato iniziale
        assert!(!integration.is_active().await);
        
        // Avvia il sistema
        integration.start().await.unwrap();
        assert!(integration.is_active().await);
        
        // Ferma il sistema
        integration.stop().await;
        assert!(!integration.is_active().await);
    }

    #[tokio::test]
    async fn test_update_available_notification() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        // Aggiungi un profilo attivo
        let profile_id = "test_profile_update";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Notifica aggiornamento disponibile
        let notification_ids = integration.notify_update_available(
            "2.0.0".to_string(),
            "Nuove funzionalità e correzioni di bug".to_string(),
            Some("https://example.com/download".to_string()),
            false,
        ).await.unwrap();
        
        assert!(!notification_ids.is_empty());
        
        // Verifica che la notifica sia stata creata
        let stats = integration.get_system_stats().await;
        assert_eq!(stats.active_profiles_count, 1);
    }

    #[tokio::test]
    async fn test_critical_update_notification() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_critical";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Notifica aggiornamento critico
        let notification_ids = integration.notify_update_available(
            "2.1.0".to_string(),
            "Correzione di sicurezza critica".to_string(),
            None,
            true, // Critico
        ).await.unwrap();
        
        assert!(!notification_ids.is_empty());
    }

    #[tokio::test]
    async fn test_maintenance_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_maintenance";
        integration.add_active_profile(profile_id.to_string()).await;
        
        let start_time = Utc::now() + chrono::Duration::hours(2);
        let end_time = start_time + chrono::Duration::hours(1);
        
        // Notifica manutenzione programmata
        let scheduled_ids = integration.notify_maintenance_scheduled(
            start_time,
            end_time,
            "Aggiornamento database".to_string(),
        ).await.unwrap();
        
        assert!(!scheduled_ids.is_empty());
        
        // Notifica inizio manutenzione
        let started_ids = integration.notify_maintenance_started(
            "Aggiornamento database in corso".to_string(),
            60, // 60 minuti stimati
        ).await.unwrap();
        
        assert!(!started_ids.is_empty());
        
        // Notifica completamento manutenzione
        let completed_ids = integration.notify_maintenance_completed(
            "Aggiornamento database completato".to_string(),
            55, // 55 minuti effettivi
        ).await.unwrap();
        
        assert!(!completed_ids.is_empty());
    }

    #[tokio::test]
    async fn test_system_error_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_error";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Errore recuperabile
        let recoverable_ids = integration.notify_system_error(
            "ERR001".to_string(),
            "Connessione temporaneamente non disponibile".to_string(),
            "NetworkManager".to_string(),
            true, // Recuperabile
        ).await.unwrap();
        
        assert!(!recoverable_ids.is_empty());
        
        // Errore critico
        let critical_ids = integration.notify_system_error(
            "ERR002".to_string(),
            "Corruzione database rilevata".to_string(),
            "DatabaseManager".to_string(),
            false, // Non recuperabile
        ).await.unwrap();
        
        assert!(!critical_ids.is_empty());
    }

    #[tokio::test]
    async fn test_security_alert_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_security";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Avviso di sicurezza critico
        let critical_ids = integration.notify_security_alert(
            "Tentativo accesso non autorizzato".to_string(),
            SecuritySeverity::Critical,
            "Rilevati multipli tentativi di accesso falliti da IP sospetto".to_string(),
            true, // Azione richiesta
        ).await.unwrap();
        
        assert!(!critical_ids.is_empty());
        
        // Avviso di sicurezza informativo
        let info_ids = integration.notify_security_alert(
            "Aggiornamento sicurezza disponibile".to_string(),
            SecuritySeverity::Low,
            "È disponibile un aggiornamento di sicurezza non critico".to_string(),
            false, // Nessuna azione richiesta
        ).await.unwrap();
        
        assert!(!info_ids.is_empty());
    }

    #[tokio::test]
    async fn test_background_operation_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_background";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Operazione completata con successo
        let success_ids = integration.notify_background_operation_completed(
            "Backup".to_string(),
            "backup_20241208_001".to_string(),
            true,
            "Backup completato: 1.2GB salvati".to_string(),
        ).await.unwrap();
        
        assert!(!success_ids.is_empty());
        
        // Operazione fallita
        let failed_ids = integration.notify_background_operation_failed(
            "Sync".to_string(),
            "sync_20241208_001".to_string(),
            "Connessione al server fallita".to_string(),
            2, // Secondo tentativo
        ).await.unwrap();
        
        assert!(!failed_ids.is_empty());
    }

    #[tokio::test]
    async fn test_resource_warning_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_resources";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Avviso spazio disco
        let disk_ids = integration.notify_disk_space_warning(
            "/home".to_string(),
            2.5, // 2.5GB liberi
            100.0, // 100GB totali
        ).await.unwrap();
        
        assert!(!disk_ids.is_empty());
        
        // Avviso memoria
        let memory_ids = integration.notify_memory_warning(
            7500.0, // 7.5GB usati
            8192.0, // 8GB totali
        ).await.unwrap();
        
        assert!(!memory_ids.is_empty());
    }

    #[tokio::test]
    async fn test_database_issue_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_database";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Problema database auto-risolto
        let auto_fixed_ids = integration.notify_database_issue(
            "profiles.db".to_string(),
            "Lock timeout".to_string(),
            "medium".to_string(),
            true, // Auto-risolto
        ).await.unwrap();
        
        assert!(!auto_fixed_ids.is_empty());
        
        // Corruzione database
        let corruption_ids = integration.notify_database_corruption(
            "notifications.db".to_string(),
            "Indice corrotto nella tabella notifications".to_string(),
            false, // Non auto-riparato
        ).await.unwrap();
        
        assert!(!corruption_ids.is_empty());
    }

    #[tokio::test]
    async fn test_network_status_notifications() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_network";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Connessione persa
        let offline_ids = integration.notify_network_status_changed(
            false, // Offline
            true,  // Era online
            vec!["Steam".to_string(), "Epic Games".to_string()],
        ).await.unwrap();
        
        assert!(!offline_ids.is_empty());
        
        // Connessione ripristinata
        let online_ids = integration.notify_network_status_changed(
            true,  // Online
            false, // Era offline
            vec!["Steam".to_string(), "Epic Games".to_string()],
        ).await.unwrap();
        
        assert!(!online_ids.is_empty());
    }

    #[tokio::test]
    async fn test_convenience_methods() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_convenience";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Avvio applicazione
        let start_ids = integration.notify_application_started("3.0.0".to_string()).await.unwrap();
        assert!(!start_ids.is_empty());
        
        // Backup completato
        let backup_ids = integration.notify_backup_completed(
            "Full".to_string(),
            true,
            "Backup di 2.5GB completato in 15 minuti".to_string(),
        ).await.unwrap();
        assert!(!backup_ids.is_empty());
        
        // Sincronizzazione completata
        let sync_ids = integration.notify_sync_completed(
            "Steam Games".to_string(),
            150, // 150 giochi sincronizzati
            2,   // 2 errori
        ).await.unwrap();
        assert!(!sync_ids.is_empty());
        
        // Pulizia database
        let cleanup_ids = integration.notify_database_cleanup_completed(
            "notifications.db".to_string(),
            45, // 45 elementi puliti
        ).await.unwrap();
        assert!(!cleanup_ids.is_empty());
    }

    #[tokio::test]
    async fn test_multiple_profiles_broadcast() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        // Aggiungi multipli profili attivi
        let profile_ids = vec![
            "profile_1".to_string(),
            "profile_2".to_string(),
            "profile_3".to_string(),
        ];
        
        for profile_id in &profile_ids {
            integration.add_active_profile(profile_id.clone()).await;
        }
        
        // Invia notifica broadcast
        let notification_ids = integration.notify_update_available(
            "3.1.0".to_string(),
            "Aggiornamento per tutti".to_string(),
            None,
            false,
        ).await.unwrap();
        
        // Dovrebbe aver creato una notifica per ogni profilo
        assert_eq!(notification_ids.len(), profile_ids.len());
        
        let stats = integration.get_system_stats().await;
        assert_eq!(stats.active_profiles_count, profile_ids.len());
    }

    #[tokio::test]
    async fn test_profile_management() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        let profile_id = "test_profile_mgmt";
        
        // Aggiungi profilo
        integration.add_active_profile(profile_id.to_string()).await;
        let stats = integration.get_system_stats().await;
        assert_eq!(stats.active_profiles_count, 1);
        
        // Rimuovi profilo
        integration.remove_active_profile(profile_id).await;
        let stats = integration.get_system_stats().await;
        assert_eq!(stats.active_profiles_count, 0);
        
        // Aggiorna lista profili
        let new_profiles = vec![
            "profile_a".to_string(),
            "profile_b".to_string(),
        ];
        integration.update_active_profiles(new_profiles.clone()).await;
        let stats = integration.get_system_stats().await;
        assert_eq!(stats.active_profiles_count, new_profiles.len());
    }

    #[tokio::test]
    async fn test_system_event_listener() {
        let integration = create_test_system_event_integration().await;
        integration.start().await.unwrap();
        
        // Crea un listener personalizzato
        let mut listener = integration.create_system_event_listener();
        
        let profile_id = "test_profile_listener";
        integration.add_active_profile(profile_id.to_string()).await;
        
        // Emette un evento
        let event = SystemEvent::UpdateAvailable {
            version: "4.0.0".to_string(),
            release_notes: "Test release".to_string(),
            download_url: None,
            is_critical: false,
        };
        
        integration.emit_system_event(event.clone()).await.unwrap();
        
        // Il listener dovrebbe ricevere l'evento
        tokio::select! {
            received_event = listener.recv() => {
                match received_event {
                    Ok(received) => {
                        match (&received, &event) {
                            (SystemEvent::UpdateAvailable { version: r_ver, .. }, 
                             SystemEvent::UpdateAvailable { version: e_ver, .. }) => {
                                assert_eq!(r_ver, e_ver);
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

    #[tokio::test]
    async fn test_system_integration_stats() {
        let integration = create_test_system_event_integration().await;
        
        let stats = integration.get_system_stats().await;
        assert!(!stats.is_active);
        assert_eq!(stats.active_profiles_count, 0);
        assert_eq!(stats.receiver_count, 0);
        
        integration.start().await.unwrap();
        integration.add_active_profile("test_profile".to_string()).await;
        
        let stats = integration.get_system_stats().await;
        assert!(stats.is_active);
        assert_eq!(stats.active_profiles_count, 1);
    }
}