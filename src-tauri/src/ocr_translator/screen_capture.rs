// Screen Capture Module - Windows DXGI/GDI

use super::CaptureRegion;
use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use std::ptr::null_mut;

#[derive(Clone)]
pub struct ImageData {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>, // BGRA format
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub class_name: String,
}

/// Lista delle finestre visibili
#[cfg(target_os = "windows")]
pub fn list_windows() -> Vec<WindowInfo> {
    use std::ffi::c_void;
    use std::sync::Mutex;
    use once_cell::sync::Lazy;
    
    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(callback: extern "system" fn(*mut c_void, isize) -> i32, lparam: isize) -> i32;
        fn IsWindowVisible(hwnd: *mut c_void) -> i32;
        fn GetWindowTextW(hwnd: *mut c_void, text: *mut u16, max: i32) -> i32;
        fn GetClassNameW(hwnd: *mut c_void, text: *mut u16, max: i32) -> i32;
        fn GetWindowTextLengthW(hwnd: *mut c_void) -> i32;
        fn GetClientRect(hwnd: *mut c_void, rect: *mut ClientRect) -> i32;
    }

    #[repr(C)]
    struct ClientRect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    static WINDOWS: Lazy<Mutex<Vec<WindowInfo>>> = Lazy::new(|| Mutex::new(Vec::new()));
    
    extern "system" fn enum_callback(hwnd: *mut c_void, _: isize) -> i32 {
        unsafe {
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }
            
            let text_len = GetWindowTextLengthW(hwnd);
            if text_len == 0 {
                return 1;
            }
            
            let mut title_buf: Vec<u16> = vec![0; (text_len + 1) as usize];
            GetWindowTextW(hwnd, title_buf.as_mut_ptr(), text_len + 1);
            let title = String::from_utf16_lossy(&title_buf).trim_end_matches('\0').to_string();
            
            let mut class_buf: Vec<u16> = vec![0; 256];
            GetClassNameW(hwnd, class_buf.as_mut_ptr(), 256);
            let class_name = String::from_utf16_lossy(&class_buf).trim_end_matches('\0').to_string();
            
            if title.is_empty() || title == "Program Manager" || class_name == "Progman" {
                return 1;
            }

            // Scarta le finestre senza area client: non hanno niente da
            // catturare e — peggio — rubano il nome a quella vera.
            //
            // Misurato su Yume Nikki (RPG_RT, 22/08/2026). Il processo espone
            // DUE finestre di primo livello con lo STESSO titolo:
            //
            //   TApplication      client 0×0     ← fantasma di Delphi/VCL
            //   TFormLcfGameMain  client 644×484 ← il gioco
            //
            // Senza questo filtro il selettore ne mostra due identiche e la
            // ricerca per titolo può risolvere sul fantasma: la cattura non
            // fallisce, restituisce un riquadro vuoto. Ogni app Delphi ha
            // questa finestra, quindi non è un caso particolare di un gioco.
            let mut client: ClientRect = std::mem::zeroed();
            GetClientRect(hwnd, &mut client);
            if client.right - client.left <= 0 || client.bottom - client.top <= 0 {
                return 1;
            }

            if let Ok(mut wins) = WINDOWS.lock() {
                wins.push(WindowInfo {
                    hwnd: hwnd as isize,
                    title,
                    class_name,
                });
            }
            
            1
        }
    }
    
    if let Ok(mut wins) = WINDOWS.lock() {
        wins.clear();
    }
    
    unsafe {
        EnumWindows(enum_callback, 0);
    }
    
    WINDOWS.lock().map(|w| w.clone()).unwrap_or_default()
}

/// Vero se l'AREA CLIENT è interamente nera, cioè la finestra non ha reso
/// il proprio contenuto.
///
/// Deve guardare solo il client, non tutta la finestra: `PrintWindow` rende
/// SEMPRE la cornice — barra del titolo, bordi — anche quando il contenuto
/// manca del tutto. Misurato sulla finestra fantasma `TApplication` di Yume
/// Nikki: client nero e barra del titolo bianca, cioè 6,6% di pixel accesi. Un
/// controllo sul fotogramma intero la dichiarava «resa» e non ripiegava mai.
/// Sulla finestra VERA del gioco il contenuto c'è invece davvero: 12,1%.
pub(crate) fn client_vuoto(buf: &[u8], larghezza: i32, ox: i32, oy: i32, cw: i32, ch: i32) -> bool {
    if cw <= 0 || ch <= 0 {
        return true;
    }
    for riga in oy.max(0)..(oy + ch) {
        let inizio = ((riga * larghezza + ox.max(0)) * 4) as usize;
        let fine = inizio + (cw * 4) as usize;
        if fine > buf.len() {
            break;
        }
        if buf[inizio..fine]
            .chunks_exact(4)
            .any(|p| p[0] != 0 || p[1] != 0 || p[2] != 0)
        {
            return false;
        }
    }
    true
}

/// Converte un fotogramma catturato in un PNG codificato in base64.
///
/// UNA SOLA CONVERSIONE, USATA DA TUTTI. Prima ce n'erano due: `capture_window`
/// codificava in Rust, mentre `capture_screen_region` restituiva i pixel grezzi
/// e li faceva ricomporre al frontend a mano, in un canvas. Quel secondo
/// percorso passava **otto milioni e ottocentomila numeri** attraverso l'IPC per
/// ogni fotogramma, ed e' esattamente dove si era annidato il difetto
/// dell'alpha: la conversione a mano copiava il quarto byte come trasparenza.
///
/// IL QUARTO BYTE NON E' ALPHA. Le DIB a 32 bit di GDI sono BGR**X**: quel byte
/// resta a zero. Copiarlo come alpha da un'immagine corretta nei colori e
/// completamente invisibile — misurato tre volte oggi, in tre punti diversi del
/// codice. Qui l'opacita' si impone una volta per tutte.
pub fn to_png_base64(img: &ImageData) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::ImageOutputFormat;
    use std::io::Cursor;

    let mut rgba = img.data.clone();
    for p in rgba.chunks_exact_mut(4) {
        p.swap(0, 2); // BGRX -> RGBX
        p[3] = 255;   // X -> alpha opaco
    }
    let buf = image::RgbaImage::from_raw(img.width, img.height, rgba)
        .ok_or_else(|| "dimensioni incoerenti col buffer catturato".to_string())?;
    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(buf)
        .write_to(&mut Cursor::new(&mut png), ImageOutputFormat::Png)
        .map_err(|e| format!("png encode: {e}"))?;
    Ok(STANDARD.encode(&png))
}

/// Cattura una finestra specifica.
///
/// PERCHÉ NON BASTA COPIARE DALLO SCHERMO (misurato il 22/08/2026).
/// Questa funzione faceva `BitBlt` dal DC dello schermo alle coordinate della
/// finestra. Ma quel rettangolo di schermo contiene ciò che è *composito* lì
/// sopra, non la finestra: puntando a un gioco, la cattura ha restituito un
/// video di YouTube aperto in Brave davanti. `GetWindowRect` diceva che il
/// gioco era esattamente lì, e i pixel erano di un altro processo. Per un
/// overlay di traduzione è il peggior modo di sbagliare: nessun errore, nessun
/// log, solo la traduzione della finestra sbagliata.
///
/// L'ordine giusto è quindi:
///
///  1. **`PrintWindow`** — si chiede alla finestra di disegnarsi nel NOSTRO DC.
///     Non dipende dall'ordine Z: funziona anche con la finestra coperta o
///     dietro un browser a schermo intero.
///  2. Se `PrintWindow` non produce niente di utile, si ricade sulla copia dallo
///     schermo — che per certe superfici accelerate è l'unica che vede qualcosa
///     — ma **solo dopo aver verificato con `WindowFromPoint` che i pixel siano
///     davvero della finestra richiesta**. Se sono di qualcun altro si ritorna
///     un errore che lo nomina, invece di pixel plausibili e sbagliati.
///
/// Il caso «PrintWindow riesce ma l'immagine è tutta nera» è reale, non
/// difensivo: capita sulle finestre senza contenuto proprio, come la finestra
/// TApplication che ogni app Delphi espone accanto a quella vera.
///
/// CORREZIONE (22/08/2026). Una versione precedente di questo commento diceva
/// che RPG_RT non risponde a WM_PRINT perché disegna con DirectDraw. È falso, ed
/// è misurato: `PrintWindow` su `TFormLcfGameMain` rende per intero la schermata
/// del titolo di Yume Nikki. Il nero veniva dal puntare alla finestra sbagliata
/// — il fantasma `TApplication` con client 0×0 — che ora `list_windows` scarta.
#[cfg(target_os = "windows")]
pub fn capture_window(hwnd: isize) -> Result<ImageData, String> {
    use std::mem::zeroed;
    use std::ffi::c_void;

    #[link(name = "user32")]
    extern "system" {
        fn GetDC(hwnd: *mut c_void) -> *mut c_void;
        fn ReleaseDC(hwnd: *mut c_void, hdc: *mut c_void) -> i32;
        fn GetWindowRect(hwnd: *mut c_void, rect: *mut Rect) -> i32;
        fn PrintWindow(hwnd: *mut c_void, hdc: *mut c_void, flags: u32) -> i32;
        fn WindowFromPoint(point: Point) -> *mut c_void;
        fn GetAncestor(hwnd: *mut c_void, flags: u32) -> *mut c_void;
        fn GetWindowTextW(hwnd: *mut c_void, text: *mut u16, max: i32) -> i32;
        fn GetClientRect(hwnd: *mut c_void, rect: *mut Rect) -> i32;
        fn ClientToScreen(hwnd: *mut c_void, point: *mut Point) -> i32;
    }

    // POINT passato per valore: due i32 contigui, come da Win32.
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Point {
        x: i32,
        y: i32,
    }

    // PW_RENDERFULLCONTENT: necessario per le finestre composte da DWM, che
    // senza questo flag rispondono con un riquadro vuoto.
    const PW_RENDERFULLCONTENT: u32 = 0x00000002;
    const GA_ROOT: u32 = 2;

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(hdc: *mut c_void) -> *mut c_void;
        fn CreateCompatibleBitmap(hdc: *mut c_void, width: i32, height: i32) -> *mut c_void;
        fn SelectObject(hdc: *mut c_void, obj: *mut c_void) -> *mut c_void;
        fn BitBlt(dest: *mut c_void, x: i32, y: i32, w: i32, h: i32,
                  src: *mut c_void, sx: i32, sy: i32, rop: u32) -> i32;
        fn GetDIBits(hdc: *mut c_void, bmp: *mut c_void, start: u32, lines: u32,
                     bits: *mut u8, info: *mut BitmapInfo, usage: u32) -> i32;
        fn DeleteObject(obj: *mut c_void) -> i32;
        fn DeleteDC(hdc: *mut c_void) -> i32;
    }
    
    #[repr(C)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }
    
    #[repr(C)]
    struct BitmapInfoHeader {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bit_count: u16,
        compression: u32,
        size_image: u32,
        x_pels_per_meter: i32,
        y_pels_per_meter: i32,
        clr_used: u32,
        clr_important: u32,
    }
    
    #[repr(C)]
    struct BitmapInfo {
        header: BitmapInfoHeader,
        colors: [u32; 1],
    }
    
    const SRCCOPY: u32 = 0x00CC0020;
    const BI_RGB: u32 = 0;
    const DIB_RGB_COLORS: u32 = 0;
    
    unsafe {
        let hwnd_ptr = hwnd as *mut c_void;
        
        // Ottieni posizione finestra sullo schermo
        let mut rect: Rect = zeroed();
        if GetWindowRect(hwnd_ptr, &mut rect) == 0 {
            return Err("Failed to get window rect".to_string());
        }
        
        let x = rect.left;
        let y = rect.top;
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        
        if width <= 0 || height <= 0 {
            return Err("Invalid window dimensions".to_string());
        }
        
        // Cattura dalla posizione dello schermo (funziona con DirectX)
        let screen_dc = GetDC(null_mut());
        if screen_dc.is_null() {
            return Err("Failed to get screen DC".to_string());
        }
        
        let mem_dc = CreateCompatibleDC(screen_dc);
        if mem_dc.is_null() {
            ReleaseDC(null_mut(), screen_dc);
            return Err("Failed to create compatible DC".to_string());
        }
        
        let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
        if bitmap.is_null() {
            DeleteDC(mem_dc);
            ReleaseDC(null_mut(), screen_dc);
            return Err("Failed to create bitmap".to_string());
        }
        
        let old_bitmap = SelectObject(mem_dc, bitmap);

        let mut info: BitmapInfo = zeroed();
        info.header.size = std::mem::size_of::<BitmapInfoHeader>() as u32;
        info.header.width = width;
        info.header.height = -height;
        info.header.planes = 1;
        info.header.bit_count = 32;
        info.header.compression = BI_RGB;

        let buffer_size = (width * height * 4) as usize;
        let mut buffer: Vec<u8> = vec![0; buffer_size];

        // Chiude i handle GDI in ogni uscita, compresi i return anticipati.
        let chiudi = |mem_dc, old_bitmap, bitmap, screen_dc| {
            SelectObject(mem_dc, old_bitmap);
            DeleteObject(bitmap);
            DeleteDC(mem_dc);
            ReleaseDC(null_mut(), screen_dc);
        };

        // ── 1. La finestra disegna sé stessa: non dipende dall'ordine Z ──────
        // Dov'e' l'area client dentro il fotogramma della finestra: serve per
        // giudicare se il CONTENUTO e' stato reso, ignorando la cornice.
        let mut crect: Rect = zeroed();
        GetClientRect(hwnd_ptr, &mut crect);
        let mut origine = Point { x: 0, y: 0 };
        ClientToScreen(hwnd_ptr, &mut origine);
        let (ox, oy) = (origine.x - x, origine.y - y);
        let (cw, ch) = (crect.right - crect.left, crect.bottom - crect.top);

        let mut riuscita = PrintWindow(hwnd_ptr, mem_dc, PW_RENDERFULLCONTENT) != 0
            && GetDIBits(mem_dc, bitmap, 0, height as u32,
                         buffer.as_mut_ptr(), &mut info, DIB_RGB_COLORS) != 0
            && !client_vuoto(&buffer, width, ox, oy, cw, ch);

        // ── 2. Ripiego sulla copia dallo schermo, ma solo se i pixel di quel
        //       rettangolo appartengono davvero a questa finestra ────────────
        if !riuscita {
            let centro = Point { x: x + width / 2, y: y + height / 2 };
            let sopra = GetAncestor(WindowFromPoint(centro), GA_ROOT);
            if !sopra.is_null() && sopra != hwnd_ptr {
                let mut titolo = [0u16; 256];
                let n = GetWindowTextW(sopra, titolo.as_mut_ptr(), 256);
                let nome = if n > 0 {
                    String::from_utf16_lossy(&titolo[..n as usize])
                } else {
                    "(senza titolo)".to_string()
                };
                chiudi(mem_dc, old_bitmap, bitmap, screen_dc);
                return Err(format!(
                    "la finestra è coperta da «{}»: PrintWindow non ha reso nulla e \
                     copiare dallo schermo catturerebbe quella finestra invece di questa. \
                     Portala in primo piano e riprova.",
                    nome
                ));
            }

            BitBlt(mem_dc, 0, 0, width, height, screen_dc, x, y, SRCCOPY);
            riuscita = GetDIBits(mem_dc, bitmap, 0, height as u32,
                                 buffer.as_mut_ptr(), &mut info, DIB_RGB_COLORS) != 0;
        }

        chiudi(mem_dc, old_bitmap, bitmap, screen_dc);

        if !riuscita {
            return Err("Failed to get bitmap bits".to_string());
        }

        Ok(ImageData {
            width: width as u32,
            height: height as u32,
            data: buffer,
        })
    }
}

#[cfg(not(target_os = "windows"))]
pub fn list_windows() -> Vec<WindowInfo> {
    Vec::new()
}

#[cfg(not(target_os = "windows"))]
pub fn capture_window(_hwnd: isize) -> Result<ImageData, String> {
    Err("Window capture supportato solo su Windows".to_string())
}

/// Cattura lo schermo (o una regione specifica)
#[cfg(target_os = "windows")]
pub fn capture_screen(region: &Option<CaptureRegion>) -> Result<ImageData, String> {
    use std::mem::zeroed;
    
    #[link(name = "user32")]
    extern "system" {
        fn GetDC(hwnd: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn ReleaseDC(hwnd: *mut std::ffi::c_void, hdc: *mut std::ffi::c_void) -> i32;
        fn GetSystemMetrics(index: i32) -> i32;
    }
    
    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(hdc: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn CreateCompatibleBitmap(hdc: *mut std::ffi::c_void, width: i32, height: i32) -> *mut std::ffi::c_void;
        fn SelectObject(hdc: *mut std::ffi::c_void, obj: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn BitBlt(dest: *mut std::ffi::c_void, x: i32, y: i32, w: i32, h: i32,
                  src: *mut std::ffi::c_void, sx: i32, sy: i32, rop: u32) -> i32;
        fn GetDIBits(hdc: *mut std::ffi::c_void, bmp: *mut std::ffi::c_void, start: u32, lines: u32,
                     bits: *mut u8, info: *mut BitmapInfo, usage: u32) -> i32;
        fn DeleteObject(obj: *mut std::ffi::c_void) -> i32;
        fn DeleteDC(hdc: *mut std::ffi::c_void) -> i32;
    }
    
    #[repr(C)]
    struct BitmapInfoHeader {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bit_count: u16,
        compression: u32,
        size_image: u32,
        x_pels_per_meter: i32,
        y_pels_per_meter: i32,
        clr_used: u32,
        clr_important: u32,
    }
    
    #[repr(C)]
    struct BitmapInfo {
        header: BitmapInfoHeader,
        colors: [u32; 1],
    }
    
    const SM_CXSCREEN: i32 = 0;
    const SM_CYSCREEN: i32 = 1;
    const SRCCOPY: u32 = 0x00CC0020;
    const BI_RGB: u32 = 0;
    const DIB_RGB_COLORS: u32 = 0;
    
    unsafe {
        // Ottieni dimensioni schermo
        let screen_width = GetSystemMetrics(SM_CXSCREEN);
        let screen_height = GetSystemMetrics(SM_CYSCREEN);
        
        // Calcola regione da catturare
        let (x, y, width, height) = match region {
            Some(r) => (r.x, r.y, r.width, r.height),
            None => (0, 0, screen_width, screen_height),
        };
        
        // Ottieni DC dello schermo
        let screen_dc = GetDC(null_mut());
        if screen_dc.is_null() {
            return Err("Failed to get screen DC".to_string());
        }
        
        // Crea DC compatibile
        let mem_dc = CreateCompatibleDC(screen_dc);
        if mem_dc.is_null() {
            ReleaseDC(null_mut(), screen_dc);
            return Err("Failed to create compatible DC".to_string());
        }
        
        // Crea bitmap compatibile
        let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
        if bitmap.is_null() {
            DeleteDC(mem_dc);
            ReleaseDC(null_mut(), screen_dc);
            return Err("Failed to create bitmap".to_string());
        }
        
        // Seleziona bitmap nel DC
        let old_bitmap = SelectObject(mem_dc, bitmap);
        
        // Copia schermo nel bitmap
        BitBlt(mem_dc, 0, 0, width, height, screen_dc, x, y, SRCCOPY);
        
        // Prepara struttura per GetDIBits
        let mut info: BitmapInfo = zeroed();
        info.header.size = std::mem::size_of::<BitmapInfoHeader>() as u32;
        info.header.width = width;
        info.header.height = -height; // Negativo per top-down
        info.header.planes = 1;
        info.header.bit_count = 32;
        info.header.compression = BI_RGB;
        
        // Alloca buffer per i pixel
        let buffer_size = (width * height * 4) as usize;
        let mut buffer: Vec<u8> = vec![0; buffer_size];
        
        // Ottieni i bit del bitmap
        let result = GetDIBits(
            mem_dc,
            bitmap,
            0,
            height as u32,
            buffer.as_mut_ptr(),
            &mut info,
            DIB_RGB_COLORS,
        );
        
        // Cleanup
        SelectObject(mem_dc, old_bitmap);
        DeleteObject(bitmap);
        DeleteDC(mem_dc);
        ReleaseDC(null_mut(), screen_dc);
        
        if result == 0 {
            return Err("Failed to get bitmap bits".to_string());
        }
        
        Ok(ImageData {
            width: width as u32,
            height: height as u32,
            data: buffer,
        })
    }
}

#[cfg(not(target_os = "windows"))]
pub fn capture_screen(_region: &Option<CaptureRegion>) -> Result<ImageData, String> {
    Err("Screen capture supportato solo su Windows".to_string())
}

/// Cattura l'intero schermo
pub fn capture_fullscreen() -> Result<ImageData, String> {
    capture_screen(&None)
}

/// Cattura una regione specifica dello schermo
pub fn capture_region(x: i32, y: i32, width: i32, height: i32) -> Result<ImageData, String> {
    capture_screen(&Some(CaptureRegion { x, y, width, height }))
}

#[cfg(test)]
mod test_client_vuoto {
    use super::client_vuoto;

    /// Un fotogramma BGRA `w`x`h` nero, con un pixel acceso in (px,py).
    fn frame(w: i32, h: i32, acceso: Option<(i32, i32)>) -> Vec<u8> {
        let mut b = vec![0u8; (w * h * 4) as usize];
        if let Some((px, py)) = acceso {
            b[((py * w + px) * 4) as usize + 1] = 255; // verde
        }
        b
    }

    #[test]
    fn client_tutto_nero_e_vuoto() {
        let b = frame(10, 10, None);
        assert!(client_vuoto(&b, 10, 1, 1, 8, 8));
    }

    #[test]
    fn un_pixel_acceso_nel_client_basta() {
        let b = frame(10, 10, Some((5, 5)));
        assert!(!client_vuoto(&b, 10, 1, 1, 8, 8));
    }

    /// Il caso che la versione precedente sbagliava: la cornice e' resa (barra
    /// del titolo) ma il contenuto no. Guardando tutto il fotogramma sembrava
    /// «reso»; guardando il client e' vuoto, ed e' la risposta giusta.
    #[test]
    fn cornice_accesa_ma_client_vuoto() {
        let b = frame(10, 10, Some((5, 0))); // riga 0 = barra del titolo
        assert!(client_vuoto(&b, 10, 1, 2, 8, 7));
    }

    /// RPG_RT espone una finestra TApplication con client 0x0: senza contenuto
    /// da giudicare, l'unica risposta onesta e' «vuoto», cosi' si ripiega e si
    /// passa dal controllo su chi possiede i pixel.
    #[test]
    fn client_degenere_e_vuoto() {
        let b = frame(10, 10, Some((5, 5)));
        assert!(client_vuoto(&b, 10, 0, 0, 0, 0));
    }

    #[test]
    fn non_esce_dal_buffer_se_il_client_sborda() {
        let b = frame(10, 10, None);
        assert!(client_vuoto(&b, 10, 8, 8, 8, 8)); // niente panico
    }
}
