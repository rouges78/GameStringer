use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use log::{info, warn};

/// 🧠 Translation Memory System - Backend Rust
/// 
/// Gestisce il salvataggio e caricamento delle memorie traduttive

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranslationUnit {
    pub id: String,
    #[serde(alias = "source_text")]
    pub source_text: String,
    #[serde(alias = "target_text")]
    pub target_text: String,
    #[serde(alias = "source_language")]
    pub source_language: String,
    #[serde(alias = "target_language")]
    pub target_language: String,
    pub context: Option<String>,
    #[serde(alias = "game_id")]
    pub game_id: Option<String>,
    pub provider: String,
    pub confidence: f64,
    pub verified: bool,
    #[serde(alias = "usage_count")]
    pub usage_count: u32,
    #[serde(alias = "created_at")]
    pub created_at: String,
    #[serde(alias = "updated_at")]
    pub updated_at: String,
    pub metadata: Option<TranslationUnitMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranslationUnitMetadata {
    #[serde(alias = "character_limit")]
    pub character_limit: Option<u32>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TMStats {
    #[serde(alias = "total_units")]
    pub total_units: u32,
    #[serde(alias = "verified_units")]
    pub verified_units: u32,
    #[serde(alias = "total_usage_count")]
    pub total_usage_count: u32,
    #[serde(alias = "average_confidence")]
    pub average_confidence: f64,
    #[serde(alias = "by_provider")]
    pub by_provider: std::collections::HashMap<String, u32>,
    #[serde(alias = "by_context")]
    pub by_context: std::collections::HashMap<String, u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranslationMemory {
    pub id: String,
    pub name: String,
    #[serde(alias = "source_language")]
    pub source_language: String,
    #[serde(alias = "target_language")]
    pub target_language: String,
    pub units: Vec<TranslationUnit>,
    pub stats: TMStats,
    #[serde(alias = "created_at")]
    pub created_at: String,
    #[serde(alias = "updated_at")]
    pub updated_at: String,
}

/// Ottiene il percorso della directory dati
fn get_data_dir() -> Result<PathBuf, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA non trovato".to_string())?;
    
    let data_dir = PathBuf::from(local_app_data).join("GameStringer").join("translation_memory");
    
    // Crea la directory se non esiste
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Impossibile creare directory TM: {}", e))?;
    }
    
    Ok(data_dir)
}

/// Genera il nome file per una coppia di lingue
fn get_tm_filename(source_lang: &str, target_lang: &str) -> String {
    format!("tm_{}_{}.json", source_lang.to_lowercase(), target_lang.to_lowercase())
}

/// 📥 Carica una Translation Memory
#[tauri::command]
pub fn load_translation_memory(
    source_lang: String,
    target_lang: String
) -> Result<Option<TranslationMemory>, String> {
    info!("📥 Caricamento TM: {} → {}", source_lang, target_lang);
    
    let data_dir = get_data_dir()?;
    let filename = get_tm_filename(&source_lang, &target_lang);
    let file_path = data_dir.join(&filename);
    
    if !file_path.exists() {
        info!("📭 TM non trovata: {}", filename);
        return Ok(None);
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura TM: {}", e))?;
    
    let memory: TranslationMemory = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing TM: {}", e))?;
    
    info!("✅ TM caricata: {} unità", memory.units.len());
    Ok(Some(memory))
}

/// 💾 Salva una Translation Memory
#[tauri::command]
pub fn save_translation_memory(memory: TranslationMemory) -> Result<(), String> {
    info!("💾 Salvataggio TM: {} ({} unità)", memory.name, memory.units.len());
    
    let data_dir = get_data_dir()?;
    let filename = get_tm_filename(&memory.source_language, &memory.target_language);
    let file_path = data_dir.join(&filename);
    
    let content = serde_json::to_string_pretty(&memory)
        .map_err(|e| format!("Errore serializzazione TM: {}", e))?;
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Errore scrittura TM: {}", e))?;
    
    info!("✅ TM salvata: {}", file_path.display());
    Ok(())
}

/// 📋 Lista tutte le Translation Memory disponibili
#[tauri::command]
pub fn list_translation_memories() -> Result<Vec<TranslationMemoryInfo>, String> {
    info!("📋 Lista Translation Memories");
    
    let data_dir = get_data_dir()?;
    let mut memories = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(tm) = serde_json::from_str::<TranslationMemory>(&content) {
                        memories.push(TranslationMemoryInfo {
                            id: tm.id,
                            name: tm.name,
                            source_language: tm.source_language,
                            target_language: tm.target_language,
                            unit_count: tm.units.len() as u32,
                            verified_count: tm.stats.verified_units,
                            updated_at: tm.updated_at,
                        });
                    }
                }
            }
        }
    }
    
    info!("✅ Trovate {} TM", memories.len());
    Ok(memories)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationMemoryInfo {
    pub id: String,
    pub name: String,
    pub source_language: String,
    pub target_language: String,
    pub unit_count: u32,
    pub verified_count: u32,
    pub updated_at: String,
}

/// 🗑️ Elimina una Translation Memory
#[tauri::command]
pub fn delete_translation_memory(source_lang: String, target_lang: String) -> Result<(), String> {
    info!("🗑️ Eliminazione TM: {} → {}", source_lang, target_lang);
    
    let data_dir = get_data_dir()?;
    let filename = get_tm_filename(&source_lang, &target_lang);
    let file_path = data_dir.join(&filename);
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Errore eliminazione TM: {}", e))?;
        info!("✅ TM eliminata");
    } else {
        warn!("⚠️ TM non trovata per eliminazione");
    }
    
    Ok(())
}

/// 📤 Esporta una Translation Memory in formato TMX (standard industria)
#[tauri::command]
pub fn export_translation_memory_tmx(
    source_lang: String,
    target_lang: String,
    output_path: String
) -> Result<String, String> {
    info!("📤 Esportazione TM in TMX: {} → {}", source_lang, target_lang);
    
    let memory = load_translation_memory(source_lang.clone(), target_lang.clone())?
        .ok_or("TM non trovata")?;
    
    // Genera TMX (Translation Memory eXchange format)
    let mut tmx = String::from(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tmx SYSTEM "tmx14.dtd">
<tmx version="1.4">
  <header
    creationtool="GameStringer"
    creationtoolversion="1.0"
    datatype="plaintext"
    segtype="sentence"
    adminlang="en"
    srclang=""#);
    
    tmx.push_str(&source_lang);
    tmx.push_str(r#""
    o-tmf="GameStringer TM">
  </header>
  <body>
"#);
    
    for unit in &memory.units {
        tmx.push_str(&format!(r#"    <tu tuid="{}">
      <tuv xml:lang="{}">
        <seg>{}</seg>
      </tuv>
      <tuv xml:lang="{}">
        <seg>{}</seg>
      </tuv>
    </tu>
"#,
            unit.id,
            source_lang,
            escape_xml(&unit.source_text),
            target_lang,
            escape_xml(&unit.target_text)
        ));
    }
    
    tmx.push_str("  </body>\n</tmx>");
    
    fs::write(&output_path, &tmx)
        .map_err(|e| format!("Errore scrittura TMX: {}", e))?;
    
    info!("✅ TMX esportato: {} ({} unità)", output_path, memory.units.len());
    Ok(output_path)
}

/// Escape caratteri XML
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&apos;")
}

/// 📥 Importa una Translation Memory da TMX
#[tauri::command]
pub fn import_translation_memory_tmx(
    tmx_path: String,
    source_lang: String,
    target_lang: String
) -> Result<u32, String> {
    info!("📥 Importazione TMX: {}", tmx_path);
    
    let content = fs::read_to_string(&tmx_path)
        .map_err(|e| format!("Errore lettura TMX: {}", e))?;
    
    // Parser TMX semplificato
    let mut units = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();
    
    // Regex per estrarre translation units
    let tu_regex = regex::Regex::new(r#"<tu[^>]*tuid="([^"]*)"[^>]*>[\s\S]*?<tuv[^>]*xml:lang="([^"]*)"[^>]*>\s*<seg>([\s\S]*?)</seg>[\s\S]*?<tuv[^>]*xml:lang="([^"]*)"[^>]*>\s*<seg>([\s\S]*?)</seg>[\s\S]*?</tu>"#)
        .map_err(|e| format!("Errore regex: {}", e))?;
    
    for cap in tu_regex.captures_iter(&content) {
        let id = cap.get(1).map_or("", |m| m.as_str());
        let lang1 = cap.get(2).map_or("", |m| m.as_str());
        let text1 = cap.get(3).map_or("", |m| m.as_str());
        let _lang2 = cap.get(4).map_or("", |m| m.as_str());
        let text2 = cap.get(5).map_or("", |m| m.as_str());
        
        // Determina source e target
        let (source_text, target_text) = if lang1.to_lowercase() == source_lang.to_lowercase() {
            (unescape_xml(text1), unescape_xml(text2))
        } else {
            (unescape_xml(text2), unescape_xml(text1))
        };
        
        units.push(TranslationUnit {
            id: if id.is_empty() { format!("imported_{}", units.len()) } else { id.to_string() },
            source_text,
            target_text,
            source_language: source_lang.clone(),
            target_language: target_lang.clone(),
            context: None,
            game_id: None,
            provider: "tmx_import".to_string(),
            confidence: 0.9,
            verified: true, // TMX sono tipicamente verificate
            usage_count: 0,
            created_at: now.clone(),
            updated_at: now.clone(),
            metadata: None,
        });
    }
    
    let count = units.len() as u32;
    
    // Carica TM esistente o crea nuova
    let mut memory = load_translation_memory(source_lang.clone(), target_lang.clone())?
        .unwrap_or_else(|| TranslationMemory {
            id: format!("tm_{}_{}", source_lang, target_lang),
            name: format!("{} → {}", source_lang.to_uppercase(), target_lang.to_uppercase()),
            source_language: source_lang.clone(),
            target_language: target_lang.clone(),
            units: Vec::new(),
            stats: TMStats {
                total_units: 0,
                verified_units: 0,
                total_usage_count: 0,
                average_confidence: 0.0,
                by_provider: std::collections::HashMap::new(),
                by_context: std::collections::HashMap::new(),
            },
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    
    // Aggiungi unità importate (evita duplicati)
    let existing_sources: std::collections::HashSet<_> = memory.units.iter()
        .map(|u| u.source_text.to_lowercase())
        .collect();
    
    for unit in units {
        if !existing_sources.contains(&unit.source_text.to_lowercase()) {
            memory.units.push(unit);
        }
    }
    
    // Aggiorna stats
    memory.stats.total_units = memory.units.len() as u32;
    memory.stats.verified_units = memory.units.iter().filter(|u| u.verified).count() as u32;
    memory.updated_at = now;
    
    save_translation_memory(memory)?;
    
    info!("✅ Importate {} unità da TMX", count);
    Ok(count)
}

/// Unescape caratteri XML
fn unescape_xml(s: &str) -> String {
    s.replace("&amp;", "&")
     .replace("&lt;", "<")
     .replace("&gt;", ">")
     .replace("&quot;", "\"")
     .replace("&apos;", "'")
}

/// 🔍 Risultato di un match nella TM
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TMMatch {
    pub unit: TranslationUnit,
    pub similarity: f64,
    pub match_type: String, // "exact", "fuzzy", "contains"
}

/// 🔍 Cerca traduzioni nella TM (fuzzy matching)
#[tauri::command]
pub fn search_translation_memory(
    source_text: String,
    source_lang: String,
    target_lang: String,
    min_similarity: Option<f64>,
    max_results: Option<usize>
) -> Result<Vec<TMMatch>, String> {
    info!("🔍 Ricerca TM: '{}' ({} → {})", 
        source_text.chars().take(50).collect::<String>(), 
        source_lang, target_lang);
    
    let memory = match load_translation_memory(source_lang, target_lang)? {
        Some(m) => m,
        None => return Ok(Vec::new()),
    };
    
    let min_sim = min_similarity.unwrap_or(0.6);
    let max_res = max_results.unwrap_or(10);
    let source_lower = source_text.to_lowercase();
    
    let mut matches: Vec<TMMatch> = memory.units.iter()
        .filter_map(|unit| {
            let unit_source_lower = unit.source_text.to_lowercase();
            
            // 1. Exact match
            if unit_source_lower == source_lower {
                return Some(TMMatch {
                    unit: unit.clone(),
                    similarity: 1.0,
                    match_type: "exact".to_string(),
                });
            }
            
            // 2. Contains match
            if unit_source_lower.contains(&source_lower) || source_lower.contains(&unit_source_lower) {
                let sim = calculate_similarity(&source_lower, &unit_source_lower);
                if sim >= min_sim {
                    return Some(TMMatch {
                        unit: unit.clone(),
                        similarity: sim,
                        match_type: "contains".to_string(),
                    });
                }
            }
            
            // 3. Fuzzy match (Levenshtein-based)
            let sim = calculate_similarity(&source_lower, &unit_source_lower);
            if sim >= min_sim {
                return Some(TMMatch {
                    unit: unit.clone(),
                    similarity: sim,
                    match_type: "fuzzy".to_string(),
                });
            }
            
            None
        })
        .collect();
    
    // Ordina per similarità decrescente
    matches.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
    matches.truncate(max_res);
    
    info!("✅ Trovati {} match (min similarity: {})", matches.len(), min_sim);
    Ok(matches)
}

/// Calcola similarità tra due stringhe (algoritmo Levenshtein normalizzato)
fn calculate_similarity(s1: &str, s2: &str) -> f64 {
    if s1 == s2 {
        return 1.0;
    }
    
    if s1.is_empty() || s2.is_empty() {
        return 0.0;
    }
    
    let len1 = s1.chars().count();
    let len2 = s2.chars().count();
    let max_len = len1.max(len2) as f64;
    
    // Usa bigrams per stringhe lunghe (più veloce)
    if len1 > 100 || len2 > 100 {
        return bigram_similarity(s1, s2);
    }
    
    let distance = levenshtein_distance(s1, s2);
    1.0 - (distance as f64 / max_len)
}

/// Distanza di Levenshtein
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let chars1: Vec<char> = s1.chars().collect();
    let chars2: Vec<char> = s2.chars().collect();
    let len1 = chars1.len();
    let len2 = chars2.len();
    
    if len1 == 0 { return len2; }
    if len2 == 0 { return len1; }
    
    let mut prev_row: Vec<usize> = (0..=len2).collect();
    let mut curr_row = vec![0; len2 + 1];
    
    for i in 1..=len1 {
        curr_row[0] = i;
        for j in 1..=len2 {
            let cost = if chars1[i - 1] == chars2[j - 1] { 0 } else { 1 };
            curr_row[j] = (prev_row[j] + 1)
                .min(curr_row[j - 1] + 1)
                .min(prev_row[j - 1] + cost);
        }
        std::mem::swap(&mut prev_row, &mut curr_row);
    }
    
    prev_row[len2]
}

/// Similarità basata su bigrams (per stringhe lunghe)
fn bigram_similarity(s1: &str, s2: &str) -> f64 {
    let bigrams1: std::collections::HashSet<_> = s1.chars()
        .collect::<Vec<_>>()
        .windows(2)
        .map(|w| (w[0], w[1]))
        .collect();
    
    let bigrams2: std::collections::HashSet<_> = s2.chars()
        .collect::<Vec<_>>()
        .windows(2)
        .map(|w| (w[0], w[1]))
        .collect();
    
    if bigrams1.is_empty() || bigrams2.is_empty() {
        return 0.0;
    }
    
    let intersection = bigrams1.intersection(&bigrams2).count();
    let union = bigrams1.union(&bigrams2).count();
    
    intersection as f64 / union as f64
}

/// ➕ Aggiungi una singola traduzione alla TM
#[tauri::command]
pub fn add_translation_to_memory(
    source_text: String,
    target_text: String,
    source_lang: String,
    target_lang: String,
    context: Option<String>,
    game_id: Option<String>,
    provider: Option<String>
) -> Result<(), String> {
    info!("➕ Aggiunta traduzione alla TM: '{}' → '{}'", 
        source_text.chars().take(30).collect::<String>(),
        target_text.chars().take(30).collect::<String>());
    
    let now = chrono::Utc::now().to_rfc3339();
    
    // Carica o crea TM
    let mut memory = load_translation_memory(source_lang.clone(), target_lang.clone())?
        .unwrap_or_else(|| TranslationMemory {
            id: format!("tm_{}_{}", source_lang, target_lang),
            name: format!("{} → {}", source_lang.to_uppercase(), target_lang.to_uppercase()),
            source_language: source_lang.clone(),
            target_language: target_lang.clone(),
            units: Vec::new(),
            stats: TMStats {
                total_units: 0,
                verified_units: 0,
                total_usage_count: 0,
                average_confidence: 0.0,
                by_provider: std::collections::HashMap::new(),
                by_context: std::collections::HashMap::new(),
            },
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    
    // Cerca se esiste già
    let source_lower = source_text.to_lowercase();
    if let Some(existing) = memory.units.iter_mut()
        .find(|u| u.source_text.to_lowercase() == source_lower) 
    {
        // Aggiorna esistente
        existing.target_text = target_text;
        existing.updated_at = now.clone();
        existing.usage_count += 1;
        info!("📝 Aggiornata traduzione esistente");
    } else {
        // Aggiungi nuova
        let unit = TranslationUnit {
            id: format!("tu_{}", uuid::Uuid::new_v4()),
            source_text,
            target_text,
            source_language: source_lang,
            target_language: target_lang,
            context,
            game_id,
            provider: provider.unwrap_or_else(|| "manual".to_string()),
            confidence: 1.0,
            verified: false,
            usage_count: 1,
            created_at: now.clone(),
            updated_at: now.clone(),
            metadata: None,
        };
        memory.units.push(unit);
        info!("✨ Aggiunta nuova traduzione");
    }
    
    // Aggiorna stats
    memory.stats.total_units = memory.units.len() as u32;
    memory.stats.verified_units = memory.units.iter().filter(|u| u.verified).count() as u32;
    memory.stats.total_usage_count = memory.units.iter().map(|u| u.usage_count).sum();
    memory.updated_at = now;
    
    save_translation_memory(memory)?;
    Ok(())
}

/// 🔄 Batch add - aggiunge multiple traduzioni
#[tauri::command]
pub fn add_translations_batch(
    translations: Vec<(String, String)>, // (source, target)
    source_lang: String,
    target_lang: String,
    game_id: Option<String>,
    provider: Option<String>
) -> Result<u32, String> {
    info!("🔄 Batch add: {} traduzioni", translations.len());
    
    let now = chrono::Utc::now().to_rfc3339();
    let prov = provider.unwrap_or_else(|| "batch".to_string());
    
    let mut memory = load_translation_memory(source_lang.clone(), target_lang.clone())?
        .unwrap_or_else(|| TranslationMemory {
            id: format!("tm_{}_{}", source_lang, target_lang),
            name: format!("{} → {}", source_lang.to_uppercase(), target_lang.to_uppercase()),
            source_language: source_lang.clone(),
            target_language: target_lang.clone(),
            units: Vec::new(),
            stats: TMStats {
                total_units: 0,
                verified_units: 0,
                total_usage_count: 0,
                average_confidence: 0.0,
                by_provider: std::collections::HashMap::new(),
                by_context: std::collections::HashMap::new(),
            },
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    
    let existing_sources: std::collections::HashSet<_> = memory.units.iter()
        .map(|u| u.source_text.to_lowercase())
        .collect();
    
    let mut added = 0u32;
    
    for (source, target) in translations {
        if source.trim().is_empty() || target.trim().is_empty() {
            continue;
        }
        
        if !existing_sources.contains(&source.to_lowercase()) {
            memory.units.push(TranslationUnit {
                id: format!("tu_{}", uuid::Uuid::new_v4()),
                source_text: source,
                target_text: target,
                source_language: source_lang.clone(),
                target_language: target_lang.clone(),
                context: None,
                game_id: game_id.clone(),
                provider: prov.clone(),
                confidence: 1.0,
                verified: false,
                usage_count: 1,
                created_at: now.clone(),
                updated_at: now.clone(),
                metadata: None,
            });
            added += 1;
        }
    }
    
    memory.stats.total_units = memory.units.len() as u32;
    memory.stats.verified_units = memory.units.iter().filter(|u| u.verified).count() as u32;
    memory.updated_at = now;
    
    save_translation_memory(memory)?;
    
    info!("✅ Aggiunte {} nuove traduzioni", added);
    Ok(added)
}
