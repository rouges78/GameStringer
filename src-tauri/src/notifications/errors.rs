use thiserror::Error;

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error("Notifica non trovata: {0}")]
    NotificationNotFound(String),
    
    #[error("Profilo non autorizzato per questa notifica")]
    UnauthorizedProfile,
    
    #[error("Tipo di notifica non valido: {0}")]
    InvalidNotificationType(String),
    
    #[error("Priorità notifica non valida: {0}")]
    InvalidPriority(String),
    
    #[error("Contenuto notifica non valido: {0}")]
    InvalidContent(String),
    
    #[error("Errore storage: {0}")]
    StorageError(String),
    
    #[error("Errore serializzazione: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Errore database: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    
    #[error("Errore I/O: {0}")]
    IoError(#[from] std::io::Error),
}

pub type NotificationResult<T> = Result<T, NotificationError>;