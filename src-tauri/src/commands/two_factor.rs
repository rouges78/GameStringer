use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use log::info;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rand::Rng;
use hmac::{Hmac, Mac};
use sha1::Sha1;

type HmacSha1 = Hmac<Sha1>;

// ============================================================================
// TWO-FACTOR AUTHENTICATION (2FA) SYSTEM - TOTP
// ============================================================================

/// Configurazione 2FA per un profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwoFactorConfig {
    pub enabled: bool,
    pub secret: String,          // Base32 encoded secret
    pub backup_codes: Vec<String>, // Codici di backup monouso
    pub created_at: String,
    pub last_used: Option<String>,
}

/// Risultato generazione 2FA
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwoFactorSetupResult {
    pub secret: String,           // Base32 secret da inserire nell'app
    pub qr_code_url: String,      // URL per QR code (otpauth://)
    pub backup_codes: Vec<String>, // 10 codici di backup
}

/// Verifica 2FA
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwoFactorVerifyResult {
    pub valid: bool,
    pub used_backup_code: bool,
    pub remaining_backup_codes: u32,
}

/// Ottiene la directory per i dati 2FA
fn get_2fa_dir() -> Result<PathBuf, String> {
    let dir = dirs::data_local_dir()
        .ok_or("Directory dati non trovata")?
        .join("GameStringer")
        .join("2fa");
    
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    Ok(dir)
}

/// Genera un secret Base32 casuale per TOTP
fn generate_secret() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..20).map(|_| rng.gen()).collect();
    // Semplice encoding Base32 manuale (RFC 4648)
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let mut result = String::new();
    let mut buffer = 0u64;
    let mut bits = 0;
    
    for byte in bytes {
        buffer = (buffer << 8) | (byte as u64);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            let index = ((buffer >> bits) & 0x1F) as usize;
            result.push(ALPHABET[index] as char);
        }
    }
    if bits > 0 {
        let index = ((buffer << (5 - bits)) & 0x1F) as usize;
        result.push(ALPHABET[index] as char);
    }
    result
}

/// Genera codici di backup
fn generate_backup_codes(count: usize) -> Vec<String> {
    let mut rng = rand::thread_rng();
    (0..count)
        .map(|_| {
            let code: u32 = rng.gen_range(10000000..99999999);
            format!("{}", code)
        })
        .collect()
}

/// Decodifica Base32
fn decode_base32(input: &str) -> Option<Vec<u8>> {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let input = input.to_uppercase();
    let mut result = Vec::new();
    let mut buffer = 0u64;
    let mut bits = 0;
    
    for c in input.chars() {
        if c == '=' { continue; }
        let val = ALPHABET.iter().position(|&x| x == c as u8)?;
        buffer = (buffer << 5) | (val as u64);
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            result.push((buffer >> bits) as u8);
        }
    }
    Some(result)
}

/// Calcola TOTP usando HMAC-SHA1
fn calculate_totp(secret: &str, time_step: u64) -> Result<String, String> {
    // Decodifica secret Base32
    let secret_bytes = decode_base32(secret)
        .ok_or("Secret Base32 non valido")?;
    
    // Calcola counter basato sul tempo
    let counter = time_step.to_be_bytes();
    
    // HMAC-SHA1
    let mut mac = HmacSha1::new_from_slice(&secret_bytes)
        .map_err(|e| format!("Errore HMAC: {}", e))?;
    mac.update(&counter);
    let hmac_result = mac.finalize().into_bytes();
    
    // Dynamic truncation
    let offset = (hmac_result[hmac_result.len() - 1] & 0x0f) as usize;
    let binary = ((hmac_result[offset] & 0x7f) as u32) << 24
        | (hmac_result[offset + 1] as u32) << 16
        | (hmac_result[offset + 2] as u32) << 8
        | (hmac_result[offset + 3] as u32);
    
    // 6 digits
    let otp = binary % 1_000_000;
    
    Ok(format!("{:06}", otp))
}

/// Ottiene il time step corrente (30 secondi)
fn get_current_time_step() -> u64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    now / 30
}

/// Inizializza 2FA per un profilo
#[tauri::command]
pub async fn setup_two_factor(
    profile_id: String,
) -> Result<TwoFactorSetupResult, String> {
    info!("🔐 Setup 2FA per profilo: {}", profile_id);
    
    let secret = generate_secret();
    let backup_codes = generate_backup_codes(10);
    
    // Crea URL per QR code
    let qr_code_url = format!(
        "otpauth://totp/GameStringer:{}?secret={}&issuer=GameStringer&algorithm=SHA256&digits=6&period=30",
        profile_id, secret
    );
    
    // Salva configurazione (non attiva finché non viene verificata)
    let config = TwoFactorConfig {
        enabled: false, // Sarà abilitato dopo verifica
        secret: secret.clone(),
        backup_codes: backup_codes.clone(),
        created_at: Utc::now().to_rfc3339(),
        last_used: None,
    };
    
    let dir = get_2fa_dir()?;
    let config_file = dir.join(format!("{}_pending.json", profile_id));
    
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&config_file, json)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    Ok(TwoFactorSetupResult {
        secret,
        qr_code_url,
        backup_codes,
    })
}

/// Conferma e attiva 2FA dopo verifica codice
#[tauri::command]
pub async fn confirm_two_factor(
    profile_id: String,
    code: String,
) -> Result<bool, String> {
    info!("🔐 Conferma 2FA per profilo: {}", profile_id);
    
    let dir = get_2fa_dir()?;
    let pending_file = dir.join(format!("{}_pending.json", profile_id));
    
    if !pending_file.exists() {
        return Err("Nessun setup 2FA in corso".to_string());
    }
    
    // Leggi configurazione pending
    let content = fs::read_to_string(&pending_file)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let mut config: TwoFactorConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    
    // Verifica codice
    let time_step = get_current_time_step();
    
    // Controlla time step corrente e ±1 per tolleranza
    let valid = [time_step - 1, time_step, time_step + 1]
        .iter()
        .any(|&ts| {
            calculate_totp(&config.secret, ts)
                .map(|expected| expected == code)
                .unwrap_or(false)
        });
    
    if !valid {
        return Ok(false);
    }
    
    // Attiva 2FA
    config.enabled = true;
    config.last_used = Some(Utc::now().to_rfc3339());
    
    let active_file = dir.join(format!("{}.json", profile_id));
    
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&active_file, json)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    // Rimuovi file pending
    let _ = fs::remove_file(&pending_file);
    
    info!("✅ 2FA attivato per: {}", profile_id);
    
    Ok(true)
}

/// Verifica codice 2FA durante login
#[tauri::command]
pub async fn verify_two_factor(
    profile_id: String,
    code: String,
) -> Result<TwoFactorVerifyResult, String> {
    info!("🔐 Verifica 2FA per profilo: {}", profile_id);
    
    let dir = get_2fa_dir()?;
    let config_file = dir.join(format!("{}.json", profile_id));
    
    if !config_file.exists() {
        return Err("2FA non configurato per questo profilo".to_string());
    }
    
    let content = fs::read_to_string(&config_file)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let mut config: TwoFactorConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    
    if !config.enabled {
        return Err("2FA non attivo".to_string());
    }
    
    // Prima controlla se è un codice di backup
    let backup_index = config.backup_codes.iter().position(|c| c == &code);
    
    if let Some(idx) = backup_index {
        // Usa codice di backup
        config.backup_codes.remove(idx);
        config.last_used = Some(Utc::now().to_rfc3339());
        
        // Salva configurazione aggiornata
        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Errore serializzazione: {}", e))?;
        fs::write(&config_file, json)
            .map_err(|e| format!("Errore scrittura: {}", e))?;
        
        info!("✅ 2FA verificato con backup code");
        
        return Ok(TwoFactorVerifyResult {
            valid: true,
            used_backup_code: true,
            remaining_backup_codes: config.backup_codes.len() as u32,
        });
    }
    
    // Verifica codice TOTP
    let time_step = get_current_time_step();
    
    let valid = [time_step - 1, time_step, time_step + 1]
        .iter()
        .any(|&ts| {
            calculate_totp(&config.secret, ts)
                .map(|expected| expected == code)
                .unwrap_or(false)
        });
    
    if valid {
        config.last_used = Some(Utc::now().to_rfc3339());
        
        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Errore serializzazione: {}", e))?;
        fs::write(&config_file, json)
            .map_err(|e| format!("Errore scrittura: {}", e))?;
        
        info!("✅ 2FA verificato con TOTP");
    }
    
    Ok(TwoFactorVerifyResult {
        valid,
        used_backup_code: false,
        remaining_backup_codes: config.backup_codes.len() as u32,
    })
}

/// Controlla se 2FA è abilitato per un profilo
#[tauri::command]
pub async fn is_two_factor_enabled(
    profile_id: String,
) -> Result<bool, String> {
    let dir = get_2fa_dir()?;
    let config_file = dir.join(format!("{}.json", profile_id));
    
    if !config_file.exists() {
        return Ok(false);
    }
    
    let content = fs::read_to_string(&config_file)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let config: TwoFactorConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    
    Ok(config.enabled)
}

/// Disabilita 2FA per un profilo
#[tauri::command]
pub async fn disable_two_factor(
    profile_id: String,
    code: String,
) -> Result<bool, String> {
    info!("🔐 Disabilita 2FA per profilo: {}", profile_id);
    
    // Prima verifica il codice
    let verify_result = verify_two_factor(profile_id.clone(), code).await?;
    
    if !verify_result.valid {
        return Ok(false);
    }
    
    // Elimina configurazione 2FA
    let dir = get_2fa_dir()?;
    let config_file = dir.join(format!("{}.json", profile_id));
    
    if config_file.exists() {
        fs::remove_file(&config_file)
            .map_err(|e| format!("Errore eliminazione: {}", e))?;
    }
    
    info!("✅ 2FA disabilitato per: {}", profile_id);
    
    Ok(true)
}

/// Rigenera codici di backup
#[tauri::command]
pub async fn regenerate_backup_codes(
    profile_id: String,
    code: String,
) -> Result<Vec<String>, String> {
    info!("🔐 Rigenera backup codes per profilo: {}", profile_id);
    
    // Prima verifica il codice
    let verify_result = verify_two_factor(profile_id.clone(), code).await?;
    
    if !verify_result.valid {
        return Err("Codice non valido".to_string());
    }
    
    let dir = get_2fa_dir()?;
    let config_file = dir.join(format!("{}.json", profile_id));
    
    let content = fs::read_to_string(&config_file)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    
    let mut config: TwoFactorConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    
    // Genera nuovi codici
    let new_codes = generate_backup_codes(10);
    config.backup_codes = new_codes.clone();
    
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&config_file, json)
        .map_err(|e| format!("Errore scrittura: {}", e))?;
    
    info!("✅ Backup codes rigenerati");
    
    Ok(new_codes)
}
