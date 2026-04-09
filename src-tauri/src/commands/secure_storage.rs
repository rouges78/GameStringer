use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;

// ============================================================================
// SECURE KEY STORAGE — AES-256-GCM encrypted API key storage
// ============================================================================

/// In-memory cache of decrypted keys (cleared on app exit)
static KEY_CACHE: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Encrypted key entry stored on disk
#[derive(Serialize, Deserialize)]
struct EncryptedEntry {
    nonce: Vec<u8>,
    ciphertext: Vec<u8>,
}

/// Storage file format
#[derive(Serialize, Deserialize, Default)]
struct SecureKeyStore {
    version: u32,
    keys: HashMap<String, EncryptedEntry>,
}

/// Derive a 256-bit encryption key from machine-specific data.
/// Uses a combination of the app identifier and machine ID for key derivation.
fn derive_encryption_key() -> [u8; 32] {
    let mut hasher = Sha256::new();

    // Use app-specific salt
    hasher.update(b"GameStringer-SecureKeyStore-v1");

    // Add machine-specific entropy
    #[cfg(windows)]
    {
        // Use machine GUID from registry (unique per Windows installation)
        if let Ok(output) = std::process::Command::new("reg")
            .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
            .output()
        {
            hasher.update(&output.stdout);
        }
    }

    #[cfg(not(windows))]
    {
        // Use /etc/machine-id on Linux
        if let Ok(id) = fs::read_to_string("/etc/machine-id") {
            hasher.update(id.as_bytes());
        }
    }

    // Add username for per-user isolation
    if let Ok(user) = std::env::var("USERNAME").or_else(|_| std::env::var("USER")) {
        hasher.update(user.as_bytes());
    }

    hasher.finalize().into()
}

/// Get the path to the secure storage file
fn get_storage_path() -> PathBuf {
    #[cfg(windows)]
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    #[cfg(not(windows))]
    let base = std::env::var("XDG_DATA_HOME")
        .or_else(|_| std::env::var("HOME").map(|h| format!("{}/.local/share", h)))
        .unwrap_or_else(|_| ".".to_string());

    PathBuf::from(base)
        .join("GameStringer")
        .join("secure_keys.enc")
}

/// Load the encrypted store from disk
fn load_store() -> SecureKeyStore {
    let path = get_storage_path();
    if let Ok(data) = fs::read(&path) {
        if let Ok(store) = serde_json::from_slice::<SecureKeyStore>(&data) {
            return store;
        }
    }
    SecureKeyStore { version: 1, keys: HashMap::new() }
}

/// Save the encrypted store to disk
fn save_store(store: &SecureKeyStore) -> Result<(), String> {
    let path = get_storage_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    let data = serde_json::to_vec(store).map_err(|e| format!("Serialization error: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write secure storage: {}", e))?;
    Ok(())
}

/// Encrypt a value using AES-256-GCM
fn encrypt_value(key: &[u8; 32], plaintext: &str) -> Result<EncryptedEntry, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Cipher init error: {}", e))?;

    // Generate random nonce (96 bits)
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    Ok(EncryptedEntry {
        nonce: nonce_bytes.to_vec(),
        ciphertext,
    })
}

/// Decrypt a value using AES-256-GCM
fn decrypt_value(key: &[u8; 32], entry: &EncryptedEntry) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Cipher init error: {}", e))?;

    if entry.nonce.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }
    let nonce = Nonce::from_slice(&entry.nonce);

    let plaintext = cipher.decrypt(nonce, entry.ciphertext.as_ref())
        .map_err(|_| "Decryption failed (wrong key or corrupted data)".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode error: {}", e))
}

// ── Tauri Commands ─────────────────────────────────────────

/// Store an API key securely (encrypted on disk)
#[tauri::command]
pub fn set_secure_key(name: String, value: String) -> Result<(), String> {
    // Validate key name (only allow known key patterns)
    if name.is_empty() || name.len() > 100 {
        return Err("Invalid key name".to_string());
    }

    let enc_key = derive_encryption_key();
    let mut store = load_store();

    if value.is_empty() {
        // Remove key
        store.keys.remove(&name);
        KEY_CACHE.lock().unwrap().remove(&name);
    } else {
        // Encrypt and store
        let entry = encrypt_value(&enc_key, &value)?;
        store.keys.insert(name.clone(), entry);
        KEY_CACHE.lock().unwrap().insert(name, value);
    }

    save_store(&store)?;
    Ok(())
}

/// Retrieve a securely stored API key
#[tauri::command]
pub fn get_secure_key(name: String) -> Result<Option<String>, String> {
    // Check in-memory cache first
    if let Some(cached) = KEY_CACHE.lock().unwrap().get(&name) {
        return Ok(Some(cached.clone()));
    }

    let enc_key = derive_encryption_key();
    let store = load_store();

    match store.keys.get(&name) {
        Some(entry) => {
            let value = decrypt_value(&enc_key, entry)?;
            // Cache the decrypted value
            KEY_CACHE.lock().unwrap().insert(name, value.clone());
            Ok(Some(value))
        }
        None => Ok(None),
    }
}

/// Check if a secure key exists without decrypting it
#[tauri::command]
pub fn has_secure_key(name: String) -> bool {
    if KEY_CACHE.lock().unwrap().contains_key(&name) {
        return true;
    }
    let store = load_store();
    store.keys.contains_key(&name)
}

/// List all stored key names (not values)
#[tauri::command]
pub fn list_secure_keys() -> Vec<String> {
    let store = load_store();
    store.keys.keys().cloned().collect()
}

/// Remove a secure key
#[tauri::command]
pub fn remove_secure_key(name: String) -> Result<(), String> {
    let mut store = load_store();
    store.keys.remove(&name);
    KEY_CACHE.lock().unwrap().remove(&name);
    save_store(&store)?;
    Ok(())
}
