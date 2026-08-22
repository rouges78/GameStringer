//! Lettura dei fotogrammi che gs-hook pubblica in memoria condivisa.
//!
//! LA CONTROPARTE È `gs-hook/include/gs_frame_share.h`. Quel file è il
//! contratto; qui c'è il lettore. Se là cambia un campo, qui va cambiato lo
//! stesso, e `VERSIONE` serve a far fallire in modo esplicito chi se ne
//! dimentica invece di leggere byte a caso come pixel.
//!
//! PERCHÉ ESISTE. La cattura dallo schermo prende ciò che è composito alle
//! coordinate della finestra: puntando a un gioco ha restituito i pixel di un
//! browser che gli stava davanti (vedi `docs/METODI-DI-TRADUZIONE.md`). Qui i
//! pixel arrivano da dentro il gioco, presi nel punto in cui consegna il
//! fotogramma finito: coperta, minimizzata o fuori dallo schermo, la finestra
//! non fa differenza.
//!
//! I DUE LATI NASCONO INSIEME. Questo repository ha già collezionato IPC in cui
//! mancava un capo — memoria condivisa senza lettore, pipe di richiesta senza
//! risposta — ed è il motivo per cui la catena in-game è rimasta ferma a lungo.
//! Il test in fondo scrive una mappatura con lo stesso formato del produttore e
//! la rilegge con questo lettore: se i due si disallineano, fallisce.

use serde::{Deserialize, Serialize};

/// Deve combaciare con `gs::frame::kMagic` ('G','S','F','R' in little-endian).
const MAGIC: u32 = 0x5246_5347;
/// Deve combaciare con `gs::frame::kVersione`.
const VERSIONE: u32 = 1;
/// Deve combaciare con `gs::frame::kOffsetPixel`.
const OFFSET_PIXEL: usize = 64;
/// Deve combaciare con `gs::frame::kFormatoBGRA32`.
const FORMATO_BGRA32: u32 = 0;

/// Quanti giri fare quando si legge durante una scrittura. Il produttore scrive
/// una volta ogni ~100 ms e la copia dura microsecondi, quindi due tentativi
/// bastano ampiamente; il tetto esiste perché un produttore morto a metà
/// scrittura lascerebbe il contatore dispari per sempre, e un ciclo senza
/// uscita bloccherebbe il backend.
const MAX_TENTATIVI: u32 = 8;

#[derive(Debug, Serialize, Deserialize)]
pub struct GameFrame {
    /// PNG in base64, come `CaptureResult` altrove: è il formato che il
    /// frontend già consuma.
    pub image_data: String,
    pub width: u32,
    pub height: u32,
    /// Contatore di pubblicazione. Chi ripete la lettura lo usa per sapere se
    /// il fotogramma è nuovo senza confrontare i pixel.
    pub sequence: u64,
}

/// Intestazione letta dalla memoria condivisa.
#[derive(Debug)]
struct Intestazione {
    larghezza: u32,
    altezza: u32,
    byte_fotogramma: u32,
}

/// Legge i campi fissi. Separata dal resto perché è pura aritmetica su byte, e
/// così il test la esercita senza toccare Windows.
fn leggi_intestazione(testa: &[u8]) -> Result<Intestazione, String> {
    if testa.len() < OFFSET_PIXEL {
        return Err("intestazione troncata".into());
    }
    let u32a = |off: usize| {
        u32::from_le_bytes([testa[off], testa[off + 1], testa[off + 2], testa[off + 3]])
    };

    let magic = u32a(0);
    if magic != MAGIC {
        // Anche il caso «tutti zero» finisce qui: è la mappatura in fase di
        // creazione o già smontata, e va trattata come non pronta, non come
        // dati validi.
        return Err(format!("magic {magic:#010x} inatteso: nessun fotogramma pubblicato"));
    }
    let versione = u32a(4);
    if versione != VERSIONE {
        return Err(format!(
            "versione {versione} non supportata (attesa {VERSIONE}): gs-hook e backend disallineati"
        ));
    }
    let larghezza = u32a(8);
    let altezza = u32a(12);
    let formato = u32a(16);
    let byte_fotogramma = u32a(20);

    if formato != FORMATO_BGRA32 {
        return Err(format!("formato {formato} non supportato"));
    }
    if larghezza == 0 || altezza == 0 {
        return Err("dimensioni nulle".into());
    }
    // Il conto deve tornare: un `byte_fotogramma` incoerente sarebbe un
    // puntatore sbagliato mascherato da immagine.
    let attesi = (larghezza as u64) * (altezza as u64) * 4;
    if attesi != byte_fotogramma as u64 {
        return Err(format!(
            "byte incoerenti: {byte_fotogramma} dichiarati, {attesi} implicati da {larghezza}x{altezza}"
        ));
    }
    Ok(Intestazione { larghezza, altezza, byte_fotogramma })
}

/// Converte i byte che dà GDI in un PNG base64.
///
/// IL QUARTO BYTE NON È ALPHA. Le DIB a 32 bit di GDI sono BGR**X**: il quarto
/// byte è riempimento e resta a zero. Trattarlo come alpha produce un PNG
/// interamente trasparente — misurato: 5180 pixel col colore giusto e **zero**
/// pixel con alpha diverso da zero, cioè un'immagine corretta e invisibile. Il
/// trasporto sembrava funzionare (sequenza che avanza, uscita 0, PNG di 16 KB)
/// e consegnava un rettangolo vuoto. Qui l'opacità si impone.
fn bgra_in_png_base64(bgra: &[u8], larghezza: u32, altezza: u32) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::ImageOutputFormat;
    use std::io::Cursor;

    let mut rgba = bgra.to_vec();
    for p in rgba.chunks_exact_mut(4) {
        p.swap(0, 2); // BGRX -> RGBX
        p[3] = 255;   // X -> alpha opaco
    }
    let buf = image::RgbaImage::from_raw(larghezza, altezza, rgba)
        .ok_or_else(|| "dimensioni incoerenti col buffer".to_string())?;
    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(buf)
        .write_to(&mut Cursor::new(&mut png), ImageOutputFormat::Png)
        .map_err(|e| format!("png encode: {e}"))?;
    Ok(STANDARD.encode(&png))
}

#[cfg(windows)]
mod win {
    use super::*;
    use std::ffi::c_void;

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenFileMappingW(access: u32, inherit: i32, name: *const u16) -> *mut c_void;
        fn MapViewOfFile(h: *mut c_void, access: u32, hi: u32, lo: u32, bytes: usize) -> *mut c_void;
        fn UnmapViewOfFile(base: *const c_void) -> i32;
        fn CloseHandle(h: *mut c_void) -> i32;
    }
    const FILE_MAP_READ: u32 = 0x0004;

    /// Chiude mappatura e vista anche se si esce per errore: senza questo, ogni
    /// lettura fallita lascerebbe un handle aperto nel backend, e il backend è
    /// un processo che vive quanto l'applicazione.
    struct Vista {
        handle: *mut c_void,
        base: *mut c_void,
    }
    impl Drop for Vista {
        fn drop(&mut self) {
            unsafe {
                if !self.base.is_null() {
                    UnmapViewOfFile(self.base);
                }
                if !self.handle.is_null() {
                    CloseHandle(self.handle);
                }
            }
        }
    }

    pub fn nome_mappatura(pid: u32) -> Vec<u16> {
        format!("Local\\gs-hook-frame-{pid}\0").encode_utf16().collect()
    }

    /// Scorre i processi vivi e tiene quelli che hanno la mappatura aperta.
    ///
    /// `OpenFileMapping` è il test: o il nome esiste o no, senza mappare niente
    /// e senza toccare il processo. Costa una manciata di chiamate di sistema
    /// per processo, una volta all'avvio della traduzione — non è un ciclo
    /// caldo.
    pub fn elenca_pubblicanti() -> Vec<PublishingGame> {
        use std::ffi::c_void;

        #[repr(C)]
        struct ProcessEntry32W {
            dw_size: u32,
            cnt_usage: u32,
            th32_process_id: u32,
            th32_default_heap_id: usize,
            th32_module_id: u32,
            cnt_threads: u32,
            th32_parent_process_id: u32,
            pc_pri_class_base: i32,
            dw_flags: u32,
            sz_exe_file: [u16; 260],
        }

        #[link(name = "kernel32")]
        extern "system" {
            fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> *mut c_void;
            fn Process32FirstW(snap: *mut c_void, entry: *mut ProcessEntry32W) -> i32;
            fn Process32NextW(snap: *mut c_void, entry: *mut ProcessEntry32W) -> i32;
        }
        const TH32CS_SNAPPROCESS: u32 = 0x0000_0002;
        const INVALID: isize = -1;

        let mut trovati = Vec::new();
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snap.is_null() || snap as isize == INVALID {
                return trovati;
            }
            let mut entry: ProcessEntry32W = std::mem::zeroed();
            entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;

            if Process32FirstW(snap, &mut entry) != 0 {
                loop {
                    let pid = entry.th32_process_id;
                    if pid != 0 {
                        let nome = nome_mappatura(pid);
                        let h = OpenFileMappingW(FILE_MAP_READ, 0, nome.as_ptr());
                        if !h.is_null() {
                            CloseHandle(h);
                            let fine = entry
                                .sz_exe_file
                                .iter()
                                .position(|&c| c == 0)
                                .unwrap_or(entry.sz_exe_file.len());
                            trovati.push(PublishingGame {
                                pid,
                                process_name: String::from_utf16_lossy(&entry.sz_exe_file[..fine]),
                            });
                        }
                    }
                    if Process32NextW(snap, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snap);
        }
        trovati
    }

    pub fn leggi(pid: u32) -> Result<GameFrame, String> {
        let nome = nome_mappatura(pid);
        let vista = unsafe {
            let handle = OpenFileMappingW(FILE_MAP_READ, 0, nome.as_ptr());
            if handle.is_null() {
                return Err(format!(
                    "nessun fotogramma condiviso per il PID {pid}: gs-hook non è iniettato, \
                     oppure gira senza GS_HOOK_FRAME_SHARE=1"
                ));
            }
            let base = MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0);
            if base.is_null() {
                CloseHandle(handle);
                return Err("MapViewOfFile fallita".into());
            }
            Vista { handle, base }
        };

        // L'intestazione dice quanto è grande il fotogramma; la si legge prima
        // di toccare i pixel.
        let testa = unsafe { std::slice::from_raw_parts(vista.base as *const u8, OFFSET_PIXEL) };
        let h = leggi_intestazione(testa)?;

        let totale = OFFSET_PIXEL + h.byte_fotogramma as usize;
        let tutto = unsafe { std::slice::from_raw_parts(vista.base as *const u8, totale) };
        let contatore = unsafe {
            &*((vista.base as *const u8).add(24) as *const std::sync::atomic::AtomicU64)
        };

        // Lettura in stile seqlock. Senza, si può prendere metà del fotogramma
        // vecchio e metà del nuovo: il risultato SEMBRA un'immagine, quindi
        // l'errore non si vede. È lo stesso modo di sbagliare che questo
        // progetto ha già incontrato — un risultato plausibile e falso.
        use std::sync::atomic::Ordering;
        for _ in 0..MAX_TENTATIVI {
            let prima = contatore.load(Ordering::Acquire);
            if prima % 2 != 0 {
                std::thread::yield_now();
                continue; // scrittura in corso
            }
            let pixel = tutto[OFFSET_PIXEL..totale].to_vec();
            let dopo = contatore.load(Ordering::Acquire);
            if prima == dopo {
                if prima == 0 {
                    return Err("nessun fotogramma ancora pubblicato".into());
                }
                return Ok(GameFrame {
                    image_data: bgra_in_png_base64(&pixel, h.larghezza, h.altezza)?,
                    width: h.larghezza,
                    height: h.altezza,
                    sequence: prima,
                });
            }
            std::thread::yield_now();
        }
        Err("il fotogramma cambia più in fretta di quanto si riesca a leggerlo".into())
    }
}

/// Un gioco che sta pubblicando fotogrammi in questo momento.
#[derive(Debug, Serialize, Deserialize)]
pub struct PublishingGame {
    pub pid: u32,
    pub process_name: String,
}

/// Elenca i processi che hanno una mappatura di fotogrammi aperta.
///
/// PERCHÉ ESISTE. Il percorso OCR ha bisogno di sapere DA QUALE gioco prendere
/// i fotogrammi, e la pagina di traduzione live non ha alcun contesto di gioco:
/// l'utente sceglie le lingue e preme avvia. Le alternative erano chiedere il
/// nome del processo all'utente — un campo in dodici lingue per un'informazione
/// che il sistema può ricavare — oppure indovinare. Qui si guarda: si prova ad
/// aprire `Local\gs-hook-frame-<pid>` per ogni processo vivo, e chi risponde
/// sta pubblicando davvero.
///
/// Ritorna l'ELENCO, non «il gioco». La scelta fra più candidati la fa il
/// chiamante, e la scelta giusta con due candidati è non sceglierne nessuno:
/// prendere il primo significherebbe tradurre in silenzio il gioco sbagliato,
/// che è il difetto da cui è nata tutta questa parte del codice.
#[tauri::command]
pub fn list_publishing_games() -> Vec<PublishingGame> {
    #[cfg(windows)]
    {
        win::elenca_pubblicanti()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

/// Legge l'ultimo fotogramma pubblicato dal gioco con questo nome di processo.
///
/// Prende il NOME e non il PID perché è così che il resto del flusso identifica
/// un gioco: `inject_gs_hook` e `gs_hook_status` ricevono entrambi
/// `process_name`, e il PID non esce mai da Rust. Farlo passare per la UI
/// significherebbe tenerci uno stato che si può disallineare — il gioco si
/// riavvia, il PID cambia, e l'interfaccia continuerebbe a chiedere fotogrammi
/// a un processo che non c'è più.
#[tauri::command]
pub fn read_game_frame(process_name: String) -> Result<GameFrame, String> {
    #[cfg(windows)]
    {
        let pid = crate::commands::gs_hook_injector::find_process_by_name(&process_name)
            .ok_or_else(|| format!("processo «{process_name}» non in esecuzione"))?;
        win::leggi(pid)
    }
    #[cfg(not(windows))]
    {
        let _ = process_name;
        Err("i fotogrammi condivisi esistono solo su Windows".into())
    }
}

#[cfg(test)]
mod test {
    use super::*;

    /// Costruisce un'intestazione valida, come la scrive il produttore C++.
    fn testa(larghezza: u32, altezza: u32, magic: u32, versione: u32) -> Vec<u8> {
        let mut b = vec![0u8; OFFSET_PIXEL];
        let mut put = |off: usize, v: u32| b[off..off + 4].copy_from_slice(&v.to_le_bytes());
        put(0, magic);
        put(4, versione);
        put(8, larghezza);
        put(12, altezza);
        put(16, FORMATO_BGRA32);
        put(20, larghezza * altezza * 4);
        b
    }

    #[test]
    fn intestazione_valida_si_legge() {
        let h = leggi_intestazione(&testa(320, 240, MAGIC, VERSIONE)).unwrap();
        assert_eq!((h.larghezza, h.altezza), (320, 240));
        assert_eq!(h.byte_fotogramma, 320 * 240 * 4);
    }

    /// Il caso «mappatura appena creata» o «già smontata»: tutto zero. Va
    /// rifiutato, non interpretato come un fotogramma 0x0.
    #[test]
    fn buffer_azzerato_e_rifiutato() {
        assert!(leggi_intestazione(&vec![0u8; OFFSET_PIXEL]).is_err());
    }

    /// Il motivo per cui la versione esiste: un gs-hook aggiornato accanto a un
    /// backend vecchio deve fallire dicendolo, non leggere byte a caso.
    #[test]
    fn versione_diversa_e_rifiutata() {
        let e = leggi_intestazione(&testa(320, 240, MAGIC, VERSIONE + 1)).unwrap_err();
        assert!(e.contains("disallineati"), "{e}");
    }

    #[test]
    fn magic_sbagliato_e_rifiutato() {
        assert!(leggi_intestazione(&testa(320, 240, 0xDEAD_BEEF, VERSIONE)).is_err());
    }

    /// Un `byte_fotogramma` che non torna coi lati sarebbe un puntatore
    /// sbagliato travestito da immagine.
    #[test]
    fn byte_incoerenti_col_formato_sono_rifiutati() {
        let mut b = testa(320, 240, MAGIC, VERSIONE);
        b[20..24].copy_from_slice(&1234u32.to_le_bytes());
        let e = leggi_intestazione(&b).unwrap_err();
        assert!(e.contains("incoerenti"), "{e}");
    }

    #[test]
    fn intestazione_troncata_e_rifiutata() {
        assert!(leggi_intestazione(&[0u8; 8]).is_err());
    }

    /// I byte arrivano nell'ordine di GDI: il blu è il primo. Se la conversione
    /// saltasse lo scambio, l'immagine uscirebbe con rosso e blu invertiti —
    /// plausibile a vedersi, e sbagliata.
    ///
    /// NOTA SUL QUARTO BYTE: qui vale **zero**, come lo lascia GDI, non 255. La
    /// versione precedente di questo test passava 255 e quindi non poteva
    /// accorgersi che il codice lo copiasse tal quale: un test che concorda col
    /// codice invece di verificarlo. Il fotogramma consegnato era infatti
    /// interamente trasparente.
    #[test]
    fn bgrx_diventa_png_opaco_coi_colori_giusti() {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        // rosso puro come lo dà GDI: B=0, G=0, R=255, X=0
        let png_b64 = bgra_in_png_base64(&[0, 0, 255, 0], 1, 1).unwrap();
        let png = STANDARD.decode(png_b64).unwrap();
        let img = image::load_from_memory(&png).unwrap().to_rgba8();
        assert_eq!(img.dimensions(), (1, 1));
        assert_eq!(
            img.get_pixel(0, 0).0,
            [255, 0, 0, 255],
            "atteso rosso OPACO: con alpha 0 l'immagine sarebbe corretta e invisibile"
        );
    }

    /// Un fotogramma intero non deve avere nemmeno un pixel trasparente: è la
    /// forma generale del difetto misurato, dove 5180 pixel avevano il colore
    /// giusto e nessuno era visibile.
    #[test]
    fn nessun_pixel_resta_trasparente() {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let bgrx = vec![0u8; 4 * 16 * 16]; // tutto zero, alpha compreso
        let png = STANDARD.decode(bgra_in_png_base64(&bgrx, 16, 16).unwrap()).unwrap();
        let img = image::load_from_memory(&png).unwrap().to_rgba8();
        assert!(img.pixels().all(|p| p.0[3] == 255), "trovati pixel trasparenti");
    }

    #[cfg(windows)]
    #[test]
    fn il_nome_della_mappatura_combacia_col_produttore() {
        // Deve essere identico a `kPrefissoNome` + pid in gs_frame_share.h.
        let n = win::nome_mappatura(1234);
        let s = String::from_utf16_lossy(&n[..n.len() - 1]);
        assert_eq!(s, "Local\\gs-hook-frame-1234");
    }
}
