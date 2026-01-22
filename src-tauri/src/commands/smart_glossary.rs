use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use chrono::Utc;

/// 📚 Smart Glossary 3-Tier System
/// 
/// Sistema di glossario a 3 livelli ispirato a miHoYo (Genshin Impact):
/// 
/// 1. **LOCKED** (Core Terms) - Termini bloccati, mai modificabili
///    - Nomi personaggi, luoghi, titoli
///    - Devono essere sempre identici in tutto il gioco
/// 
/// 2. **SYNCED** (System Terms) - Termini sincronizzati
///    - UI, menu, messaggi di sistema
///    - Aggiornati insieme tra versioni
/// 
/// 3. **FLEXIBLE** (Scene Terms) - Termini flessibili
///    - Dialoghi, descrizioni, quest
///    - Permettono adattamento contestuale

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GlossaryTier {
    Locked,    // Core terms - never change
    Synced,    // System terms - update together
    Flexible,  // Scene terms - context-dependent
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryTerm {
    pub id: String,
    pub source_term: String,
    pub target_term: String,
    pub source_lang: String,
    pub target_lang: String,
    pub tier: GlossaryTier,
    pub category: Option<String>,        // character, location, item, ui, etc.
    pub context: Option<String>,         // Additional context for translators
    pub notes: Option<String>,           // Translator notes
    pub alternatives: Vec<String>,       // Alternative translations (for flexible)
    pub do_not_translate: bool,          // Keep original (like "Liyue")
    pub case_sensitive: bool,
    pub usage_count: u32,
    pub created_at: String,
    pub updated_at: String,
    pub created_by: Option<String>,
    pub game_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartGlossary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub source_lang: String,
    pub target_lang: String,
    pub terms: Vec<GlossaryTerm>,
    pub stats: GlossaryStats,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryStats {
    pub total_terms: u32,
    pub locked_terms: u32,
    pub synced_terms: u32,
    pub flexible_terms: u32,
    pub by_category: HashMap<String, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsistencyIssue {
    pub term_id: String,
    pub source_term: String,
    pub expected: String,
    pub found: String,
    pub location: String,
    pub tier: GlossaryTier,
    pub severity: String,  // error for locked, warning for synced, info for flexible
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextHint {
    pub category: String,
    pub hint_type: String,  // cultural, linguistic, technical
    pub message: String,
    pub examples: Vec<String>,
    pub source_culture: String,
    pub target_culture: String,
}

/// Ottiene la directory del glossary
fn get_glossary_dir() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir()
        .ok_or("Impossibile trovare directory dati")?
        .join("GameStringer")
        .join("glossaries");
    
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    Ok(data_dir)
}

/// Carica o crea un glossary
#[tauri::command]
pub fn load_smart_glossary(
    source_lang: String,
    target_lang: String,
    game_id: Option<String>
) -> Result<SmartGlossary, String> {
    let dir = get_glossary_dir()?;
    let filename = match &game_id {
        Some(id) => format!("glossary_{}_{}_{}.json", id, source_lang, target_lang),
        None => format!("glossary_global_{}_{}.json", source_lang, target_lang),
    };
    let filepath = dir.join(&filename);
    
    if filepath.exists() {
        let content = fs::read_to_string(&filepath)
            .map_err(|e| format!("Errore lettura glossary: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Errore parsing glossary: {}", e))
    } else {
        // Crea nuovo glossary
        let now = Utc::now().to_rfc3339();
        Ok(SmartGlossary {
            id: format!("gl_{}_{}", source_lang, target_lang),
            name: format!("{} → {} Glossary", source_lang.to_uppercase(), target_lang.to_uppercase()),
            description: None,
            source_lang,
            target_lang,
            terms: Vec::new(),
            stats: GlossaryStats::default(),
            created_at: now.clone(),
            updated_at: now,
        })
    }
}

/// Salva un glossary
#[tauri::command]
pub fn save_smart_glossary(glossary: SmartGlossary, game_id: Option<String>) -> Result<(), String> {
    let dir = get_glossary_dir()?;
    let filename = match &game_id {
        Some(id) => format!("glossary_{}_{}_{}.json", id, glossary.source_lang, glossary.target_lang),
        None => format!("glossary_global_{}_{}.json", glossary.source_lang, glossary.target_lang),
    };
    let filepath = dir.join(&filename);
    
    // Ricalcola stats
    let mut glossary = glossary;
    glossary.stats = calculate_stats(&glossary.terms);
    glossary.updated_at = Utc::now().to_rfc3339();
    
    let json = serde_json::to_string_pretty(&glossary)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    
    fs::write(&filepath, json)
        .map_err(|e| format!("Errore scrittura: {}", e))
}

/// Aggiunge un termine al glossary
#[tauri::command]
pub fn add_glossary_term(
    source_term: String,
    target_term: String,
    source_lang: String,
    target_lang: String,
    tier: String,
    category: Option<String>,
    context: Option<String>,
    do_not_translate: Option<bool>,
    game_id: Option<String>,
) -> Result<GlossaryTerm, String> {
    let mut glossary = load_smart_glossary(source_lang.clone(), target_lang.clone(), game_id.clone())?;
    
    // Verifica se esiste già
    if glossary.terms.iter().any(|t| t.source_term.to_lowercase() == source_term.to_lowercase()) {
        return Err("Termine già presente nel glossary".to_string());
    }
    
    let now = Utc::now().to_rfc3339();
    let term = GlossaryTerm {
        id: format!("term_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        source_term: source_term.clone(),
        target_term,
        source_lang: source_lang.clone(),
        target_lang: target_lang.clone(),
        tier: match tier.to_lowercase().as_str() {
            "locked" => GlossaryTier::Locked,
            "synced" => GlossaryTier::Synced,
            _ => GlossaryTier::Flexible,
        },
        category,
        context,
        notes: None,
        alternatives: Vec::new(),
        do_not_translate: do_not_translate.unwrap_or(false),
        case_sensitive: true,
        usage_count: 0,
        created_at: now.clone(),
        updated_at: now,
        created_by: None,
        game_id,
    };
    
    glossary.terms.push(term.clone());
    save_smart_glossary(glossary, term.game_id.clone())?;
    
    Ok(term)
}

/// Aggiorna un termine esistente
#[tauri::command]
pub fn update_glossary_term(
    term_id: String,
    target_term: Option<String>,
    tier: Option<String>,
    category: Option<String>,
    context: Option<String>,
    alternatives: Option<Vec<String>>,
    source_lang: String,
    target_lang: String,
    game_id: Option<String>,
) -> Result<GlossaryTerm, String> {
    let mut glossary = load_smart_glossary(source_lang, target_lang, game_id.clone())?;
    
    let term = glossary.terms.iter_mut()
        .find(|t| t.id == term_id)
        .ok_or("Termine non trovato")?;
    
    // Verifica se locked
    if term.tier == GlossaryTier::Locked && tier.is_some() {
        return Err("Non puoi cambiare il tier di un termine LOCKED".to_string());
    }
    
    if let Some(tt) = target_term {
        term.target_term = tt;
    }
    if let Some(t) = tier {
        term.tier = match t.to_lowercase().as_str() {
            "locked" => GlossaryTier::Locked,
            "synced" => GlossaryTier::Synced,
            _ => GlossaryTier::Flexible,
        };
    }
    if let Some(c) = category {
        term.category = Some(c);
    }
    if let Some(ctx) = context {
        term.context = Some(ctx);
    }
    if let Some(alts) = alternatives {
        term.alternatives = alts;
    }
    term.updated_at = Utc::now().to_rfc3339();
    
    let updated = term.clone();
    save_smart_glossary(glossary, game_id)?;
    
    Ok(updated)
}

/// Elimina un termine
#[tauri::command]
pub fn delete_glossary_term(
    term_id: String,
    source_lang: String,
    target_lang: String,
    game_id: Option<String>,
    force: Option<bool>,
) -> Result<(), String> {
    let mut glossary = load_smart_glossary(source_lang, target_lang, game_id.clone())?;
    
    // Trova il termine
    let idx = glossary.terms.iter().position(|t| t.id == term_id)
        .ok_or("Termine non trovato")?;
    
    // Verifica se locked
    if glossary.terms[idx].tier == GlossaryTier::Locked && !force.unwrap_or(false) {
        return Err("Non puoi eliminare un termine LOCKED senza force=true".to_string());
    }
    
    glossary.terms.remove(idx);
    save_smart_glossary(glossary, game_id)
}

/// Cerca termini nel glossary
#[tauri::command]
pub fn search_glossary_terms(
    query: String,
    source_lang: String,
    target_lang: String,
    tier_filter: Option<String>,
    category_filter: Option<String>,
    game_id: Option<String>,
) -> Result<Vec<GlossaryTerm>, String> {
    let glossary = load_smart_glossary(source_lang, target_lang, game_id)?;
    
    let query_lower = query.to_lowercase();
    
    let results: Vec<GlossaryTerm> = glossary.terms.into_iter()
        .filter(|t| {
            // Match query
            let matches_query = query.is_empty() || 
                t.source_term.to_lowercase().contains(&query_lower) ||
                t.target_term.to_lowercase().contains(&query_lower);
            
            // Match tier filter
            let matches_tier = tier_filter.as_ref().map_or(true, |f| {
                match f.to_lowercase().as_str() {
                    "locked" => t.tier == GlossaryTier::Locked,
                    "synced" => t.tier == GlossaryTier::Synced,
                    "flexible" => t.tier == GlossaryTier::Flexible,
                    _ => true,
                }
            });
            
            // Match category filter
            let matches_category = category_filter.as_ref().map_or(true, |f| {
                t.category.as_ref().map_or(false, |c| c.to_lowercase() == f.to_lowercase())
            });
            
            matches_query && matches_tier && matches_category
        })
        .collect();
    
    Ok(results)
}

/// Applica glossary a un testo (trova e sostituisce)
#[tauri::command]
pub fn apply_glossary_to_text(
    text: String,
    source_lang: String,
    target_lang: String,
    game_id: Option<String>,
    tier_priority: Option<Vec<String>>,  // Ordine di priorità: ["locked", "synced", "flexible"]
) -> Result<GlossaryApplyResult, String> {
    let glossary = load_smart_glossary(source_lang, target_lang, game_id)?;
    
    let mut result_text = text.clone();
    let mut applied_terms: Vec<AppliedTerm> = Vec::new();
    
    // Ordina termini per lunghezza (più lunghi prima per evitare match parziali)
    let mut sorted_terms = glossary.terms.clone();
    sorted_terms.sort_by(|a, b| b.source_term.len().cmp(&a.source_term.len()));
    
    // Filtra per tier priority se specificato
    if let Some(priority) = &tier_priority {
        sorted_terms.retain(|t| {
            let tier_str = match t.tier {
                GlossaryTier::Locked => "locked",
                GlossaryTier::Synced => "synced",
                GlossaryTier::Flexible => "flexible",
            };
            priority.iter().any(|p| p.to_lowercase() == tier_str)
        });
    }
    
    for term in &sorted_terms {
        let search = if term.case_sensitive {
            &term.source_term
        } else {
            &term.source_term.to_lowercase()
        };
        
        let text_to_search = if term.case_sensitive {
            result_text.clone()
        } else {
            result_text.to_lowercase()
        };
        
        if text_to_search.contains(search) {
            let replacement = if term.do_not_translate {
                term.source_term.clone()
            } else {
                term.target_term.clone()
            };
            
            // Conta occorrenze
            let count = text_to_search.matches(search).count();
            
            // Sostituisci (case-insensitive replacement)
            if term.case_sensitive {
                result_text = result_text.replace(&term.source_term, &replacement);
            } else {
                result_text = case_insensitive_replace(&result_text, &term.source_term, &replacement);
            }
            
            applied_terms.push(AppliedTerm {
                term_id: term.id.clone(),
                source: term.source_term.clone(),
                target: replacement,
                tier: term.tier.clone(),
                occurrences: count as u32,
            });
        }
    }
    
    Ok(GlossaryApplyResult {
        original_text: text,
        translated_text: result_text,
        applied_terms,
        terms_applied: applied_terms.len() as u32,
    })
}

fn case_insensitive_replace(text: &str, from: &str, to: &str) -> String {
    let lower_text = text.to_lowercase();
    let lower_from = from.to_lowercase();
    
    let mut result = String::new();
    let mut last_end = 0;
    
    for (start, _) in lower_text.match_indices(&lower_from) {
        result.push_str(&text[last_end..start]);
        result.push_str(to);
        last_end = start + from.len();
    }
    result.push_str(&text[last_end..]);
    
    result
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryApplyResult {
    pub original_text: String,
    pub translated_text: String,
    pub applied_terms: Vec<AppliedTerm>,
    pub terms_applied: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedTerm {
    pub term_id: String,
    pub source: String,
    pub target: String,
    pub tier: GlossaryTier,
    pub occurrences: u32,
}

/// Verifica consistenza in un batch di traduzioni
#[tauri::command]
pub fn check_glossary_consistency(
    translations: Vec<TranslationPair>,
    source_lang: String,
    target_lang: String,
    game_id: Option<String>,
) -> Result<ConsistencyCheckResult, String> {
    let glossary = load_smart_glossary(source_lang, target_lang, game_id)?;
    let mut issues: Vec<ConsistencyIssue> = Vec::new();
    
    for (idx, pair) in translations.iter().enumerate() {
        for term in &glossary.terms {
            // Cerca il termine source nel testo originale
            let source_lower = pair.source.to_lowercase();
            let term_lower = term.source_term.to_lowercase();
            
            if source_lower.contains(&term_lower) {
                // Verifica che il target contenga la traduzione corretta
                let target_lower = pair.target.to_lowercase();
                let expected_lower = term.target_term.to_lowercase();
                
                if !target_lower.contains(&expected_lower) && !term.do_not_translate {
                    let severity = match term.tier {
                        GlossaryTier::Locked => "error",
                        GlossaryTier::Synced => "warning",
                        GlossaryTier::Flexible => "info",
                    };
                    
                    issues.push(ConsistencyIssue {
                        term_id: term.id.clone(),
                        source_term: term.source_term.clone(),
                        expected: term.target_term.clone(),
                        found: pair.target.clone(),
                        location: format!("Row {}", idx + 1),
                        tier: term.tier.clone(),
                        severity: severity.to_string(),
                    });
                }
            }
        }
    }
    
    let errors = issues.iter().filter(|i| i.severity == "error").count() as u32;
    let warnings = issues.iter().filter(|i| i.severity == "warning").count() as u32;
    
    Ok(ConsistencyCheckResult {
        total_checked: translations.len() as u32,
        issues_found: issues.len() as u32,
        errors,
        warnings,
        issues,
        passed: errors == 0,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationPair {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsistencyCheckResult {
    pub total_checked: u32,
    pub issues_found: u32,
    pub errors: u32,
    pub warnings: u32,
    pub issues: Vec<ConsistencyIssue>,
    pub passed: bool,
}

/// Import termini da CSV
#[tauri::command]
pub fn import_glossary_csv(
    csv_content: String,
    source_lang: String,
    target_lang: String,
    default_tier: String,
    game_id: Option<String>,
) -> Result<u32, String> {
    let mut glossary = load_smart_glossary(source_lang.clone(), target_lang.clone(), game_id.clone())?;
    let mut imported = 0u32;
    
    for line in csv_content.lines().skip(1) {  // Skip header
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 2 {
            let source = parts[0].trim().trim_matches('"');
            let target = parts[1].trim().trim_matches('"');
            
            if source.is_empty() || target.is_empty() {
                continue;
            }
            
            // Skip if exists
            if glossary.terms.iter().any(|t| t.source_term.to_lowercase() == source.to_lowercase()) {
                continue;
            }
            
            let tier = if parts.len() > 2 {
                match parts[2].trim().to_lowercase().as_str() {
                    "locked" => GlossaryTier::Locked,
                    "synced" => GlossaryTier::Synced,
                    _ => GlossaryTier::Flexible,
                }
            } else {
                match default_tier.to_lowercase().as_str() {
                    "locked" => GlossaryTier::Locked,
                    "synced" => GlossaryTier::Synced,
                    _ => GlossaryTier::Flexible,
                }
            };
            
            let category = if parts.len() > 3 {
                Some(parts[3].trim().trim_matches('"').to_string())
            } else {
                None
            };
            
            let now = Utc::now().to_rfc3339();
            glossary.terms.push(GlossaryTerm {
                id: format!("term_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
                source_term: source.to_string(),
                target_term: target.to_string(),
                source_lang: source_lang.clone(),
                target_lang: target_lang.clone(),
                tier,
                category,
                context: None,
                notes: None,
                alternatives: Vec::new(),
                do_not_translate: false,
                case_sensitive: true,
                usage_count: 0,
                created_at: now.clone(),
                updated_at: now,
                created_by: None,
                game_id: game_id.clone(),
            });
            
            imported += 1;
        }
    }
    
    save_smart_glossary(glossary, game_id)?;
    Ok(imported)
}

/// Calcola statistiche
fn calculate_stats(terms: &[GlossaryTerm]) -> GlossaryStats {
    let mut stats = GlossaryStats {
        total_terms: terms.len() as u32,
        locked_terms: 0,
        synced_terms: 0,
        flexible_terms: 0,
        by_category: HashMap::new(),
    };
    
    for term in terms {
        match term.tier {
            GlossaryTier::Locked => stats.locked_terms += 1,
            GlossaryTier::Synced => stats.synced_terms += 1,
            GlossaryTier::Flexible => stats.flexible_terms += 1,
        }
        
        if let Some(cat) = &term.category {
            *stats.by_category.entry(cat.clone()).or_insert(0) += 1;
        }
    }
    
    stats
}

/// Lista categorie disponibili
#[tauri::command]
pub fn get_glossary_categories() -> Vec<String> {
    vec![
        "character".to_string(),
        "location".to_string(),
        "item".to_string(),
        "skill".to_string(),
        "quest".to_string(),
        "ui".to_string(),
        "system".to_string(),
        "lore".to_string(),
        "creature".to_string(),
        "faction".to_string(),
    ]
}

/// Ottiene statistiche glossary
#[tauri::command]
pub fn get_glossary_stats(
    source_lang: String,
    target_lang: String,
    game_id: Option<String>,
) -> Result<GlossaryStats, String> {
    let glossary = load_smart_glossary(source_lang, target_lang, game_id)?;
    Ok(glossary.stats)
}
