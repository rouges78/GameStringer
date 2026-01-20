use serde::{Serialize, Deserialize};

// A comprehensive struct for a Steam game, combining all data sources.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SteamGame {
    pub appid: u32,
    pub name: String,
    #[serde(default)]
    pub playtime_forever: u32,
    #[serde(default)]
    pub img_icon_url: String,
    #[serde(default)]
    pub img_logo_url: String,
    #[serde(default)]
    pub last_played: u64, // as timestamp
    pub is_installed: bool,
    pub is_shared: bool,
    pub is_vr: bool,
    pub engine: String,
    #[serde(default)]
    pub genres: Vec<SteamApiGenre>,
    #[serde(default)]
    pub categories: Vec<SteamApiCategory>,
    #[serde(default)]
    pub short_description: String,
    #[serde(default)]
    pub is_free: bool,
    #[serde(default)]
    pub header_image: String,
    #[serde(default)]
    pub library_capsule: String,
    #[serde(default)]
    pub developers: Vec<String>,
    #[serde(default)]
    pub publishers: Vec<String>,
    #[serde(default)]
    pub release_date: SteamApiReleaseDate,
    #[serde(default)]
    pub supported_languages: String,
    #[serde(default)]
    pub pc_requirements: SteamApiRequirements,
    #[serde(default)]
    pub dlc: Vec<u32>,
    #[serde(default)]
    pub how_long_to_beat: Option<HowLongToBeatData>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SteamApiGenre {
    pub id: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SteamApiCategory {
    pub id: u32,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SteamApiReleaseDate {
    pub coming_soon: bool,
    pub date: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SteamApiRequirements {
    pub minimum: String,
    #[serde(default)]
    pub recommended: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HowLongToBeatData {
    pub main: u32,
    #[serde(rename = "mainExtra")]
    pub main_extra: u32,
    pub completionist: u32,
}

// Struct for the auto-detect-config result
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SteamConfig {
    pub steam_path: Option<String>,
    pub logged_in_users: Vec<String>,
}

// Struct for Family Sharing data
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SharedGame {
    pub appid: u32,
    pub name: String,
    pub owner_steam_id: String,
    pub owner_account_name: String,
    pub is_shared: bool,
}

// Struct for Family Sharing configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FamilySharingConfig {
    pub shared_games: Vec<SharedGame>,
    pub total_shared_games: u32,
    pub authorized_users: Vec<String>,
}

// Struct for the game-details result
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameDetails {
    pub name: String,
    pub supported_languages: String,
}

// Struct for game info (used by games API)
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct GameInfo {
    pub id: String,
    pub title: String,
    pub platform: String,
    pub install_path: Option<String>,
    pub executable_path: Option<String>,
    pub icon: Option<String>,
    pub image_url: Option<String>,
    pub header_image: Option<String>,  // URL dell'immagine di copertina
    pub is_installed: bool,
    pub steam_app_id: Option<u32>,
    pub is_vr: bool,
    pub engine: Option<String>,
    pub last_played: Option<u64>,
    pub is_shared: bool,
    pub supported_languages: Option<Vec<String>>, // Lingue supportate dal gioco
    pub genres: Option<Vec<String>>, // Generi del gioco
    pub added_date: Option<u64>, // Data di aggiunta alla libreria (timestamp)
}

// Struct for game scan results
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameScanResult {
    pub title: String,
    pub path: String,
    pub executable_path: Option<String>,
    pub app_id: Option<String>,
    pub source: String, // "Steam", "Epic", "GOG", etc.
    pub is_installed: bool,
    // Campi aggiunti per compatibilità con il codice esistente
    pub id: String,
    pub platform: String,
    pub header_image: Option<String>,
    pub is_vr: bool,
    pub engine: Option<String>,
    pub supported_languages: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub last_played: Option<u64>,
}

// Strutture per la lettura avanzata di Steam
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum GameStatus {
    Installed { path: String },
    Owned,
    Shared { from_steam_id: String },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalGameInfo {
    pub appid: u32,
    pub name: String,
    pub status: GameStatus,
    pub install_dir: Option<String>,
    pub last_updated: Option<u64>,
    pub size_on_disk: Option<u64>,
    pub buildid: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SteamLibraryFolder {
    pub path: String,
    pub label: String,
    pub mounted: bool,
    pub tool: String,
}
