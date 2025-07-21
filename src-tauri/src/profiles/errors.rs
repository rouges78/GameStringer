use thiserror::Error;

/// Errori specifici per il sistema profili
#[derive(Debug, Error)]
pub enum ProfileError {
    #[error("Profilo non trovato: {0}")]
    ProfileNotFound(String),
    
    #[error("Password errata per il profilo")]
    InvalidPassword,
    
    #[error("Profilo già esistente: {0}")]
    ProfileAlreadyExists(String),
    
    #[error("Nome profilo non valido: {0}")]
    InvalidProfileName(String),
    
    #[error("Password troppo debole: {0}")]
    WeakPassword(String),
    
    #[error("Errore di crittografia: {0}")]
    EncryptionError(String),
    
    #[error("Errore I/O: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Errore serializzazione: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Errore formato dati: {0}")]
    DataFormatError(String),
    
    #[error("Profilo corrotto: {0}")]
    CorruptedProfile(String),
    
    #[error("Operazione non autorizzata")]
    Unauthorized,
    
    #[error("Limite tentativi superato")]
    TooManyAttempts,
}

/// Risultato per operazioni sui profili
pub type ProfileResult<T> = Result<T, ProfileError>;

/// Errori specifici per lo storage
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("File non trovato: {0}")]
    FileNotFound(String),
    
    #[error("Directory non accessibile: {0}")]
    DirectoryError(String),
    
    #[error("Permessi insufficienti: {0}")]
    PermissionDenied(String),
    
    #[error("Spazio insufficiente")]
    InsufficientSpace,
    
    #[error("Errore I/O: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Errore serializzazione: {0}")]
    SerializationError(#[from] serde_json::Error),
}

/// Risultato per operazioni di storage
pub type StorageResult<T> = Result<T, StorageError>;