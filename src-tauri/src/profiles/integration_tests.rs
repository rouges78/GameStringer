#[cfg(test)]
mod profile_manager_integration_tests {
    use crate::profiles::manager::ProfileManager;
    use crate::profiles::storage::ProfileStorage;
    use crate::profiles::models::{CreateProfileRequest, ProfileSettings, Theme, NotificationSettings, LibrarySettings, SecuritySettings};
    use crate::profiles::errors::ProfileError;
    use crate::profiles::rate_limiter::{RateLimiterConfig, RateLimitResult};
    use crate::profiles::secure_memory::SecureMemory;
    use tempfile::TempDir;
    use tokio;
    // use std::time::Duration; // Unused import
    // use std::collections::HashMap; // Unused import

    /// Helper per creare un ProfileManager temporaneo per i test
    async fn create_test_manager() -> (ProfileManager, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).expect("Failed to create storage");
        let manager = ProfileManager::new(storage);
        (manager, temp_dir)
    }

    /// Helper per creare una richiesta di profilo di test
    fn create_test_profile_request(name: &str, password: &str) -> CreateProfileRequest {
        CreateProfileRequest {
            name: name.to_string(),
            password: password.to_string(),
            avatar_path: None,
            settings: Some(ProfileSettings {
                theme: Theme::Dark,
                language: "it".to_string(),
                auto_login: false,
                notifications: NotificationSettings {
                    desktop_enabled: true,
                    sound_enabled: false,
                    new_games: true,
                    updates: true,
                    deals: false,
                },
                game_library: LibrarySettings {
                    default_view: crate::profiles::models::LibraryView::Grid,
                    default_sort: crate::profiles::models::LibrarySort::Alphabetical,
                    show_hidden: false,
                    auto_refresh: true,
                    refresh_interval: 30,
                },
                security: SecuritySettings {
                    session_timeout: 60,
                    require_password_for_sensitive: true,
                    auto_lock_failed_attempts: 5,
                    lock_duration: 30,
                },
            }),
        }
    }

    #[tokio::test]
    async fn test_profile_crud_operations() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Test: Creazione profilo
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        let profile = manager.create_profile(request).await.expect("Failed to create profile");
        
        assert_eq!(profile.name, "TestUser");
        assert!(!profile.id.is_empty());
        assert_eq!(profile.settings.theme, Theme::Dark);
        assert_eq!(profile.settings.language, "it");

        // Test: Lista profili
        let profiles = manager.list_profiles().await.expect("Failed to list profiles");
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "TestUser");

        // Test: Autenticazione profilo
        let authenticated = manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to authenticate");
        assert_eq!(authenticated.name, "TestUser");
        assert!(manager.is_profile_active());

        // Test: Profilo corrente
        let current = manager.current_profile().expect("No current profile");
        assert_eq!(current.name, "TestUser");

        // Test: Logout
        manager.logout().expect("Failed to logout");
        assert!(!manager.is_profile_active());
        assert!(manager.current_profile().is_none());

        // Test: Eliminazione profilo
        manager.delete_profile(&profile.id, "SecurePass123!").await.expect("Failed to delete profile");
        let profiles_after_delete = manager.list_profiles().await.expect("Failed to list profiles");
        assert_eq!(profiles_after_delete.len(), 0);
    }

    #[tokio::test]
    async fn test_profile_authentication_errors() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea un profilo di test
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        manager.create_profile(request).await.expect("Failed to create profile");

        // Test: Password errata
        let result = manager.authenticate_profile("TestUser", "WrongPassword").await;
        assert!(matches!(result, Err(ProfileError::InvalidCredentials)));

        // Test: Utente inesistente
        let result = manager.authenticate_profile("NonExistentUser", "AnyPassword").await;
        assert!(matches!(result, Err(ProfileError::ProfileNotFound(_))));
    }

    #[tokio::test]
    async fn test_rate_limiting() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Configura rate limiter per test rapidi
        let config = RateLimiterConfig {
            max_attempts: 3,
            block_duration_seconds: 2,
            reset_after_seconds: 10,
            exponential_backoff: false,
            backoff_factor: 1.0,
            max_block_duration_seconds: 10,
        };
        manager.set_rate_limiter_config(config);

        // Crea un profilo di test
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        let profile = manager.create_profile(request).await.expect("Failed to create profile");

        // Test: Primi tentativi falliti dovrebbero essere consentiti
        for _ in 0..3 {
            let result = manager.authenticate_profile("TestUser", "WrongPassword").await;
            assert!(matches!(result, Err(ProfileError::InvalidCredentials)));
        }

        // Test: Il quarto tentativo dovrebbe essere bloccato
        let result = manager.authenticate_profile("TestUser", "WrongPassword").await;
        assert!(matches!(result, Err(ProfileError::TooManyAttempts(_))));

        // Test: Anche con password corretta dovrebbe essere bloccato
        let result = manager.authenticate_profile("TestUser", "SecurePass123!").await;
        assert!(matches!(result, Err(ProfileError::TooManyAttempts(_))));

        // Test: Reset manuale dei tentativi
        manager.reset_login_attempts(&profile.id);
        let result = manager.authenticate_profile("TestUser", "SecurePass123!").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_secure_memory() {
        // Test: Creazione e accesso
        let password = "SensitivePassword123!";
        let secure_password = SecureMemory::new(password.to_string());
        assert_eq!(*secure_password, password);

        // Test: Pulizia manuale
        let mut secure_password = SecureMemory::new(password.to_string());
        secure_password.clear();
        assert_eq!(*secure_password, "");

        // Test: Pulizia automatica al drop (testato implicitamente)
        {
            let _secure_data = SecureMemory::new("TemporaryData".to_string());
            // secure_data viene automaticamente pulito quando esce dallo scope
        }
    }

    #[tokio::test]
    async fn test_profile_settings_management() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea e autentica profilo
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        manager.create_profile(request).await.expect("Failed to create profile");
        manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to authenticate");

        // Test: Aggiornamento impostazioni
        let mut new_settings = ProfileSettings {
            theme: Theme::Light,
            language: "en".to_string(),
            auto_login: true,
            notifications: NotificationSettings {
                desktop_enabled: false,
                sound_enabled: true,
                new_games: false,
                updates: false,
                deals: true,
            },
            game_library: LibrarySettings {
                default_view: crate::profiles::models::LibraryView::List,
                default_sort: crate::profiles::models::LibrarySort::LastPlayed,
                show_hidden: true,
                auto_refresh: false,
                refresh_interval: 60,
            },
            security: SecuritySettings {
                session_timeout: 30,
                require_password_for_sensitive: false,
                auto_lock_failed_attempts: 3,
                lock_duration: 15,
            },
        };

        manager.update_settings(new_settings.clone(), "SecurePass123!").await.expect("Failed to update settings");

        // Verifica che le impostazioni siano state aggiornate
        let current_settings = manager.get_settings().expect("No current settings");
        assert_eq!(current_settings.theme, Theme::Light);
        assert_eq!(current_settings.language, "en");
        assert_eq!(current_settings.auto_login, true);
        assert_eq!(current_settings.notifications.desktop_enabled, false);
        assert_eq!(current_settings.game_library.auto_refresh, false);
        assert_eq!(current_settings.security.session_timeout, 30);
    }

    #[tokio::test]
    async fn test_credential_management() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea e autentica profilo
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        manager.create_profile(request).await.expect("Failed to create profile");
        manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to authenticate");

        // Test: Aggiunta credenziale
        let credential = EncryptedCredential {
            store: "steam".to_string(),
            encrypted_data: "encrypted_password_data".to_string(),
            nonce: "test_nonce".to_string(),
            salt: "test_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };

        manager.add_credential(credential.clone(), "SecurePass123!").await.expect("Failed to add credential");

        // Test: Recupero credenziale
        let retrieved = manager.get_credential("steam").expect("Credential not found");
        assert_eq!(retrieved.store, "steam");
        assert_eq!(retrieved.encrypted_data, "encrypted_password_data");

        // Test: Rimozione credenziale
        manager.remove_credential("steam", "SecurePass123!").await.expect("Failed to remove credential");
        let retrieved_after_removal = manager.get_credential("steam");
        assert!(retrieved_after_removal.is_none());
    }

    #[tokio::test]
    async fn test_session_management() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea e autentica profilo
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        manager.create_profile(request).await.expect("Failed to create profile");
        manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to authenticate");

        // Test: Statistiche sessione
        let stats = manager.get_session_stats().expect("No session stats");
        assert!(stats.session_start <= chrono::Utc::now());
        assert_eq!(stats.credential_operations, 0);
        assert_eq!(stats.settings_changes, 0);

        // Test: Durata sessione
        let duration = manager.get_current_session_duration().expect("No session duration");
        assert!(duration >= 0);

        // Test: Timeout sessione
        assert!(!manager.is_session_expired(3600)); // 1 ora
        assert!(manager.is_session_expired(0)); // Timeout immediato

        // Test: Rinnovo sessione
        manager.renew_session().expect("Failed to renew session");

        // Test: Logout con timeout
        let logged_out = manager.logout_with_timeout(0).expect("Failed to logout with timeout");
        assert!(logged_out);
        assert!(!manager.is_profile_active());
    }

    #[tokio::test]
    async fn test_profile_validation() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Test: Nome profilo non valido
        let invalid_request = CreateProfileRequest {
            name: "".to_string(), // Nome vuoto
            password: "SecurePass123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let result = manager.create_profile(invalid_request).await;
        assert!(result.is_err());

        // Test: Password debole
        let weak_password_request = CreateProfileRequest {
            name: "TestUser".to_string(),
            password: "123".to_string(), // Password troppo debole
            avatar_path: None,
            settings: None,
        };
        let result = manager.create_profile(weak_password_request).await;
        assert!(result.is_err());

        // Test: Nome profilo duplicato
        let request1 = create_test_profile_request("TestUser", "SecurePass123!");
        manager.create_profile(request1).await.expect("Failed to create first profile");

        let request2 = create_test_profile_request("TestUser", "AnotherPass456!");
        let result = manager.create_profile(request2).await;
        assert!(matches!(result, Err(ProfileError::ProfileAlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_multiple_profiles() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea più profili
        let profiles_data = vec![
            ("User1", "Pass1_Secure!"),
            ("User2", "Pass2_Secure!"),
            ("User3", "Pass3_Secure!"),
        ];

        let mut created_profiles = Vec::new();
        for (name, password) in &profiles_data {
            let request = create_test_profile_request(name, password);
            let profile = manager.create_profile(request).await.expect("Failed to create profile");
            created_profiles.push(profile);
        }

        // Test: Lista tutti i profili
        let all_profiles = manager.list_profiles().await.expect("Failed to list profiles");
        assert_eq!(all_profiles.len(), 3);

        // Test: Cambio profilo
        manager.authenticate_profile("User1", "Pass1_Secure!").await.expect("Failed to authenticate User1");
        assert_eq!(manager.current_profile().unwrap().name, "User1");

        manager.switch_profile("User2", "Pass2_Secure!").await.expect("Failed to switch to User2");
        assert_eq!(manager.current_profile().unwrap().name, "User2");

        // Test: Isolamento dati tra profili
        // Aggiungi credenziale al User2
        let credential = EncryptedCredential {
            store: "steam".to_string(),
            encrypted_data: "user2_encrypted_data".to_string(),
            nonce: "user2_nonce".to_string(),
            salt: "user2_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        manager.add_credential(credential, "Pass2_Secure!").await.expect("Failed to add credential to User2");

        // Cambia a User3 e verifica che non veda le credenziali di User2
        manager.switch_profile("User3", "Pass3_Secure!").await.expect("Failed to switch to User3");
        let user3_credential = manager.get_credential("steam");
        assert!(user3_credential.is_none());

        // Torna a User2 e verifica che le credenziali ci siano ancora
        manager.switch_profile("User2", "Pass2_Secure!").await.expect("Failed to switch back to User2");
        let user2_credential = manager.get_credential("steam");
        assert!(user2_credential.is_some());
        assert_eq!(user2_credential.unwrap().encrypted_data, "user2_encrypted_data");
    }

    #[tokio::test]
    async fn test_error_handling_edge_cases() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Test: Operazioni senza profilo autenticato
        let result = manager.update_settings(ProfileSettings::default(), "password").await;
        assert!(matches!(result, Err(ProfileError::Unauthorized)));

        let credential = EncryptedCredential {
            store: "test".to_string(),
            encrypted_data: "test".to_string(),
            nonce: "test_nonce".to_string(),
            salt: "test_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        let result = manager.add_credential(credential, "password").await;
        assert!(matches!(result, Err(ProfileError::Unauthorized)));

        // Test: Eliminazione profilo attivo
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        let profile = manager.create_profile(request).await.expect("Failed to create profile");
        manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to authenticate");

        let result = manager.delete_profile(&profile.id, "SecurePass123!").await;
        assert!(matches!(result, Err(ProfileError::Unauthorized)));

        // Test: Operazioni con profilo inesistente
        manager.logout().expect("Failed to logout");
        let result = manager.delete_profile("nonexistent_id", "password").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_encryption_integration() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea profilo con dati sensibili
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        let profile = manager.create_profile(request).await.expect("Failed to create profile");

        // Verifica che il profilo sia stato salvato crittografato
        // (questo test verifica indirettamente che la crittografia funzioni
        // perché se non funzionasse, il caricamento del profilo fallirebbe)
        
        // Logout e riautentica per forzare il caricamento da storage
        manager.logout().expect("Failed to logout");
        let reloaded_profile = manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to reload profile");
        
        assert_eq!(reloaded_profile.name, profile.name);
        assert_eq!(reloaded_profile.id, profile.id);
        assert_eq!(reloaded_profile.settings.theme, profile.settings.theme);

        // Test: Password errata dovrebbe fallire la decrittografia
        manager.logout().expect("Failed to logout");
        let result = manager.authenticate_profile("TestUser", "WrongPassword").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea profilo
        let request = create_test_profile_request("TestUser", "SecurePass123!");
        manager.create_profile(request).await.expect("Failed to create profile");
        manager.authenticate_profile("TestUser", "SecurePass123!").await.expect("Failed to authenticate");

        // Test: Operazioni multiple simultanee (simulazione)
        // In un test reale, queste operazioni dovrebbero essere thread-safe
        
        // Aggiorna impostazioni
        let mut new_settings = ProfileSettings::default();
        new_settings.theme = Theme::Light;
        manager.update_settings(new_settings, "SecurePass123!").await
            .expect("Settings update failed");

        // Aggiungi credenziale
        let credential = EncryptedCredential {
            store: "test_store".to_string(),
            encrypted_data: "test_data".to_string(),
            nonce: "test_nonce".to_string(),
            salt: "test_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        manager.add_credential(credential, "SecurePass123!").await
            .expect("Credential addition failed");

        // Verifica che entrambe le operazioni abbiano avuto successo
        let current_settings = manager.get_settings().expect("No current settings");
        assert_eq!(current_settings.theme, Theme::Light);

        let credential = manager.get_credential("test_store").expect("Credential not found");
        assert_eq!(credential.encrypted_data, "test_data");
    }

    /// Test del flusso completo: creazione → autenticazione → uso → export/import
    #[tokio::test]
    async fn test_complete_profile_workflow() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // FASE 1: Creazione profilo completo
        let request = CreateProfileRequest {
            name: "CompleteUser".to_string(),
            password: "CompletePass123!".to_string(),
            avatar_path: Some("/path/to/avatar.png".to_string()),
            settings: Some(ProfileSettings {
                theme: Theme::Dark,
                language: "it".to_string(),
                auto_login: true,
                notifications: NotificationSettings {
                    desktop_enabled: true,
                    sound_enabled: true,
                    new_games: true,
                    updates: false,
                    deals: true,
                },
                game_library: LibrarySettings {
                    default_view: crate::profiles::models::LibraryView::Grid,
                    default_sort: crate::profiles::models::LibrarySort::LastPlayed,
                    show_hidden: false,
                    auto_refresh: true,
                    refresh_interval: 15,
                },
                security: SecuritySettings {
                    session_timeout: 120,
                    require_password_for_sensitive: true,
                    auto_lock_failed_attempts: 3,
                    lock_duration: 60,
                },
            }),
        };

        let created_profile = manager.create_profile(request).await.expect("Failed to create complete profile");
        assert_eq!(created_profile.name, "CompleteUser");
        assert_eq!(created_profile.avatar_path, Some("/path/to/avatar.png".to_string()));

        // FASE 2: Autenticazione e verifica stato
        let authenticated_profile = manager.authenticate_profile("CompleteUser", "CompletePass123!").await
            .expect("Failed to authenticate complete profile");
        
        assert_eq!(authenticated_profile.name, "CompleteUser");
        assert!(manager.is_profile_active());
        
        // Verifica profilo corrente
        {
            let current = manager.current_profile().expect("No current profile after authentication");
            assert_eq!(current.name, "CompleteUser");
            assert_eq!(current.settings.theme, Theme::Dark);
            assert_eq!(current.settings.language, "it");
        }

        // FASE 3: Uso del profilo - operazioni tipiche
        
        // 3a. Aggiunta di multiple credenziali
        let credentials = vec![
            ("steam", "steam_encrypted_data", "steam_nonce", "steam_salt"),
            ("epic", "epic_encrypted_data", "epic_nonce", "epic_salt"),
            ("gog", "gog_encrypted_data", "gog_nonce", "gog_salt"),
        ];

        for (store, data, nonce, salt) in credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: nonce.to_string(),
                salt: salt.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            manager.add_credential(credential, "CompletePass123!").await
                .expect(&format!("Failed to add {} credential", store));
        }

        // 3b. Modifica impostazioni multiple volte
        let mut updated_settings = ProfileSettings::default();
        updated_settings.theme = Theme::Light;
        updated_settings.language = "en".to_string();
        updated_settings.notifications.desktop_enabled = false;
        
        manager.update_settings(updated_settings.clone(), "CompletePass123!").await
            .expect("Failed to update settings first time");

        // Verifica aggiornamento
        let current_settings = manager.get_settings().expect("No current settings");
        assert_eq!(current_settings.theme, Theme::Light);
        assert_eq!(current_settings.language, "en");
        assert_eq!(current_settings.notifications.desktop_enabled, false);

        // 3c. Seconda modifica impostazioni
        updated_settings.security.session_timeout = 30;
        updated_settings.game_library.refresh_interval = 60;
        
        manager.update_settings(updated_settings, "CompletePass123!").await
            .expect("Failed to update settings second time");

        // FASE 4: Verifica isolamento dati - crea secondo profilo
        let second_request = create_test_profile_request("SecondUser", "SecondPass456!");
        let second_profile = manager.create_profile(second_request).await
            .expect("Failed to create second profile");

        // Cambia al secondo profilo
        manager.switch_profile("SecondUser", "SecondPass456!").await
            .expect("Failed to switch to second profile");

        // Verifica che il secondo profilo non veda le credenziali del primo
        assert!(manager.get_credential("steam").is_none());
        assert!(manager.get_credential("epic").is_none());
        assert!(manager.get_credential("gog").is_none());

        // Verifica che le impostazioni siano quelle di default
        let second_settings = manager.get_settings().expect("No settings for second profile");
        assert_eq!(second_settings.theme, Theme::Dark); // Default dal create_test_profile_request
        assert_eq!(second_settings.language, "it");

        // FASE 5: Torna al primo profilo e verifica persistenza
        manager.switch_profile("CompleteUser", "CompletePass123!").await
            .expect("Failed to switch back to first profile");

        // Verifica che tutte le credenziali siano ancora presenti
        assert!(manager.get_credential("steam").is_some());
        assert!(manager.get_credential("epic").is_some());
        assert!(manager.get_credential("gog").is_some());

        // Verifica che le impostazioni modificate siano persistite
        let final_settings = manager.get_settings().expect("No final settings");
        assert_eq!(final_settings.theme, Theme::Light);
        assert_eq!(final_settings.language, "en");
        assert_eq!(final_settings.security.session_timeout, 30);
        assert_eq!(final_settings.game_library.refresh_interval, 60);

        // FASE 6: Test statistiche sessione
        let session_stats = manager.get_session_stats().expect("No session stats");
        assert!(session_stats.credential_operations >= 3); // Almeno 3 credenziali aggiunte
        assert!(session_stats.settings_changes >= 2); // Almeno 2 modifiche impostazioni

        // FASE 7: Test export profilo
        let current_profile_id = manager.current_profile_id().unwrap().to_string();
        let export_data = manager.export_profile(&current_profile_id, "CompletePass123!", None).await
            .expect("Failed to export profile");
        
        assert!(!export_data.encrypted_data.is_empty());
        
        // FASE 8: Test import profilo (su nuovo manager)
        let (mut import_manager, _import_temp_dir) = create_test_manager().await;
        
        let imported_profile = import_manager.import_profile(export_data, "CompletePass123!", None).await
            .expect("Failed to import profile");
        
        assert_eq!(imported_profile.name, "CompleteUser");
        assert_eq!(imported_profile.avatar_path, Some("/path/to/avatar.png".to_string()));

        // Autentica il profilo importato
        import_manager.authenticate_profile("CompleteUser", "CompletePass123!").await
            .expect("Failed to authenticate imported profile");

        // Verifica che le impostazioni siano state importate correttamente
        let imported_settings = import_manager.get_settings().expect("No imported settings");
        assert_eq!(imported_settings.theme, Theme::Light);
        assert_eq!(imported_settings.language, "en");
        assert_eq!(imported_settings.security.session_timeout, 30);

        // Verifica che le credenziali siano state importate
        assert!(import_manager.get_credential("steam").is_some());
        assert!(import_manager.get_credential("epic").is_some());
        assert!(import_manager.get_credential("gog").is_some());

        // FASE 9: Test cleanup finale
        manager.logout().expect("Failed to logout from original manager");
        import_manager.logout().expect("Failed to logout from import manager");
        
        assert!(!manager.is_profile_active());
        assert!(!import_manager.is_profile_active());
    }

    /// Test del flusso di cambio profilo con isolamento dati completo
    #[tokio::test]
    async fn test_profile_switching_data_isolation() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // Crea tre profili con configurazioni diverse
        let profiles_config = vec![
            ("GameUser", "GamePass123!", Theme::Dark, "it", true),
            ("WorkUser", "WorkPass456!", Theme::Light, "en", false),
            ("TestUser", "TestPass789!", Theme::Dark, "fr", true),
        ];

        let mut created_profiles = Vec::new();
        for (name, password, theme, language, auto_login) in profiles_config {
            let mut request = create_test_profile_request(name, password);
            if let Some(ref mut settings) = request.settings {
                settings.theme = theme;
                settings.language = language.to_string();
                settings.auto_login = auto_login;
            }
            
            let profile = manager.create_profile(request).await
                .expect(&format!("Failed to create profile {}", name));
            created_profiles.push((profile, password));
        }

        // Test isolamento per ogni profilo
        for (i, (profile, password)) in created_profiles.iter().enumerate() {
            // Autentica profilo corrente
            manager.authenticate_profile(&profile.name, password).await
                .expect(&format!("Failed to authenticate {}", profile.name));

            // Aggiungi credenziali specifiche per questo profilo
            let credential = EncryptedCredential {
                store: format!("store_{}", i),
                encrypted_data: format!("data_{}", i),
                nonce: format!("nonce_{}", i),
                salt: format!("salt_{}", i),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            
            manager.add_credential(credential, password).await
                .expect(&format!("Failed to add credential for {}", profile.name));

            // Modifica impostazioni specifiche
            let mut settings = manager.get_settings().expect("No settings").clone();
            settings.security.session_timeout = 60 + (i as u32 * 30); // Timeout diversi
            settings.game_library.refresh_interval = 10 + (i as u32 * 5); // Intervalli diversi
            
            manager.update_settings(settings, password).await
                .expect(&format!("Failed to update settings for {}", profile.name));

            manager.logout().expect("Failed to logout");
        }

        // Verifica isolamento: ogni profilo dovrebbe vedere solo i propri dati
        for (i, (profile, password)) in created_profiles.iter().enumerate() {
            manager.authenticate_profile(&profile.name, password).await
                .expect(&format!("Failed to re-authenticate {}", profile.name));

            // Verifica che veda solo la propria credenziale
            let own_credential = manager.get_credential(&format!("store_{}", i));
            assert!(own_credential.is_some(), "Profile {} should see its own credential", profile.name);
            assert_eq!(own_credential.unwrap().encrypted_data, format!("data_{}", i));

            // Verifica che NON veda le credenziali degli altri
            for j in 0..created_profiles.len() {
                if i != j {
                    let other_credential = manager.get_credential(&format!("store_{}", j));
                    assert!(other_credential.is_none(), 
                        "Profile {} should not see credential from profile {}", 
                        profile.name, created_profiles[j].0.name);
                }
            }

            // Verifica impostazioni specifiche
            let settings = manager.get_settings().expect("No settings");
            assert_eq!(settings.security.session_timeout, 60 + (i as u32 * 30));
            assert_eq!(settings.game_library.refresh_interval, 10 + (i as u32 * 5));

            manager.logout().expect("Failed to logout");
        }
    }

    /// Test del flusso export/import con validazione completa
    #[tokio::test]
    async fn test_export_import_validation() {
        let (mut source_manager, _source_temp_dir) = create_test_manager().await;

        // Crea profilo complesso con molti dati
        let request = CreateProfileRequest {
            name: "ExportTestUser".to_string(),
            password: "ExportPass123!".to_string(),
            avatar_path: Some("/path/to/complex/avatar.jpg".to_string()),
            settings: Some(ProfileSettings {
                theme: Theme::Light,
                language: "es".to_string(),
                auto_login: false,
                notifications: NotificationSettings {
                    desktop_enabled: false,
                    sound_enabled: true,
                    new_games: false,
                    updates: true,
                    deals: false,
                },
                game_library: LibrarySettings {
                    default_view: crate::profiles::models::LibraryView::List,
                    default_sort: crate::profiles::models::LibrarySort::RecentlyAdded,
                    show_hidden: true,
                    auto_refresh: false,
                    refresh_interval: 45,
                },
                security: SecuritySettings {
                    session_timeout: 90,
                    require_password_for_sensitive: false,
                    auto_lock_failed_attempts: 7,
                    lock_duration: 120,
                },
            }),
        };

        let profile = source_manager.create_profile(request).await
            .expect("Failed to create export test profile");
        
        source_manager.authenticate_profile("ExportTestUser", "ExportPass123!").await
            .expect("Failed to authenticate for export");

        // Aggiungi dati complessi
        let complex_credentials = vec![
            ("steam", "very_long_encrypted_steam_data_with_special_chars_!@#$%", "steam_nonce_123", "steam_salt_abc"),
            ("epic", "epic_data_with_unicode_测试", "epic_nonce_456", "epic_salt_def"),
            ("gog", "gog_data_with_json_{\"key\":\"value\"}", "gog_nonce_789", "gog_salt_ghi"),
            ("origin", "origin_data_with_newlines\n\r\t", "origin_nonce_012", "origin_salt_jkl"),
        ];

        for (store, data, nonce, salt) in complex_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: nonce.to_string(),
                salt: salt.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            source_manager.add_credential(credential, "ExportPass123!").await
                .expect(&format!("Failed to add complex credential {}", store));
        }

        // Export del profilo
        let current_profile_id = source_manager.current_profile_id().unwrap().to_string();
        let export_data = source_manager.export_profile(&current_profile_id, "ExportPass123!", None).await
            .expect("Failed to export complex profile");

        // Verifica che i dati export non siano vuoti e sembrino validi
        assert!(!export_data.encrypted_data.is_empty());
        assert!(export_data.encrypted_data.len() > 100); // Dovrebbe essere sostanzioso

        // Test import su manager pulito
        let (mut target_manager, _target_temp_dir) = create_test_manager().await;
        
        let imported_profile = target_manager.import_profile(export_data.clone(), "ExportPass123!", None).await
            .expect("Failed to import complex profile");

        // Verifica metadati profilo
        assert_eq!(imported_profile.name, "ExportTestUser");
        assert_eq!(imported_profile.avatar_path, Some("/path/to/complex/avatar.jpg".to_string()));

        // Autentica profilo importato
        target_manager.authenticate_profile("ExportTestUser", "ExportPass123!").await
            .expect("Failed to authenticate imported complex profile");

        // Verifica impostazioni dettagliate
        let imported_settings = target_manager.get_settings().expect("No imported settings");
        assert_eq!(imported_settings.theme, Theme::Light);
        assert_eq!(imported_settings.language, "es");
        assert_eq!(imported_settings.auto_login, false);
        assert_eq!(imported_settings.notifications.desktop_enabled, false);
        assert_eq!(imported_settings.notifications.sound_enabled, true);
        assert_eq!(imported_settings.game_library.default_view, crate::profiles::models::LibraryView::List);
        assert_eq!(imported_settings.game_library.refresh_interval, 45);
        assert_eq!(imported_settings.security.session_timeout, 90);
        assert_eq!(imported_settings.security.auto_lock_failed_attempts, 7);

        // Verifica tutte le credenziali complesse
        let steam_cred = target_manager.get_credential("steam").expect("Steam credential not imported");
        assert_eq!(steam_cred.encrypted_data, "very_long_encrypted_steam_data_with_special_chars_!@#$%");
        
        let epic_cred = target_manager.get_credential("epic").expect("Epic credential not imported");
        assert_eq!(epic_cred.encrypted_data, "epic_data_with_unicode_测试");
        
        let gog_cred = target_manager.get_credential("gog").expect("GOG credential not imported");
        assert_eq!(gog_cred.encrypted_data, "gog_data_with_json_{\"key\":\"value\"}");
        
        let origin_cred = target_manager.get_credential("origin").expect("Origin credential not imported");
        assert_eq!(origin_cred.encrypted_data, "origin_data_with_newlines\n\r\t");

        // Test import con password errata
        let (mut wrong_manager, _wrong_temp_dir) = create_test_manager().await;
        let wrong_result = wrong_manager.import_profile(export_data.clone(), "WrongPassword", None).await;
        assert!(wrong_result.is_err(), "Import should fail with wrong password");

        // Test import di dati corrotti
        let mut corrupted_data = export_data.clone();
        corrupted_data.encrypted_data[50] = corrupted_data.encrypted_data[50].wrapping_add(1); // Corrompi un byte
        
        let (mut corrupt_manager, _corrupt_temp_dir) = create_test_manager().await;
        let corrupt_result = corrupt_manager.import_profile(corrupted_data, "ExportPass123!", None).await;
        assert!(corrupt_result.is_err(), "Import should fail with corrupted data");
    }
}

