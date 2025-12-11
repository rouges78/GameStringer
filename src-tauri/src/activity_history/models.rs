//! Activity History Models
//! 
//! Definisce i tipi di attività e le strutture dati.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Tipo di attività
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityType {
    /// Traduzione completata
    Translation,
    /// Patch creata
    Patch,
    /// Sincronizzazione Steam
    SteamSync,
    /// Gioco aggiunto alla libreria
    GameAdded,
    /// Gioco avviato
    GameLaunched,
    /// Profilo creato
    ProfileCreated,
    /// Impostazioni modificate
    SettingsChanged,
    /// Import/Export
    ImportExport,
    /// Translation Bridge
    TranslationBridge,
    /// Altro
    Other,
}

impl ActivityType {
    pub fn icon(&self) -> &'static str {
        match self {
            ActivityType::Translation => "🌐",
            ActivityType::Patch => "🔧",
            ActivityType::SteamSync => "♻️",
            ActivityType::GameAdded => "➕",
            ActivityType::GameLaunched => "🎮",
            ActivityType::ProfileCreated => "👤",
            ActivityType::SettingsChanged => "⚙️",
            ActivityType::ImportExport => "📦",
            ActivityType::TranslationBridge => "🌉",
            ActivityType::Other => "📝",
        }
    }

    pub fn color(&self) -> &'static str {
        match self {
            ActivityType::Translation => "purple",
            ActivityType::Patch => "orange",
            ActivityType::SteamSync => "green",
            ActivityType::GameAdded => "blue",
            ActivityType::GameLaunched => "cyan",
            ActivityType::ProfileCreated => "pink",
            ActivityType::SettingsChanged => "gray",
            ActivityType::ImportExport => "yellow",
            ActivityType::TranslationBridge => "indigo",
            ActivityType::Other => "slate",
        }
    }
}

/// Singola attività nello storico
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    /// ID univoco
    pub id: String,
    /// Tipo di attività
    pub activity_type: ActivityType,
    /// Titolo breve
    pub title: String,
    /// Descrizione dettagliata (opzionale)
    pub description: Option<String>,
    /// Nome del gioco associato (se applicabile)
    pub game_name: Option<String>,
    /// ID del gioco associato (se applicabile)
    pub game_id: Option<String>,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Metadati aggiuntivi (JSON)
    pub metadata: Option<serde_json::Value>,
}

impl Activity {
    /// Crea una nuova attività
    pub fn new(activity_type: ActivityType, title: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            activity_type,
            title: title.into(),
            description: None,
            game_name: None,
            game_id: None,
            timestamp: Utc::now(),
            metadata: None,
        }
    }

    /// Builder: aggiungi descrizione
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// Builder: aggiungi gioco
    pub fn with_game(mut self, game_name: impl Into<String>, game_id: Option<String>) -> Self {
        self.game_name = Some(game_name.into());
        self.game_id = game_id;
        self
    }

    /// Builder: aggiungi metadata
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }
}

/// Filtro per le attività
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActivityFilter {
    /// Filtra per tipo
    pub activity_type: Option<ActivityType>,
    /// Filtra per gioco
    pub game_id: Option<String>,
    /// Data inizio (inclusa)
    pub from_date: Option<DateTime<Utc>>,
    /// Data fine (inclusa)
    pub to_date: Option<DateTime<Utc>>,
    /// Limite risultati
    pub limit: Option<usize>,
    /// Offset per paginazione
    pub offset: Option<usize>,
}

/// Risposta paginata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityPage {
    /// Attività nella pagina
    pub activities: Vec<Activity>,
    /// Totale attività (senza paginazione)
    pub total: usize,
    /// Pagina corrente (0-indexed)
    pub page: usize,
    /// Dimensione pagina
    pub page_size: usize,
    /// Ci sono altre pagine?
    pub has_more: bool,
}
