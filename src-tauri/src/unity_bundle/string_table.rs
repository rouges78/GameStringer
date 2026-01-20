//! Gestione StringTable di Unity Localization
//! Estrae e modifica le tabelle di stringhe per localizzazione

use std::collections::HashMap;
use std::path::Path;
use std::fs;
use serde::{Serialize, Deserialize};
use super::parser::{UnityBundle, LocalizedString};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringTableEntry {
    pub id: u64,
    pub key: String,
    pub value: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringTable {
    pub name: String,
    pub locale: String,
    pub entries: Vec<StringTableEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleAnalysis {
    pub bundle_path: String,
    pub unity_version: String,
    pub format_version: u32,
    pub file_count: usize,
    pub total_strings: usize,
    pub strings: Vec<LocalizedString>,
    pub is_localization_bundle: bool,
    pub locale: Option<String>,
}

impl BundleAnalysis {
    pub fn from_bundle(path: &Path, bundle: &UnityBundle) -> Result<Self, String> {
        let strings = bundle.extract_strings()?;
        
        // Rileva se è un bundle di localizzazione dal nome
        let filename = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        let is_localization = filename.contains("localization") || 
                              filename.contains("string-table") ||
                              filename.contains("StringTable");
        
        // Estrai locale dal nome file (es. "english(en)" -> "en")
        let locale = extract_locale_from_filename(filename);
        
        Ok(BundleAnalysis {
            bundle_path: path.to_string_lossy().to_string(),
            unity_version: bundle.header.unity_version.clone(),
            format_version: bundle.header.format_version,
            file_count: bundle.assets.len(),
            total_strings: strings.len(),
            strings,
            is_localization_bundle: is_localization,
            locale,
        })
    }
    
    /// Esporta le stringhe in formato JSON per traduzione
    pub fn export_json(&self) -> Result<String, String> {
        let export_data: Vec<_> = self.strings.iter().map(|s| {
            serde_json::json!({
                "key": s.key,
                "original": s.value,
                "translation": "",
                "offset": s.offset
            })
        }).collect();
        
        serde_json::to_string_pretty(&export_data)
            .map_err(|e| format!("Errore serializzazione JSON: {}", e))
    }
    
    /// Esporta le stringhe in formato CSV
    pub fn export_csv(&self) -> String {
        let mut csv = String::from("key,original,translation\n");
        for s in &self.strings {
            let escaped = s.value.replace("\"", "\"\"").replace("\n", "\\n");
            csv.push_str(&format!("\"{}\",\"{}\",\"\"\n", s.key, escaped));
        }
        csv
    }
}

/// Estrae il codice locale dal nome file
fn extract_locale_from_filename(filename: &str) -> Option<String> {
    // Pattern: language(code) o language-code
    // Es: "english(en)" -> "en", "italian(it)" -> "it"
    
    if let Some(start) = filename.find('(') {
        if let Some(end) = filename[start..].find(')') {
            return Some(filename[start + 1..start + end].to_string());
        }
    }
    
    // Prova pattern con trattino: it-IT, en-US
    let parts: Vec<&str> = filename.split(&['-', '_'][..]).collect();
    for part in parts {
        let lower = part.to_lowercase();
        if matches!(lower.as_str(), 
            "en" | "it" | "de" | "fr" | "es" | "ru" | "ja" | "ko" | "zh" | 
            "pt" | "pl" | "tr" | "uk" | "be" | "ar" | "nl" | "sv" | "no" | "da" | "fi"
        ) {
            return Some(lower);
        }
    }
    
    None
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationImport {
    pub key: String,
    pub translation: String,
}

/// Analizza un bundle e restituisce informazioni dettagliate
pub fn analyze_bundle(path: &Path) -> Result<BundleAnalysis, String> {
    let bundle = UnityBundle::load(path)?;
    BundleAnalysis::from_bundle(path, &bundle)
}

/// Analizza tutti i bundle di localizzazione in una cartella
pub fn analyze_localization_folder(folder: &Path) -> Result<Vec<BundleAnalysis>, String> {
    let mut results = Vec::new();
    
    println!("[UNITY_BUNDLE] Analisi cartella: {:?}", folder);
    
    if !folder.is_dir() {
        return Err(format!("Il percorso non è una cartella: {:?}", folder));
    }
    
    let entries: Vec<_> = fs::read_dir(folder)
        .map_err(|e| format!("Errore lettura cartella: {}", e))?
        .collect();
    
    println!("[UNITY_BUNDLE] Trovati {} file nella cartella", entries.len());
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Errore entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            
            // Filtra bundle di localizzazione (string-tables o localization)
            let is_localization = (filename.contains("localization") || filename.contains("string-table")) 
                && filename.ends_with(".bundle");
            
            if is_localization {
                println!("[UNITY_BUNDLE] Analisi bundle: {}", filename);
                match analyze_bundle(&path) {
                    Ok(analysis) => {
                        println!("[UNITY_BUNDLE] ✅ {} - {} stringhe", filename, analysis.total_strings);
                        results.push(analysis);
                    },
                    Err(e) => {
                        println!("[UNITY_BUNDLE] ❌ Errore {}: {}", filename, e);
                    }
                }
            }
        }
    }
    
    println!("[UNITY_BUNDLE] Totale bundle analizzati: {}", results.len());
    
    // Ordina per dimensione stringhe (bundle pieni prima)
    results.sort_by(|a, b| b.total_strings.cmp(&a.total_strings));
    
    Ok(results)
}

/// Confronta due bundle per trovare stringhe mancanti
pub fn compare_bundles(source: &BundleAnalysis, target: &BundleAnalysis) -> CompareResult {
    let source_keys: HashMap<_, _> = source.strings.iter()
        .map(|s| (s.key.clone(), s.value.clone()))
        .collect();
    
    let target_keys: HashMap<_, _> = target.strings.iter()
        .map(|s| (s.key.clone(), s.value.clone()))
        .collect();
    
    let missing: Vec<_> = source_keys.iter()
        .filter(|(k, _)| !target_keys.contains_key(*k))
        .map(|(k, v)| LocalizedString {
            key: k.clone(),
            value: v.clone(),
            table_name: None,
            offset: 0,
        })
        .collect();
    
    let common = source_keys.keys()
        .filter(|k| target_keys.contains_key(*k))
        .count();
    
    CompareResult {
        source_locale: source.locale.clone(),
        target_locale: target.locale.clone(),
        source_count: source.total_strings,
        target_count: target.total_strings,
        common_count: common,
        missing_in_target: missing,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareResult {
    pub source_locale: Option<String>,
    pub target_locale: Option<String>,
    pub source_count: usize,
    pub target_count: usize,
    pub common_count: usize,
    pub missing_in_target: Vec<LocalizedString>,
}
