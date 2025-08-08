use gamestringer::notifications::{
    models::{CreateNotificationRequest, NotificationFilter, NotificationMetadata, NotificationType, NotificationPriority},
    storage::NotificationStorage,
    manager::NotificationManager,
};
use tempfile::tempdir;
use tokio;

#[tokio::test]
async fn test_notification_system_basic() {
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
    
    // Verifica il conteggio delle notifiche non lette
    let unread_count = manager.get_unread_count("test_profile_123").await.unwrap();
    assert_eq!(unread_count, 1);
    
    println!("✅ Test notifiche base completato con successo!");
}