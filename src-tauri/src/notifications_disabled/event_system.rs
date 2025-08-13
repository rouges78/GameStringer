use std::sync::Arc;
use tokio::sync::{Mutex, broadcast};
use crate::profiles::manager::ProfileEvent;
use crate::notifications::{
    manager::NotificationManager,
    profile_integration::ProfileNotificationIntegration,
    profile_event_handler::ProfileEventHandler,
    errors::NotificationResult,
};

/// Sistema di eventi per notifiche automatiche
pub struct NotificationEventSystem {
    /// Sender per eventi profilo
    profile_event_sender: broadcast::Sender<ProfileEvent>,
    /// Handler per eventi profilo
    profile_event_handler: Arc<ProfileEventHandler>,
    /// Flag per indicare se il sistema è attivo
    is_active: Arc<Mutex<bool>>,
}

impl NotificationEventSystem {
    /// Crea un nuovo sistema di eventi
    pub fn new(
        notification_manager: Arc<Mutex<NotificationManager>>,
        profile_integration: Arc<Mutex<ProfileNotificationIntegration>>,
    ) -> Self {
        let (sender, _) = broadcast::channel(100);
        let handler = Arc::new(ProfileEventHandler::new(
            notification_manager,
            profile_integration,
        ));

        Self {
            profile_event_sender: sender,
            profile_event_handler: handler,
            is_active: Arc::new(Mutex::new(false)),
        }
    }

    /// Avvia il sistema di eventi
    pub async fn start(&self) -> NotificationResult<()> {
        let mut is_active = self.is_active.lock().await;
        if *is_active {
            return Ok(()); // Già attivo
        }

        *is_active = true;
        
        // Avvia il listener per eventi profilo
        self.start_profile_event_listener().await;
        
        println!("[NOTIFICATION EVENT SYSTEM] Sistema eventi avviato");
        Ok(())
    }

    /// Ferma il sistema di eventi
    pub async fn stop(&self) {
        let mut is_active = self.is_active.lock().await;
        *is_active = false;
        println!("[NOTIFICATION EVENT SYSTEM] Sistema eventi fermato");
    }

    /// Verifica se il sistema è attivo
    pub async fn is_active(&self) -> bool {
        *self.is_active.lock().await
    }

    /// Invia un evento profilo
    pub async fn emit_profile_event(&self, event: ProfileEvent) -> NotificationResult<()> {
        if !self.is_active().await {
            return Ok(()); // Sistema non attivo, ignora l'evento
        }

        // Invia l'evento attraverso il broadcast channel
        if let Err(e) = self.profile_event_sender.send(event.clone()) {
            eprintln!("[NOTIFICATION EVENT SYSTEM] Errore invio evento: {}", e);
        }

        // Gestisce immediatamente l'evento per garantire che venga processato
        self.profile_event_handler.handle_event(event).await?;

        Ok(())
    }

    /// Avvia il listener per eventi profilo in background
    async fn start_profile_event_listener(&self) {
        let mut receiver = self.profile_event_sender.subscribe();
        let handler = Arc::clone(&self.profile_event_handler);
        let is_active = Arc::clone(&self.is_active);

        tokio::spawn(async move {
            while *is_active.lock().await {
                match receiver.recv().await {
                    Ok(event) => {
                        if let Err(e) = handler.handle_event(event.clone()).await {
                            eprintln!("[NOTIFICATION EVENT SYSTEM] Errore gestione evento {:?}: {}", event, e);
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        println!("[NOTIFICATION EVENT SYSTEM] Channel chiuso, fermando listener");
                        break;
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        eprintln!("[NOTIFICATION EVENT SYSTEM] Listener in ritardo, saltati {} eventi", skipped);
                    }
                }
            }
        });
    }

    /// Ottiene statistiche del sistema di eventi
    pub async fn get_event_stats(&self) -> EventSystemStats {
        EventSystemStats {
            is_active: self.is_active().await,
            receiver_count: self.profile_event_sender.receiver_count(),
        }
    }

    /// Crea listener personalizzato per eventi specifici
    pub fn create_event_listener(&self) -> broadcast::Receiver<ProfileEvent> {
        self.profile_event_sender.subscribe()
    }

    /// Gestisce eventi di creazione profilo con notifiche personalizzate
    pub async fn handle_profile_created(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        let event = ProfileEvent::ProfileCreated {
            profile_id: profile_id.to_string(),
            name: profile_name.to_string(),
        };

        // Inizializza le notifiche per il nuovo profilo
        self.profile_event_handler.initialize_profile_notifications(profile_id, profile_name).await?;
        
        // Emette l'evento
        self.emit_profile_event(event).await?;

        Ok(())
    }

    /// Gestisce eventi di autenticazione con controlli di sicurezza
    pub async fn handle_profile_authenticated(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        let event = ProfileEvent::ProfileAuthenticated {
            profile_id: profile_id.to_string(),
            name: profile_name.to_string(),
        };

        // Verifica l'integrità del profilo dopo l'autenticazione
        if let Ok(is_valid) = self.profile_event_handler.verify_profile_integrity(profile_id).await {
            if !is_valid {
                eprintln!("[NOTIFICATION EVENT SYSTEM] Problemi di integrità rilevati per profilo: {}", profile_id);
            }
        }

        // Emette l'evento
        self.emit_profile_event(event).await?;

        Ok(())
    }

    /// Gestisce eventi di cambio profilo con pulizia
    pub async fn handle_profile_switched(&self, from_id: Option<&str>, to_id: &str) -> NotificationResult<()> {
        let event = ProfileEvent::ProfileSwitched {
            from_id: from_id.map(|s| s.to_string()),
            to_id: to_id.to_string(),
        };

        // Gestisce il cambio profilo con pulizia
        self.profile_event_handler.handle_profile_switch_with_cleanup(from_id, to_id).await?;

        // Emette l'evento
        self.emit_profile_event(event).await?;

        Ok(())
    }

    /// Gestisce eventi di eliminazione profilo con pulizia completa
    pub async fn handle_profile_deleted(&self, profile_id: &str, profile_name: &str) -> NotificationResult<()> {
        // Prepara il profilo per l'eliminazione (pulisce le notifiche)
        let deleted_count = self.profile_event_handler.prepare_profile_for_deletion(profile_id).await?;
        
        let event = ProfileEvent::ProfileDeleted {
            profile_id: profile_id.to_string(),
            name: profile_name.to_string(),
        };

        // Emette l'evento
        self.emit_profile_event(event).await?;

        println!("[NOTIFICATION EVENT SYSTEM] Profilo eliminato: {} ({} notifiche rimosse)", profile_name, deleted_count);
        Ok(())
    }

    /// Gestisce eventi di logout
    pub async fn handle_profile_logged_out(&self, profile_id: &str) -> NotificationResult<()> {
        let event = ProfileEvent::ProfileLoggedOut {
            profile_id: profile_id.to_string(),
        };

        // Esegue pulizia completa per il profilo
        let (expired_count, old_count) = self.profile_event_handler.full_cleanup_for_profile(profile_id).await?;
        
        // Emette l'evento
        self.emit_profile_event(event).await?;

        println!("[NOTIFICATION EVENT SYSTEM] Logout profilo: {} ({} scadute, {} vecchie pulite)", 
                 profile_id, expired_count, old_count);
        Ok(())
    }

    /// Gestisce eventi di fallimento autenticazione
    pub async fn handle_authentication_failed(&self, profile_name: &str, reason: &str) -> NotificationResult<()> {
        let event = ProfileEvent::AuthenticationFailed {
            profile_name: profile_name.to_string(),
            reason: reason.to_string(),
        };

        // Emette l'evento
        self.emit_profile_event(event).await?;

        println!("[NOTIFICATION EVENT SYSTEM] Autenticazione fallita per {}: {}", profile_name, reason);
        Ok(())
    }

    /// Ottiene l'handler degli eventi per operazioni avanzate
    pub fn get_event_handler(&self) -> Arc<ProfileEventHandler> {
        Arc::clone(&self.profile_event_handler)
    }
}

/// Statistiche del sistema di eventi
#[derive(Debug, Clone)]
pub struct EventSystemStats {
    /// Se il sistema è attivo
    pub is_active: bool,
    /// Numero di receiver attivi
    pub receiver_count: usize,
}

/// Trait per oggetti che possono ricevere eventi profilo
pub trait ProfileEventListener {
    /// Gestisce un evento profilo
    fn handle_profile_event(&self, event: ProfileEvent) -> impl std::future::Future<Output = NotificationResult<()>> + Send;
}

/// Implementazione del listener per il sistema di notifiche
impl ProfileEventListener for NotificationEventSystem {
    async fn handle_profile_event(&self, event: ProfileEvent) -> NotificationResult<()> {
        self.emit_profile_event(event).await
    }
}