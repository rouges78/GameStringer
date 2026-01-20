//! Comandi Tauri per UE AutoTranslator
//! 
//! Gestisce l'injection e la comunicazione con il translator UE.

use tauri::command;
use std::path::Path;
use std::sync::Mutex;
use once_cell::sync::Lazy;

use crate::ue_translator::{
    UETranslatorConfig, UETranslatorState, 
    get_translator_dll_path,
    injector::{inject_translator_dll, find_game_process},
    translation_cache::{TranslationCache, CacheStats},
};

/// Stato globale del translator
static TRANSLATOR_STATE: Lazy<Mutex<UETranslatorState>> = Lazy::new(|| {
    Mutex::new(UETranslatorState::default())
});

/// Cache globale delle traduzioni per gioco corrente
static ACTIVE_CACHE: Lazy<Mutex<Option<TranslationCache>>> = Lazy::new(|| {
    Mutex::new(None)
});

/// Risultato dell'operazione UE Translator
#[derive(serde::Serialize, serde::Deserialize)]
pub struct UETranslatorResult {
    pub success: bool,
    pub message: String,
    pub state: UETranslatorState,
}

/// Avvia il translator per un gioco Unreal
#[command]
pub async fn start_ue_translator(
    game_path: String,
    executable: String,
    config: UETranslatorConfig,
) -> Result<UETranslatorResult, String> {
    log::info!("🚀 Avvio UE AutoTranslator per: {}", game_path);
    
    let game_dir = Path::new(&game_path);
    if !game_dir.exists() {
        return Err("Cartella gioco non trovata".to_string());
    }
    
    // Trova il processo del gioco
    let process_id = find_game_process(&executable)
        .ok_or_else(|| format!("Processo {} non trovato. Avvia prima il gioco.", executable))?;
    
    log::info!("📍 Trovato processo {} con PID {}", executable, process_id);
    
    // Ottieni path della DLL
    let dll_path = get_translator_dll_path()?;
    
    // Verifica se la DLL esiste
    if !dll_path.exists() {
        // Per ora creiamo un placeholder - la DLL vera verrà compilata separatamente
        log::warn!("⚠️ DLL translator non trovata, creazione placeholder...");
        
        // Crea cartella se non esiste
        if let Some(parent) = dll_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Errore creazione cartella: {}", e))?;
        }
        
        // Per ora restituiamo un messaggio che la DLL deve essere compilata
        return Ok(UETranslatorResult {
            success: false,
            message: "La DLL del translator deve ancora essere compilata. Questa è la struttura base.".to_string(),
            state: TRANSLATOR_STATE.lock().unwrap().clone(),
        });
    }
    
    // Inietta la DLL
    let result = inject_translator_dll(process_id, &dll_path)?;
    
    // Aggiorna stato
    {
        let mut state = TRANSLATOR_STATE.lock().unwrap();
        state.is_injected = result.success;
        state.is_translating = config.auto_translate;
    }
    
    // Inizializza cache per questo gioco
    {
        let game_id = Path::new(&executable)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        
        let cache_dir = game_dir.join("GameStringer").join("cache");
        let cache = TranslationCache::load(&cache_dir, &game_id)
            .unwrap_or_else(|_| TranslationCache::new(&game_id));
        
        let mut active = ACTIVE_CACHE.lock().unwrap();
        *active = Some(cache);
    }
    
    // Salva configurazione
    let config_dir = game_dir.join("GameStringer");
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Errore creazione cartella config: {}", e))?;
    
    let config_path = config_dir.join("translator_config.json");
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione config: {}", e))?;
    std::fs::write(&config_path, config_json)
        .map_err(|e| format!("Errore scrittura config: {}", e))?;
    
    Ok(UETranslatorResult {
        success: true,
        message: format!("UE AutoTranslator avviato per {} (PID: {})", executable, process_id),
        state: TRANSLATOR_STATE.lock().unwrap().clone(),
    })
}

/// Ferma il translator
#[command]
pub async fn stop_ue_translator(game_path: String) -> Result<UETranslatorResult, String> {
    log::info!("🛑 Arresto UE AutoTranslator");
    
    // Salva cache prima di fermare
    {
        let cache = ACTIVE_CACHE.lock().unwrap();
        if let Some(ref c) = *cache {
            let cache_dir = Path::new(&game_path).join("GameStringer").join("cache");
            let _ = c.save(&cache_dir);
        }
    }
    
    // Reset stato
    {
        let mut state = TRANSLATOR_STATE.lock().unwrap();
        state.is_injected = false;
        state.is_translating = false;
    }
    
    Ok(UETranslatorResult {
        success: true,
        message: "Translator fermato".to_string(),
        state: TRANSLATOR_STATE.lock().unwrap().clone(),
    })
}

/// Ottiene lo stato corrente del translator
#[command]
pub async fn get_ue_translator_state() -> Result<UETranslatorState, String> {
    Ok(TRANSLATOR_STATE.lock().unwrap().clone())
}

/// Attiva/disattiva traduzione
#[command]
pub async fn toggle_ue_translation() -> Result<UETranslatorState, String> {
    let mut state = TRANSLATOR_STATE.lock().unwrap();
    state.is_translating = !state.is_translating;
    log::info!("🔄 Traduzione: {}", if state.is_translating { "ON" } else { "OFF" });
    Ok(state.clone())
}

/// Ottiene statistiche della cache
#[command]
pub async fn get_ue_cache_stats() -> Result<CacheStats, String> {
    let cache = ACTIVE_CACHE.lock().unwrap();
    match &*cache {
        Some(c) => Ok(c.stats()),
        None => Err("Nessuna cache attiva".to_string()),
    }
}

/// Pulisce la cache delle traduzioni
#[command]
pub async fn clear_ue_cache() -> Result<String, String> {
    let mut cache = ACTIVE_CACHE.lock().unwrap();
    if let Some(ref mut c) = *cache {
        c.entries.clear();
        c.total_hits = 0;
        c.total_misses = 0;
        Ok("Cache pulita".to_string())
    } else {
        Err("Nessuna cache attiva".to_string())
    }
}

/// Verifica se un gioco è compatibile con UE AutoTranslator
#[command]
pub async fn check_ue_translator_compatibility(game_path: String) -> Result<CompatibilityResult, String> {
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Cartella non trovata".to_string());
    }
    
    // Verifica indicatori Unreal Engine
    let has_engine = game_dir.join("Engine").exists();
    let has_content = game_dir.join("Content").exists();
    
    // Cerca file .pak
    let has_pak = std::fs::read_dir(game_dir)
        .map(|entries| {
            entries.filter_map(|e| e.ok())
                .any(|e| e.path().extension().map(|ext| ext == "pak").unwrap_or(false))
        })
        .unwrap_or(false);
    
    // Cerca in sottocartelle
    let content_paks = game_dir.join("Content").join("Paks");
    let has_content_paks = content_paks.exists();
    
    let is_unreal = has_engine || has_content || has_pak || has_content_paks;
    
    // Verifica anti-cheat (potrebbe bloccare injection)
    let has_eac = game_dir.join("EasyAntiCheat").exists() 
        || game_dir.join("EasyAntiCheat_x64.dll").exists();
    let has_battleye = game_dir.join("BattlEye").exists()
        || game_dir.join("BEClient_x64.dll").exists();
    
    let has_anticheat = has_eac || has_battleye;
    
    let (compatible, message) = if !is_unreal {
        (false, "Non sembra essere un gioco Unreal Engine".to_string())
    } else if has_anticheat {
        (false, "⚠️ Rilevato anti-cheat. Il translator potrebbe non funzionare o causare ban.".to_string())
    } else {
        (true, "✓ Gioco Unreal Engine compatibile con UE AutoTranslator".to_string())
    };
    
    Ok(CompatibilityResult {
        is_unreal,
        is_compatible: compatible,
        has_anticheat,
        anticheat_type: if has_eac { Some("EasyAntiCheat".to_string()) } 
                       else if has_battleye { Some("BattlEye".to_string()) } 
                       else { None },
        message,
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CompatibilityResult {
    pub is_unreal: bool,
    pub is_compatible: bool,
    pub has_anticheat: bool,
    pub anticheat_type: Option<String>,
    pub message: String,
}
