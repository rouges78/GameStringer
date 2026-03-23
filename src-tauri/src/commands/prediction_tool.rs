use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::fs;
use log::info;

/// 🔮 P.T. — Prediction Tool
/// Scansiona in profondità i file di un gioco installato per stimare
/// la difficoltà di traduzione, le lingue presenti, il volume di testo,
/// i formati trovati, e il tempo stimato per motore/modello LLM.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictionResult {
    pub game_title: String,
    pub engine: String,
    pub install_path: String,
    /// Lingue trovate nei file del gioco
    pub detected_languages: Vec<DetectedLanguage>,
    /// Score difficoltà 0-100
    pub difficulty_score: u32,
    pub difficulty_label: String,
    /// Statistiche testo
    pub text_stats: TextStats,
    /// Formati file trovati
    pub file_formats: Vec<FileFormatInfo>,
    /// Stima tempo per modello
    pub time_estimates: Vec<TimeEstimate>,
    /// Stima per chain di traduzione
    pub chain_estimates: Vec<ChainEstimate>,
    /// Note e avvisi
    pub warnings: Vec<String>,
    /// GS supporta questo motore?
    pub gs_supported: bool,
    /// Metodo di estrazione consigliato
    pub recommended_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedLanguage {
    pub code: String,
    pub name: String,
    pub source: String,
    pub file_count: u32,
    pub total_size_kb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStats {
    pub total_text_files: u32,
    pub total_text_size_kb: u64,
    pub estimated_strings: u64,
    pub estimated_words: u64,
    pub estimated_characters: u64,
    pub largest_files: Vec<FileSizeInfo>,
    pub localization_folders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSizeInfo {
    pub path: String,
    pub size_kb: u64,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFormatInfo {
    pub extension: String,
    pub count: u32,
    pub total_size_kb: u64,
    pub translatable: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeEstimate {
    pub model_name: String,
    pub model_size: String,
    pub speed_strings_per_min: f64,
    pub estimated_hours: f64,
    pub quality_score: u32,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainEstimate {
    pub chain_name: String,
    pub description: String,
    pub estimated_hours: f64,
    pub quality_score: u32,
    pub cost_estimate: String,
    pub steps: Vec<String>,
}

// ── Language Detection ───────────────────────────────────────────────

const LANG_PATTERNS: &[(&str, &str, &str)] = &[
    ("en", "English", "english"),
    ("it", "Italian", "italian"),
    ("de", "German", "german"),
    ("fr", "French", "french"),
    ("es", "Spanish", "spanish"),
    ("pt", "Portuguese", "portuguese"),
    ("ru", "Russian", "russian"),
    ("pl", "Polish", "polish"),
    ("nl", "Dutch", "dutch"),
    ("sv", "Swedish", "swedish"),
    ("no", "Norwegian", "norwegian"),
    ("da", "Danish", "danish"),
    ("fi", "Finnish", "finnish"),
    ("hu", "Hungarian", "hungarian"),
    ("cs", "Czech", "czech"),
    ("ro", "Romanian", "romanian"),
    ("bg", "Bulgarian", "bulgarian"),
    ("el", "Greek", "greek"),
    ("tr", "Turkish", "turkish"),
    ("ar", "Arabic", "arabic"),
    ("ja", "Japanese", "japanese"),
    ("zh", "Chinese", "chinese"),
    ("ko", "Korean", "korean"),
    ("th", "Thai", "thai"),
    ("vi", "Vietnamese", "vietnamese"),
    ("uk", "Ukrainian", "ukrainian"),
    ("hr", "Croatian", "croatian"),
    ("sk", "Slovak", "slovak"),
    ("sl", "Slovenian", "slovenian"),
];

fn detect_languages_deep(game_path: &Path) -> Vec<DetectedLanguage> {
    let mut lang_map: HashMap<String, (String, HashSet<String>, u32, u64)> = HashMap::new();

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        let path = entry.path();
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        let rel_path = path.strip_prefix(game_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_lowercase();
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

        for &(code, full_name, pattern) in LANG_PATTERNS {
            let found = name_lower.contains(pattern)
                || name_lower.starts_with(&format!("{}.", code))
                || name_lower.starts_with(&format!("{}_", code))
                || name_lower.ends_with(&format!("_{}.txt", code))
                || name_lower.ends_with(&format!("_{}.json", code))
                || name_lower.ends_with(&format!("_{}.xml", code))
                || name_lower.ends_with(&format!("_{}.csv", code))
                || name_lower.ends_with(&format!("_{}.po", code))
                || name_lower.ends_with(&format!("_{}.loc", code))
                || name_lower.ends_with(&format!("_{}.lang", code))
                || name_lower == format!("{}.txt", code)
                || name_lower == format!("{}.json", code)
                || name_lower == format!("{}.xml", code)
                || rel_path.contains(&format!("/{}/", code))
                || rel_path.contains(&format!("\\{}\\", code))
                || rel_path.contains(&format!("/localization/{}", pattern))
                || rel_path.contains(&format!("\\localization\\{}", pattern))
                || rel_path.contains(&format!("/localisation/{}", pattern))
                || rel_path.contains(&format!("\\localisation\\{}", pattern))
                || rel_path.contains(&format!("/lang/{}", code))
                || rel_path.contains(&format!("\\lang\\{}", code));

            if found {
                let lang_entry = lang_map.entry(code.to_string()).or_insert_with(|| {
                    (full_name.to_string(), HashSet::new(), 0, 0)
                });
                lang_entry.2 += 1;
                lang_entry.3 += size / 1024;
                if path.is_dir() {
                    lang_entry.1.insert(format!("folder: {}", rel_path));
                } else {
                    lang_entry.1.insert(format!("file: {}", name_lower));
                }
            }
        }

        // Also check inside text files for language markers
        if size < 500_000 && is_text_ext(&name_lower) {
            if let Ok(content) = fs::read_to_string(path) {
                let content_lower = content.to_lowercase();
                // Look for language declarations in config/manifest files
                if name_lower.contains("manifest") || name_lower.contains("config") || name_lower.contains("appinfo") || name_lower.contains("steam_api") {
                    for &(code, full_name, pattern) in LANG_PATTERNS {
                        if content_lower.contains(pattern) || content_lower.contains(&format!("\"{}\"", code)) {
                            let entry = lang_map.entry(code.to_string()).or_insert_with(|| {
                                (full_name.to_string(), HashSet::new(), 0, 0)
                            });
                            entry.1.insert(format!("manifest: {}", name_lower));
                        }
                    }
                }
            }
        }
    }

    let mut result: Vec<DetectedLanguage> = lang_map
        .into_iter()
        .map(|(code, (name, sources, count, size))| {
            DetectedLanguage {
                code,
                name,
                source: sources.into_iter().take(3).collect::<Vec<_>>().join(", "),
                file_count: count,
                total_size_kb: size,
            }
        })
        .collect();

    result.sort_by(|a, b| b.total_size_kb.cmp(&a.total_size_kb));
    result
}

// ── Text Stats ───────────────────────────────────────────────────────

fn analyze_text_content(game_path: &Path) -> TextStats {
    let mut total_files = 0u32;
    let mut total_size = 0u64;
    let mut largest_files: Vec<FileSizeInfo> = Vec::new();
    let mut loc_folders: HashSet<String> = HashSet::new();

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        let rel = path.strip_prefix(game_path).unwrap_or(path);
        let rel_str = rel.to_string_lossy().to_lowercase();

        // Detect localization folders
        if rel_str.contains("localization") || rel_str.contains("localisation")
            || rel_str.contains("i18n") || rel_str.contains("translations")
            || rel_str.contains("lang") || rel_str.contains("locale")
        {
            if let Some(parent) = rel.parent() {
                loc_folders.insert(parent.to_string_lossy().to_string());
            }
        }

        if is_translatable_ext(&name_lower) {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size < 50 { continue; }
            total_files += 1;
            total_size += size;

            let ext = Path::new(&name_lower)
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            largest_files.push(FileSizeInfo {
                path: rel.to_string_lossy().to_string(),
                size_kb: size / 1024,
                format: ext,
            });
        }
    }

    largest_files.sort_by(|a, b| b.size_kb.cmp(&a.size_kb));
    largest_files.truncate(10);

    // Estimate strings/words from total text size
    // Average: ~50 bytes per string, ~6 chars per word
    let est_strings = total_size / 50;
    let est_words = total_size / 6;
    let est_chars = total_size;

    TextStats {
        total_text_files: total_files,
        total_text_size_kb: total_size / 1024,
        estimated_strings: est_strings,
        estimated_words: est_words,
        estimated_characters: est_chars,
        largest_files,
        localization_folders: loc_folders.into_iter().collect(),
    }
}

// ── File Formats ─────────────────────────────────────────────────────

fn analyze_file_formats(game_path: &Path) -> Vec<FileFormatInfo> {
    let mut ext_map: HashMap<String, (u32, u64)> = HashMap::new();

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() { continue; }
        let name = entry.file_name().to_string_lossy().to_lowercase();
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if let Some(ext) = Path::new(&name).extension() {
            let ext_str = ext.to_string_lossy().to_string();
            let e = ext_map.entry(ext_str).or_insert((0, 0));
            e.0 += 1;
            e.1 += size;
        }
    }

    let mut result: Vec<FileFormatInfo> = ext_map
        .into_iter()
        .filter(|(_, (count, _))| *count > 0)
        .map(|(ext, (count, size))| {
            let (translatable, desc) = get_format_info(&ext);
            FileFormatInfo {
                extension: ext,
                count,
                total_size_kb: size / 1024,
                translatable,
                description: desc.to_string(),
            }
        })
        .collect();

    result.sort_by(|a, b| b.total_size_kb.cmp(&a.total_size_kb));
    result.truncate(20);
    result
}

// ── Difficulty Score ─────────────────────────────────────────────────

fn calculate_difficulty(
    engine: &str,
    languages: &[DetectedLanguage],
    text_stats: &TextStats,
    formats: &[FileFormatInfo],
) -> (u32, String, Vec<String>) {
    let mut score: i32 = 0;
    let mut warnings: Vec<String> = Vec::new();

    // Engine difficulty
    match engine {
        "Unity" => { score += 15; }
        "Ren'Py" => { score += 10; }
        "RPG Maker" => { score += 10; }
        "GameMaker" => { score += 25; }
        "Godot" => { score += 20; }
        "Unreal Engine" => {
            score += 40;
            warnings.push("Unreal usa file .pak — estrazione complessa, possibili asset criptati".into());
        }
        "Source Engine" | "Source 2" => {
            score += 35;
            warnings.push("Source Engine: file VPK/VTF, richiede tool specifici".into());
        }
        "Frostbite" => {
            score += 50;
            warnings.push("Frostbite (EA): file criptati/compressi, traduzione molto difficile".into());
        }
        "RE Engine" | "MT Framework" => {
            score += 45;
            warnings.push("Engine Capcom: file proprietari, possibili protezioni".into());
        }
        "RAGE Engine" => {
            score += 50;
            warnings.push("RAGE (Rockstar): file criptati, estrazione non supportata".into());
        }
        "FromSoftware Engine" => {
            score += 45;
            warnings.push("FromSoft: file .bnd/.dcx compressi, tool specifici necessari".into());
        }
        "Unknown" => {
            score += 35;
            warnings.push("Motore sconosciuto: potrebbe richiedere analisi manuale".into());
        }
        _ => { score += 30; }
    }

    // Text volume
    if text_stats.estimated_strings > 50000 {
        score += 20;
        warnings.push(format!("Volume enorme: ~{} stringhe stimate", text_stats.estimated_strings));
    } else if text_stats.estimated_strings > 10000 {
        score += 10;
    } else if text_stats.estimated_strings < 500 {
        score -= 5;
    }

    // Existing languages
    let has_loc_structure = !text_stats.localization_folders.is_empty();
    if has_loc_structure {
        score -= 10;
    } else {
        score += 10;
        warnings.push("Nessuna cartella localizzazione trovata: le stringhe potrebbero essere hardcoded".into());
    }

    // Check for binary-only text (no readable files)
    let has_pak = formats.iter().any(|f| f.extension == "pak");
    let has_assets = formats.iter().any(|f| f.extension == "assets" || f.extension == "resource" || f.extension == "resources");

    if has_pak && text_stats.total_text_files < 5 {
        score += 15;
        warnings.push("Testo probabilmente all'interno di file .pak binari".into());
    }

    if has_assets && engine == "Unity" {
        score -= 5; // Unity assets sono supportati da GS
    }

    // Italian check
    let has_italian = languages.iter().any(|l| l.code == "it");
    if has_italian {
        score -= 15;
        // Not a warning, it's good news
    } else {
        score += 5;
    }

    let score = score.clamp(0, 100) as u32;
    let label = match score {
        0..=20 => "Facile",
        21..=40 => "Moderato",
        41..=60 => "Difficile",
        61..=80 => "Molto Difficile",
        _ => "Estremo",
    }.to_string();

    (score, label, warnings)
}

// ── Time & Chain Estimates ───────────────────────────────────────────

fn estimate_times(estimated_strings: u64) -> Vec<TimeEstimate> {
    let s = estimated_strings as f64;
    vec![
        TimeEstimate {
            model_name: "hy-mt1.5-abliterated:7b".into(),
            model_size: "4.6 GB".into(),
            speed_strings_per_min: 20.0,
            estimated_hours: s / 20.0 / 60.0,
            quality_score: 80,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "qwen3:4b".into(),
            model_size: "2.5 GB".into(),
            speed_strings_per_min: 35.0,
            estimated_hours: s / 35.0 / 60.0,
            quality_score: 65,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "qwen3:14b".into(),
            model_size: "~9 GB".into(),
            speed_strings_per_min: 12.0,
            estimated_hours: s / 12.0 / 60.0,
            quality_score: 90,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "qwen3:32b".into(),
            model_size: "~20 GB".into(),
            speed_strings_per_min: 5.0,
            estimated_hours: s / 5.0 / 60.0,
            quality_score: 95,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "GPT-4o".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 60.0,
            estimated_hours: s / 60.0 / 60.0,
            quality_score: 92,
            provider: "OpenAI".into(),
        },
        TimeEstimate {
            model_name: "GPT-4o-mini".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 120.0,
            estimated_hours: s / 120.0 / 60.0,
            quality_score: 78,
            provider: "OpenAI".into(),
        },
        TimeEstimate {
            model_name: "DeepL Pro".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 200.0,
            estimated_hours: s / 200.0 / 60.0,
            quality_score: 85,
            provider: "DeepL".into(),
        },
        TimeEstimate {
            model_name: "Gemini 2.0 Flash".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 100.0,
            estimated_hours: s / 100.0 / 60.0,
            quality_score: 82,
            provider: "Google".into(),
        },
    ]
}

fn estimate_chains(estimated_strings: u64, estimated_words: u64) -> Vec<ChainEstimate> {
    let s = estimated_strings as f64;
    let _w = estimated_words as f64;
    // DeepL: $20/1M chars = ~$0.00002/char, avg 30 chars/string
    let deepl_cost = s * 30.0 * 0.00002;
    // OpenAI: ~$0.003/1K tokens input + $0.006/1K output
    let openai_cost = s * 50.0 / 1000.0 * 0.003 + s * 50.0 / 1000.0 * 0.006;
    let openai_mini_cost = openai_cost * 0.1;

    vec![
        ChainEstimate {
            chain_name: "Local Quality".into(),
            description: "Ollama hy-mt1.5:7b con context injection".into(),
            estimated_hours: s / 20.0 / 60.0,
            quality_score: 82,
            cost_estimate: "Gratis (locale)".into(),
            steps: vec![
                "1. Estrai stringhe dal gioco".into(),
                "2. Genera contesto (scena, personaggio, glossario)".into(),
                "3. Traduci con hy-mt1.5:7b + contesto".into(),
                "4. QA check automatico".into(),
                "5. Reinierisci nel gioco".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Local Premium".into(),
            description: "Ollama qwen3:14b/32b con context + TM RAG".into(),
            estimated_hours: s / 8.0 / 60.0,
            quality_score: 93,
            cost_estimate: "Gratis (locale, GPU potente necessaria)".into(),
            steps: vec![
                "1. Estrai stringhe dal gioco".into(),
                "2. Genera contesto + Translation Memory RAG".into(),
                "3. Traduci con qwen3:14b/32b + contesto completo".into(),
                "4. Post-editing pass con modello secondario".into(),
                "5. QA check + reinierisci".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Cloud Fast".into(),
            description: "DeepL Pro + GPT-4o-mini post-edit".into(),
            estimated_hours: s / 150.0 / 60.0,
            quality_score: 87,
            cost_estimate: format!("~${:.2}", deepl_cost + openai_mini_cost),
            steps: vec![
                "1. Estrai stringhe".into(),
                "2. DeepL traduzione base (veloce, buona qualità)".into(),
                "3. GPT-4o-mini post-editing con contesto".into(),
                "4. QA check automatico".into(),
                "5. Reinierisci".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Cloud Premium".into(),
            description: "GPT-4o con context injection completo".into(),
            estimated_hours: s / 60.0 / 60.0,
            quality_score: 95,
            cost_estimate: format!("~${:.2}", openai_cost),
            steps: vec![
                "1. Estrai stringhe + analisi contesto".into(),
                "2. GPT-4o traduzione con system prompt dettagliato".into(),
                "3. Context injection (personaggio, scena, glossario)".into(),
                "4. QA check + consistency check".into(),
                "5. Reinierisci nel gioco".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Hybrid (Consigliato)".into(),
            description: "DeepL base + Ollama context-aware post-edit".into(),
            estimated_hours: s / 100.0 / 60.0 + s / 20.0 / 60.0 * 0.3,
            quality_score: 90,
            cost_estimate: format!("~${:.2} (solo DeepL)", deepl_cost),
            steps: vec![
                "1. Estrai stringhe dal gioco".into(),
                "2. DeepL traduzione base rapida".into(),
                "3. Ollama post-editing con contesto (solo stringhe dubbie)".into(),
                "4. TM RAG per coerenza terminologica".into(),
                "5. QA check + reinierisci".into(),
            ],
        },
    ]
}

// ── Binary String Estimation ─────────────────────────────────────────

/// Stima il numero di stringhe traducibili basandosi sulla dimensione dei file binari
/// e sul tipo di motore. Questa è un'euristica per giochi dove il testo è dentro
/// archivi compressi (.pak, .assets, .bundle, etc.)
fn estimate_strings_from_binary(engine: &str, formats: &[FileFormatInfo]) -> u64 {
    let pak_size_mb: f64 = formats.iter()
        .filter(|f| f.extension == "pak")
        .map(|f| f.total_size_kb as f64 / 1024.0)
        .sum();
    let assets_size_mb: f64 = formats.iter()
        .filter(|f| f.extension == "assets" || f.extension == "resources" || f.extension == "resource")
        .map(|f| f.total_size_kb as f64 / 1024.0)
        .sum();
    let bundle_size_mb: f64 = formats.iter()
        .filter(|f| f.extension == "bundle")
        .map(|f| f.total_size_kb as f64 / 1024.0)
        .sum();
    let total_binary_mb = pak_size_mb + assets_size_mb + bundle_size_mb;

    if total_binary_mb < 1.0 {
        return 0;
    }

    // Euristica: la percentuale di testo nei file binari varia per motore
    // Testo = tipicamente ~0.1-2% del totale per giochi action, ~2-8% per RPG/VN
    // Stringhe stimate = testo_byte_stimati / 50 (media 50 byte per stringa)
    let text_ratio = match engine {
        "Unreal Engine" => {
            // Unreal: .pak contiene asset misti, testo ~0.5-1.5% del totale
            if total_binary_mb > 5000.0 { 0.003 } // AAA con tanti asset grafici
            else if total_binary_mb > 1000.0 { 0.005 }
            else if total_binary_mb > 100.0 { 0.01 }
            else { 0.02 } // Indie piccolo
        }
        "Unity" => {
            // Unity: .assets contiene testo serializzato, ~1-3%
            if total_binary_mb > 1000.0 { 0.008 }
            else if total_binary_mb > 100.0 { 0.015 }
            else { 0.025 }
        }
        "Source Engine" | "Source 2" => 0.01,
        "Frostbite" => 0.002, // EA games, molto compressi
        "RE Engine" | "MT Framework" => 0.005,
        "RAGE Engine" => 0.003,
        "FromSoftware Engine" => 0.008,
        "Godot" => 0.02,
        _ => 0.01, // Default conservativo
    };

    let estimated_text_bytes = total_binary_mb * 1024.0 * 1024.0 * text_ratio;
    let estimated_strings = (estimated_text_bytes / 50.0) as u64;

    // Minimo realistico: un gioco indie ha almeno ~500 stringhe, un AAA ~5000+
    let minimum = if total_binary_mb > 1000.0 { 5000 }
        else if total_binary_mb > 100.0 { 2000 }
        else if total_binary_mb > 10.0 { 500 }
        else { 200 };

    estimated_strings.max(minimum)
}

// ── GS Support Check ─────────────────────────────────────────────────

fn check_gs_support(engine: &str) -> (bool, String) {
    match engine {
        "Unity" => (true, "Unity CSV Translator, Unity Asset Injector, Unity Patcher".into()),
        "Unreal Engine" => (true, "Unreal Localization Patcher, UE Translator DLL".into()),
        "Ren'Py" => (true, "Ren'Py Patcher".into()),
        "RPG Maker" => (true, "RPG Maker Patcher".into()),
        "GameMaker" => (false, "Non ancora supportato — in roadmap".into()),
        "Godot" => (false, "In sviluppo — Godot Translator page".into()),
        "Source Engine" | "Source 2" => (false, "Non supportato — richiede tool esterni (GCFScape, Crowbar)".into()),
        "Spike Chunsoft Engine" => (true, "Danganronpa Patcher".into()),
        "Wolf RPG Editor" => (true, "Wolf RPG Patcher".into()),
        _ => (false, format!("Motore '{}' non direttamente supportato — prova OCR Translator o Screen Capture", engine)),
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

fn is_text_ext(name: &str) -> bool {
    let text_exts = [
        ".txt", ".csv", ".json", ".xml", ".yaml", ".yml", ".ini", ".cfg",
        ".loc", ".po", ".pot", ".strings", ".lang", ".resx", ".ink",
        ".dlg", ".dialogue", ".lua", ".rpy", ".ks", ".toml", ".properties",
        ".vdf", ".acf", ".manifest", ".info",
    ];
    text_exts.iter().any(|e| name.ends_with(e))
}

fn is_translatable_ext(name: &str) -> bool {
    let exts = [
        ".txt", ".csv", ".json", ".xml", ".yaml", ".yml", ".ini", ".cfg",
        ".loc", ".po", ".pot", ".strings", ".lang", ".resx", ".ink",
        ".dlg", ".dialogue", ".lua", ".rpy", ".ks", ".toml", ".properties",
        ".vdf", ".html", ".htm", ".md",
    ];
    exts.iter().any(|e| name.ends_with(e))
}

fn get_format_info(ext: &str) -> (bool, &'static str) {
    match ext {
        "json" => (true, "JSON — struttura dati, spesso usato per localizzazione"),
        "csv" => (true, "CSV — tabelle, formato comune per stringhe tradotte"),
        "xml" => (true, "XML — markup, usato in molti sistemi i18n"),
        "txt" => (true, "Testo piano — dialoghi, note, descrizioni"),
        "po" | "pot" => (true, "GNU gettext — formato standard localizzazione"),
        "yaml" | "yml" => (true, "YAML — config e localizzazione (Ruby, Unity)"),
        "ini" | "cfg" => (true, "Config — può contenere stringhe UI"),
        "lua" => (true, "Lua script — spesso contiene stringhe di gioco"),
        "rpy" => (true, "Ren'Py script — dialoghi visual novel"),
        "lang" => (true, "File lingua — formato proprietario"),
        "loc" => (true, "Localizzazione — formato vario"),
        "strings" => (true, "Apple strings — coppie chiave-valore"),
        "resx" => (true, ".NET resources — localizzazione .NET/Unity"),
        "ink" => (true, "Ink narrative — dialoghi interattivi (Esoteric Ebb style)"),
        "dlg" | "dialogue" => (true, "Dialogo — formato engine specifico"),
        "properties" => (true, "Java properties — coppie chiave-valore"),
        "toml" => (true, "TOML — config strutturato"),
        "pak" => (false, "Unreal PAK — archivio binario compresso"),
        "assets" => (false, "Unity Assets — binario, richiede tool estrazione"),
        "resources" | "resource" => (false, "Unity Resources — binario serializzato"),
        "bundle" => (false, "Asset bundle — binario compresso"),
        "dll" => (false, "DLL — libreria binaria"),
        "exe" => (false, "Eseguibile — binario"),
        "wem" | "bnk" => (false, "Wwise audio — file audio, non testo"),
        "ogg" | "wav" | "mp3" => (false, "Audio — non testo"),
        "png" | "jpg" | "jpeg" | "dds" | "tga" | "bmp" => (false, "Immagine — non testo"),
        "ttf" | "otf" => (false, "Font — non testo"),
        "shader" | "cginc" | "hlsl" | "glsl" => (false, "Shader — codice GPU"),
        "mat" | "prefab" | "anim" | "controller" => (false, "Unity asset — metadati motore"),
        _ => (false, "Formato non classificato"),
    }
}

// ── Quick Summary Struct (for batch ranking) ─────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameQuickSummary {
    pub game_title: String,
    pub engine: String,
    pub install_path: String,
    pub difficulty_score: u32,
    pub difficulty_label: String,
    pub estimated_strings: u64,
    pub estimated_hours_local: f64,
    pub estimated_hours_cloud: f64,
    pub estimated_cost_cloud: f64,
    pub gs_supported: bool,
    pub recommended_method: String,
    pub lang_count: usize,
    pub has_italian: bool,
    pub warnings_count: usize,
    pub header_image: String,
    pub is_demo: bool,
    pub size_gb: f64,
}

// ── Batch Scan Command ───────────────────────────────────────────────

#[tauri::command]
pub async fn analyze_all_installed_games() -> Result<Vec<GameQuickSummary>, String> {
    info!("🔮 P.T. Batch: Scanning all installed games...");

    // Get all installed Steam games
    let local_games = crate::commands::steam_enhanced::scan_all_steam_games_fast()
        .await
        .map_err(|e| format!("Scan failed: {}", e))?;

    let installed: Vec<_> = local_games.iter()
        .filter(|g| g.is_installed && g.install_path.is_some())
        .collect();

    info!("🔮 P.T. Batch: Found {} installed games to analyze", installed.len());

    let mut summaries: Vec<GameQuickSummary> = Vec::new();

    for game in &installed {
        let path_str = game.install_path.as_ref().unwrap();
        let game_path = PathBuf::from(path_str);
        if !game_path.exists() { continue; }

        let engine_str = game.engine.clone().unwrap_or_else(|| {
            let detected = crate::engine_detector::detect_engine(&game_path);
            detected.as_str().to_string()
        });

        // Quick scan (lighter than full analyze)
        let languages = detect_languages_deep(&game_path);
        let mut text_stats = analyze_text_content(&game_path);
        let file_formats = analyze_file_formats(&game_path);

        if text_stats.estimated_strings < 100 {
            let binary_est = estimate_strings_from_binary(&engine_str, &file_formats);
            if binary_est > text_stats.estimated_strings {
                text_stats.estimated_strings = binary_est;
                text_stats.estimated_words = binary_est * 8;
            }
        }

        let (difficulty_score, difficulty_label, warnings) =
            calculate_difficulty(&engine_str, &languages, &text_stats, &file_formats);

        let s = text_stats.estimated_strings as f64;
        let hours_local = s / 60.0 / 60.0; // hy-mt1.5 speed
        let hours_cloud = s / 150.0 / 60.0; // DeepL speed
        let cost_cloud = (text_stats.estimated_words as f64 / 1_000_000.0) * 20.0; // DeepL ~$20/M chars

        let has_italian = languages.iter().any(|l| l.code == "it");
        let (gs_supported, recommended_method) = check_gs_support(&engine_str);

        let header = game.header_image.clone().unwrap_or_else(|| {
            let app_id = game.steam_app_id.map(|id| id.to_string()).unwrap_or_default();
            if !app_id.is_empty() {
                format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id)
            } else {
                String::new()
            }
        });

        // Rileva demo: titolo contiene "Demo" E dimensione < 5GB
        // Giochi grandi (>5GB) non sono mai demo anche se il nome contiene "Demo"
        let title_lower = game.title.to_lowercase();
        // Calcola dimensione totale dalla scansione formati
        let total_size_mb: f64 = file_formats.iter()
            .map(|f| f.total_size_kb as f64 / 1024.0)
            .sum();
        let size_gb = total_size_mb / 1024.0;
        let is_demo = title_lower.contains("demo") && size_gb < 5.0;

        summaries.push(GameQuickSummary {
            game_title: game.title.clone(),
            engine: engine_str,
            install_path: path_str.clone(),
            difficulty_score,
            difficulty_label,
            estimated_strings: text_stats.estimated_strings,
            estimated_hours_local: (hours_local * 10.0).round() / 10.0,
            estimated_hours_cloud: (hours_cloud * 10.0).round() / 10.0,
            estimated_cost_cloud: (cost_cloud * 100.0).round() / 100.0,
            gs_supported,
            recommended_method,
            lang_count: languages.len(),
            has_italian,
            warnings_count: warnings.len(),
            header_image: header,
            is_demo,
            size_gb: (size_gb * 100.0).round() / 100.0,
        });
    }

    // Ordina per difficoltà decrescente
    summaries.sort_by(|a, b| b.difficulty_score.cmp(&a.difficulty_score));

    info!("🔮 P.T. Batch: Analyzed {} games", summaries.len());
    Ok(summaries)
}

// ── Main Command (single game) ───────────────────────────────────────

#[tauri::command]
pub async fn analyze_game_translation(
    install_path: String,
    game_title: String,
    engine: Option<String>,
    _source_lang: String,
    _target_lang: String,
) -> Result<PredictionResult, String> {
    let game_path = PathBuf::from(&install_path);
    if !game_path.exists() {
        return Err(format!("Path non trovato: {}", install_path));
    }

    info!("🔮 P.T. Analyzing: {} at {}", game_title, install_path);

    // Detect engine if not provided
    let engine_str = engine.unwrap_or_else(|| {
        let detected = crate::engine_detector::detect_engine(&game_path);
        detected.as_str().to_string()
    });

    // Deep scan
    let languages = detect_languages_deep(&game_path);
    let mut text_stats = analyze_text_content(&game_path);
    let file_formats = analyze_file_formats(&game_path);

    // Se non ci sono file di testo ma ci sono file binari (pak, assets, etc.),
    // stima il contenuto testuale basandosi sulla dimensione dei binari e sul motore
    if text_stats.estimated_strings < 100 {
        let binary_text_estimate = estimate_strings_from_binary(&engine_str, &file_formats);
        if binary_text_estimate > text_stats.estimated_strings {
            text_stats.estimated_strings = binary_text_estimate;
            text_stats.estimated_words = binary_text_estimate * 8;
            text_stats.estimated_characters = binary_text_estimate * 45;
        }
    }

    // Difficulty
    let (difficulty_score, difficulty_label, warnings) =
        calculate_difficulty(&engine_str, &languages, &text_stats, &file_formats);

    // Time estimates
    let time_estimates = estimate_times(text_stats.estimated_strings);
    let chain_estimates = estimate_chains(text_stats.estimated_strings, text_stats.estimated_words);

    // GS support
    let (gs_supported, recommended_method) = check_gs_support(&engine_str);

    info!(
        "🔮 P.T. Result: {} | engine={} | difficulty={}/100 | strings~{} | langs={}",
        game_title, engine_str, difficulty_score, text_stats.estimated_strings, languages.len()
    );

    Ok(PredictionResult {
        game_title,
        engine: engine_str,
        install_path,
        detected_languages: languages,
        difficulty_score,
        difficulty_label,
        text_stats,
        file_formats,
        time_estimates,
        chain_estimates,
        warnings,
        gs_supported,
        recommended_method,
    })
}
