use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// 📁 Batch Processor
/// 
/// Processa cartelle intere di file traducibili:
/// - JSON, PO, RESX, CSV, TXT
/// - Sottotitoli (SRT, VTT, ASS)
/// - Mantiene struttura cartelle

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFile {
    pub path: String,
    pub relative_path: String,
    pub file_name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub file_type: FileType,
    pub entry_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FileType {
    Json,
    Po,
    Resx,
    Csv,
    Txt,
    Srt,
    Vtt,
    Ass,
    Xml,
    Yaml,
    Properties,
    Ini,
    Unknown,
}

impl FileType {
    fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "json" => FileType::Json,
            "po" | "pot" => FileType::Po,
            "resx" => FileType::Resx,
            "csv" => FileType::Csv,
            "txt" => FileType::Txt,
            "srt" => FileType::Srt,
            "vtt" => FileType::Vtt,
            "ass" | "ssa" => FileType::Ass,
            "xml" => FileType::Xml,
            "yaml" | "yml" => FileType::Yaml,
            "properties" => FileType::Properties,
            "ini" | "cfg" => FileType::Ini,
            _ => FileType::Unknown,
        }
    }
    
    fn is_translatable(&self) -> bool {
        !matches!(self, FileType::Unknown)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchScanResult {
    pub root_path: String,
    pub files: Vec<BatchFile>,
    pub total_files: u32,
    pub total_size_bytes: u64,
    pub file_type_counts: Vec<FileTypeCount>,
    pub estimated_entries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTypeCount {
    pub file_type: FileType,
    pub count: u32,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProcessOptions {
    pub include_extensions: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub recursive: bool,
    pub max_depth: Option<u32>,
    pub skip_hidden: bool,
    pub min_size_bytes: Option<u64>,
    pub max_size_bytes: Option<u64>,
}

impl Default for BatchProcessOptions {
    fn default() -> Self {
        Self {
            include_extensions: vec![
                "json".to_string(),
                "po".to_string(),
                "pot".to_string(),
                "resx".to_string(),
                "csv".to_string(),
                "txt".to_string(),
                "srt".to_string(),
                "vtt".to_string(),
                "ass".to_string(),
                "ssa".to_string(),
                "xml".to_string(),
                "yaml".to_string(),
                "yml".to_string(),
                "properties".to_string(),
            ],
            exclude_patterns: vec![
                "node_modules".to_string(),
                ".git".to_string(),
                "target".to_string(),
                "__pycache__".to_string(),
                ".venv".to_string(),
                "dist".to_string(),
                "build".to_string(),
            ],
            recursive: true,
            max_depth: Some(10),
            skip_hidden: true,
            min_size_bytes: None,
            max_size_bytes: Some(50 * 1024 * 1024), // 50MB max
        }
    }
}

/// Scansiona una cartella per file traducibili
#[tauri::command]
pub fn scan_folder_for_translation(
    folder_path: String,
    options: Option<BatchProcessOptions>,
) -> Result<BatchScanResult, String> {
    let path = Path::new(&folder_path);
    if !path.exists() {
        return Err(format!("Cartella non trovata: {}", folder_path));
    }
    if !path.is_dir() {
        return Err("Il percorso non è una cartella".to_string());
    }
    
    let opts = options.unwrap_or_default();
    let mut files: Vec<BatchFile> = Vec::new();
    let mut total_size: u64 = 0;
    
    let walker = if opts.recursive {
        WalkDir::new(path)
            .max_depth(opts.max_depth.unwrap_or(10) as usize)
            .follow_links(false)
    } else {
        WalkDir::new(path).max_depth(1)
    };
    
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        
        // Skip directories
        if entry_path.is_dir() {
            continue;
        }
        
        // Skip hidden files
        if opts.skip_hidden {
            if let Some(name) = entry_path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }
        }
        
        // Check exclude patterns
        let path_str = entry_path.to_string_lossy();
        let should_exclude = opts.exclude_patterns.iter().any(|pattern| {
            path_str.contains(pattern)
        });
        if should_exclude {
            continue;
        }
        
        // Check extension
        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        
        if !opts.include_extensions.is_empty() {
            if !opts.include_extensions.iter().any(|ext| ext.to_lowercase() == extension) {
                continue;
            }
        }
        
        // Get file info
        let metadata = match entry_path.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        
        let size = metadata.len();
        
        // Size filters
        if let Some(min) = opts.min_size_bytes {
            if size < min {
                continue;
            }
        }
        if let Some(max) = opts.max_size_bytes {
            if size > max {
                continue;
            }
        }
        
        let file_type = FileType::from_extension(&extension);
        if !file_type.is_translatable() {
            continue;
        }
        
        let relative_path = entry_path
            .strip_prefix(path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| entry_path.to_string_lossy().to_string());
        
        let entry_count = estimate_entry_count(entry_path, &file_type);
        
        files.push(BatchFile {
            path: entry_path.to_string_lossy().to_string(),
            relative_path,
            file_name: entry_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            extension: extension.clone(),
            size_bytes: size,
            file_type: file_type.clone(),
            entry_count,
        });
        
        total_size += size;
    }
    
    // Count by type
    let mut type_counts: std::collections::HashMap<String, (u32, u64)> = std::collections::HashMap::new();
    for file in &files {
        let type_str = format!("{:?}", file.file_type);
        let entry = type_counts.entry(type_str).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += file.size_bytes;
    }
    
    let file_type_counts: Vec<FileTypeCount> = type_counts
        .into_iter()
        .map(|(type_str, (count, size))| {
            let file_type = match type_str.as_str() {
                "Json" => FileType::Json,
                "Po" => FileType::Po,
                "Resx" => FileType::Resx,
                "Csv" => FileType::Csv,
                "Txt" => FileType::Txt,
                "Srt" => FileType::Srt,
                "Vtt" => FileType::Vtt,
                "Ass" => FileType::Ass,
                "Xml" => FileType::Xml,
                "Yaml" => FileType::Yaml,
                "Properties" => FileType::Properties,
                "Ini" => FileType::Ini,
                _ => FileType::Unknown,
            };
            FileTypeCount {
                file_type,
                count,
                total_size: size,
            }
        })
        .collect();
    
    let estimated_entries: u32 = files.iter().filter_map(|f| f.entry_count).sum();
    
    Ok(BatchScanResult {
        root_path: folder_path,
        files: files.clone(),
        total_files: files.len() as u32,
        total_size_bytes: total_size,
        file_type_counts,
        estimated_entries,
    })
}

/// Stima il numero di entry traducibili in un file
fn estimate_entry_count(path: &Path, file_type: &FileType) -> Option<u32> {
    let content = fs::read_to_string(path).ok()?;
    
    match file_type {
        FileType::Json => {
            // Conta le stringhe in JSON
            let count = content.matches("\":").count();
            Some(count as u32)
        }
        FileType::Po => {
            // Conta msgid in PO
            let count = content.matches("msgid \"").count();
            Some(count.saturating_sub(1) as u32) // -1 per header
        }
        FileType::Srt | FileType::Vtt => {
            // Conta blocchi di sottotitoli
            let count = content.split("\n\n").filter(|b| !b.trim().is_empty()).count();
            Some(count as u32)
        }
        FileType::Ass => {
            // Conta linee Dialogue
            let count = content.matches("Dialogue:").count();
            Some(count as u32)
        }
        FileType::Csv => {
            // Conta righe (- header)
            let count = content.lines().count().saturating_sub(1);
            Some(count as u32)
        }
        FileType::Resx => {
            // Conta <data> tags
            let count = content.matches("<data").count();
            Some(count as u32)
        }
        FileType::Properties => {
            // Conta righe non vuote e non commenti
            let count = content.lines()
                .filter(|l| {
                    let trimmed = l.trim();
                    !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with('!')
                })
                .count();
            Some(count as u32)
        }
        _ => {
            // Per altri formati, conta le righe
            let count = content.lines().filter(|l| !l.trim().is_empty()).count();
            Some(count as u32)
        }
    }
}

/// Legge il contenuto di un file per la traduzione
#[tauri::command]
pub fn read_file_for_translation(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore lettura file: {}", e))
}

/// Scrive il file tradotto mantenendo la struttura
#[tauri::command]
pub fn write_translated_file(
    original_path: String,
    content: String,
    output_suffix: Option<String>,
    output_folder: Option<String>,
) -> Result<String, String> {
    let original = Path::new(&original_path);
    
    let output_path = if let Some(folder) = output_folder {
        // Usa cartella di output specificata
        let folder_path = Path::new(&folder);
        if !folder_path.exists() {
            fs::create_dir_all(folder_path)
                .map_err(|e| format!("Errore creazione cartella: {}", e))?;
        }
        
        let file_name = original.file_name()
            .ok_or("Nome file non valido")?;
        
        folder_path.join(file_name)
    } else {
        // Stesso folder con suffisso
        let suffix = output_suffix.unwrap_or_else(|| "_translated".to_string());
        let stem = original.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let ext = original.extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let new_name = format!("{}{}.{}", stem, suffix, ext);
        original.parent()
            .map(|p| p.join(&new_name))
            .unwrap_or_else(|| PathBuf::from(&new_name))
    };
    
    fs::write(&output_path, content)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    Ok(output_path.to_string_lossy().to_string())
}

/// Copia struttura cartelle per output
#[tauri::command]
pub fn create_output_structure(
    source_folder: String,
    output_folder: String,
    files: Vec<String>,
) -> Result<u32, String> {
    let source = Path::new(&source_folder);
    let output = Path::new(&output_folder);
    
    if !output.exists() {
        fs::create_dir_all(output)
            .map_err(|e| format!("Errore creazione cartella output: {}", e))?;
    }
    
    let mut created = 0u32;
    
    for file_path in files {
        let file = Path::new(&file_path);
        
        // Calcola percorso relativo
        if let Ok(relative) = file.strip_prefix(source) {
            if let Some(parent) = relative.parent() {
                let target_dir = output.join(parent);
                if !target_dir.exists() {
                    fs::create_dir_all(&target_dir)
                        .map_err(|e| format!("Errore creazione: {}", e))?;
                    created += 1;
                }
            }
        }
    }
    
    Ok(created)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProgress {
    pub current_file: String,
    pub files_processed: u32,
    pub total_files: u32,
    pub entries_translated: u32,
    pub errors: Vec<String>,
}
