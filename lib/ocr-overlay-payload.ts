/**
 * Contratto unico fra chi produce testo per l'overlay OCR (/ocr-translator,
 * /live-ocr, /live-translate) e la finestra `ocr-overlay` che lo disegna
 * (app/ocr-overlay/page.tsx).
 *
 * Prima ogni pagina aveva la sua forma e il suo evento: /ocr-translator
 * riceveva `ocr_text_detected` dal backend ma non inoltrava niente
 * all'overlay, che ascolta solo `ocr-translations` — e restava vuoto.
 */

/** Un testo da disegnare sopra il gioco. */
export interface OcrOverlayText {
  original: string;
  translated: string;
  /**
   * Pixel fisici, relativi all'angolo in alto a sinistra dell'area catturata
   * (regione, finestra o monitor principale). L'overlay viene dimensionato su
   * quella stessa area da `toggle_ocr_overlay` / `position_overlay_on_window`.
   */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Evento con i testi da mostrare (payload: `OcrOverlayText[]`). */
export const OCR_OVERLAY_TEXTS_EVENT = 'ocr-translations';

/**
 * Evento di visibilità (payload: boolean). Lo emette il backend
 * (`ocr_translator/mod.rs`) a ogni apertura e chiusura dell'overlay.
 */
export const OCR_OVERLAY_VISIBILITY_EVENT = 'overlay-visibility';

/**
 * Marcatore che il backend mette nell'errore quando Windows non ha il
 * riconoscimento del testo per la lingua sorgente (stessa stringa di
 * `OCR_LANGUAGE_NOT_INSTALLED` in `ocr_translator/ocr_engine.rs`).
 */
export const OCR_LANGUAGE_NOT_INSTALLED = 'OCR_LANGUAGE_NOT_INSTALLED';

export function isOcrLanguageMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(OCR_LANGUAGE_NOT_INSTALLED);
}

/** Forma dei testi che il loop OCR Rust emette (`DetectedText`). */
export interface BackendDetectedText {
  text: string;
  translated?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Converte i testi rilevati dal backend nel payload dell'overlay. Passano
 * solo quelli con una traduzione: l'overlay serve a mostrare la traduzione,
 * non a ripetere il testo che il giocatore ha già davanti.
 */
export function toOverlayTexts(texts: BackendDetectedText[]): OcrOverlayText[] {
  return texts
    .filter(t => typeof t.translated === 'string' && t.translated.trim().length > 0)
    .map(t => ({
      original: t.text,
      translated: t.translated as string,
      x: t.x ?? 0,
      y: t.y ?? 0,
      width: t.width ?? 0,
      height: t.height ?? 0,
    }));
}

/**
 * Riquadro in pixel CSS. Le coordinate arrivano in pixel fisici (cattura GDI,
 * OCR); la finestra overlay misura in pixel CSS. Con lo schermo scalato al
 * 125% o 150% senza questa divisione i testi finiscono spostati e più grandi.
 */
export function toCssBox(text: OcrOverlayText, devicePixelRatio: number) {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    left: text.x / dpr,
    top: text.y / dpr,
    width: text.width / dpr,
    height: text.height / dpr,
  };
}
