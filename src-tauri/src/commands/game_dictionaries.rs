//! Game Dictionaries Management
//! 
//! Sistema per gestire dizionari di traduzione pre-caricati per giochi specifici.
//! Supporta download da repository, import/export locale, e integrazione con XUnity.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::command;

/// Informazioni su un dizionario disponibile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryInfo {
    pub id: String,
    pub game_name: String,
    pub game_id: Option<String>,
    pub source_language: String,
    pub target_language: String,
    pub entries_count: usize,
    pub version: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub size_bytes: u64,
    pub created_at: String,
    pub updated_at: String,
}

/// Dizionario di traduzione per un gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDictionary {
    pub info: DictionaryInfo,
    pub translations: HashMap<String, String>,
}

/// Risultato operazione dizionario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryResult {
    pub success: bool,
    pub message: String,
    pub dictionary_id: Option<String>,
    pub entries_loaded: Option<usize>,
}

/// Stato del dizionario locale
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalDictionaryStatus {
    pub installed: bool,
    pub dictionary_id: Option<String>,
    pub entries_count: usize,
    pub last_updated: Option<String>,
    pub file_path: Option<String>,
}

/// Ottiene il percorso della cartella dizionari
fn get_dictionaries_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir()
        .ok_or("Impossibile trovare cartella dati app")?;
    let dict_dir = app_data.join("GameStringer").join("dictionaries");
    
    fs::create_dir_all(&dict_dir)
        .map_err(|e| format!("Errore creazione cartella dizionari: {}", e))?;
    
    Ok(dict_dir)
}

/// Ottiene il percorso del dizionario per un gioco specifico
fn get_dictionary_path(game_id: &str, target_lang: &str) -> Result<PathBuf, String> {
    let dict_dir = get_dictionaries_dir()?;
    Ok(dict_dir.join(format!("{}_{}.json", game_id, target_lang)))
}

/// Lista tutti i dizionari installati localmente
#[command]
pub async fn list_installed_dictionaries() -> Result<Vec<DictionaryInfo>, String> {
    let dict_dir = get_dictionaries_dir()?;
    let mut dictionaries = Vec::new();
    
    let entries = fs::read_dir(&dict_dir)
        .map_err(|e| format!("Errore lettura cartella dizionari: {}", e))?;
    
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(content) = fs::read_to_string(&path) {
                // Prova a leggere solo le info (formato compatto)
                if let Ok(dict) = serde_json::from_str::<GameDictionary>(&content) {
                    dictionaries.push(dict.info);
                } else if let Ok(info) = serde_json::from_str::<DictionaryInfo>(&content) {
                    dictionaries.push(info);
                }
            }
        }
    }
    
    // Ordina per nome gioco
    dictionaries.sort_by(|a, b| a.game_name.cmp(&b.game_name));
    
    Ok(dictionaries)
}

/// Carica un dizionario locale
#[command(rename_all = "camelCase")]
pub async fn load_dictionary(game_id: String, target_lang: String) -> Result<GameDictionary, String> {
    let path = get_dictionary_path(&game_id, &target_lang)?;
    
    if !path.exists() {
        return Err(format!("Dizionario non trovato per {} ({})", game_id, target_lang));
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura dizionario: {}", e))?;
    
    let dict: GameDictionary = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing dizionario: {}", e))?;
    
    log::info!("📚 Caricato dizionario '{}' con {} voci", game_id, dict.translations.len());
    
    Ok(dict)
}

/// Salva un dizionario locale
#[command]
pub async fn save_dictionary(dictionary: GameDictionary) -> Result<DictionaryResult, String> {
    let path = get_dictionary_path(&dictionary.info.id, &dictionary.info.target_language)?;
    
    let content = serde_json::to_string_pretty(&dictionary)
        .map_err(|e| format!("Errore serializzazione dizionario: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Errore salvataggio dizionario: {}", e))?;
    
    log::info!("💾 Salvato dizionario '{}' con {} voci", dictionary.info.id, dictionary.translations.len());
    
    Ok(DictionaryResult {
        success: true,
        message: format!("Dizionario salvato: {}", path.display()),
        dictionary_id: Some(dictionary.info.id),
        entries_loaded: Some(dictionary.translations.len()),
    })
}

/// Metadati opzionali nel file JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DictionaryMeta {
    game_id: String,
    game_name: String,
    source_language: Option<String>,
    target_language: Option<String>,
    version: Option<String>,
    author: Option<String>,
}

/// Formato JSON con metadati
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DictionaryWithMeta {
    #[serde(rename = "_meta")]
    meta: DictionaryMeta,
    #[serde(flatten)]
    translations: HashMap<String, serde_json::Value>,
}

/// Importa un dizionario da file JSON (auto-rileva metadati da _meta)
#[command(rename_all = "camelCase")]
pub async fn import_dictionary_auto(
    file_path: String,
) -> Result<DictionaryResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    // Prova a leggere con metadati
    if let Ok(with_meta) = serde_json::from_str::<DictionaryWithMeta>(&content) {
        let meta = with_meta.meta;
        
        // Filtra le traduzioni (escludi _meta)
        let translations: HashMap<String, String> = with_meta.translations
            .into_iter()
            .filter(|(k, _)| k != "_meta")
            .filter_map(|(k, v)| {
                if let serde_json::Value::String(s) = v {
                    Some((k, s))
                } else {
                    None
                }
            })
            .collect();
        
        let now = chrono::Utc::now().to_rfc3339();
        let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        
        let dictionary = GameDictionary {
            info: DictionaryInfo {
                id: meta.game_id.clone(),
                game_name: meta.game_name,
                game_id: Some(meta.game_id),
                source_language: meta.source_language.unwrap_or_else(|| "en".to_string()),
                target_language: meta.target_language.unwrap_or_else(|| "it".to_string()),
                entries_count: translations.len(),
                version: meta.version.unwrap_or_else(|| "1.0.0".to_string()),
                author: meta.author,
                description: Some(format!("Importato da {}", file_path)),
                size_bytes: file_size,
                created_at: now.clone(),
                updated_at: now,
            },
            translations,
        };
        
        log::info!("📚 Importato dizionario '{}' con {} voci (auto-detect)", dictionary.info.game_name, dictionary.translations.len());
        
        return save_dictionary(dictionary).await;
    }
    
    Err("File JSON deve contenere _meta con game_id e game_name".to_string())
}

/// Importa un dizionario da file JSON esterno (parametri manuali)
#[command(rename_all = "camelCase")]
pub async fn import_dictionary_from_file(
    file_path: String,
    game_id: String,
    game_name: String,
    source_lang: String,
    target_lang: String,
) -> Result<DictionaryResult, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err("File non trovato".to_string());
    }
    
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Errore lettura file: {}", e))?;
    
    // Supporta diversi formati
    let translations: HashMap<String, String> = if let Ok(with_meta) = serde_json::from_str::<DictionaryWithMeta>(&content) {
        // Ha metadati, filtra _meta
        with_meta.translations
            .into_iter()
            .filter(|(k, _)| k != "_meta")
            .filter_map(|(k, v)| {
                if let serde_json::Value::String(s) = v {
                    Some((k, s))
                } else {
                    None
                }
            })
            .collect()
    } else if let Ok(map) = serde_json::from_str(&content) {
        map
    } else if let Ok(dict) = serde_json::from_str::<GameDictionary>(&content) {
        dict.translations
    } else {
        return Err("Formato file non riconosciuto".to_string());
    };
    
    let now = chrono::Utc::now().to_rfc3339();
    let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    
    let dictionary = GameDictionary {
        info: DictionaryInfo {
            id: game_id.clone(),
            game_name,
            game_id: Some(game_id),
            source_language: source_lang,
            target_language: target_lang.clone(),
            entries_count: translations.len(),
            version: "1.0.0".to_string(),
            author: None,
            description: Some(format!("Importato da {}", file_path)),
            size_bytes: file_size,
            created_at: now.clone(),
            updated_at: now,
        },
        translations,
    };
    
    save_dictionary(dictionary).await
}

/// Esporta un dizionario in formato semplice (solo traduzioni)
#[command(rename_all = "camelCase")]
pub async fn export_dictionary_simple(
    game_id: String,
    target_lang: String,
    output_path: String,
) -> Result<DictionaryResult, String> {
    let dict = load_dictionary(game_id.clone(), target_lang).await?;
    
    let content = serde_json::to_string_pretty(&dict.translations)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&output_path, content)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    Ok(DictionaryResult {
        success: true,
        message: format!("Esportato in: {}", output_path),
        dictionary_id: Some(game_id),
        entries_loaded: Some(dict.translations.len()),
    })
}

/// Elimina un dizionario locale
#[command(rename_all = "camelCase")]
pub async fn delete_dictionary(game_id: String, target_lang: String) -> Result<DictionaryResult, String> {
    let path = get_dictionary_path(&game_id, &target_lang)?;
    
    if !path.exists() {
        return Err("Dizionario non trovato".to_string());
    }
    
    fs::remove_file(&path)
        .map_err(|e| format!("Errore eliminazione dizionario: {}", e))?;
    
    log::info!("🗑️ Eliminato dizionario '{}_{}'", game_id, target_lang);
    
    Ok(DictionaryResult {
        success: true,
        message: format!("Dizionario {} eliminato", game_id),
        dictionary_id: Some(game_id),
        entries_loaded: None,
    })
}

/// Verifica se un dizionario è installato per un gioco
#[command(rename_all = "camelCase")]
pub async fn get_dictionary_status(game_id: String, target_lang: String) -> Result<LocalDictionaryStatus, String> {
    let path = get_dictionary_path(&game_id, &target_lang)?;
    
    if !path.exists() {
        return Ok(LocalDictionaryStatus {
            installed: false,
            dictionary_id: None,
            entries_count: 0,
            last_updated: None,
            file_path: None,
        });
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura dizionario: {}", e))?;
    
    let dict: GameDictionary = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing dizionario: {}", e))?;
    
    Ok(LocalDictionaryStatus {
        installed: true,
        dictionary_id: Some(dict.info.id),
        entries_count: dict.translations.len(),
        last_updated: Some(dict.info.updated_at),
        file_path: Some(path.to_string_lossy().to_string()),
    })
}

/// Cerca nel dizionario
#[command(rename_all = "camelCase")]
pub async fn search_in_dictionary(
    game_id: String,
    target_lang: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<(String, String)>, String> {
    let dict = load_dictionary(game_id, target_lang).await?;
    let limit = limit.unwrap_or(50);
    let query_lower = query.to_lowercase();
    
    let results: Vec<(String, String)> = dict.translations
        .iter()
        .filter(|(k, v)| {
            k.to_lowercase().contains(&query_lower) || 
            v.to_lowercase().contains(&query_lower)
        })
        .take(limit)
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    
    Ok(results)
}

/// Aggiunge o aggiorna una traduzione nel dizionario
#[command(rename_all = "camelCase")]
pub async fn add_translation_to_dictionary(
    game_id: String,
    target_lang: String,
    original: String,
    translated: String,
) -> Result<DictionaryResult, String> {
    let path = get_dictionary_path(&game_id, &target_lang)?;
    
    let mut dict = if path.exists() {
        load_dictionary(game_id.clone(), target_lang.clone()).await?
    } else {
        // Crea nuovo dizionario
        let now = chrono::Utc::now().to_rfc3339();
        GameDictionary {
            info: DictionaryInfo {
                id: game_id.clone(),
                game_name: game_id.clone(),
                game_id: Some(game_id.clone()),
                source_language: "en".to_string(),
                target_language: target_lang.clone(),
                entries_count: 0,
                version: "1.0.0".to_string(),
                author: None,
                description: None,
                size_bytes: 0,
                created_at: now.clone(),
                updated_at: now,
            },
            translations: HashMap::new(),
        }
    };
    
    // Aggiorna traduzione
    dict.translations.insert(original, translated);
    dict.info.entries_count = dict.translations.len();
    dict.info.updated_at = chrono::Utc::now().to_rfc3339();
    
    save_dictionary(dict).await
}

/// Unisce due dizionari (il secondo sovrascrive in caso di conflitto)
#[command(rename_all = "camelCase")]
pub async fn merge_dictionaries(
    base_game_id: String,
    base_lang: String,
    merge_file_path: String,
) -> Result<DictionaryResult, String> {
    let mut base_dict = load_dictionary(base_game_id.clone(), base_lang.clone()).await?;
    
    let merge_content = fs::read_to_string(&merge_file_path)
        .map_err(|e| format!("Errore lettura file da unire: {}", e))?;
    
    let merge_translations: HashMap<String, String> = serde_json::from_str(&merge_content)
        .map_err(|e| format!("Errore parsing file da unire: {}", e))?;
    
    let added = merge_translations.len();
    
    // Unisci (sovrascrive duplicati)
    for (k, v) in merge_translations {
        base_dict.translations.insert(k, v);
    }
    
    base_dict.info.entries_count = base_dict.translations.len();
    base_dict.info.updated_at = chrono::Utc::now().to_rfc3339();
    
    let result = save_dictionary(base_dict).await?;
    
    Ok(DictionaryResult {
        success: true,
        message: format!("Uniti {} voci, totale: {}", added, result.entries_loaded.unwrap_or(0)),
        dictionary_id: result.dictionary_id,
        entries_loaded: result.entries_loaded,
    })
}

/// Applica dizionario a XUnity AutoTranslator (copia in cartella gioco)
#[command(rename_all = "camelCase")]
pub async fn apply_dictionary_to_xunity(
    game_id: String,
    target_lang: String,
    game_path: String,
) -> Result<DictionaryResult, String> {
    let dict = load_dictionary(game_id.clone(), target_lang.clone()).await?;
    
    // Percorso XUnity translations
    let xunity_dir = Path::new(&game_path)
        .join("BepInEx")
        .join("Translation")
        .join(&target_lang)
        .join("Text");
    
    fs::create_dir_all(&xunity_dir)
        .map_err(|e| format!("Errore creazione cartella XUnity: {}", e))?;
    
    // XUnity usa formato: originale=traduzione (una per riga)
    let mut content = String::new();
    for (original, translated) in &dict.translations {
        // Escape caratteri speciali
        let orig_escaped = original.replace("=", "\\=").replace("\n", "\\n");
        let trans_escaped = translated.replace("=", "\\=").replace("\n", "\\n");
        content.push_str(&format!("{}={}\n", orig_escaped, trans_escaped));
    }
    
    let output_file = xunity_dir.join("_GameStringer.txt");
    fs::write(&output_file, content)
        .map_err(|e| format!("Errore scrittura file XUnity: {}", e))?;
    
    log::info!("✅ Applicato dizionario a XUnity: {}", output_file.display());
    
    Ok(DictionaryResult {
        success: true,
        message: format!("Dizionario applicato a XUnity in: {}", output_file.display()),
        dictionary_id: Some(game_id),
        entries_loaded: Some(dict.translations.len()),
    })
}

/// Estrae stringhe da XUnity (file _AutoGeneratedTranslations.txt)
#[command(rename_all = "camelCase")]
pub async fn extract_xunity_translations(
    game_path: String,
    target_lang: String,
) -> Result<HashMap<String, String>, String> {
    let xunity_file = Path::new(&game_path)
        .join("BepInEx")
        .join("Translation")
        .join(&target_lang)
        .join("Text")
        .join("_AutoGeneratedTranslations.txt");
    
    if !xunity_file.exists() {
        return Err("File traduzioni XUnity non trovato. Avvia il gioco almeno una volta con BepInEx.".to_string());
    }
    
    let content = fs::read_to_string(&xunity_file)
        .map_err(|e| format!("Errore lettura file XUnity: {}", e))?;
    
    let mut translations = HashMap::new();
    
    for line in content.lines() {
        if line.starts_with("//") || line.trim().is_empty() {
            continue;
        }
        
        if let Some(idx) = line.find('=') {
            let original = line[..idx].replace("\\=", "=").replace("\\n", "\n");
            let translated = line[idx + 1..].replace("\\=", "=").replace("\\n", "\n");
            
            if !original.is_empty() && !translated.is_empty() {
                translations.insert(original, translated);
            }
        }
    }
    
    log::info!("📤 Estratte {} traduzioni da XUnity", translations.len());
    
    Ok(translations)
}

/// Importa traduzioni da XUnity nel dizionario GameStringer
#[command(rename_all = "camelCase")]
pub async fn import_from_xunity(
    game_path: String,
    game_id: String,
    game_name: String,
    target_lang: String,
) -> Result<DictionaryResult, String> {
    let translations = extract_xunity_translations(game_path, target_lang.clone()).await?;
    
    if translations.is_empty() {
        return Err("Nessuna traduzione trovata in XUnity".to_string());
    }
    
    let now = chrono::Utc::now().to_rfc3339();
    
    let dictionary = GameDictionary {
        info: DictionaryInfo {
            id: game_id.clone(),
            game_name,
            game_id: Some(game_id),
            source_language: "en".to_string(),
            target_language: target_lang,
            entries_count: translations.len(),
            version: "1.0.0".to_string(),
            author: Some("XUnity AutoTranslator".to_string()),
            description: Some("Importato da traduzioni automatiche XUnity".to_string()),
            size_bytes: 0,
            created_at: now.clone(),
            updated_at: now,
        },
        translations,
    };
    
    save_dictionary(dictionary).await
}

/// Statistiche aggregate sui dizionari
#[command]
pub async fn get_dictionaries_stats() -> Result<serde_json::Value, String> {
    let dictionaries = list_installed_dictionaries().await?;
    
    let total_entries: usize = dictionaries.iter().map(|d| d.entries_count).sum();
    let total_size: u64 = dictionaries.iter().map(|d| d.size_bytes).sum();
    
    let mut by_language: HashMap<String, usize> = HashMap::new();
    for dict in &dictionaries {
        *by_language.entry(dict.target_language.clone()).or_insert(0) += 1;
    }
    
    Ok(serde_json::json!({
        "total_dictionaries": dictionaries.len(),
        "total_entries": total_entries,
        "total_size_mb": total_size as f64 / 1024.0 / 1024.0,
        "by_language": by_language,
        "dictionaries": dictionaries,
    }))
}
