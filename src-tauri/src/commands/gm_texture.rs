//! Contenitore delle texture GameMaker: QOI compresso con BZip2 (`2zoq`).
//!
//! Secondo strato di ADR-005. Sotto c'è [`crate::commands::gm_qoi`], che fa il
//! codec dei pixel; qui si gestisce l'involucro che sta dentro il chunk `TXTR`
//! di `data.win`.
//!
//! # Il formato, misurato
//!
//! ```text
//! offset  campo
//!      0  magic "2zoq"                      4 byte
//!      4  width                             u16 LE
//!      6  height                            u16 LE
//!      8  lunghezza del QOI DECOMPRESSO     i32 LE — SOLO su GameMaker 2022.5+
//!   8/12  stream BZip2 ("BZh" + livello)    lunghezza NON memorizzata
//! ```
//!
//! Due dettagli che cambiano il modo di scrivere il codice:
//!
//! **La variante si riconosce, non si deduce.** Invece di interpretare il numero
//! di versione del runtime si guarda dove comincia lo stream BZip2: uno stream
//! BZip2 inizia sempre con `BZh` più la cifra del livello. Se sta a offset 8
//! l'header è corto, se sta a 12 è lungo e i quattro byte in mezzo sono la
//! lunghezza del QOI decompresso. È una misura. (Deltarune: header corto su
//! tutte e 27 le texture.)
//!
//! **La lunghezza dello stream non esiste da nessuna parte.** Il lettore di
//! GameMaker la ricava cercando all'indietro il magic di fine BZip2 a livello di
//! *bit*. Per noi la conseguenza pratica è comoda: i byte dopo la fine dello
//! stream non vengono mai letti, quindi si può riempire con zeri fino alla
//! dimensione originale del blob. **Con zeri e basta**: il lettore verifica il
//! riempimento byte per byte e rifiuta il file al primo byte non nullo.
//!
//! # Cosa NON garantisce questo modulo
//!
//! Il livello QOI garantisce `encode(decode(x)) == x` byte per byte. **Qui no.**
//! Ricomprimere con BZip2 non restituisce necessariamente gli stessi byte
//! dell'originale, perché il compressore di GameMaker è un'altra
//! implementazione. Non è un problema — l'unico requisito è che il risultato si
//! decomprima correttamente e **stia nello spazio del blob originale** — ma
//! nessun test deve pretendere l'identità byte a byte a questo livello.

// Come per gm_qoi: per ora chiamano solo i test. Da togliere quando arriva la
// tabella dei glifi, che è il chiamante previsto.
#![allow(dead_code)]

use std::io::{Read, Write};

use bzip2::read::BzDecoder;
use bzip2::write::BzEncoder;
use bzip2::Compression;

use crate::commands::gm_qoi::{self, GmImage, GmQoiError};

const MAGIC: [u8; 4] = *b"2zoq";

/// GameMaker comprime a livello 9; si usa lo stesso per restare comparabili.
const LIVELLO_BZIP2: u32 = 9;

/// Le texture nel chunk `TXTR` sono allineate a questo confine.
pub const ALLINEAMENTO: usize = 0x80;

// ── Tipi ──

/// Quale delle due forme dell'header usa questo blob.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Header {
    /// 8 byte: magic, width, height. GameMaker precedente a 2022.5.
    Corto,
    /// 12 byte: come sopra più la lunghezza del QOI decompresso. GM 2022.5+.
    ///
    /// Il campo è a dimensione fissa, quindi riscriverlo non sposta nulla — ma
    /// **va riscritto**: lasciarlo al valore vecchio produce un file che sembra
    /// sano e si rompe alla lettura.
    Lungo,
}

impl Header {
    pub fn dimensione(self) -> usize {
        match self {
            Header::Corto => 8,
            Header::Lungo => 12,
        }
    }
}

/// Una texture letta dal contenitore.
#[derive(Debug, Clone)]
pub struct GmTexture {
    pub header: Header,
    /// Larghezza dichiarata nell'header (non necessariamente uguale a quella
    /// dell'immagine QOI: se divergono è un file malformato, e lo segnaliamo).
    pub width: u16,
    pub height: u16,
    pub image: GmImage,
}

#[derive(Debug)]
pub enum GmTextureError {
    /// I primi quattro byte non sono `2zoq`.
    BadMagic([u8; 4]),
    /// Meno byte di quanti ne serva per leggere l'header.
    TroppoCorto(usize),
    /// Non si trova `BZh` né a offset 8 né a offset 12: non è un contenitore
    /// valido, oppure la sequenza `2zoq` era un falso positivo dentro dati
    /// compressi.
    StreamBzipNonTrovato,
    /// BZip2 ha rifiutato i dati.
    Bzip2(std::io::Error),
    /// Il QOI dentro il contenitore non si decodifica.
    Qoi(GmQoiError),
    /// L'header e il QOI dichiarano dimensioni diverse.
    DimensioniIncoerenti {
        header: (u16, u16),
        qoi: (u16, u16),
    },
    /// Il blob ricompresso non entra nello spazio originale.
    ///
    /// È l'unico esito in cui ADR-005 impone di **fermarsi**: meglio nessuna
    /// patch che un `data.win` corrotto.
    NonCiSta { servono: usize, disponibili: usize },
}

impl std::fmt::Display for GmTextureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BadMagic(m) => write!(
                f,
                "magic non valido: atteso '2zoq', trovato {:?}",
                String::from_utf8_lossy(m)
            ),
            Self::TroppoCorto(n) => write!(f, "blob di soli {n} byte: troppo corto per un header"),
            Self::StreamBzipNonTrovato => write!(
                f,
                "nessuno stream BZip2 né a offset 8 né a offset 12: contenitore non riconosciuto"
            ),
            Self::Bzip2(e) => write!(f, "errore BZip2: {e}"),
            Self::Qoi(e) => write!(f, "errore QOI: {e}"),
            Self::DimensioniIncoerenti { header, qoi } => write!(
                f,
                "l'header dichiara {}x{} ma il QOI contiene {}x{}",
                header.0, header.1, qoi.0, qoi.1
            ),
            Self::NonCiSta { servono, disponibili } => write!(
                f,
                "il blob ricompresso occupa {servono} byte ma ne sono disponibili {disponibili}: \
                 scrittura annullata per non corrompere il file"
            ),
        }
    }
}

impl std::error::Error for GmTextureError {}

impl From<GmQoiError> for GmTextureError {
    fn from(e: GmQoiError) -> Self {
        Self::Qoi(e)
    }
}

// ── Lettura ──

/// Uno stream BZip2 inizia con `BZh` seguito dalla cifra del livello (1..9).
fn inizio_bzip(buf: &[u8], at: usize) -> bool {
    buf.len() >= at + 4
        && buf[at] == b'B'
        && buf[at + 1] == b'Z'
        && buf[at + 2] == b'h'
        && (b'1'..=b'9').contains(&buf[at + 3])
}

/// Riconosce quale header usa il blob, guardando dove comincia lo stream.
pub fn riconosci_header(blob: &[u8]) -> Option<Header> {
    if inizio_bzip(blob, 8) {
        Some(Header::Corto)
    } else if inizio_bzip(blob, 12) {
        Some(Header::Lungo)
    } else {
        None
    }
}

fn decomprimi(stream: &[u8], capacita: usize) -> Result<Vec<u8>, GmTextureError> {
    // `BzDecoder` (a differenza di `MultiBzDecoder`) si ferma alla fine del
    // primo stream e ignora quello che viene dopo: è esattamente ciò che serve,
    // visto che dopo lo stream c'è il riempimento a zeri.
    let mut out = Vec::with_capacity(capacita);
    BzDecoder::new(stream)
        .read_to_end(&mut out)
        .map_err(GmTextureError::Bzip2)?;
    Ok(out)
}

/// Legge un contenitore `2zoq` e restituisce l'immagine decodificata.
///
/// `blob` può includere il riempimento a zeri finale: viene ignorato.
pub fn leggi(blob: &[u8]) -> Result<GmTexture, GmTextureError> {
    if blob.len() < 12 {
        return Err(GmTextureError::TroppoCorto(blob.len()));
    }
    let magic: [u8; 4] = [blob[0], blob[1], blob[2], blob[3]];
    if magic != MAGIC {
        return Err(GmTextureError::BadMagic(magic));
    }

    let width = u16::from_le_bytes([blob[4], blob[5]]);
    let height = u16::from_le_bytes([blob[6], blob[7]]);

    let header = riconosci_header(blob).ok_or(GmTextureError::StreamBzipNonTrovato)?;

    // Se c'è, la lunghezza dichiarata serve solo a dimensionare il buffer: non
    // ci si fida per la correttezza, il QOI porta le proprie dimensioni.
    let capacita = match header {
        Header::Lungo => i32::from_le_bytes([blob[8], blob[9], blob[10], blob[11]]).max(0) as usize,
        Header::Corto => width as usize * height as usize * 4,
    };

    let qoi = decomprimi(&blob[header.dimensione()..], capacita)?;
    let image = gm_qoi::decode(&qoi)?;

    if image.width != width || image.height != height {
        return Err(GmTextureError::DimensioniIncoerenti {
            header: (width, height),
            qoi: (image.width, image.height),
        });
    }

    Ok(GmTexture { header, width, height, image })
}

// ── Scrittura ──

fn comprimi(qoi: &[u8]) -> Result<Vec<u8>, GmTextureError> {
    let mut enc = BzEncoder::new(Vec::new(), Compression::new(LIVELLO_BZIP2));
    enc.write_all(qoi).map_err(GmTextureError::Bzip2)?;
    enc.finish().map_err(GmTextureError::Bzip2)
}

/// Ricostruisce il blob del contenitore a partire da un'immagine.
///
/// `spazio` è la dimensione del blob originale, riempimento incluso: è il
/// budget invalicabile. Se il risultato non ci sta si restituisce
/// [`GmTextureError::NonCiSta`] **senza** produrre nulla, perché una texture
/// più lunga dell'originale sposterebbe tutti gli offset del `data.win` e
/// richiederebbe il rebuilder di ADR-004.
///
/// Se ci sta, l'uscita è lunga **esattamente** `spazio` byte, completata con
/// zeri: il lettore di GameMaker trova la fine dello stream da sé e pretende
/// che il riempimento sia nullo.
pub fn scrivi(image: &GmImage, header: Header, spazio: usize) -> Result<Vec<u8>, GmTextureError> {
    let qoi = gm_qoi::encode(image);
    let compresso = comprimi(&qoi)?;

    let servono = header.dimensione() + compresso.len();
    if servono > spazio {
        return Err(GmTextureError::NonCiSta { servono, disponibili: spazio });
    }

    let mut out = Vec::with_capacity(spazio);
    out.extend_from_slice(&MAGIC);
    out.extend_from_slice(&image.width.to_le_bytes());
    out.extend_from_slice(&image.height.to_le_bytes());
    if header == Header::Lungo {
        // La lunghezza del QOI DECOMPRESSO, non di quello compresso. Cambia a
        // ogni iniezione di glifi, ed è il campo che non va dimenticato.
        out.extend_from_slice(&(qoi.len() as i32).to_le_bytes());
    }
    out.extend_from_slice(&compresso);
    out.resize(spazio, 0);

    debug_assert_eq!(out.len(), spazio);
    Ok(out)
}

/// Arrotonda al confine di allineamento delle texture (0x80).
pub fn arrotonda_allineamento(n: usize) -> usize {
    // Scritto a mano invece di `div_ceil` per non dipendere dalla versione
    // minima di Rust del progetto.
    n.saturating_add(ALLINEAMENTO - 1) / ALLINEAMENTO * ALLINEAMENTO
}

// ── Test ──

#[cfg(test)]
mod tests {
    use super::*;

    /// Un atlante verosimile: quasi tutto trasparente, con qualche cella piena.
    fn atlante(width: u16, height: u16) -> GmImage {
        let mut img = GmImage::new(width, height);
        for y in 0..height {
            for x in 0..width {
                if (x / 8 + y / 8) % 3 == 0 && x % 8 != 0 && y % 8 != 0 {
                    img.set_pixel(x, y, [255, 255, 255, 255]);
                }
            }
        }
        img
    }

    fn giro(header: Header) {
        let img = atlante(64, 64);
        // Budget generoso: qui interessa il round-trip, non il limite.
        let blob = scrivi(&img, header, 64 * 1024).expect("scrittura fallita");
        assert_eq!(blob.len(), 64 * 1024, "l'uscita deve occupare tutto lo spazio");
        assert_eq!(&blob[0..4], b"2zoq");
        assert_eq!(riconosci_header(&blob), Some(header));

        let letta = leggi(&blob).expect("lettura fallita");
        assert_eq!(letta.header, header);
        assert_eq!((letta.width, letta.height), (64, 64));
        assert_eq!(letta.image, img, "l'immagine non ha fatto il giro intatta");
    }

    #[test]
    fn giro_completo_header_corto() {
        giro(Header::Corto);
    }

    #[test]
    fn giro_completo_header_lungo() {
        giro(Header::Lungo);
    }

    /// Il riempimento finale deve essere di zeri: il lettore di GameMaker
    /// rifiuta il file al primo byte non nullo.
    #[test]
    fn il_riempimento_e_tutto_zeri() {
        let img = atlante(32, 32);
        let spazio = 32 * 1024;
        let blob = scrivi(&img, Header::Corto, spazio).unwrap();

        // Si ritrova la fine dei dati veri e si controlla il resto.
        let ultimo_non_nullo = blob.iter().rposition(|&b| b != 0).unwrap();
        assert!(
            blob[ultimo_non_nullo + 1..].iter().all(|&b| b == 0),
            "trovato un byte non nullo nel riempimento"
        );
        assert!(ultimo_non_nullo + 1 < spazio, "ci si aspetta del riempimento");
    }

    /// Il campo dell'header lungo contiene la lunghezza del QOI DECOMPRESSO.
    /// Confonderla con quella del compresso è l'errore facile.
    #[test]
    fn header_lungo_dichiara_la_lunghezza_del_qoi_decompresso() {
        let img = atlante(48, 48);
        let blob = scrivi(&img, Header::Lungo, 64 * 1024).unwrap();

        let dichiarata = i32::from_le_bytes([blob[8], blob[9], blob[10], blob[11]]) as usize;
        let qoi_atteso = gm_qoi::encode(&img).len();
        assert_eq!(dichiarata, qoi_atteso);

        // E non è la lunghezza del compresso, che è un altro numero.
        let compresso = comprimi(&gm_qoi::encode(&img)).unwrap();
        assert_ne!(
            dichiarata,
            compresso.len(),
            "se questi due coincidessero il test non proverebbe nulla: cambiare immagine"
        );
    }

    /// Il caso che ADR-005 impone di gestire fermandosi.
    #[test]
    fn se_non_ci_sta_si_annulla() {
        let img = atlante(256, 256);
        let esito = scrivi(&img, Header::Corto, 64);
        match esito {
            Err(GmTextureError::NonCiSta { servono, disponibili }) => {
                assert!(servono > disponibili);
                assert_eq!(disponibili, 64);
            }
            altro => panic!("atteso NonCiSta, ottenuto {altro:?}"),
        }
    }

    /// Il budget esatto deve essere accettato (nessun off-by-one).
    #[test]
    fn il_budget_esatto_e_accettato() {
        let img = atlante(32, 32);
        let qoi = gm_qoi::encode(&img);
        let minimo = Header::Corto.dimensione() + comprimi(&qoi).unwrap().len();

        let blob = scrivi(&img, Header::Corto, minimo).expect("il budget esatto deve bastare");
        assert_eq!(blob.len(), minimo);
        assert_eq!(leggi(&blob).unwrap().image, img);

        // Un byte in meno, invece, no.
        assert!(matches!(
            scrivi(&img, Header::Corto, minimo - 1),
            Err(GmTextureError::NonCiSta { .. })
        ));
    }

    #[test]
    fn magic_sbagliato() {
        let img = atlante(16, 16);
        let mut blob = scrivi(&img, Header::Corto, 8192).unwrap();
        blob[0] = b'q';
        assert!(matches!(leggi(&blob), Err(GmTextureError::BadMagic(_))));
    }

    #[test]
    fn blob_troppo_corto() {
        assert!(matches!(leggi(&[0u8; 4]), Err(GmTextureError::TroppoCorto(4))));
    }

    /// La sequenza '2zoq' può capitare per caso dentro dati compressi: senza
    /// uno stream BZip2 dietro non è un contenitore.
    #[test]
    fn falso_positivo_senza_stream_bzip() {
        let mut finto = Vec::new();
        finto.extend_from_slice(b"2zoq");
        finto.extend_from_slice(&64u16.to_le_bytes());
        finto.extend_from_slice(&64u16.to_le_bytes());
        finto.extend_from_slice(&[0xAB; 32]);
        assert!(matches!(leggi(&finto), Err(GmTextureError::StreamBzipNonTrovato)));
        assert_eq!(riconosci_header(&finto), None);
    }

    #[test]
    fn riconoscimento_header_su_entrambe_le_varianti() {
        let img = atlante(16, 16);
        let corto = scrivi(&img, Header::Corto, 8192).unwrap();
        let lungo = scrivi(&img, Header::Lungo, 8192).unwrap();
        assert_eq!(riconosci_header(&corto), Some(Header::Corto));
        assert_eq!(riconosci_header(&lungo), Some(Header::Lungo));
        // E le due forme non si confondono a vicenda.
        assert_ne!(riconosci_header(&corto), riconosci_header(&lungo));
    }

    /// Modificare una cella e riscrivere è il gesto vero di ADR-005.
    #[test]
    fn iniettare_una_cella_e_riscrivere() {
        let originale = atlante(64, 64);
        let spazio = arrotonda_allineamento(
            Header::Corto.dimensione() + comprimi(&gm_qoi::encode(&originale)).unwrap().len(),
        ) + 4096;

        let mut modificata = originale.clone();
        for y in 16..24u16 {
            for x in 16..24u16 {
                modificata.set_pixel(x, y, [255, 255, 255, 255]);
            }
        }

        let blob = scrivi(&modificata, Header::Corto, spazio).expect("deve starci");
        let riletta = leggi(&blob).unwrap();
        assert_eq!(riletta.image, modificata);
        assert_ne!(riletta.image, originale, "la modifica deve essere sopravvissuta");
    }

    /// Svuotare aree piene riduce le transizioni, e quindi il blob: è la
    /// strategia B di ADR-005 (svuotare i kanji libera 32 KB).
    #[test]
    fn svuotare_riduce_la_dimensione_compressa() {
        let pieno = atlante(128, 128);
        let mut svuotato = pieno.clone();
        for y in 64..128u16 {
            for x in 0..128u16 {
                svuotato.set_pixel(x, y, [0, 0, 0, 0]);
            }
        }

        let n_pieno = comprimi(&gm_qoi::encode(&pieno)).unwrap().len();
        let n_svuotato = comprimi(&gm_qoi::encode(&svuotato)).unwrap().len();
        assert!(
            n_svuotato < n_pieno,
            "svuotare dovrebbe ridurre: pieno {n_pieno} B, svuotato {n_svuotato} B"
        );
    }

    /// Verifica contro un `data.win` VERO. Non gira nella suite normale perché
    /// il file pesa 89 MB e non sta nel repo; si lancia a mano:
    ///
    /// ```text
    /// GS_GM_DATA_WIN="C:/.../DELTARUNEdemo/data.win" cargo test -- --ignored gm_texture
    /// ```
    ///
    /// Serve perché tutto il resto è provato su immagini sintetiche, e in
    /// questo lavoro l'unico errore vero (il decoder che produceva rumore) è
    /// stato scoperto guardando il dato reale, non i test.
    #[test]
    #[ignore = "richiede GS_GM_DATA_WIN con il percorso di un data.win reale"]
    fn round_trip_su_data_win_reale() {
        let percorso = match std::env::var("GS_GM_DATA_WIN") {
            Ok(p) => p,
            Err(_) => {
                eprintln!("GS_GM_DATA_WIN non impostata: niente da fare");
                return;
            }
        };
        let dati = std::fs::read(&percorso).expect("impossibile leggere il data.win");
        eprintln!("{percorso}: {} byte", dati.len());

        // Si individuano i blob cercando il magic, come fa
        // scripts/gm-inspect-texture.js: seguire i puntatori del chunk TXTR
        // richiederebbe di conoscerne la struttura, che cambia fra versioni.
        let mut offset = Vec::new();
        let mut i = 0usize;
        while i + 4 <= dati.len() {
            if dati[i..i + 4] == MAGIC && riconosci_header(&dati[i..]).is_some() {
                offset.push(i);
                i += 4;
            } else {
                i += 1;
            }
        }
        assert!(!offset.is_empty(), "nessuna texture 2zoq trovata");
        eprintln!("texture trovate: {}", offset.len());

        // Le texture sono allineate a 0x80, quindi la distanza dal blob
        // successivo E' lo spazio disponibile. L'ultima si salta: non se ne
        // conosce il limite superiore senza leggere il chunk TXTR.
        let mut esaminate = 0usize;
        for w in offset.windows(2) {
            let (inizio, spazio) = (w[0], w[1] - w[0]);
            let blob = &dati[inizio..inizio + spazio];

            let tex = leggi(blob)
                .unwrap_or_else(|e| panic!("lettura fallita a offset {inizio}: {e}"));

            // Il giro completo: si riscrive senza modifiche e deve rientrare
            // nello spazio di partenza. E' la condizione che rende possibile
            // l'iniezione dei glifi.
            let riscritto = scrivi(&tex.image, tex.header, spazio).unwrap_or_else(|e| {
                panic!(
                    "offset {inizio} ({}x{}): la riscrittura non ci sta: {e}",
                    tex.width, tex.height
                )
            });
            assert_eq!(riscritto.len(), spazio);

            // E rileggendo si deve ritrovare la stessa immagine.
            let ritorno = leggi(&riscritto)
                .unwrap_or_else(|e| panic!("rilettura fallita a offset {inizio}: {e}"));
            assert_eq!(
                ritorno.image, tex.image,
                "offset {inizio}: l'immagine non ha fatto il giro intatta"
            );

            esaminate += 1;
        }
        eprintln!("texture verificate con round-trip completo: {esaminate}");
        assert!(esaminate > 0);
    }

    /// L'atlante del font di Deltarune, con i numeri di ADR-005.
    ///
    /// Stessa attivazione del test qui sopra. Se questo passa, la strategia B
    /// (svuotare i kanji per liberare 32 KB) poggia su misure e non su stime.
    #[test]
    #[ignore = "richiede GS_GM_DATA_WIN con il percorso del data.win di Deltarune"]
    fn atlante_font_deltarune_combacia_con_adr005() {
        const OFFSET_ATTESO: usize = 33_632_000;
        const BLOB_ATTESO: usize = 230_272;
        const QOI_ATTESO: usize = 1_888_553;

        let percorso = match std::env::var("GS_GM_DATA_WIN") {
            Ok(p) => p,
            Err(_) => return,
        };
        let dati = std::fs::read(&percorso).expect("impossibile leggere il data.win");
        if dati.len() < OFFSET_ATTESO + BLOB_ATTESO {
            eprintln!("file più corto dell'atteso: non è la demo di Deltarune, si salta");
            return;
        }

        let blob = &dati[OFFSET_ATTESO..OFFSET_ATTESO + BLOB_ATTESO];
        let tex = leggi(blob).expect("l'atlante del font non si legge");

        assert_eq!(tex.header, Header::Corto, "Deltarune è precedente a GM 2022.5");
        assert_eq!((tex.width, tex.height), (2048, 2048));

        // I 1.888.553 byte misurati il 26/07 sono la lunghezza del QOI
        // decompresso: e' il numero che identifica questa texture.
        let qoi = gm_qoi::encode(&tex.image);
        assert_eq!(
            qoi.len(),
            QOI_ATTESO,
            "il QOI ricodificato dovrebbe essere identico all'originale ({QOI_ATTESO} byte)"
        );

        // Strategia A: la sola ricompressione ci sta, ma di poco.
        let solo_ricompresso = scrivi(&tex.image, tex.header, BLOB_ATTESO)
            .expect("la sola ricompressione deve rientrare nel blob originale");
        assert_eq!(solo_ricompresso.len(), BLOB_ATTESO);

        // Strategia B: svuotando meta' dell'atlante il margine deve crescere in
        // modo consistente, che e' la ragione per cui ADR-005 la preferisce.
        let mut svuotato = tex.image.clone();
        for y in 1024..2048u16 {
            for x in 0..2048u16 {
                svuotato.set_pixel(x, y, [0, 0, 0, 0]);
            }
        }
        let n_intero = comprimi(&gm_qoi::encode(&tex.image)).unwrap().len();
        let n_svuotato = comprimi(&gm_qoi::encode(&svuotato)).unwrap().len();
        eprintln!("blob compresso: intero {n_intero} B, meta' svuotata {n_svuotato} B");
        assert!(
            n_svuotato < n_intero,
            "svuotare deve liberare spazio: intero {n_intero} B, svuotato {n_svuotato} B"
        );
    }

    #[test]
    fn allineamento() {
        assert_eq!(arrotonda_allineamento(0), 0);
        assert_eq!(arrotonda_allineamento(1), 128);
        assert_eq!(arrotonda_allineamento(128), 128);
        assert_eq!(arrotonda_allineamento(129), 256);
        // Il caso misurato su Deltarune: 230.197 byte di blob diventano 230.272.
        assert_eq!(arrotonda_allineamento(230_197), 230_272);
    }
}
