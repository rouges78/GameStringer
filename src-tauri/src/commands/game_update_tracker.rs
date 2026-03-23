//! Game Update Tracker
//!
//! Rileva quando un gioco Steam viene aggiornato confrontando il buildid
//! corrente (da appmanifest_XXXX.acf) con quello precedentemente salvato.
//! Verifica anche l'integrità delle patch di traduzione installate.

use tauri::command;
use std::path::{Path, PathBuf};
use std::fs;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// ──────────────────────────────────────────────────────────────────────────────
// Tipi
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GameUpdateState {
    /// buildid noto (ultimo confermato dall'utente)
    pub known_build_id: String,
    /// data ultima verifica (ISO 8601)
    pub last_checked: String,
    /// patch era intatta all'ultima verifica
    pub patch_was_intact: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    /// buildid corrente dal manifest Steam
    pub current_build_id: String,
    /// buildid noto salvato
    pub known_build_id: String,
    /// il gioco è stato aggiornato dall'ultima verifica?
    pub update_detected: bool,
    /// la patch di traduzione è ancora intatta?
    pub patch_intact: bool,
    /// tipo di patch trovata (bepinex, unreal_pak, nessuna)
    pub patch_type: String,
    /// dettagli sulla patch (file trovati/mancanti)
    pub patch_details: Vec<String>,
    /// messaggio leggibile
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct TrackingStore {
    games: HashMap<String, GameUpdateState>,
}

// ──────────────────────────────────────────────────────────────────────────────
// Storage: %APPDATA%/GameStringer/update_tracking.json
// ──────────────────────────────────────────────────────────────────────────────

fn tracking_file_path() -> PathBuf {
    dirs::data_dir()
        .or_else(dirs::config_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("update_tracking.json")
}

fn load_store() -> TrackingStore {
    let path = tracking_file_path();
    if let Ok(content) = fs::read_to_string(&path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        TrackingStore::default()
    }
}

fn save_store(store: &TrackingStore) -> Result<(), String> {
    let path = tracking_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: legge buildid da appmanifest_APPID.acf
// Il manifest è nella cartella steamapps/ sopra common/<game>/
// ──────────────────────────────────────────────────────────────────────────────
fn read_steam_build_id(game_path: &Path, app_id: &str) -> Option<String> {
    // game_path es: D:\SteamLibrary\steamapps\common\Mother Russia Bleeds
    // manifest: D:\SteamLibrary\steamapps\appmanifest_361300.acf
    let steamapps = game_path.parent()?.parent()?; // risale a steamapps/
    let manifest = steamapps.join(format!("appmanifest_{}.acf", app_id));

    if !manifest.exists() {
        // Prova anche senza il numero (cerca qualsiasi appmanifest con quel buildid)
        return None;
    }

    let content = fs::read_to_string(&manifest).ok()?;
    // Formato VDF: "buildid"   "12345678"
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("\"buildid\"") {
            // Estrae l'ultimo valore tra virgolette: "buildid"   "12345678"
            let val = line
                .split('"')
                .filter(|s| !s.trim().is_empty() && s.trim() != "buildid")
                .next_back()?
                .to_string();
            return Some(val);
        }
    }
    None
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: verifica integrità patch
// ──────────────────────────────────────────────────────────────────────────────
fn check_patch_integrity(game_path: &Path) -> (bool, String, Vec<String>) {
    let mut details = Vec::new();

    // ── BepInEx (Unity) ──
    let bepinex = game_path.join("BepInEx");
    if bepinex.exists() {
        let winhttp = game_path.join("winhttp.dll");
        let doorstop = game_path.join("doorstop_config.ini");
        let plugins = bepinex.join("plugins");
        let xunity_dll = plugins.join("XUnity.AutoTranslator.Plugin.Core.dll");

        let mut ok = true;
        if winhttp.exists() {
            details.push("✓ winhttp.dll presente".to_string());
        } else {
            details.push("✗ winhttp.dll mancante".to_string());
            ok = false;
        }
        if doorstop.exists() {
            details.push("✓ doorstop_config.ini presente".to_string());
        } else {
            details.push("✗ doorstop_config.ini mancante".to_string());
            ok = false;
        }
        if xunity_dll.exists() {
            details.push("✓ XUnity.AutoTranslator presente".to_string());
        } else {
            details.push("✗ XUnity.AutoTranslator.dll mancante (plugin folder: BepInEx/plugins/)".to_string());
            ok = false;
        }
        return (ok, "bepinex".to_string(), details);
    }

    // ── Unreal _P.pak ──
    // Cerca in sottocartelle per Content/Paks/
    let mut paks_dir: Option<PathBuf> = None;
    if let Ok(entries) = fs::read_dir(game_path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let candidate = p.join("Content").join("Paks");
                if candidate.exists() {
                    paks_dir = Some(candidate);
                    break;
                }
            }
        }
    }

    if let Some(paks) = paks_dir {
        let gs_paks: Vec<_> = fs::read_dir(&paks)
            .map(|entries| {
                entries.flatten()
                    .filter(|e| {
                        let n = e.file_name().to_string_lossy().to_string();
                        n.contains("GameStringer") && n.ends_with("_P.pak")
                    })
                    .collect()
            })
            .unwrap_or_default();

        if gs_paks.is_empty() {
            details.push("✗ Nessun _P.pak GameStringer trovato in Content/Paks/".to_string());
            return (false, "unreal_pak".to_string(), details);
        } else {
            for pak in &gs_paks {
                details.push(format!("✓ {} presente", pak.file_name().to_string_lossy()));
            }
            return (true, "unreal_pak".to_string(), details);
        }
    }

    details.push("Nessuna patch di traduzione rilevata".to_string());
    (true, "none".to_string(), details) // nessuna patch = non è un problema
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Controlla se il gioco è stato aggiornato + stato patch
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn check_game_update(
    app_id: String,
    game_path: String,
) -> Result<UpdateCheckResult, String> {
    let path = Path::new(&game_path);

    // 1. Leggi buildid corrente
    let current_build_id = read_steam_build_id(path, &app_id)
        .unwrap_or_else(|| "unknown".to_string());

    // 2. Leggi buildid noto
    let store = load_store();
    let game_key = format!("steam_{}", app_id);
    let known = store.games.get(&game_key);
    let known_build_id = known.map(|g| g.known_build_id.clone()).unwrap_or_default();

    // 3. Rilevamento aggiornamento
    let update_detected = !known_build_id.is_empty()
        && current_build_id != "unknown"
        && current_build_id != known_build_id;

    // 4. Verifica patch
    let (patch_intact, patch_type, patch_details) = check_patch_integrity(path);

    // 5. Messaggio
    let message = if update_detected && !patch_intact {
        format!("⚠ Gioco aggiornato (build {}) e patch danneggiata — riapplica la patch", current_build_id)
    } else if update_detected {
        format!("🔄 Gioco aggiornato (build {}) — potrebbero esserci nuove stringhe da tradurre", current_build_id)
    } else if !patch_intact && patch_type != "none" {
        "⚠ Patch di traduzione incompleta — alcuni file mancano".to_string()
    } else if known_build_id.is_empty() {
        format!("Build corrente: {} (prima verifica)", current_build_id)
    } else {
        format!("✓ Gioco aggiornato (build {}) — patch intatta", current_build_id)
    };

    Ok(UpdateCheckResult {
        current_build_id,
        known_build_id,
        update_detected,
        patch_intact,
        patch_type,
        patch_details,
        message,
    })
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Salva buildid corrente come "noto" (utente ha confermato l'update)
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn acknowledge_game_update(
    app_id: String,
    build_id: String,
    patch_intact: bool,
) -> Result<(), String> {
    let mut store = load_store();
    let game_key = format!("steam_{}", app_id);
    let now = chrono::Utc::now().to_rfc3339();

    store.games.insert(game_key, GameUpdateState {
        known_build_id: build_id,
        last_checked: now,
        patch_was_intact: patch_intact,
    });

    save_store(&store)
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Solo verifica integrità patch (senza confronto buildid)
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn verify_patch_integrity(game_path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&game_path);
    let (intact, patch_type, details) = check_patch_integrity(path);

    Ok(serde_json::json!({
        "intact": intact,
        "patch_type": patch_type,
        "details": details,
        "message": if intact {
            format!("Patch {} intatta", patch_type)
        } else {
            "Patch incompleta o danneggiata".to_string()
        }
    }))
}

// ──────────────────────────────────────────────────────────────────────────────
// COMMAND: Stato aggiornamento per tutti i giochi tracciati
// ──────────────────────────────────────────────────────────────────────────────
#[command]
pub async fn get_all_tracked_games() -> Result<serde_json::Value, String> {
    let store = load_store();
    Ok(serde_json::json!(store.games))
}
