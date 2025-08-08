use chrono::{DateTime, Duration, Utc};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration as TokioDuration};

use crate::notifications::{
    errors::{NotificationError, NotificationResult},
    storage::NotificationStorage,
    models::NotificationPreferences,
};

/// Configurazione per il sistema di pulizia automatica
#[derive(Debug, Clone)]
pub struct CleanupConfig {
    /// Intervallo di pulizia automatica (in minuti)
    pub cleanup_interval_minutes: u64,
    /// Numero massimo di notifiche da eliminare per batch
    pub max_cleanup_batch_size: u32,
    /// Abilita la pulizia automatica
    pub auto_cleanup_enabled: bool,
    /// Giorni di retention predefiniti se non specificato nelle preferenze
    pub default_retention_days: u32,
    /// Abilita la pulizia delle notifiche lette vecchie
    pub cleanup_old_read_notifications: bool,
    /// Giorni dopo cui eliminare le notifiche lette
    pub read_notifications_retention_days: u32,
}

impl Default for CleanupConfig {
    fn default() -> Self {
        Self {
            cleanup_interval_minutes: 60, // Ogni ora
            max_cleanup_batch_size: 100,
            auto_cleanup_enabled: true,
            default_retention_days: 30,
            cleanup_old_read_notifications: true,
            read_notifications_retention_days: 7, // 1 settimana per le lette
        }
    }
}

/// Statistiche della pulizia
#[derive(Debug, Clone, Default)]
pub struct CleanupStats {
    /// Numero totale di notifiche eliminate
    pub total_cleaned: u64,
    /// Numero di notifiche scadute eliminate
    pub expired_cleaned: u64,
    /// Numero di notifiche vecchie lette eliminate
    pub old_read_cleaned: u64,
    /// Numero di notifiche eliminate per retention policy
    pub retention_cleaned: u64,
    /// Ultimo cleanup eseguito
    pub last_cleanup: Option<DateTime<Utc>>,
    /// Durata ultimo cleanup (in millisecondi)
    pub last_cleanup_duration_ms: u64,
    /// Numero di errori durante la pulizia
    pub cleanup_errors: u64,
}

/// Manager per la pulizia automatica delle notifiche
pub struct NotificationCleanupManager {
    storage: Arc<NotificationStorage>,
    config: CleanupConfig,
    stats: Arc<Mutex<CleanupStats>>,
    is_running: Arc<Mutex<bool>>,
}

impl NotificationCleanupManager {
    /// Crea una nuova istanza del cleanup manager
    pub fn new(storage: Arc<NotificationStorage>, config: CleanupConfig) -> Self {
        Self {
            storage,
            config,
            stats: Arc::new(Mutex::new(CleanupStats::default())),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Avvia il sistema di pulizia automatica
    pub async fn start_auto_cleanup(&self) -> NotificationResult<()> {
        if !self.config.auto_cleanup_enabled {
            return Ok(());
        }

        let mut is_running = self.is_running.lock().await;
        if *is_running {
            return Ok(()); // Già in esecuzione
        }
        *is_running = true;
        drop(is_running);

        let storage = Arc::clone(&self.storage);
        let stats = Arc::clone(&self.stats);
        let is_running = Arc::clone(&self.is_running);
        let config = self.config.clone();

        // Spawn del task di pulizia automatica
        tokio::spawn(async move {
            let mut cleanup_interval = interval(TokioDuration::from_secs(config.cleanup_interval_minutes * 60));
            
            loop {
                cleanup_interval.tick().await;
                
                // Controlla se dobbiamo continuare
                {
                    let running = is_running.lock().await;
                    if !*running {
                        break;
                    }
                }

                // Esegui solo la pulizia delle notifiche scadute (più semplice e thread-safe)
                let start_time = Utc::now();
                match storage.cleanup_expired().await {
                    Ok(expired_count) => {
                        let duration = Utc::now().signed_duration_since(start_time);
                        let mut stats_guard = stats.lock().await;
                        stats_guard.total_cleaned += expired_count as u64;
                        stats_guard.expired_cleaned += expired_count as u64;
                        stats_guard.last_cleanup = Some(start_time);
                        stats_guard.last_cleanup_duration_ms = duration.num_milliseconds() as u64;
                        
                        if expired_count > 0 {
                            log::info!("Cleanup automatico completato: {} notifiche scadute eliminate in {}ms", 
                                     expired_count, duration.num_milliseconds());
                        }
                    }
                    Err(e) => {
                        let mut stats_guard = stats.lock().await;
                        stats_guard.cleanup_errors += 1;
                        log::error!("Errore durante cleanup automatico: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    /// Ferma il sistema di pulizia automatica
    pub async fn stop_auto_cleanup(&self) {
        let mut is_running = self.is_running.lock().await;
        *is_running = false;
    }

    /// Esegue una pulizia manuale
    pub async fn run_manual_cleanup(&self) -> NotificationResult<CleanupResult> {
        let start_time = Utc::now();
        let result = Self::perform_cleanup_internal(&self.storage, &self.config).await?;
        
        let duration = Utc::now().signed_duration_since(start_time);
        let mut stats = self.stats.lock().await;
        stats.total_cleaned += result.total_cleaned as u64;
        stats.expired_cleaned += result.expired_cleaned as u64;
        stats.old_read_cleaned += result.old_read_cleaned as u64;
        stats.retention_cleaned += result.retention_cleaned as u64;
        stats.last_cleanup = Some(start_time);
        stats.last_cleanup_duration_ms = duration.num_milliseconds() as u64;

        Ok(result)
    }

    /// Ottiene le statistiche di pulizia
    pub async fn get_cleanup_stats(&self) -> CleanupStats {
        self.stats.lock().await.clone()
    }

    /// Resetta le statistiche di pulizia
    pub async fn reset_stats(&self) {
        let mut stats = self.stats.lock().await;
        *stats = CleanupStats::default();
    }

    /// Esegue la pulizia interna
    async fn perform_cleanup_internal(
        storage: &NotificationStorage,
        config: &CleanupConfig,
    ) -> NotificationResult<CleanupResult> {
        let mut result = CleanupResult::default();

        // 1. Pulisci notifiche scadute
        let expired_count = storage.cleanup_expired().await?;
        result.expired_cleaned = expired_count;
        result.total_cleaned += expired_count;

        // 2. Pulisci notifiche vecchie lette (se abilitato)
        if config.cleanup_old_read_notifications {
            let old_read_count = Self::cleanup_old_read_notifications(storage, config).await?;
            result.old_read_cleaned = old_read_count;
            result.total_cleaned += old_read_count;
        }

        // 3. Applica retention policy basata sulle preferenze utente
        let retention_count = Self::cleanup_by_retention_policy(storage, config).await?;
        result.retention_cleaned = retention_count;
        result.total_cleaned += retention_count;

        Ok(result)
    }

    /// Pulisce le notifiche lette vecchie
    async fn cleanup_old_read_notifications(
        storage: &NotificationStorage,
        config: &CleanupConfig,
    ) -> NotificationResult<u32> {
        let cutoff_date = Utc::now() - Duration::days(config.read_notifications_retention_days as i64);
        
        // Questa è una query personalizzata che dovremmo aggiungere al storage
        storage.cleanup_old_read_notifications(cutoff_date).await
    }

    /// Pulisce le notifiche basandosi sulla retention policy delle preferenze utente
    async fn cleanup_by_retention_policy(
        storage: &NotificationStorage,
        config: &CleanupConfig,
    ) -> NotificationResult<u32> {
        // Ottieni tutti i profili con le loro preferenze
        let profiles_with_preferences = storage.get_all_profiles_with_preferences().await?;
        let mut total_cleaned = 0;

        for (profile_id, preferences) in profiles_with_preferences {
            let retention_days = preferences
                .map(|p| p.auto_delete_after_days)
                .unwrap_or(config.default_retention_days);

            let cutoff_date = Utc::now() - Duration::days(retention_days as i64);
            let cleaned = storage.cleanup_notifications_older_than(&profile_id, cutoff_date).await?;
            total_cleaned += cleaned;
        }

        Ok(total_cleaned)
    }

    /// Ottiene la configurazione corrente
    pub fn get_config(&self) -> &CleanupConfig {
        &self.config
    }

    /// Aggiorna la configurazione
    pub async fn update_config(&mut self, new_config: CleanupConfig) -> NotificationResult<()> {
        let was_running = {
            let is_running = self.is_running.lock().await;
            *is_running
        };

        // Se era in esecuzione, fermalo
        if was_running {
            self.stop_auto_cleanup().await;
        }

        // Aggiorna la configurazione
        self.config = new_config;

        // Se era in esecuzione, riavvialo con la nuova configurazione
        if was_running && self.config.auto_cleanup_enabled {
            self.start_auto_cleanup().await?;
        }

        Ok(())
    }

    /// Verifica se il cleanup automatico è attivo
    pub async fn is_auto_cleanup_running(&self) -> bool {
        *self.is_running.lock().await
    }
}

/// Risultato di un'operazione di pulizia
#[derive(Debug, Clone, Default)]
pub struct CleanupResult {
    /// Numero totale di notifiche eliminate
    pub total_cleaned: u32,
    /// Numero di notifiche scadute eliminate
    pub expired_cleaned: u32,
    /// Numero di notifiche vecchie lette eliminate
    pub old_read_cleaned: u32,
    /// Numero di notifiche eliminate per retention policy
    pub retention_cleaned: u32,
}

impl CleanupResult {
    /// Combina due risultati di pulizia
    pub fn combine(&mut self, other: CleanupResult) {
        self.total_cleaned += other.total_cleaned;
        self.expired_cleaned += other.expired_cleaned;
        self.old_read_cleaned += other.old_read_cleaned;
        self.retention_cleaned += other.retention_cleaned;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::{
        models::{CreateNotificationRequest, NotificationType, NotificationPriority, NotificationMetadata},
        storage::NotificationStorage,
    };
    use tempfile::tempdir;
    use tokio::time::{sleep, Duration as TokioDuration};

    async fn create_test_storage() -> NotificationStorage {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_cleanup.db");
        let storage = NotificationStorage::new(db_path);
        storage.initialize().await.unwrap();
        storage
    }

    #[tokio::test]
    async fn test_cleanup_expired_notifications() {
        let storage = Arc::new(create_test_storage().await);
        let config = CleanupConfig::default();
        let cleanup_manager = NotificationCleanupManager::new(Arc::clone(&storage), config);

        // Crea una notifica scaduta
        let expired_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Expired Notification".to_string(),
            message: "This should be cleaned up".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() - Duration::hours(1)), // Scaduta 1 ora fa
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "test".to_string(),
                tags: vec![],
                custom_data: None,
            }),
        };

        let expired_notification = crate::notifications::models::Notification::new(expired_request);
        storage.save_notification(&expired_notification).await.unwrap();

        // Crea una notifica valida
        let valid_request = CreateNotificationRequest {
            profile_id: "test_profile".to_string(),
            notification_type: NotificationType::System,
            title: "Valid Notification".to_string(),
            message: "This should remain".to_string(),
            icon: None,
            action_url: None,
            priority: Some(NotificationPriority::Normal),
            expires_at: Some(Utc::now() + Duration::hours(1)), // Scade tra 1 ora
            metadata: Some(NotificationMetadata {
                source: "test".to_string(),
                category: "test".to_string(),
                tags: vec![],
                custom_data: None,
            }),
        };

        let valid_notification = crate::notifications::models::Notification::new(valid_request);
        storage.save_notification(&valid_notification).await.unwrap();

        // Esegui la pulizia
        let result = cleanup_manager.run_manual_cleanup().await.unwrap();

        // Verifica che sia stata eliminata solo la notifica scaduta
        assert_eq!(result.expired_cleaned, 1);
        assert_eq!(result.total_cleaned, 1);

        // Verifica le statistiche
        let stats = cleanup_manager.get_cleanup_stats().await;
        assert_eq!(stats.expired_cleaned, 1);
        assert_eq!(stats.total_cleaned, 1);
        assert!(stats.last_cleanup.is_some());
    }

    #[tokio::test]
    async fn test_auto_cleanup_start_stop() {
        let storage = Arc::new(create_test_storage().await);
        let mut config = CleanupConfig::default();
        config.cleanup_interval_minutes = 1; // 1 minuto per il test
        
        let cleanup_manager = NotificationCleanupManager::new(Arc::clone(&storage), config);

        // Verifica che non sia in esecuzione
        assert!(!cleanup_manager.is_auto_cleanup_running().await);

        // Avvia il cleanup automatico
        cleanup_manager.start_auto_cleanup().await.unwrap();
        assert!(cleanup_manager.is_auto_cleanup_running().await);

        // Ferma il cleanup automatico
        cleanup_manager.stop_auto_cleanup().await;
        
        // Aspetta un po' per assicurarsi che si fermi
        sleep(TokioDuration::from_millis(100)).await;
        assert!(!cleanup_manager.is_auto_cleanup_running().await);
    }

    #[tokio::test]
    async fn test_cleanup_config_update() {
        let storage = Arc::new(create_test_storage().await);
        let config = CleanupConfig::default();
        let mut cleanup_manager = NotificationCleanupManager::new(Arc::clone(&storage), config);

        // Avvia con configurazione iniziale
        cleanup_manager.start_auto_cleanup().await.unwrap();
        assert!(cleanup_manager.is_auto_cleanup_running().await);

        // Aggiorna la configurazione
        let mut new_config = CleanupConfig::default();
        new_config.cleanup_interval_minutes = 30;
        new_config.auto_cleanup_enabled = false;

        cleanup_manager.update_config(new_config).await.unwrap();

        // Verifica che si sia fermato perché auto_cleanup_enabled = false
        assert!(!cleanup_manager.is_auto_cleanup_running().await);
        assert_eq!(cleanup_manager.get_config().cleanup_interval_minutes, 30);
    }
}