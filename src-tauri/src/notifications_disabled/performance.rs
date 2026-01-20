use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Transaction};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::notifications::{
    errors::{NotificationError, NotificationResult},
    models::{Notification, NotificationPreferences},
};

/// Pool di connessioni SQLite per ottimizzare le performance
pub struct ConnectionPool {
    connections: Arc<Mutex<Vec<Connection>>>,
    db_path: PathBuf,
    max_connections: usize,
    connection_timeout: Duration,
    last_cleanup: Arc<Mutex<Instant>>,
}

impl ConnectionPool {
    /// Crea un nuovo pool di connessioni
    pub fn new(db_path: PathBuf, max_connections: usize) -> Self {
        Self {
            connections: Arc::new(Mutex::new(Vec::new())),
            db_path,
            max_connections,
            connection_timeout: Duration::from_secs(30),
            last_cleanup: Arc::new(Mutex::new(Instant::now())),
        }
    }

    /// Ottiene una connessione dal pool o ne crea una nuova
    pub fn get_connection(&self) -> NotificationResult<PooledConnection> {
        let mut connections = self.connections.lock().unwrap();
        
        // Prova a riutilizzare una connessione esistente
        if let Some(conn) = connections.pop() {
            return Ok(PooledConnection::new(conn, self.connections.clone()));
        }

        // Se il pool è vuoto, crea una nuova connessione
        if connections.len() < self.max_connections {
            let conn = self.create_connection()?;
            Ok(PooledConnection::new(conn, self.connections.clone()))
        } else {
            // Pool pieno, attendi che si liberi una connessione
            drop(connections);
            std::thread::sleep(Duration::from_millis(10));
            self.get_connection()
        }
    }

    /// Crea una nuova connessione ottimizzata
    fn create_connection(&self) -> NotificationResult<Connection> {
        let conn = Connection::open(&self.db_path)?;
        
        // Ottimizzazioni SQLite per performance
        conn.execute("PRAGMA journal_mode = WAL", [])?;
        conn.execute("PRAGMA synchronous = NORMAL", [])?;
        conn.execute("PRAGMA cache_size = 10000", [])?;
        conn.execute("PRAGMA temp_store = MEMORY", [])?;
        conn.execute("PRAGMA mmap_size = 268435456", [])?; // 256MB
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        Ok(conn)
    }

    /// Pulisce le connessioni inattive
    pub fn cleanup_idle_connections(&self) {
        let mut last_cleanup = self.last_cleanup.lock().unwrap();
        let now = Instant::now();
        
        if now.duration_since(*last_cleanup) > Duration::from_secs(60) {
            let mut connections = self.connections.lock().unwrap();
            connections.clear(); // Chiude tutte le connessioni inattive
            *last_cleanup = now;
        }
    }
}

/// Connessione dal pool che si restituisce automaticamente quando viene droppata
pub struct PooledConnection {
    connection: Option<Connection>,
    pool: Arc<Mutex<Vec<Connection>>>,
}

impl PooledConnection {
    fn new(connection: Connection, pool: Arc<Mutex<Vec<Connection>>>) -> Self {
        Self {
            connection: Some(connection),
            pool,
        }
    }

    /// Ottiene un riferimento alla connessione
    pub fn as_ref(&self) -> &Connection {
        self.connection.as_ref().unwrap()
    }

    /// Ottiene un riferimento mutabile alla connessione
    pub fn as_mut(&mut self) -> &mut Connection {
        self.connection.as_mut().unwrap()
    }
}

impl Drop for PooledConnection {
    fn drop(&mut self) {
        if let Some(conn) = self.connection.take() {
            let mut pool = self.pool.lock().unwrap();
            pool.push(conn);
        }
    }
}

/// Gestore per operazioni batch ottimizzate
pub struct BatchOperationManager {
    pool: Arc<ConnectionPool>,
}

impl BatchOperationManager {
    pub fn new(pool: Arc<ConnectionPool>) -> Self {
        Self { pool }
    }

    /// Salva multiple notifiche in una singola transazione
    pub async fn batch_save_notifications(&self, notifications: &[Notification]) -> NotificationResult<()> {
        if notifications.is_empty() {
            return Ok(());
        }

        let mut conn = self.pool.get_connection()?;
        let tx = conn.as_mut().transaction()?;

        {
            let mut stmt = tx.prepare(
                r#"
                INSERT INTO notifications (
                    id, profile_id, notification_type, title, message, icon, action_url,
                    priority, created_at, read_at, expires_at, metadata
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
            )?;

            for notification in notifications {
                let metadata_json = serde_json::to_string(&notification.metadata)?;
                
                stmt.execute(params![
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
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    /// Aggiorna multiple notifiche in una singola transazione
    pub async fn batch_update_notifications(&self, notifications: &[Notification]) -> NotificationResult<()> {
        if notifications.is_empty() {
            return Ok(());
        }

        let mut conn = self.pool.get_connection()?;
        let tx = conn.as_mut().transaction()?;

        {
            let mut stmt = tx.prepare(
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
            )?;

            for notification in notifications {
                let metadata_json = serde_json::to_string(&notification.metadata)?;
                
                stmt.execute(params![
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
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    /// Marca multiple notifiche come lette in una singola transazione
    pub async fn batch_mark_as_read(&self, notification_ids: &[String], profile_id: &str) -> NotificationResult<()> {
        if notification_ids.is_empty() {
            return Ok(());
        }

        let mut conn = self.pool.get_connection()?;
        let tx = conn.as_mut().transaction()?;
        let now = Utc::now().to_rfc3339();

        {
            let mut stmt = tx.prepare(
                "UPDATE notifications SET read_at = ?1 WHERE id = ?2 AND profile_id = ?3 AND read_at IS NULL"
            )?;

            for notification_id in notification_ids {
                stmt.execute(params![now, notification_id, profile_id])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    /// Elimina multiple notifiche in una singola transazione
    pub async fn batch_delete_notifications(&self, notification_ids: &[String]) -> NotificationResult<u32> {
        if notification_ids.is_empty() {
            return Ok(0);
        }

        let mut conn = self.pool.get_connection()?;
        let tx = conn.as_mut().transaction()?;
        let mut total_deleted = 0u32;

        {
            let mut stmt = tx.prepare("DELETE FROM notifications WHERE id = ?1")?;

            for notification_id in notification_ids {
                let rows_affected = stmt.execute(params![notification_id])?;
                total_deleted += rows_affected as u32;
            }
        }

        tx.commit()?;
        Ok(total_deleted)
    }

    /// Salva multiple preferenze in una singola transazione
    pub async fn batch_save_preferences(&self, preferences_list: &[NotificationPreferences]) -> NotificationResult<()> {
        if preferences_list.is_empty() {
            return Ok(());
        }

        let mut conn = self.pool.get_connection()?;
        let tx = conn.as_mut().transaction()?;

        {
            let mut stmt = tx.prepare(
                r#"
                INSERT OR REPLACE INTO notification_preferences (
                    profile_id, global_enabled, sound_enabled, desktop_enabled,
                    type_settings, quiet_hours, max_notifications, auto_delete_after_days, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
            )?;

            for preferences in preferences_list {
                let type_settings_json = serde_json::to_string(&preferences.type_settings)?;
                let quiet_hours_json = preferences.quiet_hours.as_ref()
                    .map(|qh| serde_json::to_string(qh))
                    .transpose()?;

                stmt.execute(params![
                    preferences.profile_id,
                    preferences.global_enabled,
                    preferences.sound_enabled,
                    preferences.desktop_enabled,
                    type_settings_json,
                    quiet_hours_json,
                    preferences.max_notifications as i64,
                    preferences.auto_delete_after_days as i64,
                    preferences.updated_at.to_rfc3339(),
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    /// Operazione di pulizia batch ottimizzata
    pub async fn batch_cleanup_operations(&self, profile_id: &str, cutoff_date: DateTime<Utc>) -> NotificationResult<BatchCleanupResult> {
        let mut conn = self.pool.get_connection()?;
        let tx = conn.as_mut().transaction()?;
        let mut result = BatchCleanupResult::default();

        let cutoff_str = cutoff_date.to_rfc3339();
        let now = Utc::now().to_rfc3339();

        // Pulisce notifiche scadute
        result.expired_deleted = tx.execute(
            "DELETE FROM notifications WHERE profile_id = ?1 AND expires_at IS NOT NULL AND expires_at < ?2",
            params![profile_id, now],
        )? as u32;

        // Pulisce notifiche lette vecchie
        result.old_read_deleted = tx.execute(
            "DELETE FROM notifications WHERE profile_id = ?1 AND read_at IS NOT NULL AND read_at < ?2",
            params![profile_id, cutoff_str],
        )? as u32;

        // Pulisce notifiche vecchie in generale (oltre il limite)
        let preferences_result: Result<i64, rusqlite::Error> = tx.query_row(
            "SELECT max_notifications FROM notification_preferences WHERE profile_id = ?1",
            params![profile_id],
            |row| row.get(0),
        );

        if let Ok(max_notifications) = preferences_result {
            // Mantieni solo le N notifiche più recenti
            result.excess_deleted = tx.execute(
                r#"
                DELETE FROM notifications 
                WHERE profile_id = ?1 
                AND id NOT IN (
                    SELECT id FROM notifications 
                    WHERE profile_id = ?1 
                    ORDER BY created_at DESC 
                    LIMIT ?2
                )
                "#,
                params![profile_id, max_notifications],
            )? as u32;
        }

        tx.commit()?;
        Ok(result)
    }
}

/// Risultato delle operazioni di pulizia batch
#[derive(Debug, Default)]
pub struct BatchCleanupResult {
    pub expired_deleted: u32,
    pub old_read_deleted: u32,
    pub excess_deleted: u32,
}

impl BatchCleanupResult {
    pub fn total_deleted(&self) -> u32 {
        self.expired_deleted + self.old_read_deleted + self.excess_deleted
    }
}

/// Query ottimizzate con prepared statements cache
pub struct OptimizedQueryManager {
    pool: Arc<ConnectionPool>,
    prepared_statements_cache: Arc<Mutex<HashMap<String, String>>>,
}

impl OptimizedQueryManager {
    pub fn new(pool: Arc<ConnectionPool>) -> Self {
        Self {
            pool,
            prepared_statements_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Esegue una query ottimizzata per il conteggio delle notifiche non lette
    pub async fn get_unread_count_optimized(&self, profile_id: &str) -> NotificationResult<u32> {
        let conn = self.pool.get_connection()?;
        
        // Query ottimizzata che usa l'indice
        let count: i64 = conn.as_ref().query_row(
            "SELECT COUNT(*) FROM notifications WHERE profile_id = ?1 AND read_at IS NULL",
            params![profile_id],
            |row| row.get(0),
        )?;

        Ok(count as u32)
    }

    /// Carica notifiche con paginazione ottimizzata
    pub async fn load_notifications_paginated(
        &self,
        profile_id: &str,
        offset: u32,
        limit: u32,
        notification_type: Option<&str>,
    ) -> NotificationResult<Vec<Notification>> {
        let conn = self.pool.get_connection()?;
        
        let (query, params) = if let Some(ntype) = notification_type {
            (
                "SELECT * FROM notifications WHERE profile_id = ?1 AND notification_type = ?2 ORDER BY created_at DESC LIMIT ?3 OFFSET ?4",
                vec![profile_id, ntype, &limit.to_string(), &offset.to_string()]
            )
        } else {
            (
                "SELECT * FROM notifications WHERE profile_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
                vec![profile_id, &limit.to_string(), &offset.to_string()]
            )
        };

        let mut stmt = conn.as_ref().prepare(query)?;
        let notification_iter = stmt.query_map(
            params.as_slice(),
            |row| self.row_to_notification(row),
        )?;

        let mut notifications = Vec::new();
        for notification in notification_iter {
            notifications.push(notification??);
        }

        Ok(notifications)
    }

    /// Converte una riga in Notification (versione ottimizzata)
    fn row_to_notification(&self, row: &rusqlite::Row) -> rusqlite::Result<NotificationResult<Notification>> {
        // Implementazione ottimizzata della conversione riga -> Notification
        // (stessa logica del metodo originale ma con alcune ottimizzazioni)
        
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

        // Parse con gestione errori ottimizzata
        let notification_type = notification_type_str.parse().map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            )
        })?;

        let priority = priority_str.parse().map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            )
        })?;

        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text))?
            .with_timezone(&Utc);

        let read_at = read_at_str
            .map(|s| DateTime::parse_from_rfc3339(&s))
            .transpose()
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "read_at".to_string(), rusqlite::types::Type::Text))?
            .map(|dt| dt.with_timezone(&Utc));

        let expires_at = expires_at_str
            .map(|s| DateTime::parse_from_rfc3339(&s))
            .transpose()
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "expires_at".to_string(), rusqlite::types::Type::Text))?
            .map(|dt| dt.with_timezone(&Utc));

        let metadata = serde_json::from_str(&metadata_json)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            ))?;

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
}

/// Gestore per l'analisi delle performance
pub struct PerformanceAnalyzer {
    pool: Arc<ConnectionPool>,
}

impl PerformanceAnalyzer {
    pub fn new(pool: Arc<ConnectionPool>) -> Self {
        Self { pool }
    }

    /// Analizza le performance delle query più comuni
    pub async fn analyze_query_performance(&self) -> NotificationResult<QueryPerformanceReport> {
        let conn = self.pool.get_connection()?;
        let mut report = QueryPerformanceReport::default();

        // Analizza l'uso degli indici
        let explain_results = vec![
            ("unread_count", "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM notifications WHERE profile_id = 'test' AND read_at IS NULL"),
            ("recent_notifications", "EXPLAIN QUERY PLAN SELECT * FROM notifications WHERE profile_id = 'test' ORDER BY created_at DESC LIMIT 20"),
            ("type_filter", "EXPLAIN QUERY PLAN SELECT * FROM notifications WHERE profile_id = 'test' AND notification_type = 'system'"),
        ];

        for (query_name, explain_sql) in explain_results {
            let mut stmt = conn.as_ref().prepare(explain_sql)?;
            let rows = stmt.query_map([], |row| {
                Ok(row.get::<_, String>(3)?) // detail column
            })?;

            let mut uses_index = false;
            for row in rows {
                let detail = row?;
                if detail.contains("USING INDEX") {
                    uses_index = true;
                    break;
                }
            }

            report.queries.insert(query_name.to_string(), QueryAnalysis {
                uses_index,
                estimated_cost: if uses_index { "LOW" } else { "HIGH" }.to_string(),
            });
        }

        // Statistiche database
        report.total_notifications = conn.as_ref().query_row(
            "SELECT COUNT(*) FROM notifications",
            [],
            |row| row.get::<_, i64>(0),
        )? as u32;

        report.total_preferences = conn.as_ref().query_row(
            "SELECT COUNT(*) FROM notification_preferences",
            [],
            |row| row.get::<_, i64>(0),
        )? as u32;

        Ok(report)
    }

    /// Suggerisce ottimizzazioni basate sull'analisi
    pub async fn suggest_optimizations(&self) -> NotificationResult<Vec<OptimizationSuggestion>> {
        let report = self.analyze_query_performance().await?;
        let mut suggestions = Vec::new();

        // Controlla se gli indici sono utilizzati
        for (query_name, analysis) in &report.queries {
            if !analysis.uses_index {
                suggestions.push(OptimizationSuggestion {
                    category: "INDEX".to_string(),
                    description: format!("Query '{}' non utilizza indici - considera di aggiungere indici appropriati", query_name),
                    priority: "HIGH".to_string(),
                });
            }
        }

        // Suggerimenti basati sul volume di dati
        if report.total_notifications > 10000 {
            suggestions.push(OptimizationSuggestion {
                category: "CLEANUP".to_string(),
                description: "Alto numero di notifiche - considera di implementare pulizia automatica più aggressiva".to_string(),
                priority: "MEDIUM".to_string(),
            });
        }

        if report.total_notifications > 50000 {
            suggestions.push(OptimizationSuggestion {
                category: "PARTITIONING".to_string(),
                description: "Volume molto alto - considera di implementare partitioning per data".to_string(),
                priority: "HIGH".to_string(),
            });
        }

        Ok(suggestions)
    }
}

#[derive(Debug, Default)]
pub struct QueryPerformanceReport {
    pub queries: HashMap<String, QueryAnalysis>,
    pub total_notifications: u32,
    pub total_preferences: u32,
}

#[derive(Debug)]
pub struct QueryAnalysis {
    pub uses_index: bool,
    pub estimated_cost: String,
}

#[derive(Debug)]
pub struct OptimizationSuggestion {
    pub category: String,
    pub description: String,
    pub priority: String,
}