// OCR Translator Module
// Cattura schermo → OCR → Traduzione → Overlay

mod screen_capture;
mod ocr_engine;
mod overlay;
pub mod retro_preprocessor;

// Usati internamente dal modulo
#[allow(unused_imports)]
use screen_capture::*;
#[allow(unused_imports)]
use ocr_engine::*;
#[allow(unused_imports)]
use overlay::*;

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::collections::HashMap;
use once_cell::sync::Lazy;

static OCR_RUNNING: AtomicBool = AtomicBool::new(false);
static LAST_TEXTS: Lazy<Mutex<Vec<DetectedText>>> = Lazy::new(|| Mutex::new(Vec::new()));
static TRANSLATION_CACHE: Lazy<Mutex<HashMap<String, String>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static OCR_CONFIG: Lazy<Mutex<Option<OcrConfig>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedText {
    pub text: String,
    pub translated: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrConfig {
    pub language: String,           // "en", "ja", "zh", etc.
    pub target_language: String,    // Lingua di traduzione
    pub capture_interval_ms: u64,   // Intervallo cattura (default 500ms)
    pub min_confidence: f32,        // Confidenza minima OCR (0.0-1.0)
    pub region: Option<CaptureRegion>, // Regione specifica o tutto schermo
    pub target_window: Option<isize>, // HWND della finestra da catturare (None = schermo intero)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureRegion {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Default for OcrConfig {
    fn default() -> Self {
        Self {
            language: "en".to_string(),
            target_language: "it".to_string(),
            capture_interval_ms: 500,
            min_confidence: 0.5,
            region: None,
            target_window: None,
        }
    }
}

/// Avvia il sistema OCR translator
#[command]
pub async fn start_ocr_translator(config: OcrConfig) -> Result<String, String> {
    if OCR_RUNNING.load(Ordering::SeqCst) {
        return Ok("OCR già in esecuzione".to_string());
    }
    
    // Salva config globalmente
    if let Ok(mut cfg) = OCR_CONFIG.lock() {
        *cfg = Some(config.clone());
    }
    
    OCR_RUNNING.store(true, Ordering::SeqCst);
    log::info!("🔍 Avvio OCR Translator (source: {}, target: {})", config.language, config.target_language);
    
    // Avvia thread OCR
    let cfg = config.clone();
    std::thread::spawn(move || {
        run_ocr_loop(cfg);
    });
    
    Ok(format!("OCR Translator avviato ({} → {})", config.language, config.target_language))
}

/// Ferma il sistema OCR translator
#[command]
pub async fn stop_ocr_translator() -> Result<String, String> {
    OCR_RUNNING.store(false, Ordering::SeqCst);
    log::info!("🛑 OCR Translator fermato");
    Ok("OCR Translator fermato".to_string())
}

/// Ottieni i testi rilevati
#[command]
pub async fn get_detected_texts() -> Result<Vec<DetectedText>, String> {
    let texts = LAST_TEXTS.lock().map_err(|e| e.to_string())?;
    Ok(texts.clone())
}

/// Stato OCR
#[command]
pub async fn is_ocr_running() -> bool {
    OCR_RUNNING.load(Ordering::SeqCst)
}

/// Lista delle finestre disponibili per cattura
#[command]
pub async fn list_capture_windows() -> Result<Vec<screen_capture::WindowInfo>, String> {
    Ok(screen_capture::list_windows())
}

/// Mostra/nasconde la finestra overlay OCR
#[command]
pub async fn toggle_ocr_overlay(app: tauri::AppHandle, show: bool) -> Result<(), String> {
    use tauri::Manager;
    
    if let Some(window) = app.get_webview_window("ocr-overlay") {
        if show {
            window.show().map_err(|e| e.to_string())?;
            // NON catturare il focus - lascia il gioco attivo
            // window.set_focus() RIMOSSO - bloccava l'input del gioco
            
            // Rendi la finestra click-through (ignora mouse)
            #[cfg(target_os = "windows")]
            {
                use std::ffi::c_void;
                
                #[link(name = "user32")]
                extern "system" {
                    fn GetWindowLongW(hwnd: *mut c_void, index: i32) -> i32;
                    fn SetWindowLongW(hwnd: *mut c_void, index: i32, value: i32) -> i32;
                }
                
                const GWL_EXSTYLE: i32 = -20;
                const WS_EX_TRANSPARENT: i32 = 0x00000020;
                const WS_EX_LAYERED: i32 = 0x00080000;
                
                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        let ex_style = GetWindowLongW(hwnd.0 as *mut c_void, GWL_EXSTYLE);
                        SetWindowLongW(
                            hwnd.0 as *mut c_void, 
                            GWL_EXSTYLE, 
                            ex_style | WS_EX_TRANSPARENT | WS_EX_LAYERED
                        );
                    }
                    log::info!("🪟 Overlay OCR reso click-through");
                }
            }
            
            log::info!("🪟 Overlay OCR mostrato (non blocca input)");
        } else {
            window.hide().map_err(|e| e.to_string())?;
            log::info!("🪟 Overlay OCR nascosto");
        }
    } else {
        return Err("Finestra overlay non trovata".to_string());
    }
    
    Ok(())
}

/// Posiziona l'overlay sulla finestra target
#[command]
pub async fn position_overlay_on_window(app: tauri::AppHandle, hwnd: isize) -> Result<(), String> {
    use tauri::Manager;
    use std::ffi::c_void;
    
    #[repr(C)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }
    
    #[link(name = "user32")]
    extern "system" {
        fn GetWindowRect(hwnd: *mut c_void, rect: *mut Rect) -> i32;
    }
    
    let mut rect = Rect { left: 0, top: 0, right: 0, bottom: 0 };
    
    unsafe {
        if GetWindowRect(hwnd as *mut c_void, &mut rect) == 0 {
            return Err("Impossibile ottenere posizione finestra".to_string());
        }
    }
    
    let x = rect.left;
    let y = rect.top;
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    
    if let Some(window) = app.get_webview_window("ocr-overlay") {
        use tauri::PhysicalPosition;
        use tauri::PhysicalSize;
        
        window.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        window.set_size(PhysicalSize::new(width as u32, height as u32)).map_err(|e| e.to_string())?;
        
        log::info!("🪟 Overlay posizionato: {}x{} @ ({},{})", width, height, x, y);
    }
    
    Ok(())
}

fn run_ocr_loop(config: OcrConfig) {
    log::info!("📷 OCR loop avviato (target_window: {:?})", config.target_window);
    
    while OCR_RUNNING.load(Ordering::SeqCst) {
        // 1. Cattura schermo o finestra specifica
        let capture_result = if let Some(hwnd) = config.target_window {
            screen_capture::capture_window(hwnd)
        } else {
            screen_capture::capture_screen(&config.region)
        };
        
        match capture_result {
            Ok(image_data) => {
                // 2. OCR
                match ocr_engine::recognize_text(&image_data, &config.language) {
                    Ok(texts) => {
                        // Filtra per confidenza
                        let mut filtered: Vec<DetectedText> = texts
                            .into_iter()
                            .filter(|t| t.confidence >= config.min_confidence)
                            .collect();
                        
                        // 3. Traduci i testi
                        translate_detected_texts(&mut filtered, &config.target_language);
                        
                        if !filtered.is_empty() {
                            let translated_count = filtered.iter().filter(|t| t.translated.is_some()).count();
                            log::debug!("🔤 Rilevati {} testi, {} tradotti", filtered.len(), translated_count);
                        }
                        
                        // Salva risultati
                        if let Ok(mut last) = LAST_TEXTS.lock() {
                            *last = filtered;
                        }
                    }
                    Err(e) => {
                        log::warn!("OCR error: {}", e);
                    }
                }
            }
            Err(e) => {
                log::warn!("Screen capture error: {}", e);
            }
        }
        
        // Attendi intervallo
        std::thread::sleep(std::time::Duration::from_millis(config.capture_interval_ms));
    }
    
    log::info!("📷 OCR loop terminato");
}

/// Traduce i testi rilevati usando Translation Memory + dizionario locale
fn translate_detected_texts(texts: &mut Vec<DetectedText>, target_lang: &str) {
    let mut cache = match TRANSLATION_CACHE.lock() {
        Ok(c) => c,
        Err(_) => return,
    };
    
    // Carica traduzioni dalla TM se disponibile
    let tm_translations = load_tm_translations(target_lang);
    
    for text in texts.iter_mut() {
        // 1. Cerca in cache runtime
        if let Some(translated) = cache.get(&text.text) {
            text.translated = Some(translated.clone());
            continue;
        }
        
        // 2. Cerca nella Translation Memory (priorità)
        if let Some(translated) = tm_translations.get(&text.text.to_lowercase()) {
            cache.insert(text.text.clone(), translated.clone());
            text.translated = Some(translated.clone());
            continue;
        }
        
        // 3. Fallback: dizionario integrato
        let translated = simple_translate(&text.text, target_lang);
        if let Some(ref t) = translated {
            cache.insert(text.text.clone(), t.clone());
        }
        text.translated = translated;
    }
}

/// Carica traduzioni dalla Translation Memory
fn load_tm_translations(target_lang: &str) -> HashMap<String, String> {
    use std::fs;
    
    let mut translations = HashMap::new();
    
    // Percorso TM
    let local_app_data = match std::env::var("LOCALAPPDATA") {
        Ok(p) => p,
        Err(_) => return translations,
    };
    
    let tm_path = std::path::PathBuf::from(local_app_data)
        .join("GameStringer")
        .join("translation_memory")
        .join(format!("tm_en_{}.json", target_lang));
    
    if !tm_path.exists() {
        return translations;
    }
    
    if let Ok(content) = fs::read_to_string(&tm_path) {
        if let Ok(tm) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(units) = tm.get("units").and_then(|u| u.as_array()) {
                for unit in units {
                    if let (Some(source), Some(target)) = (
                        unit.get("sourceText").and_then(|s| s.as_str()),
                        unit.get("targetText").and_then(|t| t.as_str()),
                    ) {
                        translations.insert(source.to_lowercase(), target.to_string());
                    }
                }
            }
        }
    }
    
    if !translations.is_empty() {
        log::debug!("📚 Caricate {} traduzioni dalla TM", translations.len());
    }
    
    translations
}

/// Traduzione semplice usando dizionario integrato (per demo)
fn simple_translate(text: &str, target_lang: &str) -> Option<String> {
    if target_lang != "it" {
        return None;
    }
    
    // Dizionario base EN -> IT per termini comuni nei giochi
    let dict: HashMap<&str, &str> = [
        // Menu base
        ("Options", "Opzioni"),
        ("OPTIONS", "OPZIONI"),
        ("Settings", "Impostazioni"),
        ("Music", "Musica"),
        ("Effects", "Effetti"),
        ("Sound", "Audio"),
        ("Volume", "Volume"),
        ("Master", "Principale"),
        ("Gameplay", "Gioco"),
        ("Graphics", "Grafica"),
        ("Controls", "Controlli"),
        ("Play", "Gioca"),
        ("Start", "Inizia"),
        ("Continue", "Continua"),
        ("New Game", "Nuova Partita"),
        ("Load", "Carica"),
        ("Save", "Salva"),
        ("Exit", "Esci"),
        ("Quit", "Esci"),
        ("Back", "Indietro"),
        ("Cancel", "Annulla"),
        ("Confirm", "Conferma"),
        ("Accept", "Accetta"),
        ("Apply", "Applica"),
        ("Yes", "Sì"),
        ("No", "No"),
        ("On", "Attivo"),
        ("Off", "Disattivo"),
        // Hell Clock specifici
        ("BLESSED SHOP", "NEGOZIO BENEDETTO"),
        ("Blessed Shop", "Negozio Benedetto"),
        ("Active Quests", "Missioni Attive"),
        ("ACT", "ATTO"),
        ("Act I", "Atto I"),
        ("Act II", "Atto II"),
        ("Act III", "Atto III"),
        ("Talk to", "Parla con"),
        ("Purchase", "Acquista"),
        ("Revolver", "Revolver"),
        ("from", "da"),
        ("Interact with the Blessed Table to open the shop", "Interagisci con il Tavolo Benedetto per aprire il negozio"),
        ("CAMPAIGN", "CAMPAGNA"),
        ("CAMPAIGN (NORMAL)", "CAMPAGNA (NORMALE)"),
        ("NORMAL", "NORMALE"),
        ("Explorer", "Esploratore"),
        ("hooks", "ganci"),
        // Hell Clock - Luoghi
        ("THE BASEMENT", "IL SEMINTERRATO"),
        ("THE BASEMENT (FLOOR 1)", "IL SEMINTERRATO (PIANO 1)"),
        ("FLOOR", "PIANO"),
        ("Floor", "Piano"),
        ("Basement", "Seminterrato"),
        ("Dungeon", "Sotterraneo"),
        ("Chamber", "Camera"),
        ("Hall", "Sala"),
        ("Room", "Stanza"),
        ("Corridor", "Corridoio"),
        ("Gate", "Cancello"),
        ("Door", "Porta"),
        ("Entrance", "Entrata"),
        ("Exit", "Uscita"),
        ("Stairs", "Scale"),
        ("Tower", "Torre"),
        ("Castle", "Castello"),
        ("Crypt", "Cripta"),
        ("Tomb", "Tomba"),
        ("Graveyard", "Cimitero"),
        ("Cemetery", "Cimitero"),
        ("Church", "Chiesa"),
        ("Cathedral", "Cattedrale"),
        ("Chapel", "Cappella"),
        ("Shrine", "Santuario"),
        ("Altar", "Altare"),
        // Hell Clock - Nemici/Personaggi
        ("Enemy", "Nemico"),
        ("Enemies", "Nemici"),
        ("Boss", "Boss"),
        ("Miniboss", "Miniboss"),
        ("Monster", "Mostro"),
        ("Monsters", "Mostri"),
        ("Demon", "Demone"),
        ("Demons", "Demoni"),
        ("Ghost", "Fantasma"),
        ("Skeleton", "Scheletro"),
        ("Zombie", "Zombie"),
        ("Vampire", "Vampiro"),
        ("Witch", "Strega"),
        ("Priest", "Prete"),
        ("Knight", "Cavaliere"),
        ("Guard", "Guardia"),
        ("Merchant", "Mercante"),
        ("Kill the Merchant", "Uccidi il Mercante"),
        ("Kill", "Uccidi"),
        ("Defeat", "Sconfiggi"),
        ("Destroy", "Distruggi"),
        ("Find", "Trova"),
        ("Collect", "Raccogli"),
        ("Examine", "Esamina"),
        ("Examine the Tome", "Esamina il Tomo"),
        ("Tome", "Tomo"),
        ("Book", "Libro"),
        ("Scroll", "Pergamena"),
        // Hell Clock - UI
        ("Screen shake", "Tremolio schermo"),
        ("Player mini health bar", "Barra salute mini giocatore"),
        ("Enemy mini health bar", "Barra salute mini nemico"),
        ("Display damage numbers", "Mostra numeri danno"),
        ("Show skills cooldown countdown feedback", "Mostra conto alla rovescia abilità"),
        ("Show target life values", "Mostra valori vita bersaglio"),
        ("Display all game HUD numbers", "Mostra tutti i numeri HUD"),
        ("Show No Mana Feedback", "Mostra feedback mana insufficiente"),
        ("Low Life HUD Feedback", "Feedback HUD vita bassa"),
        ("Damage HUD Feedback", "Feedback HUD danno"),
        ("Restore Life on Level Up", "Ripristina vita al level up"),
        ("Restore Mana on Level Up", "Ripristina mana al level up"),
        ("Die Perks on Full Pickup", "Perks dadi su raccolta piena"),
        ("When Damaged", "Quando Danneggiato"),
        // Hell Clock - Oggetti
        ("Potion", "Pozione"),
        ("Health Potion", "Pozione Salute"),
        ("Mana Potion", "Pozione Mana"),
        ("Key", "Chiave"),
        ("Keys", "Chiavi"),
        ("Chest", "Forziere"),
        ("Treasure", "Tesoro"),
        ("Relic", "Reliquia"),
        ("Artifact", "Artefatto"),
        ("Soul", "Anima"),
        ("Souls", "Anime"),
        ("Blood", "Sangue"),
        ("Bone", "Osso"),
        ("Bones", "Ossa"),
        ("Curse", "Maledizione"),
        ("Cursed", "Maledetto"),
        ("Blessed", "Benedetto"),
        ("Holy", "Sacro"),
        ("Unholy", "Empio"),
        ("Dark", "Oscuro"),
        ("Light", "Luce"),
        ("Fire", "Fuoco"),
        ("Ice", "Ghiaccio"),
        ("Lightning", "Fulmine"),
        ("Poison", "Veleno"),
        // RPG comuni
        ("Low", "Basso"),
        ("Medium", "Medio"),
        ("High", "Alto"),
        ("Ultra", "Ultra"),
        ("Resolution", "Risoluzione"),
        ("Fullscreen", "Schermo intero"),
        ("Windowed", "Finestra"),
        ("Language", "Lingua"),
        ("Difficulty", "Difficoltà"),
        ("Easy", "Facile"),
        ("Normal", "Normale"),
        ("Hard", "Difficile"),
        ("Pause", "Pausa"),
        ("Resume", "Riprendi"),
        ("Retry", "Riprova"),
        ("Help", "Aiuto"),
        ("Credits", "Crediti"),
        ("Select", "Seleziona"),
        ("Create", "Crea"),
        ("Delete", "Elimina"),
        ("Edit", "Modifica"),
        ("Name", "Nome"),
        ("Level", "Livello"),
        ("Health", "Salute"),
        ("Attack", "Attacco"),
        ("Defense", "Difesa"),
        ("Speed", "Velocità"),
        ("Inventory", "Inventario"),
        ("Items", "Oggetti"),
        ("Equipment", "Equipaggiamento"),
        ("Skills", "Abilità"),
        ("Map", "Mappa"),
        ("Quest", "Missione"),
        ("Quests", "Missioni"),
        ("Tutorial", "Tutorial"),
        ("Loading", "Caricamento"),
        ("Saving", "Salvataggio"),
        ("Interface", "Interfaccia"),
        ("Dialogues", "Dialoghi"),
        ("Ambience", "Ambiente"),
        ("Subtitles", "Sottotitoli"),
        // Azioni
        ("Buy", "Compra"),
        ("Sell", "Vendi"),
        ("Use", "Usa"),
        ("Equip", "Equipaggia"),
        ("Drop", "Lascia"),
        ("Take", "Prendi"),
        ("Open", "Apri"),
        ("Close", "Chiudi"),
        ("Shop", "Negozio"),
        ("Store", "Negozio"),
        ("Weapon", "Arma"),
        ("Weapons", "Armi"),
        ("Armor", "Armatura"),
        ("Gold", "Oro"),
        ("Coins", "Monete"),
        ("Damage", "Danno"),
        ("Critical", "Critico"),
        ("Dodge", "Schiva"),
        ("Block", "Blocca"),
        ("Heal", "Cura"),
        ("Mana", "Mana"),
        ("Stamina", "Stamina"),
        ("Energy", "Energia"),
        ("Power", "Potenza"),
        ("Strength", "Forza"),
        ("Agility", "Agilità"),
        ("Intelligence", "Intelligenza"),
        ("Wisdom", "Saggezza"),
        ("Luck", "Fortuna"),
        ("Experience", "Esperienza"),
        ("XP", "PE"),
        ("Upgrade", "Potenzia"),
        ("Unlock", "Sblocca"),
        ("Locked", "Bloccato"),
        ("Unlocked", "Sbloccato"),
        ("Available", "Disponibile"),
        ("Unavailable", "Non disponibile"),
        ("Required", "Richiesto"),
        ("Reward", "Ricompensa"),
        ("Rewards", "Ricompense"),
        ("Complete", "Completa"),
        ("Completed", "Completato"),
        ("Failed", "Fallito"),
        ("Victory", "Vittoria"),
        ("Defeat", "Sconfitta"),
        ("Game Over", "Fine Partita"),
        ("Try Again", "Riprova"),
        ("Main Menu", "Menu Principale"),
    ].iter().cloned().collect();
    
    // Match esatto
    if let Some(t) = dict.get(text) {
        return Some(t.to_string());
    }
    
    // Match case-insensitive
    let text_lower = text.to_lowercase();
    for (key, val) in &dict {
        if key.to_lowercase() == text_lower {
            return Some(val.to_string());
        }
    }
    
    None
}
