//! Chunk `FONT` di `data.win`: elenco dei font e tabella dei glifi.
//!
//! Terzo strato di ADR-005, dopo [`crate::commands::gm_qoi`] (i pixel) e
//! [`crate::commands::gm_texture`] (il contenitore). Qui si legge — e si potrà
//! riscrivere — la tabella che dice al gioco **quale carattere** sta **in quale
//! rettangolo** dell'atlante.
//!
//! # La struttura, dalla fonte normativa
//!
//! Riferimento: `UndertaleModLib/Models/UndertaleFont.cs`.
//!
//! Il chunk è una lista con puntatori: `u32` di conteggio, poi altrettanti
//! `u32` che puntano alle entry. Ogni entry:
//!
//! ```text
//!  offset  campo                    tipo
//!       0  Name                     u32 (puntatore a STRG)
//!       4  DisplayName              u32 (puntatore a STRG)
//!       8  EmSize                   u32 (se ha il bit alto e' un float negato, GMS 2.3+)
//!      12  Bold                     u32  (i booleani qui sono a 4 byte)
//!      16  Italic                   u32
//!      20  RangeStart               u16
//!      22  Charset                  u8
//!      23  AntiAliasing             u8
//!      24  RangeEnd                 u32
//!      28  Texture                  u32 (puntatore a TPAG)
//!      32  ScaleX                   f32
//!      36  ScaleY                   f32
//!      40  [AscenderOffset]         i32  se bytecode >= 17
//!       +  [Ascender]               u32  se GM >= 2022.2
//!       +  [SDFSpread]              u32  se GM non-LTS >= 2023.2
//!       +  [LineHeight]             u32  se GM >= 2023.6
//!       +  Glyphs                   lista con puntatori
//! ```
//!
//! **I quattro campi opzionali sono il problema.** Non c'è un modo diretto di
//! sapere quali ci sono senza ricostruire la versione del runtime, che in
//! UndertaleModTool costa centinaia di righe di euristiche. Qui si fa come col
//! contenitore `2zoq`: invece di dedurre, si **misura**. Si provano i cinque
//! scostamenti possibili (40, 44, 48, 52, 56) e si tiene quello per cui la lista
//! dei glifi torna, cioè quello in cui il primo puntatore cade esattamente dopo
//! l'array dei puntatori. È un vincolo forte: su dati veri ne sopravvive uno.
//!
//! # Cosa serve a ADR-005
//!
//! Il glifo è **14 byte a campi fissi**:
//!
//! ```text
//!   0  Character     u16   <- il codepoint da riscrivere
//!   2  SourceX       u16
//!   4  SourceY       u16
//!   6  SourceWidth   u16
//!   8  SourceHeight  u16
//!  10  Shift         i16
//!  12  Offset        i16
//!  14  [UnknownAlwaysZero] i16, solo GM >= 2024.11
//!   +  Kerning       lista corta (i16 di conteggio + 4 byte per voce)
//! ```
//!
//! La coda di kerning è a lunghezza variabile, ma **i 14 byte che ci
//! interessano stanno a scostamento fisso dal puntatore del glifo**: si
//! raggiungono direttamente e si riscrivono senza spostare nulla. È questo che
//! rende l'iniezione possibile senza il rebuilder di ADR-004.

// Come gli altri due strati: per ora chiamano solo i test.
#![allow(dead_code)]

use crate::commands::gamemaker_patcher::parse_chunks;

/// Dimensione della parte a campi fissi di un glifo.
pub const GLYPH_FIXED: usize = 14;

/// Scostamenti possibili della lista glifi dall'inizio dell'entry del font.
/// 40 = nessun campo opzionale; ogni campo in piu' aggiunge 4 byte.
const SCOSTAMENTI: [usize; 5] = [40, 44, 48, 52, 56];

// ── Tipi ──

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Glyph {
    /// Offset assoluto del glifo dentro il `data.win`: e' qui che si scrive.
    pub offset: usize,
    pub character: u16,
    pub source_x: u16,
    pub source_y: u16,
    pub source_w: u16,
    pub source_h: u16,
    pub shift: i16,
    pub offset_x: i16,
}

/// Voce del chunk `TPAG`: la regione della texture occupata da una risorsa.
///
/// Struttura a 22 byte fissi (`UndertaleTexturePageItem`). Per un font indica
/// **dove comincia il suo riquadro** dentro la pagina, e su quale texture.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tpag {
    pub offset: usize,
    /// Origine della regione nella texture. Le coordinate dei glifi sono
    /// relative a QUESTA, non all'angolo della texture.
    pub source_x: u16,
    pub source_y: u16,
    pub source_w: u16,
    pub source_h: u16,
    pub target_x: u16,
    pub target_y: u16,
    pub target_w: u16,
    pub target_h: u16,
    pub bounding_w: u16,
    pub bounding_h: u16,
    /// Indice della texture nel chunk `TXTR`.
    pub texture_index: i16,
}

pub const TPAG_SIZE: usize = 22;

#[derive(Debug, Clone)]
pub struct Font {
    /// Offset assoluto dell'entry.
    pub offset: usize,
    pub name: String,
    pub range_start: u16,
    pub range_end: u32,
    /// Scostamento della lista glifi trovato per questa entry.
    pub scostamento_glifi: usize,
    /// Regione della texture su cui vive questo font.
    ///
    /// `None` se il puntatore e' nullo o fuori dal file. Senza questa, le
    /// coordinate dei glifi non sono utilizzabili per disegnare.
    pub tpag: Option<Tpag>,
    pub glyphs: Vec<Glyph>,
}

impl Font {
    /// Posizione ASSOLUTA di un glifo nella texture.
    ///
    /// **Misurato il 27/07 e non dedotto**: i `SourceX`/`SourceY` del glifo sono
    /// relativi all'origine della regione TPAG. Su `fnt_ja_main` di Deltarune i
    /// rettangoli dichiarati stanno in `x 1..1021, y 2..434`, cioe' dentro un
    /// riquadro di 1024x512 — mentre la regione vive a (2, 1030) nella texture.
    /// Disegnare alle coordinate grezze avrebbe scritto i glifi un migliaio di
    /// pixel piu' in alto, su tutt'altra parte dell'atlante.
    pub fn posizione_assoluta(&self, g: &Glyph) -> Option<(u16, u16)> {
        let t = self.tpag.as_ref()?;
        Some((t.source_x.checked_add(g.source_x)?, t.source_y.checked_add(g.source_y)?))
    }
}

impl Font {
    /// Cerca un glifo per codepoint.
    pub fn glifo(&self, ch: u16) -> Option<&Glyph> {
        self.glyphs.iter().find(|g| g.character == ch)
    }

    /// Quanti glifi cadono in un intervallo di codepoint.
    pub fn quanti_in(&self, da: u16, a: u16) -> usize {
        self.glyphs.iter().filter(|g| g.character >= da && g.character <= a).count()
    }

    /// I glifi utilizzabili come donatori: quelli il cui codepoint sta
    /// nell'intervallo dato e la cui cella e' abbastanza grande da ospitare un
    /// glifo nuovo di dimensione `w`×`h`.
    ///
    /// E' il passo che sceglie quali kanji sacrificare.
    pub fn donatori(&self, da: u16, a: u16, w: u16, h: u16) -> Vec<&Glyph> {
        self.glyphs
            .iter()
            .filter(|g| g.character >= da && g.character <= a)
            .filter(|g| g.source_w >= w && g.source_h >= h)
            .collect()
    }
}

#[derive(Debug)]
pub enum GmFontError {
    ChunkAssente,
    ChunkTroncato { serviva: usize, disponibile: usize },
    /// Nessuno dei cinque scostamenti produce una lista di glifi coerente.
    ScostamentoNonTrovato { entry: usize },
    /// Piu' di uno scostamento produce una lista coerente: la lettura non e'
    /// affidabile e non si tira a indovinare.
    ScostamentoAmbiguo { entry: usize, candidati: Vec<usize> },
    ListaIncoerente { entry: usize },
}

impl std::fmt::Display for GmFontError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ChunkAssente => write!(f, "nessun chunk FONT nel file"),
            Self::ChunkTroncato { serviva, disponibile } => {
                write!(f, "chunk FONT troncato: servivano {serviva} byte, disponibili {disponibile}")
            }
            Self::ScostamentoNonTrovato { entry } => write!(
                f,
                "entry a offset {entry}: nessuno scostamento fra 40 e 56 produce una lista glifi \
                 coerente — versione di GameMaker non prevista, font senza glifi, o entry malformata"
            ),
            Self::ScostamentoAmbiguo { entry, candidati } => write!(
                f,
                "entry a offset {entry}: la lista glifi risulta coerente a piu' scostamenti \
                 ({candidati:?}) — lettura ambigua, non si sceglie a caso"
            ),
            Self::ListaIncoerente { entry } => {
                write!(f, "entry a offset {entry}: la lista dei glifi non e' coerente")
            }
        }
    }
}

impl std::error::Error for GmFontError {}

// ── Lettura ──

#[inline]
fn u16_at(d: &[u8], p: usize) -> Option<u16> {
    Some(u16::from_le_bytes([*d.get(p)?, *d.get(p + 1)?]))
}

#[inline]
fn i16_at(d: &[u8], p: usize) -> Option<i16> {
    u16_at(d, p).map(|v| v as i16)
}

#[inline]
fn u32_at(d: &[u8], p: usize) -> Option<u32> {
    Some(u32::from_le_bytes([
        *d.get(p)?,
        *d.get(p + 1)?,
        *d.get(p + 2)?,
        *d.get(p + 3)?,
    ]))
}

/// Legge una stringa STRG dal puntatore: quattro byte di lunghezza subito prima
/// del contenuto, che e' terminato da zero.
fn stringa_da_puntatore(dati: &[u8], ptr: usize) -> String {
    if ptr < 4 || ptr >= dati.len() {
        return String::new();
    }
    let len = match u32_at(dati, ptr - 4) {
        Some(l) => l as usize,
        None => return String::new(),
    };
    let fine = ptr.saturating_add(len).min(dati.len());
    String::from_utf8_lossy(&dati[ptr..fine]).to_string()
}

/// Prova a leggere la lista glifi supponendo che cominci a `inizio`.
///
/// Restituisce i puntatori solo se la lista e' coerente: conteggio plausibile,
/// puntatori crescenti e dentro il file, e — vincolo decisivo — **il primo
/// puntatore deve cadere esattamente dopo l'array dei puntatori**. E' cosi' che
/// la struttura e' serializzata, e basta a distinguere lo scostamento giusto
/// dagli altri quattro.
fn prova_lista_glifi(dati: &[u8], inizio: usize, fine_chunk: usize) -> Option<Vec<usize>> {
    let count = u32_at(dati, inizio)? as usize;
    // Un font con piu' di 65.536 glifi non esiste.
    //
    // LIMITE DICHIARATO: si rifiuta anche `count == 0`. Un font senza glifi
    // sarebbe legittimo nel formato, ma quattro byte a zero sono esattamente
    // cio' che si legge cadendo su un campo opzionale non valorizzato — le due
    // cose non sono distinguibili, e accettarle faceva fermare il
    // riconoscimento allo scostamento sbagliato. Meglio non leggere un font
    // vuoto (che a noi non serve: non ha celle da riusare) che leggerne uno
    // pieno con lo scostamento sbagliato.
    if count == 0 || count > 65_536 {
        return None;
    }
    let fine_array = inizio.checked_add(4)?.checked_add(count.checked_mul(4)?)?;
    if fine_array > fine_chunk {
        return None;
    }

    let primo = u32_at(dati, inizio + 4)? as usize;
    if primo != fine_array {
        return None;
    }

    let mut ptr = Vec::with_capacity(count);
    let mut precedente = 0usize;
    for i in 0..count {
        let p = u32_at(dati, inizio + 4 + i * 4)? as usize;
        if p < fine_array || p + GLYPH_FIXED > fine_chunk || p < precedente {
            return None;
        }
        precedente = p;
        ptr.push(p);
    }
    Some(ptr)
}

/// Legge una voce TPAG dal suo puntatore. 22 byte a campi fissi.
fn leggi_tpag(dati: &[u8], p: usize) -> Option<Tpag> {
    if p == 0 || p + TPAG_SIZE > dati.len() {
        return None;
    }
    Some(Tpag {
        offset: p,
        source_x: u16_at(dati, p)?,
        source_y: u16_at(dati, p + 2)?,
        source_w: u16_at(dati, p + 4)?,
        source_h: u16_at(dati, p + 6)?,
        target_x: u16_at(dati, p + 8)?,
        target_y: u16_at(dati, p + 10)?,
        target_w: u16_at(dati, p + 12)?,
        target_h: u16_at(dati, p + 14)?,
        bounding_w: u16_at(dati, p + 16)?,
        bounding_h: u16_at(dati, p + 18)?,
        texture_index: i16_at(dati, p + 20)?,
    })
}

fn leggi_glifo(dati: &[u8], p: usize) -> Option<Glyph> {
    Some(Glyph {
        offset: p,
        character: u16_at(dati, p)?,
        source_x: u16_at(dati, p + 2)?,
        source_y: u16_at(dati, p + 4)?,
        source_w: u16_at(dati, p + 6)?,
        source_h: u16_at(dati, p + 8)?,
        shift: i16_at(dati, p + 10)?,
        offset_x: i16_at(dati, p + 12)?,
    })
}

/// Legge tutti i font di un `data.win`.
pub fn leggi_font(dati: &[u8]) -> Result<Vec<Font>, GmFontError> {
    let chunks = parse_chunks(dati);
    let (_, size, offset) = chunks
        .iter()
        .find(|(m, _, _)| m == "FONT")
        .ok_or(GmFontError::ChunkAssente)?;

    let inizio = *offset as usize;
    let fine = inizio + *size as usize;
    if fine > dati.len() {
        return Err(GmFontError::ChunkTroncato { serviva: fine, disponibile: dati.len() });
    }

    let count = u32_at(dati, inizio).unwrap_or(0) as usize;
    let mut font = Vec::with_capacity(count);

    for i in 0..count {
        let ptr = match u32_at(dati, inizio + 4 + i * 4) {
            Some(p) => p as usize,
            None => break,
        };
        if ptr + 40 > fine {
            continue;
        }

        // Lo scostamento della lista glifi si trova provando, non deducendo.
        // Si provano TUTTI gli scostamenti e se ne pretende esattamente uno.
        // Fermarsi al primo che funziona farebbe vincere un eventuale falso
        // positivo sulla risposta giusta, e nessuno se ne accorgerebbe: e'
        // successo davvero, con i campi opzionali a zero letti come "zero
        // glifi". Se ne sopravvivono due, la lettura e' ambigua e va detto.
        let candidati: Vec<(usize, Vec<usize>)> = SCOSTAMENTI
            .iter()
            .filter_map(|&s| prova_lista_glifi(dati, ptr + s, fine).map(|p| (s, p)))
            .collect();

        let (scostamento, puntatori) = match candidati.len() {
            0 => return Err(GmFontError::ScostamentoNonTrovato { entry: ptr }),
            1 => candidati.into_iter().next().unwrap(),
            _ => {
                return Err(GmFontError::ScostamentoAmbiguo {
                    entry: ptr,
                    candidati: candidati.iter().map(|(s, _)| *s).collect(),
                })
            }
        };

        let glyphs: Vec<Glyph> = puntatori.iter().filter_map(|&p| leggi_glifo(dati, p)).collect();
        if glyphs.len() != puntatori.len() {
            return Err(GmFontError::ListaIncoerente { entry: ptr });
        }

        font.push(Font {
            offset: ptr,
            name: stringa_da_puntatore(dati, u32_at(dati, ptr).unwrap_or(0) as usize),
            range_start: u16_at(dati, ptr + 20).unwrap_or(0),
            range_end: u32_at(dati, ptr + 24).unwrap_or(0),
            scostamento_glifi: scostamento,
            // Il puntatore alla regione TPAG sta a +28, subito dopo RangeEnd.
            tpag: leggi_tpag(dati, u32_at(dati, ptr + 28).unwrap_or(0) as usize),
            glyphs,
        });
    }

    Ok(font)
}

// ── Scrittura ──

/// Riordina IN PLACE i puntatori della lista glifi per codepoint crescente.
///
/// **La lezione del 28/07/2026, pagata con un crash all'avvio**: il runtime
/// GameMaker cerca i glifi con una RICERCA BINARIA sulla lista, che quindi
/// dev'essere ordinata per `character`. La tabella originale lo e'; ADR-005
/// pero' riscrive i `char` dei kanji (~U+4E00) con cirillico/accenti
/// (~U+0410 e sotto) lasciando i record al loro posto → lista non piu'
/// ordinata → il gioco crashava al primo disegno con un font `fnt_ja_*`
/// (in inglese partiva: quei font non venivano mai disegnati).
///
/// Il rimedio non sposta un byte dei record: si riordina SOLO l'array dei
/// puntatori (stessa lunghezza, stessi valori, altro ordine). Ogni record si
/// porta dietro il proprio kerning, che vive dopo i 14 byte fissi.
///
/// I `char` si rileggono dal buffer (non dalla struct `Font`, che puo' essere
/// stantia dopo `scrivi_glifo`). Ordinamento stabile: i duplicati non ballano.
pub fn riordina_puntatori_glifi(dati: &mut [u8], font: &Font) -> bool {
    let lista = font.offset + font.scostamento_glifi;
    if lista + 4 > dati.len() {
        return false;
    }
    let conteggio = u32::from_le_bytes([dati[lista], dati[lista + 1], dati[lista + 2], dati[lista + 3]]) as usize;
    if conteggio != font.glyphs.len() {
        return false; // la lista sul disco non combacia con cio' che crediamo di sapere
    }
    let inizio_array = lista + 4;
    let fine_array = inizio_array + conteggio * 4;
    if fine_array > dati.len() {
        return false;
    }

    // (char attuale, puntatore) per ogni voce, col char letto dal buffer.
    let mut voci: Vec<(u16, u32)> = Vec::with_capacity(conteggio);
    for i in 0..conteggio {
        let p = inizio_array + i * 4;
        let ptr = u32::from_le_bytes([dati[p], dati[p + 1], dati[p + 2], dati[p + 3]]);
        let rec = ptr as usize;
        if rec + 2 > dati.len() {
            return false;
        }
        let ch = u16::from_le_bytes([dati[rec], dati[rec + 1]]);
        voci.push((ch, ptr));
    }
    voci.sort_by_key(|(ch, _)| *ch);
    for (i, (_, ptr)) in voci.iter().enumerate() {
        let p = inizio_array + i * 4;
        dati[p..p + 4].copy_from_slice(&ptr.to_le_bytes());
    }
    true
}

/// Riscrive in place i 14 byte fissi di un glifo.
///
/// Non sposta nulla e non cambia la lunghezza del file: e' il gesto che ADR-005
/// usa per trasformare un kanji in una lettera cirillica.
pub fn scrivi_glifo(dati: &mut [u8], g: &Glyph) -> bool {
    let p = g.offset;
    if p + GLYPH_FIXED > dati.len() {
        return false;
    }
    dati[p..p + 2].copy_from_slice(&g.character.to_le_bytes());
    dati[p + 2..p + 4].copy_from_slice(&g.source_x.to_le_bytes());
    dati[p + 4..p + 6].copy_from_slice(&g.source_y.to_le_bytes());
    dati[p + 6..p + 8].copy_from_slice(&g.source_w.to_le_bytes());
    dati[p + 8..p + 10].copy_from_slice(&g.source_h.to_le_bytes());
    dati[p + 10..p + 12].copy_from_slice(&g.shift.to_le_bytes());
    dati[p + 12..p + 14].copy_from_slice(&g.offset_x.to_le_bytes());
    true
}

// ── Test ──

#[cfg(test)]
mod tests {
    use super::*;

    /// Costruisce un `data.win` minimo con un solo font, per provare il
    /// riconoscimento dello scostamento senza avere il file vero.
    fn data_win_finto(campi_opzionali: usize, glifi: &[(u16, u16, u16)]) -> Vec<u8> {
        // Il chunk FONT: count, puntatore all'entry, entry, lista glifi.
        let inizio_chunk = 8usize; // dopo FORM+size
        let dati_chunk = inizio_chunk + 8; // dopo FONT+size

        let entry = dati_chunk + 4 + 4; // dopo count + 1 puntatore
        let lista = entry + 40 + campi_opzionali * 4;
        let primo_glifo = lista + 4 + glifi.len() * 4;

        let mut d = vec![0u8; primo_glifo + glifi.len() * (GLYPH_FIXED + 2)];

        // Lista glifi
        d[lista..lista + 4].copy_from_slice(&(glifi.len() as u32).to_le_bytes());
        for (i, (ch, w, h)) in glifi.iter().enumerate() {
            let p = primo_glifo + i * (GLYPH_FIXED + 2);
            d[lista + 4 + i * 4..lista + 8 + i * 4].copy_from_slice(&(p as u32).to_le_bytes());
            d[p..p + 2].copy_from_slice(&ch.to_le_bytes());
            d[p + 6..p + 8].copy_from_slice(&w.to_le_bytes());
            d[p + 8..p + 10].copy_from_slice(&h.to_le_bytes());
            // due byte di "kerning vuoto" dopo i 14 fissi
        }

        // Entry: RangeStart a +20, RangeEnd a +24
        d[entry + 20..entry + 22].copy_from_slice(&0x20u16.to_le_bytes());
        d[entry + 24..entry + 28].copy_from_slice(&0xFF9Fu32.to_le_bytes());

        // Puntatore all'entry + conteggio font
        d[dati_chunk..dati_chunk + 4].copy_from_slice(&1u32.to_le_bytes());
        d[dati_chunk + 4..dati_chunk + 8].copy_from_slice(&(entry as u32).to_le_bytes());

        // Intestazioni IFF
        let dim_chunk = d.len() - dati_chunk;
        d[inizio_chunk..inizio_chunk + 4].copy_from_slice(b"FONT");
        d[inizio_chunk + 4..inizio_chunk + 8].copy_from_slice(&(dim_chunk as u32).to_le_bytes());
        d[0..4].copy_from_slice(b"FORM");
        let dim_form = (d.len() - 8) as u32;
        d[4..8].copy_from_slice(&dim_form.to_le_bytes());
        d
    }

    #[test]
    fn nessun_chunk_font() {
        assert!(matches!(leggi_font(&[]), Err(GmFontError::ChunkAssente)));
        assert!(matches!(leggi_font(b"FORM\0\0\0\0"), Err(GmFontError::ChunkAssente)));
    }

    /// Il cuore del modulo: lo scostamento si riconosce da solo, per tutte e
    /// cinque le combinazioni di campi opzionali.
    #[test]
    fn lo_scostamento_si_riconosce_da_solo() {
        for opz in 0..=4usize {
            let d = data_win_finto(opz, &[(0x41, 8, 12), (0x42, 8, 12)]);
            let font = leggi_font(&d).unwrap_or_else(|e| panic!("{opz} opzionali: {e}"));
            assert_eq!(font.len(), 1);
            assert_eq!(
                font[0].scostamento_glifi,
                40 + opz * 4,
                "con {opz} campi opzionali lo scostamento atteso e' {}",
                40 + opz * 4
            );
            assert_eq!(font[0].glyphs.len(), 2);
            assert_eq!(font[0].glyphs[0].character, 0x41);
            assert_eq!(font[0].glyphs[1].character, 0x42);
        }
    }

    /// Regressione 28/07/2026: dopo l'iniezione i codepoint cambiano (kanji→
    /// cirillico) e la lista puntatori DEVE tornare ordinata per `character`,
    /// perche' il runtime GameMaker fa ricerca binaria. Senza riordino il gioco
    /// crashava all'avvio in giapponese — e partiva in inglese, dove i font
    /// modificati non si disegnano mai.
    #[test]
    fn il_riordino_ripristina_l_ordine_dei_puntatori() {
        // Tabella ordinata: A, B, C (come la produce GameMaker).
        let mut d = data_win_finto(1, &[(0x41, 8, 12), (0x42, 8, 12), (0x43, 8, 12)]);
        let font = leggi_font(&d).unwrap().remove(0);

        // ADR-005 in miniatura: 'B' (in mezzo) diventa 'я' (U+044F, in coda).
        let mut nuovo = font.glyphs[1].clone();
        nuovo.character = 0x044F;
        assert!(scrivi_glifo(&mut d, &nuovo));

        // Ora la lista e' A, я, C: NON ordinata. Il riordino deve dare A, C, я.
        assert!(riordina_puntatori_glifi(&mut d, &font));
        let dopo = leggi_font(&d).unwrap().remove(0);
        let chars: Vec<u16> = dopo.glyphs.iter().map(|g| g.character).collect();
        assert_eq!(chars, vec![0x41, 0x43, 0x044F], "puntatori riordinati per codepoint");

        // Idempotente: riordinare una lista gia' ordinata non cambia nulla.
        let prima = d.clone();
        assert!(riordina_puntatori_glifi(&mut d, &dopo));
        assert_eq!(prima, d);
    }

    #[test]
    fn legge_range_e_metriche() {
        let d = data_win_finto(1, &[(0x0410, 16, 20)]);
        let font = leggi_font(&d).unwrap();
        assert_eq!(font[0].range_start, 0x20);
        assert_eq!(font[0].range_end, 0xFF9F);
        let g = &font[0].glyphs[0];
        assert_eq!(g.character, 0x0410);
        assert_eq!((g.source_w, g.source_h), (16, 20));
    }

    /// LIMITE DICHIARATO: un font con zero glifi non e' riconoscibile.
    ///
    /// Quattro byte a zero sono indistinguibili da un campo opzionale non
    /// valorizzato, quindi il riconoscimento dello scostamento non ha appigli.
    /// Il modulo rifiuta invece di indovinare — a noi un font vuoto non serve
    /// comunque, perche' non ha celle da riusare. Questo test esiste per fissare
    /// il comportamento: se un domani diventasse necessario leggerli, servira'
    /// un discriminante diverso, non un allentamento del controllo.
    #[test]
    fn font_senza_glifi_non_e_riconoscibile() {
        let d = data_win_finto(1, &[]);
        assert!(matches!(
            leggi_font(&d),
            Err(GmFontError::ScostamentoNonTrovato { .. })
        ));
    }

    /// Il vincolo sul primo puntatore deve essere davvero discriminante: una
    /// lista che dichiara un conteggio plausibile ma il cui primo puntatore non
    /// cade dopo l'array va rifiutata.
    #[test]
    fn primo_puntatore_fuori_posto_viene_rifiutato() {
        let mut d = data_win_finto(1, &[(0x41, 8, 12), (0x42, 8, 12)]);
        let font = leggi_font(&d).unwrap();
        let lista = font[0].offset + font[0].scostamento_glifi;

        // Si sposta il primo puntatore di quattro byte: la lista non torna piu'.
        let vecchio = u32_at(&d, lista + 4).unwrap();
        d[lista + 4..lista + 8].copy_from_slice(&(vecchio + 4).to_le_bytes());
        assert!(matches!(
            leggi_font(&d),
            Err(GmFontError::ScostamentoNonTrovato { .. })
        ));
    }

    #[test]
    fn ricerca_per_codepoint_e_donatori() {
        let d = data_win_finto(1, &[(0x4E00, 16, 16), (0x4E01, 8, 8), (0x0410, 16, 16)]);
        let font = leggi_font(&d).unwrap();

        assert_eq!(font[0].glifo(0x4E00).map(|g| g.character), Some(0x4E00));
        assert!(font[0].glifo(0xFFFF).is_none());

        // Due kanji nell'intervallo CJK, di cui uno solo abbastanza capiente.
        assert_eq!(font[0].quanti_in(0x4E00, 0x9FFF), 2);
        let don = font[0].donatori(0x4E00, 0x9FFF, 16, 16);
        assert_eq!(don.len(), 1, "solo la cella 16x16 puo' ospitare un glifo 16x16");
        assert_eq!(don[0].character, 0x4E00);
    }

    /// Riscrivere un glifo non cambia la lunghezza del file e tocca solo i suoi
    /// 14 byte: e' la proprieta' su cui poggia tutto ADR-005.
    #[test]
    fn riscrivere_un_glifo_non_sposta_niente() {
        let mut d = data_win_finto(1, &[(0x4E00, 16, 16), (0x4E01, 16, 16)]);
        let lunghezza = d.len();
        let prima = d.clone();

        let font = leggi_font(&d).unwrap();
        let mut g = font[0].glyphs[0].clone();
        let p = g.offset;
        // Il kanji diventa una А cirillica.
        g.character = 0x0410;
        g.shift = 17;
        assert!(scrivi_glifo(&mut d, &g));

        assert_eq!(d.len(), lunghezza, "la lunghezza del file non deve cambiare");
        // Fuori dai 14 byte del glifo non e' cambiato nulla.
        assert_eq!(&d[..p], &prima[..p]);
        assert_eq!(&d[p + GLYPH_FIXED..], &prima[p + GLYPH_FIXED..]);

        // E rileggendo si trova la lettera nuova al posto del kanji.
        let dopo = leggi_font(&d).unwrap();
        assert!(dopo[0].glifo(0x4E00).is_none(), "il kanji doveva sparire");
        let nuovo = dopo[0].glifo(0x0410).expect("la А cirillica doveva comparire");
        assert_eq!(nuovo.shift, 17);
        assert_eq!((nuovo.source_w, nuovo.source_h), (16, 16), "la cella resta la stessa");
    }

    #[test]
    fn scrivi_glifo_fuori_bordo_non_scrive() {
        let mut d = vec![0u8; 10];
        let g = Glyph {
            offset: 0,
            character: 1,
            source_x: 0,
            source_y: 0,
            source_w: 0,
            source_h: 0,
            shift: 0,
            offset_x: 0,
        };
        assert!(!scrivi_glifo(&mut d, &g), "14 byte non entrano in 10");
        assert_eq!(d, vec![0u8; 10], "e non deve aver scritto niente");
    }

    /// ESPERIMENTO, non un'asserzione: disegna i rettangoli dichiarati dai
    /// glifi sopra l'atlante vero e salva due PNG da guardare.
    ///
    /// Serve a togliere UNA incognita prima di scrivere il codice che disegna:
    /// `SourceX`/`SourceY` sono coordinate assolute nella texture, o relative
    /// alla regione TPAG del font? Dedurlo dalla documentazione non basta —
    /// nella storia di questo ADR l'unico errore vero è stato smascherato
    /// guardando un'immagine, non leggendo una specifica.
    ///
    /// ```text
    /// GS_GM_DATA_WIN=... cargo test -- --ignored sovrapponi_rettangoli
    /// ```
    ///
    /// Produce, nella cartella corrente:
    ///   - `atlante-fnt_ja_main.png`      — l'atlante così com'è
    ///   - `atlante-fnt_ja_main-rette.png` — con i rettangoli in rosso
    ///
    /// **Se i rettangoli inquadrano i glifi, le coordinate sono assolute** e si
    /// può disegnare direttamente. Se sono spostati di un offset costante,
    /// quello è l'origine della regione TPAG e va letta. Se sono sparsi a caso,
    /// la texture scelta è quella sbagliata.
    #[test]
    #[ignore = "esperimento visivo: richiede GS_GM_DATA_WIN"]
    fn sovrapponi_rettangoli_sull_atlante() {
        use crate::commands::gm_texture;

        // L'atlante individuato il 27/07 misurando le distanze fra le texture.
        const OFFSET_ATLANTE: usize = 33_632_000;
        const BLOB_ATLANTE: usize = 230_272;

        let percorso = match std::env::var("GS_GM_DATA_WIN") {
            Ok(p) => p,
            Err(_) => return,
        };
        let dati = std::fs::read(&percorso).expect("impossibile leggere il data.win");
        if dati.len() < OFFSET_ATLANTE + BLOB_ATLANTE {
            eprintln!("non è la demo di Deltarune, si salta");
            return;
        }

        let tex = gm_texture::leggi(&dati[OFFSET_ATLANTE..OFFSET_ATLANTE + BLOB_ATLANTE])
            .expect("l'atlante non si legge");
        let font = leggi_font(&dati).expect("chunk FONT illeggibile");
        let f = font
            .iter()
            .find(|f| f.name == "fnt_ja_main")
            .expect("fnt_ja_main non trovato");

        let (w, h) = (tex.image.width as u32, tex.image.height as u32);

        // L'atlante e' BGRA; l'immagine da salvare vuole RGBA.
        let mut rgba = Vec::with_capacity((w * h * 4) as usize);
        for px in tex.image.bgra.chunks_exact(4) {
            rgba.extend_from_slice(&[px[2], px[1], px[0], 255]);
        }
        // I PNG vanno in target/, che e' gia' ignorato da git: scriverli nella
        // cartella corrente li lascerebbe in `git status` a rischio di
        // finire in un commit.
        let dir = std::path::Path::new("target").join("adr005");
        std::fs::create_dir_all(&dir).expect("impossibile creare target/adr005");

        let originale = image::RgbaImage::from_raw(w, h, rgba.clone())
            .expect("dimensioni incoerenti");
        originale
            .save(dir.join("atlante-fnt_ja_main.png"))
            .expect("salvataggio dell'atlante fallito");

        // Bordi rossi sui rettangoli dichiarati.
        let mut segna = |x: i64, y: i64| {
            if x >= 0 && y >= 0 && (x as u32) < w && (y as u32) < h {
                let i = ((y as u32 * w + x as u32) * 4) as usize;
                rgba[i] = 255;
                rgba[i + 1] = 0;
                rgba[i + 2] = 0;
                rgba[i + 3] = 255;
            }
        };
        let mut fuori = 0usize;
        for g in &f.glyphs {
            // Coordinate ASSOLUTE: relative + origine della regione TPAG.
            let (ax, ay) = f
                .posizione_assoluta(g)
                .expect("senza TPAG non si sa dove disegnare");
            let (x0, y0) = (ax as i64, ay as i64);
            let (x1, y1) = (x0 + g.source_w as i64 - 1, y0 + g.source_h as i64 - 1);
            if x1 >= w as i64 || y1 >= h as i64 {
                fuori += 1;
                continue;
            }
            for x in x0..=x1 {
                segna(x, y0);
                segna(x, y1);
            }
            for y in y0..=y1 {
                segna(x0, y);
                segna(x1, y);
            }
        }

        image::RgbaImage::from_raw(w, h, rgba)
            .expect("dimensioni incoerenti")
            .save(dir.join("atlante-fnt_ja_main-rette.png"))
            .expect("salvataggio della sovrapposizione fallito");

        // Qualche numero utile a leggere le immagini.
        let t = f.tpag.as_ref().expect("fnt_ja_main senza TPAG");
        eprintln!("atlante {w}x{h}, glifi {}", f.glyphs.len());
        eprintln!(
            "regione TPAG: {}x{} a ({}, {}), texture #{}",
            t.source_w, t.source_h, t.source_x, t.source_y, t.texture_index
        );
        let min_x = f.glyphs.iter().map(|g| g.source_x).min().unwrap_or(0);
        let min_y = f.glyphs.iter().map(|g| g.source_y).min().unwrap_or(0);
        let max_x = f.glyphs.iter().map(|g| g.source_x + g.source_w).max().unwrap_or(0);
        let max_y = f.glyphs.iter().map(|g| g.source_y + g.source_h).max().unwrap_or(0);
        eprintln!("glifi, coordinate RELATIVE: x {min_x}..{max_x}, y {min_y}..{max_y}");
        eprintln!(
            "glifi, coordinate ASSOLUTE:  x {}..{}, y {}..{}, fuori dai bordi: {fuori}",
            min_x + t.source_x,
            max_x + t.source_x,
            min_y + t.source_y,
            max_y + t.source_y
        );
        eprintln!("PNG salvati in: {:?}", dir.canonicalize().unwrap_or(dir.clone()));
    }

    /// Verifica sul `data.win` vero. Stessa attivazione degli altri:
    /// `GS_GM_DATA_WIN=... cargo test -- --ignored gm_font`
    ///
    /// I conteggi attesi vengono dall'analisi del 26/07 (ADR-005): se questo
    /// passa, il lettore concorda con una misura fatta con un altro strumento.
    #[test]
    #[ignore = "richiede GS_GM_DATA_WIN con il percorso di un data.win reale"]
    fn font_di_deltarune() {
        let percorso = match std::env::var("GS_GM_DATA_WIN") {
            Ok(p) => p,
            Err(_) => return,
        };
        let dati = std::fs::read(&percorso).expect("impossibile leggere il data.win");
        let font = leggi_font(&dati).expect("lettura del chunk FONT fallita");

        eprintln!("font trovati: {}", font.len());
        for f in &font {
            eprintln!(
                "  {:<16} glifi {:>5}  range 0x{:04X}..0x{:04X}  scostamento {}  \
                 ascii {:>3} cirillico {:>4} kana {:>4} kanji {:>5}",
                f.name,
                f.glyphs.len(),
                f.range_start,
                f.range_end,
                f.scostamento_glifi,
                f.quanti_in(0x20, 0x7E),
                f.quanti_in(0x0400, 0x04FF),
                f.quanti_in(0x3040, 0x30FF),
                f.quanti_in(0x4E00, 0x9FFF),
            );
        }

        assert!(!font.is_empty(), "nessun font letto");

        // Tutte le entry devono aver trovato lo STESSO scostamento: e' un solo
        // file, quindi una sola versione di runtime. Se divergono, il
        // riconoscimento ha preso un abbaglio su qualche entry.
        let primo = font[0].scostamento_glifi;
        assert!(
            font.iter().all(|f| f.scostamento_glifi == primo),
            "scostamenti diversi nello stesso file: riconoscimento inaffidabile"
        );

        // I numeri misurati il 26/07, se questo e' Deltarune.
        for f in &font {
            match f.name.as_str() {
                "fnt_main" | "fnt_small" => {
                    assert_eq!(f.glyphs.len(), 96, "{}: glifi attesi 96", f.name);
                    assert_eq!(f.quanti_in(0x0400, 0x04FF), 0, "{}: cirillico atteso 0", f.name);
                }
                "fnt_ja_main" => {
                    assert_eq!(f.glyphs.len(), 1768, "fnt_ja_main: glifi attesi 1768");
                    assert_eq!(f.quanti_in(0x0400, 0x04FF), 0, "fnt_ja_main: cirillico atteso 0");
                }
                "fnt_ja_small" => {
                    assert_eq!(f.glyphs.len(), 1714, "fnt_ja_small: glifi attesi 1714");
                }
                _ => {}
            }
        }
    }
}
