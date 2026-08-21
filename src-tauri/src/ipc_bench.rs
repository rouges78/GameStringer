//! Misura il costo per stringa dei due trasporti IPC.
//!
//! Named Pipe (il trasporto di gs-hook / overlay_ipc) contro shared memory
//! (il Translation Bridge). Stesso carico su entrambi: lookup in dizionario di
//! stringhe di gioco realistiche, una richiesta alla volta, latenza end-to-end.
//!
//! Compila solo sotto `cargo test`: non entra nel binario.
//! Numeri e interpretazione in `docs/METODI-DI-TRADUZIONE.md`.
//!
//! ```text
//! cargo test --release --lib ipc_bench -- --nocapture --test-threads=1
//! ```

#![cfg(all(test, windows))]

use std::io::{Read, Write};
use std::time::Instant;

const ITERATIONS: usize = 3000;
const WARMUP: usize = 300;

/// Stringhe di gioco realistiche: label UI corte e righe di dialogo lunghe.
fn corpus() -> Vec<(String, String)> {
    let pairs: &[(&str, &str)] = &[
        ("New Game", "Nuova partita"),
        ("Continue", "Continua"),
        ("Options", "Opzioni"),
        ("Quit to Desktop", "Esci al desktop"),
        ("Save", "Salva"),
        ("Load", "Carica"),
        ("Inventory", "Inventario"),
        ("Health", "Salute"),
        ("Stamina", "Resistenza"),
        ("Press any key to continue", "Premi un tasto per continuare"),
        ("You have obtained a Rusty Key.", "Hai ottenuto una Chiave Arrugginita."),
        ("The door is locked. Perhaps there is a key somewhere nearby.",
         "La porta e' chiusa a chiave. Forse c'e' una chiave qui vicino."),
        ("I have been waiting for you for a very long time, traveller. Sit down, and let me tell you what happened to this village.",
         "Ti aspettavo da moltissimo tempo, viaggiatore. Siediti, e lascia che ti racconti cosa e' successo a questo villaggio."),
        ("Autosaving...", "Salvataggio automatico..."),
        ("Level Up!", "Livello superiore!"),
        ("Are you sure you want to abandon this quest?",
         "Sei sicuro di voler abbandonare questa missione?"),
    ];
    pairs.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect()
}

fn report(label: &str, mut samples_us: Vec<f64>) {
    samples_us.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = samples_us.len();
    let pct = |p: f64| samples_us[((n as f64 * p) as usize).min(n - 1)];
    let mean = samples_us.iter().sum::<f64>() / n as f64;

    println!(
        "\n{label}\n  n={n}  media={mean:.1}us  p50={:.1}us  p95={:.1}us  p99={:.1}us  max={:.1}us",
        pct(0.50), pct(0.95), pct(0.99), pct(1.0)
    );
    // Un frame a 60fps dura 16667us. Quante stringhe ci stanno se ne spendiamo il 10%?
    let budget_us = 16_667.0 * 0.10;
    println!(
        "  a 60fps, col 10% del frame (1667us): ~{:.0} stringhe/frame (p95), ~{:.0} (p99)",
        budget_us / pct(0.95),
        budget_us / pct(0.99)
    );
}

// ─── Named Pipe ───────────────────────────────────────────────────

/// Server: frame `[u32 LE len][payload UTF-8]`, lo stesso wire format di
/// `overlay_ipc.rs`. Payload grezzo, non JSON — e' il caso migliore per la pipe.
#[test]
fn bench_named_pipe_roundtrip() {
    use std::collections::HashMap;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::windows::named_pipe::ServerOptions;

    let pipe_name = format!(r"\\.\pipe\gs_bench_{}", std::process::id());
    let dict: HashMap<String, String> = corpus().into_iter().collect();

    let server_name = pipe_name.clone();
    let server = std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async move {
            let mut pipe = ServerOptions::new().create(&server_name).unwrap();
            pipe.connect().await.unwrap();
            loop {
                let mut len_buf = [0u8; 4];
                if pipe.read_exact(&mut len_buf).await.is_err() {
                    return; // client chiuso
                }
                let len = u32::from_le_bytes(len_buf) as usize;
                let mut payload = vec![0u8; len];
                pipe.read_exact(&mut payload).await.unwrap();
                let text = std::str::from_utf8(&payload).unwrap();

                let reply = dict.get(text).cloned().unwrap_or_default();
                let bytes = reply.as_bytes();
                pipe.write_all(&(bytes.len() as u32).to_le_bytes()).await.unwrap();
                pipe.write_all(bytes).await.unwrap();
                pipe.flush().await.unwrap();
            }
        });
    });

    // Client: blocking, come una DLL che chiama dal thread di rendering.
    let mut client = loop {
        match std::fs::OpenOptions::new().read(true).write(true).open(&pipe_name) {
            Ok(f) => break f,
            Err(_) => std::thread::sleep(std::time::Duration::from_millis(5)),
        }
    };

    let corpus = corpus();
    let mut samples = Vec::with_capacity(ITERATIONS);

    for i in 0..(WARMUP + ITERATIONS) {
        let (original, expected) = &corpus[i % corpus.len()];
        let bytes = original.as_bytes();

        let t0 = Instant::now();
        client.write_all(&(bytes.len() as u32).to_le_bytes()).unwrap();
        client.write_all(bytes).unwrap();
        client.flush().unwrap();

        let mut len_buf = [0u8; 4];
        client.read_exact(&mut len_buf).unwrap();
        let len = u32::from_le_bytes(len_buf) as usize;
        let mut reply = vec![0u8; len];
        client.read_exact(&mut reply).unwrap();
        let elapsed = t0.elapsed().as_nanos() as f64 / 1000.0;

        assert_eq!(std::str::from_utf8(&reply).unwrap(), expected);
        if i >= WARMUP {
            samples.push(elapsed);
        }
    }

    drop(client);
    let _ = server.join();
    report("NAMED PIPE — round trip per stringa", samples);
}

// ─── Shared memory ────────────────────────────────────────────────

/// Client: apre la shmem per nome e guida gli slot esattamente come dovrebbe
/// fare il plugin C#, tail del circular buffer incluso.
#[test]
fn bench_shared_memory_roundtrip() {
    use crate::translation_bridge::protocol::*;
    use crate::translation_bridge::TranslationBridge;
    use shared_memory::ShmemConf;

    let name = format!("gs_bench_shmem_{}", std::process::id());
    let mut bridge = TranslationBridge::with_name(&name);
    bridge.load_dictionary("en", "it", corpus());
    bridge.start().expect("bridge start");

    let shmem = ShmemConf::new().os_id(&name).open().expect("open shmem");
    let base = shmem.as_ptr();

    let corpus = corpus();
    let mut samples = Vec::with_capacity(ITERATIONS);
    let mut write_index: u32 = 0;

    unsafe {
        let header = base as *mut SharedMemoryHeader;
        let slots = base.add(SLOTS_OFFSET) as *mut TranslationSlot;
        let request_data = base.add(REQUEST_DATA_OFFSET);
        let response_data = base.add(RESPONSE_DATA_OFFSET);

        for i in 0..(WARMUP + ITERATIONS) {
            let (original, expected) = &corpus[i % corpus.len()];
            let bytes = original.as_bytes();
            let slot_idx = i % MAX_SLOTS;
            let slot = slots.add(slot_idx);

            let t0 = Instant::now();

            std::ptr::copy_nonoverlapping(bytes.as_ptr(), request_data, bytes.len());
            (*slot).original_offset = 0;
            (*slot).original_len = bytes.len() as u32;
            (*slot).original_hash = TranslationRequest::compute_hash(original);
            (*slot).translated_offset = 0;
            (*slot).translated_len = 0;
            std::ptr::write_volatile(&mut (*slot).state, SlotState::PendingRequest as u8);
            write_index = write_index.wrapping_add(1);
            std::ptr::write_volatile(&mut (*header).write_index, write_index);

            // Spin come farebbe il plugin nel thread di rendering.
            let state = loop {
                let s = SlotState::from(std::ptr::read_volatile(&(*slot).state));
                if s == SlotState::PendingResponse || s == SlotState::Error {
                    break s;
                }
                std::hint::spin_loop();
            };
            let elapsed = t0.elapsed().as_nanos() as f64 / 1000.0;

            assert_eq!(state, SlotState::PendingResponse, "iterazione {i}");

            let off = (*slot).translated_offset as usize;
            let len = (*slot).translated_len as usize;
            let got = std::slice::from_raw_parts(response_data.add(off), len);
            assert_eq!(std::str::from_utf8(got).unwrap(), expected);

            // Ruolo del C#: libera lo spazio consumato e rilascia lo slot.
            std::ptr::write_volatile(
                &mut (*header).response_data_tail,
                ((off + len) % RESPONSE_DATA_SIZE) as u32,
            );
            std::ptr::write_volatile(&mut (*slot).state, SlotState::Empty as u8);

            if i >= WARMUP {
                samples.push(elapsed);
            }
        }
    }

    drop(shmem);
    bridge.stop();
    report("SHARED MEMORY — round trip per stringa", samples);
}
