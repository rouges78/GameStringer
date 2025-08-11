#[cfg(test)]
mod tests {
    use crate::profiles::encryption::ProfileEncryption;
    use crate::profiles::manager::ProfileManager;
    use crate::profiles::storage::ProfileStorage;
    use crate::profiles::models::{CreateProfileRequest, ProfileSettings, Theme, NotificationSettings, LibrarySettings, SecuritySettings, LibrarySort, LibraryView};
    use crate::profiles::errors::ProfileError;
    use crate::profiles::rate_limiter::{RateLimiterConfig, RateLimitResult};
    use crate::profiles::secure_memory::SecureMemory;
    use tempfile::TempDir;
    use tokio;
    use std::time::Duration;

    #[test]
    fn test_encryption_roundtrip() {
        let encryption = ProfileEncryption::new();
        let password = "TestKey123!";
        let original_data = b"Test profile data with some sensitive information";

        // Test crittografia
        let encrypted = encryption.encrypt_profile_data(original_data, password).unwrap();
        assert!(!encrypted.is_empty());
        assert_ne!(encrypted, original_data.to_vec());

        // Test decrittografia
        let decrypted = encryption.decrypt_profile_data(&encrypted, password).unwrap();
        assert_eq!(decrypted, original_data.to_vec());
    }

    #[test]
    fn test_wrong_password() {
        let encryption = ProfileEncryption::new();
        let password = "CorrectKey123!";
        let wrong_password = "WrongKey456$";
        let data = b"Secret data";

        let encrypted = encryption.encrypt_profile_data(data, password).unwrap();
        
        // Dovrebbe fallire con password sbagliata
        let result = encryption.decrypt_profile_data(&encrypted, wrong_password);
        assert!(result.is_err());
    }

    #[test]
    fn test_password_validation() {
        let encryption = ProfileEncryption::new();

        // Password troppo corta
        assert!(encryption.validate_password_strength("short").is_err());

        // Password debole
        assert!(encryption.validate_password_strength("password").is_err());

        // Password forte
        assert!(encryption.validate_password_strength("StrongKey123!").is_ok());
    }

    #[test]
    fn test_generate_secure_password() {
        let encryption = ProfileEncryption::new();
        let password = encryption.generate_secure_password(16);
        
        assert_eq!(password.len(), 16);
        assert!(encryption.validate_password_strength(&password).is_ok());
    }

    #[tokio::test]
    async fn test_profile_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let manager = ProfileManager::new(storage);

        // Verifica stato iniziale
        assert!(!manager.is_profile_active());
        assert!(manager.current_profile().is_none());
        assert!(manager.current_profile_id().is_none());
    }

    #[tokio::test]
    async fn test_profile_manager_list_empty() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let manager = ProfileManager::new(storage);

        let profiles = manager.list_profiles().await.unwrap();
        assert!(profiles.is_empty());

        let has_profiles = manager.has_profiles().await.unwrap();
        assert!(!has_profiles);

        let count = manager.count_profiles().await.unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_profile_manager_create_profile() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        let request = CreateProfileRequest {
            name: "Test User".to_string(),
            password: "SecureKey789#".to_string(),
            avatar_path: None,
            settings: Some(ProfileSettings::default()),
        };

        let profile = manager.create_profile(request).await.unwrap();
        
        assert_eq!(profile.name, "Test User");
        assert!(!profile.id.is_empty());
        assert!(profile.credentials.is_empty());

        // Verifica che il profilo sia stato salvato
        let profiles = manager.list_profiles().await.unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "Test User");
    }

    #[tokio::test]
    async fn test_profile_manager_duplicate_name() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        let request1 = CreateProfileRequest {
            name: "Test User".to_string(),
            password: "SecureKey789#".to_string(),
            avatar_path: None,
            settings: None,
        };

        let request2 = CreateProfileRequest {
            name: "test user".to_string(), // Case insensitive
            password: "AnotherKey456$".to_string(),
            avatar_path: None,
            settings: None,
        };

        // Primo profilo dovrebbe essere creato
        manager.create_profile(request1).await.unwrap();

        // Secondo profilo con nome simile dovrebbe fallire
        let result = manager.create_profile(request2).await;
        assert!(result.is_err());
        
        if let Err(ProfileError::ProfileAlreadyExists(name)) = result {
            assert_eq!(name, "test user");
        } else {
            panic!("Expected ProfileAlreadyExists error");
        }
    }

    #[tokio::test]
    async fn test_profile_manager_weak_password() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        let request = CreateProfileRequest {
            name: "Test User".to_string(),
            password: "weak".to_string(), // Password troppo debole
            avatar_path: None,
            settings: None,
        };

        let result = manager.create_profile(request).await;
        assert!(result.is_err());
        
        if let Err(ProfileError::WeakPassword(_)) = result {
            // Corretto
        } else {
            panic!("Expected WeakPassword error");
        }
    }

    #[tokio::test]
    async fn test_profile_manager_session_stats() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Inizialmente nessuna sessione
        assert!(manager.get_session_stats().is_none());
        assert!(manager.get_current_session_duration().is_none());
        assert!(manager.is_session_expired(60)); // Sempre scaduta se non c'è sessione

        // Simula inizio sessione
        manager.init_session_stats();
        
        assert!(manager.get_session_stats().is_some());
        assert!(manager.get_current_session_duration().is_some());
        assert!(!manager.is_session_expired(60)); // Non scaduta appena iniziata

        // Test aggiornamento attività
        manager.update_session_activity();
        let stats = manager.get_session_stats().unwrap();
        assert!(stats.last_activity >= stats.session_start);
    }

    #[tokio::test]
    async fn test_profile_authentication() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea un profilo
        let request = CreateProfileRequest {
            name: "Auth Test".to_string(),
            password: "AuthKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        manager.create_profile(request).await.unwrap();

        // Test autenticazione corretta
        let profile = manager.authenticate_profile("Auth Test", "AuthKey123!").await.unwrap();
        assert_eq!(profile.name, "Auth Test");
        assert!(manager.is_profile_active());
        assert!(manager.current_profile().is_some());

        // Verifica che la sessione sia inizializzata
        assert!(manager.get_session_stats().is_some());
    }

    #[tokio::test]
    async fn test_profile_authentication_wrong_password() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea un profilo
        let request = CreateProfileRequest {
            name: "Auth Test".to_string(),
            password: "AuthKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        manager.create_profile(request).await.unwrap();

        // Test autenticazione con password sbagliata
        let result = manager.authenticate_profile("Auth Test", "WrongKey456$").await;
        assert!(result.is_err());
        
        if let Err(ProfileError::InvalidPassword) = result {
            // Corretto
        } else {
            panic!("Expected InvalidPassword error");
        }

        // Verifica che nessun profilo sia attivo
        assert!(!manager.is_profile_active());
        assert!(manager.current_profile().is_none());
    }

    #[tokio::test]
    async fn test_profile_authentication_nonexistent() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Test autenticazione profilo inesistente
        let result = manager.authenticate_profile("Nonexistent", "SomeKey123!").await;
        assert!(result.is_err());
        
        if let Err(ProfileError::ProfileNotFound(name)) = result {
            assert_eq!(name, "Nonexistent");
        } else {
            panic!("Expected ProfileNotFound error");
        }
    }

    #[tokio::test]
    async fn test_profile_switch() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea due profili
        let request1 = CreateProfileRequest {
            name: "User One".to_string(),
            password: "UserOneKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let request2 = CreateProfileRequest {
            name: "User Two".to_string(),
            password: "UserTwoKey456$".to_string(),
            avatar_path: None,
            settings: None,
        };
        
        manager.create_profile(request1).await.unwrap();
        manager.create_profile(request2).await.unwrap();

        // Autentica primo profilo
        manager.authenticate_profile("User One", "UserOneKey123!").await.unwrap();
        assert_eq!(manager.current_profile().unwrap().name, "User One");

        // Cambia al secondo profilo
        let switched_profile = manager.switch_profile("User Two", "UserTwoKey456$").await.unwrap();
        assert_eq!(switched_profile.name, "User Two");
        assert_eq!(manager.current_profile().unwrap().name, "User Two");
    }

    #[tokio::test]
    async fn test_profile_failed_attempts() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea un profilo
        let request = CreateProfileRequest {
            name: "Fail Test".to_string(),
            password: "FailKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        manager.create_profile(request).await.unwrap();

        // Verifica tentativi iniziali
        let attempts = manager.get_failed_attempts("Fail Test").await.unwrap();
        assert_eq!(attempts, 0);

        // Tenta autenticazione con password sbagliata
        let _ = manager.authenticate_profile("Fail Test", "WrongKey").await;
        let attempts = manager.get_failed_attempts("Fail Test").await.unwrap();
        assert_eq!(attempts, 1);

        // Verifica che il profilo possa ancora essere autenticato
        assert!(manager.can_authenticate("Fail Test").await.unwrap());
    }

    #[tokio::test]
    async fn test_session_timeout() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea e autentica profilo
        let request = CreateProfileRequest {
            name: "Timeout Test".to_string(),
            password: "TimeoutKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        manager.create_profile(request).await.unwrap();
        manager.authenticate_profile("Timeout Test", "TimeoutKey123!").await.unwrap();

        // Verifica che la sessione non sia scaduta immediatamente
        assert!(!manager.is_session_expired(60));

        // Test tempo rimanente
        let remaining = manager.get_session_time_remaining(60);
        assert!(remaining.is_some());
        assert!(remaining.unwrap() > 0);

        // Test rinnovo sessione
        assert!(manager.renew_session().is_ok());
    }

    #[tokio::test]
    async fn test_profile_export_import() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea profilo originale
        let request = CreateProfileRequest {
            name: "Export Test".to_string(),
            password: "ExportKey123!".to_string(),
            avatar_path: None,
            settings: Some(ProfileSettings::default()),
        };
        let original_profile = manager.create_profile(request).await.unwrap();

        // Esporta profilo
        let exported = manager.export_profile(&original_profile.id, "ExportKey123!", None).await.unwrap();
        
        // Verifica metadati export
        assert_eq!(exported.export_metadata.profile_name, "Export Test");
        assert_eq!(exported.export_metadata.credentials_count, 0);
        assert!(!exported.export_metadata.has_avatar);
        assert_eq!(exported.version, 1);

        // Importa profilo con nuovo nome
        let imported_profile = manager.import_profile(exported, "ExportKey123!", Some("Imported Test".to_string())).await.unwrap();
        
        // Verifica che il profilo importato sia corretto
        assert_eq!(imported_profile.name, "Imported Test");
        assert_ne!(imported_profile.id, original_profile.id); // ID diverso
        assert_eq!(imported_profile.settings.theme, original_profile.settings.theme);

        // Verifica che ora ci siano 2 profili
        let profiles = manager.list_profiles().await.unwrap();
        assert_eq!(profiles.len(), 2);
    }

    #[tokio::test]
    async fn test_profile_export_import_file() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea profilo
        let request = CreateProfileRequest {
            name: "File Export Test".to_string(),
            password: "FileKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let profile = manager.create_profile(request).await.unwrap();

        // Esporta in file
        let export_path = temp_dir.path().join("test_export.profile");
        manager.export_profile_to_file(&profile.id, "FileKey123!", export_path.to_str().unwrap(), None).await.unwrap();

        // Verifica che il file esista
        assert!(export_path.exists());

        // Valida file export
        let metadata = manager.validate_export_file(export_path.to_str().unwrap()).await.unwrap();
        assert_eq!(metadata.profile_name, "File Export Test");

        // Importa da file
        let imported = manager.import_profile_from_file(export_path.to_str().unwrap(), "FileKey123!", Some("File Imported".to_string())).await.unwrap();
        assert_eq!(imported.name, "File Imported");
    }

    #[tokio::test]
    async fn test_profile_export_wrong_password() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea profilo
        let request = CreateProfileRequest {
            name: "Wrong Password Test".to_string(),
            password: "CorrectKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let profile = manager.create_profile(request).await.unwrap();

        // Tenta export con password sbagliata
        let result = manager.export_profile(&profile.id, "WrongKey456$", None).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_profile_import_duplicate_name() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea profilo originale
        let request = CreateProfileRequest {
            name: "Duplicate Test".to_string(),
            password: "DuplicateKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let profile = manager.create_profile(request).await.unwrap();

        // Esporta profilo
        let exported = manager.export_profile(&profile.id, "DuplicateKey123!", None).await.unwrap();

        // Tenta import senza cambiare nome (dovrebbe fallire)
        let result = manager.import_profile(exported, "DuplicateKey123!", None).await;
        assert!(result.is_err());
        
        if let Err(ProfileError::ProfileAlreadyExists(name)) = result {
            assert_eq!(name, "Duplicate Test");
        } else {
            panic!("Expected ProfileAlreadyExists error");
        }
    }

    #[tokio::test]
    async fn test_profile_backup() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea profilo
        let request = CreateProfileRequest {
            name: "Backup Test".to_string(),
            password: "BackupKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let profile = manager.create_profile(request).await.unwrap();

        // Crea backup
        let backup_path = manager.create_profile_backup(&profile.id, "BackupKey123!").await.unwrap();
        assert!(!backup_path.is_empty());
        
        println!("Backup creato: {}", backup_path);
    }

    #[tokio::test]
    async fn test_credential_manager() {
        use crate::profiles::credential_manager::{ProfileCredentialManager, PlainCredential, StoreType};
        
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut profile_manager = ProfileManager::new(storage);

        // Crea profilo
        let request = CreateProfileRequest {
            name: "Credential Test".to_string(),
            password: "CredKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };
        let profile = profile_manager.create_profile(request).await.unwrap();
        
        // Autentica profilo
        profile_manager.authenticate_profile("Credential Test", "CredKey123!").await.unwrap();

        // Crea credential manager
        let mut cred_manager = ProfileCredentialManager::new();
        cred_manager.set_profile_manager(profile_manager);

        // Crea credenziale di test
        let credential = PlainCredential::new(
            StoreType::Steam,
            "test_user".to_string(),
            "test_password".to_string(),
        ).with_data("api_key".to_string(), "test_api_key".to_string());

        // Salva credenziale
        cred_manager.save_credential(credential, "CredKey123!").await.unwrap();

        // Verifica che la credenziale esista
        assert!(cred_manager.has_credential(StoreType::Steam).unwrap());

        // Carica credenziale
        let loaded = cred_manager.load_credential(StoreType::Steam, "CredKey123!").await.unwrap();
        assert_eq!(loaded.username, "test_user");
        assert_eq!(loaded.password, "test_password");
        assert_eq!(loaded.additional_data.get("api_key").unwrap(), "test_api_key");

        // Lista credenziali
        let stores = cred_manager.list_stored_credentials().unwrap();
        assert_eq!(stores.len(), 1);
        assert_eq!(stores[0], StoreType::Steam);

        // Rimuovi credenziale
        cred_manager.remove_credential(StoreType::Steam, "CredKey123!").await.unwrap();
        assert!(!cred_manager.has_credential(StoreType::Steam).unwrap());
    }

    #[tokio::test]
    async fn test_profile_manager_authentication() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea un profilo
        let request = CreateProfileRequest {
            name: "Auth Test".to_string(),
            password: "AuthKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };

        let profile = manager.create_profile(request).await.unwrap();
        let profile_id = profile.id.clone();

        // Test autenticazione con password corretta
        let auth_result = manager.authenticate_profile("Auth Test", "AuthKey123!").await;
        assert!(auth_result.is_ok());
        
        let authenticated_profile = auth_result.unwrap();
        assert_eq!(authenticated_profile.name, "Auth Test");
        assert!(manager.is_profile_active());
        assert_eq!(manager.current_profile_id().unwrap(), profile_id);

        // Test logout
        manager.logout().unwrap();
        assert!(!manager.is_profile_active());
        assert!(manager.current_profile().is_none());
    }

    #[tokio::test]
    async fn test_profile_manager_wrong_password() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea un profilo
        let request = CreateProfileRequest {
            name: "Wrong Pass Test".to_string(),
            password: "CorrectKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };

        manager.create_profile(request).await.unwrap();

        // Test autenticazione con password sbagliata
        let auth_result = manager.authenticate_profile("Wrong Pass Test", "WrongKey456$").await;
        assert!(auth_result.is_err());
        
        if let Err(ProfileError::InvalidCredentials) = auth_result {
            // Corretto
        } else {
            panic!("Expected InvalidCredentials error");
        }

        // Verifica che nessun profilo sia attivo
        assert!(!manager.is_profile_active());
    }

    #[tokio::test]
    async fn test_profile_manager_rate_limiting() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

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

        // Crea un profilo
        let request = CreateProfileRequest {
            name: "Rate Limit Test".to_string(),
            password: "RateKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };

        let profile = manager.create_profile(request).await.unwrap();

        // Effettua tentativi falliti fino al blocco
        for i in 1..=3 {
            let result = manager.authenticate_profile("Rate Limit Test", "WrongPassword").await;
            assert!(result.is_err());
            
            if i < 3 {
                // I primi tentativi dovrebbero essere InvalidCredentials
                if let Err(ProfileError::InvalidCredentials) = result {
                    // Corretto
                } else {
                    panic!("Expected InvalidCredentials error on attempt {}", i);
                }
            } else {
                // Il terzo tentativo dovrebbe essere bloccato
                if let Err(ProfileError::TooManyAttempts(_)) = result {
                    // Corretto
                } else {
                    panic!("Expected TooManyAttempts error on attempt {}", i);
                }
            }
        }

        // Verifica che il profilo sia bloccato
        let blocked_result = manager.authenticate_profile("Rate Limit Test", "RateKey123!").await;
        assert!(blocked_result.is_err());
        
        if let Err(ProfileError::TooManyAttempts(_)) = blocked_result {
            // Corretto
        } else {
            panic!("Expected TooManyAttempts error for blocked profile");
        }

        // Reset manuale dei tentativi
        manager.reset_login_attempts(&profile.id);

        // Ora dovrebbe funzionare con la password corretta
        let success_result = manager.authenticate_profile("Rate Limit Test", "RateKey123!").await;
        assert!(success_result.is_ok());
    }

    #[tokio::test]
    async fn test_profile_manager_secure_memory() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Test SecureMemory per password
        let mut secure_password = SecureMemory::new("TestPassword123!".to_string());
        
        // Verifica che i dati siano accessibili
        assert_eq!(*secure_password, "TestPassword123!");
        
        // Test pulizia
        secure_password.clear();
        assert_eq!(*secure_password, "");

        // Test con drop automatico
        {
            let _secure_data = SecureMemory::new("SensitiveData".to_string());
            // Dovrebbe essere pulito automaticamente quando esce dallo scope
        }
    }

    #[tokio::test]
    async fn test_profile_manager_crud_operations() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // CREATE - Crea profilo
        let request = CreateProfileRequest {
            name: "CRUD Test".to_string(),
            password: "CrudKey123!".to_string(),
            avatar_path: Some("/path/to/avatar.png".to_string()),
            settings: Some(ProfileSettings {
                theme: Theme::Dark,
                language: "it".to_string(),
                auto_login: true,
                notifications: NotificationSettings {
                    desktop_enabled: true,
                    sound_enabled: false,
                    new_games: true,
                    updates: true,
                    deals: false,
                },
                game_library: LibrarySettings {
                    auto_refresh: true,
                    show_hidden: false,
                    default_sort: LibrarySort::Alphabetical,
                    default_view: LibraryView::Grid,
                    refresh_interval: 30,
                },
                security: SecuritySettings {
                    session_timeout: 3600,
                    require_password_for_sensitive: true,
                    auto_lock_failed_attempts: 3,
                    lock_duration: 300,
                },
            }),
        };

        let created_profile = manager.create_profile(request).await.unwrap();
        assert_eq!(created_profile.name, "CRUD Test");
        assert_eq!(created_profile.avatar_path, Some("/path/to/avatar.png".to_string()));
        assert_eq!(created_profile.settings.theme, Theme::Dark);

        // READ - Lista profili
        let profiles = manager.list_profiles().await.unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "CRUD Test");

        // READ - Ottieni profilo specifico
        let profile_info = manager.get_profile_info(&created_profile.id).await.unwrap();
        assert!(profile_info.is_some());
        assert_eq!(profile_info.unwrap().name, "CRUD Test");

        // UPDATE - Autentica e aggiorna impostazioni
        manager.authenticate_profile("CRUD Test", "CrudKey123!").await.unwrap();
        
        let mut new_settings = created_profile.settings.clone();
        new_settings.theme = Theme::Light;
        new_settings.language = "en".to_string();
        
        manager.update_settings(new_settings.clone(), "CrudKey123!").await.unwrap();
        
        let current_settings = manager.get_settings().unwrap();
        assert_eq!(current_settings.theme, Theme::Light);
        assert_eq!(current_settings.language, "en");

        // DELETE - Logout e elimina profilo
        manager.logout().unwrap();
        manager.delete_profile(&created_profile.id, "CrudKey123!").await.unwrap();

        // Verifica eliminazione
        let profiles_after_delete = manager.list_profiles().await.unwrap();
        assert!(profiles_after_delete.is_empty());
    }

    #[tokio::test]
    async fn test_profile_manager_error_handling() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Test profilo non esistente
        let auth_result = manager.authenticate_profile("NonExistent", "password").await;
        assert!(auth_result.is_err());
        if let Err(ProfileError::ProfileNotFound(name)) = auth_result {
            assert_eq!(name, "NonExistent");
        } else {
            panic!("Expected ProfileNotFound error");
        }

        // Test operazioni senza autenticazione
        let settings_result = manager.get_settings();
        assert!(settings_result.is_none());

        let update_result = manager.update_current_profile("password").await;
        assert!(update_result.is_err());
        if let Err(ProfileError::Unauthorized) = update_result {
            // Corretto
        } else {
            panic!("Expected Unauthorized error");
        }

        // Test nome profilo invalido
        let invalid_request = CreateProfileRequest {
            name: "".to_string(), // Nome vuoto
            password: "ValidKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };

        let create_result = manager.create_profile(invalid_request).await;
        assert!(create_result.is_err());
    }

    #[tokio::test]
    async fn test_profile_manager_edge_cases() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Test con caratteri speciali nel nome
        let special_request = CreateProfileRequest {
            name: "Test User 🎮 (Gaming)".to_string(),
            password: "SpecialKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };

        let special_profile = manager.create_profile(special_request).await.unwrap();
        assert_eq!(special_profile.name, "Test User 🎮 (Gaming)");

        // Test autenticazione case-insensitive
        let auth_result = manager.authenticate_profile("test user 🎮 (gaming)", "SpecialKey123!").await;
        assert!(auth_result.is_ok());

        // Test profilo più recente
        let most_recent = manager.get_most_recent_profile().await.unwrap();
        assert!(most_recent.is_some());
        assert_eq!(most_recent.unwrap().name, "Test User 🎮 (Gaming)");

        // Test statistiche autenticazione
        let auth_stats = manager.get_auth_stats().await.unwrap();
        assert_eq!(auth_stats.total_profiles, 1);
        assert_eq!(auth_stats.locked_profiles, 0);
        assert!(auth_stats.current_session_active);
    }

    #[tokio::test]
    async fn test_profile_manager_session_timeout() {
        let temp_dir = TempDir::new().unwrap();
        let storage = ProfileStorage::new(temp_dir.path().to_path_buf()).unwrap();
        let mut manager = ProfileManager::new(storage);

        // Crea e autentica profilo
        let request = CreateProfileRequest {
            name: "Timeout Test".to_string(),
            password: "TimeoutKey123!".to_string(),
            avatar_path: None,
            settings: None,
        };

        manager.create_profile(request).await.unwrap();
        manager.authenticate_profile("Timeout Test", "TimeoutKey123!").await.unwrap();

        // Test timeout con valore molto basso (1 secondo)
        tokio::time::sleep(Duration::from_millis(1100)).await;
        
        let is_expired = manager.is_session_expired(1);
        assert!(is_expired);

        // Test logout automatico con timeout
        let logout_result = manager.logout_with_timeout(1).unwrap();
        assert!(logout_result); // Dovrebbe aver fatto logout
        assert!(!manager.is_profile_active());

        // Test rinnovo sessione
        manager.authenticate_profile("Timeout Test", "TimeoutKey123!").await.unwrap();
        manager.renew_session().unwrap();
        
        let time_remaining = manager.get_session_time_remaining(60);
        assert!(time_remaining.is_some());
        assert!(time_remaining.unwrap() > 50); // Dovrebbe essere vicino a 60
    }

    #[test]
    fn test_encryption_edge_cases() {
        let encryption = ProfileEncryption::new();

        // Test con dati vuoti
        let empty_data = b"";
        let password = "TestKey123!";
        
        let encrypted = encryption.encrypt_profile_data(empty_data, password).unwrap();
        let decrypted = encryption.decrypt_profile_data(&encrypted, password).unwrap();
        assert_eq!(decrypted, empty_data.to_vec());

        // Test con dati molto grandi
        let large_data = vec![0u8; 1024 * 1024]; // 1MB
        let encrypted_large = encryption.encrypt_profile_data(&large_data, password).unwrap();
        let decrypted_large = encryption.decrypt_profile_data(&encrypted_large, password).unwrap();
        assert_eq!(decrypted_large, large_data);

        // Test con password molto lunga
        let long_password = "A".repeat(100);
        let encrypted_long_pass = encryption.encrypt_profile_data(b"test", &long_password).unwrap();
        let decrypted_long_pass = encryption.decrypt_profile_data(&encrypted_long_pass, &long_password).unwrap();
        assert_eq!(decrypted_long_pass, b"test".to_vec());

        // Test generazione password con lunghezze diverse
        for length in [12, 16, 32, 64] {
            let password = encryption.generate_secure_password(length);
            assert_eq!(password.len(), length);
            assert!(encryption.validate_password_strength(&password).is_ok());
        }
    }

    #[test]
    fn test_rate_limiter_edge_cases() {
        use crate::profiles::rate_limiter::{RateLimiter, RateLimiterConfig};

        // Test con configurazione estrema
        let config = RateLimiterConfig {
            max_attempts: 1,
            block_duration_seconds: 1,
            reset_after_seconds: 2,
            exponential_backoff: true,
            backoff_factor: 10.0,
            max_block_duration_seconds: 5,
        };

        let limiter = RateLimiter::new(config);
        let user_id = "test_user";

        // Primo tentativo fallito dovrebbe bloccare immediatamente
        let result = limiter.register_failed_attempt(user_id);
        if let RateLimitResult::Blocked { remaining_seconds, .. } = result {
            assert_eq!(remaining_seconds, 1);
        } else {
            panic!("Expected immediate block");
        }

        // Test reset
        limiter.reset_attempts(user_id);
        let check_result = limiter.check_rate_limit(user_id);
        assert!(matches!(check_result, RateLimitResult::Allowed));

        // Test tentativo riuscito
        limiter.register_successful_attempt(user_id);
        let info = limiter.get_attempt_info(user_id);
        assert!(info.is_none()); // Dovrebbe essere rimosso
    }
}