use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::notifications::{
    errors::{NotificationError, NotificationResult},
    models::{
        Notification, NotificationFilter, NotificationMetadata, NotificationPreferences,
        NotificationPriority, NotificationType, NotificationStats,
    },
    performance::{ConnectionPool, BatchOperationManager, OptimizedQueryManager, PerformanceAnalyzer},
};

/// Storage per le notifiche basato su SQLite con ottimizzazioni performance
pub struct NotificationStorage {
    db_path: PathBuf,
    connection: Arc<Mutex<Option<Connection>>>,
    connection_pool: Arc<ConnectionPool>,
    batch_manager: BatchOperationManager,
    query_manager: OptimizedQueryManager,
    performance_analyzer: PerformanceAnalyzer,
}

impl NotificationStorage {
    /// Crea una nuova istanza di NotificationStorage con ottimizzazioni performance
    pub fn new(db_path: PathBuf) -> Self {
        let connection_pool = Arc::new(ConnectionPool::new(db_path.clone(), 5)); // Max 5 connessioni
        let batch_manager = BatchOperationManager::new(connection_pool.clone());
        let query_manager = OptimizedQueryManager::new(connection_pool.clone());
        let performance_analyzer = PerformanceAnalyzer::new(connection_pool.clone());
        
        Self {
            db_path,
            connection: Arc::new(Mutex::new(None)),
            connection_pool,
            batch_manager,
            query_manager,
            performance_analyzer,
        }
    }

    /// Inizializza il database e crea le tabelle
    pub async fn initialize(&self) -> NotificationResult<()> {
        let mut conn_guard = self.connection.lock().unwrap();
        
        if conn_guard.is_none() {
            // Crea la directory se non esiste
            if let Some(parent) = self.db_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            
            let conn = Connection::open(&self.db_path)?;
            
            // Abilita foreign keys
            conn.execute("PRAGMA foreign_keys = ON", [])?;
            
            // Crea le tabelle
            self.create_tables(&conn)?;
            
            *conn_guard = Some(conn);
        }
        
        Ok(())
    }

    /// Crea le tabelle del database
    fn create_tables(&self, conn: &Connection) -> NotificationResult<()> {
        // Tabella notifiche
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                icon TEXT,
                action_url TEXT,
                priority TEXT NOT NULL DEFAULT 'normal',
                created_at DATETIME NOT NULL,
                read_at DATETIME,
                expires_at DATETIME,
                metadata TEXT,
                FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
            )
            "#,
            [],
        )?;

        // Tabella preferenze notifiche
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS notification_preferences (
                profile_id TEXT PRIMARY KEY,
                global_enabled BOOLEAN NOT NULL DEFAULT 1,
                sound_enabled BOOLEAN NOT NULL DEFAULT 1,
                desktop_enabled BOOLEAN NOT NULL DEFAULT 1,
                type_settings TEXT NOT NULL,
                quiet_hours TEXT,
                max_notifications INTEGER NOT NULL DEFAULT 50,
                auto_delete_after_days INTEGER NOT NULL DEFAULT 30,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
            )
            "#,
            [],
        )?;

        // Crea gli indici per performance
        self.create_indexes(conn)?;

        Ok(())
    }

    /// Crea gli indici per ottimizzare le query
    fn create_indexes(&self, conn: &Connection) -> NotificationResult<()> {
        let indexes = [
            "CREATE INDEX IF NOT EXISTS idx_notifications_profile_created ON notifications(profile_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(profile_id, read_at)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority)",
        ];

        for index_sql in &indexes {
            conn.execute(index_sql, [])?;
        }

        Ok(())
    }

    /// Ottiene una connessione al database
    fn get_connection(&self) -> NotificationResult<std::sync::MutexGuard<Option<Connection>>> {
        Ok(self.connection.lock().unwrap())
    }

    /// Salva una notifica nel database
    pub async fn save_notification(&self, notification: &Notification) -> NotificationResult<()> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let metadata_json = serde_json::to_string(&notification.metadata)?;

        conn.execute(
            r#"
            INSERT INTO notifications (
                id, profile_id, notification_type, title, message, icon, action_url,
                priority, created_at, read_at, expires_at, metadata
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                notification.id,
                notification.profile_id,
                notification.notification_type.to_string(),
                notification.title,
                notification.message,
                notification.icon,
                notification.action_url,
                notification.priority.to_string(),
                notification.created_at.to_rfc3339(),
                notification.read_at.map(|dt| dt.to_rfc3339()),
                notification.expires_at.map(|dt| dt.to_rfc3339()),
                metadata_json,
            ],
        )?;

        Ok(())
    }

    /// Carica le notifiche dal database con filtri
    pub async fn load_notifications(
        &self,
        profile_id: &str,
        filter: &NotificationFilter,
    ) -> NotificationResult<Vec<Notification>> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let mut query = "SELECT * FROM notifications WHERE profile_id = ?1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(profile_id.to_string())];
        let mut param_index = 2;

        // Applica filtri
        if let Some(ref notification_type) = filter.notification_type {
            query.push_str(&format!(" AND notification_type = ?{}", param_index));
            params.push(Box::new(notification_type.to_string()));
            param_index += 1;
        }

        if let Some(ref priority) = filter.priority {
            query.push_str(&format!(" AND priority = ?{}", param_index));
            params.push(Box::new(priority.to_string()));
            param_index += 1;
        }

        if let Some(unread_only) = filter.unread_only {
            if unread_only {
                query.push_str(" AND read_at IS NULL");
            }
        }

        if let Some(ref category) = filter.category {
            query.push_str(&format!(" AND JSON_EXTRACT(metadata, '$.category') = ?{}", param_index));
            params.push(Box::new(category.clone()));
            param_index += 1;
        }

        // Ordinamento per data di creazione (più recenti prima)
        query.push_str(" ORDER BY created_at DESC");

        // Limite e offset
        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT ?{}", param_index));
            params.push(Box::new(limit as i64));
            param_index += 1;
        }

        if let Some(offset) = filter.offset {
            query.push_str(&format!(" OFFSET ?{}", param_index));
            params.push(Box::new(offset as i64));
        }

        let mut stmt = conn.prepare(&query)?;
        let notification_iter = stmt.query_map(
            params.iter().map(|p| p.as_ref()).collect::<Vec<_>>().as_slice(),
            |row| self.row_to_notification(row),
        )?;

        let mut notifications = Vec::new();
        for notification in notification_iter {
            notifications.push(notification??);
        }

        Ok(notifications)
    }

    /// Aggiorna una notifica esistente
    pub async fn update_notification(&self, notification: &Notification) -> NotificationResult<()> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let metadata_json = serde_json::to_string(&notification.metadata)?;

        let rows_affected = conn.execute(
            r#"
            UPDATE notifications SET
                notification_type = ?2,
                title = ?3,
                message = ?4,
                icon = ?5,
                action_url = ?6,
                priority = ?7,
                read_at = ?8,
                expires_at = ?9,
                metadata = ?10
            WHERE id = ?1
            "#,
            params![
                notification.id,
                notification.notification_type.to_string(),
                notification.title,
                notification.message,
                notification.icon,
                notification.action_url,
                notification.priority.to_string(),
                notification.read_at.map(|dt| dt.to_rfc3339()),
                notification.expires_at.map(|dt| dt.to_rfc3339()),
                metadata_json,
            ],
        )?;

        if rows_affected == 0 {
            return Err(NotificationError::NotificationNotFound(notification.id.clone()));
        }

        Ok(())
    }

    /// Elimina una notifica dal database
    pub async fn delete_notification(&self, id: &str) -> NotificationResult<()> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let rows_affected = conn.execute("DELETE FROM notifications WHERE id = ?1", params![id])?;

        if rows_affected == 0 {
            return Err(NotificationError::NotificationNotFound(id.to_string()));
        }

        Ok(())
    }

    /// Elimina tutte le notifiche di un profilo
    pub async fn delete_all_notifications(&self, profile_id: &str) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let rows_affected = conn.execute(
            "DELETE FROM notifications WHERE profile_id = ?1",
            params![profile_id],
        )?;

        Ok(rows_affected as u32)
    }

    /// Pulisce le notifiche scadute
    pub async fn cleanup_expired(&self) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let now = Utc::now().to_rfc3339();
        let rows_affected = conn.execute(
            "DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < ?1",
            params![now],
        )?;

        Ok(rows_affected as u32)
    }

    /// Conta le notifiche non lette per un profilo
    pub async fn count_unread_notifications(&self, profile_id: &str) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE profile_id = ?1 AND read_at IS NULL",
            params![profile_id],
            |row| row.get(0),
        )?;

        Ok(count as u32)
    }

    /// Salva le preferenze notifiche per un profilo
    pub async fn save_preferences(&self, preferences: &NotificationPreferences) -> NotificationResult<()> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let type_settings_json = serde_json::to_string(&preferences.type_settings)?;
        let quiet_hours_json = preferences.quiet_hours.as_ref()
            .map(|qh| serde_json::to_string(qh))
            .transpose()?;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO notification_preferences (
                profile_id, global_enabled, sound_enabled, desktop_enabled,
                type_settings, quiet_hours, max_notifications, auto_delete_after_days, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                preferences.profile_id,
                preferences.global_enabled,
                preferences.sound_enabled,
                preferences.desktop_enabled,
                type_settings_json,
                quiet_hours_json,
                preferences.max_notifications as i64,
                preferences.auto_delete_after_days as i64,
                preferences.updated_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    /// Carica le preferenze notifiche per un profilo
    pub async fn load_preferences(&self, profile_id: &str) -> NotificationResult<Option<NotificationPreferences>> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let result = conn.query_row(
            "SELECT * FROM notification_preferences WHERE profile_id = ?1",
            params![profile_id],
            |row| self.row_to_preferences(row),
        );

        match result {
            Ok(preferences) => Ok(Some(preferences?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(NotificationError::DatabaseError(e)),
        }
    }

    /// Converte una riga del database in una Notification
    fn row_to_notification(&self, row: &Row) -> rusqlite::Result<NotificationResult<Notification>> {
        let id: String = row.get("id")?;
        let profile_id: String = row.get("profile_id")?;
        let notification_type_str: String = row.get("notification_type")?;
        let title: String = row.get("title")?;
        let message: String = row.get("message")?;
        let icon: Option<String> = row.get("icon")?;
        let action_url: Option<String> = row.get("action_url")?;
        let priority_str: String = row.get("priority")?;
        let created_at_str: String = row.get("created_at")?;
        let read_at_str: Option<String> = row.get("read_at")?;
        let expires_at_str: Option<String> = row.get("expires_at")?;
        let metadata_json: String = row.get("metadata")?;

        let notification_type = match notification_type_str.parse::<NotificationType>() {
            Ok(nt) => nt,
            Err(e) => return Ok(Err(e)),
        };

        let priority = match priority_str.parse::<NotificationPriority>() {
            Ok(p) => p,
            Err(e) => return Ok(Err(e)),
        };

        let created_at = match DateTime::parse_from_rfc3339(&created_at_str) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(_) => return Ok(Err(NotificationError::StorageError("Formato data non valido".to_string()))),
        };

        let read_at = if let Some(read_at_str) = read_at_str {
            match DateTime::parse_from_rfc3339(&read_at_str) {
                Ok(dt) => Some(dt.with_timezone(&Utc)),
                Err(_) => return Ok(Err(NotificationError::StorageError("Formato data lettura non valido".to_string()))),
            }
        } else {
            None
        };

        let expires_at = if let Some(expires_at_str) = expires_at_str {
            match DateTime::parse_from_rfc3339(&expires_at_str) {
                Ok(dt) => Some(dt.with_timezone(&Utc)),
                Err(_) => return Ok(Err(NotificationError::StorageError("Formato data scadenza non valido".to_string()))),
            }
        } else {
            None
        };

        let metadata = match serde_json::from_str::<NotificationMetadata>(&metadata_json) {
            Ok(m) => m,
            Err(e) => return Ok(Err(NotificationError::SerializationError(e))),
        };

        Ok(Ok(Notification {
            id,
            profile_id,
            notification_type,
            title,
            message,
            icon,
            action_url,
            priority,
            created_at,
            read_at,
            expires_at,
            metadata,
        }))
    }

    /// Pulisce le notifiche lette più vecchie della data specificata
    pub async fn cleanup_old_read_notifications(&self, cutoff_date: DateTime<Utc>) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let cutoff_str = cutoff_date.to_rfc3339();
        let rows_affected = conn.execute(
            "DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < ?1",
            params![cutoff_str],
        )?;

        Ok(rows_affected as u32)
    }

    /// Pulisce le notifiche di un profilo più vecchie della data specificata
    pub async fn cleanup_notifications_older_than(&self, profile_id: &str, cutoff_date: DateTime<Utc>) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let cutoff_str = cutoff_date.to_rfc3339();
        let rows_affected = conn.execute(
            "DELETE FROM notifications WHERE profile_id = ?1 AND created_at < ?2",
            params![profile_id, cutoff_str],
        )?;

        Ok(rows_affected as u32)
    }

    /// Ottiene tutti i profili con le loro preferenze per la pulizia
    pub async fn get_all_profiles_with_preferences(&self) -> NotificationResult<Vec<(String, Option<NotificationPreferences>)>> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        // Prima ottieni tutti i profili unici dalle notifiche
        let mut stmt = conn.prepare("SELECT DISTINCT profile_id FROM notifications")?;
        let profile_iter = stmt.query_map([], |row| {
            Ok(row.get::<_, String>("profile_id")?)
        })?;

        let mut profile_ids = Vec::new();
        for profile_result in profile_iter {
            let profile_id = profile_result?;
            profile_ids.push(profile_id);
        }
        
        // Ora carica le preferenze per ogni profilo
        let mut results = Vec::new();
        for profile_id in profile_ids {
            let preferences = self.load_preferences(&profile_id).await?;
            results.push((profile_id, preferences));
        }

        Ok(results)
    }

    /// Ottiene statistiche sulle notifiche per profilo
    pub async fn get_notification_stats(&self, profile_id: &str) -> NotificationResult<NotificationStats> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let mut stats = NotificationStats::default();

        // Conta totali
        stats.total_notifications = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE profile_id = ?1",
            params![profile_id],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Conta non lette
        stats.unread_notifications = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE profile_id = ?1 AND read_at IS NULL",
            params![profile_id],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Conta scadute
        let now = Utc::now().to_rfc3339();
        stats.expired_notifications = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE profile_id = ?1 AND expires_at IS NOT NULL AND expires_at < ?2",
            params![profile_id, now],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Notifica più vecchia
        let oldest_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT created_at FROM notifications WHERE profile_id = ?1 ORDER BY created_at ASC LIMIT 1",
            params![profile_id],
            |row| row.get(0),
        );

        if let Ok(oldest_str) = oldest_result {
            if let Ok(oldest_date) = DateTime::parse_from_rfc3339(&oldest_str) {
                stats.oldest_notification = Some(oldest_date.with_timezone(&Utc));
            }
        }

        // Notifica più recente
        let newest_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT created_at FROM notifications WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT 1",
            params![profile_id],
            |row| row.get(0),
        );

        if let Ok(newest_str) = newest_result {
            if let Ok(newest_date) = DateTime::parse_from_rfc3339(&newest_str) {
                stats.newest_notification = Some(newest_date.with_timezone(&Utc));
            }
        }

        Ok(stats)
    }

    /// Converte una riga del database in NotificationPreferences
    fn row_to_preferences(&self, row: &Row) -> rusqlite::Result<NotificationResult<NotificationPreferences>> {
        let profile_id: String = row.get("profile_id")?;
        let global_enabled: bool = row.get("global_enabled")?;
        let sound_enabled: bool = row.get("sound_enabled")?;
        let desktop_enabled: bool = row.get("desktop_enabled")?;
        let type_settings_json: String = row.get("type_settings")?;
        let quiet_hours_json: Option<String> = row.get("quiet_hours")?;
        let max_notifications: i64 = row.get("max_notifications")?;
        let auto_delete_after_days: i64 = row.get("auto_delete_after_days")?;
        let updated_at_str: String = row.get("updated_at")?;

        let type_settings = match serde_json::from_str(&type_settings_json) {
            Ok(ts) => ts,
            Err(e) => return Ok(Err(NotificationError::SerializationError(e))),
        };

        let quiet_hours = if let Some(qh_json) = quiet_hours_json {
            match serde_json::from_str(&qh_json) {
                Ok(qh) => Some(qh),
                Err(e) => return Ok(Err(NotificationError::SerializationError(e))),
            }
        } else {
            None
        };

        let updated_at = match DateTime::parse_from_rfc3339(&updated_at_str) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(_) => return Ok(Err(NotificationError::StorageError("Formato data aggiornamento non valido".to_string()))),
        };

        Ok(Ok(NotificationPreferences {
            profile_id,
            global_enabled,
            sound_enabled,
            desktop_enabled,
            type_settings,
            quiet_hours,
            max_notifications: max_notifications as u32,
            auto_delete_after_days: auto_delete_after_days as u32,
            updated_at,
        }))
    }

    /// Elimina le preferenze notifiche per un profilo
    pub async fn delete_preferences(&self, profile_id: &str) -> NotificationResult<()> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        conn.execute(
            "DELETE FROM notification_preferences WHERE profile_id = ?1",
            params![profile_id],
        )?;

        Ok(())
    }

    // === METODI OTTIMIZZATI PER PERFORMANCE ===

    /// Salva multiple notifiche usando batch operations
    pub async fn batch_save_notifications(&self, notifications: &[Notification]) -> NotificationResult<()> {
        self.batch_manager.batch_save_notifications(notifications).await
    }

    /// Aggiorna multiple notifiche usando batch operations
    pub async fn batch_update_notifications(&self, notifications: &[Notification]) -> NotificationResult<()> {
        self.batch_manager.batch_update_notifications(notifications).await
    }

    /// Marca multiple notifiche come lette usando batch operations
    pub async fn batch_mark_as_read(&self, notification_ids: &[String], profile_id: &str) -> NotificationResult<()> {
        self.batch_manager.batch_mark_as_read(notification_ids, profile_id).await
    }

    /// Elimina multiple notifiche usando batch operations
    pub async fn batch_delete_notifications(&self, notification_ids: &[String]) -> NotificationResult<u32> {
        self.batch_manager.batch_delete_notifications(notification_ids).await
    }

    /// Salva multiple preferenze usando batch operations
    pub async fn batch_save_preferences(&self, preferences_list: &[NotificationPreferences]) -> NotificationResult<()> {
        self.batch_manager.batch_save_preferences(preferences_list).await
    }

    /// Esegue operazioni di pulizia batch ottimizzate
    pub async fn batch_cleanup_operations(&self, profile_id: &str, cutoff_date: DateTime<Utc>) -> NotificationResult<crate::notifications::performance::BatchCleanupResult> {
        self.batch_manager.batch_cleanup_operations(profile_id, cutoff_date).await
    }

    /// Conta le notifiche non lette usando query ottimizzata
    pub async fn count_unread_notifications_optimized(&self, profile_id: &str) -> NotificationResult<u32> {
        self.query_manager.get_unread_count_optimized(profile_id).await
    }

    /// Carica notifiche con paginazione ottimizzata
    pub async fn load_notifications_paginated(
        &self,
        profile_id: &str,
        offset: u32,
        limit: u32,
        notification_type: Option<&str>,
    ) -> NotificationResult<Vec<Notification>> {
        self.query_manager.load_notifications_paginated(profile_id, offset, limit, notification_type).await
    }

    /// Analizza le performance delle query
    pub async fn analyze_performance(&self) -> NotificationResult<crate::notifications::performance::QueryPerformanceReport> {
        self.performance_analyzer.analyze_query_performance().await
    }

    /// Ottiene suggerimenti per ottimizzazioni
    pub async fn get_optimization_suggestions(&self) -> NotificationResult<Vec<crate::notifications::performance::OptimizationSuggestion>> {
        self.performance_analyzer.suggest_optimizations().await
    }

    /// Pulisce le connessioni inattive del pool
    pub fn cleanup_connections(&self) {
        self.connection_pool.cleanup_idle_connections();
    }
}

    // === SYSTEM NOTIFICATION STORAGE METHODS ===

    /// Carica le notifiche di sistema da tutti i profili
    pub async fn load_system_notifications(&self, filter: &NotificationFilter) -> NotificationResult<Vec<Notification>> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let mut query = "SELECT * FROM notifications WHERE notification_type = 'system'".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
        let mut param_index = 1;

        // Applica filtri aggiuntivi
        if let Some(ref priority) = filter.priority {
            query.push_str(&format!(" AND priority = ?{}", param_index));
            params.push(Box::new(priority.to_string()));
            param_index += 1;
        }

        if let Some(ref category) = filter.category {
            query.push_str(&format!(" AND JSON_EXTRACT(metadata, '$.category') = ?{}", param_index));
            params.push(Box::new(category.clone()));
            param_index += 1;
        }

        // Filtra solo notifiche non scadute
        let now = Utc::now().to_rfc3339();
        query.push_str(&format!(" AND (expires_at IS NULL OR expires_at > ?{})", param_index));
        params.push(Box::new(now));

        // Ordinamento per data di creazione (più recenti prima)
        query.push_str(" ORDER BY created_at DESC");

        // Limite se specificato
        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }

        let mut stmt = conn.prepare(&query)?;
        let notification_iter = stmt.query_map(
            params.iter().map(|p| p.as_ref()).collect::<Vec<_>>().as_slice(),
            |row| self.row_to_notification(row),
        )?;

        let mut notifications = Vec::new();
        for notification in notification_iter {
            notifications.push(notification??);
        }

        Ok(notifications)
    }

    /// Ottiene statistiche delle notifiche di sistema
    pub async fn get_system_notification_stats(&self) -> NotificationResult<crate::notifications::models::SystemNotificationStats> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let mut stats = crate::notifications::models::SystemNotificationStats::default();
        let now = Utc::now().to_rfc3339();

        // Conta notifiche di sistema attive (non scadute)
        stats.total_active = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE notification_type = 'system' AND (expires_at IS NULL OR expires_at > ?1)",
            params![now],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Conta notifiche urgenti attive
        stats.urgent_active = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE notification_type = 'system' AND priority = 'urgent' AND (expires_at IS NULL OR expires_at > ?1)",
            params![now],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Conta notifiche ad alta priorità attive
        stats.high_priority_active = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE notification_type = 'system' AND priority = 'high' AND (expires_at IS NULL OR expires_at > ?1)",
            params![now],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Conta profili unici che hanno ricevuto notifiche di sistema
        stats.total_profiles_reached = conn.query_row(
            "SELECT COUNT(DISTINCT profile_id) FROM notifications WHERE notification_type = 'system'",
            [],
            |row| row.get::<_, i64>(0),
        )? as u32;

        // Calcola media notifiche per profilo
        if stats.total_profiles_reached > 0 {
            let total_system_notifications: i64 = conn.query_row(
                "SELECT COUNT(*) FROM notifications WHERE notification_type = 'system'",
                [],
                |row| row.get(0),
            )?;
            stats.average_notifications_per_profile = total_system_notifications as f64 / stats.total_profiles_reached as f64;
        }

        // Notifica di sistema più vecchia
        let oldest_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT created_at FROM notifications WHERE notification_type = 'system' ORDER BY created_at ASC LIMIT 1",
            [],
            |row| row.get(0),
        );

        if let Ok(oldest_str) = oldest_result {
            if let Ok(oldest_date) = DateTime::parse_from_rfc3339(&oldest_str) {
                stats.oldest_system_notification = Some(oldest_date.with_timezone(&Utc));
            }
        }

        // Notifica di sistema più recente
        let newest_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT created_at FROM notifications WHERE notification_type = 'system' ORDER BY created_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        );

        if let Ok(newest_str) = newest_result {
            if let Ok(newest_date) = DateTime::parse_from_rfc3339(&newest_str) {
                stats.newest_system_notification = Some(newest_date.with_timezone(&Utc));
            }
        }

        // Conta notifiche di sistema scadute nell'ultima settimana
        let week_ago = (Utc::now() - chrono::Duration::days(7)).to_rfc3339();
        stats.expired_last_week = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE notification_type = 'system' AND expires_at IS NOT NULL AND expires_at < ?1 AND expires_at > ?2",
            params![now, week_ago],
            |row| row.get::<_, i64>(0),
        )? as u32;

        Ok(stats)
    }

    /// Elimina una notifica di sistema da tutti i profili
    pub async fn delete_system_notification_from_all_profiles(&self, notification_id: &str) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        // Prima verifica che sia una notifica di sistema
        let is_system: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT notification_type FROM notifications WHERE id = ?1 LIMIT 1",
            params![notification_id],
            |row| row.get(0),
        );

        match is_system {
            Ok(notification_type) if notification_type == "system" => {
                // Elimina tutte le istanze di questa notifica di sistema
                let rows_affected = conn.execute(
                    "DELETE FROM notifications WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = (SELECT JSON_EXTRACT(metadata, '$.broadcast_id') FROM notifications WHERE id = ?1 LIMIT 1)",
                    params![notification_id],
                )?;
                Ok(rows_affected as u32)
            },
            Ok(_) => Err(NotificationError::InvalidContent("La notifica specificata non è una notifica di sistema".to_string())),
            Err(rusqlite::Error::QueryReturnedNoRows) => Err(NotificationError::NotificationNotFound(notification_id.to_string())),
            Err(e) => Err(NotificationError::DatabaseError(e)),
        }
    }

    /// Aggiorna la scadenza di una notifica di sistema
    pub async fn update_system_notification_expiry(&self, notification_id: &str, new_expiry: Option<DateTime<Utc>>) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let new_expiry_str = new_expiry.map(|dt| dt.to_rfc3339());

        // Aggiorna tutte le istanze di questa notifica di sistema
        let rows_affected = conn.execute(
            "UPDATE notifications SET expires_at = ?1 WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = (SELECT JSON_EXTRACT(metadata, '$.broadcast_id') FROM notifications WHERE id = ?2 LIMIT 1) AND notification_type = 'system'",
            params![new_expiry_str, notification_id],
        )?;

        if rows_affected == 0 {
            return Err(NotificationError::NotificationNotFound(notification_id.to_string()));
        }

        Ok(rows_affected as u32)
    }

    /// Aggiorna la priorità di una notifica di sistema
    pub async fn update_system_notification_priority(&self, notification_id: &str, new_priority: NotificationPriority) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        // Aggiorna tutte le istanze di questa notifica di sistema
        let rows_affected = conn.execute(
            "UPDATE notifications SET priority = ?1 WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = (SELECT JSON_EXTRACT(metadata, '$.broadcast_id') FROM notifications WHERE id = ?2 LIMIT 1) AND notification_type = 'system'",
            params![new_priority.to_string(), notification_id],
        )?;

        if rows_affected == 0 {
            return Err(NotificationError::NotificationNotFound(notification_id.to_string()));
        }

        Ok(rows_affected as u32)
    }

    /// Ottiene lo stato di lettura di una notifica di sistema
    pub async fn get_system_notification_read_status(&self, notification_id: &str) -> NotificationResult<crate::notifications::models::SystemNotificationReadStatus> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        // Prima ottieni i dettagli base della notifica
        let (title, created_at, broadcast_id): (String, String, String) = conn.query_row(
            "SELECT title, created_at, JSON_EXTRACT(metadata, '$.broadcast_id') FROM notifications WHERE id = ?1 AND notification_type = 'system' LIMIT 1",
            params![notification_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

        let created_at_dt = DateTime::parse_from_rfc3339(&created_at)
            .map_err(|_| NotificationError::StorageError("Formato data non valido".to_string()))?
            .with_timezone(&Utc);

        // Conta totale destinatari
        let total_recipients: i64 = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = ?1 AND notification_type = 'system'",
            params![broadcast_id],
            |row| row.get(0),
        )?;

        // Conta quanti hanno letto
        let read_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = ?1 AND notification_type = 'system' AND read_at IS NOT NULL",
            params![broadcast_id],
            |row| row.get(0),
        )?;

        // Calcola percentuale
        let read_percentage = if total_recipients > 0 {
            (read_count as f64 / total_recipients as f64) * 100.0
        } else {
            0.0
        };

        // Ottieni profili che hanno letto
        let mut stmt = conn.prepare(
            "SELECT profile_id, read_at FROM notifications WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = ?1 AND notification_type = 'system' AND read_at IS NOT NULL"
        )?;

        let read_iter = stmt.query_map(params![broadcast_id], |row| {
            let profile_id: String = row.get(0)?;
            let read_at_str: String = row.get(1)?;
            Ok((profile_id, read_at_str))
        })?;

        let mut read_by_profiles = Vec::new();
        for read_result in read_iter {
            let (profile_id, read_at_str) = read_result?;
            if let Ok(read_at_dt) = DateTime::parse_from_rfc3339(&read_at_str) {
                read_by_profiles.push(crate::notifications::models::ProfileReadInfo {
                    profile_id,
                    profile_name: None, // TODO: Integrare con ProfileManager per ottenere i nomi
                    read_at: read_at_dt.with_timezone(&Utc),
                });
            }
        }

        // Ottieni profili che non hanno letto
        let mut stmt = conn.prepare(
            "SELECT profile_id FROM notifications WHERE JSON_EXTRACT(metadata, '$.broadcast_id') = ?1 AND notification_type = 'system' AND read_at IS NULL"
        )?;

        let unread_iter = stmt.query_map(params![broadcast_id], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut unread_by_profiles = Vec::new();
        for unread_result in unread_iter {
            unread_by_profiles.push(unread_result?);
        }

        Ok(crate::notifications::models::SystemNotificationReadStatus {
            notification_id: notification_id.to_string(),
            title,
            created_at: created_at_dt,
            total_recipients: total_recipients as u32,
            read_count: read_count as u32,
            read_percentage,
            read_by_profiles,
            unread_by_profiles,
        })
    }

    /// Forza la scadenza di notifiche di sistema vecchie
    pub async fn expire_old_system_notifications(&self, cutoff_date: DateTime<Utc>) -> NotificationResult<u32> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let cutoff_str = cutoff_date.to_rfc3339();
        let now_str = Utc::now().to_rfc3339();

        // Imposta la scadenza a "ora" per tutte le notifiche di sistema create prima della data di cutoff
        let rows_affected = conn.execute(
            "UPDATE notifications SET expires_at = ?1 WHERE notification_type = 'system' AND created_at < ?2 AND (expires_at IS NULL OR expires_at > ?1)",
            params![now_str, cutoff_str],
        )?;

        Ok(rows_affected as u32)
    }

    /// Ottiene lista profili per amministrazione notifiche
    pub async fn get_profiles_for_notification_admin(&self) -> NotificationResult<Vec<crate::notifications::models::ProfileNotificationSummary>> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        // Query per ottenere statistiche per ogni profilo
        let mut stmt = conn.prepare(
            r#"
            SELECT 
                n.profile_id,
                COUNT(*) as total_notifications,
                COUNT(CASE WHEN n.read_at IS NULL THEN 1 END) as unread_notifications,
                COUNT(CASE WHEN n.notification_type = 'system' AND n.read_at IS NULL THEN 1 END) as unread_system_notifications,
                MAX(n.created_at) as last_notification,
                COALESCE(p.global_enabled, 1) as notifications_enabled,
                COALESCE(JSON_EXTRACT(p.type_settings, '$.system.enabled'), 1) as system_notifications_enabled
            FROM notifications n
            LEFT JOIN notification_preferences p ON n.profile_id = p.profile_id
            GROUP BY n.profile_id
            ORDER BY last_notification DESC
            "#
        )?;

        let profile_iter = stmt.query_map([], |row| {
            let profile_id: String = row.get("profile_id")?;
            let total_notifications: i64 = row.get("total_notifications")?;
            let unread_notifications: i64 = row.get("unread_notifications")?;
            let unread_system_notifications: i64 = row.get("unread_system_notifications")?;
            let last_notification_str: Option<String> = row.get("last_notification")?;
            let notifications_enabled: bool = row.get("notifications_enabled")?;
            let system_notifications_enabled: bool = row.get("system_notifications_enabled")?;

            let last_seen = if let Some(last_str) = last_notification_str {
                DateTime::parse_from_rfc3339(&last_str)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc))
            } else {
                None
            };

            Ok(crate::notifications::models::ProfileNotificationSummary {
                profile_id,
                profile_name: None, // TODO: Integrare con ProfileManager per ottenere i nomi
                total_notifications: total_notifications as u32,
                unread_notifications: unread_notifications as u32,
                unread_system_notifications: unread_system_notifications as u32,
                last_seen,
                notifications_enabled,
                system_notifications_enabled,
            })
        })?;

        let mut profiles = Vec::new();
        for profile_result in profile_iter {
            profiles.push(profile_result?);
        }

        Ok(profiles)
    }

    /// Ottiene tutti gli ID profilo che hanno notifiche
    pub async fn get_all_profile_ids(&self) -> NotificationResult<Vec<String>> {
        let conn_guard = self.get_connection()?;
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| NotificationError::StorageError("Database non inizializzato".to_string()))?;

        let mut stmt = conn.prepare("SELECT DISTINCT profile_id FROM notifications")?;
        let profile_iter = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut profile_ids = Vec::new();
        for profile_result in profile_iter {
            profile_ids.push(profile_result?);
        }

        Ok(profile_ids)
    }
