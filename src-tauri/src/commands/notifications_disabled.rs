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
    pub event_system: Option<Arc<crate::notifications::NotificationEventSystem>>,
    pub auto_integration: Option<Arc<crate::notifications::AutoEventIntegration>>,
    pub system_event_integration: Option<Arc<crate::notifications::SystemEventIntegration>>,
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

/// Salva automaticamente le preferenze per un profilo
#[tauri::command]
pub async fn auto_save_notification_preferences(
    profile_id: String,
    preferences: NotificationPreferences,
    state: State<'_, NotificationManagerState>,
) -> Result<bool, String> {
    let manager = state.manager.lock().await;
    
    // Verifica che il profilo nelle preferenze corrisponda
    if preferences.profile_id != profile_id {
        return Err("Profile ID mismatch".to_string());
    }
    
    match manager.update_preferences(preferences).await {
        Ok(()) => Ok(true),
        Err(e) => {
            eprintln!("Errore nel salvataggio automatico per profilo {}: {}", profile_id, e);
            Ok(false)
        }
    }
}

/// Sincronizza le preferenze notifiche con il cambio profilo
#[tauri::command]
pub async fn sync_notification_preferences_on_profile_switch(
    old_profile_id: Option<String>,
    new_profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationPreferences, String> {
    let manager = state.manager.lock().await;
    
    // Se c'è un profilo precedente, assicurati che le sue preferenze siano salvate
    if let Some(old_id) = old_profile_id {
        // Log del cambio profilo per le notifiche
        println!("[NOTIFICATION SYNC] Cambio profilo da {} a {}", old_id, new_profile_id);
    }
    
    // Carica le preferenze per il nuovo profilo
    manager.get_preferences(&new_profile_id).await
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

// TODO: Implementare quando necessario
/*
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
*/

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

// TODO: Implementare funzioni di sistema quando necessario
/*
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
*/

// ===== EVENT SYSTEM COMMANDS =====

/// Avvia il sistema di eventi per notifiche automatiche
#[tauri::command]
pub async fn start_notification_event_system(
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref event_system) = state.event_system {
        event_system.start().await.map_err(|e| e.to_string())
    } else {
        Err("Sistema eventi non inizializzato".to_string())
    }
}

/// Ferma il sistema di eventi per notifiche automatiche
#[tauri::command]
pub async fn stop_notification_event_system(
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref event_system) = state.event_system {
        event_system.stop().await;
        Ok(())
    } else {
        Err("Sistema eventi non inizializzato".to_string())
    }
}

/// Verifica se il sistema di eventi è attivo
#[tauri::command]
pub async fn is_notification_event_system_active(
    state: State<'_, NotificationManagerState>,
) -> Result<bool, String> {
    if let Some(ref event_system) = state.event_system {
        Ok(event_system.is_active().await)
    } else {
        Ok(false)
    }
}

/// Ottiene statistiche del sistema di eventi
#[tauri::command]
pub async fn get_notification_event_system_stats(
    state: State<'_, NotificationManagerState>,
) -> Result<crate::notifications::EventSystemStats, String> {
    if let Some(ref event_system) = state.event_system {
        Ok(event_system.get_event_stats().await)
    } else {
        Err("Sistema eventi non inizializzato".to_string())
    }
}

/// Emette manualmente un evento profilo (per testing)
#[tauri::command]
pub async fn emit_profile_event_manual(
    event: ProfileEvent,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref event_system) = state.event_system {
        event_system.emit_profile_event(event).await.map_err(|e| e.to_string())
    } else {
        Err("Sistema eventi non inizializzato".to_string())
    }
}

/// Avvia l'integrazione automatica
#[tauri::command]
pub async fn start_auto_event_integration(
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.start().await.map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Ferma l'integrazione automatica
#[tauri::command]
pub async fn stop_auto_event_integration(
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.stop().await;
        Ok(())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Ottiene statistiche dell'integrazione automatica
#[tauri::command]
pub async fn get_auto_integration_stats(
    state: State<'_, NotificationManagerState>,
) -> Result<crate::notifications::IntegrationStats, String> {
    if let Some(ref auto_integration) = state.auto_integration {
        Ok(auto_integration.get_integration_stats().await)
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Verifica lo stato di salute dell'integrazione
#[tauri::command]
pub async fn check_auto_integration_health(
    state: State<'_, NotificationManagerState>,
) -> Result<crate::notifications::IntegrationHealthStatus, String> {
    if let Some(ref auto_integration) = state.auto_integration {
        Ok(auto_integration.health_check().await)
    } else {
        Ok(crate::notifications::IntegrationHealthStatus::Inactive)
    }
}

/// Hook manuale per creazione profilo
#[tauri::command]
pub async fn trigger_profile_created_event(
    profile_id: String,
    profile_name: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_profile_created(&profile_id, &profile_name).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per autenticazione profilo
#[tauri::command]
pub async fn trigger_profile_authenticated_event(
    profile_id: String,
    profile_name: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_profile_authenticated(&profile_id, &profile_name).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per cambio profilo
#[tauri::command]
pub async fn trigger_profile_switched_event(
    from_id: Option<String>,
    to_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_profile_switched(from_id.as_deref(), &to_id).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per eliminazione profilo
#[tauri::command]
pub async fn trigger_profile_deleted_event(
    profile_id: String,
    profile_name: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_profile_deleted(&profile_id, &profile_name).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per logout profilo
#[tauri::command]
pub async fn trigger_profile_logged_out_event(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_profile_logged_out(&profile_id).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per fallimento autenticazione
#[tauri::command]
pub async fn trigger_authentication_failed_event(
    profile_name: String,
    reason: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_authentication_failed(&profile_name, &reason).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per operazioni su credenziali
#[tauri::command]
pub async fn trigger_credential_operation_event(
    profile_id: String,
    store: String,
    operation: String,
    success: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_credential_operation(&profile_id, &store, &operation, success).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

/// Hook manuale per aggiornamento impostazioni
#[tauri::command]
pub async fn trigger_settings_updated_event(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref auto_integration) = state.auto_integration {
        auto_integration.on_settings_updated(&profile_id).await
            .map_err(|e| e.to_string())
    } else {
        Err("Integrazione automatica non inizializzata".to_string())
    }
}

// ===== SYSTEM EVENT COMMANDS =====

/// Avvia il sistema di integrazione eventi di sistema
#[tauri::command]
pub async fn start_system_event_integration(
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.start().await.map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Ferma il sistema di integrazione eventi di sistema
#[tauri::command]
pub async fn stop_system_event_integration(
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.stop().await;
        Ok(())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Verifica se il sistema di integrazione eventi di sistema è attivo
#[tauri::command]
pub async fn is_system_event_integration_active(
    state: State<'_, NotificationManagerState>,
) -> Result<bool, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        Ok(system_integration.is_active().await)
    } else {
        Ok(false)
    }
}

/// Ottiene statistiche del sistema di integrazione eventi di sistema
#[tauri::command]
pub async fn get_system_event_integration_stats(
    state: State<'_, NotificationManagerState>,
) -> Result<crate::notifications::SystemIntegrationStats, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        Ok(system_integration.get_system_stats().await)
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Aggiorna la lista dei profili attivi per notifiche di sistema
#[tauri::command]
pub async fn update_system_active_profiles(
    profile_ids: Vec<String>,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.update_active_profiles(profile_ids).await;
        Ok(())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Aggiunge un profilo alla lista degli attivi per notifiche di sistema
#[tauri::command]
pub async fn add_system_active_profile(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.add_active_profile(profile_id).await;
        Ok(())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Rimuove un profilo dalla lista degli attivi per notifiche di sistema
#[tauri::command]
pub async fn remove_system_active_profile(
    profile_id: String,
    state: State<'_, NotificationManagerState>,
) -> Result<(), String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.remove_active_profile(&profile_id).await;
        Ok(())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica aggiornamento disponibile
#[tauri::command]
pub async fn notify_update_available(
    version: String,
    release_notes: String,
    download_url: Option<String>,
    is_critical: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_update_available(version, release_notes, download_url, is_critical).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica aggiornamento installato
#[tauri::command]
pub async fn notify_update_installed(
    version: String,
    previous_version: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_update_installed(version, previous_version).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica errore aggiornamento
#[tauri::command]
pub async fn notify_update_error(
    version: String,
    error_message: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_update_error(version, error_message).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica manutenzione programmata
#[tauri::command]
pub async fn notify_maintenance_scheduled(
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    description: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_maintenance_scheduled(start_time, end_time, description).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica inizio manutenzione
#[tauri::command]
pub async fn notify_maintenance_started(
    description: String,
    estimated_duration: u64,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_maintenance_started(description, estimated_duration).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica completamento manutenzione
#[tauri::command]
pub async fn notify_maintenance_completed(
    description: String,
    actual_duration: u64,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_maintenance_completed(description, actual_duration).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica errore di sistema
#[tauri::command]
pub async fn notify_system_error(
    error_code: String,
    error_message: String,
    component: String,
    is_recoverable: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_system_error(error_code, error_message, component, is_recoverable).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica avviso di sicurezza
#[tauri::command]
pub async fn notify_security_alert(
    alert_type: String,
    severity: String, // "low", "medium", "high", "critical"
    description: String,
    action_required: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        let severity_enum = match severity.to_lowercase().as_str() {
            "low" => crate::notifications::SecuritySeverity::Low,
            "medium" => crate::notifications::SecuritySeverity::Medium,
            "high" => crate::notifications::SecuritySeverity::High,
            "critical" => crate::notifications::SecuritySeverity::Critical,
            _ => crate::notifications::SecuritySeverity::Medium,
        };
        
        system_integration.notify_security_alert(alert_type, severity_enum, description, action_required).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica operazione background completata
#[tauri::command]
pub async fn notify_background_operation_completed(
    operation_type: String,
    operation_id: String,
    success: bool,
    details: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_background_operation_completed(operation_type, operation_id, success, details).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica operazione background fallita
#[tauri::command]
pub async fn notify_background_operation_failed(
    operation_type: String,
    operation_id: String,
    error_message: String,
    retry_count: u32,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_background_operation_failed(operation_type, operation_id, error_message, retry_count).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica cambio stato sistema
#[tauri::command]
pub async fn notify_system_status_changed(
    old_status: String,
    new_status: String,
    reason: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_system_status_changed(old_status, new_status, reason).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica avviso risorsa
#[tauri::command]
pub async fn notify_resource_warning(
    resource_type: String,
    current_usage: f64,
    threshold: f64,
    unit: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_resource_warning(resource_type, current_usage, threshold, unit).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica problema database
#[tauri::command]
pub async fn notify_database_issue(
    database_name: String,
    issue_type: String,
    severity: String,
    auto_fixed: bool,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_database_issue(database_name, issue_type, severity, auto_fixed).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica cambio stato rete
#[tauri::command]
pub async fn notify_network_status_changed(
    is_online: bool,
    previous_status: bool,
    affected_services: Vec<String>,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_network_status_changed(is_online, previous_status, affected_services).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

// === COMANDI DI CONVENIENZA ===

/// Notifica avvio applicazione
#[tauri::command]
pub async fn notify_application_started(
    version: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_application_started(version).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica arresto applicazione
#[tauri::command]
pub async fn notify_application_stopped(
    reason: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_application_stopped(reason).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica backup completato
#[tauri::command]
pub async fn notify_backup_completed(
    backup_type: String,
    success: bool,
    details: String,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_backup_completed(backup_type, success, details).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica sincronizzazione completata
#[tauri::command]
pub async fn notify_sync_completed(
    sync_type: String,
    items_synced: u32,
    errors: u32,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_sync_completed(sync_type, items_synced, errors).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica avviso spazio disco
#[tauri::command]
pub async fn notify_disk_space_warning(
    disk_path: String,
    free_space_gb: f64,
    total_space_gb: f64,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_disk_space_warning(disk_path, free_space_gb, total_space_gb).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}

/// Notifica avviso memoria
#[tauri::command]
pub async fn notify_memory_warning(
    used_memory_mb: f64,
    total_memory_mb: f64,
    state: State<'_, NotificationManagerState>,
) -> Result<Vec<String>, String> {
    if let Some(ref system_integration) = state.system_event_integration {
        system_integration.notify_memory_warning(used_memory_mb, total_memory_mb).await
            .map_err(|e| e.to_string())
    } else {
        Err("Sistema integrazione eventi di sistema non inizializzato".to_string())
    }
}