use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::notifications::errors::NotificationError;

/// Notifica completa con tutti i dati
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    /// ID univoco della notifica
    pub id: String,
    /// ID del profilo proprietario
    pub profile_id: String,
    /// Tipo di notifica
    pub notification_type: NotificationType,
    /// Titolo della notifica
    pub title: String,
    /// Messaggio della notifica
    pub message: String,
    /// Icona opzionale
    pub icon: Option<String>,
    /// URL azione opzionale
    pub action_url: Option<String>,
    /// Priorità della notifica
    pub priority: NotificationPriority,
    /// Data di creazione
    pub created_at: DateTime<Utc>,
    /// Data di lettura (se letta)
    pub read_at: Option<DateTime<Utc>>,
    /// Data di scadenza (se presente)
    pub expires_at: Option<DateTime<Utc>>,
    /// Metadati aggiuntivi
    pub metadata: NotificationMetadata,
}

/// Tipo di notifica
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum NotificationType {
    System,
    Profile,
    Security,
    Update,
    Game,
    Store,
    Custom,
}

/// Priorità della notifica
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Urgent,
}

/// Metadati della notifica
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationMetadata {
    /// Sorgente della notifica
    pub source: String,
    /// Categoria della notifica
    pub category: String,
    /// Tag associati
    pub tags: Vec<String>,
    /// Dati personalizzati
    pub custom_data: Option<HashMap<String, serde_json::Value>>,
}

/// Richiesta per creare una nuova notifica
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNotificationRequest {
    /// ID del profilo destinatario
    pub profile_id: String,
    /// Tipo di notifica
    pub notification_type: NotificationType,
    /// Titolo della notifica
    pub title: String,
    /// Messaggio della notifica
    pub message: String,
    /// Icona opzionale
    pub icon: Option<String>,
    /// URL azione opzionale
    pub action_url: Option<String>,
    /// Priorità della notifica
    pub priority: Option<NotificationPriority>,
    /// Data di scadenza opzionale
    pub expires_at: Option<DateTime<Utc>>,
    /// Metadati opzionali
    pub metadata: Option<NotificationMetadata>,
}

/// Filtro per le notifiche
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationFilter {
    /// Filtra per tipo di notifica
    pub notification_type: Option<NotificationType>,
    /// Filtra per priorità
    pub priority: Option<NotificationPriority>,
    /// Filtra solo non lette
    pub unread_only: Option<bool>,
    /// Filtra per categoria
    pub category: Option<String>,
    /// Limite risultati
    pub limit: Option<u32>,
    /// Offset per paginazione
    pub offset: Option<u32>,
}

/// Preferenze notifiche per profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    /// ID del profilo
    pub profile_id: String,
    /// Notifiche globalmente abilitate
    pub global_enabled: bool,
    /// Suoni abilitati
    pub sound_enabled: bool,
    /// Notifiche desktop abilitate
    pub desktop_enabled: bool,
    /// Impostazioni per tipo
    pub type_settings: HashMap<NotificationType, TypePreference>,
    /// Ore di silenzio
    pub quiet_hours: Option<QuietHoursSettings>,
    /// Numero massimo notifiche
    pub max_notifications: u32,
    /// Giorni dopo cui eliminare automaticamente
    pub auto_delete_after_days: u32,
    /// Data ultimo aggiornamento
    pub updated_at: DateTime<Utc>,
}

/// Preferenze per tipo di notifica
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypePreference {
    /// Tipo abilitato
    pub enabled: bool,
    /// Priorità minima
    pub priority: NotificationPriority,
    /// Mostra toast
    pub show_toast: bool,
    /// Riproduci suono
    pub play_sound: bool,
    /// Persisti nel centro notifiche
    pub persist_in_center: bool,
}

/// Impostazioni ore di silenzio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuietHoursSettings {
    /// Ore di silenzio abilitate
    pub enabled: bool,
    /// Ora di inizio (formato HH:MM)
    pub start_time: String,
    /// Ora di fine (formato HH:MM)
    pub end_time: String,
    /// Permetti notifiche urgenti
    pub allow_urgent: bool,
}

/// Implementazioni di default
impl Default for NotificationPriority {
    fn default() -> Self {
        NotificationPriority::Normal
    }
}

impl Default for NotificationMetadata {
    fn default() -> Self {
        Self {
            source: "system".to_string(),
            category: "general".to_string(),
            tags: Vec::new(),
            custom_data: None,
        }
    }
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        let mut type_settings = HashMap::new();
        
        // Impostazioni predefinite per ogni tipo
        type_settings.insert(NotificationType::System, TypePreference {
            enabled: true,
            priority: NotificationPriority::Normal,
            show_toast: true,
            play_sound: true,
            persist_in_center: true,
        });
        
        type_settings.insert(NotificationType::Profile, TypePreference {
            enabled: true,
            priority: NotificationPriority::Normal,
            show_toast: true,
            play_sound: false,
            persist_in_center: true,
        });
        
        type_settings.insert(NotificationType::Security, TypePreference {
            enabled: true,
            priority: NotificationPriority::High,
            show_toast: true,
            play_sound: true,
            persist_in_center: true,
        });
        
        type_settings.insert(NotificationType::Update, TypePreference {
            enabled: true,
            priority: NotificationPriority::Normal,
            show_toast: true,
            play_sound: false,
            persist_in_center: true,
        });
        
        type_settings.insert(NotificationType::Game, TypePreference {
            enabled: true,
            priority: NotificationPriority::Low,
            show_toast: false,
            play_sound: false,
            persist_in_center: true,
        });
        
        type_settings.insert(NotificationType::Store, TypePreference {
            enabled: true,
            priority: NotificationPriority::Low,
            show_toast: false,
            play_sound: false,
            persist_in_center: true,
        });
        
        type_settings.insert(NotificationType::Custom, TypePreference {
            enabled: true,
            priority: NotificationPriority::Normal,
            show_toast: true,
            play_sound: false,
            persist_in_center: true,
        });

        Self {
            profile_id: String::new(),
            global_enabled: true,
            sound_enabled: true,
            desktop_enabled: true,
            type_settings,
            quiet_hours: None,
            max_notifications: 50,
            auto_delete_after_days: 30,
            updated_at: Utc::now(),
        }
    }
}

impl Default for TypePreference {
    fn default() -> Self {
        Self {
            enabled: true,
            priority: NotificationPriority::Normal,
            show_toast: true,
            play_sound: false,
            persist_in_center: true,
        }
    }
}

/// Implementazioni per Notification
impl Notification {
    /// Crea una nuova notifica
    pub fn new(request: CreateNotificationRequest) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            profile_id: request.profile_id,
            notification_type: request.notification_type,
            title: request.title,
            message: request.message,
            icon: request.icon,
            action_url: request.action_url,
            priority: request.priority.unwrap_or_default(),
            created_at: Utc::now(),
            read_at: None,
            expires_at: request.expires_at,
            metadata: request.metadata.unwrap_or_default(),
        }
    }
    
    /// Marca la notifica come letta
    pub fn mark_as_read(&mut self) {
        if self.read_at.is_none() {
            self.read_at = Some(Utc::now());
        }
    }
    
    /// Verifica se la notifica è letta
    pub fn is_read(&self) -> bool {
        self.read_at.is_some()
    }
    
    /// Verifica se la notifica è scaduta
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }
    
    /// Verifica se la notifica appartiene al profilo specificato
    pub fn belongs_to_profile(&self, profile_id: &str) -> bool {
        self.profile_id == profile_id
    }
}

/// Conversioni per i tipi enum
impl std::fmt::Display for NotificationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            NotificationType::System => "system",
            NotificationType::Profile => "profile",
            NotificationType::Security => "security",
            NotificationType::Update => "update",
            NotificationType::Game => "game",
            NotificationType::Store => "store",
            NotificationType::Custom => "custom",
        };
        write!(f, "{}", s)
    }
}

impl std::str::FromStr for NotificationType {
    type Err = NotificationError;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "system" => Ok(NotificationType::System),
            "profile" => Ok(NotificationType::Profile),
            "security" => Ok(NotificationType::Security),
            "update" => Ok(NotificationType::Update),
            "game" => Ok(NotificationType::Game),
            "store" => Ok(NotificationType::Store),
            "custom" => Ok(NotificationType::Custom),
            _ => Err(NotificationError::InvalidNotificationType(s.to_string())),
        }
    }
}

impl std::fmt::Display for NotificationPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            NotificationPriority::Low => "low",
            NotificationPriority::Normal => "normal",
            NotificationPriority::High => "high",
            NotificationPriority::Urgent => "urgent",
        };
        write!(f, "{}", s)
    }
}

impl std::str::FromStr for NotificationPriority {
    type Err = NotificationError;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "low" => Ok(NotificationPriority::Low),
            "normal" => Ok(NotificationPriority::Normal),
            "high" => Ok(NotificationPriority::High),
            "urgent" => Ok(NotificationPriority::Urgent),
            _ => Err(NotificationError::InvalidPriority(s.to_string())),
        }
    }
}

/// Validazione per CreateNotificationRequest
impl CreateNotificationRequest {
    /// Valida la richiesta di creazione notifica
    pub fn validate(&self) -> Result<(), NotificationError> {
        // Valida titolo
        if self.title.trim().is_empty() {
            return Err(NotificationError::InvalidContent("Titolo notifica vuoto".to_string()));
        }
        
        if self.title.len() > 200 {
            return Err(NotificationError::InvalidContent("Titolo troppo lungo (max 200 caratteri)".to_string()));
        }
        
        // Valida messaggio
        if self.message.trim().is_empty() {
            return Err(NotificationError::InvalidContent("Messaggio notifica vuoto".to_string()));
        }
        
        if self.message.len() > 1000 {
            return Err(NotificationError::InvalidContent("Messaggio troppo lungo (max 1000 caratteri)".to_string()));
        }
        
        // Valida profile_id
        if self.profile_id.trim().is_empty() {
            return Err(NotificationError::InvalidContent("Profile ID vuoto".to_string()));
        }
        
        // Valida URL azione se presente
        if let Some(ref action_url) = self.action_url {
            if action_url.len() > 500 {
                return Err(NotificationError::InvalidContent("URL azione troppo lungo (max 500 caratteri)".to_string()));
            }
        }
        
        // Valida data scadenza se presente
        if let Some(expires_at) = self.expires_at {
            if expires_at <= Utc::now() {
                return Err(NotificationError::InvalidContent("Data scadenza deve essere nel futuro".to_string()));
            }
        }
        
        Ok(())
    }
}

/// Statistiche delle notifiche per un profilo
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotificationStats {
    /// Numero totale di notifiche
    pub total_notifications: u32,
    /// Numero di notifiche non lette
    pub unread_notifications: u32,
    /// Numero di notifiche scadute
    pub expired_notifications: u32,
    /// Data della notifica più vecchia
    pub oldest_notification: Option<DateTime<Utc>>,
    /// Data della notifica più recente
    pub newest_notification: Option<DateTime<Utc>>,
}

/// Conteggi dettagliati delle notifiche
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotificationCounts {
    /// Numero totale di notifiche
    pub total: u32,
    /// Numero di notifiche non lette
    pub unread: u32,
    /// Numero di notifiche urgenti non lette
    pub urgent_unread: u32,
    /// Numero di notifiche ad alta priorità non lette
    pub high_priority_unread: u32,
    /// Numero di notifiche scadute
    pub expired: u32,
}

/// Opzioni di ordinamento per le notifiche
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationSortBy {
    /// Ordina per data di creazione
    CreatedAt,
    /// Ordina per priorità
    Priority,
    /// Ordina per tipo
    Type,
    /// Ordina per stato di lettura
    ReadStatus,
}

/// Aggiornamenti parziali per le preferenze notifiche
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PartialNotificationPreferences {
    /// Notifiche globalmente abilitate
    pub global_enabled: Option<bool>,
    /// Suoni abilitati
    pub sound_enabled: Option<bool>,
    /// Notifiche desktop abilitate
    pub desktop_enabled: Option<bool>,
    /// Impostazioni per tipo (solo i tipi da aggiornare)
    pub type_settings: Option<HashMap<NotificationType, TypePreference>>,
    /// Ore di silenzio
    pub quiet_hours: Option<QuietHoursSettings>,
    /// Numero massimo notifiche
    pub max_notifications: Option<u32>,
    /// Giorni dopo cui eliminare automaticamente
    pub auto_delete_after_days: Option<u32>,
}

// ===== SYSTEM NOTIFICATION MODELS =====

/// Statistiche delle notifiche di sistema
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SystemNotificationStats {
    /// Numero totale di notifiche di sistema attive
    pub total_active: u32,
    /// Numero di notifiche urgenti attive
    pub urgent_active: u32,
    /// Numero di notifiche ad alta priorità attive
    pub high_priority_active: u32,
    /// Numero totale di profili che hanno ricevuto notifiche di sistema
    pub total_profiles_reached: u32,
    /// Numero medio di notifiche per profilo
    pub average_notifications_per_profile: f64,
    /// Data della notifica di sistema più vecchia
    pub oldest_system_notification: Option<DateTime<Utc>>,
    /// Data della notifica di sistema più recente
    pub newest_system_notification: Option<DateTime<Utc>>,
    /// Numero di notifiche di sistema scadute nell'ultima settimana
    pub expired_last_week: u32,
}

/// Stato di lettura di una notifica di sistema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemNotificationReadStatus {
    /// ID della notifica
    pub notification_id: String,
    /// Titolo della notifica
    pub title: String,
    /// Data di creazione
    pub created_at: DateTime<Utc>,
    /// Numero totale di profili che hanno ricevuto la notifica
    pub total_recipients: u32,
    /// Numero di profili che hanno letto la notifica
    pub read_count: u32,
    /// Percentuale di lettura
    pub read_percentage: f64,
    /// Lista dei profili che hanno letto (con timestamp)
    pub read_by_profiles: Vec<ProfileReadInfo>,
    /// Lista dei profili che non hanno ancora letto
    pub unread_by_profiles: Vec<String>,
}

/// Informazioni di lettura per profilo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileReadInfo {
    /// ID del profilo
    pub profile_id: String,
    /// Nome del profilo (se disponibile)
    pub profile_name: Option<String>,
    /// Data di lettura
    pub read_at: DateTime<Utc>,
}

/// Riassunto profilo per amministrazione notifiche
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileNotificationSummary {
    /// ID del profilo
    pub profile_id: String,
    /// Nome del profilo (se disponibile)
    pub profile_name: Option<String>,
    /// Numero totale di notifiche
    pub total_notifications: u32,
    /// Numero di notifiche non lette
    pub unread_notifications: u32,
    /// Numero di notifiche di sistema non lette
    pub unread_system_notifications: u32,
    /// Data ultimo accesso
    pub last_seen: Option<DateTime<Utc>>,
    /// Preferenze notifiche abilitate
    pub notifications_enabled: bool,
    /// Notifiche di sistema abilitate
    pub system_notifications_enabled: bool,
}