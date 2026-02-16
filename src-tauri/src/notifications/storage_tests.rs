#[cfg(test)]
mod storage_tests {
    use super::*;
    use crate::notifications::{
        storage::NotificationStorage,
        models::{
            CreateNotificationRequest, NotificationFilter, NotificationMetadata, 
            NotificationType, NotificationPriority, NotificationPreferences,
            TypePreference, QuietHoursSettings, Notification
        },
        errors::NotificationError,
    };
    use tempfile::tempdir;
    use chrono::{Utc, Duration};
    use std::collections::HashMap;

    /// Helper per creare uno storage di test
    async fn create_test_storage() -> NotificationStorage {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_storage.db");
        let storage = NotificationStorage::new(db_path);
        storage.initialize().await.unwrap();
        storage
    }

    /// Helper per creare una notifica di test
    fn create_test_notification(profile_id: &str) -> Notification {
        let request = CreateNotificationRequest {
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
        };
        Notification::new(request)
    }

    /// Helper per creare preferenze di test
    fn create_test_preferences(profile_id: &str) -> NotificationPreferences {
        let mut preferences = NotificationPreferences::default();
        preferences.profile_id = profile_id.to_string();
        preferences
    }

    #[tokio::test]
    async fn test_storage_initialization() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_init.db");
        let storage = NotificationStorage::new(db_path.clone());
        
        // Prima dell'inizializzazione, il database non dovrebbe esistere
        assert!(!db_path.exists());
        
        // Inizializza lo storage
        let result = storage.initialize().await;
        assert!(result.is_ok());
        
        // Dopo l'inizializzazione, il database dovrebbe esistere
        assert!(db_path.exists());
        
        // Una seconda inizializzazione dovrebbe funzionare senza problemi
        let result = storage.initialize().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_save_and_load_notification() {
        let storage = create_test_storage().await;
        let notification = create_test_notification("test_profile");
        
        // Salva la notifica
        let result = storage.save_notification(&notification).await;
        assert!(result.is_ok());
        
        // Carica le notifiche
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let loaded_notifications = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded_notifications.len(), 1);
        
        let loaded = &loaded_notifications[0];
        assert_eq!(loaded.id, notification.id);
        assert_eq!(loaded.title, notification.title);
        assert_eq!(loaded.message, notification.message);
        assert_eq!(loaded.profile_id, notification.profile_id);
        assert_eq!(loaded.notification_type, notification.notification_type);
        assert_eq!(loaded.priority, notification.priority);
    }

    #[tokio::test]
    async fn test_load_notifications_with_filters() {
        let storage = create_test_storage().await;
        
        // Crea diverse notifiche
        let notifications = vec![
            {
                let mut n = create_test_notification("test_profile");
                n.notification_type = NotificationType::System;
                n.priority = NotificationPriority::High;
                n.title = "System Notification".to_string();
                n
            },
            {
                let mut n = create_test_notification("test_profile");
                n.notification_type = NotificationType::Profile;
                n.priority = NotificationPriority::Normal;
                n.title = "Profile Notification".to_string();
                n
            },
            {
                let mut n = create_test_notification("test_profile");
                n.notification_type = NotificationType::Security;
                n.priority = NotificationPriority::Urgent;
                n.title = "Security Alert".to_string();
                n
            },
        ];
        
        // Salva tutte le notifiche
        for notification in &notifications {
            storage.save_notification(notification).await.unwrap();
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
        
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].notification_type, NotificationType::System);
        
        // Test filtro per priorità
        let filter = NotificationFilter {
            notification_type: None,
            priority: Some(NotificationPriority::Urgent),
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].priority, NotificationPriority::Urgent);
        
        // Test filtro per categoria
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: Some("test_category".to_string()),
            limit: None,
            offset: None,
        };
        
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 3); // Tutte hanno la stessa categoria
        
        // Test limite
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: Some(2),
            offset: None,
        };
        
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 2);
        
        // Test offset
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: Some(1),
        };
        
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 2); // 3 totali - 1 offset = 2
    }

    #[tokio::test]
    async fn test_load_notifications_unread_only() {
        let storage = create_test_storage().await;
        
        // Crea due notifiche
        let mut notification1 = create_test_notification("test_profile");
        notification1.title = "Notification 1".to_string();
        
        let mut notification2 = create_test_notification("test_profile");
        notification2.title = "Notification 2".to_string();
        
        // Salva entrambe
        storage.save_notification(&notification1).await.unwrap();
        storage.save_notification(&notification2).await.unwrap();
        
        // Marca una come letta
        notification1.mark_as_read();
        storage.update_notification(&notification1).await.unwrap();
        
        // Test filtro solo non lette
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: Some(true),
            category: None,
            limit: None,
            offset: None,
        };
        
        let unread = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(unread.len(), 1);
        assert_eq!(unread[0].title, "Notification 2");
        assert!(!unread[0].is_read());
        
        // Test senza filtro (dovrebbe restituire entrambe)
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let all = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(all.len(), 2);
    }

    #[tokio::test]
    async fn test_update_notification() {
        let storage = create_test_storage().await;
        let mut notification = create_test_notification("test_profile");
        
        // Salva la notifica
        storage.save_notification(&notification).await.unwrap();
        
        // Modifica la notifica
        notification.title = "Updated Title".to_string();
        notification.message = "Updated Message".to_string();
        notification.mark_as_read();
        
        // Aggiorna nel database
        let result = storage.update_notification(&notification).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata aggiornata
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].title, "Updated Title");
        assert_eq!(loaded[0].message, "Updated Message");
        assert!(loaded[0].is_read());
    }

    #[tokio::test]
    async fn test_update_nonexistent_notification() {
        let storage = create_test_storage().await;
        let mut notification = create_test_notification("test_profile");
        notification.id = "nonexistent_id".to_string();
        
        // Prova ad aggiornare una notifica inesistente
        let result = storage.update_notification(&notification).await;
        assert!(matches!(result, Err(NotificationError::NotificationNotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_notification() {
        let storage = create_test_storage().await;
        let notification = create_test_notification("test_profile");
        
        // Salva la notifica
        storage.save_notification(&notification).await.unwrap();
        
        // Verifica che esista
        let filter = NotificationFilter::default();
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 1);
        
        // Elimina la notifica
        let result = storage.delete_notification(&notification.id).await;
        assert!(result.is_ok());
        
        // Verifica che sia stata eliminata
        let loaded = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(loaded.len(), 0);
    }

    #[tokio::test]
    async fn test_delete_nonexistent_notification() {
        let storage = create_test_storage().await;
        
        // Prova a eliminare una notifica inesistente
        let result = storage.delete_notification("nonexistent_id").await;
        assert!(matches!(result, Err(NotificationError::NotificationNotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_all_notifications() {
        let storage = create_test_storage().await;
        
        // Crea notifiche per due profili diversi
        let notification1 = create_test_notification("profile_a");
        let notification2 = create_test_notification("profile_a");
        let notification3 = create_test_notification("profile_b");
        
        storage.save_notification(&notification1).await.unwrap();
        storage.save_notification(&notification2).await.unwrap();
        storage.save_notification(&notification3).await.unwrap();
        
        // Elimina tutte le notifiche del profile_a
        let deleted_count = storage.delete_all_notifications("profile_a").await.unwrap();
        assert_eq!(deleted_count, 2);
        
        // Verifica che le notifiche del profile_a siano state eliminate
        let filter = NotificationFilter::default();
        let loaded_a = storage.load_notifications("profile_a", &filter).await.unwrap();
        assert_eq!(loaded_a.len(), 0);
        
        // Verifica che le notifiche del profile_b esistano ancora
        let loaded_b = storage.load_notifications("profile_b", &filter).await.unwrap();
        assert_eq!(loaded_b.len(), 1);
    }

    #[tokio::test]
    async fn test_count_unread_notifications() {
        let storage = create_test_storage().await;
        
        // Crea tre notifiche
        let mut notification1 = create_test_notification("test_profile");
        let mut notification2 = create_test_notification("test_profile");
        let notification3 = create_test_notification("test_profile");
        
        storage.save_notification(&notification1).await.unwrap();
        storage.save_notification(&notification2).await.unwrap();
        storage.save_notification(&notification3).await.unwrap();
        
        // Inizialmente tutte non lette
        let count = storage.count_unread_notifications("test_profile").await.unwrap();
        assert_eq!(count, 3);
        
        // Marca due come lette
        notification1.mark_as_read();
        notification2.mark_as_read();
        storage.update_notification(&notification1).await.unwrap();
        storage.update_notification(&notification2).await.unwrap();
        
        // Ora dovrebbe essercene solo una non letta
        let count = storage.count_unread_notifications("test_profile").await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_cleanup_expired_notifications() {
        let storage = create_test_storage().await;
        
        // Crea notifiche scadute e non scadute
        let mut expired_notification = create_test_notification("test_profile");
        expired_notification.expires_at = Some(Utc::now() - Duration::hours(1)); // Scaduta
        
        let mut valid_notification = create_test_notification("test_profile");
        valid_notification.expires_at = Some(Utc::now() + Duration::hours(1)); // Valida
        
        let no_expiry_notification = create_test_notification("test_profile"); // Senza scadenza
        
        storage.save_notification(&expired_notification).await.unwrap();
        storage.save_notification(&valid_notification).await.unwrap();
        storage.save_notification(&no_expiry_notification).await.unwrap();
        
        // Verifica che ci siano 3 notifiche
        let filter = NotificationFilter::default();
        let all = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(all.len(), 3);
        
        // Pulisci le notifiche scadute
        let cleaned_count = storage.cleanup_expired().await.unwrap();
        assert_eq!(cleaned_count, 1);
        
        // Verifica che rimangano solo 2 notifiche
        let remaining = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(remaining.len(), 2);
        
        // Verifica che quella scaduta sia stata eliminata
        assert!(!remaining.iter().any(|n| n.id == expired_notification.id));
    }

    #[tokio::test]
    async fn test_cleanup_old_read_notifications() {
        let storage = create_test_storage().await;
        
        // Crea notifiche lette vecchie e recenti
        let mut old_read_notification = create_test_notification("test_profile");
        old_read_notification.mark_as_read();
        old_read_notification.read_at = Some(Utc::now() - Duration::days(2)); // Letta 2 giorni fa
        
        let mut recent_read_notification = create_test_notification("test_profile");
        recent_read_notification.mark_as_read();
        recent_read_notification.read_at = Some(Utc::now() - Duration::hours(1)); // Letta 1 ora fa
        
        let unread_notification = create_test_notification("test_profile"); // Non letta
        
        storage.save_notification(&old_read_notification).await.unwrap();
        storage.save_notification(&recent_read_notification).await.unwrap();
        storage.save_notification(&unread_notification).await.unwrap();
        
        // Pulisci le notifiche lette più vecchie di 1 giorno
        let cutoff_date = Utc::now() - Duration::days(1);
        let cleaned_count = storage.cleanup_old_read_notifications(cutoff_date).await.unwrap();
        assert_eq!(cleaned_count, 1);
        
        // Verifica che rimangano 2 notifiche
        let filter = NotificationFilter::default();
        let remaining = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(remaining.len(), 2);
        
        // Verifica che quella vecchia sia stata eliminata
        assert!(!remaining.iter().any(|n| n.id == old_read_notification.id));
    }

    #[tokio::test]
    async fn test_save_and_load_preferences() {
        let storage = create_test_storage().await;
        let preferences = create_test_preferences("test_profile");
        
        // Salva le preferenze
        let result = storage.save_preferences(&preferences).await;
        assert!(result.is_ok());
        
        // Carica le preferenze
        let loaded_preferences = storage.load_preferences("test_profile").await.unwrap();
        assert!(loaded_preferences.is_some());
        
        let loaded = loaded_preferences.unwrap();
        assert_eq!(loaded.profile_id, preferences.profile_id);
        assert_eq!(loaded.global_enabled, preferences.global_enabled);
        assert_eq!(loaded.sound_enabled, preferences.sound_enabled);
        assert_eq!(loaded.max_notifications, preferences.max_notifications);
    }

    #[tokio::test]
    async fn test_load_nonexistent_preferences() {
        let storage = create_test_storage().await;
        
        // Prova a caricare preferenze per un profilo inesistente
        let result = storage.load_preferences("nonexistent_profile").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_update_preferences() {
        let storage = create_test_storage().await;
        let mut preferences = create_test_preferences("test_profile");
        
        // Salva le preferenze iniziali
        storage.save_preferences(&preferences).await.unwrap();
        
        // Modifica le preferenze
        preferences.global_enabled = false;
        preferences.sound_enabled = false;
        preferences.max_notifications = 25;
        
        // Aggiorna (INSERT OR REPLACE)
        storage.save_preferences(&preferences).await.unwrap();
        
        // Verifica che siano state aggiornate
        let loaded = storage.load_preferences("test_profile").await.unwrap().unwrap();
        assert!(!loaded.global_enabled);
        assert!(!loaded.sound_enabled);
        assert_eq!(loaded.max_notifications, 25);
    }

    #[tokio::test]
    async fn test_preferences_with_quiet_hours() {
        let storage = create_test_storage().await;
        let mut preferences = create_test_preferences("test_profile");
        
        // Aggiungi ore di silenzio
        preferences.quiet_hours = Some(QuietHoursSettings {
            enabled: true,
            start_time: "22:00".to_string(),
            end_time: "06:00".to_string(),
            allow_urgent: true,
        });
        
        // Salva le preferenze
        storage.save_preferences(&preferences).await.unwrap();
        
        // Carica e verifica
        let loaded = storage.load_preferences("test_profile").await.unwrap().unwrap();
        assert!(loaded.quiet_hours.is_some());
        
        let qh = loaded.quiet_hours.unwrap();
        assert!(qh.enabled);
        assert_eq!(qh.start_time, "22:00");
        assert_eq!(qh.end_time, "06:00");
        assert!(qh.allow_urgent);
    }

    #[tokio::test]
    async fn test_preferences_with_type_settings() {
        let storage = create_test_storage().await;
        let mut preferences = create_test_preferences("test_profile");
        
        // Modifica le impostazioni per tipo
        let mut system_preference = TypePreference::default();
        system_preference.enabled = false;
        system_preference.priority = NotificationPriority::High;
        preferences.type_settings.insert(NotificationType::System, system_preference);
        
        // Salva le preferenze
        storage.save_preferences(&preferences).await.unwrap();
        
        // Carica e verifica
        let loaded = storage.load_preferences("test_profile").await.unwrap().unwrap();
        let system_pref = loaded.type_settings.get(&NotificationType::System).unwrap();
        assert!(!system_pref.enabled);
        assert_eq!(system_pref.priority, NotificationPriority::High);
    }

    #[tokio::test]
    async fn test_delete_preferences() {
        let storage = create_test_storage().await;
        let preferences = create_test_preferences("test_profile");
        
        // Salva le preferenze
        storage.save_preferences(&preferences).await.unwrap();
        
        // Verifica che esistano
        let loaded = storage.load_preferences("test_profile").await.unwrap();
        assert!(loaded.is_some());
        
        // Elimina le preferenze
        let result = storage.delete_preferences("test_profile").await;
        assert!(result.is_ok());
        
        // Verifica che siano state eliminate
        let loaded = storage.load_preferences("test_profile").await.unwrap();
        assert!(loaded.is_none());
    }

    #[tokio::test]
    async fn test_get_notification_stats() {
        let storage = create_test_storage().await;
        
        // Crea diverse notifiche
        let mut notification1 = create_test_notification("test_profile");
        notification1.created_at = Utc::now() - Duration::days(5); // 5 giorni fa
        
        let mut notification2 = create_test_notification("test_profile");
        notification2.created_at = Utc::now() - Duration::days(1); // 1 giorno fa
        notification2.mark_as_read();
        
        let mut notification3 = create_test_notification("test_profile");
        notification3.expires_at = Some(Utc::now() - Duration::hours(1)); // Scaduta
        
        storage.save_notification(&notification1).await.unwrap();
        storage.save_notification(&notification2).await.unwrap();
        storage.save_notification(&notification3).await.unwrap();
        
        // Ottieni le statistiche
        let stats = storage.get_notification_stats("test_profile").await.unwrap();
        
        assert_eq!(stats.total_notifications, 3);
        assert_eq!(stats.unread_notifications, 2); // notification1 e notification3
        assert_eq!(stats.expired_notifications, 1); // notification3
        assert!(stats.oldest_notification.is_some());
        assert!(stats.newest_notification.is_some());
        
        // Verifica che la più vecchia sia quella di 5 giorni fa
        let oldest = stats.oldest_notification.unwrap();
        assert_eq!(oldest.date_naive(), notification1.created_at.date_naive());
    }

    #[tokio::test]
    async fn test_get_all_profiles_with_preferences() {
        let storage = create_test_storage().await;
        
        // Crea notifiche per diversi profili
        let notification1 = create_test_notification("profile_a");
        let notification2 = create_test_notification("profile_b");
        let notification3 = create_test_notification("profile_c");
        
        storage.save_notification(&notification1).await.unwrap();
        storage.save_notification(&notification2).await.unwrap();
        storage.save_notification(&notification3).await.unwrap();
        
        // Crea preferenze solo per alcuni profili
        let preferences_a = create_test_preferences("profile_a");
        let preferences_b = create_test_preferences("profile_b");
        
        storage.save_preferences(&preferences_a).await.unwrap();
        storage.save_preferences(&preferences_b).await.unwrap();
        
        // Ottieni tutti i profili con le loro preferenze
        let profiles_with_prefs = storage.get_all_profiles_with_preferences().await.unwrap();
        
        assert_eq!(profiles_with_prefs.len(), 3);
        
        // Verifica che profile_a e profile_b abbiano preferenze
        let profile_a_entry = profiles_with_prefs.iter()
            .find(|(id, _)| id == "profile_a")
            .unwrap();
        assert!(profile_a_entry.1.is_some());
        
        let profile_b_entry = profiles_with_prefs.iter()
            .find(|(id, _)| id == "profile_b")
            .unwrap();
        assert!(profile_b_entry.1.is_some());
        
        // Verifica che profile_c non abbia preferenze
        let profile_c_entry = profiles_with_prefs.iter()
            .find(|(id, _)| id == "profile_c")
            .unwrap();
        assert!(profile_c_entry.1.is_none());
    }

    #[tokio::test]
    async fn test_cleanup_notifications_older_than() {
        let storage = create_test_storage().await;
        
        // Crea notifiche vecchie e recenti
        let mut old_notification = create_test_notification("test_profile");
        old_notification.created_at = Utc::now() - Duration::days(10); // 10 giorni fa
        
        let mut recent_notification = create_test_notification("test_profile");
        recent_notification.created_at = Utc::now() - Duration::hours(1); // 1 ora fa
        
        storage.save_notification(&old_notification).await.unwrap();
        storage.save_notification(&recent_notification).await.unwrap();
        
        // Pulisci le notifiche più vecchie di 5 giorni
        let cutoff_date = Utc::now() - Duration::days(5);
        let cleaned_count = storage.cleanup_notifications_older_than("test_profile", cutoff_date).await.unwrap();
        assert_eq!(cleaned_count, 1);
        
        // Verifica che rimanga solo quella recente
        let filter = NotificationFilter::default();
        let remaining = storage.load_notifications("test_profile", &filter).await.unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, recent_notification.id);
    }

    #[tokio::test]
    async fn test_profile_isolation() {
        let storage = create_test_storage().await;
        
        // Crea notifiche per profili diversi
        let notification_a = create_test_notification("profile_a");
        let notification_b = create_test_notification("profile_b");
        
        storage.save_notification(&notification_a).await.unwrap();
        storage.save_notification(&notification_b).await.unwrap();
        
        // Verifica che ogni profilo veda solo le proprie notifiche
        let filter = NotificationFilter::default();
        
        let notifications_a = storage.load_notifications("profile_a", &filter).await.unwrap();
        assert_eq!(notifications_a.len(), 1);
        assert_eq!(notifications_a[0].profile_id, "profile_a");
        
        let notifications_b = storage.load_notifications("profile_b", &filter).await.unwrap();
        assert_eq!(notifications_b.len(), 1);
        assert_eq!(notifications_b[0].profile_id, "profile_b");
        
        // Verifica conteggi separati
        let count_a = storage.count_unread_notifications("profile_a").await.unwrap();
        let count_b = storage.count_unread_notifications("profile_b").await.unwrap();
        assert_eq!(count_a, 1);
        assert_eq!(count_b, 1);
    }
}

