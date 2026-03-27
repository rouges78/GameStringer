use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

/// Statistiche globali traduzione
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationDashboardStats {
    pub total_games: u32,
    pub total_tm_units: u32,
    pub total_glossary_entries: u32,
    pub total_dictionary_entries: u32,
    pub total_strings: u32,
    pub total_translated: u32,
    pub overall_progress: f64,
    pub games: Vec<GameTranslationStats>,
    pub language_pairs: Vec<LanguagePairStats>,
    pub recent_activity: Vec<ActivityEntry>,
}

/// Statistiche traduzione per singolo gioco
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameTranslationStats {
    pub game_id: String,
    pub game_name: String,
    pub source_language: String,
    pub target_language: String,
    pub total_strings: u32,
    pub translated_strings: u32,
    pub reviewed_strings: u32,
    pub pending_strings: u32,
    pub progress_percent: f64,
    pub glossary_entries: u32,
    pub tm_matches: u32,
    pub last_updated: Option<String>,
}

/// Statistiche per coppia di lingue
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguagePairStats {
    pub source_language: String,
    pub target_language: String,
    pub tm_units: u32,
    pub games_count: u32,
}

/// Voce di attività recente
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub timestamp: String,
    pub activity_type: String, // "translation", "glossary", "tm_update", "export", "import"
    pub description: String,
    pub game_id: Option<String>,
    pub game_name: Option<String>,
}

/// Raccoglie tutte le statistiche per la dashboard
#[tauri::command]
pub async fn get_translation_dashboard_stats() -> Result<TranslationDashboardStats, String> {
    log::info!("📊 Raccolta statistiche dashboard traduzione");

    let mut stats = TranslationDashboardStats {
        total_games: 0,
        total_tm_units: 0,
        total_glossary_entries: 0,
        total_dictionary_entries: 0,
        total_strings: 0,
        total_translated: 0,
        overall_progress: 0.0,
        games: Vec::new(),
        language_pairs: Vec::new(),
        recent_activity: Vec::new(),
    };

    // 1. Glossari
    let mut game_map: HashMap<String, GameTranslationStats> = HashMap::new();
    if let Ok(glossaries) = crate::commands::glossary::list_glossaries().await {
        for gl in &glossaries {
            let entry = game_map.entry(gl.game_id.clone()).or_insert(GameTranslationStats {
                game_id: gl.game_id.clone(),
                game_name: gl.game_name.clone(),
                source_language: gl.source_language.clone(),
                target_language: gl.target_language.clone(),
                total_strings: 0,
                translated_strings: 0,
                reviewed_strings: 0,
                pending_strings: 0,
                progress_percent: 0.0,
                glossary_entries: 0,
                tm_matches: 0,
                last_updated: Some(gl.updated_at.clone()),
            });
            entry.glossary_entries = gl.entries.len() as u32;
            stats.total_glossary_entries += gl.entries.len() as u32;
        }
    }

    // 2. Translation Memory
    let mut lp_map: HashMap<String, LanguagePairStats> = HashMap::new();
    if let Ok(tms) = crate::commands::translation_memory::list_translation_memories() {
        for tm in &tms {
            stats.total_tm_units += tm.unit_count;
            let key = format!("{}->{}", tm.source_language, tm.target_language);
            let lp = lp_map.entry(key).or_insert(LanguagePairStats {
                source_language: tm.source_language.clone(),
                target_language: tm.target_language.clone(),
                tm_units: 0,
                games_count: 0,
            });
            lp.tm_units += tm.unit_count;

            // Associa TM units ai giochi con stessa coppia lingue
            for game_stats in game_map.values_mut() {
                if game_stats.source_language == tm.source_language
                    && game_stats.target_language == tm.target_language
                {
                    game_stats.tm_matches = tm.unit_count;
                }
            }
        }
    }

    // 3. Stringhe tradotte (da project_export)
    let projects_dir = dirs::data_local_dir()
        .map(|d| d.join("GameStringer").join("projects"));
    if let Some(dir) = projects_dir {
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "json") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if let Ok(strings) = serde_json::from_str::<crate::commands::project_export::TranslationStrings>(&content) {
                                let total = strings.entries.len() as u32;
                                let translated = strings.entries.iter()
                                    .filter(|e| e.status == "translated" || e.status == "reviewed")
                                    .count() as u32;
                                let reviewed = strings.entries.iter()
                                    .filter(|e| e.status == "reviewed")
                                    .count() as u32;

                                stats.total_strings += total;
                                stats.total_translated += translated;

                                if let Some(game_stats) = game_map.get_mut(&strings.game_id) {
                                    game_stats.total_strings = total;
                                    game_stats.translated_strings = translated;
                                    game_stats.reviewed_strings = reviewed;
                                    game_stats.pending_strings = total.saturating_sub(translated);
                                    if total > 0 {
                                        game_stats.progress_percent = (translated as f64 / total as f64) * 100.0;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Dizionari
    if let Ok(dicts) = crate::commands::game_dictionaries::list_installed_dictionaries().await {
        for dict in &dicts {
            stats.total_dictionary_entries += dict.entries_count as u32;
        }
    }

    // Finalizza
    for lp in lp_map.values_mut() {
        lp.games_count = game_map.values()
            .filter(|g| g.source_language == lp.source_language && g.target_language == lp.target_language)
            .count() as u32;
    }

    stats.total_games = game_map.len() as u32;
    if stats.total_strings > 0 {
        stats.overall_progress = (stats.total_translated as f64 / stats.total_strings as f64) * 100.0;
    }

    stats.games = game_map.into_values().collect();
    stats.games.sort_by(|a, b| b.progress_percent.partial_cmp(&a.progress_percent).unwrap_or(std::cmp::Ordering::Equal));
    stats.language_pairs = lp_map.into_values().collect();

    // Attività recente dagli snapshot
    let snapshots_dir = dirs::data_local_dir()
        .map(|d| d.join("GameStringer").join("snapshots"));
    if let Some(dir) = snapshots_dir {
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "json") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if let Ok(snap) = serde_json::from_str::<crate::commands::translation_diff::TranslationSnapshot>(&content) {
                                stats.recent_activity.push(ActivityEntry {
                                    timestamp: snap.created_at,
                                    activity_type: "snapshot".to_string(),
                                    description: format!("Snapshot: {}", snap.label),
                                    game_id: Some(snap.game_id),
                                    game_name: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    stats.recent_activity.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    stats.recent_activity.truncate(20);

    log::info!("📊 Dashboard: {} giochi, {} TM units, {} glossario, {:.1}% progresso",
        stats.total_games, stats.total_tm_units, stats.total_glossary_entries, stats.overall_progress);

    Ok(stats)
}

/// Statistiche per un singolo gioco
#[tauri::command]
pub async fn get_game_translation_stats(game_id: String) -> Result<Option<GameTranslationStats>, String> {
    let dashboard = get_translation_dashboard_stats().await?;
    Ok(dashboard.games.into_iter().find(|g| g.game_id == game_id))
}
