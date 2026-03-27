use serde::{Deserialize, Serialize};
use std::fs;
use std::collections::HashMap;
use std::sync::Mutex;
use chrono::Utc;
use log::{info, warn};
use once_cell::sync::Lazy;

// ============================================================================
// SECURITY SYSTEM - Account Takeover Prevention, Memory Protection, Prompt Injection
// ============================================================================

// ============================================================================
// 1. ACCOUNT TAKEOVER PREVENTION
// ============================================================================

/// Rate limiter per tentativi di login
static LOGIN_ATTEMPTS: Lazy<Mutex<HashMap<String, Vec<i64>>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Session tokens attivi
static ACTIVE_SESSIONS: Lazy<Mutex<HashMap<String, SessionInfo>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Attività sospette rilevate
static SUSPICIOUS_ACTIVITY: Lazy<Mutex<Vec<SuspiciousEvent>>> = 
    Lazy::new(|| Mutex::new(Vec::new()));

/// Informazioni sessione
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub token: String,
    pub profile_id: String,
    pub created_at: i64,
    pub last_activity: i64,
    pub ip_hash: Option<String>,
    pub device_fingerprint: Option<String>,
}

/// Evento sospetto
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousEvent {
    pub timestamp: String,
    pub event_type: String,
    pub profile_id: Option<String>,
    pub details: String,
    pub severity: String, // low, medium, high, critical
}

/// Configurazione rate limiting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub max_attempts: u32,
    pub window_seconds: u32,
    pub lockout_seconds: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            window_seconds: 300,  // 5 minuti
            lockout_seconds: 900, // 15 minuti lockout
        }
    }
}

/// Risultato check rate limit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitResult {
    pub allowed: bool,
    pub attempts_remaining: u32,
    pub lockout_until: Option<String>,
    pub message: String,
}

/// Controlla rate limit per login
#[tauri::command]
pub async fn check_login_rate_limit(
    profile_id: String,
) -> Result<RateLimitResult, String> {
    let config = RateLimitConfig::default();
    let now = Utc::now().timestamp();
    let window_start = now - config.window_seconds as i64;
    
    let mut attempts = LOGIN_ATTEMPTS.lock().map_err(|e| e.to_string())?;
    
    // Pulisci tentativi vecchi
    if let Some(profile_attempts) = attempts.get_mut(&profile_id) {
        profile_attempts.retain(|&t| t > window_start);
        
        let attempt_count = profile_attempts.len() as u32;
        
        if attempt_count >= config.max_attempts {
            // Trova il più vecchio tentativo per calcolare lockout
            let oldest = profile_attempts.iter().min().unwrap_or(&now);
            let lockout_end = oldest + config.lockout_seconds as i64;
            
            if now < lockout_end {
                // Registra attività sospetta
                log_suspicious_activity(
                    "excessive_login_attempts".to_string(),
                    Some(profile_id.clone()),
                    format!("{} tentativi in {} secondi", attempt_count, config.window_seconds),
                    "high".to_string(),
                )?;
                
                return Ok(RateLimitResult {
                    allowed: false,
                    attempts_remaining: 0,
                    lockout_until: Some(chrono::DateTime::from_timestamp(lockout_end, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default()),
                    message: format!("Account bloccato per troppi tentativi. Riprova tra {} minuti.", 
                        (lockout_end - now) / 60 + 1),
                });
            } else {
                // Lockout scaduto, resetta
                profile_attempts.clear();
            }
        }
        
        Ok(RateLimitResult {
            allowed: true,
            attempts_remaining: config.max_attempts - attempt_count,
            lockout_until: None,
            message: "OK".to_string(),
        })
    } else {
        Ok(RateLimitResult {
            allowed: true,
            attempts_remaining: config.max_attempts,
            lockout_until: None,
            message: "OK".to_string(),
        })
    }
}

/// Registra tentativo di login
#[tauri::command]
pub async fn record_login_attempt(
    profile_id: String,
    success: bool,
) -> Result<(), String> {
    let now = Utc::now().timestamp();
    
    if !success {
        let mut attempts = LOGIN_ATTEMPTS.lock().map_err(|e| e.to_string())?;
        attempts.entry(profile_id.clone())
            .or_insert_with(Vec::new)
            .push(now);
        
        info!("🔒 Login fallito registrato per: {}", profile_id);
    } else {
        // Login riuscito, resetta tentativi
        let mut attempts = LOGIN_ATTEMPTS.lock().map_err(|e| e.to_string())?;
        attempts.remove(&profile_id);
        
        info!("✅ Login riuscito, tentativi resettati per: {}", profile_id);
    }
    
    Ok(())
}

/// Genera session token sicuro
#[tauri::command]
pub async fn generate_session_token(
    profile_id: String,
    device_fingerprint: Option<String>,
) -> Result<String, String> {
    use rand::Rng;
    use sha2::{Sha256, Digest};
    
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap_or(0);
    
    let mut hasher = Sha256::new();
    hasher.update(&random_bytes);
    hasher.update(timestamp.to_be_bytes());
    hasher.update(profile_id.as_bytes());
    let token = format!("{:x}", hasher.finalize());
    
    let now = Utc::now().timestamp();
    
    let session = SessionInfo {
        token: token.clone(),
        profile_id: profile_id.clone(),
        created_at: now,
        last_activity: now,
        ip_hash: None,
        device_fingerprint,
    };
    
    let mut sessions = ACTIVE_SESSIONS.lock().map_err(|e| e.to_string())?;
    sessions.insert(token.clone(), session);
    
    info!("🔑 Session token generato per: {}", profile_id);
    
    Ok(token)
}

/// Verifica session token
#[tauri::command]
pub async fn verify_session_token(
    token: String,
    profile_id: String,
) -> Result<bool, String> {
    let mut sessions = ACTIVE_SESSIONS.lock().map_err(|e| e.to_string())?;
    
    if let Some(session) = sessions.get_mut(&token) {
        if session.profile_id != profile_id {
            // Token rubato? Profilo diverso
            log_suspicious_activity(
                "session_token_mismatch".to_string(),
                Some(profile_id),
                "Token usato da profilo diverso".to_string(),
                "critical".to_string(),
            )?;
            return Ok(false);
        }
        
        // Aggiorna last activity
        session.last_activity = Utc::now().timestamp();
        
        // Verifica scadenza (24 ore)
        let max_age = 24 * 60 * 60;
        if session.last_activity - session.created_at > max_age {
            sessions.remove(&token);
            return Ok(false);
        }
        
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Invalida session token
#[tauri::command]
pub async fn invalidate_session(token: String) -> Result<(), String> {
    let mut sessions = ACTIVE_SESSIONS.lock().map_err(|e| e.to_string())?;
    sessions.remove(&token);
    info!("🔒 Session invalidata");
    Ok(())
}

/// Invalida tutte le sessioni di un profilo
#[tauri::command]
pub async fn invalidate_all_sessions(profile_id: String) -> Result<u32, String> {
    let mut sessions = ACTIVE_SESSIONS.lock().map_err(|e| e.to_string())?;
    let before = sessions.len();
    sessions.retain(|_, s| s.profile_id != profile_id);
    let removed = (before - sessions.len()) as u32;
    
    if removed > 0 {
        log_suspicious_activity(
            "all_sessions_invalidated".to_string(),
            Some(profile_id),
            format!("{} sessioni invalidate", removed),
            "medium".to_string(),
        )?;
    }
    
    Ok(removed)
}

/// Registra attività sospetta
fn log_suspicious_activity(
    event_type: String,
    profile_id: Option<String>,
    details: String,
    severity: String,
) -> Result<(), String> {
    let event = SuspiciousEvent {
        timestamp: Utc::now().to_rfc3339(),
        event_type: event_type.clone(),
        profile_id: profile_id.clone(),
        details: details.clone(),
        severity: severity.clone(),
    };
    
    let mut activity = SUSPICIOUS_ACTIVITY.lock().map_err(|e| e.to_string())?;
    activity.push(event);
    
    // Mantieni solo ultimi 1000 eventi
    if activity.len() > 1000 {
        activity.drain(0..100);
    }
    
    warn!("⚠️ Attività sospetta: {} - {} - {}", event_type, 
        profile_id.unwrap_or_default(), details);
    
    // Salva su disco per persistenza
    save_suspicious_activity(&activity)?;
    
    Ok(())
}

/// Salva attività sospette su disco
fn save_suspicious_activity(events: &[SuspiciousEvent]) -> Result<(), String> {
    let data_dir = dirs::data_local_dir()
        .ok_or("Directory non trovata")?
        .join("GameStringer")
        .join("security");
    
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    
    let filepath = data_dir.join("suspicious_activity.json");
    let json = serde_json::to_string_pretty(events).map_err(|e| e.to_string())?;
    fs::write(filepath, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Ottieni attività sospette
#[tauri::command]
pub async fn get_suspicious_activity(
    limit: Option<usize>,
) -> Result<Vec<SuspiciousEvent>, String> {
    let activity = SUSPICIOUS_ACTIVITY.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);
    
    let result: Vec<_> = activity.iter()
        .rev()
        .take(limit)
        .cloned()
        .collect();
    
    Ok(result)
}

// ============================================================================
// 2. MEMORY PERSISTENCE PROTECTION
// ============================================================================

/// Struttura per dati sensibili con auto-clear
#[derive(Debug)]
pub struct SecureString {
    data: Vec<u8>,
}

impl SecureString {
    #[allow(dead_code)]
    pub fn new(s: &str) -> Self {
        Self { data: s.as_bytes().to_vec() }
    }
    
    #[allow(dead_code)]
    pub fn as_str(&self) -> &str {
        std::str::from_utf8(&self.data).unwrap_or("")
    }
    
    /// Azzera la memoria in modo sicuro
    pub fn secure_clear(&mut self) {
        for byte in &mut self.data {
            *byte = 0;
        }
        // Scrivi pattern alternati per assicurare sovrascrittura
        for byte in &mut self.data {
            *byte = 0xFF;
        }
        for byte in &mut self.data {
            *byte = 0;
        }
        self.data.clear();
    }
}

impl Drop for SecureString {
    fn drop(&mut self) {
        self.secure_clear();
    }
}

/// Pulisce dati sensibili dalla memoria
#[tauri::command]
pub async fn clear_sensitive_memory() -> Result<(), String> {
    // Forza garbage collection delle sessioni scadute
    let mut sessions = ACTIVE_SESSIONS.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().timestamp();
    let max_age = 24 * 60 * 60;
    
    sessions.retain(|_, s| now - s.created_at < max_age);
    
    // Pulisci tentativi di login vecchi
    let mut attempts = LOGIN_ATTEMPTS.lock().map_err(|e| e.to_string())?;
    let window = now - 3600; // 1 ora
    for (_, profile_attempts) in attempts.iter_mut() {
        profile_attempts.retain(|&t| t > window);
    }
    attempts.retain(|_, v| !v.is_empty());
    
    info!("🧹 Memoria sensibile pulita");
    
    Ok(())
}

/// Verifica che log non contengano dati sensibili
#[tauri::command]
pub async fn sanitize_logs() -> Result<u32, String> {
    let data_dir = dirs::data_local_dir()
        .ok_or("Directory non trovata")?
        .join("GameStringer")
        .join("logs");
    
    if !data_dir.exists() {
        return Ok(0);
    }
    
    let mut sanitized = 0u32;
    
    // Pattern sensibili da rimuovere
    let sensitive_patterns = [
        r"api[_-]?key[:\s]*[A-Za-z0-9_-]{20,}",
        r"password[:\s]*[^\s]{4,}",
        r"secret[:\s]*[A-Za-z0-9_-]{20,}",
        r"token[:\s]*[A-Za-z0-9_-]{20,}",
        r"Bearer\s+[A-Za-z0-9_-]+",
    ];
    
    let patterns: Vec<regex::Regex> = sensitive_patterns.iter()
        .filter_map(|p| regex::Regex::new(p).ok())
        .collect();
    
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "log" || e == "txt") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let mut new_content = content.clone();
                    for pattern in &patterns {
                        new_content = pattern.replace_all(&new_content, "[REDACTED]").to_string();
                    }
                    if new_content != content {
                        let _ = fs::write(&path, new_content);
                        sanitized += 1;
                    }
                }
            }
        }
    }
    
    info!("🔒 {} file di log sanitizzati", sanitized);
    
    Ok(sanitized)
}

// ============================================================================
// 3. PROMPT INJECTION BLOCKING
// ============================================================================

/// Risultato sanitizzazione prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptSanitizeResult {
    pub original: String,
    pub sanitized: String,
    pub threats_detected: Vec<String>,
    pub is_safe: bool,
    pub risk_level: String, // none, low, medium, high, critical
}

/// Pattern di injection noti
const INJECTION_PATTERNS: &[(&str, &str, &str)] = &[
    // (pattern, descrizione, severity)
    (r"(?i)ignore\s+(previous|all|above)\s+(instructions?|prompts?)", "Ignore instructions", "high"),
    (r"(?i)disregard\s+(previous|all|above)", "Disregard pattern", "high"),
    (r"(?i)forget\s+(everything|all|previous)", "Forget pattern", "high"),
    (r"(?i)you\s+are\s+now\s+", "Role override attempt", "critical"),
    (r"(?i)pretend\s+(to\s+be|you're|you\s+are)", "Pretend pattern", "high"),
    (r"(?i)act\s+as\s+(if|a|an)", "Act as pattern", "medium"),
    (r"(?i)new\s+instructions?:", "New instructions", "high"),
    (r"(?i)override\s+(system|safety|rules)", "Override attempt", "critical"),
    (r"(?i)bypass\s+(filters?|safety|restrictions?)", "Bypass attempt", "critical"),
    (r"(?i)jailbreak", "Jailbreak keyword", "critical"),
    (r"(?i)DAN\s*mode", "DAN mode attempt", "critical"),
    (r"(?i)developer\s+mode", "Developer mode", "high"),
    (r"(?i)sudo\s+mode", "Sudo mode", "high"),
    (r"(?i)\[system\]|\[admin\]|\[root\]", "System tag injection", "critical"),
    (r"(?i)```system|```admin", "Code block injection", "high"),
    (r"(?i)END\s+OF\s+(SYSTEM|PROMPT)", "End marker injection", "high"),
    (r"(?i)BEGIN\s+NEW\s+(INSTRUCTIONS?|PROMPT)", "Begin marker injection", "high"),
    (r"<\|.*?\|>", "Special token attempt", "medium"),
    (r"\x00|\x1b|\x7f", "Control character injection", "high"),
];

/// Sanitizza input per prevenire prompt injection
#[tauri::command]
pub async fn sanitize_prompt(
    input: String,
    strict_mode: Option<bool>,
) -> Result<PromptSanitizeResult, String> {
    let strict = strict_mode.unwrap_or(true);
    let mut sanitized = input.clone();
    let mut threats: Vec<String> = Vec::new();
    let mut max_severity = "none";
    
    // Controlla pattern di injection
    for (pattern, description, severity) in INJECTION_PATTERNS {
        if let Ok(re) = regex::Regex::new(pattern) {
            if re.is_match(&input) {
                threats.push(description.to_string());
                
                // Aggiorna max severity
                max_severity = match (max_severity, *severity) {
                    (_, "critical") => "critical",
                    ("critical", _) => "critical",
                    (_, "high") => "high",
                    ("high", _) => "high",
                    (_, "medium") => "medium",
                    ("medium", _) => "medium",
                    (_, s) => s,
                };
                
                if strict {
                    // Rimuovi pattern pericolosi
                    sanitized = re.replace_all(&sanitized, "[BLOCKED]").to_string();
                }
            }
        }
    }
    
    // Rimuovi caratteri di controllo
    sanitized = sanitized.chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();
    
    // Limita lunghezza massima
    let max_len = 10000;
    if sanitized.len() > max_len {
        sanitized.truncate(max_len);
        threats.push("Input truncated (too long)".to_string());
    }
    
    // Normalizza whitespace eccessivo
    let re_whitespace = regex::Regex::new(r"\s{10,}").unwrap();
    sanitized = re_whitespace.replace_all(&sanitized, "   ").to_string();
    
    let is_safe = threats.is_empty() || max_severity == "low";
    
    if !threats.is_empty() {
        warn!("⚠️ Prompt injection tentativo: {:?}", threats);
        
        // Log attività sospetta se severity alta
        if max_severity == "high" || max_severity == "critical" {
            log_suspicious_activity(
                "prompt_injection_attempt".to_string(),
                None,
                format!("Threats: {:?}", threats),
                max_severity.to_string(),
            )?;
        }
    }
    
    Ok(PromptSanitizeResult {
        original: input,
        sanitized,
        threats_detected: threats,
        is_safe,
        risk_level: max_severity.to_string(),
    })
}

/// Verifica se un prompt è sicuro (senza modificarlo)
#[tauri::command]
pub async fn is_prompt_safe(input: String) -> Result<bool, String> {
    let result = sanitize_prompt(input, Some(false)).await?;
    Ok(result.is_safe)
}

/// Ottiene lista pattern di injection bloccati
#[tauri::command]
pub async fn get_blocked_patterns() -> Result<Vec<String>, String> {
    Ok(INJECTION_PATTERNS.iter()
        .map(|(_, desc, _)| desc.to_string())
        .collect())
}

/// Aggiunge pattern custom di injection
static CUSTOM_PATTERNS: Lazy<Mutex<Vec<(String, String)>>> = 
    Lazy::new(|| Mutex::new(Vec::new()));

#[tauri::command]
pub async fn add_custom_injection_pattern(
    pattern: String,
    description: String,
) -> Result<(), String> {
    // Verifica che il pattern sia valido
    regex::Regex::new(&pattern)
        .map_err(|e| format!("Pattern regex non valido: {}", e))?;
    
    let mut patterns = CUSTOM_PATTERNS.lock().map_err(|e| e.to_string())?;
    
    info!("➕ Pattern injection custom aggiunto: {}", description);
    
    patterns.push((pattern, description));
    
    Ok(())
}
