use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::FileOptions;
use zip::ZipWriter;
use chrono::Utc;

use crate::commands::glossary::{GameGlossary, get_glossary};
use crate::commands::translation_memory::{TranslationMemory, load_translation_memory};
use crate::commands::game_dictionaries::{GameDictionary, load_dictionary};

/// Manifest del progetto di traduzione esportato
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub version: String,
    pub app_version: String,
    pub exported_at: String,
    pub game_id: String,
    pub game_name: String,
    pub source_language: String,
    pub target_language: String,
    pub contents: ProjectContents,
    pub stats: ProjectStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContents {
    pub has_translation_memory: bool,
    pub has_glossary: bool,
    pub has_dictionary: bool,
    pub has_strings: bool,
    pub custom_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStats {
    pub tm_units: u32,
    pub glossary_entries: u32,
    pub dictionary_entries: u32,
    pub string_count: u32,
    pub translated_count: u32,
    pub translation_progress: f64,
}

/// Info sul progetto importato
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub game_id: String,
    pub game_name: String,
    pub tm_units_imported: u32,
    pub glossary_entries_imported: u32,
    pub dictionary_entries_imported: u32,
    pub strings_imported: u32,
    pub warnings: Vec<String>,
}

/// File di stringhe tradotte per il progetto
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationStrings {
    pub game_id: String,
    pub source_language: String,
    pub target_language: String,
    pub entries: Vec<StringEntry>,
    pub exported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StringEntry {
    pub key: String,
    pub source: String,
    pub target: String,
    pub file_path: Option<String>,
    pub context: Option<String>,
    pub status: String, // "translated", "reviewed", "pending"
}

fn get_projects_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir()
        .ok_or("Impossibile trovare directory dati locali")?;
    let dir = app_data.join("GameStringer").join("projects");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Errore creazione directory progetti: {}", e))?;
    Ok(dir)
}

fn get_strings_path(game_id: &str, target_lang: &str) -> Result<PathBuf, String> {
    let dir = get_projects_dir()?;
    Ok(dir.join(format!("strings_{}_{}.json", game_id, target_lang)))
}

/// Esporta un progetto di traduzione come ZIP
#[tauri::command]
pub async fn export_translation_project(
    game_id: String,
    game_name: String,
    source_language: String,
    target_language: String,
    output_path: String,
    include_tm: bool,
    include_glossary: bool,
    include_dictionary: bool,
    include_strings: bool,
) -> Result<String, String> {
    log::info!("📦 Esportazione progetto traduzione: {} ({} → {})", game_name, source_language, target_language);

    let output = Path::new(&output_path);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Errore creazione directory output: {}", e))?;
    }

    let file = fs::File::create(output)
        .map_err(|e| format!("Errore creazione file ZIP: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut stats = ProjectStats {
        tm_units: 0,
        glossary_entries: 0,
        dictionary_entries: 0,
        string_count: 0,
        translated_count: 0,
        translation_progress: 0.0,
    };
    let mut contents = ProjectContents {
        has_translation_memory: false,
        has_glossary: false,
        has_dictionary: false,
        has_strings: false,
        custom_files: Vec::new(),
    };

    // 1. Translation Memory
    if include_tm {
        if let Ok(Some(tm)) = load_translation_memory(source_language.clone(), target_language.clone()) {
            let tm_json = serde_json::to_string_pretty(&tm)
                .map_err(|e| format!("Errore serializzazione TM: {}", e))?;
            zip.start_file("translation_memory.json", options)
                .map_err(|e| format!("Errore ZIP TM: {}", e))?;
            zip.write_all(tm_json.as_bytes())
                .map_err(|e| format!("Errore scrittura TM: {}", e))?;
            stats.tm_units = tm.units.len() as u32;
            contents.has_translation_memory = true;
            log::info!("  ✅ TM: {} unità", stats.tm_units);
        }
    }

    // 2. Glossario
    if include_glossary {
        if let Ok(Some(glossary)) = get_glossary(game_id.clone()).await {
            let gl_json = serde_json::to_string_pretty(&glossary)
                .map_err(|e| format!("Errore serializzazione glossario: {}", e))?;
            zip.start_file("glossary.json", options)
                .map_err(|e| format!("Errore ZIP glossario: {}", e))?;
            zip.write_all(gl_json.as_bytes())
                .map_err(|e| format!("Errore scrittura glossario: {}", e))?;
            stats.glossary_entries = glossary.entries.len() as u32;
            contents.has_glossary = true;
            log::info!("  ✅ Glossario: {} voci", stats.glossary_entries);
        }
    }

    // 3. Dizionario gioco
    if include_dictionary {
        if let Ok(dict) = load_dictionary(game_id.clone(), target_language.clone()).await {
            let dict_json = serde_json::to_string_pretty(&dict)
                .map_err(|e| format!("Errore serializzazione dizionario: {}", e))?;
            zip.start_file("dictionary.json", options)
                .map_err(|e| format!("Errore ZIP dizionario: {}", e))?;
            zip.write_all(dict_json.as_bytes())
                .map_err(|e| format!("Errore scrittura dizionario: {}", e))?;
            stats.dictionary_entries = dict.translations.len() as u32;
            contents.has_dictionary = true;
            log::info!("  ✅ Dizionario: {} voci", stats.dictionary_entries);
        }
    }

    // 4. Stringhe tradotte
    if include_strings {
        let strings_path = get_strings_path(&game_id, &target_language)?;
        if strings_path.exists() {
            if let Ok(content) = fs::read_to_string(&strings_path) {
                if let Ok(strings) = serde_json::from_str::<TranslationStrings>(&content) {
                    zip.start_file("strings.json", options)
                        .map_err(|e| format!("Errore ZIP stringhe: {}", e))?;
                    zip.write_all(content.as_bytes())
                        .map_err(|e| format!("Errore scrittura stringhe: {}", e))?;
                    stats.string_count = strings.entries.len() as u32;
                    stats.translated_count = strings.entries.iter()
                        .filter(|e| e.status == "translated" || e.status == "reviewed")
                        .count() as u32;
                    contents.has_strings = true;
                    log::info!("  ✅ Stringhe: {}/{}", stats.translated_count, stats.string_count);
                }
            }
        }
    }

    // Calcola progresso
    if stats.string_count > 0 {
        stats.translation_progress = (stats.translated_count as f64 / stats.string_count as f64) * 100.0;
    }

    // 5. Manifest
    let manifest = ProjectManifest {
        version: "1.0".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: Utc::now().to_rfc3339(),
        game_id: game_id.clone(),
        game_name: game_name.clone(),
        source_language: source_language.clone(),
        target_language: target_language.clone(),
        contents,
        stats,
    };
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Errore serializzazione manifest: {}", e))?;
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Errore ZIP manifest: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Errore scrittura manifest: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Errore finalizzazione ZIP: {}", e))?;

    log::info!("📦 Progetto esportato: {}", output_path);
    Ok(output_path)
}

/// Anteprima del contenuto di un ZIP progetto prima di importare
#[tauri::command]
pub async fn preview_translation_project(zip_path: String) -> Result<ProjectManifest, String> {
    log::info!("🔍 Anteprima progetto: {}", zip_path);

    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("Errore apertura ZIP: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Errore lettura ZIP: {}", e))?;

    let mut manifest_content = String::new();
    archive.by_name("manifest.json")
        .map_err(|_| "manifest.json non trovato nel progetto".to_string())?
        .read_to_string(&mut manifest_content)
        .map_err(|e| format!("Errore lettura manifest: {}", e))?;

    let manifest: ProjectManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Errore parsing manifest: {}", e))?;

    Ok(manifest)
}

/// Importa un progetto di traduzione da ZIP
#[tauri::command]
pub async fn import_translation_project(
    zip_path: String,
    import_tm: bool,
    import_glossary: bool,
    import_dictionary: bool,
    import_strings: bool,
    merge_mode: String, // "replace", "merge", "skip_existing"
) -> Result<ImportResult, String> {
    log::info!("📥 Importazione progetto: {} (mode: {})", zip_path, merge_mode);

    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("Errore apertura ZIP: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Errore lettura ZIP: {}", e))?;

    // Leggi manifest
    let mut manifest_content = String::new();
    archive.by_name("manifest.json")
        .map_err(|_| "manifest.json non trovato")?
        .read_to_string(&mut manifest_content)
        .map_err(|e| format!("Errore lettura manifest: {}", e))?;
    let manifest: ProjectManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Errore parsing manifest: {}", e))?;

    let mut result = ImportResult {
        success: true,
        game_id: manifest.game_id.clone(),
        game_name: manifest.game_name.clone(),
        tm_units_imported: 0,
        glossary_entries_imported: 0,
        dictionary_entries_imported: 0,
        strings_imported: 0,
        warnings: Vec::new(),
    };

    // 1. Translation Memory
    if import_tm && manifest.contents.has_translation_memory {
        match read_zip_file(&mut archive, "translation_memory.json") {
            Ok(content) => {
                match serde_json::from_str::<TranslationMemory>(&content) {
                    Ok(imported_tm) => {
                        let count = imported_tm.units.len() as u32;
                        if merge_mode == "replace" {
                            crate::commands::translation_memory::save_translation_memory(imported_tm)
                                .map_err(|e| format!("Errore salvataggio TM: {}", e))?;
                        } else {
                            // Merge: carica esistente e unisci
                            let mut existing = load_translation_memory(
                                manifest.source_language.clone(),
                                manifest.target_language.clone(),
                            )?.unwrap_or(imported_tm.clone());

                            let existing_sources: std::collections::HashSet<String> = existing.units.iter()
                                .map(|u| u.source_text.to_lowercase())
                                .collect();

                            for unit in imported_tm.units {
                                if merge_mode == "merge" || !existing_sources.contains(&unit.source_text.to_lowercase()) {
                                    existing.units.push(unit);
                                }
                            }
                            existing.stats.total_units = existing.units.len() as u32;
                            existing.updated_at = Utc::now().to_rfc3339();
                            crate::commands::translation_memory::save_translation_memory(existing)
                                .map_err(|e| format!("Errore salvataggio TM: {}", e))?;
                        }
                        result.tm_units_imported = count;
                        log::info!("  ✅ TM importata: {} unità", count);
                    }
                    Err(e) => result.warnings.push(format!("Errore parsing TM: {}", e)),
                }
            }
            Err(e) => result.warnings.push(format!("TM non trovata nel ZIP: {}", e)),
        }
    }

    // 2. Glossario
    if import_glossary && manifest.contents.has_glossary {
        match read_zip_file(&mut archive, "glossary.json") {
            Ok(content) => {
                match serde_json::from_str::<GameGlossary>(&content) {
                    Ok(mut imported_gl) => {
                        let count = imported_gl.entries.len() as u32;
                        imported_gl.updated_at = Utc::now().to_rfc3339();
                        // Salva direttamente (il glossary path è basato su game_id)
                        let gl_path = dirs::data_local_dir()
                            .ok_or("Dir non trovata")?
                            .join("GameStringer").join("glossaries")
                            .join(format!("{}.json", imported_gl.game_id));
                        fs::create_dir_all(gl_path.parent().unwrap())
                            .map_err(|e| format!("Errore dir glossario: {}", e))?;
                        let gl_json = serde_json::to_string_pretty(&imported_gl)
                            .map_err(|e| format!("Errore serializzazione: {}", e))?;
                        fs::write(&gl_path, gl_json)
                            .map_err(|e| format!("Errore salvataggio glossario: {}", e))?;
                        result.glossary_entries_imported = count;
                        log::info!("  ✅ Glossario importato: {} voci", count);
                    }
                    Err(e) => result.warnings.push(format!("Errore parsing glossario: {}", e)),
                }
            }
            Err(e) => result.warnings.push(format!("Glossario non trovato nel ZIP: {}", e)),
        }
    }

    // 3. Dizionario
    if import_dictionary && manifest.contents.has_dictionary {
        match read_zip_file(&mut archive, "dictionary.json") {
            Ok(content) => {
                match serde_json::from_str::<GameDictionary>(&content) {
                    Ok(dict) => {
                        let count = dict.translations.len() as u32;
                        crate::commands::game_dictionaries::save_dictionary(dict).await
                            .map_err(|e| format!("Errore salvataggio dizionario: {}", e))?;
                        result.dictionary_entries_imported = count;
                        log::info!("  ✅ Dizionario importato: {} voci", count);
                    }
                    Err(e) => result.warnings.push(format!("Errore parsing dizionario: {}", e)),
                }
            }
            Err(e) => result.warnings.push(format!("Dizionario non trovato nel ZIP: {}", e)),
        }
    }

    // 4. Stringhe
    if import_strings && manifest.contents.has_strings {
        match read_zip_file(&mut archive, "strings.json") {
            Ok(content) => {
                match serde_json::from_str::<TranslationStrings>(&content) {
                    Ok(strings) => {
                        let count = strings.entries.len() as u32;
                        let strings_path = get_strings_path(&manifest.game_id, &manifest.target_language)?;
                        fs::write(&strings_path, &content)
                            .map_err(|e| format!("Errore salvataggio stringhe: {}", e))?;
                        result.strings_imported = count;
                        log::info!("  ✅ Stringhe importate: {}", count);
                    }
                    Err(e) => result.warnings.push(format!("Errore parsing stringhe: {}", e)),
                }
            }
            Err(e) => result.warnings.push(format!("Stringhe non trovate nel ZIP: {}", e)),
        }
    }

    log::info!("📥 Importazione completata: TM={}, GL={}, Dict={}, Str={}",
        result.tm_units_imported, result.glossary_entries_imported,
        result.dictionary_entries_imported, result.strings_imported);

    Ok(result)
}

/// Salva stringhe di traduzione per un gioco
#[tauri::command]
pub async fn save_translation_strings(strings: TranslationStrings) -> Result<u32, String> {
    let path = get_strings_path(&strings.game_id, &strings.target_language)?;
    let count = strings.entries.len() as u32;
    let json = serde_json::to_string_pretty(&strings)
        .map_err(|e| format!("Errore serializzazione: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Errore salvataggio: {}", e))?;
    log::info!("💾 Salvate {} stringhe per {}", count, strings.game_id);
    Ok(count)
}

/// Carica stringhe di traduzione per un gioco
#[tauri::command]
pub async fn load_translation_strings(
    game_id: String,
    target_language: String,
) -> Result<Option<TranslationStrings>, String> {
    let path = get_strings_path(&game_id, &target_language)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura: {}", e))?;
    let strings: TranslationStrings = serde_json::from_str(&content)
        .map_err(|e| format!("Errore parsing: {}", e))?;
    Ok(Some(strings))
}

/// Lista tutti i progetti esportabili (giochi con almeno TM o glossario)
#[tauri::command]
pub async fn list_exportable_projects() -> Result<Vec<ExportableProject>, String> {
    let mut projects: HashMap<String, ExportableProject> = HashMap::new();

    // Controlla glossari
    if let Ok(glossaries) = crate::commands::glossary::list_glossaries().await {
        for gl in glossaries {
            let entry = projects.entry(gl.game_id.clone()).or_insert(ExportableProject {
                game_id: gl.game_id.clone(),
                game_name: gl.game_name.clone(),
                source_language: gl.source_language.clone(),
                target_language: gl.target_language.clone(),
                has_tm: false,
                has_glossary: true,
                has_dictionary: false,
                has_strings: false,
                glossary_entries: gl.entries.len() as u32,
                tm_units: 0,
                dictionary_entries: 0,
                string_count: 0,
            });
            entry.has_glossary = true;
            entry.glossary_entries = gl.entries.len() as u32;
        }
    }

    // Controlla TM
    if let Ok(tms) = crate::commands::translation_memory::list_translation_memories() {
        for tm in tms {
            // Le TM non sono per game_id specifico, le associamo genericamente
            for project in projects.values_mut() {
                if project.source_language == tm.source_language && project.target_language == tm.target_language {
                    project.has_tm = true;
                    project.tm_units = tm.unit_count;
                }
            }
        }
    }

    let mut result: Vec<ExportableProject> = projects.into_values().collect();
    result.sort_by(|a, b| a.game_name.cmp(&b.game_name));
    Ok(result)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableProject {
    pub game_id: String,
    pub game_name: String,
    pub source_language: String,
    pub target_language: String,
    pub has_tm: bool,
    pub has_glossary: bool,
    pub has_dictionary: bool,
    pub has_strings: bool,
    pub glossary_entries: u32,
    pub tm_units: u32,
    pub dictionary_entries: u32,
    pub string_count: u32,
}

/// Helper: legge un file dallo ZIP archive
fn read_zip_file(archive: &mut zip::ZipArchive<fs::File>, name: &str) -> Result<String, String> {
    let mut content = String::new();
    archive.by_name(name)
        .map_err(|_| format!("File '{}' non trovato nel ZIP", name))?
        .read_to_string(&mut content)
        .map_err(|e| format!("Errore lettura '{}': {}", name, e))?;
    Ok(content)
}
