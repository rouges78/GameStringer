use std::sync::Arc;
use std::collections::HashMap;
use chrono::{DateTime, Utc, Timelike};
use uuid::Uuid;
use crate::notifications::{
    errors::{NotificationError, NotificationResult},
    models::{
        CreateNotificationRequest, Notification, NotificationFilter, NotificationPreferences, 
        PartialNotificationPreferences, NotificationStats, NotificationCounts, NotificationSortBy, 
        NotificationType, NotificationPriority, NotificationMetadata
    },
    storage::NotificationStorage,
    cleanup::{NotificationCleanupManager, CleanupConfig, CleanupStats, CleanupResult},
    access_control::NotificationAccessControl,
};

/// Manager principale per il sistema di notifiche
pub struct NotificationManager {
    storage: Arc<NotificationStorage>,
    cleanup_manager: Option<NotificationCleanupManager>,
}

impl NotificationManager {
    /// Crea una nuova istanza del NotificationManager
    pub fn new(storage: NotificationStorage) -> Self {
        Self { 
            storage: Arc::new(storage),
            cleanup_manager: None,
        }
    }

    /// Crea una nuova istanza con sistema di pulizia automatica
    pub fn new_with_cleanup(storage: NotificationStorage, cleanup_config: CleanupConfig) -> Self {
        let storage_arc = Arc::new(storage);
        let cleanup_manager = NotificationCleanupManager::new(Arc::clone(&storage_arc), cleanup_config);
        
        Self { 
            storage: storage_arc,
            cleanup_manager: Some(cleanup_manager),
        }
    }

    /// Inizializza il manager
    pub async fn initialize(&self) -> NotificationResult<()> {
        self.storage.initialize().await
    }

    /// Crea una nuova notifica con validazione completa
    pub async fn create_notification(&self, request: CreateNotificationRequest) -> NotificationResult<Notification> {
        // Valida la richiesta
        self.validate_notification_request(&request)?;
        
        // Verifica le preferenze del profilo per determinare se creare la notifica
        let preferences = self.get_preferences(&request.profile_id).await?;
        if !self.should_create_notification(&request, &preferences) {
            return Err(NotificationError::InvalidContent(
                "Notifica bloccata dalle preferenze del profilo".to_string()
            ));
        }
        
        // Crea la notifica
        let notification = Notification::new(request);
        
        // Verifica limiti di notifiche per profilo
        self.enforce_notification_limits(&notification.profile_id, &preferences).await?;
        
        // Salva nel storage
        self.storage.save_notification(&notification).await?;
        
        Ok(notification)
    }

    /// Validazione avanzata della richiesta di notifica
    fn validate_notification_request(&self, request: &CreateNotificationRequest) -> NotificationResult<()> {
        // Validazione base
        request.validate()?;
        
        // Validazioni aggiuntive
        if request.profile_id.len() > 100 {
            return Err(NotificationError::InvalidContent(
                "Profile ID troppo lungo (max 100 caratteri)".to_string()
            ));
        }
        
        // Valida metadati se presenti
        if let Some(ref metadata) = request.metadata {
            if metadata.source.is_empty() {
                return Err(NotificationError::InvalidContent(
                    "Source nei metadati non può essere vuoto".to_string()
                ));
            }
            
            if metadata.category.is_empty() {
                return Err(NotificationError::InvalidContent(
                    "Category nei metadati non può essere vuoto".to_string()
                ));
            }
            
            if metadata.tags.len() > 10 {
                return Err(NotificationError::InvalidContent(
                    "Troppi tag nei metadati (max 10)".to_string()
                ));
            }
            
            // Valida custom_data se presente
            if let Some(ref custom_data) = metadata.custom_data {
                if custom_data.len() > 20 {
                    return Err(NotificationError::InvalidContent(
                        "Troppi campi in custom_data (max 20)".to_string()
                    ));
                }
            }
        }
        
        Ok(())
    }

    /// Verifica se una notifica dovrebbe essere creata basandosi sulle preferenze
    fn should_create_notification(&self, request: &CreateNotificationRequest, preferences: &NotificationPreferences) -> bool {
        // Se le notifiche sono disabilitate globalmente
        if !preferences.global_enabled {
            return false;
        }
        
        // Controlla le impostazioni per tipo
        if let Some(type_preference) = preferences.type_settings.get(&request.notification_type) {
            if !type_preference.enabled {
                return false;
            }
            
            // Controlla la priorità minima
            let request_priority = request.priority.as_ref().unwrap_or(&NotificationPriority::Normal);
            if !self.priority_meets_minimum(request_priority, &type_preference.priority) {
                return false;
            }
        }
        
        // Controlla le ore di silenzio
        if let Some(ref quiet_hours) = preferences.quiet_hours {
            if quiet_hours.enabled && self.is_in_quiet_hours(quiet_hours) {
                let request_priority = request.priority.as_ref().unwrap_or(&NotificationPriority::Normal);
                if !quiet_hours.allow_urgent || *request_priority != NotificationPriority::Urgent {
                    return false;
                }
            }
        }
        
        true
    }

    /// Verifica se la priorità soddisfa il minimo richiesto
    fn priority_meets_minimum(&self, request_priority: &NotificationPriority, min_priority: &NotificationPriority) -> bool {
        let priority_levels = [
            NotificationPriority::Low,
            NotificationPriority::Normal,
            NotificationPriority::High,
            NotificationPriority::Urgent,
        ];
        
        let request_level = priority_levels.iter().position(|p| p == request_priority).unwrap_or(1);
        let min_level = priority_levels.iter().position(|p| p == min_priority).unwrap_or(1);
        
        request_level >= min_level
    }

    /// Verifica se siamo nelle ore di silenzio
    fn is_in_quiet_hours(&self, quiet_hours: &crate::notifications::models::QuietHoursSettings) -> bool {
        let now = Utc::now();
        let current_time = format!("{:02}:{:02}", now.hour(), now.minute());
        
        let start_time = &quiet_hours.start_time;
        let end_time = &quiet_hours.end_time;
        
        if start_time <= end_time {
            // Stesso giorno (es. 22:00 - 06:00 del giorno dopo)
            current_time >= *start_time && current_time <= *end_time
        } else {
            // Attraversa la mezzanotte (es. 22:00 - 06:00)
            current_time >= *start_time || current_time <= *end_time
        }
    }

    /// Applica i limiti di notifiche per profilo
    async fn enforce_notification_limits(&self, profile_id: &str, preferences: &NotificationPreferences) -> NotificationResult<()> {
        let current_count = self.storage.count_unread_notifications(profile_id).await?;
        
        if current_count >= preferences.max_notifications {
            // Elimina le notifiche più vecchie lette per fare spazio
            let cutoff_date = Utc::now() - chrono::Duration::days(1);
            let cleaned = self.storage.cleanup_old_read_notifications(cutoff_date).await?;
            
            if cleaned == 0 {
                return Err(NotificationError::StorageError(
                    "Limite massimo notifiche raggiunto".to_string()
                ));
            }
        }
        
        Ok(())
    }

    /// Ottiene le notifiche per un profilo con filtri e ordinamento avanzati
    pub async fn get_notifications(&self, profile_id: &str, filter: NotificationFilter) -> NotificationResult<Vec<Notification>> {
        // Valida il filtro
        self.validate_notification_filter(&filter)?;
        
        // Verifica autorizzazione filtro per profilo
        NotificationAccessControl::validate_filter_for_profile(profile_id, &filter)?;
        
        // Verifica rate limit per operazione
        NotificationAccessControl::check_operation_rate_limit(profile_id, "get_notifications")?;
        
        // Carica le notifiche dal storage
        let mut notifications = self.storage.load_notifications(profile_id, &filter).await?;
        
        // Applica isolamento profilo (filtra solo notifiche del profilo)
        notifications = NotificationAccessControl::filter_notifications_for_profile(profile_id, notifications);
        
        // Sanitizza notifiche per la visualizzazione
        for notification in &mut notifications {
            NotificationAccessControl::sanitize_notification_for_display(notification);
        }
        
        // Applica ordinamento personalizzato se necessario
        self.apply_custom_sorting(&mut notifications, &filter);
        
        // Filtra notifiche scadute se richiesto
        if filter.unread_only.unwrap_or(false) {
            notifications.retain(|n| !n.is_expired());
        }
        
        // Audit log
        NotificationAccessControl::audit_notification_operation(
            profile_id, 
            "get_notifications", 
            &format!("filter_result_{}_items", notifications.len()), 
            true
        );
        
        Ok(notifications)
    }

    /// Ottiene notifiche con ordinamento personalizzato
    pub async fn get_notifications_sorted(&self, profile_id: &str, sort_by: NotificationSortBy, ascending: bool, limit: Option<u32>) -> NotificationResult<Vec<Notification>> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit,
            offset: None,
        };
        
        let mut notifications = self.storage.load_notifications(profile_id, &filter).await?;
        
        // Applica ordinamento
        match sort_by {
            NotificationSortBy::CreatedAt => {
                notifications.sort_by(|a, b| {
                    if ascending {
                        a.created_at.cmp(&b.created_at)
                    } else {
                        b.created_at.cmp(&a.created_at)
                    }
                });
            },
            NotificationSortBy::Priority => {
                notifications.sort_by(|a, b| {
                    let priority_order = |p: &NotificationPriority| match p {
                        NotificationPriority::Urgent => 4,
                        NotificationPriority::High => 3,
                        NotificationPriority::Normal => 2,
                        NotificationPriority::Low => 1,
                    };
                    
                    let a_order = priority_order(&a.priority);
                    let b_order = priority_order(&b.priority);
                    
                    if ascending {
                        a_order.cmp(&b_order)
                    } else {
                        b_order.cmp(&a_order)
                    }
                });
            },
            NotificationSortBy::Type => {
                notifications.sort_by(|a, b| {
                    if ascending {
                        a.notification_type.to_string().cmp(&b.notification_type.to_string())
                    } else {
                        b.notification_type.to_string().cmp(&a.notification_type.to_string())
                    }
                });
            },
            NotificationSortBy::ReadStatus => {
                notifications.sort_by(|a, b| {
                    let a_read = a.is_read();
                    let b_read = b.is_read();
                    
                    if ascending {
                        a_read.cmp(&b_read)
                    } else {
                        b_read.cmp(&a_read)
                    }
                });
            },
        }
        
        Ok(notifications)
    }

    /// Ottiene notifiche filtrate per categoria con conteggi
    pub async fn get_notifications_by_category(&self, profile_id: &str) -> NotificationResult<HashMap<String, Vec<Notification>>> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let mut categorized = HashMap::new();
        
        for notification in notifications {
            let category = notification.metadata.category.clone();
            categorized.entry(category).or_insert_with(Vec::new).push(notification);
        }
        
        Ok(categorized)
    }

    /// Ottiene notifiche non lette con priorità alta o urgente
    pub async fn get_high_priority_unread(&self, profile_id: &str) -> NotificationResult<Vec<Notification>> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: Some(NotificationPriority::High),
            unread_only: Some(true),
            category: None,
            limit: Some(20),
            offset: None,
        };
        
        let mut high_notifications = self.storage.load_notifications(profile_id, &filter).await?;
        
        let urgent_filter = NotificationFilter {
            notification_type: None,
            priority: Some(NotificationPriority::Urgent),
            unread_only: Some(true),
            category: None,
            limit: Some(20),
            offset: None,
        };
        
        let urgent_notifications = self.storage.load_notifications(profile_id, &urgent_filter).await?;
        
        high_notifications.extend(urgent_notifications);
        
        // Ordina per priorità (urgenti prima)
        high_notifications.sort_by(|a, b| {
            match (&a.priority, &b.priority) {
                (NotificationPriority::Urgent, NotificationPriority::High) => std::cmp::Ordering::Less,
                (NotificationPriority::High, NotificationPriority::Urgent) => std::cmp::Ordering::Greater,
                _ => b.created_at.cmp(&a.created_at),
            }
        });
        
        Ok(high_notifications)
    }

    /// Valida il filtro delle notifiche
    fn validate_notification_filter(&self, filter: &NotificationFilter) -> NotificationResult<()> {
        if let Some(limit) = filter.limit {
            if limit > 1000 {
                return Err(NotificationError::InvalidContent(
                    "Limite troppo alto (max 1000)".to_string()
                ));
            }
        }
        
        if let Some(offset) = filter.offset {
            if offset > 100000 {
                return Err(NotificationError::InvalidContent(
                    "Offset troppo alto (max 100000)".to_string()
                ));
            }
        }
        
        Ok(())
    }

    /// Applica ordinamento personalizzato
    fn apply_custom_sorting(&self, notifications: &mut Vec<Notification>, _filter: &NotificationFilter) {
        // Ordinamento predefinito: non lette prima, poi per data di creazione (più recenti prima)
        notifications.sort_by(|a, b| {
            // Prima le non lette
            match (a.is_read(), b.is_read()) {
                (false, true) => std::cmp::Ordering::Less,
                (true, false) => std::cmp::Ordering::Greater,
                _ => {
                    // Poi per priorità (più alta prima)
                    let priority_order = |p: &NotificationPriority| match p {
                        NotificationPriority::Urgent => 4,
                        NotificationPriority::High => 3,
                        NotificationPriority::Normal => 2,
                        NotificationPriority::Low => 1,
                    };
                    
                    let a_priority = priority_order(&a.priority);
                    let b_priority = priority_order(&b.priority);
                    
                    match b_priority.cmp(&a_priority) {
                        std::cmp::Ordering::Equal => {
                            // Infine per data di creazione (più recenti prima)
                            b.created_at.cmp(&a.created_at)
                        },
                        other => other,
                    }
                }
            }
        });
    }

    /// Marca una notifica come letta
    pub async fn mark_as_read(&self, notification_id: &str, profile_id: &str) -> NotificationResult<()> {
        // Verifica rate limit per operazione
        NotificationAccessControl::check_operation_rate_limit(profile_id, "mark_as_read")?;
        
        // Carica la notifica specifica
        let mut notification = self.get_notification_by_id(notification_id, profile_id).await?;

        // Verifica autorizzazione per marcare come letta
        if !NotificationAccessControl::can_mark_notification_as_read(profile_id, &notification) {
            NotificationAccessControl::audit_notification_operation(profile_id, "mark_as_read", notification_id, false);
            return Err(NotificationError::UnauthorizedProfile);
        }

        // Verifica che non sia già letta
        if notification.is_read() {
            return Ok(()); // Già letta, nessuna azione necessaria
        }

        // Marca come letta
        notification.mark_as_read();
        
        // Salva l'aggiornamento
        self.storage.update_notification(&notification).await?;
        
        // Audit log
        NotificationAccessControl::audit_notification_operation(profile_id, "mark_as_read", notification_id, true);
        
        Ok(())
    }

    /// Marca multiple notifiche come lette
    pub async fn mark_multiple_as_read(&self, notification_ids: Vec<String>, profile_id: &str) -> NotificationResult<u32> {
        let mut marked_count = 0;
        
        for notification_id in notification_ids {
            match self.mark_as_read(&notification_id, profile_id).await {
                Ok(()) => marked_count += 1,
                Err(NotificationError::NotificationNotFound(_)) => {
                    // Ignora notifiche non trovate
                    continue;
                },
                Err(e) => return Err(e),
            }
        }
        
        Ok(marked_count)
    }

    /// Marca tutte le notifiche di un profilo come lette
    pub async fn mark_all_as_read(&self, profile_id: &str) -> NotificationResult<u32> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: Some(true),
            category: None,
            limit: None,
            offset: None,
        };
        
        let unread_notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let mut marked_count = 0;
        
        for mut notification in unread_notifications {
            notification.mark_as_read();
            self.storage.update_notification(&notification).await?;
            marked_count += 1;
        }
        
        Ok(marked_count)
    }

    /// Marca tutte le notifiche di un tipo come lette
    pub async fn mark_all_by_type_as_read(&self, profile_id: &str, notification_type: NotificationType) -> NotificationResult<u32> {
        let filter = NotificationFilter {
            notification_type: Some(notification_type),
            priority: None,
            unread_only: Some(true),
            category: None,
            limit: None,
            offset: None,
        };
        
        let unread_notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let mut marked_count = 0;
        
        for mut notification in unread_notifications {
            notification.mark_as_read();
            self.storage.update_notification(&notification).await?;
            marked_count += 1;
        }
        
        Ok(marked_count)
    }

    /// Marca una notifica come non letta (per test o correzioni)
    pub async fn mark_as_unread(&self, notification_id: &str, profile_id: &str) -> NotificationResult<()> {
        let mut notification = self.get_notification_by_id(notification_id, profile_id).await?;

        // Rimuovi il timestamp di lettura
        notification.read_at = None;
        
        // Salva l'aggiornamento
        self.storage.update_notification(&notification).await?;
        
        Ok(())
    }

    /// Ottiene una notifica specifica per ID e profilo
    async fn get_notification_by_id(&self, notification_id: &str, profile_id: &str) -> NotificationResult<Notification> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let notification = notifications
            .into_iter()
            .find(|n| n.id == notification_id)
            .ok_or_else(|| NotificationError::NotificationNotFound(notification_id.to_string()))?;

        // Verifica che appartenga al profilo
        if !notification.belongs_to_profile(profile_id) {
            return Err(NotificationError::UnauthorizedProfile);
        }

        Ok(notification)
    }

    /// Ottiene conteggi dettagliati delle notifiche per stato
    pub async fn get_notification_counts(&self, profile_id: &str) -> NotificationResult<NotificationCounts> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let all_notifications = self.storage.load_notifications(profile_id, &filter).await?;
        
        let mut counts = NotificationCounts::default();
        counts.total = all_notifications.len() as u32;
        
        for notification in &all_notifications {
            if !notification.is_read() {
                counts.unread += 1;
                
                match notification.priority {
                    NotificationPriority::Urgent => counts.urgent_unread += 1,
                    NotificationPriority::High => counts.high_priority_unread += 1,
                    _ => {}
                }
            }
            
            if notification.is_expired() {
                counts.expired += 1;
            }
        }
        
        Ok(counts)
    }

    /// Elimina una notifica
    pub async fn delete_notification(&self, notification_id: &str, profile_id: &str) -> NotificationResult<()> {
        // Verifica rate limit per operazione
        NotificationAccessControl::check_operation_rate_limit(profile_id, "delete_notification")?;
        
        // Verifica che la notifica appartenga al profilo
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let notification = notifications
            .into_iter()
            .find(|n| n.id == notification_id)
            .ok_or_else(|| NotificationError::NotificationNotFound(notification_id.to_string()))?;

        // Verifica autorizzazione per eliminazione
        if !NotificationAccessControl::can_delete_notification(profile_id, &notification) {
            NotificationAccessControl::audit_notification_operation(profile_id, "delete_notification", notification_id, false);
            return Err(NotificationError::UnauthorizedProfile);
        }

        // Elimina la notifica
        let result = self.storage.delete_notification(notification_id).await;
        
        // Audit log
        NotificationAccessControl::audit_notification_operation(
            profile_id, 
            "delete_notification", 
            notification_id, 
            result.is_ok()
        );
        
        result
    }

    /// Ottiene il conteggio delle notifiche non lette
    pub async fn get_unread_count(&self, profile_id: &str) -> NotificationResult<u32> {
        self.storage.count_unread_notifications(profile_id).await
    }

    /// Elimina tutte le notifiche di un profilo
    pub async fn clear_all_notifications(&self, profile_id: &str) -> NotificationResult<u32> {
        self.storage.delete_all_notifications(profile_id).await
    }

    /// Aggiorna le preferenze notifiche con validazione
    pub async fn update_preferences(&self, preferences: NotificationPreferences) -> NotificationResult<()> {
        // Valida le preferenze
        self.validate_preferences(&preferences)?;
        
        // Aggiorna il timestamp
        let mut updated_preferences = preferences;
        updated_preferences.updated_at = Utc::now();
        
        // Salva nel storage
        self.storage.save_preferences(&updated_preferences).await?;
        
        Ok(())
    }

    /// Ottiene le preferenze notifiche per un profilo
    pub async fn get_preferences(&self, profile_id: &str) -> NotificationResult<NotificationPreferences> {
        match self.storage.load_preferences(profile_id).await? {
            Some(preferences) => Ok(preferences),
            None => {
                // Crea preferenze predefinite
                let default_preferences = self.create_default_preferences(profile_id);
                
                // Salva le preferenze predefinite
                self.storage.save_preferences(&default_preferences).await?;
                
                Ok(default_preferences)
            }
        }
    }

    /// Aggiorna preferenze parziali per un profilo
    pub async fn update_partial_preferences(&self, profile_id: &str, updates: PartialNotificationPreferences) -> NotificationResult<NotificationPreferences> {
        // Carica le preferenze esistenti
        let mut preferences = self.get_preferences(profile_id).await?;
        
        // Applica gli aggiornamenti
        if let Some(global_enabled) = updates.global_enabled {
            preferences.global_enabled = global_enabled;
        }
        
        if let Some(sound_enabled) = updates.sound_enabled {
            preferences.sound_enabled = sound_enabled;
        }
        
        if let Some(desktop_enabled) = updates.desktop_enabled {
            preferences.desktop_enabled = desktop_enabled;
        }
        
        if let Some(type_settings) = updates.type_settings {
            for (notification_type, type_preference) in type_settings {
                preferences.type_settings.insert(notification_type, type_preference);
            }
        }
        
        if let Some(quiet_hours) = updates.quiet_hours {
            preferences.quiet_hours = Some(quiet_hours);
        }
        
        if let Some(max_notifications) = updates.max_notifications {
            preferences.max_notifications = max_notifications;
        }
        
        if let Some(auto_delete_after_days) = updates.auto_delete_after_days {
            preferences.auto_delete_after_days = auto_delete_after_days;
        }
        
        // Salva le preferenze aggiornate
        self.update_preferences(preferences.clone()).await?;
        
        Ok(preferences)
    }

    /// Abilita/disabilita un tipo di notifica
    pub async fn toggle_notification_type(&self, profile_id: &str, notification_type: NotificationType, enabled: bool) -> NotificationResult<()> {
        let mut preferences = self.get_preferences(profile_id).await?;
        
        if let Some(type_preference) = preferences.type_settings.get_mut(&notification_type) {
            type_preference.enabled = enabled;
        } else {
            // Crea una nuova preferenza per questo tipo
            let mut new_preference = crate::notifications::models::TypePreference::default();
            new_preference.enabled = enabled;
            preferences.type_settings.insert(notification_type, new_preference);
        }
        
        self.update_preferences(preferences).await
    }

    /// Aggiorna le ore di silenzio
    pub async fn update_quiet_hours(&self, profile_id: &str, quiet_hours: Option<crate::notifications::models::QuietHoursSettings>) -> NotificationResult<()> {
        let mut preferences = self.get_preferences(profile_id).await?;
        
        // Valida le ore di silenzio se fornite
        if let Some(ref qh) = quiet_hours {
            self.validate_quiet_hours(qh)?;
        }
        
        preferences.quiet_hours = quiet_hours;
        self.update_preferences(preferences).await
    }

    /// Reimposta le preferenze ai valori predefiniti
    pub async fn reset_preferences_to_default(&self, profile_id: &str) -> NotificationResult<NotificationPreferences> {
        let default_preferences = self.create_default_preferences(profile_id);
        self.storage.save_preferences(&default_preferences).await?;
        Ok(default_preferences)
    }

    /// Esporta le preferenze di un profilo
    pub async fn export_preferences(&self, profile_id: &str) -> NotificationResult<String> {
        let preferences = self.get_preferences(profile_id).await?;
        let json = serde_json::to_string_pretty(&preferences)?;
        Ok(json)
    }

    /// Importa le preferenze per un profilo
    pub async fn import_preferences(&self, profile_id: &str, preferences_json: &str) -> NotificationResult<NotificationPreferences> {
        let mut preferences: NotificationPreferences = serde_json::from_str(preferences_json)?;
        
        // Assicurati che il profile_id corrisponda
        preferences.profile_id = profile_id.to_string();
        preferences.updated_at = Utc::now();
        
        // Valida le preferenze importate
        self.validate_preferences(&preferences)?;
        
        // Salva le preferenze
        self.storage.save_preferences(&preferences).await?;
        
        Ok(preferences)
    }

    /// Ottiene le preferenze per tutti i profili (per amministrazione)
    pub async fn get_all_preferences(&self) -> NotificationResult<Vec<NotificationPreferences>> {
        let profiles_with_prefs = self.storage.get_all_profiles_with_preferences().await?;
        let mut all_preferences = Vec::new();
        
        for (profile_id, preferences_opt) in profiles_with_prefs {
            match preferences_opt {
                Some(preferences) => all_preferences.push(preferences),
                None => {
                    // Crea preferenze predefinite per profili senza preferenze
                    let default_preferences = self.create_default_preferences(&profile_id);
                    self.storage.save_preferences(&default_preferences).await?;
                    all_preferences.push(default_preferences);
                }
            }
        }
        
        Ok(all_preferences)
    }

    /// Crea preferenze predefinite per un profilo
    fn create_default_preferences(&self, profile_id: &str) -> NotificationPreferences {
        let mut preferences = NotificationPreferences::default();
        preferences.profile_id = profile_id.to_string();
        preferences.updated_at = Utc::now();
        preferences
    }

    /// Valida le preferenze notifiche
    fn validate_preferences(&self, preferences: &NotificationPreferences) -> NotificationResult<()> {
        // Valida profile_id
        if preferences.profile_id.trim().is_empty() {
            return Err(NotificationError::InvalidContent("Profile ID vuoto".to_string()));
        }
        
        if preferences.profile_id.len() > 100 {
            return Err(NotificationError::InvalidContent("Profile ID troppo lungo".to_string()));
        }
        
        // Valida limiti numerici
        if preferences.max_notifications == 0 {
            return Err(NotificationError::InvalidContent("max_notifications deve essere maggiore di 0".to_string()));
        }
        
        if preferences.max_notifications > 10000 {
            return Err(NotificationError::InvalidContent("max_notifications troppo alto (max 10000)".to_string()));
        }
        
        if preferences.auto_delete_after_days == 0 {
            return Err(NotificationError::InvalidContent("auto_delete_after_days deve essere maggiore di 0".to_string()));
        }
        
        if preferences.auto_delete_after_days > 365 {
            return Err(NotificationError::InvalidContent("auto_delete_after_days troppo alto (max 365)".to_string()));
        }
        
        // Valida ore di silenzio se presenti
        if let Some(ref quiet_hours) = preferences.quiet_hours {
            self.validate_quiet_hours(quiet_hours)?;
        }
        
        // Valida impostazioni per tipo
        for (notification_type, type_preference) in &preferences.type_settings {
            self.validate_type_preference(notification_type, type_preference)?;
        }
        
        Ok(())
    }

    /// Valida le ore di silenzio
    fn validate_quiet_hours(&self, quiet_hours: &crate::notifications::models::QuietHoursSettings) -> NotificationResult<()> {
        // Valida formato orario
        if !self.is_valid_time_format(&quiet_hours.start_time) {
            return Err(NotificationError::InvalidContent(
                format!("Formato start_time non valido: {}", quiet_hours.start_time)
            ));
        }
        
        if !self.is_valid_time_format(&quiet_hours.end_time) {
            return Err(NotificationError::InvalidContent(
                format!("Formato end_time non valido: {}", quiet_hours.end_time)
            ));
        }
        
        Ok(())
    }

    /// Valida le preferenze per tipo
    fn validate_type_preference(&self, _notification_type: &NotificationType, _type_preference: &crate::notifications::models::TypePreference) -> NotificationResult<()> {
        // Per ora non ci sono validazioni specifiche per le preferenze di tipo
        // Potrebbero essere aggiunte in futuro
        Ok(())
    }

    /// Verifica se il formato orario è valido (HH:MM)
    fn is_valid_time_format(&self, time_str: &str) -> bool {
        let parts: Vec<&str> = time_str.split(':').collect();
        if parts.len() != 2 {
            return false;
        }
        
        if let (Ok(hours), Ok(minutes)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
            hours < 24 && minutes < 60
        } else {
            false
        }
    }

    /// Applica le preferenze globali a una richiesta di notifica
    pub async fn apply_preferences_to_request(&self, request: &mut CreateNotificationRequest) -> NotificationResult<bool> {
        let preferences = self.get_preferences(&request.profile_id).await?;
        
        // Verifica se la notifica dovrebbe essere creata
        if !self.should_create_notification(request, &preferences) {
            return Ok(false);
        }
        
        // Applica le impostazioni del tipo se non specificate
        if let Some(type_preference) = preferences.type_settings.get(&request.notification_type) {
            // Se la priorità non è specificata, usa quella delle preferenze
            if request.priority.is_none() {
                request.priority = Some(type_preference.priority.clone());
            }
        }
        
        Ok(true)
    }

    /// Pulisce le notifiche scadute
    pub async fn cleanup_expired_notifications(&self) -> NotificationResult<u32> {
        self.storage.cleanup_expired().await
    }

    /// Avvia il sistema di pulizia automatica
    pub async fn start_auto_cleanup(&self) -> NotificationResult<()> {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.start_auto_cleanup().await
        } else {
            Err(NotificationError::StorageError("Sistema di pulizia non configurato".to_string()))
        }
    }

    /// Ferma il sistema di pulizia automatica
    pub async fn stop_auto_cleanup(&self) {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.stop_auto_cleanup().await;
        }
    }

    /// Esegue una pulizia manuale completa
    pub async fn run_manual_cleanup(&self) -> NotificationResult<CleanupResult> {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.run_manual_cleanup().await
        } else {
            // Fallback: esegui solo la pulizia delle scadute
            let expired_count = self.storage.cleanup_expired().await?;
            Ok(CleanupResult {
                total_cleaned: expired_count,
                expired_cleaned: expired_count,
                old_read_cleaned: 0,
                retention_cleaned: 0,
            })
        }
    }

    /// Ottiene le statistiche di pulizia
    pub async fn get_cleanup_stats(&self) -> Option<CleanupStats> {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            Some(cleanup_manager.get_cleanup_stats().await)
        } else {
            None
        }
    }

    /// Ottiene le statistiche delle notifiche per un profilo
    pub async fn get_notification_stats(&self, profile_id: &str) -> NotificationResult<NotificationStats> {
        self.storage.get_notification_stats(profile_id).await
    }

    /// Verifica se il cleanup automatico è attivo
    pub async fn is_auto_cleanup_running(&self) -> bool {
        if let Some(ref cleanup_manager) = self.cleanup_manager {
            cleanup_manager.is_auto_cleanup_running().await
        } else {
            false
        }
    }

    /// Gestisce il cambio profilo pulendo le notifiche se necessario
    pub async fn handle_profile_switch(&self, old_profile_id: Option<&str>, new_profile_id: &str) -> NotificationResult<()> {
        // Esegui cleanup per il cambio profilo
        NotificationAccessControl::cleanup_notifications_on_profile_switch(old_profile_id, new_profile_id)?;
        
        // Log del cambio profilo
        if let Some(old_id) = old_profile_id {
            println!("[NOTIFICATION MANAGER] Cambio profilo: {} -> {}", old_id, new_profile_id);
        } else {
            println!("[NOTIFICATION MANAGER] Primo accesso profilo: {}", new_profile_id);
        }
        
        Ok(())
    }

    /// Pulisce tutte le notifiche di un profilo (per eliminazione profilo)
    pub async fn cleanup_profile_notifications(&self, profile_id: &str) -> NotificationResult<u32> {
        // Audit log prima della pulizia
        NotificationAccessControl::audit_notification_operation(
            profile_id, 
            "cleanup_profile_notifications", 
            "all_notifications", 
            true
        );
        
        // Elimina tutte le notifiche del profilo
        let deleted_count = self.storage.delete_all_notifications(profile_id).await?;
        
        // Elimina anche le preferenze del profilo
        self.storage.delete_preferences(profile_id).await?;
        
        println!("[NOTIFICATION MANAGER] Pulite {} notifiche per profilo eliminato: {}", deleted_count, profile_id);
        
        Ok(deleted_count)
    }

    /// Genera un report di sicurezza per un profilo
    pub async fn generate_security_report(&self, profile_id: &str) -> NotificationResult<crate::notifications::access_control::SecurityReport> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let report = NotificationAccessControl::generate_security_report(profile_id, &notifications);
        
        // Log del report generato
        println!("[NOTIFICATION MANAGER] Report sicurezza generato per profilo {}: {}", profile_id, report.summary());
        
        Ok(report)
    }

    /// Verifica l'integrità delle notifiche di un profilo
    pub async fn verify_profile_notifications_integrity(&self, profile_id: &str) -> NotificationResult<Vec<String>> {
        let filter = NotificationFilter {
            notification_type: None,
            priority: None,
            unread_only: None,
            category: None,
            limit: None,
            offset: None,
        };
        
        let notifications = self.storage.load_notifications(profile_id, &filter).await?;
        let mut integrity_errors = Vec::new();
        
        for notification in &notifications {
            if let Err(error) = NotificationAccessControl::verify_notification_integrity(notification) {
                integrity_errors.push(format!("Notifica {}: {}", notification.id, error));
            }
        }
        
        if !integrity_errors.is_empty() {
            println!("[NOTIFICATION MANAGER] Trovati {} errori di integrità per profilo {}", integrity_errors.len(), profile_id);
        }
        
        Ok(integrity_errors)
    }
}

