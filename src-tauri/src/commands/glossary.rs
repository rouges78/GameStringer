use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryEntry {
    pub id: String,
    pub original: String,
    pub translation: String,
    pub case_sensitive: bool,
    pub context: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryMetadata {
    pub genre: Option<String>,
    pub tone: Option<String>,
    pub setting: Option<String>,
    pub do_not_translate: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameGlossary {
    pub id: String,
    pub game_id: String,
    pub game_name: String,
    pub source_language: String,
    pub target_language: String,
    pub entries: Vec<GlossaryEntry>,
    pub metadata: GlossaryMetadata,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryExport {
    pub version: String,
    pub exported_at: String,
    pub glossary: GameGlossary,
}

fn get_glossary_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir()
        .ok_or("Impossibile trovare la directory dei dati locali")?;
    let glossary_dir = app_data.join("GameStringer").join("glossaries");
    
    if !glossary_dir.exists() {
        fs::create_dir_all(&glossary_dir)
            .map_err(|e| format!("Errore creazione directory glossari: {}", e))?;
    }
    
    Ok(glossary_dir)
}

fn get_glossary_path(game_id: &str) -> Result<PathBuf, String> {
    let dir = get_glossary_dir()?;
    Ok(dir.join(format!("{}.json", game_id)))
}

#[tauri::command]
pub async fn create_glossary(
    game_id: String,
    game_name: String,
    source_language: String,
    target_language: String,
) -> Result<GameGlossary, String> {
    log::info!("📚 Creazione glossario per gioco: {} ({})", game_name, game_id);
    
    let now = Utc::now().to_rfc3339();
    let glossary = GameGlossary {
        id: Uuid::new_v4().to_string(),
        game_id: game_id.clone(),
        game_name,
        source_language,
        target_language,
        entries: Vec::new(),
        metadata: GlossaryMetadata {
            genre: None,
            tone: None,
            setting: None,
            do_not_translate: Vec::new(),
            notes: None,
        },
        created_at: now.clone(),
        updated_at: now,
    };
    
    save_glossary_internal(&glossary)?;
    
    log::info!("✅ Glossario creato con ID: {}", glossary.id);
    Ok(glossary)
}

#[tauri::command]
pub async fn get_glossary(game_id: String) -> Result<Option<GameGlossary>, String> {
    log::info!("📖 Caricamento glossario per gioco: {}", game_id);
    
    let path = get_glossary_path(&game_id)?;
    
    if !path.exists() {
        log::info!("ℹ️ Nessun glossario trovato per: {}", game_id);
        return Ok(None);
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura glossario: {}", e))?;
    
    let glossary: GameGlossary = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing glossario: {}", e))?;
    
    log::info!("✅ Glossario caricato: {} voci", glossary.entries.len());
    Ok(Some(glossary))
}

#[tauri::command]
pub async fn list_glossaries() -> Result<Vec<GameGlossary>, String> {
    log::info!("📚 Elenco tutti i glossari...");
    
    let dir = get_glossary_dir()?;
    let mut glossaries = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(glossary) = serde_json::from_str::<GameGlossary>(&content) {
                            glossaries.push(glossary);
                        }
                    }
                }
            }
        }
    }
    
    log::info!("✅ Trovati {} glossari", glossaries.len());
    Ok(glossaries)
}

#[tauri::command]
pub async fn add_glossary_entry(
    game_id: String,
    original: String,
    translation: String,
    case_sensitive: bool,
    context: Option<String>,
    notes: Option<String>,
) -> Result<GlossaryEntry, String> {
    log::info!("➕ Aggiunta voce glossario: {} → {}", original, translation);
    
    let mut glossary = get_glossary(game_id.clone()).await?
        .ok_or("Glossario non trovato")?;
    
    let now = Utc::now().to_rfc3339();
    let entry = GlossaryEntry {
        id: Uuid::new_v4().to_string(),
        original,
        translation,
        case_sensitive,
        context,
        notes,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    
    glossary.entries.push(entry.clone());
    glossary.updated_at = now;
    
    save_glossary_internal(&glossary)?;
    
    log::info!("✅ Voce aggiunta con ID: {}", entry.id);
    Ok(entry)
}

#[tauri::command]
pub async fn update_glossary_entry(
    game_id: String,
    entry_id: String,
    original: Option<String>,
    translation: Option<String>,
    case_sensitive: Option<bool>,
    context: Option<String>,
    notes: Option<String>,
) -> Result<GlossaryEntry, String> {
    log::info!("✏️ Aggiornamento voce glossario: {}", entry_id);
    
    let mut glossary = get_glossary(game_id.clone()).await?
        .ok_or("Glossario non trovato")?;
    
    let now = Utc::now().to_rfc3339();
    
    let entry = glossary.entries.iter_mut()
        .find(|e| e.id == entry_id)
        .ok_or("Voce non trovata")?;
    
    if let Some(o) = original { entry.original = o; }
    if let Some(t) = translation { entry.translation = t; }
    if let Some(c) = case_sensitive { entry.case_sensitive = c; }
    if let Some(ctx) = context { entry.context = Some(ctx); }
    if let Some(n) = notes { entry.notes = Some(n); }
    entry.updated_at = now.clone();
    
    let updated_entry = entry.clone();
    glossary.updated_at = now;
    
    save_glossary_internal(&glossary)?;
    
    log::info!("✅ Voce aggiornata");
    Ok(updated_entry)
}

#[tauri::command]
pub async fn delete_glossary_entry(
    game_id: String,
    entry_id: String,
) -> Result<bool, String> {
    log::info!("🗑️ Eliminazione voce glossario: {}", entry_id);
    
    let mut glossary = get_glossary(game_id.clone()).await?
        .ok_or("Glossario non trovato")?;
    
    let initial_len = glossary.entries.len();
    glossary.entries.retain(|e| e.id != entry_id);
    
    if glossary.entries.len() == initial_len {
        return Err("Voce non trovata".to_string());
    }
    
    glossary.updated_at = Utc::now().to_rfc3339();
    save_glossary_internal(&glossary)?;
    
    log::info!("✅ Voce eliminata");
    Ok(true)
}

#[tauri::command]
pub async fn update_glossary_metadata(
    game_id: String,
    genre: Option<String>,
    tone: Option<String>,
    setting: Option<String>,
    do_not_translate: Option<Vec<String>>,
    notes: Option<String>,
) -> Result<GameGlossary, String> {
    log::info!("📝 Aggiornamento metadata glossario: {}", game_id);
    
    let mut glossary = get_glossary(game_id.clone()).await?
        .ok_or("Glossario non trovato")?;
    
    if let Some(g) = genre { glossary.metadata.genre = Some(g); }
    if let Some(t) = tone { glossary.metadata.tone = Some(t); }
    if let Some(s) = setting { glossary.metadata.setting = Some(s); }
    if let Some(dnt) = do_not_translate { glossary.metadata.do_not_translate = dnt; }
    if let Some(n) = notes { glossary.metadata.notes = Some(n); }
    
    glossary.updated_at = Utc::now().to_rfc3339();
    save_glossary_internal(&glossary)?;
    
    log::info!("✅ Metadata aggiornati");
    Ok(glossary)
}

#[tauri::command]
pub async fn export_glossary(game_id: String) -> Result<String, String> {
    log::info!("📤 Esportazione glossario: {}", game_id);
    
    let glossary = get_glossary(game_id.clone()).await?
        .ok_or("Glossario non trovato")?;
    
    let export = GlossaryExport {
        version: "1.0".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        glossary,
    };
    
    let json = serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    log::info!("✅ Glossario esportato");
    Ok(json)
}

#[tauri::command]
pub async fn import_glossary(json_content: String) -> Result<GameGlossary, String> {
    log::info!("📥 Importazione glossario...");
    
    let export: GlossaryExport = serde_json::from_str(&json_content)
        .map_err(|e| format!("Errore parsing JSON: {}", e))?;
    
    let mut glossary = export.glossary;
    glossary.updated_at = Utc::now().to_rfc3339();
    
    save_glossary_internal(&glossary)?;
    
    log::info!("✅ Glossario importato: {} voci", glossary.entries.len());
    Ok(glossary)
}

#[tauri::command]
pub async fn search_glossary(
    game_id: String,
    text: String,
) -> Result<Vec<(String, String)>, String> {
    // Cerca nel glossario e restituisce le sostituzioni da applicare
    let glossary = match get_glossary(game_id).await? {
        Some(g) => g,
        None => return Ok(Vec::new()),
    };
    
    let mut replacements = Vec::new();
    
    for entry in &glossary.entries {
        let found = if entry.case_sensitive {
            text.contains(&entry.original)
        } else {
            text.to_lowercase().contains(&entry.original.to_lowercase())
        };
        
        if found {
            replacements.push((entry.original.clone(), entry.translation.clone()));
        }
    }
    
    Ok(replacements)
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-GLOSSARY PERSISTENCE (per lib/auto-glossary.ts)
// Salva/carica glossari automatici in formato JSON opaco per gameId
// ═══════════════════════════════════════════════════════════════════

fn get_auto_glossary_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir()
        .ok_or("Impossibile trovare la directory dei dati locali")?;
    let dir = app_data.join("GameStringer").join("auto_glossaries");

    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Errore creazione directory auto-glossari: {}", e))?;
    }

    Ok(dir)
}

#[tauri::command]
pub fn save_auto_glossary(game_id: String, data: serde_json::Value) -> Result<(), String> {
    log::info!("💾 Salvataggio auto-glossario: {}", game_id);
    let dir = get_auto_glossary_dir()?;
    let path = dir.join(format!("auto_{}.json", game_id));

    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Errore serializzazione auto-glossario: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("Errore scrittura auto-glossario: {}", e))?;

    log::info!("✅ Auto-glossario salvato: {}", game_id);
    Ok(())
}

#[tauri::command]
pub fn load_auto_glossary(game_id: String) -> Result<Option<serde_json::Value>, String> {
    let dir = get_auto_glossary_dir()?;
    let path = dir.join(format!("auto_{}.json", game_id));

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura auto-glossario: {}", e))?;

    let data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing auto-glossario: {}", e))?;

    Ok(Some(data))
}

#[tauri::command]
pub fn delete_auto_glossary(game_id: String) -> Result<(), String> {
    let dir = get_auto_glossary_dir()?;
    let path = dir.join(format!("auto_{}.json", game_id));

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Errore eliminazione auto-glossario: {}", e))?;
        log::info!("🗑️ Auto-glossario eliminato: {}", game_id);
    }

    Ok(())
}

#[tauri::command]
pub fn load_all_auto_glossaries() -> Result<serde_json::Value, String> {
    let dir = get_auto_glossary_dir()?;
    let mut all = serde_json::Map::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                        // Estrai gameId dal nome file (auto_{gameId}.json)
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            if let Some(game_id) = stem.strip_prefix("auto_") {
                                all.insert(game_id.to_string(), data);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(serde_json::Value::Object(all))
}

#[tauri::command]
pub fn save_auto_glossary_config(config: serde_json::Value) -> Result<(), String> {
    let dir = get_auto_glossary_dir()?;
    let path = dir.join("_config.json");

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Errore serializzazione config glossario: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("Errore scrittura config glossario: {}", e))
}

#[tauri::command]
pub fn load_auto_glossary_config() -> Result<Option<serde_json::Value>, String> {
    let dir = get_auto_glossary_dir()?;
    let path = dir.join("_config.json");

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura config glossario: {}", e))?;

    let data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing config glossario: {}", e))?;

    Ok(Some(data))
}

// ═══════════════════════════════════════════════════════════════════

fn save_glossary_internal(glossary: &GameGlossary) -> Result<(), String> {
    let path = get_glossary_path(&glossary.game_id)?;
    
    let json = serde_json::to_string_pretty(glossary)
        .map_err(|e| format!("Errore serializzazione glossario: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Errore salvataggio glossario: {}", e))?;
    
    Ok(())
}
