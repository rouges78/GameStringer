use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::timeout;
use log::{info, warn, error};

// Re-export della struct Game dalla crate howlongtobeat
pub use howlongtobeat::Game as HLTBGame;

/// Informazioni sui tempi di gioco arricchite per GameStringer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTimeInfo {
    pub game_title: String,
    pub hltb_title: String,
    pub image_url: String,
    pub main_story: String,
    pub main_extra: String,
    pub completionist: String,
    pub main_story_hours: f32,
    pub main_extra_hours: f32,
    pub completionist_hours: f32,
    pub similarity_score: f32,
    pub cached_at: u64,
}

/// Risultato della ricerca HowLongToBeat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HLTBSearchResult {
    pub query: String,
    pub games_found: Vec<GameTimeInfo>,
    pub best_match: Option<GameTimeInfo>,
    pub search_duration_ms: u64,
    pub cached: bool,
}

/// Statistiche aggregate HowLongToBeat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HLTBStatistics {
    pub total_searches: u32,
    pub cached_searches: u32,
    pub successful_searches: u32,
    pub average_search_time_ms: f64,
    pub cache_hit_rate: f64,
    pub total_games_in_cache: u32,
    pub longest_game_title: String,
    pub longest_game_hours: f32,
    pub shortest_game_title: String,
    pub shortest_game_hours: f32,
}

/// Cache entry per i risultati HowLongToBeat
#[derive(Debug, Clone)]
struct CacheEntry {
    pub result: HLTBSearchResult,
    pub timestamp: u64,
}

/// Manager per le statistiche HowLongToBeat
pub struct HLTBManager {
    cache: Mutex<HashMap<String, CacheEntry>>,
    stats: Mutex<HLTBStatistics>,
    cache_duration: Duration,
}

impl Default for HLTBManager {
    fn default() -> Self {
        Self::new()
    }
}

impl HLTBManager {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
            stats: Mutex::new(HLTBStatistics {
                total_searches: 0,
                cached_searches: 0,
                successful_searches: 0,
                average_search_time_ms: 0.0,
                cache_hit_rate: 0.0,
                total_games_in_cache: 0,
                longest_game_title: String::new(),
                longest_game_hours: 0.0,
                shortest_game_title: String::new(),
                shortest_game_hours: f32::MAX,
            }),
            cache_duration: Duration::from_secs(24 * 60 * 60), // 24 ore
        }
    }

    /// Cerca un gioco su HowLongToBeat con cache
    pub async fn search_game(&self, game_title: &str) -> Result<HLTBSearchResult, String> {
        let start_time = SystemTime::now();
        let normalized_title = self.normalize_game_title(game_title);
        
        // Controlla cache
        if let Some(cached_result) = self.get_from_cache(&normalized_title) {
            self.update_stats(true, 0);
            return Ok(cached_result);
        }

        info!("🔍 Ricerca HowLongToBeat per: {}", game_title);

        // Ricerca con timeout
        let search_result = match timeout(Duration::from_secs(10), howlongtobeat::search(normalized_title.clone())).await {
            Ok(Ok(games)) => games,
            Ok(Err(e)) => {
                error!("❌ Errore ricerca HowLongToBeat: {:?}", e);
                return Err(format!("Errore ricerca HowLongToBeat: {:?}", e));
            }
            Err(_) => {
                warn!("⏱️ Timeout ricerca HowLongToBeat per: {}", game_title);
                return Err("Timeout ricerca HowLongToBeat".to_string());
            }
        };

        let search_duration = start_time.elapsed().unwrap_or_default().as_millis() as u64;

        // Converti risultati
        let mut game_infos: Vec<GameTimeInfo> = search_result
            .into_iter()
            .map(|game| self.convert_hltb_game(game, game_title))
            .collect();

        // Ordina per similarità
        game_infos.sort_by(|a, b| b.similarity_score.partial_cmp(&a.similarity_score).unwrap_or(std::cmp::Ordering::Equal));

        let best_match = game_infos.first().cloned();

        let result = HLTBSearchResult {
            query: game_title.to_string(),
            games_found: game_infos,
            best_match,
            search_duration_ms: search_duration,
            cached: false,
        };

        // Salva in cache
        self.save_to_cache(normalized_title, result.clone());
        self.update_stats(false, search_duration);

        info!("✅ Trovati {} risultati per: {}", result.games_found.len(), game_title);
        Ok(result)
    }

    /// Ottieni statistiche HowLongToBeat
    pub fn get_statistics(&self) -> HLTBStatistics {
        let stats = self.stats.lock().unwrap();
        stats.clone()
    }

    /// Pulisci cache scaduta
    pub fn cleanup_cache(&self) {
        let mut cache = self.cache.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        let initial_size = cache.len();
        cache.retain(|_, entry| now - entry.timestamp < self.cache_duration.as_secs());
        let removed = initial_size - cache.len();
        
        if removed > 0 {
            info!("🧹 Rimossi {} elementi scaduti dalla cache HLTB", removed);
        }
    }

    /// Normalizza il titolo del gioco per la ricerca
    fn normalize_game_title(&self, title: &str) -> String {
        title
            .to_lowercase()
            .replace("™", "")
            .replace("®", "")
            .replace("©", "")
            .replace(":", "")
            .replace("-", " ")
            .replace("_", " ")
            .replace("  ", " ")
            .trim()
            .to_string()
    }

    /// Calcola similarità tra titoli
    fn calculate_similarity(&self, title1: &str, title2: &str) -> f32 {
        let t1 = self.normalize_game_title(title1);
        let t2 = self.normalize_game_title(title2);
        
        if t1 == t2 {
            return 1.0;
        }
        
        if t1.contains(&t2) || t2.contains(&t1) {
            return 0.8;
        }
        
        // Calcolo similarità basato su parole comuni
        let words1: Vec<&str> = t1.split_whitespace().collect();
        let words2: Vec<&str> = t2.split_whitespace().collect();
        
        let common_words = words1.iter()
            .filter(|word| words2.contains(word))
            .count();
        
        let total_words = (words1.len() + words2.len()) as f32;
        if total_words > 0.0 {
            (common_words as f32 * 2.0) / total_words
        } else {
            0.0
        }
    }

    /// Converte un HLTBGame in GameTimeInfo
    fn convert_hltb_game(&self, game: HLTBGame, original_title: &str) -> GameTimeInfo {
        let similarity = self.calculate_similarity(original_title, &game.title);
        
        GameTimeInfo {
            game_title: original_title.to_string(),
            hltb_title: game.title,
            image_url: game.image,
            main_story: game.main.clone(),
            main_extra: game.extra.clone(),
            completionist: game.completionist.clone(),
            main_story_hours: self.parse_time_to_hours(&game.main),
            main_extra_hours: self.parse_time_to_hours(&game.extra),
            completionist_hours: self.parse_time_to_hours(&game.completionist),
            similarity_score: similarity,
            cached_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    /// Converte stringa tempo (es. "52h 39m") in ore decimali
    fn parse_time_to_hours(&self, time_str: &str) -> f32 {
        let mut hours = 0.0;
        let mut minutes = 0.0;
        
        // Estrai ore
        if let Some(h_pos) = time_str.find('h') {
            if let Ok(h) = time_str[..h_pos].trim().parse::<f32>() {
                hours = h;
            }
        }
        
        // Estrai minuti
        if let Some(m_pos) = time_str.find('m') {
            let start = if let Some(h_pos) = time_str.find('h') {
                h_pos + 1
            } else {
                0
            };
            if let Ok(m) = time_str[start..m_pos].trim().parse::<f32>() {
                minutes = m;
            }
        }
        
        hours + (minutes / 60.0)
    }

    /// Ottieni risultato dalla cache
    fn get_from_cache(&self, normalized_title: &str) -> Option<HLTBSearchResult> {
        let cache = self.cache.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        if let Some(entry) = cache.get(normalized_title) {
            if now - entry.timestamp < self.cache_duration.as_secs() {
                let mut result = entry.result.clone();
                result.cached = true;
                return Some(result);
            }
        }
        None
    }

    /// Salva risultato in cache
    fn save_to_cache(&self, normalized_title: String, result: HLTBSearchResult) {
        let mut cache = self.cache.lock().unwrap();
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        cache.insert(normalized_title, CacheEntry {
            result,
            timestamp,
        });
    }

    /// Aggiorna statistiche
    fn update_stats(&self, from_cache: bool, search_duration_ms: u64) {
        let mut stats = self.stats.lock().unwrap();
        
        stats.total_searches += 1;
        if from_cache {
            stats.cached_searches += 1;
        } else {
            stats.successful_searches += 1;
            
            // Aggiorna tempo medio di ricerca
            let total_time = stats.average_search_time_ms * (stats.successful_searches - 1) as f64;
            stats.average_search_time_ms = (total_time + search_duration_ms as f64) / stats.successful_searches as f64;
        }
        
        stats.cache_hit_rate = (stats.cached_searches as f64 / stats.total_searches as f64) * 100.0;
        
        let cache = self.cache.lock().unwrap();
        stats.total_games_in_cache = cache.len() as u32;
        
        // Aggiorna gioco più lungo/corto
        for entry in cache.values() {
            if let Some(best_match) = &entry.result.best_match {
                if best_match.main_story_hours > stats.longest_game_hours {
                    stats.longest_game_hours = best_match.main_story_hours;
                    stats.longest_game_title = best_match.hltb_title.clone();
                }
                if best_match.main_story_hours > 0.0 && best_match.main_story_hours < stats.shortest_game_hours {
                    stats.shortest_game_hours = best_match.main_story_hours;
                    stats.shortest_game_title = best_match.hltb_title.clone();
                }
            }
        }
    }
}

// Istanza globale del manager
use once_cell::sync::Lazy;
static HLTB_MANAGER: Lazy<HLTBManager> = Lazy::new(HLTBManager::new);

/// Comandi Tauri per HowLongToBeat

/// Cerca un gioco su HowLongToBeat
#[tauri::command]
pub async fn search_game_hltb(game_title: String) -> Result<HLTBSearchResult, String> {
    HLTB_MANAGER.search_game(&game_title).await
}

/// Ottieni statistiche HowLongToBeat
#[tauri::command]
pub fn get_hltb_statistics() -> HLTBStatistics {
    HLTB_MANAGER.get_statistics()
}

/// Pulisci cache HowLongToBeat
#[tauri::command]
pub fn cleanup_hltb_cache() -> String {
    HLTB_MANAGER.cleanup_cache();
    "Cache HowLongToBeat pulita con successo".to_string()
}

/// Ricerca batch di giochi (per scansione libreria)
#[tauri::command]
pub async fn search_games_batch_hltb(game_titles: Vec<String>) -> Result<Vec<HLTBSearchResult>, String> {
    let mut results = Vec::new();
    
    for title in game_titles {
        match HLTB_MANAGER.search_game(&title).await {
            Ok(result) => results.push(result),
            Err(e) => {
                warn!("❌ Errore ricerca batch per {}: {}", title, e);
                // Continua con gli altri giochi anche se uno fallisce
            }
        }
        
        // Piccola pausa per evitare rate limiting
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    Ok(results)
}
