# Implementation Plan - Risoluzione Errori Compilazione Rust

- [x] 1. Fix GameScanResult struct definition and model consistency


  - Aggiungere tutti i campi mancanti alla struct GameScanResult in models.rs
  - Aggiornare tutte le istanziazioni di GameScanResult nel codebase
  - Verificare compatibilità serializzazione/deserializzazione
  - _Requirements: 1.1, 2.1, 2.2_

- [ ] 2. Standardize temporal types throughout codebase
- [x] 2.1 Replace Instant with DateTime<Utc> in cache_manager.rs


  - Sostituire tutti gli usi di `Instant::now()` con `Utc::now()`
  - Aggiornare i campi `created_at` e `last_accessed` per usare DateTime<Utc>
  - Implementare helper functions per operazioni temporali
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.2 Fix temporal types in error_manager.rs


  - Sostituire `Instant::now()` con `Utc::now()` in tutti i timestamp
  - Aggiornare metodi di confronto temporale per usare DateTime<Utc>
  - Correggere calcoli di durata usando chrono::Duration
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.3 Fix temporal types in memory_audit.rs



  - Aggiornare campo `allocated_at` per usare DateTime<Utc>
  - Correggere metodi `duration_since` per compatibilità con DateTime
  - Sostituire chiamate `.elapsed()` con calcoli di durata appropriati
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Implement thread safety fixes for injection system
- [x] 3.1 Replace raw pointers in InjektTranslator


  - Sostituire `*mut c_void` con alternative thread-safe
  - Implementare wrapper sicuro per handle di processo
  - Aggiungere implementazioni unsafe Send/Sync dove necessario
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3.2 Fix multi-process injection threading issues



  - Correggere problemi Send/Sync in MultiProcessInjekt
  - Aggiornare thread spawn per compatibilità con tipi thread-safe
  - Implementare pattern Arc<Mutex<T>> corretto per condivisione dati
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 4. Fix async/Future implementation issues

- [x] 4.1 Correct HowLongToBeat async integration



  - Wrappare howlongtobeat::search in tokio::task::spawn_blocking
  - Rimuovere .await errato da funzioni sincrone
  - Implementare timeout corretto per operazioni async
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4.2 Fix DLC manager async function calls



  - Aggiungere parametri mancanti a get_steam_games() call
  - Correggere signature delle funzioni async
  - Implementare error handling appropriato per chiamate async
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 5. Add missing Debug trait implementations
- [x] 5.1 Implement Debug for AntiCheatManager


  - Aggiungere #[derive(Debug)] a AntiCheatManager struct
  - Verificare che tutti i campi implementino Debug
  - Testare formattazione debug output
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 5.2 Implement Debug for PerformanceOptimizer




  - Aggiungere #[derive(Debug)] a PerformanceOptimizer struct
  - Correggere problemi di ownership nel costruttore
  - Implementare Clone per OptimizationConfig se necessario
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Implement Display trait for enums and types
- [x] 6.1 Add Display implementation for CacheType



  - Implementare std::fmt::Display per CacheType enum
  - Aggiungere match arms per tutti i variant
  - Testare formattazione string output
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 6.2 Add Display for ErrorType enum



  - Aggiungere variant CacheWriteError mancante
  - Implementare Display trait per tutti i variant
  - Verificare compatibilità con error handling esistente
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 7. Fix cache system type mismatches
- [x] 7.1 Correct IntelligentCache return types



  - Correggere match arms per Option vs Result types
  - Aggiornare error handling per cache operations
  - Implementare metodi mancanti come invalidate()
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 7.2 Fix cache cleanup and optimization



  - Correggere type conversions u64 to usize
  - Implementare proper error handling per cleanup operations
  - Aggiungere bounds checking per conversioni numeriche
  - _Requirements: 1.1, 2.1, 2.2_

- [ ] 8. Update deprecated API usage
- [x] 8.1 Replace deprecated base64 API calls



  - Sostituire base64::encode con base64::Engine::encode
  - Sostituire base64::decode con base64::Engine::decode
  - Aggiornare tutti i moduli (rockstar, itchio, battlenet, ubisoft, origin)
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8.2 Fix function parameter mismatches




  - Aggiungere parametri mancanti alle chiamate di funzione
  - Correggere type mismatches negli argomenti
  - Verificare signature compatibility tra definizione e uso
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 9. Fix ownership and borrowing issues
- [x] 9.1 Resolve config ownership in PerformanceOptimizer



  - Implementare Clone per OptimizationConfig
  - Correggere uso di config dopo move
  - Aggiungere lifetime parameters se necessario
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 9.2 Fix cache borrowing conflicts



  - Risolvere immutable/mutable borrow conflicts
  - Implementare pattern di accesso sicuro per cache
  - Aggiungere scope appropriati per borrow checker
  - _Requirements: 1.1, 2.1, 2.2_





- [ ] 10. Clean up unused variables and warnings
- [x] 10.1 Fix unused variable warnings




  - Aggiungere underscore prefix a variabili non utilizzate
  - Rimuovere variabili completamente inutilizzate
  - Implementare uso appropriato dove necessario
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 10.2 Clean up dead code and imports


  - Rimuovere import non utilizzati
  - Pulire codice commentato permanentemente
  - Verificare che tutti i moduli siano correttamente referenziati
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Verify compilation and run comprehensive tests
- [x] 11.1 Run cargo check and fix remaining issues



  - Eseguire cargo check per verificare risoluzione errori
  - Correggere eventuali errori rimanenti
  - Documentare soluzioni per problemi complessi
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 11.2 Run cargo build and test executable generation





  - Eseguire cargo build per generare eseguibile
  - Verificare che non ci siano errori di linking
  - Testare avvio applicazione con npm run tauri:dev
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 11.3 Perform integration testing
  - Testare funzionalità principali dell'applicazione
  - Verificare che le correzioni non abbiano rotto funzionalità esistenti
  - Documentare eventuali regressioni e correzioni
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 12. Fix Library Page Loop Issue
- [x] 12.1 Fix infinite load_steam_credentials loop in Library page



  - Applicare stesso fix usato per Store Manager
  - Implementare debouncing per chiamate API
  - Aggiungere flag anti-loop per prevenire chiamate simultanee
  - Correggere logica di controllo credenziali
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 13. Fix Epic Games OAuth Authentication Flow
- [x] 13.1 Fix Epic Games OAuth callback handling



  - Implementare gestione del redirect URL localhost/launcher/authorized
  - Processare authorization code ricevuto da Epic
  - Completare il flusso OAuth per ottenere access token
  - Gestire errori di autenticazione Epic
  - _Requirements: 1.1, 1.2, 1.3_