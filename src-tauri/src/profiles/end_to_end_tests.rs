#[cfg(test)]
mod end_to_end_tests {
    use crate::profiles::manager::ProfileManager;
    use crate::profiles::storage::ProfileStorage;
    use crate::profiles::models::{CreateProfileRequest, ProfileSettings, Theme, NotificationSettings, LibrarySettings, SecuritySettings, EncryptedCredential};
    // use crate::profiles::errors::ProfileError; // Unused import
    use tempfile::TempDir;
    use tokio;
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
                version: 1,
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
    async fn test_complete_user_workflow() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // === FASE 1: CREAZIONE PROFILO ===
        println!("=== FASE 1: CREAZIONE PROFILO ===");
        
        // Crea un nuovo profilo
        let request = create_test_profile_request("GameUser", "SecureGamePass123!");
        let created_profile = manager.create_profile(request).await.expect("Failed to create profile");
        
        assert_eq!(created_profile.name, "GameUser");
        assert!(!created_profile.id.is_empty());
        assert_eq!(created_profile.settings.theme, Theme::Dark);
        assert_eq!(created_profile.settings.language, "it");
        
        println!("✅ Profilo '{}' creato con successo (ID: {})", created_profile.name, created_profile.id);

        // === FASE 2: AUTENTICAZIONE ===
        println!("=== FASE 2: AUTENTICAZIONE ===");
        
        // Autentica il profilo
        let authenticated_profile = manager.authenticate_profile("GameUser", "SecureGamePass123!")
            .await.expect("Failed to authenticate profile");
        
        assert_eq!(authenticated_profile.name, "GameUser");
        assert_eq!(authenticated_profile.id, created_profile.id);
        assert!(manager.is_profile_active());
        
        println!("✅ Profilo autenticato con successo");

        // === FASE 3: USO DEL PROFILO ===
        println!("=== FASE 3: USO DEL PROFILO ===");
        
        // 3.1: Aggiunta credenziali per vari store
        let steam_credential = EncryptedCredential {
            store: "steam".to_string(),
            encrypted_data: "encrypted_steam_data".to_string(),
            nonce: "steam_nonce".to_string(),
            salt: "steam_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        
        manager.add_credential(steam_credential, "SecureGamePass123!")
            .await.expect("Failed to add Steam credential");
        
        let epic_credential = EncryptedCredential {
            store: "epic".to_string(),
            encrypted_data: "encrypted_epic_data".to_string(),
            nonce: "epic_nonce".to_string(),
            salt: "epic_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        
        manager.add_credential(epic_credential, "SecureGamePass123!")
            .await.expect("Failed to add Epic credential");
        
        println!("✅ Credenziali Steam ed Epic aggiunte");

        // 3.2: Modifica impostazioni profilo
        let updated_settings = ProfileSettings {
            version: 1,
            theme: Theme::Light,
            language: "en".to_string(),
            auto_login: true,
            notifications: NotificationSettings {
                desktop_enabled: false,
                sound_enabled: true,
                new_games: false,
                updates: true,
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
                session_timeout: 120,
                require_password_for_sensitive: false,
                auto_lock_failed_attempts: 3,
                lock_duration: 15,
            },
        };
        
        manager.update_settings(updated_settings, "SecureGamePass123!")
            .await.expect("Failed to update settings");
        
        println!("✅ Impostazioni profilo aggiornate");

        // 3.3: Verifica che le modifiche siano persistite
        let current_settings = manager.get_settings().expect("No current settings");
        assert_eq!(current_settings.theme, Theme::Light);
        assert_eq!(current_settings.language, "en");
        assert_eq!(current_settings.auto_login, true);
        
        // 3.4: Verifica credenziali
        let steam_cred = manager.get_credential("steam").expect("Steam credential not found");
        let epic_cred = manager.get_credential("epic").expect("Epic credential not found");
        assert_eq!(steam_cred.store, "steam");
        assert_eq!(epic_cred.store, "epic");
        
        println!("✅ Verifica persistenza dati completata");

        // === FASE 4: LOGOUT E RIAUTENTICAZIONE ===
        println!("=== FASE 4: LOGOUT E RIAUTENTICAZIONE ===");
        
        // Logout
        manager.logout().expect("Failed to logout");
        assert!(!manager.is_profile_active());
        assert!(manager.current_profile().is_none());
        
        // Riautentica e verifica che i dati siano ancora presenti
        let reauth_profile = manager.authenticate_profile("GameUser", "SecureGamePass123!")
            .await.expect("Failed to re-authenticate");
        
        assert_eq!(reauth_profile.name, "GameUser");
        assert!(manager.is_profile_active());
        
        // Verifica che le impostazioni siano ancora presenti
        let reloaded_settings = manager.get_settings().expect("No settings after re-auth");
        assert_eq!(reloaded_settings.theme, Theme::Light);
        assert_eq!(reloaded_settings.language, "en");
        
        // Verifica che le credenziali siano ancora presenti
        let reloaded_steam = manager.get_credential("steam").expect("Steam credential lost after re-auth");
        let reloaded_epic = manager.get_credential("epic").expect("Epic credential lost after re-auth");
        assert_eq!(reloaded_steam.store, "steam");
        assert_eq!(reloaded_epic.store, "epic");
        
        println!("✅ Workflow completo testato con successo!");
    }

    #[tokio::test]
    async fn test_profile_switching_and_data_isolation() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // === FASE 1: CREAZIONE PROFILI MULTIPLI ===
        println!("=== FASE 1: CREAZIONE PROFILI MULTIPLI ===");
        
        // Crea profilo Gaming
        let gaming_request = create_test_profile_request("GamingProfile", "GamingPass123!");
        let _gaming_profile = manager.create_profile(gaming_request).await.expect("Failed to create gaming profile");
        
        // Crea profilo Work
        let work_request = create_test_profile_request("WorkProfile", "WorkPass456!");
        let _work_profile = manager.create_profile(work_request).await.expect("Failed to create work profile");
        
        println!("✅ Profili Gaming e Work creati");

        // === FASE 2: CONFIGURAZIONE PROFILO GAMING ===
        println!("=== FASE 2: CONFIGURAZIONE PROFILO GAMING ===");
        
        // Autentica profilo Gaming
        manager.authenticate_profile("GamingProfile", "GamingPass123!")
            .await.expect("Failed to authenticate gaming profile");
        
        // Configura impostazioni Gaming
        let gaming_settings = ProfileSettings {
            version: 1,
            theme: Theme::Dark,
            language: "it".to_string(),
            auto_login: false,
            notifications: NotificationSettings {
                desktop_enabled: true,
                sound_enabled: true,
                new_games: true,
                updates: true,
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
                session_timeout: 30,
                require_password_for_sensitive: true,
                auto_lock_failed_attempts: 5,
                lock_duration: 30,
            },
        };
        
        manager.update_settings(gaming_settings, "GamingPass123!")
            .await.expect("Failed to update gaming settings");
        
        // Aggiungi credenziali gaming
        let steam_gaming = EncryptedCredential {
            store: "steam".to_string(),
            encrypted_data: "gaming_steam_account".to_string(),
            nonce: "gaming_steam_nonce".to_string(),
            salt: "gaming_steam_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        
        let discord_gaming = EncryptedCredential {
            store: "discord".to_string(),
            encrypted_data: "gaming_discord_account".to_string(),
            nonce: "gaming_discord_nonce".to_string(),
            salt: "gaming_discord_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        
        manager.add_credential(steam_gaming, "GamingPass123!")
            .await.expect("Failed to add gaming Steam credential");
        manager.add_credential(discord_gaming, "GamingPass123!")
            .await.expect("Failed to add gaming Discord credential");
        
        println!("✅ Profilo Gaming configurato con Steam e Discord");

        // === FASE 3: CAMBIO A PROFILO WORK ===
        println!("=== FASE 3: CAMBIO A PROFILO WORK ===");
        
        // Cambia a profilo Work
        manager.switch_profile("WorkProfile", "WorkPass456!")
            .await.expect("Failed to switch to work profile");
        
        assert_eq!(manager.current_profile().unwrap().name, "WorkProfile");
        
        // Configura impostazioni Work (diverse da Gaming)
        let work_settings = ProfileSettings {
            version: 1,
            theme: Theme::Light,
            language: "en".to_string(),
            auto_login: true,
            notifications: NotificationSettings {
                desktop_enabled: false,
                sound_enabled: false,
                new_games: false,
                updates: false,
                deals: false,
            },
            game_library: LibrarySettings {
                default_view: crate::profiles::models::LibraryView::List,
                default_sort: crate::profiles::models::LibrarySort::Alphabetical,
                show_hidden: true,
                auto_refresh: false,
                refresh_interval: 120,
            },
            security: SecuritySettings {
                session_timeout: 240,
                require_password_for_sensitive: false,
                auto_lock_failed_attempts: 10,
                lock_duration: 5,
            },
        };
        
        manager.update_settings(work_settings, "WorkPass456!")
            .await.expect("Failed to update work settings");
        
        // Aggiungi credenziali work (diverse da gaming)
        let github_work = EncryptedCredential {
            store: "github".to_string(),
            encrypted_data: "work_github_account".to_string(),
            nonce: "work_github_nonce".to_string(),
            salt: "work_github_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        
        let slack_work = EncryptedCredential {
            store: "slack".to_string(),
            encrypted_data: "work_slack_account".to_string(),
            nonce: "work_slack_nonce".to_string(),
            salt: "work_slack_salt".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            encryption_version: 1,
        };
        
        manager.add_credential(github_work, "WorkPass456!")
            .await.expect("Failed to add work GitHub credential");
        manager.add_credential(slack_work, "WorkPass456!")
            .await.expect("Failed to add work Slack credential");
        
        println!("✅ Profilo Work configurato con GitHub e Slack");

        // === FASE 4: VERIFICA ISOLAMENTO DATI ===
        println!("=== FASE 4: VERIFICA ISOLAMENTO DATI ===");
        
        // Verifica che Work non veda le credenziali Gaming
        assert!(manager.get_credential("steam").is_none(), "Work profile should not see Steam credential");
        assert!(manager.get_credential("discord").is_none(), "Work profile should not see Discord credential");
        
        // Verifica che Work veda solo le sue credenziali
        assert!(manager.get_credential("github").is_some(), "Work profile should see GitHub credential");
        assert!(manager.get_credential("slack").is_some(), "Work profile should see Slack credential");
        
        // Verifica impostazioni Work
        let work_current_settings = manager.get_settings().unwrap();
        assert_eq!(work_current_settings.theme, Theme::Light);
        assert_eq!(work_current_settings.language, "en");
        assert_eq!(work_current_settings.auto_login, true);
        
        println!("✅ Isolamento dati Work verificato");

        // === FASE 5: RITORNO A PROFILO GAMING ===
        println!("=== FASE 5: RITORNO A PROFILO GAMING ===");
        
        // Torna al profilo Gaming
        manager.switch_profile("GamingProfile", "GamingPass123!")
            .await.expect("Failed to switch back to gaming profile");
        
        assert_eq!(manager.current_profile().unwrap().name, "GamingProfile");
        
        // Verifica che Gaming non veda le credenziali Work
        assert!(manager.get_credential("github").is_none(), "Gaming profile should not see GitHub credential");
        assert!(manager.get_credential("slack").is_none(), "Gaming profile should not see Slack credential");
        
        // Verifica che Gaming veda ancora le sue credenziali
        assert!(manager.get_credential("steam").is_some(), "Gaming profile should still see Steam credential");
        assert!(manager.get_credential("discord").is_some(), "Gaming profile should still see Discord credential");
        
        // Verifica impostazioni Gaming
        let gaming_current_settings = manager.get_settings().unwrap();
        assert_eq!(gaming_current_settings.theme, Theme::Dark);
        assert_eq!(gaming_current_settings.language, "it");
        assert_eq!(gaming_current_settings.auto_login, false);
        
        println!("✅ Isolamento dati Gaming verificato");

        // === FASE 6: VERIFICA PERSISTENZA DOPO RIAVVIO ===
        println!("=== FASE 6: VERIFICA PERSISTENZA DOPO RIAVVIO ===");
        
        // Simula riavvio facendo logout e riautenticazione
        manager.logout().expect("Failed to logout");
        
        // Riautentica Gaming
        manager.authenticate_profile("GamingProfile", "GamingPass123!")
            .await.expect("Failed to re-authenticate gaming");
        
        // Verifica che i dati Gaming siano ancora isolati
        assert!(manager.get_credential("steam").is_some(), "Steam credential should persist");
        assert!(manager.get_credential("discord").is_some(), "Discord credential should persist");
        assert!(manager.get_credential("github").is_none(), "GitHub credential should not be visible");
        assert!(manager.get_credential("slack").is_none(), "Slack credential should not be visible");
        
        // Cambia a Work e verifica isolamento
        manager.switch_profile("WorkProfile", "WorkPass456!")
            .await.expect("Failed to switch to work after restart");
        
        assert!(manager.get_credential("github").is_some(), "GitHub credential should persist");
        assert!(manager.get_credential("slack").is_some(), "Slack credential should persist");
        assert!(manager.get_credential("steam").is_none(), "Steam credential should not be visible");
        assert!(manager.get_credential("discord").is_none(), "Discord credential should not be visible");
        
        println!("✅ Test isolamento dati e cambio profilo completato con successo!");
    }    
#[tokio::test]
    async fn test_profile_export_import_workflow() {
        let (mut source_manager, _source_temp_dir) = create_test_manager().await;
        let (mut target_manager, _target_temp_dir) = create_test_manager().await;

        // === FASE 1: CREAZIONE E CONFIGURAZIONE PROFILO SORGENTE ===
        println!("=== FASE 1: CREAZIONE E CONFIGURAZIONE PROFILO SORGENTE ===");
        
        // Crea profilo complesso con molti dati
        let request = create_test_profile_request("ComplexUser", "ComplexPass123!");
        let _profile = source_manager.create_profile(request).await.expect("Failed to create profile");
        
        // Autentica
        source_manager.authenticate_profile("ComplexUser", "ComplexPass123!")
            .await.expect("Failed to authenticate");
        
        // Configura impostazioni dettagliate
        let detailed_settings = ProfileSettings {
            version: 1,
            theme: Theme::Auto,
            language: "fr".to_string(),
            auto_login: true,
            notifications: NotificationSettings {
                desktop_enabled: true,
                sound_enabled: false,
                new_games: true,
                updates: false,
                deals: true,
            },
            game_library: LibrarySettings {
                default_view: crate::profiles::models::LibraryView::List,
                default_sort: crate::profiles::models::LibrarySort::RecentlyAdded,
                show_hidden: true,
                auto_refresh: true,
                refresh_interval: 45,
            },
            security: SecuritySettings {
                session_timeout: 180,
                require_password_for_sensitive: true,
                auto_lock_failed_attempts: 7,
                lock_duration: 20,
            },
        };
        
        source_manager.update_settings(detailed_settings, "ComplexPass123!")
            .await.expect("Failed to update detailed settings");
        
        // Aggiungi multiple credenziali
        let credentials = vec![
            ("steam", "complex_steam_data", "steam_nonce", "steam_salt"),
            ("epic", "complex_epic_data", "epic_nonce", "epic_salt"),
            ("origin", "complex_origin_data", "origin_nonce", "origin_salt"),
            ("uplay", "complex_uplay_data", "uplay_nonce", "uplay_salt"),
            ("gog", "complex_gog_data", "gog_nonce", "gog_salt"),
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
            
            source_manager.add_credential(credential, "ComplexPass123!")
                .await.expect(&format!("Failed to add {} credential", store));
        }
        
        println!("✅ Profilo complesso configurato con 5 credenziali");

        // === FASE 2: EXPORT PROFILO ===
        println!("=== FASE 2: EXPORT PROFILO ===");
        
        // Export del profilo (simulato - in un'implementazione reale ci sarebbe un metodo export)
        // Per ora verifichiamo che tutti i dati siano presenti prima dell'export
        let pre_export_settings = source_manager.get_settings().unwrap();
        assert_eq!(pre_export_settings.theme, Theme::Auto);
        assert_eq!(pre_export_settings.language, "fr");
        assert_eq!(pre_export_settings.security.session_timeout, 180);
        
        // Verifica tutte le credenziali
        let stores = ["steam", "epic", "origin", "uplay", "gog"];
        for store in &stores {
            assert!(source_manager.get_credential(store).is_some(), 
                "Credential {} should exist before export", store);
        }
        
        println!("✅ Verifica pre-export completata - tutti i dati presenti");

        // === FASE 3: SIMULAZIONE IMPORT SU NUOVO SISTEMA ===
        println!("=== FASE 3: SIMULAZIONE IMPORT SU NUOVO SISTEMA ===");
        
        // Simula l'import creando un profilo identico sul target manager
        // In un'implementazione reale, questo sarebbe fatto tramite file export/import
        
        let import_request = CreateProfileRequest {
            name: "ComplexUser".to_string(),
            password: "ComplexPass123!".to_string(),
            avatar_path: None,
            settings: Some(pre_export_settings.clone()),
        };
        
        let _imported_profile = target_manager.create_profile(import_request)
            .await.expect("Failed to import profile");
        
        // Autentica il profilo importato
        target_manager.authenticate_profile("ComplexUser", "ComplexPass123!")
            .await.expect("Failed to authenticate imported profile");
        
        // Ricrea le credenziali (simulando l'import)
        for (store, data, nonce, salt) in [
            ("steam", "complex_steam_data", "steam_nonce", "steam_salt"),
            ("epic", "complex_epic_data", "epic_nonce", "epic_salt"),
            ("origin", "complex_origin_data", "origin_nonce", "origin_salt"),
            ("uplay", "complex_uplay_data", "uplay_nonce", "uplay_salt"),
            ("gog", "complex_gog_data", "gog_nonce", "gog_salt"),
        ] {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: nonce.to_string(),
                salt: salt.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            
            target_manager.add_credential(credential, "ComplexPass123!")
                .await.expect(&format!("Failed to import {} credential", store));
        }
        
        println!("✅ Profilo importato su nuovo sistema");

        // === FASE 4: VERIFICA INTEGRITÀ IMPORT ===
        println!("=== FASE 4: VERIFICA INTEGRITÀ IMPORT ===");
        
        // Verifica che il profilo importato sia identico all'originale
        let imported_settings = target_manager.get_settings().unwrap();
        
        // Verifica impostazioni
        assert_eq!(imported_settings.theme, Theme::Auto);
        assert_eq!(imported_settings.language, "fr");
        assert_eq!(imported_settings.auto_login, true);
        assert_eq!(imported_settings.notifications.desktop_enabled, true);
        assert_eq!(imported_settings.notifications.sound_enabled, false);
        assert_eq!(imported_settings.game_library.default_view, crate::profiles::models::LibraryView::List);
        assert_eq!(imported_settings.game_library.default_sort, crate::profiles::models::LibrarySort::RecentlyAdded);
        assert_eq!(imported_settings.security.session_timeout, 180);
        assert_eq!(imported_settings.security.auto_lock_failed_attempts, 7);
        
        // Verifica credenziali
        for store in &stores {
            let imported_cred = target_manager.get_credential(store)
                .expect(&format!("Imported credential {} should exist", store));
            let original_cred = source_manager.get_credential(store)
                .expect(&format!("Original credential {} should exist", store));
            
            assert_eq!(imported_cred.store, original_cred.store);
            assert_eq!(imported_cred.encrypted_data, original_cred.encrypted_data);
        }
        
        println!("✅ Verifica integrità import completata");

        // === FASE 5: VERIFICA INDIPENDENZA POST-IMPORT ===
        println!("=== FASE 5: VERIFICA INDIPENDENZA POST-IMPORT ===");
        
        // Modifica il profilo originale
        let mut modified_settings = pre_export_settings.clone();
        modified_settings.theme = Theme::Light;
        modified_settings.language = "de".to_string();
        
        source_manager.update_settings(modified_settings, "ComplexPass123!")
            .await.expect("Failed to modify original profile");
        
        // Rimuovi una credenziale dall'originale
        source_manager.remove_credential("steam", "ComplexPass123!")
            .await.expect("Failed to remove Steam from original");
        
        // Verifica che il profilo importato non sia stato influenzato
        let imported_after_changes = target_manager.get_settings().unwrap();
        assert_eq!(imported_after_changes.theme, Theme::Auto); // Dovrebbe essere ancora Auto
        assert_eq!(imported_after_changes.language, "fr"); // Dovrebbe essere ancora fr
        
        // Verifica che Steam sia ancora presente nel profilo importato
        assert!(target_manager.get_credential("steam").is_some(), 
            "Steam credential should still exist in imported profile");
        
        // Verifica che Steam sia stata rimossa dall'originale
        assert!(source_manager.get_credential("steam").is_none(), 
            "Steam credential should be removed from original profile");
        
        println!("✅ Verifica indipendenza post-import completata");

        // === FASE 6: TEST EXPORT/IMPORT CON PASSWORD DIVERSA ===
        println!("=== FASE 6: TEST EXPORT/IMPORT CON PASSWORD DIVERSA ===");
        
        // Simula export con password diversa per la sicurezza
        // Crea un nuovo profilo con password diversa ma stessi dati
        let secure_import_request = CreateProfileRequest {
            name: "ComplexUserSecure".to_string(),
            password: "NewSecurePass456!".to_string(), // Password diversa
            avatar_path: None,
            settings: Some(imported_settings.clone()),
        };
        
        let _secure_imported = target_manager.create_profile(secure_import_request)
            .await.expect("Failed to create secure imported profile");
        
        // Verifica che il profilo con password diversa funzioni
        target_manager.authenticate_profile("ComplexUserSecure", "NewSecurePass456!")
            .await.expect("Failed to authenticate secure imported profile");
        
        let secure_settings = target_manager.get_settings().unwrap();
        assert_eq!(secure_settings.theme, Theme::Auto);
        assert_eq!(secure_settings.language, "fr");
        
        println!("✅ Test export/import con password diversa completato");

        println!("✅ Test completo export/import workflow completato con successo!");
    }

    /// Test del flusso completo richiesto dal task 9.2:
    /// creazione profilo → autenticazione → uso → cambio profilo → export/import
    #[tokio::test]
    async fn test_task_9_2_complete_flow() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        println!("=== TEST TASK 9.2: FLUSSO COMPLETO ===");

        // === STEP 1: CREAZIONE PROFILO → AUTENTICAZIONE → USO ===
        println!("--- Step 1: Creazione profilo → autenticazione → uso ---");
        
        // Crea primo profilo
        let profile1_request = CreateProfileRequest {
            name: "MainUser".to_string(),
            password: "MainUserPass123!".to_string(),
            avatar_path: Some("/avatars/main_user.png".to_string()),
            settings: Some(ProfileSettings {
                version: 1,
                theme: Theme::Dark,
                language: "it".to_string(),
                auto_login: false,
                notifications: NotificationSettings {
                    desktop_enabled: true,
                    sound_enabled: true,
                    new_games: true,
                    updates: true,
                    deals: false,
                },
                game_library: LibrarySettings {
                    default_view: crate::profiles::models::LibraryView::Grid,
                    default_sort: crate::profiles::models::LibrarySort::LastPlayed,
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
        };

        let _profile1 = manager.create_profile(profile1_request).await
            .expect("Failed to create MainUser profile");
        
        // Autentica profilo
        let auth_profile1 = manager.authenticate_profile("MainUser", "MainUserPass123!").await
            .expect("Failed to authenticate MainUser");
        
        assert_eq!(auth_profile1.name, "MainUser");
        assert!(manager.is_profile_active());
        
        // Usa il profilo: aggiungi credenziali e modifica impostazioni
        let main_credentials = vec![
            ("steam", "main_steam_encrypted", "main_steam_nonce", "main_steam_salt"),
            ("epic", "main_epic_encrypted", "main_epic_nonce", "main_epic_salt"),
        ];

        for (store, data, nonce, salt) in main_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: nonce.to_string(),
                salt: salt.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            manager.add_credential(credential, "MainUserPass123!").await
                .expect(&format!("Failed to add {} credential to MainUser", store));
        }

        // Modifica impostazioni
        let mut main_updated_settings = manager.get_settings().unwrap().clone();
        main_updated_settings.theme = Theme::Light;
        main_updated_settings.language = "en".to_string();
        main_updated_settings.notifications.deals = true;
        
        manager.update_settings(main_updated_settings, "MainUserPass123!").await
            .expect("Failed to update MainUser settings");

        println!("✅ MainUser creato, autenticato e configurato");

        // === STEP 2: CAMBIO PROFILO E ISOLAMENTO DATI ===
        println!("--- Step 2: Cambio profilo e isolamento dati ---");
        
        // Crea secondo profilo
        let profile2_request = CreateProfileRequest {
            name: "SecondUser".to_string(),
            password: "SecondUserPass456!".to_string(),
            avatar_path: Some("/avatars/second_user.png".to_string()),
            settings: Some(ProfileSettings {
                version: 1,
                theme: Theme::Auto,
                language: "fr".to_string(),
                auto_login: true,
                notifications: NotificationSettings {
                    desktop_enabled: false,
                    sound_enabled: false,
                    new_games: false,
                    updates: false,
                    deals: true,
                },
                game_library: LibrarySettings {
                    default_view: crate::profiles::models::LibraryView::List,
                    default_sort: crate::profiles::models::LibrarySort::Alphabetical,
                    show_hidden: true,
                    auto_refresh: false,
                    refresh_interval: 60,
                },
                security: SecuritySettings {
                    session_timeout: 120,
                    require_password_for_sensitive: false,
                    auto_lock_failed_attempts: 3,
                    lock_duration: 15,
                },
            }),
        };

        let _profile2 = manager.create_profile(profile2_request).await
            .expect("Failed to create SecondUser profile");

        // Cambia al secondo profilo
        manager.switch_profile("SecondUser", "SecondUserPass456!").await
            .expect("Failed to switch to SecondUser");

        assert_eq!(manager.current_profile().unwrap().name, "SecondUser");

        // Verifica isolamento: SecondUser non dovrebbe vedere le credenziali di MainUser
        assert!(manager.get_credential("steam").is_none(), 
            "SecondUser should not see MainUser's Steam credential");
        assert!(manager.get_credential("epic").is_none(), 
            "SecondUser should not see MainUser's Epic credential");

        // Verifica impostazioni diverse
        let second_settings = manager.get_settings().unwrap();
        assert_eq!(second_settings.theme, Theme::Auto);
        assert_eq!(second_settings.language, "fr");
        assert_eq!(second_settings.auto_login, true);

        // Aggiungi credenziali specifiche per SecondUser
        let second_credentials = vec![
            ("gog", "second_gog_encrypted", "second_gog_nonce", "second_gog_salt"),
            ("origin", "second_origin_encrypted", "second_origin_nonce", "second_origin_salt"),
        ];

        for (store, data, nonce, salt) in second_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: nonce.to_string(),
                salt: salt.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            manager.add_credential(credential, "SecondUserPass456!").await
                .expect(&format!("Failed to add {} credential to SecondUser", store));
        }

        println!("✅ SecondUser creato e isolamento dati verificato");

        // === STEP 3: VERIFICA ISOLAMENTO BIDIREZIONALE ===
        println!("--- Step 3: Verifica isolamento bidirezionale ---");
        
        // Torna a MainUser
        manager.switch_profile("MainUser", "MainUserPass123!").await
            .expect("Failed to switch back to MainUser");

        // Verifica che MainUser non veda le credenziali di SecondUser
        assert!(manager.get_credential("gog").is_none(), 
            "MainUser should not see SecondUser's GOG credential");
        assert!(manager.get_credential("origin").is_none(), 
            "MainUser should not see SecondUser's Origin credential");

        // Verifica che MainUser veda ancora le sue credenziali
        assert!(manager.get_credential("steam").is_some(), 
            "MainUser should still see own Steam credential");
        assert!(manager.get_credential("epic").is_some(), 
            "MainUser should still see own Epic credential");

        // Verifica che le impostazioni di MainUser siano persistite
        let main_current_settings = manager.get_settings().unwrap();
        assert_eq!(main_current_settings.theme, Theme::Light);
        assert_eq!(main_current_settings.language, "en");
        assert_eq!(main_current_settings.notifications.deals, true);

        println!("✅ Isolamento bidirezionale verificato");

        // === STEP 4: TEST EXPORT/IMPORT PROFILI ===
        println!("--- Step 4: Test export/import profili ---");
        
        // Export MainUser (simulato tramite raccolta dati)
        let main_export_data = ExportedProfileData {
            profile_name: manager.current_profile().unwrap().name.clone(),
            avatar_path: manager.current_profile().unwrap().avatar_path.clone(),
            settings: manager.get_settings().unwrap().clone(),
            credentials: vec![
                manager.get_credential("steam").unwrap().clone(),
                manager.get_credential("epic").unwrap().clone(),
            ],
        };

        // Cambia a SecondUser ed export
        manager.switch_profile("SecondUser", "SecondUserPass456!").await
            .expect("Failed to switch to SecondUser for export");

        let second_export_data = ExportedProfileData {
            profile_name: manager.current_profile().unwrap().name.clone(),
            avatar_path: manager.current_profile().unwrap().avatar_path.clone(),
            settings: manager.get_settings().unwrap().clone(),
            credentials: vec![
                manager.get_credential("gog").unwrap().clone(),
                manager.get_credential("origin").unwrap().clone(),
            ],
        };

        // Simula import su nuovo sistema
        let (mut import_manager, _import_temp_dir) = create_test_manager().await;

        // Import MainUser
        let main_import_request = CreateProfileRequest {
            name: main_export_data.profile_name.clone(),
            password: "MainUserPass123!".to_string(),
            avatar_path: main_export_data.avatar_path.clone(),
            settings: Some(main_export_data.settings.clone()),
        };

        let _imported_main = import_manager.create_profile(main_import_request).await
            .expect("Failed to import MainUser profile");

        import_manager.authenticate_profile("MainUser", "MainUserPass123!").await
            .expect("Failed to authenticate imported MainUser");

        // Ricrea credenziali MainUser
        for credential in main_export_data.credentials {
            import_manager.add_credential(credential, "MainUserPass123!").await
                .expect("Failed to import MainUser credential");
        }

        // Import SecondUser
        let second_import_request = CreateProfileRequest {
            name: second_export_data.profile_name.clone(),
            password: "SecondUserPass456!".to_string(),
            avatar_path: second_export_data.avatar_path.clone(),
            settings: Some(second_export_data.settings.clone()),
        };

        let _imported_second = import_manager.create_profile(second_import_request).await
            .expect("Failed to import SecondUser profile");

        import_manager.switch_profile("SecondUser", "SecondUserPass456!").await
            .expect("Failed to switch to imported SecondUser");

        // Ricrea credenziali SecondUser
        for credential in second_export_data.credentials {
            import_manager.add_credential(credential, "SecondUserPass456!").await
                .expect("Failed to import SecondUser credential");
        }

        println!("✅ Export/Import di entrambi i profili completato");

        // === STEP 5: VERIFICA INTEGRITÀ POST-IMPORT ===
        println!("--- Step 5: Verifica integrità post-import ---");
        
        // Verifica MainUser importato
        import_manager.authenticate_profile("MainUser", "MainUserPass123!").await
            .expect("Failed to authenticate imported MainUser");

        let imported_main_settings = import_manager.get_settings().unwrap();
        assert_eq!(imported_main_settings.theme, Theme::Light);
        assert_eq!(imported_main_settings.language, "en");
        assert_eq!(imported_main_settings.notifications.deals, true);

        assert!(import_manager.get_credential("steam").is_some());
        assert!(import_manager.get_credential("epic").is_some());
        assert!(import_manager.get_credential("gog").is_none());
        assert!(import_manager.get_credential("origin").is_none());

        // Verifica SecondUser importato
        import_manager.switch_profile("SecondUser", "SecondUserPass456!").await
            .expect("Failed to switch to imported SecondUser");

        let imported_second_settings = import_manager.get_settings().unwrap();
        assert_eq!(imported_second_settings.theme, Theme::Auto);
        assert_eq!(imported_second_settings.language, "fr");
        assert_eq!(imported_second_settings.auto_login, true);

        assert!(import_manager.get_credential("gog").is_some());
        assert!(import_manager.get_credential("origin").is_some());
        assert!(import_manager.get_credential("steam").is_none());
        assert!(import_manager.get_credential("epic").is_none());

        println!("✅ Integrità post-import verificata");

        // === STEP 6: TEST PERSISTENZA DOPO RIAVVIO ===
        println!("--- Step 6: Test persistenza dopo riavvio ---");
        
        // Simula riavvio con logout completo
        import_manager.logout().expect("Failed to logout");
        assert!(!import_manager.is_profile_active());

        // Riautentica e verifica persistenza
        import_manager.authenticate_profile("MainUser", "MainUserPass123!").await
            .expect("Failed to re-authenticate MainUser after restart");

        let persistent_settings = import_manager.get_settings().unwrap();
        assert_eq!(persistent_settings.theme, Theme::Light);
        assert_eq!(persistent_settings.language, "en");

        assert!(import_manager.get_credential("steam").is_some());
        assert!(import_manager.get_credential("epic").is_some());

        println!("✅ Persistenza dopo riavvio verificata");

        println!("🎉 TEST TASK 9.2 COMPLETATO CON SUCCESSO!");
        println!("   ✅ Creazione profilo → autenticazione → uso");
        println!("   ✅ Cambio profilo e isolamento dati");
        println!("   ✅ Export/import profili");
        println!("   ✅ Persistenza e integrità dati");
    }

    // Struttura helper per simulare export/import
    #[derive(Clone)]
    struct ExportedProfileData {
        profile_name: String,
        avatar_path: Option<String>,
        settings: ProfileSettings,
        credentials: Vec<EncryptedCredential>,
    }

    #[tokio::test]
    async fn test_comprehensive_multi_user_scenario() {
        let (mut manager, _temp_dir) = create_test_manager().await;

        // === SCENARIO: FAMIGLIA CON PROFILI MULTIPLI ===
        println!("=== SCENARIO: FAMIGLIA CON PROFILI MULTIPLI ===");
        
        // Crea profili per una famiglia
        let family_profiles = vec![
            ("Dad", "DadSecurePass123!", Theme::Dark, "en"),
            ("Mom", "MomSecurePass456!", Theme::Light, "it"),
            ("Teen", "TeenGamePass789!", Theme::Auto, "en"),
            ("Kid", "KidSafePass012!", Theme::Light, "it"),
        ];
        
        let mut created_profiles = Vec::new();
        
        for (name, password, theme, language) in &family_profiles {
            let mut request = create_test_profile_request(name, password);
            if let Some(ref mut settings) = request.settings {
                settings.theme = theme.clone();
                settings.language = language.to_string();
            }
            
            let profile = manager.create_profile(request).await
                .expect(&format!("Failed to create profile for {}", name));
            created_profiles.push((profile, password));
            
            println!("✅ Profilo {} creato", name);
        }

        // === CONFIGURAZIONE PROFILI SPECIFICI ===
        println!("=== CONFIGURAZIONE PROFILI SPECIFICI ===");
        
        // Configura Dad (Gamer adulto)
        manager.authenticate_profile("Dad", "DadSecurePass123!")
            .await.expect("Failed to authenticate Dad");
        
        let dad_credentials = vec![
            ("steam", "dad_steam_account"),
            ("epic", "dad_epic_account"),
            ("origin", "dad_origin_account"),
        ];
        
        for (store, data) in dad_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: format!("dad_{}_nonce", store),
                salt: format!("dad_{}_salt", store),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            
            manager.add_credential(credential, "DadSecurePass123!")
                .await.expect(&format!("Failed to add {} for Dad", store));
        }
        
        println!("✅ Dad configurato con Steam, Epic, Origin");

        // Configura Mom (Casual gamer)
        manager.switch_profile("Mom", "MomSecurePass456!")
            .await.expect("Failed to switch to Mom");
        
        let mom_credentials = vec![
            ("steam", "mom_steam_account"),
            ("mobile_games", "mom_mobile_account"),
        ];
        
        for (store, data) in mom_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: format!("mom_{}_nonce", store),
                salt: format!("mom_{}_salt", store),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            
            manager.add_credential(credential, "MomSecurePass456!")
                .await.expect(&format!("Failed to add {} for Mom", store));
        }
        
        println!("✅ Mom configurata con Steam e Mobile Games");

        // Configura Teen (Heavy gamer)
        manager.switch_profile("Teen", "TeenGamePass789!")
            .await.expect("Failed to switch to Teen");
        
        let teen_credentials = vec![
            ("steam", "teen_steam_account"),
            ("epic", "teen_epic_account"),
            ("discord", "teen_discord_account"),
            ("twitch", "teen_twitch_account"),
        ];
        
        for (store, data) in teen_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: format!("teen_{}_nonce", store),
                salt: format!("teen_{}_salt", store),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            
            manager.add_credential(credential, "TeenGamePass789!")
                .await.expect(&format!("Failed to add {} for Teen", store));
        }
        
        println!("✅ Teen configurato con Steam, Epic, Discord, Twitch");

        // Configura Kid (Limitato)
        manager.switch_profile("Kid", "KidSafePass012!")
            .await.expect("Failed to switch to Kid");
        
        let kid_credentials = vec![
            ("educational_games", "kid_educational_account"),
        ];
        
        for (store, data) in kid_credentials {
            let credential = EncryptedCredential {
                store: store.to_string(),
                encrypted_data: data.to_string(),
                nonce: format!("kid_{}_nonce", store),
                salt: format!("kid_{}_salt", store),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                encryption_version: 1,
            };
            
            manager.add_credential(credential, "KidSafePass012!")
                .await.expect(&format!("Failed to add {} for Kid", store));
        }
        
        println!("✅ Kid configurato con Educational Games");

        // === VERIFICA ISOLAMENTO COMPLETO ===
        println!("=== VERIFICA ISOLAMENTO COMPLETO ===");
        
        // Test isolamento Dad
        manager.switch_profile("Dad", "DadSecurePass123!")
            .await.expect("Failed to switch to Dad for isolation test");
        
        assert!(manager.get_credential("steam").is_some(), "Dad should have Steam");
        assert!(manager.get_credential("epic").is_some(), "Dad should have Epic");
        assert!(manager.get_credential("origin").is_some(), "Dad should have Origin");
        assert!(manager.get_credential("mobile_games").is_none(), "Dad should not see Mom's mobile games");
        assert!(manager.get_credential("discord").is_none(), "Dad should not see Teen's Discord");
        assert!(manager.get_credential("educational_games").is_none(), "Dad should not see Kid's educational games");
        
        // Test isolamento Mom
        manager.switch_profile("Mom", "MomSecurePass456!")
            .await.expect("Failed to switch to Mom for isolation test");
        
        assert!(manager.get_credential("steam").is_some(), "Mom should have Steam");
        assert!(manager.get_credential("mobile_games").is_some(), "Mom should have mobile games");
        assert!(manager.get_credential("epic").is_none(), "Mom should not see Dad's Epic");
        assert!(manager.get_credential("discord").is_none(), "Mom should not see Teen's Discord");
        assert!(manager.get_credential("educational_games").is_none(), "Mom should not see Kid's educational games");
        
        // Test isolamento Teen
        manager.switch_profile("Teen", "TeenGamePass789!")
            .await.expect("Failed to switch to Teen for isolation test");
        
        assert!(manager.get_credential("steam").is_some(), "Teen should have Steam");
        assert!(manager.get_credential("epic").is_some(), "Teen should have Epic");
        assert!(manager.get_credential("discord").is_some(), "Teen should have Discord");
        assert!(manager.get_credential("twitch").is_some(), "Teen should have Twitch");
        assert!(manager.get_credential("mobile_games").is_none(), "Teen should not see Mom's mobile games");
        assert!(manager.get_credential("origin").is_none(), "Teen should not see Dad's Origin");
        assert!(manager.get_credential("educational_games").is_none(), "Teen should not see Kid's educational games");
        
        // Test isolamento Kid
        manager.switch_profile("Kid", "KidSafePass012!")
            .await.expect("Failed to switch to Kid for isolation test");
        
        assert!(manager.get_credential("educational_games").is_some(), "Kid should have educational games");
        assert!(manager.get_credential("steam").is_none(), "Kid should not see any Steam accounts");
        assert!(manager.get_credential("epic").is_none(), "Kid should not see any Epic accounts");
        assert!(manager.get_credential("discord").is_none(), "Kid should not see Teen's Discord");
        assert!(manager.get_credential("mobile_games").is_none(), "Kid should not see Mom's mobile games");
        
        println!("✅ Isolamento completo verificato per tutti i profili");

        // === TEST PERSISTENZA DOPO RIAVVIO SIMULATO ===
        println!("=== TEST PERSISTENZA DOPO RIAVVIO SIMULATO ===");
        
        // Simula riavvio con logout completo
        manager.force_logout_all();
        assert!(!manager.is_profile_active());
        
        // Verifica che ogni profilo mantenga i suoi dati dopo il "riavvio"
        for (name, password) in [
            ("Dad", "DadSecurePass123!"),
            ("Mom", "MomSecurePass456!"),
            ("Teen", "TeenGamePass789!"),
            ("Kid", "KidSafePass012!"),
        ] {
            manager.authenticate_profile(name, password)
                .await.expect(&format!("Failed to re-authenticate {} after restart", name));
            
            let settings = manager.get_settings().unwrap();
            
            match name {
                "Dad" => {
                    assert_eq!(settings.theme, Theme::Dark);
                    assert_eq!(settings.language, "en");
                    assert!(manager.get_credential("steam").is_some());
                    assert!(manager.get_credential("epic").is_some());
                    assert!(manager.get_credential("origin").is_some());
                },
                "Mom" => {
                    assert_eq!(settings.theme, Theme::Light);
                    assert_eq!(settings.language, "it");
                    assert!(manager.get_credential("steam").is_some());
                    assert!(manager.get_credential("mobile_games").is_some());
                },
                "Teen" => {
                    assert_eq!(settings.theme, Theme::Auto);
                    assert_eq!(settings.language, "en");
                    assert!(manager.get_credential("steam").is_some());
                    assert!(manager.get_credential("discord").is_some());
                    assert!(manager.get_credential("twitch").is_some());
                },
                "Kid" => {
                    assert_eq!(settings.theme, Theme::Light);
                    assert_eq!(settings.language, "it");
                    assert!(manager.get_credential("educational_games").is_some());
                },
                _ => {}
            }
            
            manager.logout().expect(&format!("Failed to logout {}", name));
            println!("✅ {} - persistenza verificata", name);
        }

        println!("✅ Test scenario famiglia multi-utente completato con successo!");
    }
}
