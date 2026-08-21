//! translator_pipe — server Named Pipe per le richieste di traduzione delle DLL.
//!
//! È il lato Rust del canale `GameStringerTranslator`, il cui client vive in
//! `unreal-translator/hook-dll/src/ipc.cpp` (riusato da gs-hook). Fino a oggi
//! quel client non aveva nessun server: vedi la tabella dei trasporti in
//! `docs/METODI-DI-TRADUZIONE.md`.
//!
//! Wire format (dettato dal binario C++ già spedito, non modificabile da qui):
//! pipe in **message mode**; ogni messaggio è
//!   `IPCMessage { type: u32 LE, request_id: u32 LE, data_length: u32 LE }`
//! seguito da `data_length` byte di payload **UTF-16LE** senza terminatore.
//! La DLL invia `TRANSLATE_REQUEST` (1) e si aspetta `TRANSLATE_RESPONSE` (101)
//! con lo stesso `request_id`.
//!
//! Semantica: hit nel dizionario → risposta immediata; miss → NESSUNA risposta
//! (la DLL ha il suo timeout) e il testo finisce nella coda dei cache miss del
//! Translation Bridge, la stessa drenata da `translation_bridge_drain_misses`
//! per l'AI fallback. Un solo dizionario, due trasporti.

#![cfg(windows)]

use std::collections::HashSet;
use std::sync::mpsc;
use std::sync::Arc;

use parking_lot::RwLock;

use crate::translation_bridge::dictionary_engine::DictionaryEngine;
use crate::translation_bridge::protocol::TranslationRequest;

/// Nome della pipe (deve combaciare con `PIPE_NAME` in hook-dll/include/ipc.h).
pub const PIPE_NAME: &str = r"\\.\pipe\GameStringerTranslator";

/// DLL → GameStringer: richiesta di traduzione.
const MSG_TRANSLATE_REQUEST: u32 = 1;
/// GameStringer → DLL: risposta con il testo tradotto.
const MSG_TRANSLATE_RESPONSE: u32 = 101;

/// Dimensione dell'header `IPCMessage` C++ (tre u32, packing naturale).
const HEADER_SIZE: usize = 12;
/// Payload massimo accettato (allineato al buffer di lettura della DLL: 64KB).
const MAX_PAYLOAD: usize = 65536 - HEADER_SIZE;

/// Avvia il server in background sulla pipe di produzione.
///
/// `dictionary` e `miss_sender` sono gli stessi del Translation Bridge, così i
/// dizionari caricati dal frontend rispondono anche qui e i miss confluiscono
/// nell'unica coda dell'AI fallback.
pub fn start(dictionary: Arc<RwLock<DictionaryEngine>>, miss_sender: mpsc::Sender<String>) {
    start_on(PIPE_NAME.to_string(), dictionary, miss_sender);
}

/// Come `start`, ma su un nome pipe arbitrario (per i test).
fn start_on(
    pipe_name: String,
    dictionary: Arc<RwLock<DictionaryEngine>>,
    miss_sender: mpsc::Sender<String>,
) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = serve(&pipe_name, dictionary, miss_sender).await {
            log::warn!("📡 translator IPC server terminato: {}", e);
        }
    });
}

/// Loop del server. Pubblico per gli host di prova (examples/) e i test:
/// la produzione passa da `start`.
pub async fn serve(
    pipe_name: &str,
    dictionary: Arc<RwLock<DictionaryEngine>>,
    miss_sender: mpsc::Sender<String>,
) -> std::io::Result<()> {
    use tokio::net::windows::named_pipe::{PipeMode, ServerOptions};

    log::info!("📡 Translator IPC server in ascolto su {}", pipe_name);
    loop {
        // Una nuova istanza per ogni connessione (un gioco alla volta), come
        // overlay_ipc. Message mode: la DLL fa un ReadFile per messaggio.
        let mut server = ServerOptions::new()
            .pipe_mode(PipeMode::Message)
            .create(pipe_name)?;
        server.connect().await?;
        log::debug!("📡 translator IPC: DLL connessa");

        if let Err(e) = handle_connection(&mut server, &dictionary, &miss_sender).await {
            log::debug!("📡 translator IPC: connessione chiusa ({})", e);
        }
    }
}

async fn handle_connection(
    server: &mut tokio::net::windows::named_pipe::NamedPipeServer,
    dictionary: &Arc<RwLock<DictionaryEngine>>,
    miss_sender: &mpsc::Sender<String>,
) -> std::io::Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // Dedup dei miss per connessione: ogni testo sconosciuto entra in coda una
    // volta sola, anche se la DLL lo richiede a ogni frame.
    let mut queued: HashSet<String> = HashSet::new();
    let mut buf = vec![0u8; HEADER_SIZE + MAX_PAYLOAD];

    loop {
        // In message mode ogni read restituisce un messaggio intero.
        let n = server.read(&mut buf).await?;
        if n == 0 {
            return Ok(()); // pipe chiusa
        }
        if n < HEADER_SIZE {
            continue;
        }

        let msg_type = u32::from_le_bytes(buf[0..4].try_into().unwrap());
        let request_id = u32::from_le_bytes(buf[4..8].try_into().unwrap());
        let data_length = u32::from_le_bytes(buf[8..12].try_into().unwrap()) as usize;

        if msg_type != MSG_TRANSLATE_REQUEST {
            // CACHE_SYNC / LOG_MESSAGE / STATS_UPDATE: oggi la DLL non li invia
            // (sono TODO lato C++); li ignoriamo senza chiudere la connessione.
            continue;
        }
        // Il payload deve essere UTF-16 intero e coerente con l'header.
        if !data_length.is_multiple_of(2) || HEADER_SIZE + data_length != n {
            log::warn!(
                "translator IPC: frame malformato (len dichiarata {}, ricevuti {})",
                data_length,
                n - HEADER_SIZE
            );
            continue;
        }

        let units: Vec<u16> = buf[HEADER_SIZE..HEADER_SIZE + data_length]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        let original = match String::from_utf16(&units) {
            Ok(s) => s,
            Err(_) => continue, // UTF-16 invalido: ignora il frame
        };

        let translation = {
            let hash = TranslationRequest::compute_hash(&original);
            let dict = dictionary.read();
            dict.get_translation(hash, &original)
        };

        match translation {
            Some(ref translated) => {
                log::debug!("translator IPC hit: \"{}\" -> \"{}\"", original, translated);
            }
            None => {
                log::debug!("translator IPC miss: \"{}\"", original);
            }
        }
        match translation {
            Some(translated) => {
                let payload: Vec<u8> = translated
                    .encode_utf16()
                    .flat_map(|u| u.to_le_bytes())
                    .collect();
                if payload.len() > MAX_PAYLOAD {
                    continue; // non entrerebbe nel buffer di lettura della DLL
                }
                let mut frame = Vec::with_capacity(HEADER_SIZE + payload.len());
                frame.extend_from_slice(&MSG_TRANSLATE_RESPONSE.to_le_bytes());
                frame.extend_from_slice(&request_id.to_le_bytes());
                frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
                frame.extend_from_slice(&payload);
                // Un write = un messaggio (PIPE_TYPE_MESSAGE).
                server.write_all(&frame).await?;
            }
            None => {
                // Nessuna risposta: la DLL gestisce il timeout. Il testo va in
                // coda per l'AI fallback, una volta sola.
                if queued.insert(original.clone()) {
                    let _ = miss_sender.send(original);
                }
            }
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::time::Duration;

    /// Client di test che parla il wire format della DLL (ipc.cpp).
    struct FakeDll {
        pipe: std::fs::File,
    }

    impl FakeDll {
        fn connect(pipe_name: &str) -> Self {
            let pipe = loop {
                match std::fs::OpenOptions::new().read(true).write(true).open(pipe_name) {
                    Ok(f) => break f,
                    Err(_) => std::thread::sleep(Duration::from_millis(5)),
                }
            };
            Self { pipe }
        }

        fn send_request(&mut self, request_id: u32, text: &str) {
            let payload: Vec<u8> = text.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
            let mut frame = Vec::with_capacity(HEADER_SIZE + payload.len());
            frame.extend_from_slice(&MSG_TRANSLATE_REQUEST.to_le_bytes());
            frame.extend_from_slice(&request_id.to_le_bytes());
            frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
            frame.extend_from_slice(&payload);
            self.pipe.write_all(&frame).unwrap();
        }

        fn read_response(&mut self) -> (u32, String) {
            let mut header = [0u8; HEADER_SIZE];
            self.pipe.read_exact(&mut header).unwrap();
            let msg_type = u32::from_le_bytes(header[0..4].try_into().unwrap());
            let request_id = u32::from_le_bytes(header[4..8].try_into().unwrap());
            let len = u32::from_le_bytes(header[8..12].try_into().unwrap()) as usize;
            assert_eq!(msg_type, MSG_TRANSLATE_RESPONSE);
            let mut payload = vec![0u8; len];
            self.pipe.read_exact(&mut payload).unwrap();
            let units: Vec<u16> = payload
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            (request_id, String::from_utf16(&units).unwrap())
        }
    }

    fn test_setup(
        translations: Vec<(&str, &str)>,
    ) -> (String, mpsc::Receiver<String>, std::thread::JoinHandle<()>) {
        let pipe_name = format!(
            r"\\.\pipe\gs_test_translator_{}_{:?}",
            std::process::id(),
            std::thread::current().id()
        );
        let mut engine = DictionaryEngine::new();
        engine.set_active_languages("en", "it");
        engine.load_translations(
            "en",
            "it",
            translations
                .into_iter()
                .map(|(a, b)| (a.to_string(), b.to_string()))
                .collect(),
        );
        let dictionary = Arc::new(RwLock::new(engine));
        let (miss_tx, miss_rx) = mpsc::channel();

        // Il server gira su un runtime dedicato al thread di test (i test non
        // hanno il runtime di tauri::async_runtime).
        let name = pipe_name.clone();
        let handle = std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let _ = serve(&name, dictionary, miss_tx).await;
            });
        });

        (pipe_name, miss_rx, handle)
    }

    #[test]
    fn test_hit_roundtrip() {
        let (pipe, _miss_rx, _srv) = test_setup(vec![("New Game", "Nuova partita")]);
        let mut dll = FakeDll::connect(&pipe);

        dll.send_request(7, "New Game");
        let (id, translated) = dll.read_response();
        assert_eq!(id, 7);
        assert_eq!(translated, "Nuova partita");
    }

    #[test]
    fn test_utf16_non_ascii() {
        let (pipe, _miss_rx, _srv) =
            test_setup(vec![("Café — привет 日本語", "Caffè — ciao giapponese")]);
        let mut dll = FakeDll::connect(&pipe);

        dll.send_request(1, "Café — привет 日本語");
        let (_, translated) = dll.read_response();
        assert_eq!(translated, "Caffè — ciao giapponese");
    }

    #[test]
    fn test_miss_queues_once_and_server_survives() {
        let (pipe, miss_rx, _srv) = test_setup(vec![("Continue", "Continua")]);
        let mut dll = FakeDll::connect(&pipe);

        // Miss ripetuto: nessuna risposta, un solo enqueue.
        dll.send_request(1, "Unknown line");
        dll.send_request(2, "Unknown line");
        // Un hit subito dopo: se il server avesse risposto ai miss, qui
        // leggeremmo la risposta sbagliata.
        dll.send_request(3, "Continue");
        let (id, translated) = dll.read_response();
        assert_eq!(id, 3);
        assert_eq!(translated, "Continua");

        assert_eq!(
            miss_rx.recv_timeout(Duration::from_secs(1)).unwrap(),
            "Unknown line"
        );
        assert!(
            miss_rx.try_recv().is_err(),
            "il miss duplicato non deve essere ri-accodato"
        );
    }

    #[test]
    fn test_unknown_message_type_ignored() {
        let (pipe, _miss_rx, _srv) = test_setup(vec![("Save", "Salva")]);
        let mut dll = FakeDll::connect(&pipe);

        // STATS_UPDATE (4): il server deve ignorarlo e restare vivo.
        let mut frame = Vec::new();
        frame.extend_from_slice(&4u32.to_le_bytes());
        frame.extend_from_slice(&99u32.to_le_bytes());
        frame.extend_from_slice(&0u32.to_le_bytes());
        dll.pipe.write_all(&frame).unwrap();

        dll.send_request(5, "Save");
        let (id, translated) = dll.read_response();
        assert_eq!(id, 5);
        assert_eq!(translated, "Salva");
    }

    #[test]
    fn test_reconnect_after_disconnect() {
        let (pipe, _miss_rx, _srv) = test_setup(vec![("Load", "Carica")]);

        {
            let mut dll = FakeDll::connect(&pipe);
            dll.send_request(1, "Load");
            let (_, t) = dll.read_response();
            assert_eq!(t, "Carica");
        } // disconnessione

        // Il server deve accettare un nuovo client.
        let mut dll2 = FakeDll::connect(&pipe);
        dll2.send_request(2, "Load");
        let (id, t) = dll2.read_response();
        assert_eq!(id, 2);
        assert_eq!(t, "Carica");
    }
}
