use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;

/// Risultato diff tra due versioni di traduzione
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationDiff {
    pub game_id: String,
    pub source_language: String,
    pub target_language: String,
    pub version_a: String,
    pub version_b: String,
    pub generated_at: String,
    pub summary: DiffSummary,
    pub changes: Vec<DiffEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffSummary {
    pub total_keys: u32,
    pub added: u32,
    pub removed: u32,
    pub modified: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffEntry {
    pub key: String,
    pub change_type: DiffChangeType,
    pub source_text: Option<String>,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub context: Option<String>,
    pub inline_diff: Option<Vec<InlineDiffSegment>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiffChangeType {
    Added,
    Removed,
    Modified,
    Unchanged,
}

/// Segmento di diff inline (come git diff --word-diff)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InlineDiffSegment {
    pub text: String,
    pub segment_type: SegmentType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SegmentType {
    Equal,
    Added,
    Removed,
}

/// Formato generico di file traduzioni (key → value)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationFile {
    #[serde(flatten)]
    pub entries: HashMap<String, serde_json::Value>,
}

/// Snapshot salvato per versioning
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationSnapshot {
    pub id: String,
    pub game_id: String,
    pub label: String,
    pub target_language: String,
    pub created_at: String,
    pub entry_count: u32,
    pub entries: HashMap<String, String>,
}

fn get_snapshots_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir()
        .ok_or("Impossibile trovare directory dati locali")?;
    let dir = app_data.join("GameStringer").join("snapshots");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Errore creazione dir snapshots: {}", e))?;
    Ok(dir)
}

/// Salva uno snapshot delle traduzioni correnti
#[tauri::command]
pub async fn save_translation_snapshot(
    game_id: String,
    label: String,
    target_language: String,
    entries: HashMap<String, String>,
) -> Result<TranslationSnapshot, String> {
    let dir = get_snapshots_dir()?;
    let now = Utc::now();
    let id = format!("{}_{}", game_id, now.format("%Y%m%d_%H%M%S"));

    let snapshot = TranslationSnapshot {
        id: id.clone(),
        game_id: game_id.clone(),
        label,
        target_language,
        created_at: now.to_rfc3339(),
        entry_count: entries.len() as u32,
        entries,
    };

    let path = dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Errore salvataggio snapshot: {}", e))?;

    log::info!("📸 Snapshot salvato: {} ({} entries)", id, snapshot.entry_count);
    Ok(snapshot)
}

/// Lista tutti gli snapshot per un gioco
#[tauri::command]
pub async fn list_translation_snapshots(game_id: String) -> Result<Vec<TranslationSnapshot>, String> {
    let dir = get_snapshots_dir()?;
    let mut snapshots = Vec::new();
    let prefix = format!("{}_", game_id);

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "json") {
                if let Some(name) = path.file_stem() {
                    if name.to_string_lossy().starts_with(&prefix) {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if let Ok(snap) = serde_json::from_str::<TranslationSnapshot>(&content) {
                                snapshots.push(snap);
                            }
                        }
                    }
                }
            }
        }
    }

    snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(snapshots)
}

/// Elimina uno snapshot
#[tauri::command]
pub async fn delete_translation_snapshot(snapshot_id: String) -> Result<(), String> {
    let dir = get_snapshots_dir()?;
    let path = dir.join(format!("{}.json", snapshot_id));
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Errore eliminazione: {}", e))?;
    }
    Ok(())
}

/// Confronta due snapshot e genera un diff
#[tauri::command]
pub async fn diff_translation_snapshots(
    snapshot_id_a: String,
    snapshot_id_b: String,
) -> Result<TranslationDiff, String> {
    let dir = get_snapshots_dir()?;

    let snap_a = load_snapshot(&dir, &snapshot_id_a)?;
    let snap_b = load_snapshot(&dir, &snapshot_id_b)?;

    Ok(compute_diff(&snap_a, &snap_b))
}

/// Confronta traduzioni correnti con uno snapshot
#[tauri::command]
pub async fn diff_current_vs_snapshot(
    snapshot_id: String,
    current_entries: HashMap<String, String>,
    game_id: String,
    target_language: String,
) -> Result<TranslationDiff, String> {
    let dir = get_snapshots_dir()?;
    let snap_a = load_snapshot(&dir, &snapshot_id)?;

    let snap_b = TranslationSnapshot {
        id: "current".to_string(),
        game_id,
        label: "Versione corrente".to_string(),
        target_language,
        created_at: Utc::now().to_rfc3339(),
        entry_count: current_entries.len() as u32,
        entries: current_entries,
    };

    Ok(compute_diff(&snap_a, &snap_b))
}

/// Confronta due file di traduzione (JSON key-value)
#[tauri::command]
pub async fn diff_translation_files(
    file_a_path: String,
    file_b_path: String,
    game_id: Option<String>,
) -> Result<TranslationDiff, String> {
    let content_a = fs::read_to_string(&file_a_path)
        .map_err(|e| format!("Errore lettura file A: {}", e))?;
    let content_b = fs::read_to_string(&file_b_path)
        .map_err(|e| format!("Errore lettura file B: {}", e))?;

    let entries_a = parse_translation_entries(&content_a)?;
    let entries_b = parse_translation_entries(&content_b)?;

    let snap_a = TranslationSnapshot {
        id: file_a_path.clone(),
        game_id: game_id.clone().unwrap_or_default(),
        label: file_a_path,
        target_language: String::new(),
        created_at: String::new(),
        entry_count: entries_a.len() as u32,
        entries: entries_a,
    };
    let snap_b = TranslationSnapshot {
        id: file_b_path.clone(),
        game_id: game_id.unwrap_or_default(),
        label: file_b_path,
        target_language: String::new(),
        created_at: String::new(),
        entry_count: entries_b.len() as u32,
        entries: entries_b,
    };

    Ok(compute_diff(&snap_a, &snap_b))
}

fn load_snapshot(dir: &Path, id: &str) -> Result<TranslationSnapshot, String> {
    let path = dir.join(format!("{}.json", id));
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Snapshot '{}' non trovato: {}", id, e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing snapshot: {}", e))
}

fn parse_translation_entries(content: &str) -> Result<HashMap<String, String>, String> {
    // Prova JSON flat (key: value)
    if let Ok(map) = serde_json::from_str::<HashMap<String, serde_json::Value>>(content) {
        let result: HashMap<String, String> = map.into_iter()
            .map(|(k, v)| {
                let s = match v {
                    serde_json::Value::String(s) => s,
                    other => other.to_string(),
                };
                (k, s)
            })
            .collect();
        return Ok(result);
    }
    Err("Formato file non supportato. Usa JSON key-value.".to_string())
}

fn compute_diff(snap_a: &TranslationSnapshot, snap_b: &TranslationSnapshot) -> TranslationDiff {
    let mut changes = Vec::new();
    let mut added = 0u32;
    let mut removed = 0u32;
    let mut modified = 0u32;
    let mut unchanged = 0u32;

    // Chiavi in A
    for (key, val_a) in &snap_a.entries {
        if let Some(val_b) = snap_b.entries.get(key) {
            if val_a == val_b {
                unchanged += 1;
                // Non includiamo unchanged nel diff per brevità
            } else {
                modified += 1;
                changes.push(DiffEntry {
                    key: key.clone(),
                    change_type: DiffChangeType::Modified,
                    source_text: None,
                    old_value: Some(val_a.clone()),
                    new_value: Some(val_b.clone()),
                    context: None,
                    inline_diff: Some(compute_inline_diff(val_a, val_b)),
                });
            }
        } else {
            removed += 1;
            changes.push(DiffEntry {
                key: key.clone(),
                change_type: DiffChangeType::Removed,
                source_text: None,
                old_value: Some(val_a.clone()),
                new_value: None,
                context: None,
                inline_diff: None,
            });
        }
    }

    // Chiavi solo in B (aggiunte)
    for (key, val_b) in &snap_b.entries {
        if !snap_a.entries.contains_key(key) {
            added += 1;
            changes.push(DiffEntry {
                key: key.clone(),
                change_type: DiffChangeType::Added,
                source_text: None,
                old_value: None,
                new_value: Some(val_b.clone()),
                context: None,
                inline_diff: None,
            });
        }
    }

    // Ordina: removed, modified, added
    changes.sort_by(|a, b| {
        let order = |ct: &DiffChangeType| match ct {
            DiffChangeType::Removed => 0,
            DiffChangeType::Modified => 1,
            DiffChangeType::Added => 2,
            DiffChangeType::Unchanged => 3,
        };
        order(&a.change_type).cmp(&order(&b.change_type))
            .then(a.key.cmp(&b.key))
    });

    let total_keys = snap_a.entries.len().max(snap_b.entries.len()) as u32;

    TranslationDiff {
        game_id: snap_a.game_id.clone(),
        source_language: String::new(),
        target_language: snap_a.target_language.clone(),
        version_a: snap_a.label.clone(),
        version_b: snap_b.label.clone(),
        generated_at: Utc::now().to_rfc3339(),
        summary: DiffSummary {
            total_keys,
            added,
            removed,
            modified,
            unchanged,
        },
        changes,
    }
}

/// Word-level inline diff (simile a git diff --word-diff)
fn compute_inline_diff(old: &str, new: &str) -> Vec<InlineDiffSegment> {
    let old_words: Vec<&str> = old.split_whitespace().collect();
    let new_words: Vec<&str> = new.split_whitespace().collect();

    // LCS (Longest Common Subsequence) per diff a livello di parole
    let m = old_words.len();
    let n = new_words.len();
    let mut dp = vec![vec![0u32; n + 1]; m + 1];

    for i in 1..=m {
        for j in 1..=n {
            if old_words[i - 1] == new_words[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    // Backtrack per generare segmenti
    let mut segments = Vec::new();
    let mut i = m;
    let mut j = n;
    let mut result: Vec<(SegmentType, String)> = Vec::new();

    while i > 0 || j > 0 {
        if i > 0 && j > 0 && old_words[i - 1] == new_words[j - 1] {
            result.push((SegmentType::Equal, old_words[i - 1].to_string()));
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            result.push((SegmentType::Added, new_words[j - 1].to_string()));
            j -= 1;
        } else if i > 0 {
            result.push((SegmentType::Removed, old_words[i - 1].to_string()));
            i -= 1;
        }
    }

    result.reverse();

    // Merge segmenti consecutivi dello stesso tipo
    for (seg_type, text) in result {
        if let Some(last) = segments.last_mut() {
            let last_seg: &mut InlineDiffSegment = last;
            if std::mem::discriminant(&last_seg.segment_type) == std::mem::discriminant(&seg_type) {
                last_seg.text.push(' ');
                last_seg.text.push_str(&text);
                continue;
            }
        }
        segments.push(InlineDiffSegment {
            text,
            segment_type: seg_type,
        });
    }

    segments
}
