use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureResult {
    pub image_data: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowInfo {
    pub title: String,
    pub id: u32,
}

#[command]
pub fn check_screen_capture_available() -> bool {
    // Screen capture richiede implementazione nativa Windows
    // Per ora restituisce false, il frontend userà getDisplayMedia
    false
}

#[command]
pub fn get_monitors() -> Vec<MonitorInfo> {
    // Restituisce monitor di default
    // L'implementazione completa richiede windows-rs crate
    vec![MonitorInfo {
        id: 0,
        name: "Primary Monitor".to_string(),
        width: 1920,
        height: 1080,
        is_primary: true,
    }]
}

#[command]
pub fn capture_screen(
    _x: u32,
    _y: u32,
    _width: u32,
    _height: u32,
    _monitor: u32,
) -> Result<CaptureResult, String> {
    // L'implementazione completa richiede windows-rs crate con feature "Win32_Graphics_Gdi"
    // Per ora il frontend usa getDisplayMedia come fallback
    Err("Native screen capture not available. Using browser fallback.".to_string())
}

#[command]
pub fn get_windows() -> Vec<WindowInfo> {
    // L'implementazione completa richiede windows-rs crate
    vec![]
}

/// Cattura la finestra il cui titolo contiene `window_title`.
///
/// Era un `Err` fisso, quindi `lib/ocr/screen-capture.ts` non ha mai potuto
/// catturare una finestra: restava solo la cattura per area, che copia i pixel
/// di chiunque stia davanti. Qui si delega all'implementazione vera in
/// `ocr_translator::screen_capture`, che chiede alla finestra di disegnarsi e
/// si rifiuta di restituire i pixel di un'altra.
///
/// Il confronto sul titolo è per sottostringa senza distinzione di maiuscole,
/// come già fa il resto del selettore finestre. Se combaciano più finestre si
/// elencano invece di sceglierne una a caso: prendere la prima farebbe
/// catturare in silenzio quella sbagliata, cioè di nuovo il difetto di partenza.
#[command]
pub fn capture_window(window_title: String) -> Result<CaptureResult, String> {
    use crate::ocr_translator::screen_capture;

    let ago = window_title.to_lowercase();
    let candidate: Vec<_> = screen_capture::list_windows()
        .into_iter()
        .filter(|w| w.title.to_lowercase().contains(&ago))
        .collect();

    let finestra = match candidate.len() {
        0 => return Err(format!("nessuna finestra con «{}» nel titolo", window_title)),
        1 => &candidate[0],
        _ => {
            let titoli: Vec<_> = candidate.iter().map(|w| w.title.as_str()).collect();
            return Err(format!(
                "«{}» corrisponde a {} finestre ({}): serve un titolo più preciso",
                window_title,
                candidate.len(),
                titoli.join(" · ")
            ));
        }
    };

    let img = screen_capture::capture_window(finestra.hwnd)?;

    // Stessa conversione di `capture_screen_region` e `read_game_frame`: una
    // sola implementazione, in Rust, che sa che il quarto byte di GDI non e'
    // alpha. Prima questa era una copia a se' stante.
    let image_data = screen_capture::to_png_base64(&img)?;

    Ok(CaptureResult {
        image_data,
        width: img.width,
        height: img.height,
    })
}
