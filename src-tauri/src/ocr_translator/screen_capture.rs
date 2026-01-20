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

/// Cattura una finestra specifica (usando posizione schermo per giochi DirectX)
#[cfg(target_os = "windows")]
pub fn capture_window(hwnd: isize) -> Result<ImageData, String> {
    use std::mem::zeroed;
    use std::ffi::c_void;
    
    #[link(name = "user32")]
    extern "system" {
        fn GetDC(hwnd: *mut c_void) -> *mut c_void;
        fn ReleaseDC(hwnd: *mut c_void, hdc: *mut c_void) -> i32;
        fn GetWindowRect(hwnd: *mut c_void, rect: *mut Rect) -> i32;
    }
    
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
        
        // BitBlt dalla posizione della finestra sullo schermo
        BitBlt(mem_dc, 0, 0, width, height, screen_dc, x, y, SRCCOPY);
        
        let mut info: BitmapInfo = zeroed();
        info.header.size = std::mem::size_of::<BitmapInfoHeader>() as u32;
        info.header.width = width;
        info.header.height = -height;
        info.header.planes = 1;
        info.header.bit_count = 32;
        info.header.compression = BI_RGB;
        
        let buffer_size = (width * height * 4) as usize;
        let mut buffer: Vec<u8> = vec![0; buffer_size];
        
        let result = GetDIBits(
            mem_dc,
            bitmap,
            0,
            height as u32,
            buffer.as_mut_ptr(),
            &mut info,
            DIB_RGB_COLORS,
        );
        
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
