// Modulo per crittografia profili con AES-256-GCM e PBKDF2
use crate::profiles::errors::{ProfileError, ProfileResult};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use pbkdf2::{
    password_hash::{PasswordHash, PasswordHasher, SaltString},
    Pbkdf2,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Configurazione crittografia
const PBKDF2_ITERATIONS: u32 = 100_000; // 100k iterazioni per sicurezza
const SALT_LENGTH: usize = 32; // 256 bit salt
const NONCE_LENGTH: usize = 12; // 96 bit nonce per AES-GCM
const KEY_LENGTH: usize = 32; // 256 bit key

/// Struttura per dati crittografati
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    /// Versione formato crittografia
    pub version: u32,
    /// Salt per PBKDF2
    pub salt: Vec<u8>,
    /// Nonce per AES-GCM
    pub nonce: Vec<u8>,
    /// Dati crittografati con tag di autenticazione
    pub ciphertext: Vec<u8>,
    /// Numero iterazioni PBKDF2 usate
    pub iterations: u32,
}

/// Sistema di crittografia per profili utente
pub struct ProfileEncryption {
    /// Generatore numeri casuali
    rng: OsRng,
}

impl ProfileEncryption {
    /// Crea nuovo sistema di crittografia
    pub fn new() -> Self {
        Self { rng: OsRng }
    }

    /// Crittografa i dati del profilo con AES-256-GCM
    pub fn encrypt_profile_data(&self, data: &[u8], password: &str) -> ProfileResult<Vec<u8>> {
        // Genera salt casuale
        let mut salt = vec![0u8; SALT_LENGTH];
        OsRng.fill_bytes(&mut salt);

        // Deriva chiave da password usando PBKDF2
        let key = self.derive_key(password, &salt, PBKDF2_ITERATIONS)?;

        // Genera nonce casuale
        let mut nonce_bytes = vec![0u8; NONCE_LENGTH];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Inizializza cipher AES-256-GCM
        let cipher = Aes256Gcm::new(&key);

        // Crittografa i dati
        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore crittografia AES-GCM: {}", e)))?;

        // Crea struttura dati crittografati
        let encrypted_data = EncryptedData {
            version: 1,
            salt,
            nonce: nonce_bytes,
            ciphertext,
            iterations: PBKDF2_ITERATIONS,
        };

        // Serializza in binario
        let serialized = bincode::serialize(&encrypted_data)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore serializzazione: {}", e)))?;

        println!("[PROFILE ENCRYPTION] ✅ Dati crittografati con AES-256-GCM (dimensione: {} bytes)", serialized.len());
        Ok(serialized)
    }

    /// Decrittografa i dati del profilo
    pub fn decrypt_profile_data(&self, encrypted_data: &[u8], password: &str) -> ProfileResult<Vec<u8>> {
        // Deserializza dati crittografati
        let encrypted: EncryptedData = bincode::deserialize(encrypted_data)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore deserializzazione: {}", e)))?;

        // Verifica versione formato
        if encrypted.version != 1 {
            return Err(ProfileError::DataFormatError(format!(
                "Versione formato non supportata: {}",
                encrypted.version
            )));
        }

        // Verifica lunghezze
        if encrypted.salt.len() != SALT_LENGTH {
            return Err(ProfileError::CorruptedProfile(format!(
                "Salt lunghezza invalida: {} (attesa: {})",
                encrypted.salt.len(),
                SALT_LENGTH
            )));
        }

        if encrypted.nonce.len() != NONCE_LENGTH {
            return Err(ProfileError::CorruptedProfile(format!(
                "Nonce lunghezza invalida: {} (attesa: {})",
                encrypted.nonce.len(),
                NONCE_LENGTH
            )));
        }

        // Deriva chiave da password
        let key = self.derive_key(password, &encrypted.salt, encrypted.iterations)?;

        // Prepara nonce
        let nonce = Nonce::from_slice(&encrypted.nonce);

        // Inizializza cipher
        let cipher = Aes256Gcm::new(&key);

        // Decrittografa i dati
        let plaintext = cipher
            .decrypt(nonce, encrypted.ciphertext.as_ref())
            .map_err(|e| {
                // Errore di decrittografia spesso indica password errata
                if e.to_string().contains("aead::Error") {
                    ProfileError::InvalidPassword
                } else {
                    ProfileError::EncryptionError(format!("Errore decrittografia: {}", e))
                }
            })?;

        println!("[PROFILE ENCRYPTION] ✅ Dati decrittografati (dimensione: {} bytes)", plaintext.len());
        Ok(plaintext)
    }

    /// Deriva chiave da password usando PBKDF2
    fn derive_key(&self, password: &str, salt: &[u8], iterations: u32) -> ProfileResult<Key<Aes256Gcm>> {
        // Valida parametri
        if password.is_empty() {
            return Err(ProfileError::WeakPassword("Password vuota".to_string()));
        }

        if salt.len() != SALT_LENGTH {
            return Err(ProfileError::EncryptionError(format!(
                "Salt lunghezza invalida: {}",
                salt.len()
            )));
        }

        // Crea salt string per PBKDF2
        let salt_string = SaltString::encode_b64(salt)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore encoding salt: {}", e)))?;

        // Deriva chiave con PBKDF2
        let password_hash = Pbkdf2
            .hash_password_customized(
                password.as_bytes(),
                None,
                None,
                pbkdf2::Params {
                    rounds: iterations,
                    output_length: KEY_LENGTH,
                },
                &salt_string,
            )
            .map_err(|e| ProfileError::EncryptionError(format!("Errore PBKDF2: {}", e)))?;

        // Estrai chiave derivata
        let key_bytes = password_hash.hash.ok_or_else(|| {
            ProfileError::EncryptionError("Nessuna chiave derivata da PBKDF2".to_string())
        })?;

        if key_bytes.len() != KEY_LENGTH {
            return Err(ProfileError::EncryptionError(format!(
                "Chiave lunghezza invalida: {} (attesa: {})",
                key_bytes.len(),
                KEY_LENGTH
            )));
        }

        // Crea chiave AES
        let key = Key::<Aes256Gcm>::from_slice(key_bytes.as_bytes());
        Ok(*key)
    }

    /// Verifica forza password
    pub fn validate_password_strength(&self, password: &str) -> ProfileResult<()> {
        if password.len() < 8 {
            return Err(ProfileError::WeakPassword(
                "Password deve essere almeno 8 caratteri".to_string(),
            ));
        }

        if password.len() > 128 {
            return Err(ProfileError::WeakPassword(
                "Password troppo lunga (max 128 caratteri)".to_string(),
            ));
        }

        let has_lower = password.chars().any(|c| c.is_lowercase());
        let has_upper = password.chars().any(|c| c.is_uppercase());
        let has_digit = password.chars().any(|c| c.is_ascii_digit());
        let has_special = password.chars().any(|c| !c.is_alphanumeric());

        let strength_score = [has_lower, has_upper, has_digit, has_special]
            .iter()
            .filter(|&&x| x)
            .count();

        if strength_score < 3 {
            return Err(ProfileError::WeakPassword(
                "Password deve contenere almeno 3 di: minuscole, maiuscole, numeri, caratteri speciali".to_string(),
            ));
        }

        // Controlla password comuni
        let common_passwords = [
            "password", "123456", "123456789", "qwerty", "abc123", "password123",
            "admin", "letmein", "welcome", "monkey", "dragon", "master",
        ];

        let password_lower = password.to_lowercase();
        if common_passwords.iter().any(|&p| password_lower.contains(p)) {
            return Err(ProfileError::WeakPassword(
                "Password contiene parole comuni non sicure".to_string(),
            ));
        }

        Ok(())
    }

    /// Genera password sicura casuale
    pub fn generate_secure_password(&self, length: usize) -> String {
        use rand::seq::SliceRandom;

        let length = length.clamp(12, 64); // Lunghezza tra 12 e 64 caratteri

        let lowercase = b"abcdefghijklmnopqrstuvwxyz";
        let uppercase = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let digits = b"0123456789";
        let special = b"!@#$%^&*()_+-=[]{}|;:,.<>?";

        let mut password = Vec::new();
        let mut rng = OsRng;

        // Assicura almeno un carattere di ogni tipo
        password.push(*lowercase.choose(&mut rng).unwrap());
        password.push(*uppercase.choose(&mut rng).unwrap());
        password.push(*digits.choose(&mut rng).unwrap());
        password.push(*special.choose(&mut rng).unwrap());

        // Riempi il resto casualmente
        let mut all_chars = Vec::new();
        all_chars.extend_from_slice(lowercase);
        all_chars.extend_from_slice(uppercase);
        all_chars.extend_from_slice(digits);
        all_chars.extend_from_slice(special);
        for _ in 4..length {
            password.push(*all_chars.choose(&mut rng).unwrap());
        }

        // Mescola i caratteri
        password.shuffle(&mut rng);

        String::from_utf8(password).unwrap()
    }

    /// Calcola hash password per verifica (non per crittografia)
    pub fn hash_password_for_verification(&self, password: &str) -> ProfileResult<String> {
        use argon2::{Argon2, PasswordHasher};

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore hash Argon2: {}", e)))?;

        Ok(password_hash.to_string())
    }

    /// Verifica password contro hash
    pub fn verify_password_hash(&self, password: &str, hash: &str) -> ProfileResult<bool> {
        use argon2::{Argon2, PasswordHash, PasswordVerifier};

        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| ProfileError::EncryptionError(format!("Hash invalido: {}", e)))?;

        let argon2 = Argon2::default();
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Ottieni informazioni crittografia da dati crittografati
    pub fn get_encryption_info(&self, encrypted_data: &[u8]) -> ProfileResult<EncryptionInfo> {
        let encrypted: EncryptedData = bincode::deserialize(encrypted_data)
            .map_err(|e| ProfileError::EncryptionError(format!("Errore deserializzazione: {}", e)))?;

        Ok(EncryptionInfo {
            version: encrypted.version,
            iterations: encrypted.iterations,
            salt_length: encrypted.salt.len(),
            nonce_length: encrypted.nonce.len(),
            ciphertext_length: encrypted.ciphertext.len(),
            total_size: encrypted_data.len(),
        })
    }
}

/// Informazioni su dati crittografati
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionInfo {
    pub version: u32,
    pub iterations: u32,
    pub salt_length: usize,
    pub nonce_length: usize,
    pub ciphertext_length: usize,
    pub total_size: usize,
}

impl Default for ProfileEncryption {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Debug for ProfileEncryption {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProfileEncryption")
            .field("algorithm", &"AES-256-GCM")
            .field("kdf", &"PBKDF2")
            .field("iterations", &PBKDF2_ITERATIONS)
            .finish()
    }
}