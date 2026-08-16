//! Iniezione di glifi in un font GameMaker: scelta dei donatori e disegno.
//!
//! Quarto strato di ADR-005, sopra [`gm_qoi`](crate::commands::gm_qoi) (pixel),
//! [`gm_texture`](crate::commands::gm_texture) (contenitore) e
//! [`gm_font`](crate::commands::gm_font) (tabella).
//!
//! # Cosa fa, in una riga
//!
//! Prende delle lettere che il font non ha, sceglie altrettanti glifi che non
//! servono (i kanji, per chi installa una patch russa o italiana), **riscrive i
//! loro pixel** nell'atlante e **cambia il loro codepoint** nella tabella.
//! Niente cambia dimensione, quindi nessun offset del `data.win` si sposta.
//!
//! # Cosa NON fa
//!
//! Non rasterizza: le immagini dei glifi arrivano già pronte come [`Bitmap`]
//! binarie. È deliberato — la sorgente (un TTF via `font_installer`, o bitmap
//! disegnate a mano per rispettare uno stile pixel-art) è una scelta che
//! cambierà, e non deve trascinarsi dietro il resto.
//!
//! E non scrive su disco: [`applica`] lavora su un atlante in memoria e su una
//! copia dei byte del `data.win`. Ricomprimere, verificare il budget e salvare
//! con backup sono compiti del comando Tauri, ancora da scrivere.
//!
//! # I tre vincoli che governano tutto
//!
//! 1. **Il glifo nuovo deve stare nella cella del donatore.** Non si può
//!    allargare un rettangolo senza spostare i vicini nell'atlante.
//! 2. **I pixel sono bicolore**, `[0,0,0,0]` o `[255,255,255,255]`: niente
//!    antialiasing. Scriverli sfumati fa crescere il blob compresso oltre il
//!    budget — misurato, +4.256 byte (ADR-005, verifica del 26/07).
//! 3. **Le coordinate dei glifi sono relative alla regione TPAG**, non alla
//!    texture. Qui si usa sempre [`gm_font::Font::posizione_assoluta`].

#![allow(dead_code)]

use crate::commands::gm_font::{self, Font, Glyph};
use crate::commands::gm_qoi::GmImage;

/// Pixel acceso e pixel spento nell'atlante. Non ci sono valori intermedi.
const ACCESO: [u8; 4] = [255, 255, 255, 255];
const SPENTO: [u8; 4] = [0, 0, 0, 0];

// ── Tipi ──

/// Immagine binaria di un glifo: `on[y * w + x]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bitmap {
    pub w: u16,
    pub h: u16,
    pub on: Vec<bool>,
}

impl Bitmap {
    pub fn nuova(w: u16, h: u16) -> Self {
        Self { w, h, on: vec![false; w as usize * h as usize] }
    }

    pub fn set(&mut self, x: u16, y: u16, acceso: bool) {
        if x < self.w && y < self.h {
            let i = y as usize * self.w as usize + x as usize;
            self.on[i] = acceso;
        }
    }

    pub fn get(&self, x: u16, y: u16) -> bool {
        if x >= self.w || y >= self.h {
            return false;
        }
        self.on[y as usize * self.w as usize + x as usize]
    }

    /// Quanti pixel accesi: serve a scartare i glifi vuoti.
    pub fn accesi(&self) -> usize {
        self.on.iter().filter(|&&b| b).count()
    }
}

/// Una lettera da aggiungere al font.
#[derive(Debug, Clone)]
pub struct Richiesta {
    /// Codepoint che il glifo dovrà avere (es. 0x0410 per А, 0x00E0 per à).
    pub carattere: u16,
    pub bitmap: Bitmap,
    /// Quanto avanzare dopo averlo disegnato. Se `None` si usa
    /// `bitmap.w + 1`, che è la convenzione dei font bitmap di GameMaker.
    pub shift: Option<i16>,
}

/// Cosa si intende fare, prima di farlo.
///
/// Il piano si calcola e si ispeziona **senza toccare niente**: e' l'unico
/// modo di sapere in anticipo se l'operazione e' realizzabile.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Piano {
    /// `(indice del glifo donatore, indice della richiesta)`.
    pub assegnazioni: Vec<(usize, usize)>,
    /// Donatori rimasti, da svuotare per liberare spazio compresso.
    ///
    /// E' la "strategia B" di ADR-005: togliere transizioni al disegno riduce
    /// il blob molto piu' di quanto lo riduca togliere pixel accesi.
    pub da_svuotare: Vec<usize>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Errore {
    /// Il font non ha la regione TPAG: senza, non si sa dove disegnare.
    TpagAssente,
    /// Non ci sono abbastanza celle libere e capienti.
    ///
    /// Porta con se' le misure che servono a capire il perche': senza sapere
    /// quanto era grande il glifo che non entrava e quanto e' la cella piu'
    /// capiente, "trovate 0" su un font con 1.296 kanji non e' una diagnosi.
    DonatoriInsufficienti {
        servono: usize,
        trovati: usize,
        /// Dimensione del glifo che non ha trovato posto.
        serviva: (u16, u16),
        /// La cella libera piu' capiente rimasta.
        cella_piu_grande: (u16, u16),
    },
    /// Una lettera richiesta esiste gia' nel font: sovrascriverla sarebbe un
    /// errore silenzioso.
    CarattereGiaPresente { carattere: u16 },
    /// La bitmap non entra nella cella assegnata.
    BitmapTroppoGrande { carattere: u16, bitmap: (u16, u16), cella: (u16, u16) },
    /// La cella cade fuori dall'atlante.
    CellaFuoriDallAtlante { carattere: u16, x: u16, y: u16 },
    /// La lista puntatori dei glifi non combacia col buffer: il riordino
    /// post-iniezione (obbligatorio: il runtime fa ricerca binaria) non è
    /// applicabile in sicurezza.
    TabellaGlifiIncoerente { font: String },
}

impl std::fmt::Display for Errore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TpagAssente => write!(f, "il font non ha una regione TPAG: non si sa dove disegnare"),
            Self::DonatoriInsufficienti { servono, trovati, serviva, cella_piu_grande } => write!(
                f,
                "servivano {servono} celle riusabili, assegnate {trovati}: un glifo di {}x{} px \
                 non entra nella cella libera piu' grande, che e' {}x{} px. \
                 Rimpicciolire i glifi, o allargare l'insieme dei donatori",
                serviva.0, serviva.1, cella_piu_grande.0, cella_piu_grande.1
            ),
            Self::CarattereGiaPresente { carattere } => write!(
                f,
                "il font contiene gia' il carattere U+{carattere:04X}: non lo si sovrascrive"
            ),
            Self::BitmapTroppoGrande { carattere, bitmap, cella } => write!(
                f,
                "U+{carattere:04X}: il glifo e' {}x{} ma la cella e' {}x{}",
                bitmap.0, bitmap.1, cella.0, cella.1
            ),
            Self::CellaFuoriDallAtlante { carattere, x, y } => {
                write!(f, "U+{carattere:04X}: la cella a ({x}, {y}) cade fuori dall'atlante")
            }
            Self::TabellaGlifiIncoerente { font } => write!(
                f,
                "'{font}': la lista puntatori dei glifi non combacia col file, riordino non applicabile"
            ),
        }
    }
}

impl std::error::Error for Errore {}

// ── Pianificazione ──

/// Intervallo CJK unificato: i kanji, che sono i donatori naturali.
pub const KANJI: (u16, u16) = (0x4E00, 0x9FFF);

/// Sceglie quali glifi sacrificare per quali lettere.
///
/// I donatori si prendono nell'intervallo `donatori`, ordinati **dal piu'
/// grande al piu' piccolo**: cosi' le lettere trovano posto anche quando le
/// celle hanno dimensioni molto diverse, invece di esaurire le celle capienti
/// su glifi che non ne avevano bisogno.
///
/// `svuota_resto` mette in piano lo svuotamento dei donatori non usati.
pub fn pianifica(
    font: &Font,
    richieste: &[Richiesta],
    donatori: (u16, u16),
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    // Firma e comportamento IDENTICI a prima del 16/08: il percorso kanji e'
    // provato in-game su Deltarune e non si tocca. Cambia solo la forma —
    // l'intervallo diventa un predicato, cosi' la stessa pianificazione serve
    // anche ai font latini, dove i donatori non sono un intervallo contiguo.
    pianifica_con_predicato(
        font,
        richieste,
        &|c| c >= donatori.0 && c <= donatori.1,
        svuota_resto,
    )
}

/// Come [`pianifica`], ma i donatori sono una **lista esplicita** di codepoint.
///
/// Serve ai font latini (16/08: la traduzione italiana di Deltarune vive nello
/// slot inglese, disegnato da `fnt_main` e soci, che non hanno kanji): li' non
/// esiste un intervallo di glifi sacrificabili, esistono i candidati misurati
/// sul corpus del gioco. Con `svuota_resto` si svuotano SOLO i candidati della
/// lista rimasti inutilizzati — gli altri glifi del font sono testo vivo e
/// nessuno deve toccarli.
pub fn pianifica_da_lista(
    font: &Font,
    richieste: &[Richiesta],
    candidati: &[u16],
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    let insieme: std::collections::HashSet<u16> = candidati.iter().copied().collect();
    pianifica_con_predicato(font, richieste, &|c| insieme.contains(&c), svuota_resto)
}

/// L'implementazione vera: chi e' donatore lo decide il predicato.
///
/// L'ordinamento per capienza resta qui dentro (dal piu' grande al piu'
/// piccolo, con `sort_by_key` stabile): a parita' di area l'ordine dei glifi
/// nel font decide, quindi due esecuzioni identiche producono lo stesso piano.
fn pianifica_con_predicato(
    font: &Font,
    richieste: &[Richiesta],
    e_donatore: &dyn Fn(u16) -> bool,
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    if font.tpag.is_none() {
        return Err(Errore::TpagAssente);
    }

    for r in richieste {
        if font.glifo(r.carattere).is_some() {
            return Err(Errore::CarattereGiaPresente { carattere: r.carattere });
        }
    }

    // Indici dei possibili donatori, dal piu' capiente al meno.
    let mut candidati: Vec<usize> = font
        .glyphs
        .iter()
        .enumerate()
        .filter(|(_, g)| e_donatore(g.character))
        .map(|(i, _)| i)
        .collect();
    candidati.sort_by_key(|&i| {
        let g = &font.glyphs[i];
        std::cmp::Reverse((g.source_w as u32) * (g.source_h as u32))
    });

    // Le richieste si servono dalla piu' ingombrante: e' l'accoppiamento che
    // fallisce piu' tardi possibile.
    let mut ordine: Vec<usize> = (0..richieste.len()).collect();
    ordine.sort_by_key(|&i| {
        std::cmp::Reverse((richieste[i].bitmap.w as u32) * (richieste[i].bitmap.h as u32))
    });

    let mut assegnazioni = Vec::with_capacity(richieste.len());
    let mut usati = vec![false; font.glyphs.len()];

    for &ir in &ordine {
        let b = &richieste[ir].bitmap;
        let scelto = candidati.iter().find(|&&ic| {
            !usati[ic] && font.glyphs[ic].source_w >= b.w && font.glyphs[ic].source_h >= b.h
        });
        match scelto {
            Some(&ic) => {
                usati[ic] = true;
                assegnazioni.push((ic, ir));
            }
            None => {
                let piu_grande = candidati
                    .iter()
                    .filter(|&&ic| !usati[ic])
                    .map(|&ic| (font.glyphs[ic].source_w, font.glyphs[ic].source_h))
                    .max_by_key(|(w, h)| (*w as u32) * (*h as u32))
                    .unwrap_or((0, 0));
                return Err(Errore::DonatoriInsufficienti {
                    servono: richieste.len(),
                    trovati: assegnazioni.len(),
                    serviva: (b.w, b.h),
                    cella_piu_grande: piu_grande,
                });
            }
        }
    }

    let da_svuotare = if svuota_resto {
        candidati.iter().copied().filter(|&i| !usati[i]).collect()
    } else {
        Vec::new()
    };

    // Ordine stabile, cosi' due esecuzioni identiche producono lo stesso file.
    assegnazioni.sort_unstable();
    Ok(Piano { assegnazioni, da_svuotare })
}

// ── Applicazione ──

/// Spegne tutti i pixel della cella di un glifo.
fn svuota_cella(atlante: &mut GmImage, font: &Font, g: &Glyph) -> bool {
    let (ax, ay) = match font.posizione_assoluta(g) {
        Some(p) => p,
        None => return false,
    };
    for dy in 0..g.source_h {
        for dx in 0..g.source_w {
            atlante.set_pixel(ax + dx, ay + dy, SPENTO);
        }
    }
    true
}

/// Esegue il piano: ridisegna l'atlante e riscrive la tabella dei glifi.
///
/// `dati` sono i byte del `data.win`, modificati **in place**: solo i 14 byte
/// fissi di ogni glifo toccato, mai la lunghezza del file. `atlante` e'
/// l'immagine gia' decodificata, che il chiamante dovra' poi ricomprimere e
/// verificare contro il budget del blob.
///
/// Restituisce i glifi aggiornati, utili al chiamante per registrare cosa e'
/// stato fatto.
pub fn applica(
    atlante: &mut GmImage,
    dati: &mut [u8],
    font: &Font,
    piano: &Piano,
    richieste: &[Richiesta],
) -> Result<Vec<Glyph>, Errore> {
    if font.tpag.is_none() {
        return Err(Errore::TpagAssente);
    }

    // Prima si controlla tutto, poi si scrive: un fallimento a meta' lascerebbe
    // un atlante mezzo riscritto e nessun modo di sapere dove ci si e' fermati.
    for &(ic, ir) in &piano.assegnazioni {
        let g = &font.glyphs[ic];
        let r = &richieste[ir];
        if r.bitmap.w > g.source_w || r.bitmap.h > g.source_h {
            return Err(Errore::BitmapTroppoGrande {
                carattere: r.carattere,
                bitmap: (r.bitmap.w, r.bitmap.h),
                cella: (g.source_w, g.source_h),
            });
        }
        let (ax, ay) = font.posizione_assoluta(g).ok_or(Errore::TpagAssente)?;
        if ax as u32 + g.source_w as u32 > atlante.width as u32
            || ay as u32 + g.source_h as u32 > atlante.height as u32
        {
            return Err(Errore::CellaFuoriDallAtlante { carattere: r.carattere, x: ax, y: ay });
        }
    }

    let mut aggiornati = Vec::with_capacity(piano.assegnazioni.len());

    for &(ic, ir) in &piano.assegnazioni {
        let g = &font.glyphs[ic];
        let r = &richieste[ir];
        let (ax, ay) = font.posizione_assoluta(g).ok_or(Errore::TpagAssente)?;

        // Si svuota TUTTA la cella prima di disegnare: lasciare i pixel del
        // kanji dove la lettera nuova non arriva produrrebbe un ibrido.
        svuota_cella(atlante, font, g);
        for dy in 0..r.bitmap.h {
            for dx in 0..r.bitmap.w {
                if r.bitmap.get(dx, dy) {
                    atlante.set_pixel(ax + dx, ay + dy, ACCESO);
                }
            }
        }

        // La cella resta dov'e' ed e' grande com'era; cambiano il codepoint e
        // le dimensioni utili, che ora sono quelle della lettera.
        let nuovo = Glyph {
            character: r.carattere,
            source_w: r.bitmap.w,
            source_h: r.bitmap.h,
            shift: r.shift.unwrap_or(r.bitmap.w as i16 + 1),
            ..g.clone()
        };
        gm_font::scrivi_glifo(dati, &nuovo);
        aggiornati.push(nuovo);
    }

    // I donatori avanzati si svuotano nell'atlante ma NON si toccano nella
    // tabella: restano kanji dichiarati, semplicemente disegnati vuoti. Toglier
    // li dalla lista significherebbe cambiarne la lunghezza, cioe' spostare
    // offset, cioe' ADR-004.
    for &ic in &piano.da_svuotare {
        svuota_cella(atlante, font, &font.glyphs[ic]);
    }

    // ⚠️ 28/07/2026: i codepoint sono cambiati (kanji→cirillico/accenti), la
    // lista puntatori NON e' piu' ordinata per `character` — e il runtime
    // GameMaker la consulta con una ricerca binaria. Senza questo riordino il
    // gioco CRASHAVA all'avvio in giapponese, al primo disegno con un font
    // modificato. In inglese partiva, perche' i font `fnt_ja_*` non venivano
    // mai disegnati: il difetto era invisibile proprio dove non si provava.
    if !gm_font::riordina_puntatori_glifi(dati, font) {
        return Err(Errore::TabellaGlifiIncoerente { font: font.name.clone() });
    }

    Ok(aggiornati)
}

// ── Test ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::gm_font::Tpag;

    fn tpag(x: u16, y: u16) -> Tpag {
        Tpag {
            offset: 0,
            source_x: x,
            source_y: y,
            source_w: 512,
            source_h: 512,
            target_x: 0,
            target_y: 0,
            target_w: 512,
            target_h: 512,
            bounding_w: 512,
            bounding_h: 512,
            texture_index: 0,
        }
    }

    /// Font sintetico: `n` kanji in celle `lato`x`lato`, in fila.
    fn font_finto(n: u16, lato: u16, origine: (u16, u16)) -> Font {
        let glyphs = (0..n)
            .map(|i| Glyph {
                offset: 1000 + i as usize * GLIFO_PASSO,
                character: 0x4E00 + i,
                source_x: i * lato,
                source_y: 0,
                source_w: lato,
                source_h: lato,
                shift: lato as i16,
                offset_x: 0,
            })
            .collect();
        Font {
            offset: 0,
            name: "fnt_finto".into(),
            range_start: 0x20,
            range_end: 0xFF9F,
            scostamento_glifi: 44,
            tpag: Some(tpag(origine.0, origine.1)),
            glyphs,
        }
    }

    const GLIFO_PASSO: usize = 16;

    /// Buffer di data.win finto COERENTE col font: lista puntatori (conteggio
    /// + offset dei record) a `offset + scostamento_glifi`, e il `character`
    /// iniziale scritto in ogni record. Serve dal 28/07: `applica()` riordina
    /// la lista puntatori (il runtime fa ricerca binaria) e rifiuta i buffer
    /// in cui la lista non combacia — come faceva il vecchio vec![0u8; 4096].
    fn prepara_dati(f: &Font) -> Vec<u8> {
        let mut d = vec![0u8; 4096];
        let lista = f.offset + f.scostamento_glifi;
        d[lista..lista + 4].copy_from_slice(&(f.glyphs.len() as u32).to_le_bytes());
        for (i, g) in f.glyphs.iter().enumerate() {
            let p = lista + 4 + i * 4;
            d[p..p + 4].copy_from_slice(&(g.offset as u32).to_le_bytes());
            d[g.offset..g.offset + 2].copy_from_slice(&g.character.to_le_bytes());
        }
        d
    }

    fn lettera(carattere: u16, w: u16, h: u16) -> Richiesta {
        let mut b = Bitmap::nuova(w, h);
        // Una diagonale, così si vede se finisce nel posto giusto.
        for i in 0..w.min(h) {
            b.set(i, i, true);
        }
        Richiesta { carattere, bitmap: b, shift: None }
    }

    fn atlante_pieno(w: u16, h: u16) -> GmImage {
        let mut a = GmImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                a.set_pixel(x, y, ACCESO);
            }
        }
        a
    }

    #[test]
    fn senza_tpag_non_si_pianifica() {
        let mut f = font_finto(10, 16, (0, 0));
        f.tpag = None;
        assert_eq!(
            pianifica(&f, &[lettera(0x0410, 8, 8)], KANJI, false),
            Err(Errore::TpagAssente)
        );
    }

    #[test]
    fn un_carattere_gia_presente_e_un_errore() {
        let f = font_finto(4, 16, (0, 0));
        let r = lettera(0x4E00, 8, 8); // e' uno dei kanji esistenti
        assert_eq!(
            pianifica(&f, &[r], KANJI, false),
            Err(Errore::CarattereGiaPresente { carattere: 0x4E00 })
        );
    }

    #[test]
    fn donatori_insufficienti() {
        let f = font_finto(2, 16, (0, 0));
        let richieste: Vec<_> = (0..5).map(|i| lettera(0x0410 + i, 8, 8)).collect();
        assert!(matches!(
            pianifica(&f, &richieste, KANJI, false),
            Err(Errore::DonatoriInsufficienti { servono: 5, .. })
        ));
    }

    /// Le celle piccole non devono essere assegnate a glifi grandi.
    #[test]
    fn le_celle_troppo_piccole_non_vengono_scelte() {
        let mut f = font_finto(3, 16, (0, 0));
        f.glyphs[1].source_w = 4;
        f.glyphs[1].source_h = 4;

        let piano = pianifica(&f, &[lettera(0x0410, 12, 12)], KANJI, false).unwrap();
        assert_eq!(piano.assegnazioni.len(), 1);
        let (ic, _) = piano.assegnazioni[0];
        assert_ne!(ic, 1, "la cella 4x4 non puo' ospitare un glifo 12x12");
    }

    /// Il piano e' deterministico: due esecuzioni identiche danno lo stesso
    /// risultato, altrimenti due patch della stessa versione differirebbero.
    #[test]
    fn il_piano_e_deterministico() {
        let f = font_finto(20, 16, (0, 0));
        let richieste: Vec<_> = (0..6).map(|i| lettera(0x0410 + i, 8, 8)).collect();
        let a = pianifica(&f, &richieste, KANJI, true).unwrap();
        let b = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert_eq!(a.assegnazioni, b.assegnazioni);
        assert_eq!(a.da_svuotare, b.da_svuotare);
    }

    #[test]
    fn svuota_resto_elenca_i_donatori_avanzati() {
        let f = font_finto(10, 16, (0, 0));
        let richieste: Vec<_> = (0..3).map(|i| lettera(0x0410 + i, 8, 8)).collect();

        let senza = pianifica(&f, &richieste, KANJI, false).unwrap();
        assert!(senza.da_svuotare.is_empty());

        let con = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert_eq!(con.da_svuotare.len(), 7, "10 kanji meno 3 usati");
    }

    /// Il cuore: la lettera finisce nella cella giusta, alle coordinate
    /// ASSOLUTE, e la tabella viene riscritta.
    #[test]
    fn la_lettera_finisce_al_posto_giusto() {
        let origine = (100u16, 200u16);
        let f = font_finto(4, 16, origine);
        let mut atlante = atlante_pieno(512, 512);
        let mut dati = prepara_dati(&f);

        let richieste = vec![lettera(0x0410, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, false).unwrap();
        let agg = applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        assert_eq!(agg.len(), 1);
        assert_eq!(agg[0].character, 0x0410);
        assert_eq!((agg[0].source_w, agg[0].source_h), (8, 8));
        assert_eq!(agg[0].shift, 9, "shift predefinito = larghezza + 1");

        let (ic, _) = piano.assegnazioni[0];
        let g = &f.glyphs[ic];
        let (ax, ay) = f.posizione_assoluta(g).unwrap();
        assert_eq!((ax, ay), (origine.0 + g.source_x, origine.1 + g.source_y));

        // La diagonale c'e', alle coordinate assolute.
        for i in 0..8u16 {
            assert_eq!(atlante.get_pixel(ax + i, ay + i), Some(ACCESO), "diagonale in ({i},{i})");
        }
        // E il resto della cella e' stato svuotato, non lasciato acceso.
        assert_eq!(atlante.get_pixel(ax + 1, ay), Some(SPENTO));
        assert_eq!(atlante.get_pixel(ax + 15, ay + 15), Some(SPENTO));

        // Fuori dalla cella l'atlante e' intatto.
        assert_eq!(atlante.get_pixel(ax + 16, ay), Some(ACCESO));
        assert_eq!(atlante.get_pixel(ax, ay.wrapping_sub(1)), Some(ACCESO));
    }

    /// Alle coordinate GREZZE non deve esserci finito niente: e' l'errore che
    /// l'esperimento visivo del 27/07 ha evitato.
    #[test]
    fn non_si_disegna_alle_coordinate_relative() {
        let origine = (100u16, 200u16);
        let f = font_finto(4, 16, origine);
        let mut atlante = GmImage::new(512, 512); // tutto spento
        let mut dati = prepara_dati(&f);

        let richieste = vec![lettera(0x0410, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, false).unwrap();
        applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        let (ic, _) = piano.assegnazioni[0];
        let g = &f.glyphs[ic];
        // Alla posizione relativa (senza l'origine TPAG) l'atlante e' vuoto.
        assert_eq!(
            atlante.get_pixel(g.source_x, g.source_y),
            Some(SPENTO),
            "qualcosa e' stato disegnato alle coordinate relative"
        );
        // A quella assoluta invece no.
        let (ax, ay) = f.posizione_assoluta(g).unwrap();
        assert_eq!(atlante.get_pixel(ax, ay), Some(ACCESO));
    }

    #[test]
    fn i_donatori_avanzati_vengono_svuotati_nell_atlante() {
        let f = font_finto(4, 16, (0, 0));
        let mut atlante = atlante_pieno(256, 256);
        let mut dati = prepara_dati(&f);

        let richieste = vec![lettera(0x0410, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, true).unwrap();
        applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        for &ic in &piano.da_svuotare {
            let g = &f.glyphs[ic];
            let (ax, ay) = f.posizione_assoluta(g).unwrap();
            assert_eq!(
                atlante.get_pixel(ax + 3, ay + 3),
                Some(SPENTO),
                "il donatore avanzato U+{:04X} doveva essere svuotato",
                g.character
            );
        }
    }

    /// Un piano non realizzabile deve fallire PRIMA di aver toccato l'atlante.
    #[test]
    fn un_fallimento_non_lascia_l_atlante_a_meta() {
        let f = font_finto(4, 16, (0, 0));
        let mut atlante = atlante_pieno(256, 256);
        let prima = atlante.clone();
        let mut dati = prepara_dati(&f);

        // Piano valido per due lettere, ma la seconda bitmap viene gonfiata
        // dopo la pianificazione: applica() deve accorgersene e non scrivere.
        let mut richieste = vec![lettera(0x0410, 8, 8), lettera(0x0411, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, false).unwrap();
        richieste[1].bitmap = Bitmap::nuova(64, 64);

        let dati_prima = dati.clone();
        let esito = applica(&mut atlante, &mut dati, &f, &piano, &richieste);
        assert!(matches!(esito, Err(Errore::BitmapTroppoGrande { .. })));
        assert_eq!(atlante.bgra, prima.bgra, "l'atlante non doveva essere toccato");
        assert_eq!(dati, dati_prima, "il data.win non doveva essere toccato");
    }

    /// La lista esplicita e' un contratto: i glifi fuori lista non si toccano,
    /// ne' come donatori ne' come celle da svuotare.
    #[test]
    fn pianifica_da_lista_rispetta_la_lista() {
        let f = font_finto(6, 16, (0, 0)); // kanji 0x4E00..0x4E05
        let lista = vec![0x4E01u16, 0x4E03];

        let piano = pianifica_da_lista(&f, &[lettera(0x00E0, 8, 8)], &lista, true).unwrap();

        assert_eq!(piano.assegnazioni.len(), 1);
        let (ic, _) = piano.assegnazioni[0];
        assert!(
            lista.contains(&f.glyphs[ic].character),
            "donatore U+{:04X} fuori dalla lista",
            f.glyphs[ic].character
        );
        // svuota_resto con lista esplicita: si svuota SOLO il candidato in
        // lista non usato, non gli altri quattro glifi del font.
        assert_eq!(piano.da_svuotare.len(), 1);
        assert!(lista.contains(&f.glyphs[piano.da_svuotare[0]].character));
    }

    #[test]
    fn pianifica_da_lista_fallisce_quando_la_lista_non_basta() {
        let f = font_finto(6, 16, (0, 0));
        let lista = vec![0x4E01u16]; // un solo candidato per due lettere
        let richieste: Vec<_> = (0..2u16).map(|i| lettera(0x00E0 + i, 8, 8)).collect();
        assert!(matches!(
            pianifica_da_lista(&f, &richieste, &lista, false),
            Err(Errore::DonatoriInsufficienti { servono: 2, trovati: 1, .. })
        ));
    }

    /// Il refactoring a predicato non deve aver mosso niente sul percorso
    /// kanji, quello provato in-game: stesse assegnazioni, stessi svuotati,
    /// donatori tutti nell'intervallo CJK.
    #[test]
    fn pianifica_classico_invariato_sul_caso_kanji() {
        let f = font_finto(10, 16, (0, 0));
        let richieste: Vec<_> = (0..3u16).map(|i| lettera(0x0410 + i, 8, 8)).collect();

        let piano = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert_eq!(piano.assegnazioni.len(), 3);
        assert_eq!(piano.da_svuotare.len(), 7, "10 kanji meno 3 usati");
        for &(ic, _) in &piano.assegnazioni {
            let c = f.glyphs[ic].character;
            assert!((KANJI.0..=KANJI.1).contains(&c), "U+{c:04X} non e' un kanji");
        }
    }

    /// La lunghezza dei dati non cambia mai: e' la promessa che tiene in piedi
    /// tutto ADR-005.
    #[test]
    fn la_lunghezza_dei_dati_non_cambia() {
        let f = font_finto(8, 16, (0, 0));
        let mut atlante = atlante_pieno(256, 256);
        let mut dati = prepara_dati(&f);
        let n = dati.len();

        let richieste: Vec<_> = (0..4).map(|i| lettera(0x0410 + i, 8, 8)).collect();
        let piano = pianifica(&f, &richieste, KANJI, true).unwrap();
        applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        assert_eq!(dati.len(), n);
        assert_eq!(atlante.bgra.len(), 256 * 256 * 4);
    }
}
