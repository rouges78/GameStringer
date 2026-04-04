//! GameStringer Translation Bridge
//!
//! IPC cross-process per traduzione in-game via shared memory:
//! - Named File Mapping (Windows) per comunicazione zero-copy con il plugin C#
//! - Ring buffer lock-free a 1024 slot con adaptive polling
//! - Dictionary engine O(1) con hot-reload senza riavvio
//! - Supporto multi-lingua con switch a caldo

pub mod dictionary_engine;
pub mod protocol;
#[cfg(windows)]
pub mod shared_memory_ipc;

#[cfg(windows)]
pub use shared_memory_ipc::TranslationBridge;
