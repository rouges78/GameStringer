//! Da un TTF a una [`Bitmap`] binaria buona per l'atlante di un font GameMaker.
//!
//! Quinto e ultimo pezzo di ADR-005 prima del comando Tauri. È deliberatamente
//! il modulo più sostituibile della catena: se un domani si passa a bitmap
//! disegnate a mano per rispettare uno stile pixel-art, cambia solo questo file
//! — [`Bitmap`] resta l'unica interfaccia verso
//! [`gm_glyph_inject`](crate::commands::gm_glyph_inject).
//!
//! # Le due cose che devono andare bene
//!
//! **Binario, non sfumato.** L'atlante di Deltarune ha solo `[0,0,0,0]` e
//! `[255,255,255,255]`. Rasterizzare con antialiasing e scrivere i valori
//! intermedi ha fatto crescere il blob compresso di 4.256 byte, oltre il
//! budget (ADR-005, verifica del 26/07). Qui si applica sempre una soglia.
//!
//! **La dimensione va presa dal font ospite, non dalla cella.** Le celle dei
//! kanji sono più grandi delle lettere latine: riempirle produrrebbe una
//! cirillica gigante accanto a una latina normale. Si misura l'altezza delle
//! maiuscole già presenti nel font e si rasterizza a quella —
//! [`dimensione_per_altezza`] cerca il corpo in punti che la produce.
//!
//! # Il TTF da dove arriva
//!
//! `font_installer.rs` scarica già `NotoSans-Regular.ttf`, che copre cirillico,
//! greco, latin-ext e vietnamita. Non serve bundlare niente.

#![allow(dead_code)]

use fontdue::{Font as TtfFont, FontSettings};

use crate::commands::gm_font::Font;
use crate::commands::gm_glyph_inject::Bitmap;

/// Sopra questa copertura il pixel si accende. È la soglia usata nella verifica
/// sperimentale del 26/07, quella con cui i conti sul budget tornano.
pub const SOGLIA: u8 = 128;

#[derive(Debug, PartialEq, Eq)]
pub enum Errore {
    TtfIllegibile(String),
    /// Il TTF non ha quel carattere: meglio dirlo che disegnare un rettangolo
    /// vuoto e accorgersene a gioco avviato.
    CarattereAssente(char),
    /// Nessun corpo in punti produce l'altezza richiesta.
    AltezzaIrraggiungibile { voluta: u16, ottenuta: u16 },
    /// Il font ospite non ha maiuscole latine da cui dedurre la dimensione.
    NessunRiferimento,
}

impl std::fmt::Display for Errore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TtfIllegibile(e) => write!(f, "TTF illeggibile: {e}"),
            Self::CarattereAssente(c) => {
                write!(f, "il TTF non contiene '{c}' (U+{:04X})", *c as u32)
            }
            Self::AltezzaIrraggiungibile { voluta, ottenuta } => write!(
                f,
                "nessun corpo produce un'altezza di {voluta} px (il piu' vicino da' {ottenuta})"
            ),
            Self::NessunRiferimento => write!(
                f,
                "il font ospite non ha maiuscole latine: impossibile dedurre la dimensione dei glifi nuovi"
            ),
        }
    }
}

impl std::error::Error for Errore {}

/// Carica un TTF/OTF.
pub fn carica_ttf(dati: &[u8]) -> Result<TtfFont, Errore> {
    TtfFont::from_bytes(dati, FontSettings::default())
        .map_err(|e| Errore::TtfIllegibile(e.to_string()))
}

// ── Funzioni pure, provate senza TTF ──

/// Applica la soglia a una mappa di copertura e ne fa una bitmap binaria.
pub fn binarizza(copertura: &[u8], w: u16, h: u16, soglia: u8) -> Bitmap {
    let mut b = Bitmap::nuova(w, h);
    for y in 0..h {
        for x in 0..w {
            let i = y as usize * w as usize + x as usize;
            if copertura.get(i).is_some_and(|&c| c >= soglia) {
                b.set(x, y, true);
            }
        }
    }
    b
}

/// Toglie le righe e le colonne completamente spente ai bordi.
///
/// Serve perché il rasterizzatore restituisce il riquadro del glifo, che spesso
/// ha margini vuoti: tenerli sprecherebbe celle donatrici e sposterebbe la
/// lettera dentro il suo rettangolo.
pub fn ritaglia(b: &Bitmap) -> Bitmap {
    let (mut x0, mut y0) = (b.w, b.h);
    let (mut x1, mut y1) = (0i32 - 1, 0i32 - 1);
    for y in 0..b.h {
        for x in 0..b.w {
            if b.get(x, y) {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x as i32);
                y1 = y1.max(y as i32);
            }
        }
    }
    if x1 < 0 {
        // Nessun pixel acceso: bitmap vuota, non 0x0 con dimensioni assurde.
        return Bitmap::nuova(0, 0);
    }
    let (x1, y1) = (x1 as u16, y1 as u16);
    let mut out = Bitmap::nuova(x1 - x0 + 1, y1 - y0 + 1);
    for y in y0..=y1 {
        for x in x0..=x1 {
            if b.get(x, y) {
                out.set(x - x0, y - y0, true);
            }
        }
    }
    out
}

/// Altezza tipica delle maiuscole già presenti nel font ospite.
///
/// Si guarda l'altezza dichiarata dei glifi A–Z e se ne prende la **mediana**:
/// la media si farebbe trascinare da un glifo anomalo, il massimo da un
/// accento. Se il font non ha maiuscole latine non si indovina.
pub fn altezza_maiuscole(font: &Font) -> Result<u16, Errore> {
    let mut h: Vec<u16> = font
        .glyphs
        .iter()
        .filter(|g| (b'A' as u16..=b'Z' as u16).contains(&g.character))
        .map(|g| g.source_h)
        .filter(|&h| h > 0)
        .collect();
    if h.is_empty() {
        return Err(Errore::NessunRiferimento);
    }
    h.sort_unstable();
    Ok(h[h.len() / 2])
}

// ── Rasterizzazione ──

/// Rasterizza un carattere a un corpo dato, già binarizzato e ritagliato.
pub fn rasterizza(ttf: &TtfFont, c: char, corpo: f32, soglia: u8) -> Result<Bitmap, Errore> {
    if ttf.lookup_glyph_index(c) == 0 {
        return Err(Errore::CarattereAssente(c));
    }
    let (m, copertura) = ttf.rasterize(c, corpo);
    if m.width == 0 || m.height == 0 {
        // Spazio e simili: bitmap vuota, non un errore.
        return Ok(Bitmap::nuova(0, 0));
    }
    let b = binarizza(&copertura, m.width as u16, m.height as u16, soglia);
    Ok(ritaglia(&b))
}

/// Cerca il corpo in punti che produce glifi alti `altezza` pixel.
///
/// Si misura su una lettera di riferimento (una maiuscola senza discendenti) e
/// si procede per bisezione: il rapporto fra corpo e altezza resa non e'
/// lineare e cambia da font a font, quindi calcolarlo non funziona.
pub fn dimensione_per_altezza(
    ttf: &TtfFont,
    riferimento: char,
    altezza: u16,
    soglia: u8,
) -> Result<f32, Errore> {
    if ttf.lookup_glyph_index(riferimento) == 0 {
        return Err(Errore::CarattereAssente(riferimento));
    }
    let misura = |corpo: f32| -> u16 {
        let (m, cop) = ttf.rasterize(riferimento, corpo);
        if m.width == 0 || m.height == 0 {
            return 0;
        }
        ritaglia(&binarizza(&cop, m.width as u16, m.height as u16, soglia)).h
    };

    let (mut basso, mut alto) = (1.0f32, 256.0f32);
    let mut migliore = (basso, misura(basso));
    for _ in 0..24 {
        let medio = (basso + alto) / 2.0;
        let h = misura(medio);
        if (h as i32 - altezza as i32).abs() < (migliore.1 as i32 - altezza as i32).abs() {
            migliore = (medio, h);
        }
        if h == altezza {
            return Ok(medio);
        }
        if h < altezza {
            basso = medio;
        } else {
            alto = medio;
        }
    }

    // Un pixel di scarto e' accettabile: l'arrotondamento del rasterizzatore
    // non permette di fare meglio su corpi piccoli.
    if (migliore.1 as i32 - altezza as i32).abs() <= 1 {
        Ok(migliore.0)
    } else {
        Err(Errore::AltezzaIrraggiungibile { voluta: altezza, ottenuta: migliore.1 })
    }
}

// ── Test ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::gm_font::{Glyph, Tpag};

    fn font_con_maiuscole(altezze: &[(u16, u16)]) -> Font {
        Font {
            offset: 0,
            name: "fnt_prova".into(),
            range_start: 0x20,
            range_end: 0xFF9F,
            scostamento_glifi: 44,
            tpag: Some(Tpag {
                offset: 0,
                source_x: 0,
                source_y: 0,
                source_w: 256,
                source_h: 256,
                target_x: 0,
                target_y: 0,
                target_w: 256,
                target_h: 256,
                bounding_w: 256,
                bounding_h: 256,
                texture_index: 0,
            }),
            glyphs: altezze
                .iter()
                .enumerate()
                .map(|(i, &(ch, h))| Glyph {
                    offset: i * 16,
                    character: ch,
                    source_x: 0,
                    source_y: 0,
                    source_w: 8,
                    source_h: h,
                    shift: 9,
                    offset_x: 0,
                })
                .collect(),
        }
    }

    #[test]
    fn la_soglia_e_netta() {
        let cop = [0u8, 127, 128, 255];
        let b = binarizza(&cop, 4, 1, SOGLIA);
        assert_eq!((b.get(0, 0), b.get(1, 0), b.get(2, 0), b.get(3, 0)), (false, false, true, true));
    }

    #[test]
    fn binarizza_tollera_una_copertura_corta() {
        // Meno byte di quanti ne servano: i mancanti restano spenti invece di
        // far esplodere l'indice.
        let b = binarizza(&[255, 255], 4, 2, SOGLIA);
        assert_eq!(b.accesi(), 2);
        assert_eq!((b.w, b.h), (4, 2));
    }

    #[test]
    fn ritaglia_toglie_i_margini_vuoti() {
        let mut b = Bitmap::nuova(8, 8);
        b.set(3, 2, true);
        b.set(4, 5, true);
        let r = ritaglia(&b);
        assert_eq!((r.w, r.h), (2, 4), "riquadro da (3,2) a (4,5)");
        assert!(r.get(0, 0));
        assert!(r.get(1, 3));
        assert_eq!(r.accesi(), 2);
    }

    #[test]
    fn ritaglia_una_bitmap_vuota_da_zero_per_zero() {
        let r = ritaglia(&Bitmap::nuova(8, 8));
        assert_eq!((r.w, r.h), (0, 0));
        assert_eq!(r.accesi(), 0);
    }

    #[test]
    fn ritaglia_non_tocca_una_bitmap_gia_stretta() {
        let mut b = Bitmap::nuova(3, 2);
        for x in 0..3 {
            b.set(x, 0, true);
            b.set(x, 1, true);
        }
        let r = ritaglia(&b);
        assert_eq!((r.w, r.h), (3, 2));
        assert_eq!(r.accesi(), 6);
    }

    #[test]
    fn altezza_maiuscole_usa_la_mediana() {
        // Un glifo anomalo alto 40 non deve spostare il risultato.
        let f = font_con_maiuscole(&[
            (b'A' as u16, 12),
            (b'B' as u16, 12),
            (b'C' as u16, 13),
            (b'D' as u16, 40),
            (b'E' as u16, 12),
        ]);
        assert_eq!(altezza_maiuscole(&f).unwrap(), 12);
    }

    #[test]
    fn altezza_maiuscole_ignora_i_non_latini() {
        let f = font_con_maiuscole(&[(0x4E00, 16), (b'A' as u16, 11), (0x30A2, 16)]);
        assert_eq!(altezza_maiuscole(&f).unwrap(), 11);
    }

    #[test]
    fn senza_maiuscole_non_si_indovina() {
        let f = font_con_maiuscole(&[(0x4E00, 16), (0x4E01, 16)]);
        assert_eq!(altezza_maiuscole(&f), Err(Errore::NessunRiferimento));
    }

    /// Prova con un TTF vero. Serve un percorso in `GS_TTF`; il Noto scaricato
    /// da `font_installer` va benissimo:
    ///
    /// ```text
    /// GS_TTF=".../NotoSans-Regular.ttf" cargo test -- --ignored gm_glyph_raster
    /// ```
    #[test]
    #[ignore = "richiede GS_TTF con il percorso di un TTF"]
    fn rasterizza_il_cirillico_da_un_ttf_vero() {
        let percorso = match std::env::var("GS_TTF") {
            Ok(p) => p,
            Err(_) => return,
        };
        let dati = std::fs::read(&percorso).expect("TTF illeggibile");
        let ttf = carica_ttf(&dati).expect("il TTF non si carica");

        // Si punta all'altezza tipica di Deltarune per le maiuscole.
        const ALTEZZA: u16 = 12;
        let corpo = dimensione_per_altezza(&ttf, 'H', ALTEZZA, SOGLIA)
            .expect("nessun corpo produce l'altezza voluta");
        eprintln!("corpo scelto per {ALTEZZA}px: {corpo:.2}");

        // Le 66 lettere che servono al russo, più gli accenti italiani.
        let cirillico: Vec<char> = ('А'..='я').collect();
        let italiano = ['à', 'è', 'é', 'ì', 'ò', 'ù', 'À', 'È', 'É', 'Ì', 'Ò', 'Ù'];

        let mut max_w = 0u16;
        let mut vuoti = 0usize;
        for c in cirillico.iter().chain(italiano.iter()) {
            let b = rasterizza(&ttf, *c, corpo, SOGLIA)
                .unwrap_or_else(|e| panic!("'{c}': {e}"));
            if b.accesi() == 0 {
                vuoti += 1;
                continue;
            }
            max_w = max_w.max(b.w);
            assert!(b.h <= ALTEZZA + 3, "'{c}' alto {} px, troppo per una cella", b.h);
            // Binario davvero: la Bitmap non ha valori intermedi per
            // costruzione, ma qui si verifica che non sia tutta accesa.
            assert!(b.accesi() < (b.w as usize * b.h as usize), "'{c}' e' un blocco pieno");
        }
        eprintln!(
            "lettere rasterizzate: {}, larghezza massima {max_w} px, vuote {vuoti}",
            cirillico.len() + italiano.len()
        );
        assert_eq!(vuoti, 0, "qualche lettera e' uscita vuota");
    }

    #[test]
    #[ignore = "richiede GS_TTF con il percorso di un TTF"]
    fn un_carattere_assente_e_un_errore() {
        let percorso = match std::env::var("GS_TTF") {
            Ok(p) => p,
            Err(_) => return,
        };
        let dati = std::fs::read(&percorso).expect("TTF illeggibile");
        let ttf = carica_ttf(&dati).unwrap();
        // Area a uso privato: nessun font normale la copre.
        assert_eq!(
            rasterizza(&ttf, '\u{E123}', 16.0, SOGLIA),
            Err(Errore::CarattereAssente('\u{E123}'))
        );
    }
}
