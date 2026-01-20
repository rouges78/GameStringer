// Comandi Tauri per validazione input profili
use crate::commands::profiles::ProfileManagerState;
use crate::profiles::validation::{ProfileNameValidationResult, PasswordValidationResult, ValidationConfig};
use serde::Serialize;
use tauri::{command, State};

/// Risposta generica per operazioni validazione
#[derive(Debug, Serialize)]
pub struct ValidationResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ValidationResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

/// Valida nome profilo
#[command]
pub async fn validate_profile_name(
    name: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<ProfileNameValidationResult>, String> {
    let manager = profile_state.manager.lock().await;
    
    let result = manager.validate_profile_name(&name);
    Ok(ValidationResponse::success(result))
}

/// Valida password profilo
#[command]
pub async fn validate_password(
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<PasswordValidationResult>, String> {
    let manager = profile_state.manager.lock().await;
    
    let result = manager.validate_password(&password);
    Ok(ValidationResponse::success(result))
}

/// Verifica unicità nome profilo
#[command]
pub async fn validate_unique_profile_name(
    name: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<bool>, String> {
    let manager = profile_state.manager.lock().await;
    
    match manager.validate_unique_profile_name(&name).await {
        Ok(_) => Ok(ValidationResponse::success(true)),
        Err(err) => Ok(ValidationResponse::error(err.to_string())),
    }
}

/// Sanitizza input generico
#[command]
pub async fn sanitize_input(
    input: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<String>, String> {
    let manager = profile_state.manager.lock().await;
    
    let sanitized = manager.sanitize_input(&input);
    Ok(ValidationResponse::success(sanitized))
}

/// Ottiene configurazione validazione
#[command]
pub async fn get_validation_config(
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<ValidationConfig>, String> {
    let manager = profile_state.manager.lock().await;
    
    let config = manager.get_validation_config().clone();
    Ok(ValidationResponse::success(config))
}

/// Aggiorna configurazione validazione
#[command]
pub async fn update_validation_config(
    config: ValidationConfig,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<bool>, String> {
    let mut manager = profile_state.manager.lock().await;
    
    manager.update_validation_config(config);
    Ok(ValidationResponse::success(true))
}

/// Valida input completo per creazione profilo
#[command]
pub async fn validate_profile_creation(
    name: String,
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<ProfileCreationValidationResult>, String> {
    let manager = profile_state.manager.lock().await;
    
    let name_result = manager.validate_profile_name(&name);
    let password_result = manager.validate_password(&password);
    
    let unique_result = match manager.validate_unique_profile_name(&name).await {
        Ok(_) => true,
        Err(_) => false,
    };
    
    let is_valid = name_result.is_valid && password_result.is_valid && unique_result;
    
    let result = ProfileCreationValidationResult {
        name_validation: name_result,
        password_validation: password_result,
        is_name_unique: unique_result,
        is_valid,
    };
    
    Ok(ValidationResponse::success(result))
}

/// Risultato validazione completa creazione profilo
#[derive(Debug, Serialize)]
pub struct ProfileCreationValidationResult {
    pub name_validation: ProfileNameValidationResult,
    pub password_validation: PasswordValidationResult,
    pub is_name_unique: bool,
    pub is_valid: bool,
}

/// Genera suggerimenti per password sicura
#[command]
pub async fn generate_password_suggestions(
    current_password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<Vec<String>>, String> {
    let manager = profile_state.manager.lock().await;
    
    let validation = manager.validate_password(&current_password);
    let mut suggestions = validation.suggestions;
    
    // Aggiungi suggerimenti specifici basati sulla password corrente
    if current_password.len() < 12 {
        suggestions.push("Considera di usare almeno 12 caratteri per maggiore sicurezza".to_string());
    }
    
    if !current_password.chars().any(|c| c.is_uppercase()) {
        suggestions.push("Aggiungi lettere maiuscole (A-Z)".to_string());
    }
    
    if !current_password.chars().any(|c| c.is_lowercase()) {
        suggestions.push("Aggiungi lettere minuscole (a-z)".to_string());
    }
    
    if !current_password.chars().any(|c| c.is_numeric()) {
        suggestions.push("Aggiungi numeri (0-9)".to_string());
    }
    
    if !current_password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c)) {
        suggestions.push("Aggiungi caratteri speciali (!@#$%^&*)".to_string());
    }
    
    // Suggerimenti generali
    if suggestions.is_empty() {
        suggestions.push("La tua password è già molto sicura!".to_string());
    } else {
        suggestions.push("Evita informazioni personali come nome, data di nascita o parole comuni".to_string());
        suggestions.push("Considera l'uso di una passphrase con parole casuali separate da simboli".to_string());
    }
    
    Ok(ValidationResponse::success(suggestions))
}

/// Controlla forza password in tempo reale
#[command]
pub async fn check_password_strength_realtime(
    password: String,
    profile_state: State<'_, ProfileManagerState>,
) -> Result<ValidationResponse<PasswordStrengthInfo>, String> {
    let manager = profile_state.manager.lock().await;
    
    let validation = manager.validate_password(&password);
    
    let is_acceptable = validation.strength_level.is_acceptable();
    
    let info = PasswordStrengthInfo {
        score: validation.strength_score,
        level: validation.strength_level,
        is_acceptable,
        feedback: if validation.errors.is_empty() {
            validation.suggestions
        } else {
            validation.errors
        },
    };
    
    Ok(ValidationResponse::success(info))
}

/// Informazioni forza password per UI
#[derive(Debug, Serialize)]
pub struct PasswordStrengthInfo {
    pub score: u8,
    pub level: crate::profiles::validation::PasswordStrength,
    pub is_acceptable: bool,
    pub feedback: Vec<String>,
}