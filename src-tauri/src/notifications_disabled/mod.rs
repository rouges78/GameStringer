pub mod models;
pub mod storage;
pub mod errors;
pub mod manager;
pub mod cleanup;
pub mod profile_integration;
pub mod access_control;
pub mod profile_event_handler;
pub mod event_system;
pub mod auto_event_integration;
pub mod system_event_handler;
pub mod system_event_integration;
pub mod performance;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod cleanup_tests;

#[cfg(test)]
mod profile_isolation_tests;

#[cfg(test)]
mod integration_test;

#[cfg(test)]
mod event_system_tests;

#[cfg(test)]
mod system_event_tests;

#[cfg(test)]
mod manager_tests;

#[cfg(test)]
mod storage_tests;

#[cfg(test)]
mod profile_integration_tests;

#[cfg(test)]
mod validation_tests;

pub use models::*;
pub use storage::*;
pub use errors::*;
pub use manager::*;
pub use cleanup::*;
pub use profile_integration::*;
pub use access_control::*;
pub use profile_event_handler::*;
pub use event_system::*;
pub use auto_event_integration::*;
pub use system_event_handler::*;
pub use system_event_integration::*;
pub use performance::*;