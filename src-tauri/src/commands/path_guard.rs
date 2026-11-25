//! Guardia comune per i comandi che scrivono, cancellano o avviano file su
//! percorsi passati dal frontend.
//!
//! La webview può chiamare qualsiasi comando registrato: senza questi controlli
//! un XSS potrebbe scrivere uno script nella cartella Esecuzione automatica,
//! cancellare una cartella di sistema o avviare un interprete. I giochi stanno
//! ovunque (anche sotto Program Files), quindi non c'è una lista di cartelle
//! permesse: si escludono i percorsi di sistema, quelli che si avviano da soli
//! e i tipi di file che Windows esegue come script.

use std::path::{Component, Path, PathBuf};

/// Estensioni che Windows esegue o interpreta direttamente. Nessun gioco ha
/// bisogno che GameStringer le scriva.
const BLOCKED_WRITE_EXTENSIONS: &[&str] = &[
    "bat", "cmd", "com", "pif", "scr", "ps1", "psm1", "psd1", "vbs", "vbe", "wsf", "wsh", "hta",
    "lnk", "url", "reg", "msi", "msp", "cpl", "inf",
];

fn lower(p: &Path) -> String {
    p.to_string_lossy().replace('/', "\\").to_lowercase()
}

/// Rifiuta percorsi relativi e con `..`: tutto ciò che arriva dalla UI deve
/// essere un percorso assoluto già risolto.
fn require_absolute_plain(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err(format!("Percorso non assoluto rifiutato: {}", path.display()));
    }
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(format!("Percorso con '..' rifiutato: {}", path.display()));
    }
    Ok(())
}

/// Cartelle in cui GameStringer non deve mai scrivere né cancellare.
fn protected_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    for var in ["SystemRoot", "windir"] {
        if let Ok(v) = std::env::var(var) {
            roots.push(PathBuf::from(v));
        }
    }
    if let Ok(pd) = std::env::var("ProgramData") {
        roots.push(PathBuf::from(&pd).join("Microsoft"));
    }
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".ssh"));
        roots.push(home.join(".gnupg"));
        roots.push(home.join("AppData").join("Roaming").join("Microsoft"));
        roots.push(home.join("AppData").join("Local").join("Microsoft"));
    }
    #[cfg(not(windows))]
    {
        for p in ["/etc", "/bin", "/sbin", "/usr", "/boot", "/System", "/Library"] {
            roots.push(PathBuf::from(p));
        }
    }
    roots
}

fn is_under(path: &Path, root: &Path) -> bool {
    let p = lower(path);
    let r = lower(root);
    let r = r.trim_end_matches('\\');
    p == r || p.starts_with(&format!("{}\\", r))
}

fn check_not_protected(path: &Path) -> Result<(), String> {
    for root in protected_roots() {
        if is_under(path, &root) {
            return Err(format!("Percorso di sistema protetto: {}", path.display()));
        }
    }
    Ok(())
}

/// Per scrivere un file o creare una cartella.
pub fn ensure_write_allowed(path: &Path) -> Result<(), String> {
    require_absolute_plain(path)?;
    check_not_protected(path)?;
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if BLOCKED_WRITE_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
            return Err(format!("Tipo di file non consentito (.{}): {}", ext, path.display()));
        }
    }
    Ok(())
}

/// Per cancellare un file: stesse regole della scrittura.
pub fn ensure_delete_allowed(path: &Path) -> Result<(), String> {
    ensure_write_allowed(path)
}

/// Per avviare un eseguibile di gioco.
pub fn ensure_launch_allowed(path: &Path) -> Result<(), String> {
    require_absolute_plain(path)?;
    check_not_protected(path)?;
    #[cfg(windows)]
    {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext != "exe" {
            return Err(format!("Si possono avviare solo file .exe: {}", path.display()));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_and_parent_paths() {
        assert!(ensure_write_allowed(Path::new("profiles/x.json")).is_err());
        #[cfg(windows)]
        assert!(ensure_write_allowed(Path::new(r"C:\Games\Foo\..\..\Windows\x.dll")).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn rejects_scripts_and_system_dirs() {
        assert!(ensure_write_allowed(Path::new(r"D:\Games\Foo\run.bat")).is_err());
        assert!(ensure_write_allowed(Path::new(r"D:\Games\Foo\evil.PS1")).is_err());
        let win = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        assert!(ensure_write_allowed(&Path::new(&win).join("System32").join("x.dll")).is_err());
        let home = dirs::home_dir().unwrap();
        let startup = home.join(r"AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\a.exe");
        assert!(ensure_write_allowed(&startup).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn allows_game_files() {
        assert!(ensure_write_allowed(Path::new(r"C:\Program Files (x86)\Steam\steamapps\common\Foo\data.win")).is_ok());
        assert!(ensure_write_allowed(Path::new(r"D:\Games\Foo\BepInEx\plugins\XUnity.dll")).is_ok());
        assert!(ensure_write_allowed(Path::new(r"D:\Games\Foo\www\js\plugins.js")).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn launch_only_exe_outside_system() {
        assert!(ensure_launch_allowed(Path::new(r"D:\Games\Foo\Foo.exe")).is_ok());
        assert!(ensure_launch_allowed(Path::new(r"D:\Games\Foo\run.bat")).is_err());
        let win = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        assert!(ensure_launch_allowed(&Path::new(&win).join(r"System32\cmd.exe")).is_err());
    }
}
