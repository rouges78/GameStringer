# 🛠️ Piano di Implementazione Cleanup Rust - Task 1.2

## 📋 Lista Azioni Concrete

### 🗑️ FASE 1: RIMOZIONE CODICE SICURO

#### A. Steam Commands (commands/steam.rs)
```rust
// RIMUOVERE queste funzioni:
async fn make_rate_limited_request(...)  // Riga ~189
fn save_credentials_securely(...)        // Riga ~1611  
async fn parse_shared_games_xml(...)     // Riga ~2203
async fn enrich_game_details(...)        // Riga ~2233
async fn get_decrypted_api_key_from_profile(...) // Riga ~2542
async fn get_steam_games_internal(...)   // Riga ~2566
```

#### B. Epic Commands (commands/epic.rs)
```rust
// RIMUOVERE queste funzioni:
async fn search_epic_configs_by_account_id(...)  // Riga ~1018
async fn search_epic_web_cache(...)              // Riga ~1069
async fn search_registry_by_account_id(...)      // Riga ~1105
fn extract_games_from_file_content(...)          // Riga ~1148
async fn get_epic_owned_games_legacy(...)        // Riga ~1321
async fn try_parse_epic_config(...)              // Riga ~1375
async fn read_epic_registry_games(...)           // Riga ~1440
fn is_valid_epic_game_name(...)                  // Riga ~2021
fn decrypt_epic_credentials(...)                 // Riga ~2313
async fn get_decrypted_epic_credentials(...)     // Riga ~2470
```

#### C. Library Commands (commands/library.rs)
```rust
// RIMUOVERE queste funzioni:
async fn get_gog_installed_games(...)    // Riga ~244
async fn parse_gog_registry_entry(...)   // Riga ~263
```

#### D. Patches Commands (commands/patches.rs)
```rust
// RIMUOVERE questa funzione:
pub async fn translate_text(...)         // Riga ~77
```

#### E. Profile Credentials (commands/profile_credentials.rs)
```rust
// RIMUOVERE TUTTO IL FILE - Sistema non utilizzato
// Oppure aggiungere #[allow(dead_code)] all'intero modulo se serve per future
```

### 🛡️ FASE 2: PROTEZIONE CODICE CRITICO

#### A. Injection System (injekt.rs)
```rust
// AGGIUNGERE #[allow(dead_code)] a:
impl InjektTranslator {
    #[allow(dead_code)]
    pub fn get_stats(&self) -> Value { ... }
    
    #[allow(dead_code)]
    fn detect_anti_cheat(&self, _pid: u32) -> Result<bool, Box<dyn Error>> { ... }
    
    #[allow(dead_code)]
    fn get_process_modules(&self, _handle: HANDLE) -> Result<Vec<ProcessModule>, Box<dyn Error>> { ... }
    
    #[allow(dead_code)]
    fn is_module_safe(&self, module_name: &str) -> bool { ... }
    
    #[allow(dead_code)]
    fn validate_memory_address(&self, address: usize) -> Result<(), Box<dyn Error>> { ... }
    
    #[allow(dead_code)]
    fn apply_hook_with_retry(&self, hook: &HookPoint) -> Result<(), Box<dyn Error>> { ... }
    
    #[allow(dead_code)]
    fn perform_hook(&self, hook: &HookPoint) -> Result<(), Box<dyn Error>> { ... }
    
    #[allow(dead_code)]
    fn attempt_recovery(&mut self) -> Result<(), Box<dyn Error>> { ... }
}

// AGGIUNGERE #[allow(dead_code)] a costanti:
#[allow(dead_code)]
const MAX_HOOK_RETRIES: u32 = 3;

#[allow(dead_code)]
const HOOK_RETRY_DELAY: Duration = Duration::from_millis(100);

#[allow(dead_code)]
const MEMORY_VALIDATION_SIZE: usize = 4096;

// AGGIUNGERE #[allow(dead_code)] a struct/enum:
#[allow(dead_code)]
struct ProcessModule { ... }

#[allow(dead_code)]
struct InjectionError { ... }

#[allow(dead_code)]
enum ErrorType { ... }
```

#### B. Anti-Cheat System (anti_cheat.rs)
```rust
// AGGIUNGERE #[allow(dead_code)] a:
impl AntiCheatState {
    #[allow(dead_code)]
    pub fn new() -> Self { ... }
}
```

#### C. SafeHandle (injekt.rs)
```rust
impl SafeHandle {
    #[allow(dead_code)]
    pub fn is_null(&self) -> bool { ... }
}
```

### 📝 FASE 3: DOCUMENTAZIONE

#### A. Aggiungere commenti esplicativi
```rust
/// Sistema di injection per traduzione giochi.
/// Metodi di sicurezza e diagnostica mantenuti per protezione utenti.
/// Alcuni metodi sono marcati con #[allow(dead_code)] perché fanno parte
/// dell'API di sicurezza che deve essere mantenuta anche se non utilizzata attualmente.
impl InjektTranslator {
    // ...
}
```

#### B. Documentare rimozioni
```rust
// Rimosso: make_rate_limited_request - funzione helper non utilizzata
// Rimosso: save_credentials_securely - implementazione legacy
// Rimosso: parse_shared_games_xml - parser XML non implementato
```

## 🔧 COMANDI DI IMPLEMENTAZIONE

### Script di Rimozione Automatica
```bash
# Rimuovere funzioni specifiche da file
# Usare sed o script personalizzato per rimozione precisa

# Esempio per steam.rs:
sed -i '/async fn make_rate_limited_request/,/^}/d' src/commands/steam.rs
sed -i '/fn save_credentials_securely/,/^}/d' src/commands/steam.rs
# ... altri comandi
```

### Verifica Post-Rimozione
```bash
# Test compilazione
cargo check

# Test build completo  
cargo build

# Conteggio warning
cargo check 2>&1 | grep "warning:" | wc -l
```

## 📊 METRICHE ATTESE

### Prima dell'implementazione:
- Warning totali: ~54
- Funzioni dead code: ~35
- Struct/enum non utilizzati: ~5

### Dopo l'implementazione:
- Warning totali: ~15-20 (riduzione 60-70%)
- Funzioni rimosse: ~25-30
- Elementi protetti: ~15

## ⚠️ PRECAUZIONI

### Non Rimuovere:
- Funzioni pubbliche esportate
- Sistemi di sicurezza (anti-cheat, injection)
- API per testing (anche se non utilizzate ora)
- Configurazioni critiche

### Testare Dopo Rimozione:
- Compilazione completa
- Funzionalità injection
- Sistemi di traduzione
- Caricamento profili

### Backup:
- Creare branch Git prima delle modifiche
- Salvare lista funzioni rimosse
- Documentare modifiche per rollback

## 🎯 PRIORITÀ IMPLEMENTAZIONE

1. **Alta**: Profile Credentials (sistema completo non utilizzato)
2. **Alta**: Funzioni helper Steam/Epic (molte funzioni)
3. **Media**: Protezione sistemi sicurezza
4. **Bassa**: Pulizia costanti e struct minori

## 📅 TIMELINE STIMATA

- **Fase 1** (Rimozione): 2-3 ore
- **Fase 2** (Protezione): 1-2 ore  
- **Fase 3** (Documentazione): 1 ora
- **Testing**: 1 ora
- **Totale**: 5-7 ore

## ✅ CHECKLIST COMPLETAMENTO

- [ ] Analisi codice completata
- [ ] Lista rimozioni identificata
- [ ] Lista protezioni identificata
- [ ] Backup creato
- [ ] Rimozioni implementate
- [ ] Protezioni implementate
- [ ] Documentazione aggiunta
- [ ] Test compilazione
- [ ] Test funzionalità
- [ ] Warning conteggiati
- [ ] Commit finale