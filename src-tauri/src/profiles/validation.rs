// Modulo per validazione input profili
use crate::profiles::errors::{ProfileError, ProfileResult};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Configurazione validazione profili
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationConfig {
    /// Lunghezza minima nome profilo
    pub min_profile_name_length: usize,
    /// Lunghezza massima nome profilo
    pub max_profile_name_length: usize,
    /// Lunghezza minima password
    pub min_password_length: usize,
    /// Lunghezza massima password
    pub max_password_length: usize,
    /// Richiede caratteri maiuscoli nella password
    pub require_uppercase: bool,
    /// Richiede caratteri minuscoli nella password
    pub require_lowercase: bool,
    /// Richiede numeri nella password
    pub require_numbers: bool,
    /// Richiede caratteri speciali nella password
    pub require_special_chars: bool,
    /// Caratteri speciali consentiti
    pub allowed_special_chars: String,
    /// Nomi profilo riservati
    pub reserved_names: HashSet<String>,
}

impl Default for ValidationConfig {
    fn default() -> Self {
        let mut reserved_names = HashSet::new();
        reserved_names.insert("admin".to_string());
        reserved_names.insert("root".to_string());
        reserved_names.insert("system".to_string());
        reserved_names.insert("default".to_string());
        reserved_names.insert("guest".to_string());
        reserved_names.insert("user".to_string());
        reserved_names.insert("test".to_string());
        reserved_names.insert("temp".to_string());
        reserved_names.insert("temporary".to_string());
        reserved_names.insert("null".to_string());
        reserved_names.insert("undefined".to_string());
        reserved_names.insert("anonymous".to_string());

        Self {
            min_profile_name_length: 2,
            max_profile_name_length: 32,
            min_password_length: 4,
            max_password_length: 128,
            require_uppercase: false,
            require_lowercase: false,
            require_numbers: false,
            require_special_chars: false,
            allowed_special_chars: "!@#$%^&*()_+-=[]{}|;:,.<>?".to_string(),
            reserved_names,
        }
    }
}

/// Risultato validazione nome profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileNameValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub sanitized_name: String,
}

/// Risultato validazione password
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordValidationResult {
    pub is_valid: bool,
    pub strength_score: u8, // 0-100
    pub strength_level: PasswordStrength,
    pub errors: Vec<String>,
    pub suggestions: Vec<String>,
}

/// Livelli di forza password
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum PasswordStrength {
    VeryWeak,
    Weak,
    Fair,
    Good,
    Strong,
    VeryStrong,
}

impl PasswordStrength {
    pub fn from_score(score: u8) -> Self {
        match score {
            0..=20 => PasswordStrength::VeryWeak,
            21..=40 => PasswordStrength::Weak,
            41..=60 => PasswordStrength::Fair,
            61..=80 => PasswordStrength::Good,
            81..=95 => PasswordStrength::Strong,
            _ => PasswordStrength::VeryStrong,
        }
    }

    pub fn to_string(&self) -> &'static str {
        match self {
            PasswordStrength::VeryWeak => "Molto debole",
            PasswordStrength::Weak => "Debole",
            PasswordStrength::Fair => "Discreta",
            PasswordStrength::Good => "Buona",
            PasswordStrength::Strong => "Forte",
            PasswordStrength::VeryStrong => "Molto forte",
        }
    }

    pub fn is_acceptable(&self) -> bool {
        matches!(self, PasswordStrength::Fair | PasswordStrength::Good | PasswordStrength::Strong | PasswordStrength::VeryStrong)
    }
}

/// Validatore profili
pub struct ProfileValidator {
    pub config: ValidationConfig,
}

impl ProfileValidator {
    pub fn new(config: ValidationConfig) -> Self {
        Self { config }
    }

    pub fn with_default_config() -> Self {
        Self::new(ValidationConfig::default())
    }

    /// Valida nome profilo
    pub fn validate_profile_name(&self, name: &str) -> ProfileNameValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        // Sanitizza il nome
        let sanitized_name = self.sanitize_profile_name(name);
        
        // Controlla lunghezza
        if sanitized_name.len() < self.config.min_profile_name_length {
            errors.push(format!("Il nome deve essere di almeno {} caratteri", self.config.min_profile_name_length));
        }
        
        if sanitized_name.len() > self.config.max_profile_name_length {
            errors.push(format!("Il nome non può superare {} caratteri", self.config.max_profile_name_length));
        }
        
        // Controlla se è vuoto dopo sanitizzazione
        if sanitized_name.trim().is_empty() {
            errors.push("Il nome non può essere vuoto".to_string());
        }
        
        // Controlla caratteri validi
        let valid_chars_regex = Regex::new(r"^[a-zA-Z0-9_\-\s]+$").unwrap();
        if !valid_chars_regex.is_match(&sanitized_name) {
            errors.push("Il nome può contenere solo lettere, numeri, spazi, trattini e underscore".to_string());
        }
        
        // Controlla nomi riservati
        if self.config.reserved_names.contains(&sanitized_name.to_lowercase()) {
            errors.push("Questo nome è riservato e non può essere utilizzato".to_string());
        }
        
        // Controlla se inizia o finisce con spazi
        if sanitized_name.starts_with(' ') || sanitized_name.ends_with(' ') {
            warnings.push("Il nome non dovrebbe iniziare o finire con spazi".to_string());
        }
        
        // Controlla spazi multipli consecutivi
        if sanitized_name.contains("  ") {
            warnings.push("Evita spazi multipli consecutivi nel nome".to_string());
        }
        
        // Controlla se è solo numeri
        if sanitized_name.chars().all(|c| c.is_numeric()) {
            warnings.push("Il nome dovrebbe contenere almeno una lettera".to_string());
        }

        ProfileNameValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
            sanitized_name,
        }
    }

    /// Valida password
    pub fn validate_password(&self, password: &str) -> PasswordValidationResult {
        let mut errors = Vec::new();
        let mut suggestions = Vec::new();
        let mut score = 0u8;

        // Controlla lunghezza
        if password.len() < self.config.min_password_length {
            errors.push(format!("La password deve essere di almeno {} caratteri", self.config.min_password_length));
        } else {
            score += 20; // Base score per lunghezza minima
            
            // Bonus per lunghezza extra
            let extra_length = password.len().saturating_sub(self.config.min_password_length);
            score += std::cmp::min(extra_length * 2, 20) as u8;
        }
        
        if password.len() > self.config.max_password_length {
            errors.push(format!("La password non può superare {} caratteri", self.config.max_password_length));
        }

        // Controlla caratteri maiuscoli
        let has_uppercase = password.chars().any(|c| c.is_uppercase());
        if self.config.require_uppercase && !has_uppercase {
            errors.push("La password deve contenere almeno una lettera maiuscola".to_string());
        } else if has_uppercase {
            score += 15;
        } else {
            suggestions.push("Aggiungi almeno una lettera maiuscola per aumentare la sicurezza".to_string());
        }

        // Controlla caratteri minuscoli
        let has_lowercase = password.chars().any(|c| c.is_lowercase());
        if self.config.require_lowercase && !has_lowercase {
            errors.push("La password deve contenere almeno una lettera minuscola".to_string());
        } else if has_lowercase {
            score += 15;
        } else {
            suggestions.push("Aggiungi almeno una lettera minuscola per aumentare la sicurezza".to_string());
        }

        // Controlla numeri
        let has_numbers = password.chars().any(|c| c.is_numeric());
        if self.config.require_numbers && !has_numbers {
            errors.push("La password deve contenere almeno un numero".to_string());
        } else if has_numbers {
            score += 15;
        } else {
            suggestions.push("Aggiungi almeno un numero per aumentare la sicurezza".to_string());
        }

        // Controlla caratteri speciali
        let has_special = password.chars().any(|c| self.config.allowed_special_chars.contains(c));
        if self.config.require_special_chars && !has_special {
            errors.push(format!("La password deve contenere almeno un carattere speciale ({})", self.config.allowed_special_chars));
        } else if has_special {
            score += 15;
        } else {
            suggestions.push("Aggiungi caratteri speciali per aumentare la sicurezza".to_string());
        }

        // Controlla pattern comuni deboli
        if self.is_common_weak_password(password) {
            score = std::cmp::min(score, 30);
            suggestions.push("Evita password comuni o pattern prevedibili".to_string());
        }

        // Controlla ripetizioni
        if self.has_excessive_repetition(password) {
            score = score.saturating_sub(10);
            suggestions.push("Evita ripetizioni eccessive di caratteri".to_string());
        }

        // Controlla sequenze
        if self.has_sequential_chars(password) {
            score = score.saturating_sub(10);
            suggestions.push("Evita sequenze di caratteri consecutive (es. 123, abc)".to_string());
        }

        // Bonus per diversità di caratteri
        let unique_chars = password.chars().collect::<std::collections::HashSet<_>>().len();
        if unique_chars > password.len() / 2 {
            score += 10;
        }

        // Limita il punteggio massimo
        score = std::cmp::min(score, 100);

        let strength_level = PasswordStrength::from_score(score);

        PasswordValidationResult {
            is_valid: errors.is_empty() && strength_level.is_acceptable(),
            strength_score: score,
            strength_level,
            errors,
            suggestions,
        }
    }

    /// Sanitizza nome profilo
    fn sanitize_profile_name(&self, name: &str) -> String {
        // Rimuove caratteri di controllo e spazi extra
        let sanitized = name
            .chars()
            .filter(|c| !c.is_control())
            .collect::<String>()
            .trim()
            .to_string();

        // Sostituisce spazi multipli con spazio singolo
        let space_regex = Regex::new(r"\s+").unwrap();
        space_regex.replace_all(&sanitized, " ").to_string()
    }

    /// Controlla se è una password comune debole
    fn is_common_weak_password(&self, password: &str) -> bool {
        let common_passwords = [
            "password", "123456", "123456789", "qwerty", "abc123",
            "password123", "admin", "letmein", "welcome", "monkey",
            "dragon", "master", "shadow", "123123", "654321",
            "superman", "qazwsx", "michael", "football", "baseball"
        ];

        let lower_password = password.to_lowercase();
        common_passwords.iter().any(|&common| lower_password.contains(common))
    }

    /// Controlla ripetizioni eccessive
    fn has_excessive_repetition(&self, password: &str) -> bool {
        let chars: Vec<char> = password.chars().collect();
        let mut consecutive_count = 1;
        
        for i in 1..chars.len() {
            if chars[i] == chars[i-1] {
                consecutive_count += 1;
                if consecutive_count >= 3 {
                    return true;
                }
            } else {
                consecutive_count = 1;
            }
        }
        
        false
    }

    /// Controlla sequenze consecutive
    fn has_sequential_chars(&self, password: &str) -> bool {
        let chars: Vec<char> = password.chars().collect();
        
        for i in 2..chars.len() {
            let c1 = chars[i-2] as u8;
            let c2 = chars[i-1] as u8;
            let c3 = chars[i] as u8;
            
            // Controlla sequenze crescenti o decrescenti
            if (c2 == c1 + 1 && c3 == c2 + 1) || (c2 == c1 - 1 && c3 == c2 - 1) {
                return true;
            }
        }
        
        false
    }

    /// Valida input generico (sanitizzazione)
    pub fn sanitize_input(&self, input: &str) -> String {
        input
            .chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
            .collect::<String>()
            .trim()
            .to_string()
    }

    /// Valida che un profilo non esista già
    pub fn validate_unique_profile_name(&self, name: &str, existing_names: &[String]) -> ProfileResult<()> {
        let sanitized_name = self.sanitize_profile_name(name);
        
        if existing_names.iter().any(|existing| existing.to_lowercase() == sanitized_name.to_lowercase()) {
            return Err(ProfileError::ProfileAlreadyExists(sanitized_name));
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_name_validation() {
        let validator = ProfileValidator::with_default_config();
        
        // Nome valido
        let result = validator.validate_profile_name("TestUser");
        assert!(result.is_valid);
        assert_eq!(result.sanitized_name, "TestUser");
        
        // Nome troppo corto
        let result = validator.validate_profile_name("A");
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("almeno")));
        
        // Nome riservato
        let result = validator.validate_profile_name("admin");
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("riservato")));
        
        // Caratteri non validi
        let result = validator.validate_profile_name("Test@User");
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("caratteri")));
    }

    #[test]
    fn test_password_validation() {
        let validator = ProfileValidator::with_default_config();
        
        // Password forte
        let result = validator.validate_password("MyStr0ng!Pass");
        assert!(result.is_valid);
        assert!(result.strength_score > 60);
        
        // Password troppo corta
        let result = validator.validate_password("123");
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("almeno")));
        
        // Password comune
        let result = validator.validate_password("password123");
        assert!(result.strength_score < 50);
        assert!(result.suggestions.iter().any(|s| s.contains("comuni")));
    }

    #[test]
    fn test_sanitization() {
        let validator = ProfileValidator::with_default_config();
        
        // Test sanitizzazione nome
        let sanitized = validator.sanitize_profile_name("  Test   User  ");
        assert_eq!(sanitized, "Test User");
        
        // Test sanitizzazione input generico
        let sanitized = validator.sanitize_input("Test\x00Input\x01");
        assert_eq!(sanitized, "TestInput");
    }
}