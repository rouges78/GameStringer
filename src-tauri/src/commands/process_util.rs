//! Helper per spawnare processi figlio senza flash di console su Windows.
//!
//! Su Windows, spawnare un processo figlio di tipo console (cmd, powershell,
//! wmic, nvidia-smi, ecc.) senza il flag `CREATE_NO_WINDOW` fa apparire
//! momentaneamente una finestra cmd nera. Quando il codice Rust invoca molti
//! di questi spawn in polling (p. es. get_system_stats) o in sequenza, si
//! produce un flash loop fastidioso e — nei casi peggiori — rubare il focus.
//!
//! Questo modulo espone `no_window_command` che restituisce un
//! `std::process::Command` con i `creation_flags` già impostati su Windows
//! e invariato su altre piattaforme.

use std::ffi::OsStr;
use std::process::Command;

/// Flag Win32 `CREATE_NO_WINDOW` (vedi WinBase.h).
#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Costruisce un `Command` che, su Windows, non mostra la finestra della
/// console figlia.
///
/// Su piattaforme non-Windows è un alias diretto a `Command::new`.
pub fn no_window_command<S: AsRef<OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
