//! GameStringer Translation Bridge
//! 
//! Architettura "Cervello Esterno" per traduzione in-game Unity
//! - Shared Memory IPC per comunicazione zero-copy con il plugin C#
//! - Ring Buffer per latenza nanosecondi
//! - Hot-reload dizionari senza riavvio

pub mod shared_memory_ipc;
pub mod dictionary_engine;
pub mod protocol;

pub use shared_memory_ipc::TranslationBridge;
