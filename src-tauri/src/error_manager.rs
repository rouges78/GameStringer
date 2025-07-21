use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use serde::{Serialize, Deserialize};
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use log::{debug, info, warn, error};

/// Tipi di errori categorizzati
#[derive(Copy, Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ErrorType {
    // Errori di rete
    NetworkTimeout,
    NetworkConnectionFailed,
    NetworkDnsResolution,
    NetworkSSLError,
    
    // Errori API
    ApiKeyInvalid,
    ApiRateLimited,
    ApiQuotaExceeded,
    ApiEndpointNotFound,
    ApiServerError,
    ApiUnauthorized,
    
    // Errori di parsing
    JsonParseError,
    XmlParseError,
    VdfParseError,
    RegexParseError,
    
    // Errori di filesystem
    FileNotFound,
    FilePermissionDenied,
    FileCorrupted,
    DirectoryNotFound,
    
    // Errori di store specifici
    SteamNotInstalled,
    SteamNotRunning,
    EpicNotInstalled,
    GOGNotInstalled,
    OriginNotInstalled,
    UbisoftNotInstalled,
    BattlenetNotInstalled,
    
    // Errori di cache
    CacheCorrupted,
    CacheExpired,
    CacheSerializationError,
    CacheWriteError,
    
    // Errori di configurazione
    ConfigMissing,
    ConfigInvalid,
    CredentialsMissing,
    
    // Errori generici
    Unknown,
    ValidationError,
    InternalError,
}

/// Severità dell'errore
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ErrorSeverity {
    Low,      // Errore minore, funzionalità può continuare
    Medium,   // Errore moderato, alcune funzionalità compromesse
    High,     // Errore grave, funzionalità principale compromessa
    Critical, // Errore critico, applicazione potrebbe crashare
}

/// Strategia di retry per gli errori
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum RetryStrategy {
    NoRetry,
    LinearBackoff { max_retries: u32, delay_ms: u64 },
    ExponentialBackoff { max_retries: u32, base_delay_ms: u64, max_delay_ms: u64 },
    CustomDelay { delays_ms: Vec<u64> },
}

/// Informazioni dettagliate su un errore
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub error_type: ErrorType,
    pub severity: ErrorSeverity,
    pub message: String,
    pub context: HashMap<String, String>,
    pub timestamp: DateTime<Utc>,
    pub retry_strategy: RetryStrategy,
    pub suggested_action: String,
    pub recovery_hint: Option<String>,
}

/// Statistiche degli errori
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ErrorStats {
    pub total_errors: u64,
    pub errors_by_type: HashMap<ErrorType, u64>,
    pub errors_by_severity: HashMap<ErrorSeverity, u64>,
    pub recent_errors: Vec<ErrorInfo>,
    pub error_rate_per_minute: f64,
    pub most_common_error: Option<ErrorType>,
}

/// Configurazione per gestione errori
#[derive(Clone, Debug)]
pub struct ErrorConfig {
    pub max_recent_errors: usize,
    pub error_rate_window_minutes: u64,
    pub auto_recovery_enabled: bool,
    pub notification_threshold: ErrorSeverity,
}

impl Default for ErrorConfig {
    fn default() -> Self {
        Self {
            max_recent_errors: 100,
            error_rate_window_minutes: 5,
            auto_recovery_enabled: true,
            notification_threshold: ErrorSeverity::Medium,
        }
    }
}

/// Manager centralizzato per gestione errori
pub struct RobustErrorManager {
    config: ErrorConfig,
    stats: Arc<RwLock<ErrorStats>>,
    error_mappings: HashMap<ErrorType, ErrorInfo>,
    recovery_actions: HashMap<ErrorType, Box<dyn Fn() -> Result<(), String> + Send + Sync>>,
}

impl RobustErrorManager {
    /// Crea un nuovo manager degli errori
    pub fn new() -> Self {
        let mut manager = Self {
            config: ErrorConfig::default(),
            stats: Arc::new(RwLock::new(ErrorStats::default())),
            error_mappings: HashMap::new(),
            recovery_actions: HashMap::new(),
        };

        manager.setup_error_mappings();
        manager.setup_recovery_actions();
        
        manager
    }

    /// Configura le mappature degli errori con informazioni dettagliate
    fn setup_error_mappings(&mut self) {
        // Errori di rete
        self.error_mappings.insert(ErrorType::NetworkTimeout, ErrorInfo {
            error_type: ErrorType::NetworkTimeout,
            severity: ErrorSeverity::Medium,
            message: "Timeout di rete durante la richiesta".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::ExponentialBackoff {
                max_retries: 3,
                base_delay_ms: 1000,
                max_delay_ms: 10000,
            },
            suggested_action: "Verifica la connessione internet e riprova".to_string(),
            recovery_hint: Some("Controlla le impostazioni di rete o proxy".to_string()),
        });

        self.error_mappings.insert(ErrorType::NetworkConnectionFailed, ErrorInfo {
            error_type: ErrorType::NetworkConnectionFailed,
            severity: ErrorSeverity::High,
            message: "Impossibile stabilire connessione di rete".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::LinearBackoff {
                max_retries: 5,
                delay_ms: 2000,
            },
            suggested_action: "Controlla la connessione internet".to_string(),
            recovery_hint: Some("Verifica firewall e impostazioni proxy".to_string()),
        });

        // Errori API
        self.error_mappings.insert(ErrorType::ApiKeyInvalid, ErrorInfo {
            error_type: ErrorType::ApiKeyInvalid,
            severity: ErrorSeverity::High,
            message: "Chiave API non valida o scaduta".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::NoRetry,
            suggested_action: "Verifica e aggiorna la chiave API".to_string(),
            recovery_hint: Some("Vai alle impostazioni per inserire una nuova chiave API".to_string()),
        });

        self.error_mappings.insert(ErrorType::ApiRateLimited, ErrorInfo {
            error_type: ErrorType::ApiRateLimited,
            severity: ErrorSeverity::Medium,
            message: "Limite di rate API raggiunto".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::ExponentialBackoff {
                max_retries: 10,
                base_delay_ms: 5000,
                max_delay_ms: 300000, // 5 minuti
            },
            suggested_action: "Attendi prima di effettuare nuove richieste".to_string(),
            recovery_hint: Some("Il sistema riproverà automaticamente".to_string()),
        });

        // Errori di store
        self.error_mappings.insert(ErrorType::SteamNotInstalled, ErrorInfo {
            error_type: ErrorType::SteamNotInstalled,
            severity: ErrorSeverity::High,
            message: "Steam non è installato sul sistema".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::NoRetry,
            suggested_action: "Installa Steam per accedere ai giochi Steam".to_string(),
            recovery_hint: Some("Scarica Steam da https://store.steampowered.com/".to_string()),
        });

        // Errori di parsing
        self.error_mappings.insert(ErrorType::JsonParseError, ErrorInfo {
            error_type: ErrorType::JsonParseError,
            severity: ErrorSeverity::Medium,
            message: "Errore nel parsing dei dati JSON".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::LinearBackoff {
                max_retries: 2,
                delay_ms: 1000,
            },
            suggested_action: "Riprova l'operazione".to_string(),
            recovery_hint: Some("I dati potrebbero essere corrotti o incompleti".to_string()),
        });

        // Aggiungi altre mappature per tutti i tipi di errore...
        self.setup_additional_error_mappings();
    }

    /// Configura mappature aggiuntive per tutti i tipi di errore
    fn setup_additional_error_mappings(&mut self) {
        // Errori di filesystem
        self.error_mappings.insert(ErrorType::FileNotFound, ErrorInfo {
            error_type: ErrorType::FileNotFound,
            severity: ErrorSeverity::Medium,
            message: "File o directory non trovato".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::LinearBackoff { max_retries: 2, delay_ms: 500 },
            suggested_action: "Verifica che il file esista nel percorso specificato".to_string(),
            recovery_hint: Some("Controlla i permessi e l'integrità del filesystem".to_string()),
        });

        // Errori di cache
        self.error_mappings.insert(ErrorType::CacheCorrupted, ErrorInfo {
            error_type: ErrorType::CacheCorrupted,
            severity: ErrorSeverity::Low,
            message: "Cache corrotta, verrà rigenerata".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::NoRetry,
            suggested_action: "La cache verrà automaticamente pulita e rigenerata".to_string(),
            recovery_hint: Some("Nessuna azione richiesta, il sistema si auto-ripara".to_string()),
        });
    }

    /// Configura azioni di recovery automatico
    fn setup_recovery_actions(&mut self) {
        // Recovery per cache corrotta
        self.recovery_actions.insert(
            ErrorType::CacheCorrupted,
            Box::new(|| {
                // Pulisci cache corrotta
                info!("Eseguendo recovery automatico per cache corrotta");
                // Qui chiameresti la funzione di pulizia cache
                Ok(())
            })
        );

        // Recovery per errori di rete temporanei
        self.recovery_actions.insert(
            ErrorType::NetworkTimeout,
            Box::new(|| {
                info!("Eseguendo recovery automatico per timeout di rete");
                // Qui potresti implementare logica di reconnessione
                Ok(())
            })
        );
    }

    /// Registra un nuovo errore
    pub async fn log_error(&self, error_type: ErrorType, context: HashMap<String, String>) -> ErrorInfo {
        let mut error_info = self.error_mappings.get(&error_type)
            .cloned()
            .unwrap_or_else(|| self.create_unknown_error());

        error_info.context = context;
        error_info.timestamp = Utc::now();

        // Aggiorna statistiche
        self.update_stats(&error_info).await;

        // Log dell'errore
        match error_info.severity {
            ErrorSeverity::Low => debug!("Errore LOW: {}", error_info.message),
            ErrorSeverity::Medium => warn!("Errore MEDIUM: {}", error_info.message),
            ErrorSeverity::High => error!("Errore HIGH: {}", error_info.message),
            ErrorSeverity::Critical => error!("Errore CRITICAL: {}", error_info.message),
        }

        // Tentativo di recovery automatico
        if self.config.auto_recovery_enabled {
            self.attempt_auto_recovery(&error_type).await;
        }

        error_info
    }

    /// Crea un errore sconosciuto
    fn create_unknown_error(&self) -> ErrorInfo {
        ErrorInfo {
            error_type: ErrorType::Unknown,
            severity: ErrorSeverity::Medium,
            message: "Errore sconosciuto".to_string(),
            context: HashMap::new(),
            timestamp: Utc::now(),
            retry_strategy: RetryStrategy::LinearBackoff { max_retries: 1, delay_ms: 1000 },
            suggested_action: "Contatta il supporto tecnico".to_string(),
            recovery_hint: None,
        }
    }

    /// Aggiorna le statistiche degli errori
    async fn update_stats(&self, error_info: &ErrorInfo) {
        let mut stats = self.stats.write().await;
        
        stats.total_errors += 1;
        
        // Aggiorna contatori per tipo
        *stats.errors_by_type.entry(error_info.error_type.clone()).or_insert(0) += 1;
        
        // Aggiorna contatori per severità
        *stats.errors_by_severity.entry(error_info.severity.clone()).or_insert(0) += 1;
        
        // Aggiungi agli errori recenti
        stats.recent_errors.push(error_info.clone());
        
        // Mantieni solo gli errori recenti
        if stats.recent_errors.len() > self.config.max_recent_errors {
            stats.recent_errors.remove(0);
        }
        
        // Calcola errore più comune
        stats.most_common_error = stats.errors_by_type
            .iter()
            .max_by_key(|(_, count)| *count)
            .map(|(error_type, _)| error_type.clone());
        
        // Calcola rate degli errori
        let window_duration = chrono::Duration::seconds((self.config.error_rate_window_minutes * 60) as i64);
        let cutoff_time = Utc::now() - window_duration;
        let recent_errors_in_window = stats.recent_errors
            .iter()
            .filter(|e| e.timestamp > cutoff_time)
            .count();
        
        stats.error_rate_per_minute = recent_errors_in_window as f64 / self.config.error_rate_window_minutes as f64;
    }

    /// Tenta recovery automatico per un tipo di errore
    async fn attempt_auto_recovery(&self, error_type: &ErrorType) {
        if let Some(recovery_action) = self.recovery_actions.get(error_type) {
            match recovery_action() {
                Ok(()) => info!("Recovery automatico riuscito per {:?}", error_type),
                Err(e) => warn!("Recovery automatico fallito per {:?}: {}", error_type, e),
            }
        }
    }

    /// Esegue retry con strategia specificata
    pub async fn execute_with_retry<F, T, E>(&self, error_type: ErrorType, operation: F) -> Result<T, E>
    where
        F: Fn() -> Result<T, E> + Send + Sync,
        E: std::fmt::Display,
    {
        let error_info = self.error_mappings.get(&error_type)
            .cloned()
            .unwrap_or_else(|| self.create_unknown_error());

        match &error_info.retry_strategy {
            RetryStrategy::NoRetry => operation(),
            
            RetryStrategy::LinearBackoff { max_retries, delay_ms } => {
                let mut attempts = 0;
                loop {
                    match operation() {
                        Ok(result) => return Ok(result),
                        Err(e) => {
                            attempts += 1;
                            if attempts >= *max_retries {
                                error!("Operazione fallita dopo {} tentativi: {}", attempts, e);
                                return Err(e);
                            }
                            
                            warn!("Tentativo {} fallito, riprovo tra {}ms: {}", attempts, delay_ms, e);
                            tokio::time::sleep(Duration::from_millis(*delay_ms)).await;
                        }
                    }
                }
            }
            
            RetryStrategy::ExponentialBackoff { max_retries, base_delay_ms, max_delay_ms } => {
                let mut attempts = 0;
                let mut current_delay = *base_delay_ms;
                
                loop {
                    match operation() {
                        Ok(result) => return Ok(result),
                        Err(e) => {
                            attempts += 1;
                            if attempts >= *max_retries {
                                error!("Operazione fallita dopo {} tentativi: {}", attempts, e);
                                return Err(e);
                            }
                            
                            warn!("Tentativo {} fallito, riprovo tra {}ms: {}", attempts, current_delay, e);
                            tokio::time::sleep(Duration::from_millis(current_delay)).await;
                            
                            // Aumenta il delay esponenzialmente
                            current_delay = std::cmp::min(current_delay * 2, *max_delay_ms);
                        }
                    }
                }
            }
            
            RetryStrategy::CustomDelay { delays_ms } => {
                for (attempt, delay) in delays_ms.iter().enumerate() {
                    match operation() {
                        Ok(result) => return Ok(result),
                        Err(e) => {
                            if attempt == delays_ms.len() - 1 {
                                error!("Operazione fallita dopo {} tentativi: {}", attempt + 1, e);
                                return Err(e);
                            }
                            
                            warn!("Tentativo {} fallito, riprovo tra {}ms: {}", attempt + 1, delay, e);
                            tokio::time::sleep(Duration::from_millis(*delay)).await;
                        }
                    }
                }
                
                // Fallback se non ci sono delay configurati
                operation()
            }
        }
    }

    /// Ottiene statistiche degli errori
    pub async fn get_stats(&self) -> ErrorStats {
        self.stats.read().await.clone()
    }

    /// Pulisce statistiche vecchie
    pub async fn cleanup_old_stats(&self) {
        let mut stats = self.stats.write().await;
        let cutoff = Utc::now() - chrono::Duration::seconds((self.config.error_rate_window_minutes * 60) as i64);
        
        stats.recent_errors.retain(|e| e.timestamp > cutoff);
        
        info!("Pulizia statistiche errori completata");
    }

    /// Ottiene suggerimenti per risolvere errori frequenti
    pub async fn get_error_suggestions(&self) -> Vec<String> {
        let stats = self.stats.read().await;
        let mut suggestions = Vec::new();
        
        // Analizza errori più comuni
        for (error_type, count) in &stats.errors_by_type {
            if *count > 5 { // Soglia per errori frequenti
                if let Some(error_info) = self.error_mappings.get(error_type) {
                    suggestions.push(format!(
                        "Errore frequente '{}' ({}x): {}",
                        error_info.message,
                        count,
                        error_info.suggested_action
                    ));
                }
            }
        }
        
        suggestions
    }
}

/// Istanza globale del manager degli errori
use once_cell::sync::Lazy;
pub static ERROR_MANAGER: Lazy<RobustErrorManager> = Lazy::new(|| {
    RobustErrorManager::new()
});

/// Macro di convenienza per logging errori
#[macro_export]
macro_rules! log_error {
    ($error_type:expr, $context:expr) => {
        $crate::error_manager::ERROR_MANAGER.log_error($error_type, $context).await
    };
}

#[macro_export]
macro_rules! execute_with_retry {
    ($error_type:expr, $operation:expr) => {
        $crate::error_manager::ERROR_MANAGER.execute_with_retry($error_type, $operation).await
    };
}

/// Comandi Tauri per gestione errori
#[tauri::command]
pub async fn get_error_stats() -> Result<ErrorStats, String> {
    Ok(ERROR_MANAGER.get_stats().await)
}

#[tauri::command]
pub async fn get_error_suggestions() -> Result<Vec<String>, String> {
    Ok(ERROR_MANAGER.get_error_suggestions().await)
}

#[tauri::command]
pub async fn cleanup_error_stats() -> Result<String, String> {
    ERROR_MANAGER.cleanup_old_stats().await;
    Ok("Statistiche errori pulite con successo".to_string())
}

/// Helper per convertire errori comuni in ErrorType
pub fn classify_error(error_message: &str) -> ErrorType {
    let error_lower = error_message.to_lowercase();
    
    if error_lower.contains("timeout") {
        ErrorType::NetworkTimeout
    } else if error_lower.contains("connection") && error_lower.contains("failed") {
        ErrorType::NetworkConnectionFailed
    } else if error_lower.contains("api key") || error_lower.contains("unauthorized") {
        ErrorType::ApiKeyInvalid
    } else if error_lower.contains("rate limit") {
        ErrorType::ApiRateLimited
    } else if error_lower.contains("file not found") {
        ErrorType::FileNotFound
    } else if error_lower.contains("permission denied") {
        ErrorType::FilePermissionDenied
    } else if error_lower.contains("json") && error_lower.contains("parse") {
        ErrorType::JsonParseError
    } else if error_lower.contains("steam") && error_lower.contains("not") {
        ErrorType::SteamNotInstalled
    } else {
        ErrorType::Unknown
    }
}

/// Implementazione Display per ErrorType
impl std::fmt::Display for ErrorType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            // Errori di rete
            ErrorType::NetworkTimeout => write!(f, "Network Timeout"),
            ErrorType::NetworkConnectionFailed => write!(f, "Network Connection Failed"),
            ErrorType::NetworkDnsResolution => write!(f, "DNS Resolution Error"),
            ErrorType::NetworkSSLError => write!(f, "SSL/TLS Error"),
            
            // Errori API
            ErrorType::ApiKeyInvalid => write!(f, "Invalid API Key"),
            ErrorType::ApiRateLimited => write!(f, "API Rate Limited"),
            ErrorType::ApiQuotaExceeded => write!(f, "API Quota Exceeded"),
            ErrorType::ApiEndpointNotFound => write!(f, "API Endpoint Not Found"),
            ErrorType::ApiServerError => write!(f, "API Server Error"),
            ErrorType::ApiUnauthorized => write!(f, "API Unauthorized"),
            
            // Errori di parsing
            ErrorType::JsonParseError => write!(f, "JSON Parse Error"),
            ErrorType::XmlParseError => write!(f, "XML Parse Error"),
            ErrorType::VdfParseError => write!(f, "VDF Parse Error"),
            ErrorType::RegexParseError => write!(f, "Regex Parse Error"),
            
            // Errori di filesystem
            ErrorType::FileNotFound => write!(f, "File Not Found"),
            ErrorType::FilePermissionDenied => write!(f, "File Permission Denied"),
            ErrorType::FileCorrupted => write!(f, "File Corrupted"),
            ErrorType::DirectoryNotFound => write!(f, "Directory Not Found"),
            
            // Errori di store specifici
            ErrorType::SteamNotInstalled => write!(f, "Steam Not Installed"),
            ErrorType::SteamNotRunning => write!(f, "Steam Not Running"),
            ErrorType::EpicNotInstalled => write!(f, "Epic Games Not Installed"),
            ErrorType::GOGNotInstalled => write!(f, "GOG Not Installed"),
            ErrorType::OriginNotInstalled => write!(f, "Origin Not Installed"),
            ErrorType::UbisoftNotInstalled => write!(f, "Ubisoft Connect Not Installed"),
            ErrorType::BattlenetNotInstalled => write!(f, "Battle.net Not Installed"),
            
            // Errori di cache
            ErrorType::CacheCorrupted => write!(f, "Cache Corrupted"),
            ErrorType::CacheExpired => write!(f, "Cache Expired"),
            ErrorType::CacheSerializationError => write!(f, "Cache Serialization Error"),
            ErrorType::CacheWriteError => write!(f, "Cache Write Error"),
            
            // Errori di configurazione
            ErrorType::ConfigMissing => write!(f, "Configuration Missing"),
            ErrorType::ConfigInvalid => write!(f, "Configuration Invalid"),
            ErrorType::CredentialsMissing => write!(f, "Credentials Missing"),
            
            // Errori generici
            ErrorType::Unknown => write!(f, "Unknown Error"),
            ErrorType::ValidationError => write!(f, "Validation Error"),
            ErrorType::InternalError => write!(f, "Internal Error"),
        }
    }
}
