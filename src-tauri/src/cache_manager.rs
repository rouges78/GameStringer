use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use moka::future::Cache;
use serde::{Serialize, Deserialize};
use tokio::sync::RwLock;
use log::{debug, info, warn, error};
use chrono::{DateTime, Utc};

/// Configurazione per i diversi tipi di cache
#[derive(Clone, Debug)]
pub struct CacheConfig {
    pub max_capacity: u64,
    pub ttl: Duration,
    pub tti: Duration, // Time to idle
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_capacity: 1000,
            ttl: Duration::from_secs(3600), // 1 ora
            tti: Duration::from_secs(1800), // 30 minuti
        }
    }
}

/// Tipi di cache supportati
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum CacheType {
    SteamGames,
    SteamCovers,
    SteamDetails,
    EpicGames,
    EpicCovers,
    GOGGames,
    GOGCovers,
    GameEngines,
    VRDetection,
    HowLongToBeat,
    GameLanguages,
}

/// Metadati per ogni entry nella cache
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CacheMetadata {
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub access_count: u64,
    pub size_bytes: usize,
}

/// Entry della cache con metadati
#[derive(Clone, Debug)]
pub struct CacheEntry<T> {
    pub data: T,
    pub metadata: CacheMetadata,
}

/// Manager centralizzato per tutte le cache
pub struct IntelligentCacheManager {
    caches: HashMap<CacheType, Cache<String, CacheEntry<Vec<u8>>>>,
    configs: HashMap<CacheType, CacheConfig>,
    stats: Arc<RwLock<CacheStats>>,
}

/// Statistiche della cache
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_hits: u64,
    pub total_misses: u64,
    pub total_evictions: u64,
    pub memory_usage_bytes: usize,
    pub cache_efficiency: f64,
}

impl IntelligentCacheManager {
    /// Crea un nuovo manager della cache
    pub fn new() -> Self {
        let mut manager = Self {
            caches: HashMap::new(),
            configs: HashMap::new(),
            stats: Arc::new(RwLock::new(CacheStats::default())),
        };

        // Configurazioni specifiche per ogni tipo di cache
        manager.setup_cache_configs();
        manager.initialize_caches();
        
        manager
    }

    /// Configura le impostazioni specifiche per ogni tipo di cache
    fn setup_cache_configs(&mut self) {
        // Cache per giochi Steam - alta capacità, TTL lungo
        self.configs.insert(CacheType::SteamGames, CacheConfig {
            max_capacity: 2000,
            ttl: Duration::from_secs(7200), // 2 ore
            tti: Duration::from_secs(3600), // 1 ora
        });

        // Cache per copertine - capacità media, TTL molto lungo
        self.configs.insert(CacheType::SteamCovers, CacheConfig {
            max_capacity: 5000,
            ttl: Duration::from_secs(86400), // 24 ore
            tti: Duration::from_secs(43200), // 12 ore
        });

        // Cache per dettagli giochi - capacità media, TTL medio
        self.configs.insert(CacheType::SteamDetails, CacheConfig {
            max_capacity: 1500,
            ttl: Duration::from_secs(3600), // 1 ora
            tti: Duration::from_secs(1800), // 30 minuti
        });

        // Cache per Epic Games - capacità media, TTL medio
        self.configs.insert(CacheType::EpicGames, CacheConfig {
            max_capacity: 1000,
            ttl: Duration::from_secs(3600), // 1 ora
            tti: Duration::from_secs(1800), // 30 minuti
        });

        // Cache per engine detection - alta capacità, TTL molto lungo
        self.configs.insert(CacheType::GameEngines, CacheConfig {
            max_capacity: 3000,
            ttl: Duration::from_secs(604800), // 7 giorni
            tti: Duration::from_secs(86400), // 24 ore
        });

        // Cache per VR detection - alta capacità, TTL molto lungo
        self.configs.insert(CacheType::VRDetection, CacheConfig {
            max_capacity: 2000,
            ttl: Duration::from_secs(604800), // 7 giorni
            tti: Duration::from_secs(86400), // 24 ore
        });

        // Cache per HowLongToBeat - capacità media, TTL lungo
        self.configs.insert(CacheType::HowLongToBeat, CacheConfig {
            max_capacity: 1500,
            ttl: Duration::from_secs(43200), // 12 ore
            tti: Duration::from_secs(21600), // 6 ore
        });

        // Aggiungi configurazioni per altri store
        for cache_type in [CacheType::EpicCovers, CacheType::GOGGames, CacheType::GOGCovers, CacheType::GameLanguages] {
            self.configs.insert(cache_type, CacheConfig::default());
        }
    }

    /// Inizializza tutte le cache
    fn initialize_caches(&mut self) {
        for (cache_type, config) in &self.configs {
            let cache = Cache::builder()
                .max_capacity(config.max_capacity)
                .time_to_live(config.ttl)
                .time_to_idle(config.tti)
                .build();
            
            self.caches.insert(cache_type.clone(), cache);
            info!("Inizializzata cache {:?} con capacità {} e TTL {:?}", cache_type, config.max_capacity, config.ttl);
        }
    }

    /// Ottiene un valore dalla cache
    pub async fn get<T>(&self, cache_type: CacheType, key: &str) -> Option<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        if let Some(cache) = self.caches.get(&cache_type) {
            if let Some(entry) = cache.get(key).await {
                // Aggiorna statistiche
                self.update_stats_hit().await;
                
                // Deserializza i dati
                match bincode::deserialize::<T>(&entry.data) {
                    Ok(data) => {
                        debug!("Cache HIT per {:?}:{}", cache_type, key);
                        return Some(data);
                    }
                    Err(e) => {
                        warn!("Errore deserializzazione cache {:?}:{}: {}", cache_type, key, e);
                        // Rimuovi entry corrotta
                        cache.remove(key).await;
                    }
                }
            }
        }
        
        self.update_stats_miss().await;
        debug!("Cache MISS per {:?}:{}", cache_type, key);
        None
    }

    /// Inserisce un valore nella cache
    pub async fn set<T>(&self, cache_type: CacheType, key: String, value: T) -> Result<(), String>
    where
        T: Serialize,
    {
        if let Some(cache) = self.caches.get(&cache_type) {
            // Serializza i dati
            let serialized = bincode::serialize(&value)
                .map_err(|e| format!("Errore serializzazione: {}", e))?;
            
            let metadata = CacheMetadata {
                created_at: Instant::now(),
                last_accessed: Instant::now(),
                access_count: 1,
                size_bytes: serialized.len(),
            };

            let entry = CacheEntry {
                data: serialized,
                metadata,
            };

            cache.insert(key.clone(), entry).await;
            debug!("Cache SET per {:?}:{}", cache_type, key);
            
            // Aggiorna statistiche memoria
            self.update_memory_stats().await;
            
            return Ok(());
        }
        
        Err(format!("Cache {:?} non trovata", cache_type))
    }

    /// Rimuove un valore dalla cache
    pub async fn remove(&self, cache_type: CacheType, key: &str) {
        if let Some(cache) = self.caches.get(&cache_type) {
            cache.remove(key).await;
            debug!("Cache REMOVE per {:?}:{}", cache_type, key);
        }
    }

    /// Pulisce una cache specifica
    pub async fn clear_cache(&self, cache_type: CacheType) {
        if let Some(cache) = self.caches.get(&cache_type) {
            cache.invalidate_all();
            info!("Cache {:?} pulita", cache_type);
        }
    }

    /// Pulisce tutte le cache
    pub async fn clear_all(&self) {
        for (cache_type, cache) in &self.caches {
            cache.invalidate_all();
            info!("Cache {:?} pulita", cache_type);
        }
        
        // Reset statistiche
        let mut stats = self.stats.write().await;
        *stats = CacheStats::default();
    }

    /// Ottiene statistiche della cache
    pub async fn get_stats(&self) -> CacheStats {
        let stats = self.stats.read().await;
        let mut result = stats.clone();
        
        // Calcola efficienza
        let total_requests = result.total_hits + result.total_misses;
        if total_requests > 0 {
            result.cache_efficiency = (result.total_hits as f64 / total_requests as f64) * 100.0;
        }
        
        result
    }

    /// Ottiene informazioni dettagliate su una cache specifica
    pub async fn get_cache_info(&self, cache_type: CacheType) -> Option<CacheInfo> {
        if let Some(cache) = self.caches.get(&cache_type) {
            let config = self.configs.get(&cache_type)?;
            
            Some(CacheInfo {
                cache_type: cache_type.clone(),
                entry_count: cache.entry_count(),
                max_capacity: config.max_capacity,
                ttl_seconds: config.ttl.as_secs(),
                tti_seconds: config.tti.as_secs(),
            })
        } else {
            None
        }
    }

    /// Aggiorna statistiche per cache hit
    async fn update_stats_hit(&self) {
        let mut stats = self.stats.write().await;
        stats.total_hits += 1;
    }

    /// Aggiorna statistiche per cache miss
    async fn update_stats_miss(&self) {
        let mut stats = self.stats.write().await;
        stats.total_misses += 1;
    }

    /// Aggiorna statistiche memoria
    async fn update_memory_stats(&self) {
        let mut total_memory = 0;
        
        for cache in self.caches.values() {
            // Stima approssimativa della memoria utilizzata
            total_memory += cache.entry_count() * 1024; // Stima 1KB per entry
        }
        
        let mut stats = self.stats.write().await;
        stats.memory_usage_bytes = total_memory as usize;
    }

    /// Ottimizza automaticamente le cache
    pub async fn optimize_caches(&self) {
        info!("Avvio ottimizzazione automatica cache...");
        
        for (cache_type, cache) in &self.caches {
            let entry_count = cache.entry_count();
            let config = self.configs.get(cache_type).unwrap();
            
            // Se la cache è quasi piena, forza una pulizia
            if entry_count as f64 > (config.max_capacity as f64 * 0.9) {
                warn!("Cache {:?} quasi piena ({}/{}), forzando pulizia...", 
                      cache_type, entry_count, config.max_capacity);
                
                // Forza la pulizia di entries scadute
                cache.run_pending_tasks().await;
            }
        }
        
        info!("Ottimizzazione cache completata");
    }
}

/// Informazioni su una cache specifica
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CacheInfo {
    pub cache_type: CacheType,
    pub entry_count: u64,
    pub max_capacity: u64,
    pub ttl_seconds: u64,
    pub tti_seconds: u64,
}

/// Istanza globale del cache manager
use once_cell::sync::Lazy;
pub static CACHE_MANAGER: Lazy<IntelligentCacheManager> = Lazy::new(|| {
    IntelligentCacheManager::new()
});

/// Macro di convenienza per accesso alla cache
#[macro_export]
macro_rules! cache_get {
    ($cache_type:expr, $key:expr) => {
        $crate::cache_manager::CACHE_MANAGER.get($cache_type, $key).await
    };
}

#[macro_export]
macro_rules! cache_set {
    ($cache_type:expr, $key:expr, $value:expr) => {
        $crate::cache_manager::CACHE_MANAGER.set($cache_type, $key, $value).await
    };
}

/// Funzione per ottenere statistiche cache (non esposta come comando Tauri)
pub async fn get_cache_stats_internal() -> Result<CacheStats, String> {
    Ok(CACHE_MANAGER.get_stats().await)
}

#[tauri::command]
pub async fn clear_cache_type(cache_type: String) -> Result<String, String> {
    let cache_type = match cache_type.as_str() {
        "steam_games" => CacheType::SteamGames,
        "steam_covers" => CacheType::SteamCovers,
        "steam_details" => CacheType::SteamDetails,
        "epic_games" => CacheType::EpicGames,
        "epic_covers" => CacheType::EpicCovers,
        "gog_games" => CacheType::GOGGames,
        "gog_covers" => CacheType::GOGCovers,
        "game_engines" => CacheType::GameEngines,
        "vr_detection" => CacheType::VRDetection,
        "howlongtobeat" => CacheType::HowLongToBeat,
        "game_languages" => CacheType::GameLanguages,
        _ => return Err(format!("Tipo cache non riconosciuto: {}", cache_type)),
    };
    
    CACHE_MANAGER.clear_cache(cache_type).await;
    Ok(format!("Cache {} pulita con successo", cache_type))
}

#[tauri::command]
pub async fn clear_all_caches() -> Result<String, String> {
    CACHE_MANAGER.clear_all().await;
    Ok("Tutte le cache sono state pulite con successo".to_string())
}

#[tauri::command]
pub async fn optimize_caches() -> Result<String, String> {
    CACHE_MANAGER.optimize_caches().await;
    Ok("Ottimizzazione cache completata".to_string())
}

#[tauri::command]
pub async fn get_all_cache_info() -> Result<Vec<CacheInfo>, String> {
    let mut cache_infos = Vec::new();
    
    let cache_types = [
        CacheType::SteamGames,
        CacheType::SteamCovers,
        CacheType::SteamDetails,
        CacheType::EpicGames,
        CacheType::EpicCovers,
        CacheType::GOGGames,
        CacheType::GOGCovers,
        CacheType::GameEngines,
        CacheType::VRDetection,
        CacheType::HowLongToBeat,
        CacheType::GameLanguages,
    ];
    
    for cache_type in cache_types {
        if let Some(info) = CACHE_MANAGER.get_cache_info(cache_type).await {
            cache_infos.push(info);
        }
    }
    
    Ok(cache_infos)
}
