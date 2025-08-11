use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use crate::notifications::{
    manager::NotificationManager,
    models::{
        CreateNotificationRequest, Notification, NotificationFilter, NotificationPreferences,
        PartialNotificationPreferences, NotificationCounts, NotificationSortBy, NotificationType,
        NotificationPriority, SystemNotificationStats, SystemNotificationReadStatus, 
        ProfileNotificationSummary
    },
    profile_integration::ProfileNotificationIntegration,
    access_control::SecurityReport,
    errors::NotificationResult,
};
use chrono::{DateTime, Utc};
use crate::profiles::manager::ProfileEvent;

/// Stato condiviso per il NotificationManager
pub struct NotificationManagerState {
    pub manager: Arc<Mutex<NotificationManager>>,
    pub profile_integration: Arc<Mutex<ProfileNotificationIntegration>>,
}

/// Crea una nuova notifica
#[tauri::command]
pub async fn create_notification(
    request: CreateNotificationRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<Notification, String> {
    let manager = state.manager.lock().await;
    manager.create_notification(request).await
        .map_err(|e| e.to_string())
}

/// Ottiene le notifiche per un profilo
#[tauri::command]
pub async fn get_notifications(
    profile_id: String,
    filter: NotificationFilter,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<Notification>, String> {
    let manager = state.manager.lock().await;
    manager.get_notifications(&profile_id, filter).await
        .map_err(|e| e.to_string())
}

/// Ottiene le notifiche ordinate
#[tauri::command]
pub async fn get_notifications_sorted(
    profile_id: String,
    sort_by: NotificationSortBy,
    ascending: bool,
    limit: Option<u32>,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<Notification>, String> {
    let manager = state.manager.lock().await;
    manager.get_notifications_sorted(&profile_id, sort_by, ascending, limit).await
        .map_err(|e| e.to_string())
}

/// Marca una notifica come letta
#[tauri::command]
pub async fn mark_notification_as_read(
    notification_id: String,
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().await;
    manager.mark_as_read(&notification_id, &profile_id).await
        .map_err(|e| e.to_string())
}

/// Marca multiple notifiche come lette
#[tauri::command]
pub async fn mark_multiple_notifications_as_read(
    notification_ids: Vec<String>,
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.mark_multiple_as_read(notification_ids, &profile_id).await
        .map_err(|e| e.to_string())
}

/// Marca tutte le notifiche come lette
#[tauri::command]
pub async fn mark_all_notifications_as_read(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.mark_all_as_read(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Elimina una notifica
#[tauri::command]
pub async fn delete_notification(
    notification_id: String,
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().await;
    manager.delete_notification(&notification_id, &profile_id).await
        .map_err(|e| e.to_string())
}

/// Ottiene il conteggio delle notifiche non lette
#[tauri::command]
pub async fn get_unread_notifications_count(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.get_unread_count(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Ottiene conteggi dettagliati delle notifiche
#[tauri::command]
pub async fn get_notification_counts(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationCounts, String> {
    let manager = state.manager.lock().await;
    manager.get_notification_counts(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Elimina tutte le notifiche di un profilo
#[tauri::command]
pub async fn clear_all_notifications(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.clear_all_notifications(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Ottiene le preferenze notifiche per un profilo
#[tauri::command]
pub async fn get_notification_preferences(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationPreferences, String> {
    let manager = state.manager.lock().await;
    manager.get_preferences(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Aggiorna le preferenze notifiche
#[tauri::command]
pub async fn update_notification_preferences(
    preferences: NotificationPreferences,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().await;
    manager.update_preferences(preferences).await
        .map_err(|e| e.to_string())
}

/// Aggiorna preferenze parziali
#[tauri::command]
pub async fn update_partial_notification_preferences(
    profile_id: String,
    updates: PartialNotificationPreferences,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationPreferences, String> {
    let manager = state.manager.lock().await;
    manager.update_partial_preferences(&profile_id, updates).await
        .map_err(|e| e.to_string())
}

/// Abilita/disabilita un tipo di notifica
#[tauri::command]
pub async fn toggle_notification_type(
    profile_id: String,
    notification_type: NotificationType,
    enabled: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().await;
    manager.toggle_notification_type(&profile_id, notification_type, enabled).await
        .map_err(|e| e.to_string())
}

/// Reimposta le preferenze ai valori predefiniti
#[tauri::command]
pub async fn reset_notification_preferences_to_default(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationPreferences, String> {
    let manager = state.manager.lock().await;
    manager.reset_preferences_to_default(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Gestisce eventi del ProfileManager
#[tauri::command]
pub async fn handle_profile_event(
    event: ProfileEvent,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let integration = state.profile_integration.lock().await;
    integration.handle_profile_event(event).await
        .map_err(|e| e.to_string())
}

/// Gestisce il cambio profilo
#[tauri::command]
pub async fn handle_profile_switch(
    old_profile_id: Option<String>,
    new_profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().await;
    manager.handle_profile_switch(old_profile_id.as_deref(), &new_profile_id).await
        .map_err(|e| e.to_string())
}

/// Pulisce le notifiche di un profilo eliminato
#[tauri::command]
pub async fn cleanup_profile_notifications(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.cleanup_profile_notifications(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Genera un report di sicurezza per un profilo
#[tauri::command]
pub async fn generate_notification_security_report(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<SecurityReport, String> {
    let manager = state.manager.lock().await;
    manager.generate_security_report(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Verifica l'integrità delle notifiche di un profilo
#[tauri::command]
pub async fn verify_profile_notifications_integrity(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.manager.lock().await;
    manager.verify_profile_notifications_integrity(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Ottiene notifiche ad alta priorità non lette
#[tauri::command]
pub async fn get_high_priority_unread_notifications(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<Notification>, String> {
    let manager = state.manager.lock().await;
    manager.get_high_priority_unread(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Pulisce le notifiche scadute
#[tauri::command]
pub async fn cleanup_expired_notifications(
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.cleanup_expired_notifications().await
        .map_err(|e| e.to_string())
}

/// Crea notifica per errore di autenticazione
#[tauri::command]
pub async fn create_authentication_error_notification(
    profile_id: String,
    error_message: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let integration = state.profile_integration.lock().await;
    integration.create_authentication_error_notification(&profile_id, &error_message).await
        .map_err(|e| e.to_string())
}

/// Crea notifica per profilo bloccato
#[tauri::command]
pub async fn create_profile_locked_notification(
    profile_id: String,
    remaining_seconds: u64,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let integration = state.profile_integration.lock().await;
    integration.create_profile_locked_notification(&profile_id, remaining_seconds).await
        .map_err(|e| e.to_string())
}

/// Crea notifica per operazione su credenziali
#[tauri::command]
pub async fn create_credential_operation_notification(
    profile_id: String,
    store: String,
    operation: String,
    success: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let integration = state.profile_integration.lock().await;
    integration.create_credential_operation_notification(&profile_id, &store, &operation, success).await
        .map_err(|e| e.to_string())
}

/// Crea notifica per aggiornamento impostazioni
#[tauri::command]
pub async fn create_settings_update_notification(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let integration = state.profile_integration.lock().await;
    integration.create_settings_update_notification(&profile_id).await
        .map_err(|e| e.to_string())
}

/// Crea notifica per backup
#[tauri::command]
pub async fn create_backup_notification(
    profile_id: String,
    backup_path: String,
    success: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    let integration = state.profile_integration.lock().await;
    integration.create_backup_notification(&profile_id, &backup_path, success).await
        .map_err(|e| e.to_string())
}

// ===== SYSTEM NOTIFICATION COMMANDS =====

/// Crea una notifica di sistema broadcast a tutti i profili attivi
#[tauri::command]
pub async fn create_system_broadcast_notification(
    title: String,
    message: String,
    priority: NotificationPriority,
    expires_at: Option<DateTime<Utc>>,
    icon: Option<String>,
    action_url: Option<String>,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.manager.lock().await;
    manager.create_system_broadcast_notification(
        title, message, priority, expires_at, icon, action_url
    ).await.map_err(|e| e.to_string())
}

/// Crea una notifica di sistema con priorità alta per tutti i profili
#[tauri::command]
pub async fn create_urgent_system_notification(
    title: String,
    message: String,
    expires_at: Option<DateTime<Utc>>,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.manager.lock().await;
    manager.create_urgent_system_notification(title, message, expires_at).await
        .map_err(|e| e.to_string())
}

/// Crea notifica di manutenzione programmata
#[tauri::command]
pub async fn create_maintenance_notification(
    maintenance_start: DateTime<Utc>,
    maintenance_end: DateTime<Utc>,
    description: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.manager.lock().await;
    manager.create_maintenance_notification(maintenance_start, maintenance_end, description).await
        .map_err(|e| e.to_string())
}

/// Crea notifica di aggiornamento disponibile per tutti i profili
#[tauri::command]
pub async fn create_update_available_notification(
    version: String,
    release_notes: String,
    download_url: Option<String>,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.manager.lock().await;
    manager.create_update_available_notification(version, release_notes, download_url).await
        .map_err(|e| e.to_string())
}

/// Ottiene tutte le notifiche di sistema attive
#[tauri::command]
pub async fn get_active_system_notifications(
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<Notification>, String> {
    let manager = state.manager.lock().await;
    manager.get_active_system_notifications().await
        .map_err(|e| e.to_string())
}

/// Ottiene statistiche delle notifiche di sistema
#[tauri::command]
pub async fn get_system_notification_stats(
    state: State<'_, NotificationManagerState>,
) -> Result<SystemNotificationStats, String> {
    let manager = state.manager.lock().await;
    manager.get_system_notification_stats().await
        .map_err(|e| e.to_string())
}

/// Elimina una notifica di sistema da tutti i profili
#[tauri::command]
pub async fn delete_system_notification_from_all_profiles(
    notification_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.delete_system_notification_from_all_profiles(&notification_id).await
        .map_err(|e| e.to_string())
}

/// Aggiorna la scadenza di una notifica di sistema
#[tauri::command]
pub async fn update_system_notification_expiry(
    notification_id: String,
    new_expiry: Option<DateTime<Utc>>,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.update_system_notification_expiry(&notification_id, new_expiry).await
        .map_err(|e| e.to_string())
}

/// Aggiorna la priorità di una notifica di sistema
#[tauri::command]
pub async fn update_system_notification_priority(
    notification_id: String,
    new_priority: NotificationPriority,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.update_system_notification_priority(&notification_id, new_priority).await
        .map_err(|e| e.to_string())
}

/// Ottiene profili che hanno letto una specifica notifica di sistema
#[tauri::command]
pub async fn get_system_notification_read_status(
    notification_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<SystemNotificationReadStatus, String> {
    let manager = state.manager.lock().await;
    manager.get_system_notification_read_status(&notification_id).await
        .map_err(|e| e.to_string())
}

/// Forza la scadenza di tutte le notifiche di sistema più vecchie di X giorni
#[tauri::command]
pub async fn expire_old_system_notifications(
    days_old: u32,
    state: State<'_, NotificationManagerState>,
) -> Result<u32, String> {
    let manager = state.manager.lock().await;
    manager.expire_old_system_notifications(days_old).await
        .map_err(|e| e.to_string())
}

/// Ottiene lista di tutti i profili per amministrazione notifiche
#[tauri::command]
pub async fn get_profiles_for_notification_admin(
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<ProfileNotificationSummary>, String> {
    let manager = state.manager.lock().await;
    manager.get_profiles_for_notification_admin().await
        .map_err(|e| e.to_string())
}