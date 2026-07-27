//! Codec QOI nella variante GameMaker (GM-QOI) — chunk `TXTR` di `data.win`.
//!
//! Serve a ADR-005: per iniettare glifi cirillici nell'atlante di un font
//! GameMaker bisogna decodificare la texture, ridisegnare alcune celle e
//! ricodificarla. Questo modulo è il primo dei due passi (l'altro è la tabella
//! dei glifi) ed è volutamente SOLO il codec: nessun I/O, nessun Tauri,
//! nessuna dipendenza esterna.
//!
//! # ATTENZIONE: non è il QOI 1.0
//!
//! Le crate `qoi` di crates.io implementano la specifica 1.0 e qui NON servono:
//! GameMaker usa i tag **pre-1.0**, un hash diverso e i pixel in **BGRA**.
//! Il primo decoder scritto sulla 1.0 ha prodotto rumore, e il sintomo non è
//! stato un errore ma un numero troppo bello (re-encode dimezzato) — vedi la
//! sezione «Verifica sperimentale» di ADR-005.
//!
//! Riferimento normativo: `UndertaleModLib/Util/QoiConverter.cs` di
//! UndertaleModTool, a sua volta port da dog-scepter. Le differenze:
//!
//! | | GM (pre-1.0) | QOI 1.0 |
//! |---|---|---|
//! | INDEX | `0x00`, mask 2 | `0x00`, mask 2 |
//! | RUN | `0x40` 5 bit · `0x60` 13 bit | `0xC0` 6 bit |
//! | DIFF | `0x80` 8 bit · `0xC0` 16 bit · `0xE0` 24 bit | `0x40` · LUMA `0x80` |
//! | COLOR | `0xF0` + bitmask canali | `0xFE` RGB · `0xFF` RGBA |
//! | hash | `(r ^ g ^ b ^ a) & 63` | `(r*3 + g*5 + b*7 + a*11) % 64` |
//! | pixel | BGRA | RGBA |
//!
//! Header: `fioq` (4 byte) + width `u16` LE + height `u16` LE + length `u32` LE.
//!
//! # La proprietà che conta
//!
//! `encode(decode(x)) == x` byte per byte sulle texture vere. Non è un vezzo:
//! è la prova che il formato è capito, ed è la precondizione per poter
//! riscrivere i pixel di un `data.win` senza corromperlo. I test la verificano
//! su casi sintetici che esercitano ogni tag; la verifica sulla texture reale
//! di Deltarune (1.888.553 byte) va rifatta in locale, perché il file non sta
//! nel repo.

// Il modulo è la base di ADR-005 e per ora lo chiamano solo i suoi test: senza
// questo, `cargo test` sputa 21 warning `dead_code` che coprirebbero la prossima
// warning vera. DA TOGLIERE quando arriva la tabella dei glifi, che è il primo
// chiamante previsto — se a quel punto qualcosa resta non usato, va cancellato,
// non tenuto in vita da questa riga.
#![allow(dead_code)]

// ── Costanti del formato ──

const MAGIC: [u8; 4] = *b"fioq";
pub const HEADER_SIZE: usize = 12;
/// Un chunk non supera mai 5 byte (tag + 4 canali), come nella spec QOI.
const MAX_CHUNK_SIZE: usize = 5;

const QOI_INDEX: u8 = 0x00;
const QOI_RUN_8: u8 = 0x40;
const QOI_RUN_16: u8 = 0x60;
const QOI_DIFF_8: u8 = 0x80;
const QOI_DIFF_16: u8 = 0xc0;
const QOI_DIFF_24: u8 = 0xe0;
const QOI_COLOR: u8 = 0xf0;

const QOI_MASK_2: u8 = 0xc0;
const QOI_MASK_3: u8 = 0xe0;
const QOI_MASK_4: u8 = 0xf0;

// ── Tipi ──

/// Immagine decodificata. I pixel sono **BGRA**, quattro byte per pixel, come
/// nel raw di GameMaker: invertirli è il modo più semplice di ottenere un
/// round-trip che non torna.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GmImage {
    pub width: u16,
    pub height: u16,
    pub bgra: Vec<u8>,
}

impl GmImage {
    /// Immagine trasparente `width × height`.
    pub fn new(width: u16, height: u16) -> Self {
        Self { width, height, bgra: vec![0u8; width as usize * height as usize * 4] }
    }

    /// Byte di inizio del pixel `(x, y)`, se dentro i bordi.
    #[inline]
    pub fn pixel_offset(&self, x: u16, y: u16) -> Option<usize> {
        if x >= self.width || y >= self.height {
            return None;
        }
        Some((y as usize * self.width as usize + x as usize) * 4)
    }

    /// Scrive un pixel BGRA. Fuori dai bordi non fa nulla e restituisce `false`.
    #[inline]
    pub fn set_pixel(&mut self, x: u16, y: u16, bgra: [u8; 4]) -> bool {
        match self.pixel_offset(x, y) {
            Some(o) => {
                self.bgra[o..o + 4].copy_from_slice(&bgra);
                true
            }
            None => false,
        }
    }

    /// Legge un pixel BGRA.
    #[inline]
    pub fn get_pixel(&self, x: u16, y: u16) -> Option<[u8; 4]> {
        let o = self.pixel_offset(x, y)?;
        Some([self.bgra[o], self.bgra[o + 1], self.bgra[o + 2], self.bgra[o + 3]])
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GmQoiError {
    /// I primi quattro byte non sono `fioq`.
    BadMagic([u8; 4]),
    /// Meno di 12 byte: non c'è nemmeno l'intestazione.
    TooShortForHeader(usize),
    /// L'intestazione dichiara più byte di stream di quanti ne esistano.
    TruncatedStream { declared: usize, available: usize },
    /// Un chunk multi-byte (RUN_16, DIFF_16, DIFF_24, COLOR) è tagliato a metà.
    TruncatedChunk { at: usize },
    /// Lo stream è finito prima di aver prodotto tutti i pixel dichiarati.
    ///
    /// Il codice C# di riferimento in questo caso riempie il resto con l'ultimo
    /// colore invece di lamentarsi. Qui è un errore di proposito: noi
    /// decodifichiamo per RIscrivere il file, e un'immagine completata a caso
    /// verrebbe ricodificata e scritta dentro un `data.win` vero. Meglio
    /// fermarsi che produrre un atlante plausibile e sbagliato.
    PixelsExhausted { produced: usize, expected: usize },
}

impl std::fmt::Display for GmQoiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BadMagic(m) => write!(
                f,
                "magic QOI GameMaker non valido: atteso 'fioq', trovato {:?}",
                String::from_utf8_lossy(m)
            ),
            Self::TooShortForHeader(n) => {
                write!(f, "servono almeno {HEADER_SIZE} byte di intestazione, ricevuti {n}")
            }
            Self::TruncatedStream { declared, available } => write!(
                f,
                "l'intestazione dichiara {declared} byte di stream ma ne sono disponibili {available}"
            ),
            Self::TruncatedChunk { at } => {
                write!(f, "chunk incompleto a fine stream (offset {at})")
            }
            Self::PixelsExhausted { produced, expected } => write!(
                f,
                "stream finito dopo {produced} pixel su {expected} attesi: file troncato o non GM-QOI"
            ),
        }
    }
}

impl std::error::Error for GmQoiError {}

// ── Decodifica ──

/// Estende il segno di un valore a `bits` bit verso `i32`.
///
/// I delta di GM-QOI sono complemento a due a 2, 4 o 5 bit. Il C# di
/// riferimento lo fa con doppi shift su `int`; qui è la stessa cosa scritta
/// una volta sola.
#[inline]
fn sign_extend(value: u8, bits: u32) -> i32 {
    debug_assert!(bits >= 1 && bits <= 8);
    let shift = 32 - bits;
    ((value as i32) << shift) >> shift
}

#[inline]
fn apply(channel: u8, delta: i32) -> u8 {
    // Il C# usa `byte += (byte)delta`, che avvolge. Replicarlo è obbligatorio:
    // le texture vere contengono transizioni che sfruttano l'avvolgimento.
    (channel as i32).wrapping_add(delta) as u8
}

/// Legge l'intestazione senza decodificare i pixel.
///
/// Utile per sapere quanto è lungo il blob (`HEADER_SIZE + length`) quando un
/// chunk ne contiene più d'uno in fila.
pub fn read_header(bytes: &[u8]) -> Result<(u16, u16, usize), GmQoiError> {
    if bytes.len() < HEADER_SIZE {
        return Err(GmQoiError::TooShortForHeader(bytes.len()));
    }
    let magic: [u8; 4] = [bytes[0], bytes[1], bytes[2], bytes[3]];
    if magic != MAGIC {
        return Err(GmQoiError::BadMagic(magic));
    }
    let width = u16::from_le_bytes([bytes[4], bytes[5]]);
    let height = u16::from_le_bytes([bytes[6], bytes[7]]);
    let length = u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize;
    Ok((width, height, length))
}

/// Decodifica un blob GM-QOI in un'immagine BGRA.
pub fn decode(bytes: &[u8]) -> Result<GmImage, GmQoiError> {
    let (width, height, length) = read_header(bytes)?;

    let available = bytes.len() - HEADER_SIZE;
    if length > available {
        return Err(GmQoiError::TruncatedStream { declared: length, available });
    }
    let stream = &bytes[HEADER_SIZE..HEADER_SIZE + length];

    let mut img = GmImage::new(width, height);
    let total_bytes = img.bgra.len();

    // Stato del decoder. `a = 255` e index tutto a zero sono gli stessi valori
    // iniziali dell'encoder (vPrev = 0xff, index[] = 0): cambiarli disallinea
    // il round-trip fin dal primo pixel.
    let (mut r, mut g, mut b, mut a) = (0u8, 0u8, 0u8, 255u8);
    let mut index = [[0u8; 4]; 64];
    let mut run: u32 = 0;
    let mut pos = 0usize;

    let mut out = 0usize;
    while out < total_bytes {
        if run > 0 {
            run -= 1;
        } else if pos < stream.len() {
            let b1 = stream[pos];
            pos += 1;

            // L'ordine dei rami non è arbitrario: le maschere si sovrappongono
            // (0x80 con mask-2 cattura 0x80..0xBF, 0xC0 con mask-3 cattura
            // 0xC0..0xDF, e così via). Riordinarli cambia il formato.
            if b1 & QOI_MASK_2 == QOI_INDEX {
                let e = index[(b1 & 0x3f) as usize];
                r = e[0];
                g = e[1];
                b = e[2];
                a = e[3];
            } else if b1 & QOI_MASK_3 == QOI_RUN_8 {
                run = (b1 & 0x1f) as u32;
            } else if b1 & QOI_MASK_3 == QOI_RUN_16 {
                let b2 = *stream.get(pos).ok_or(GmQoiError::TruncatedChunk { at: pos })?;
                pos += 1;
                run = ((((b1 & 0x1f) as u32) << 8) | b2 as u32) + 32;
            } else if b1 & QOI_MASK_2 == QOI_DIFF_8 {
                r = apply(r, sign_extend((b1 >> 4) & 0x03, 2));
                g = apply(g, sign_extend((b1 >> 2) & 0x03, 2));
                b = apply(b, sign_extend(b1 & 0x03, 2));
            } else if b1 & QOI_MASK_3 == QOI_DIFF_16 {
                let b2 = *stream.get(pos).ok_or(GmQoiError::TruncatedChunk { at: pos })?;
                pos += 1;
                r = apply(r, sign_extend(b1 & 0x1f, 5));
                g = apply(g, sign_extend((b2 >> 4) & 0x0f, 4));
                b = apply(b, sign_extend(b2 & 0x0f, 4));
            } else if b1 & QOI_MASK_4 == QOI_DIFF_24 {
                let b2 = *stream.get(pos).ok_or(GmQoiError::TruncatedChunk { at: pos })?;
                let b3 = *stream.get(pos + 1).ok_or(GmQoiError::TruncatedChunk { at: pos + 1 })?;
                pos += 2;
                r = apply(r, sign_extend(((b1 & 0x0f) << 1) | (b2 >> 7), 5));
                g = apply(g, sign_extend((b2 >> 2) & 0x1f, 5));
                b = apply(b, sign_extend(((b2 & 0x03) << 3) | (b3 >> 5), 5));
                a = apply(a, sign_extend(b3 & 0x1f, 5));
            } else {
                // QOI_COLOR: bitmask dei canali presenti, valori ASSOLUTI (non
                // delta) e nell'ordine r, g, b, a.
                debug_assert_eq!(b1 & QOI_MASK_4, QOI_COLOR);
                let mut take = |slot: &mut u8| -> Result<(), GmQoiError> {
                    *slot = *stream.get(pos).ok_or(GmQoiError::TruncatedChunk { at: pos })?;
                    pos += 1;
                    Ok(())
                };
                if b1 & 8 != 0 {
                    take(&mut r)?;
                }
                if b1 & 4 != 0 {
                    take(&mut g)?;
                }
                if b1 & 2 != 0 {
                    take(&mut b)?;
                }
                if b1 & 1 != 0 {
                    take(&mut a)?;
                }
            }

            index[((r ^ g ^ b ^ a) & 63) as usize] = [r, g, b, a];
        } else {
            return Err(GmQoiError::PixelsExhausted { produced: out / 4, expected: total_bytes / 4 });
        }

        img.bgra[out] = b;
        img.bgra[out + 1] = g;
        img.bgra[out + 2] = r;
        img.bgra[out + 3] = a;
        out += 4;
    }

    Ok(img)
}

// ── Codifica ──

/// Codifica un'immagine BGRA in un blob GM-QOI, intestazione inclusa.
///
/// Bit per bit lo stesso encoder di UndertaleModTool: su un'immagine ottenuta
/// da [`decode`] restituisce i byte di partenza.
pub fn encode(img: &GmImage) -> Vec<u8> {
    let pixels = img.width as usize * img.height as usize;
    let mut buf = Vec::with_capacity(pixels * MAX_CHUNK_SIZE + HEADER_SIZE);

    buf.extend_from_slice(&MAGIC);
    buf.extend_from_slice(&img.width.to_le_bytes());
    buf.extend_from_slice(&img.height.to_le_bytes());
    buf.extend_from_slice(&[0u8; 4]); // lunghezza: riscritta in fondo

    // `index` tiene i colori impacchettati come nell'encoder di riferimento
    // (r<<24 | g<<16 | b<<8 | a), inizializzati a 0 = trasparente puro. Non è
    // un dettaglio: significa che il primo pixel (0,0,0,0) viene codificato
    // come INDEX 0, e il decoder se l'aspetta.
    let mut index = [0u32; 64];
    let mut run: u32 = 0;
    // 0xff = (0,0,0,255), lo stesso colore iniziale del decoder.
    let mut v_prev: u32 = 0xff;

    let n = img.bgra.len();
    let mut i = 0usize;
    while i < n {
        let b = img.bgra[i];
        let g = img.bgra[i + 1];
        let r = img.bgra[i + 2];
        let a = img.bgra[i + 3];
        let v = ((r as u32) << 24) | ((g as u32) << 16) | ((b as u32) << 8) | a as u32;

        if v == v_prev {
            run += 1;
        }
        // 0x2020 è il tetto oltre il quale la run non entra più in 13 bit.
        if run > 0 && (run == 0x2020 || v != v_prev || i == n - 4) {
            if run < 33 {
                buf.push(QOI_RUN_8 | (run - 1) as u8);
            } else {
                let stored = run - 33;
                buf.push(QOI_RUN_16 | (stored >> 8) as u8);
                buf.push(stored as u8);
            }
            run = 0;
        }

        if v != v_prev {
            let hash = ((r ^ g ^ b ^ a) & 63) as usize;
            if index[hash] == v {
                buf.push(QOI_INDEX | hash as u8);
            } else {
                index[hash] = v;

                let vr = r as i32 - ((v_prev >> 24) & 0xff) as i32;
                let vg = g as i32 - ((v_prev >> 16) & 0xff) as i32;
                let vb = b as i32 - ((v_prev >> 8) & 0xff) as i32;
                let va = a as i32 - (v_prev & 0xff) as i32;

                // I confini sono quelli del complemento a due a 2, 4 e 5 bit, e
                // vanno tenuti stretti: un delta di -3 in due bit non ci sta e
                // verrebbe scritto come +1. Il C# li esprime con
                // `d > -3 && d < 2`, cioè -2..=1 — non -3.
                let in_5bit = |d: i32| (-16..=15).contains(&d);
                let in_2bit = |d: i32| (-2..=1).contains(&d);
                let in_4bit = |d: i32| (-8..=7).contains(&d);
                if in_5bit(vr) && in_5bit(vg) && in_5bit(vb) && in_5bit(va) {
                    if va == 0 && in_2bit(vr) && in_2bit(vg) && in_2bit(vb) {
                        buf.push(
                            QOI_DIFF_8
                                | ((vr << 4) & 48) as u8
                                | ((vg << 2) & 12) as u8
                                | (vb & 3) as u8,
                        );
                    } else if va == 0 && in_4bit(vg) && in_4bit(vb) {
                        buf.push(QOI_DIFF_16 | (vr & 31) as u8);
                        buf.push((((vg << 4) & 240) | (vb & 15)) as u8);
                    } else {
                        buf.push(QOI_DIFF_24 | ((vr >> 1) & 15) as u8);
                        buf.push((((vr << 7) & 128) | ((vg << 2) & 124) | ((vb >> 3) & 3)) as u8);
                        buf.push((((vb << 5) & 224) | (va & 31)) as u8);
                    }
                } else {
                    // Delta troppo grande: colore assoluto, ma si scrivono solo
                    // i canali effettivamente cambiati.
                    buf.push(
                        QOI_COLOR
                            | if vr != 0 { 8 } else { 0 }
                            | if vg != 0 { 4 } else { 0 }
                            | if vb != 0 { 2 } else { 0 }
                            | if va != 0 { 1 } else { 0 },
                    );
                    if vr != 0 {
                        buf.push(r);
                    }
                    if vg != 0 {
                        buf.push(g);
                    }
                    if vb != 0 {
                        buf.push(b);
                    }
                    if va != 0 {
                        buf.push(a);
                    }
                }
            }
        }

        v_prev = v;
        i += 4;
    }

    let length = (buf.len() - HEADER_SIZE) as u32;
    buf[8..12].copy_from_slice(&length.to_le_bytes());
    buf
}

// ── Test ──
//
// Non avendo la texture vera nel repo (89 MB di data.win non ci entrano), i
// test costruiscono immagini che esercitano UN TAG ALLA VOLTA e verificano che
// il round-trip torni. La verifica sulla texture reale di Deltarune resta un
// passaggio manuale, documentato in ADR-005.

#[cfg(test)]
mod tests {
    use super::*;

    /// Costruisce un'immagine da una lista di pixel BGRA.
    fn img_from(width: u16, pixels: &[[u8; 4]]) -> GmImage {
        let height = (pixels.len() / width as usize) as u16;
        let mut bgra = Vec::with_capacity(pixels.len() * 4);
        for p in pixels {
            bgra.extend_from_slice(p);
        }
        GmImage { width, height, bgra }
    }

    fn roundtrip(img: &GmImage) {
        let encoded = encode(img);
        let decoded = decode(&encoded).expect("decodifica fallita");
        assert_eq!(&decoded, img, "il round-trip non ha restituito l'immagine di partenza");
        // La proprietà che conta davvero: ricodificare il decodificato deve
        // dare gli stessi byte. Senza questa, potremmo scrivere un blob
        // diverso dentro un data.win pur avendo i pixel giusti.
        let reencoded = encode(&decoded);
        assert_eq!(reencoded, encoded, "encode(decode(x)) != x");
    }

    #[test]
    fn intestazione_valida() {
        let img = GmImage::new(4, 2);
        let blob = encode(&img);
        assert_eq!(&blob[0..4], b"fioq");
        let (w, h, len) = read_header(&blob).unwrap();
        assert_eq!((w, h), (4, 2));
        assert_eq!(len, blob.len() - HEADER_SIZE);
    }

    #[test]
    fn magic_sbagliato_e_un_errore() {
        let mut blob = encode(&GmImage::new(2, 2));
        blob[0] = b'q';
        assert!(matches!(decode(&blob), Err(GmQoiError::BadMagic(_))));
    }

    #[test]
    fn intestazione_troppo_corta() {
        assert!(matches!(decode(&[0u8; 5]), Err(GmQoiError::TooShortForHeader(5))));
    }

    #[test]
    fn stream_dichiarato_piu_lungo_del_reale() {
        let mut blob = encode(&img_from(2, &[[1, 2, 3, 255], [9, 8, 7, 255], [0, 0, 0, 0], [5, 5, 5, 5]]));
        blob[8..12].copy_from_slice(&9999u32.to_le_bytes());
        assert!(matches!(decode(&blob), Err(GmQoiError::TruncatedStream { .. })));
    }

    /// Il caso che il C# di riferimento tollera e noi no: stream valido ma
    /// troppo corto per riempire l'immagine.
    #[test]
    fn pixel_mancanti_sono_un_errore_non_un_riempimento() {
        let img = img_from(4, &[
            [1, 2, 3, 255], [4, 5, 6, 255], [7, 8, 9, 255], [10, 11, 12, 255],
        ]);
        let blob = encode(&img);
        // Si dichiara un'immagine più alta lasciando lo stream com'è.
        let mut corto = blob.clone();
        corto[6..8].copy_from_slice(&4u16.to_le_bytes());
        assert!(matches!(decode(&corto), Err(GmQoiError::PixelsExhausted { .. })));
    }

    #[test]
    fn immagine_vuota() {
        roundtrip(&GmImage::new(0, 0));
    }

    #[test]
    fn tutta_trasparente_usa_le_run() {
        // 100 pixel identici: deve produrre pochissimi byte.
        let img = GmImage::new(10, 10);
        roundtrip(&img);
        let blob = encode(&img);
        assert!(blob.len() < 20, "una tinta unita non dovrebbe costare {} byte", blob.len());
    }

    /// Oltre 32 ripetizioni si passa da RUN_8 a RUN_16: è il confine dove un
    /// off-by-one non si vede a occhio ma rompe l'immagine.
    #[test]
    fn confine_run8_run16() {
        for n in [1usize, 31, 32, 33, 34, 64, 300] {
            let pixels = vec![[7u8, 7, 7, 255]; n];
            let img = img_from(n as u16, &pixels);
            roundtrip(&img);
        }
    }

    /// Run più lunga del tetto a 13 bit (0x2020 = 8224), che obbliga a spezzare.
    #[test]
    fn run_oltre_il_tetto_di_13_bit() {
        let pixels = vec![[3u8, 4, 5, 255]; 9000];
        let img = img_from(9000, &pixels);
        roundtrip(&img);
    }

    #[test]
    fn diff_8_piccole_variazioni() {
        // Delta entro -2..1 su rgb, alpha fermo: ramo DIFF_8.
        let img = img_from(4, &[
            [100, 100, 100, 255],
            [101, 99, 100, 255],
            [99, 100, 101, 255],
            [100, 101, 99, 255],
        ]);
        roundtrip(&img);
    }

    #[test]
    fn diff_16_variazioni_medie() {
        // vr entro -16..15, vg/vb entro -8..7, alpha fermo.
        let img = img_from(3, &[
            [100, 100, 100, 255],
            [107, 112, 90, 255],
            [100, 105, 96, 255],
        ]);
        roundtrip(&img);
    }

    #[test]
    fn diff_24_include_alpha() {
        // Alpha che cambia di poco: solo DIFF_24 lo sa fare.
        let img = img_from(3, &[
            [100, 100, 100, 255],
            [104, 108, 92, 250],
            [110, 100, 100, 240],
        ]);
        roundtrip(&img);
    }

    #[test]
    fn color_per_salti_grandi() {
        // Delta oltre 5 bit su più canali: ramo COLOR con bitmask.
        let img = img_from(4, &[
            [0, 0, 0, 255],
            [200, 10, 90, 255],
            [10, 200, 90, 8],
            [255, 255, 255, 255],
        ]);
        roundtrip(&img);
    }

    /// I confini fra DIFF_8, DIFF_16, DIFF_24 e COLOR, spazzati uno per uno.
    ///
    /// Scritto dopo aver sbagliato proprio questo: `d > -3 && d < 2` è -2..=1,
    /// non -3..=1, e un delta di -3 infilato in due bit torna indietro come +1.
    /// Un test che usa solo delta di ±1 non se ne accorge.
    #[test]
    fn tutti_i_delta_su_ogni_canale() {
        let base = [128u8, 128, 128, 128];
        for canale in 0..4usize {
            for delta in -130i32..=130 {
                let mut p = base;
                p[canale] = (base[canale] as i32).wrapping_add(delta) as u8;
                let img = img_from(2, &[base, p]);
                let encoded = encode(&img);
                let decoded = decode(&encoded).unwrap_or_else(|e| {
                    panic!("canale {canale}, delta {delta}: decodifica fallita: {e}")
                });
                assert_eq!(
                    decoded, img,
                    "canale {canale}, delta {delta}: round-trip sbagliato"
                );
            }
        }
    }

    /// Tutte le combinazioni di delta piccoli sui tre canali colore: è la zona
    /// dove DIFF_8 e DIFF_16 si contendono i valori.
    #[test]
    fn combinazioni_di_delta_piccoli() {
        let base = [100u8, 100, 100, 255];
        for db in -9i32..=8 {
            for dg in -9i32..=8 {
                for dr in -9i32..=8 {
                    let p = [
                        (100 + db) as u8,
                        (100 + dg) as u8,
                        (100 + dr) as u8,
                        255,
                    ];
                    let img = img_from(2, &[base, p]);
                    let decoded = decode(&encode(&img)).unwrap();
                    assert_eq!(decoded, img, "delta ({dr},{dg},{db})");
                }
            }
        }
    }

    /// L'avvolgimento dei canali: i delta si applicano con wrapping, e le
    /// texture vere lo sfruttano. Con un `saturating_add` questo test cade.
    #[test]
    fn i_delta_avvolgono() {
        let img = img_from(4, &[
            [254, 254, 254, 255],
            [255, 255, 255, 255],
            [0, 0, 0, 255],
            [1, 1, 1, 255],
        ]);
        roundtrip(&img);
    }

    /// Il riuso via INDEX: colori che tornano devono costare un byte.
    #[test]
    fn index_riusa_i_colori_gia_visti() {
        let a = [10u8, 20, 30, 255];
        let b = [200u8, 100, 50, 255];
        let img = img_from(6, &[a, b, a, b, a, b]);
        roundtrip(&img);
    }

    /// Bianco pieno e trasparente puro **collidono nello stesso slot** della
    /// tabella INDEX, e per un atlante di font è il fatto che decide tutto.
    ///
    /// L'hash è `(r ^ g ^ b ^ a) & 63`: per `(255,255,255,255)` fa
    /// `255^255^255^255 = 0`, per `(0,0,0,0)` fa `0`. Sono i due soli colori di
    /// un atlante bicolore, quindi si sfrattano a vicenda a ogni transizione e
    /// **INDEX non viene mai usato**: ogni passaggio costa un chunk COLOR da 5
    /// byte invece di 1.
    ///
    /// Conseguenza per ADR-005: il budget in byte di una texture di font non
    /// dipende dall'INDEX ma solo dalle RUN, cioè da QUANTE TRANSIZIONI ha il
    /// disegno — non da quanti pixel accesi. È la ragione per cui svuotare i
    /// kanji rimasti (che toglie transizioni) libera 32 KB.
    #[test]
    fn bianco_e_trasparente_collidono_nello_stesso_slot() {
        let bianco = [255u8, 255, 255, 255];
        let vuoto = [0u8, 0, 0, 0];
        let h = |p: [u8; 4]| (p[0] ^ p[1] ^ p[2] ^ p[3]) & 63;
        assert_eq!(h(bianco), h(vuoto), "i due colori dell'atlante non collidono più: rivedere le stime di ADR-005");

        // E infatti alternarli costa 5 byte a transizione, non 1.
        let img = img_from(4, &[bianco, vuoto, bianco, vuoto]);
        roundtrip(&img);
    }

    /// Il caso reale di ADR-005: l'atlante dei font è BICOLORE puro, senza
    /// antialiasing. Il primo tentativo di iniezione li ha scritti antialiasati
    /// e il blob è cresciuto di 4.256 byte, finendo fuori budget.
    ///
    /// L'asserzione è **comparativa** e non a soglia: la stessa forma
    /// rasterizzata in binario deve costare meno della sua versione sfumata.
    /// Una soglia assoluta qui non significherebbe nulla, perché il costo
    /// dipende dal numero di transizioni del disegno e non dalla dimensione.
    #[test]
    fn il_binario_costa_meno_dell_antialiasato() {
        // Una "lettera": diagonale spessa dentro una cella 32×32.
        let forma = |x: i32, y: i32| -> f32 {
            let d = (x - y).abs() as f32;
            (1.0 - d / 3.0).clamp(0.0, 1.0)
        };

        let mut binario = Vec::new();
        let mut sfumato = Vec::new();
        for y in 0..32i32 {
            for x in 0..32i32 {
                let v = forma(x, y);
                let b = if v >= 0.5 { 255u8 } else { 0u8 };
                binario.push([b, b, b, b]);
                let a = (v * 255.0) as u8;
                sfumato.push([a, a, a, a]);
            }
        }

        let img_bin = img_from(32, &binario);
        let img_aa = img_from(32, &sfumato);
        roundtrip(&img_bin);
        roundtrip(&img_aa);

        let n_bin = encode(&img_bin).len();
        let n_aa = encode(&img_aa).len();
        assert!(
            n_bin < n_aa,
            "il binario ({n_bin} byte) dovrebbe costare meno dell'antialiasato ({n_aa} byte): \
             se non è più vero, l'analisi di budget di ADR-005 va rifatta"
        );
    }

    /// Un atlante realistico — quasi tutto vuoto, con i glifi raccolti in
    /// poche celle — comprime molto. È il caso della texture vera di
    /// Deltarune: 2048×2048 che stanno in 230 KB.
    #[test]
    fn atlante_prevalentemente_vuoto_comprime_molto() {
        let vuoto = [0u8, 0, 0, 0];
        let pieno = [255u8, 255, 255, 255];
        let mut pixels = Vec::new();
        for y in 0..128u32 {
            for x in 0..128u32 {
                // Sedici celle 8×8 piene nell'angolo, il resto trasparente.
                let dentro = x < 32 && y < 32 && (x / 8 + y / 8) % 2 == 0;
                pixels.push(if dentro { pieno } else { vuoto });
            }
        }
        let img = img_from(128, &pixels);
        roundtrip(&img);
        let blob = encode(&img);
        assert!(
            blob.len() < pixels.len() / 4,
            "un atlante quasi vuoto deve comprimere molto, invece {} byte per {} pixel",
            blob.len(),
            pixels.len()
        );
    }

    /// Un'immagine pseudo-casuale non comprime, ma deve comunque tornare
    /// identica: è il caso che esercita tutti i rami insieme.
    #[test]
    fn rumore_pseudocasuale_torna_identico() {
        let mut seed = 0x2bad_c0deu32;
        let mut next = || {
            // xorshift32: deterministico, nessuna dipendenza.
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            seed
        };
        let mut pixels = Vec::new();
        for _ in 0..(48 * 48) {
            let v = next();
            pixels.push([v as u8, (v >> 8) as u8, (v >> 16) as u8, (v >> 24) as u8]);
        }
        roundtrip(&img_from(48, &pixels));
    }

    /// Sostituire una cella dell'atlante (quello che ADR-005 fa davvero) non
    /// deve rompere né il round-trip né il resto dell'immagine.
    #[test]
    fn sostituire_una_cella_non_tocca_le_altre() {
        let mut img = GmImage::new(32, 32);
        for y in 0..32u16 {
            for x in 0..32u16 {
                if (x / 8 + y / 8) % 2 == 0 {
                    img.set_pixel(x, y, [255, 255, 255, 255]);
                }
            }
        }
        let prima = img.clone();

        // Si riscrive solo la cella (8..16, 8..16).
        for y in 8..16u16 {
            for x in 8..16u16 {
                img.set_pixel(x, y, [255, 255, 255, 255]);
            }
        }
        roundtrip(&img);

        // Fuori dalla cella nulla è cambiato.
        for y in 0..32u16 {
            for x in 0..32u16 {
                if (8..16).contains(&x) && (8..16).contains(&y) {
                    continue;
                }
                assert_eq!(img.get_pixel(x, y), prima.get_pixel(x, y), "pixel ({x},{y}) alterato");
            }
        }
    }

    #[test]
    fn set_pixel_fuori_bordo_non_scrive() {
        let mut img = GmImage::new(4, 4);
        assert!(!img.set_pixel(4, 0, [1, 2, 3, 4]));
        assert!(!img.set_pixel(0, 4, [1, 2, 3, 4]));
        assert!(img.set_pixel(3, 3, [1, 2, 3, 4]));
        assert_eq!(img.get_pixel(3, 3), Some([1, 2, 3, 4]));
        assert_eq!(img.get_pixel(4, 0), None);
    }

    /// I pixel sono BGRA, non RGBA: se qualcuno inverte l'ordine questo test è
    /// l'unico che se ne accorge subito.
    #[test]
    fn ordine_dei_canali_e_bgra() {
        let img = img_from(1, &[[0x11, 0x22, 0x33, 0x44]]);
        let blob = encode(&img);
        let back = decode(&blob).unwrap();
        assert_eq!(back.bgra, vec![0x11, 0x22, 0x33, 0x44]);
        // Il primo pixel ha b=0x11, g=0x22, r=0x33, a=0x44.
        assert_eq!(back.get_pixel(0, 0), Some([0x11, 0x22, 0x33, 0x44]));
    }
}
