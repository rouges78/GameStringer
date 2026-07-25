//! Riconoscimento dell'eseguibile del gioco — regole condivise.
//!
//! Storia: un utente ha segnalato che, dopo la traduzione, il pulsante "prova
//! il gioco" **rilanciava GameStringer** invece del gioco. Aveva anche fatto la
//! diagnosi da solo: l'app prendeva il primo `.exe` in ordine alfabetico della
//! cartella, e la sua copia portable di GameStringer stava proprio lì. L'ha
//! dimostrato rinominandola con una `z` iniziale — allora partiva il gioco.
//!
//! `find_executables_in_folder` (games.rs) è stato corretto con punteggio e
//! ordinamento, ma le stesse regole mancavano nei patcher Unreal e GameMaker,
//! che continuavano a prendere il primo `.exe` con un filtro parziale. Qui le
//! regole stanno in un punto solo, così non divergono di nuovo.

/// Eseguibili che non sono MAI il gioco: installer, redistributable,
/// crash handler, launcher — e GameStringer stesso.
pub fn is_junk_executable(file_name: &str) -> bool {
    let lower = file_name.to_lowercase();
    const JUNK: &[&str] = &[
        "unins",        // uninstall / unins000
        "setup",
        "install",
        "redist",
        "vcredist",
        "dxsetup",
        "directx",
        "crash",        // crashhandler, crashpad, crashreport
        "ue4prereq",
        "ueprereq",
        "dotnet",
        "vc_redist",
        "launcher",
        "cmd.exe",
        "gamestringer", // la nostra portable, se copiata nella cartella del gioco
    ];
    JUNK.iter().any(|j| lower.contains(j))
}

/// Punteggio di quanto un eseguibile "sembra" il gioco della cartella.
/// 2 = nome identico alla cartella · 1 = uno contiene l'altro · 0 = altro.
pub fn name_match_score(file_stem: &str, folder_name: &str) -> u8 {
    if folder_name.is_empty() || file_stem.is_empty() {
        return 0;
    }
    let s = file_stem.to_lowercase();
    let f = folder_name.to_lowercase();
    if s == f {
        2
    } else if f.contains(&s) || s.contains(&f) {
        1
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excludes_gamestringer_itself() {
        // Il caso segnalato dall'utente: portable nella cartella del gioco.
        assert!(is_junk_executable("GameStringer.exe"));
        assert!(is_junk_executable("gamestringer-portable.exe"));
        assert!(is_junk_executable("zGameStringer.exe"));
    }

    #[test]
    fn excludes_installers_and_redists() {
        for n in ["unins000.exe", "setup.exe", "vcredist_x64.exe", "DXSETUP.exe",
                  "UE4PrereqSetup_x64.exe", "dotnet-runtime.exe", "Installer.exe"] {
            assert!(is_junk_executable(n), "{n} dovrebbe essere scartato");
        }
    }

    #[test]
    fn excludes_crash_handlers_and_launchers() {
        for n in ["CrashHandler.exe", "crashpad_handler.exe", "CrashReportClient.exe",
                  "Launcher.exe", "GameLauncher.exe"] {
            assert!(is_junk_executable(n), "{n} dovrebbe essere scartato");
        }
    }

    #[test]
    fn keeps_real_game_executables() {
        for n in ["Mouthwashing.exe", "hotline_miami.exe", "CoreKeeper.exe",
                  "Deltarune.exe", "game.exe", "nw.exe"] {
            assert!(!is_junk_executable(n), "{n} NON dovrebbe essere scartato");
        }
    }

    #[test]
    fn is_case_insensitive() {
        assert!(is_junk_executable("UNINS000.EXE"));
        assert!(is_junk_executable("GAMESTRINGER.EXE"));
    }

    #[test]
    fn scores_exact_folder_match_highest() {
        assert_eq!(name_match_score("mouthwashing", "Mouthwashing"), 2);
    }

    #[test]
    fn scores_partial_match() {
        assert_eq!(name_match_score("hotline", "hotline_miami"), 1);
        assert_eq!(name_match_score("hotline_miami_2", "hotline_miami"), 1);
    }

    #[test]
    fn scores_unrelated_as_zero() {
        assert_eq!(name_match_score("config", "Mouthwashing"), 0);
    }

    #[test]
    fn empty_inputs_score_zero() {
        assert_eq!(name_match_score("", "Mouthwashing"), 0);
        assert_eq!(name_match_score("game", ""), 0);
    }
}
