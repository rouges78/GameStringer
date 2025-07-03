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

// Struct for the game-details result
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameDetails {
    pub name: String,
    pub supported_languages: String,
}
