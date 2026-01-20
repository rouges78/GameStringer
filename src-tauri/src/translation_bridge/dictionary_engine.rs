//! Dictionary Engine for GameStringer Translation Bridge
//! 
//! Gestisce i dizionari di traduzione in memoria con:
//! - HashMap ottimizzata per lookup O(1) tramite hash
//! - Hot-reload senza riavvio
//! - Supporto multi-lingua

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tracing::info;

use super::protocol::TranslationRequest;

/// Entry di traduzione
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationEntry {
    /// Testo originale
    pub original: String,
    /// Testo tradotto
    pub translated: String,
    /// Contesto opzionale
    pub context: Option<String>,
    /// Se la traduzione è stata verificata manualmente
    pub verified: bool,
}

/// Dizionario per una coppia di lingue
#[derive(Debug, Default)]
pub struct LanguageDictionary {
    /// Traduzioni indicizzate per hash
    translations_by_hash: HashMap<u64, TranslationEntry>,
    /// Traduzioni indicizzate per testo originale (fallback)
    translations_by_text: HashMap<String, TranslationEntry>,
    /// Numero di traduzioni
    count: usize,
}

impl LanguageDictionary {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Aggiunge una traduzione
    pub fn add(&mut self, original: String, translated: String) {
        let hash = TranslationRequest::compute_hash(&original);
        let entry = TranslationEntry {
            original: original.clone(),
            translated,
            context: None,
            verified: false,
        };
        
        self.translations_by_hash.insert(hash, entry.clone());
        self.translations_by_text.insert(original, entry);
        self.count += 1;
    }
    
    /// Cerca traduzione per hash (veloce)
    pub fn get_by_hash(&self, hash: u64) -> Option<&TranslationEntry> {
        self.translations_by_hash.get(&hash)
    }
    
    /// Cerca traduzione per testo (fallback)
    pub fn get_by_text(&self, text: &str) -> Option<&TranslationEntry> {
        self.translations_by_text.get(text)
    }
    
    /// Numero di traduzioni
    pub fn len(&self) -> usize {
        self.count
    }
    
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }
    
    /// Pulisce il dizionario
    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.translations_by_hash.clear();
        self.translations_by_text.clear();
        self.count = 0;
    }
}

/// Dictionary Engine - Gestisce tutti i dizionari
#[derive(Debug, Default)]
pub struct DictionaryEngine {
    /// Dizionari per coppia di lingue (es. "en_it" -> dizionario)
    dictionaries: HashMap<String, LanguageDictionary>,
    /// Lingua sorgente attiva
    active_source: String,
    /// Lingua target attiva
    active_target: String,
    /// Path per hot-reload
    #[allow(dead_code)]
    watch_paths: Vec<String>,
}

impl DictionaryEngine {
    pub fn new() -> Self {
        Self {
            dictionaries: HashMap::new(),
            active_source: "en".to_string(),
            active_target: "it".to_string(),
            watch_paths: Vec::new(),
        }
    }
    
    /// Imposta la coppia di lingue attiva
    pub fn set_active_languages(&mut self, source: &str, target: &str) {
        self.active_source = source.to_string();
        self.active_target = target.to_string();
        info!("[DictionaryEngine] Lingue attive: {} -> {}", source, target);
    }
    
    /// Ottieni la chiave per una coppia di lingue
    fn get_key(source: &str, target: &str) -> String {
        format!("{}_{}", source, target)
    }
    
    /// Carica traduzioni per una coppia di lingue
    pub fn load_translations(&mut self, source: &str, target: &str, translations: Vec<(String, String)>) -> usize {
        let key = Self::get_key(source, target);
        let dict = self.dictionaries.entry(key).or_insert_with(LanguageDictionary::new);
        
        let count = translations.len();
        for (original, translated) in translations {
            dict.add(original, translated);
        }
        
        info!("[DictionaryEngine] Caricate {} traduzioni per {} -> {}", count, source, target);
        count
    }
    
    /// Carica traduzioni da file JSON
    pub fn load_from_json(&mut self, path: &str) -> Result<usize, String> {
        let path = Path::new(path);
        
        if !path.exists() {
            return Err(format!("File non trovato: {}", path.display()));
        }
        
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Errore lettura file: {}", e))?;
        
        // Supporta diversi formati JSON
        // Formato 1: { "original": "translated", ... }
        // Formato 2: [ { "original": "...", "translated": "..." }, ... ]
        // Formato 3: { "source": "en", "target": "it", "translations": {...} }
        
        if let Ok(simple_map) = serde_json::from_str::<HashMap<String, String>>(&content) {
            let translations: Vec<(String, String)> = simple_map.into_iter().collect();
            return Ok(self.load_translations(&self.active_source.clone(), &self.active_target.clone(), translations));
        }
        
        if let Ok(array) = serde_json::from_str::<Vec<TranslationEntry>>(&content) {
            let translations: Vec<(String, String)> = array
                .into_iter()
                .map(|e| (e.original, e.translated))
                .collect();
            return Ok(self.load_translations(&self.active_source.clone(), &self.active_target.clone(), translations));
        }
        
        // Formato con metadata
        #[derive(Deserialize)]
        struct DictionaryFile {
            source: Option<String>,
            target: Option<String>,
            translations: HashMap<String, String>,
        }
        
        if let Ok(dict_file) = serde_json::from_str::<DictionaryFile>(&content) {
            let source = dict_file.source.unwrap_or_else(|| self.active_source.clone());
            let target = dict_file.target.unwrap_or_else(|| self.active_target.clone());
            let translations: Vec<(String, String)> = dict_file.translations.into_iter().collect();
            return Ok(self.load_translations(&source, &target, translations));
        }
        
        Err("Formato JSON non riconosciuto".to_string())
    }
    
    /// Carica traduzioni da file CSV
    #[allow(dead_code)]
    pub fn load_from_csv(&mut self, path: &str, source_col: usize, target_col: usize) -> Result<usize, String> {
        let path = Path::new(path);
        
        if !path.exists() {
            return Err(format!("File non trovato: {}", path.display()));
        }
        
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Errore lettura file: {}", e))?;
        
        let mut translations = Vec::new();
        
        for (line_num, line) in content.lines().enumerate() {
            // Salta header
            if line_num == 0 {
                continue;
            }
            
            let cols: Vec<&str> = line.split(',').collect();
            
            if cols.len() > source_col && cols.len() > target_col {
                let original = cols[source_col].trim().trim_matches('"').to_string();
                let translated = cols[target_col].trim().trim_matches('"').to_string();
                
                if !original.is_empty() && !translated.is_empty() {
                    translations.push((original, translated));
                }
            }
        }
        
        Ok(self.load_translations(&self.active_source.clone(), &self.active_target.clone(), translations))
    }
    
    /// Cerca una traduzione (usa la coppia di lingue attiva)
    pub fn get_translation(&self, hash: u64, original_text: &str) -> Option<String> {
        let key = Self::get_key(&self.active_source, &self.active_target);
        
        if let Some(dict) = self.dictionaries.get(&key) {
            // Prima prova con hash (più veloce)
            if let Some(entry) = dict.get_by_hash(hash) {
                // Verifica che l'hash non sia una collisione
                if entry.original == original_text {
                    return Some(entry.translated.clone());
                }
            }
            
            // Fallback su ricerca testuale
            if let Some(entry) = dict.get_by_text(original_text) {
                return Some(entry.translated.clone());
            }
        }
        
        None
    }
    
    /// Cerca traduzione con coppia di lingue specifica
    #[allow(dead_code)]
    pub fn get_translation_for(&self, source: &str, target: &str, original_text: &str) -> Option<String> {
        let key = Self::get_key(source, target);
        let hash = TranslationRequest::compute_hash(original_text);
        
        if let Some(dict) = self.dictionaries.get(&key) {
            if let Some(entry) = dict.get_by_hash(hash) {
                if entry.original == original_text {
                    return Some(entry.translated.clone());
                }
            }
            
            if let Some(entry) = dict.get_by_text(original_text) {
                return Some(entry.translated.clone());
            }
        }
        
        None
    }
    
    /// Aggiunge una singola traduzione
    pub fn add_translation(&mut self, original: String, translated: String) {
        let key = Self::get_key(&self.active_source, &self.active_target);
        let dict = self.dictionaries.entry(key).or_insert_with(LanguageDictionary::new);
        dict.add(original, translated);
    }
    
    /// Ottieni statistiche
    pub fn get_stats(&self) -> DictionaryStats {
        let mut total_entries = 0;
        let mut languages = Vec::new();
        
        for (key, dict) in &self.dictionaries {
            total_entries += dict.len();
            languages.push(key.clone());
        }
        
        DictionaryStats {
            total_entries,
            language_pairs: languages,
            active_source: self.active_source.clone(),
            active_target: self.active_target.clone(),
        }
    }
    
    /// Pulisce tutti i dizionari
    pub fn clear_all(&mut self) {
        self.dictionaries.clear();
        info!("[DictionaryEngine] Tutti i dizionari puliti");
    }
    
    /// Pulisce un dizionario specifico
    #[allow(dead_code)]
    pub fn clear_pair(&mut self, source: &str, target: &str) {
        let key = Self::get_key(source, target);
        if let Some(dict) = self.dictionaries.get_mut(&key) {
            dict.clear();
            info!("[DictionaryEngine] Dizionario {} -> {} pulito", source, target);
        }
    }
    
    /// Esporta traduzioni in JSON
    pub fn export_to_json(&self, path: &str) -> Result<(), String> {
        let key = Self::get_key(&self.active_source, &self.active_target);
        
        let dict = self.dictionaries.get(&key)
            .ok_or_else(|| "Dizionario non trovato".to_string())?;
        
        let translations: HashMap<String, String> = dict.translations_by_text
            .iter()
            .map(|(k, v)| (k.clone(), v.translated.clone()))
            .collect();
        
        let json = serde_json::to_string_pretty(&translations)
            .map_err(|e| format!("Errore serializzazione: {}", e))?;
        
        fs::write(path, json)
            .map_err(|e| format!("Errore scrittura file: {}", e))?;
        
        info!("[DictionaryEngine] Esportate {} traduzioni in {}", translations.len(), path);
        Ok(())
    }
}

/// Statistiche del dictionary engine
#[derive(Debug, Clone, Serialize)]
pub struct DictionaryStats {
    pub total_entries: usize,
    pub language_pairs: Vec<String>,
    pub active_source: String,
    pub active_target: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_dictionary_add_and_get() {
        let mut engine = DictionaryEngine::new();
        engine.set_active_languages("en", "it");
        
        engine.add_translation("Hello".to_string(), "Ciao".to_string());
        engine.add_translation("World".to_string(), "Mondo".to_string());
        
        let hash = TranslationRequest::compute_hash("Hello");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Ciao".to_string()));
        
        let hash2 = TranslationRequest::compute_hash("World");
        assert_eq!(engine.get_translation(hash2, "World"), Some("Mondo".to_string()));
    }
    
    #[test]
    fn test_dictionary_not_found() {
        let engine = DictionaryEngine::new();
        let hash = TranslationRequest::compute_hash("Unknown");
        assert_eq!(engine.get_translation(hash, "Unknown"), None);
    }
    
    #[test]
    fn test_load_translations() {
        let mut engine = DictionaryEngine::new();
        
        let translations = vec![
            ("Hello".to_string(), "Ciao".to_string()),
            ("Goodbye".to_string(), "Arrivederci".to_string()),
        ];
        
        let count = engine.load_translations("en", "it", translations);
        assert_eq!(count, 2);
        
        let stats = engine.get_stats();
        assert_eq!(stats.total_entries, 2);
    }
    
    #[test]
    fn test_multiple_language_pairs() {
        let mut engine = DictionaryEngine::new();
        
        engine.load_translations("en", "it", vec![
            ("Hello".to_string(), "Ciao".to_string()),
        ]);
        
        engine.load_translations("en", "de", vec![
            ("Hello".to_string(), "Hallo".to_string()),
        ]);
        
        engine.set_active_languages("en", "it");
        let hash = TranslationRequest::compute_hash("Hello");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Ciao".to_string()));
        
        engine.set_active_languages("en", "de");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Hallo".to_string()));
    }
}
