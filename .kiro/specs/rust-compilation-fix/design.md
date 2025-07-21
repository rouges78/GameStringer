# Design Document - Risoluzione Errori Compilazione Rust

## Overview

Il sistema GameStringer presenta 119 errori di compilazione Rust che impediscono l'avvio dell'applicazione Tauri. L'analisi degli errori rivela problemi sistematici in diverse categorie:

1. **Struct Field Mismatch**: La struct `GameScanResult` ha campi mancanti
2. **Type Inconsistencies**: Conflitti tra `Instant` e `DateTime<Utc>`
3. **Threading Safety**: Problemi con `Send`/`Sync` per tipi contenenti `*mut c_void`
4. **Async/Future Issues**: Problemi con funzioni che non implementano `Future`
5. **Missing Debug Implementations**: Struct che non implementano `Debug`
6. **API Deprecation**: Uso di API deprecate come `base64::encode/decode`
7. **Function Signature Mismatches**: Parametri mancanti nelle chiamate di funzione

## Architecture

### Strategia di Risoluzione Sistematica

```
┌─────────────────────────────────────────────────────────────┐
│                    RUST COMPILATION FIX                    │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Struct & Model Fixes                             │
│  ├── Fix GameScanResult struct definition                  │
│  ├── Update models.rs with missing fields                  │
│  └── Ensure serialization compatibility                    │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: Type System Fixes                               │
│  ├── Standardize temporal types (DateTime<Utc>)           │
│  ├── Fix type conversions and casts                       │
│  └── Resolve Option<T> vs Result<T,E> mismatches          │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: Threading & Safety Fixes                        │
│  ├── Implement Send/Sync for thread-safe types            │
│  ├── Replace raw pointers with safe alternatives          │
│  └── Fix Arc<Mutex<T>> usage patterns                     │
├─────────────────────────────────────────────────────────────┤
│  Phase 4: Async & Future Fixes                            │
│  ├── Fix async function signatures                        │
│  ├── Resolve Future implementation issues                 │
│  └── Correct .await usage patterns                        │
├─────────────────────────────────────────────────────────────┤
│  Phase 5: Trait Implementation Fixes                      │
│  ├── Add missing Debug implementations                    │
│  ├── Implement Display where needed                       │
│  └── Add Clone/Default where required                     │
├─────────────────────────────────────────────────────────────┤
│  Phase 6: API & Dependency Updates                        │
│  ├── Update deprecated base64 API usage                   │
│  ├── Fix function parameter mismatches                    │
│  └── Resolve import and module issues                     │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Model System Fixes

**GameScanResult Enhancement**
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameScanResult {
    pub title: String,
    pub path: String,
    pub executable_path: Option<String>,
    pub app_id: Option<String>,
    pub source: String,
    pub is_installed: bool,
    // Campi mancanti da aggiungere:
    pub id: String,
    pub platform: String,
    pub header_image: Option<String>,
    pub is_vr: bool,
    pub engine: Option<String>,
    pub supported_languages: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub last_played: Option<u64>,
}
```

### 2. Temporal Type Standardization

**Unified Time System**
```rust
use chrono::{DateTime, Utc};

// Standardize all timestamp usage to DateTime<Utc>
pub struct TimestampedData {
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub timestamp: DateTime<Utc>,
}

// Helper functions for time operations
pub fn now() -> DateTime<Utc> {
    Utc::now()
}

pub fn duration_since(timestamp: DateTime<Utc>) -> chrono::Duration {
    Utc::now().signed_duration_since(timestamp)
}
```

### 3. Thread Safety Improvements

**Safe Pointer Management**
```rust
// Replace raw pointers with safe alternatives
pub struct SafeInjektTranslator {
    pub process_handle: Option<Arc<Mutex<ProcessHandle>>>, // Instead of *mut c_void
    pub is_active: Arc<AtomicBool>,
    pub config: Arc<InjectionConfig>,
}

// Implement Send + Sync safely
unsafe impl Send for SafeInjektTranslator {}
unsafe impl Sync for SafeInjektTranslator {}
```

### 4. Async Function Corrections

**Future Implementation Fixes**
```rust
// Fix HowLongToBeat async issues
pub async fn search_game_hltb_async(title: String) -> Result<Vec<Game>, Box<dyn std::error::Error>> {
    let normalized_title = normalize_title(&title);
    
    // Use tokio::task::spawn_blocking for CPU-bound work
    let result = tokio::task::spawn_blocking(move || {
        howlongtobeat::search(&normalized_title)
    }).await?;
    
    Ok(result)
}

// Fix timeout usage
pub async fn search_with_timeout(title: String) -> Result<Vec<Game>, Box<dyn std::error::Error>> {
    let future = search_game_hltb_async(title);
    tokio::time::timeout(Duration::from_secs(10), future).await?
}
```

### 5. Trait Implementation Strategy

**Debug Implementation Pattern**
```rust
// Add Debug to all required structs
#[derive(Debug)]
pub struct AntiCheatManager {
    pub known_systems: HashMap<String, AntiCheatInfo>,
    pub detection_cache: HashMap<u32, DetectionResult>,
}

#[derive(Debug)]
pub struct PerformanceOptimizer {
    pub config: OptimizationConfig,
    pub metrics: PerformanceMetrics,
}

// Display implementation for enums
impl std::fmt::Display for CacheType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CacheType::Steam => write!(f, "Steam"),
            CacheType::Epic => write!(f, "Epic"),
            CacheType::Translation => write!(f, "Translation"),
            // ... other variants
        }
    }
}
```

## Data Models

### Updated GameScanResult
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameScanResult {
    // Existing fields
    pub title: String,
    pub path: String,
    pub executable_path: Option<String>,
    pub app_id: Option<String>,
    pub source: String,
    pub is_installed: bool,
    
    // Missing fields to add
    pub id: String,
    pub platform: String,
    pub header_image: Option<String>,
    pub is_vr: bool,
    pub engine: Option<String>,
    pub supported_languages: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub last_played: Option<u64>,
}
```

### Standardized Error Types
```rust
#[derive(Debug, Clone)]
pub enum ErrorType {
    // Existing variants
    SteamApiError,
    EpicApiError,
    NetworkError,
    
    // Missing variants to add
    CacheWriteError,
    CompilationError,
    TypeMismatchError,
}
```

## Error Handling

### Compilation Error Categories

1. **Struct Field Errors (E0560)**
   - Missing fields in GameScanResult
   - Solution: Add all required fields to struct definition

2. **Type Mismatch Errors (E0308)**
   - Instant vs DateTime<Utc> conflicts
   - Option<T> vs T mismatches
   - Solution: Standardize type usage throughout codebase

3. **Threading Errors (E0277)**
   - Send/Sync not implemented for types with raw pointers
   - Solution: Replace raw pointers with safe alternatives

4. **Future Errors (E0277)**
   - Types not implementing Future trait
   - Solution: Proper async/await implementation

5. **Missing Method Errors (E0599)**
   - Methods not available for certain types
   - Solution: Use correct type-specific methods

## Testing Strategy

### Compilation Testing
```rust
#[cfg(test)]
mod compilation_tests {
    use super::*;
    
    #[test]
    fn test_game_scan_result_creation() {
        let game = GameScanResult {
            title: "Test Game".to_string(),
            path: "/path/to/game".to_string(),
            executable_path: Some("/path/to/exe".to_string()),
            app_id: Some("123".to_string()),
            source: "Steam".to_string(),
            is_installed: true,
            id: "test-id".to_string(),
            platform: "Steam".to_string(),
            header_image: None,
            is_vr: false,
            engine: None,
            supported_languages: None,
            genres: None,
            last_played: None,
        };
        
        // Test serialization
        let json = serde_json::to_string(&game).unwrap();
        let deserialized: GameScanResult = serde_json::from_str(&json).unwrap();
        assert_eq!(game.title, deserialized.title);
    }
    
    #[test]
    fn test_temporal_types() {
        let now = Utc::now();
        let duration = Utc::now().signed_duration_since(now);
        assert!(duration.num_milliseconds() >= 0);
    }
}
```

### Integration Testing
```rust
#[tokio::test]
async fn test_async_functions() {
    let result = search_game_hltb_async("Test Game".to_string()).await;
    assert!(result.is_ok());
}

#[test]
fn test_thread_safety() {
    let translator = SafeInjektTranslator::new();
    let handle = std::thread::spawn(move || {
        // Test that translator can be moved between threads
        translator.is_active.store(true, std::sync::atomic::Ordering::Relaxed);
    });
    handle.join().unwrap();
}
```

## Implementation Priority

### Phase 1: Critical Struct Fixes (High Priority)
- Fix GameScanResult struct definition
- Update all usages of GameScanResult
- Ensure model consistency

### Phase 2: Type System Standardization (High Priority)
- Replace all Instant with DateTime<Utc>
- Fix Option/Result type mismatches
- Standardize temporal operations

### Phase 3: Threading Safety (Medium Priority)
- Replace raw pointers with safe alternatives
- Implement Send/Sync where needed
- Fix Arc<Mutex<T>> patterns

### Phase 4: Async/Future Corrections (Medium Priority)
- Fix async function implementations
- Correct .await usage
- Implement proper Future traits

### Phase 5: Trait Implementations (Low Priority)
- Add Debug implementations
- Implement Display where needed
- Add missing Clone/Default traits

### Phase 6: API Updates (Low Priority)
- Update deprecated base64 usage
- Fix function parameter mismatches
- Clean up imports and modules