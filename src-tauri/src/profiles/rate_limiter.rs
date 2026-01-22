//! Modulo per gestire il rate limiting dei tentativi di accesso

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Configurazione del rate limiter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimiterConfig {
    /// Numero massimo di tentativi falliti prima del blocco
    pub max_attempts: u32,
    /// Durata del blocco in secondi
    pub block_duration_seconds: u64,
    /// Tempo in secondi dopo il quale i tentativi vengono resettati
    pub reset_after_seconds: u64,
    /// Incremento esponenziale del tempo di blocco
    pub exponential_backoff: bool,
    /// Fattore di incremento per il backoff esponenziale
    pub backoff_factor: f32,
    /// Tempo massimo di blocco in secondi (per backoff esponenziale)
    pub max_block_duration_seconds: u64,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        Self {
            max_attempts: 20, // Blocca dopo 20 tentativi falliti
            block_duration_seconds: 300, // 5 minuti
            reset_after_seconds: 3600,   // 1 ora
            exponential_backoff: true,
            backoff_factor: 2.0,
            max_block_duration_seconds: 86400, // 24 ore
        }
    }
}

/// Informazioni sui tentativi di accesso
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessAttemptInfo {
    /// Numero di tentativi falliti
    pub failed_attempts: u32,
    /// Timestamp dell'ultimo tentativo fallito
    pub last_attempt: DateTime<Utc>,
    /// Timestamp fino a quando l'accesso è bloccato
    pub blocked_until: Option<DateTime<Utc>>,
    /// Numero di volte che l'account è stato bloccato
    pub block_count: u32,
}

/// Risultato del controllo del rate limiter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RateLimitResult {
    /// Accesso consentito
    Allowed,
    /// Accesso bloccato
    Blocked {
        /// Timestamp fino a quando l'accesso è bloccato
        blocked_until: DateTime<Utc>,
        /// Tempo rimanente in secondi
        remaining_seconds: u64,
    },
}

/// Rate limiter per tentativi di accesso
pub struct RateLimiter {
    /// Configurazione
    config: RateLimiterConfig,
    /// Mappa degli accessi per identificatore (username, IP, ecc.)
    attempts: Arc<Mutex<HashMap<String, AccessAttemptInfo>>>,
    /// Ultimo cleanup della mappa
    last_cleanup: Arc<Mutex<Instant>>,
}

impl RateLimiter {
    /// Crea un nuovo rate limiter con la configurazione specificata
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            config,
            attempts: Arc::new(Mutex::new(HashMap::new())),
            last_cleanup: Arc::new(Mutex::new(Instant::now())),
        }
    }

    /// Crea un nuovo rate limiter con la configurazione di default
    pub fn default() -> Self {
        Self::new(RateLimiterConfig::default())
    }

    /// Controlla se un identificatore può effettuare un tentativo di accesso
    pub fn check_rate_limit(&self, identifier: &str) -> RateLimitResult {
        // Cleanup periodico per evitare memory leak
        self.cleanup_if_needed();

        let attempts = self.attempts.lock().unwrap();
        let now = Utc::now();

        // Se l'identificatore non esiste nella mappa, è il primo tentativo
        if !attempts.contains_key(identifier) {
            return RateLimitResult::Allowed;
        }

        let info = attempts.get(identifier).unwrap();

        // Controlla se l'accesso è bloccato
        if let Some(blocked_until) = info.blocked_until {
            if blocked_until > now {
                let remaining = blocked_until.timestamp() - now.timestamp();
                return RateLimitResult::Blocked {
                    blocked_until,
                    remaining_seconds: remaining as u64,
                };
            }
        }

        // Se non è bloccato, consenti l'accesso
        RateLimitResult::Allowed
    }

    /// Registra un tentativo di accesso fallito
    pub fn register_failed_attempt(&self, identifier: &str) -> RateLimitResult {
        let mut attempts = self.attempts.lock().unwrap();
        let now = Utc::now();

        // Ottieni o crea le informazioni sui tentativi
        let info = attempts.entry(identifier.to_string()).or_insert(AccessAttemptInfo {
            failed_attempts: 0,
            last_attempt: now,
            blocked_until: None,
            block_count: 0,
        });

        // Controlla se è passato abbastanza tempo per resettare i tentativi
        let reset_duration = Duration::from_secs(self.config.reset_after_seconds);
        let last_attempt_instant = Instant::now() - Duration::from_secs(
            (now - info.last_attempt).num_seconds().max(0) as u64
        );

        if last_attempt_instant.elapsed() > reset_duration {
            // Reset dei tentativi se è passato abbastanza tempo
            info.failed_attempts = 1;
            info.last_attempt = now;
            return RateLimitResult::Allowed;
        }

        // Incrementa il contatore dei tentativi falliti
        info.failed_attempts += 1;
        info.last_attempt = now;

        // Controlla se è stato superato il limite di tentativi
        if info.failed_attempts >= self.config.max_attempts {
            // Calcola la durata del blocco
            let block_duration = if self.config.exponential_backoff {
                // Calcolo esponenziale basato sul numero di volte che l'account è stato bloccato
                let factor = self.config.backoff_factor.powi(info.block_count as i32);
                let duration_secs = (self.config.block_duration_seconds as f32 * factor) as u64;
                // Limita alla durata massima configurata
                duration_secs.min(self.config.max_block_duration_seconds)
            } else {
                self.config.block_duration_seconds
            };

            // Imposta il blocco
            let blocked_until = now + chrono::Duration::seconds(block_duration as i64);
            info.blocked_until = Some(blocked_until);
            info.block_count += 1;

            return RateLimitResult::Blocked {
                blocked_until,
                remaining_seconds: block_duration,
            };
        }

        RateLimitResult::Allowed
    }

    /// Registra un tentativo di accesso riuscito
    pub fn register_successful_attempt(&self, identifier: &str) {
        let mut attempts = self.attempts.lock().unwrap();
        
        // Rimuovi l'identificatore dalla mappa
        attempts.remove(identifier);
    }

    /// Pulisce la mappa degli accessi da entry vecchie
    fn cleanup_if_needed(&self) {
        let mut last_cleanup = self.last_cleanup.lock().unwrap();
        
        // Esegui il cleanup solo ogni 10 minuti
        if last_cleanup.elapsed() < Duration::from_secs(600) {
            return;
        }

        let mut attempts = self.attempts.lock().unwrap();
        let now = Utc::now();
        let reset_seconds = self.config.reset_after_seconds;

        // Rimuovi le entry più vecchie del tempo di reset
        attempts.retain(|_, info| {
            let age = (now - info.last_attempt).num_seconds();
            age < reset_seconds as i64 || info.blocked_until.is_some()
        });

        // Aggiorna il timestamp dell'ultimo cleanup
        *last_cleanup = Instant::now();
    }

    /// Ottiene le informazioni sui tentativi di accesso per un identificatore
    pub fn get_attempt_info(&self, identifier: &str) -> Option<AccessAttemptInfo> {
        let attempts = self.attempts.lock().unwrap();
        attempts.get(identifier).cloned()
    }

    /// Resetta i tentativi di accesso per un identificatore
    pub fn reset_attempts(&self, identifier: &str) {
        let mut attempts = self.attempts.lock().unwrap();
        attempts.remove(identifier);
    }

    /// Ottiene la configurazione del rate limiter
    pub fn get_config(&self) -> RateLimiterConfig {
        self.config.clone()
    }

    /// Imposta la configurazione del rate limiter
    pub fn set_config(&mut self, config: RateLimiterConfig) {
        self.config = config;
    }
}