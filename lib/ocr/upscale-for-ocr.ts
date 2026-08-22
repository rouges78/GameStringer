/**
 * Ingrandimento del fotogramma prima dell'OCR.
 *
 * PERCHÉ ESISTE (22/08/2026, misurato su Yume Nikki).
 * Tesseract.js — il motore che il loop live usa davvero — su un fotogramma
 * nativo 320x240 di RPG Maker legge **zero righe**. Lo stesso identico
 * fotogramma ingrandito legge otto righe, e a x6 «New Game» esce corretto con
 * confidenza 65. Non è un miglioramento marginale: è la differenza fra nessun
 * testo e del testo.
 *
 * | ingrandimento | righe lette |
 * |---|---|
 * | nessuno (320x240) | 0 |
 * | x3 (960x720)      | 8 |
 * | x6 (1920x1440)    | 8, con «New Game» corretto |
 *
 * NEAREST, NON INTERPOLATO. Su un font bitmap l'interpolazione impasta i pixel
 * invece di ingrandirli, e il testo diventa meno leggibile, non più. Si vogliono
 * pixel più grandi, non più morbidi.
 *
 * LE COORDINATE TORNANO INGRANDITE. L'OCR restituisce i riquadri nello spazio
 * dell'immagine ingrandita: usarli così com'è posiziona l'overlay a distanza
 * multipla dal testo. Vanno riportati in scala con `scaleBoxBack`, ed è il tipo
 * di dettaglio che sbaglia in silenzio — l'overlay compare, solo nel posto
 * sbagliato.
 */

/** Lato lungo a cui puntare. Sotto i ~1000 px Tesseract non aggancia il font. */
export const OCR_TARGET_LONG_SIDE = 1920;

/** Oltre questo, l'immagine costa più di quanto renda. */
export const OCR_MAX_FACTOR = 6;

/**
 * Fattore di ingrandimento intero per un fotogramma di queste dimensioni.
 *
 * Intero di proposito: un fattore frazionario obbliga a interpolare, che è
 * esattamente ciò che rovina un font bitmap. `1` significa «va già bene così».
 */
export function upscaleFactorFor(width: number, height: number): number {
  // Entrambe le dimensioni devono essere sensate, non solo il lato lungo: con
  // una negativa il fotogramma è malformato, e un'immagine malformata va
  // lasciata com'è invece di trasformata. Trovato da un test, non a mente.
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 1;
  if (width <= 0 || height <= 0) return 1;
  const lato = Math.max(width, height);
  if (lato >= OCR_TARGET_LONG_SIDE) return 1;
  const f = Math.floor(OCR_TARGET_LONG_SIDE / lato);
  return Math.max(1, Math.min(OCR_MAX_FACTOR, f));
}

export interface BoxLike {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Riporta un riquadro dallo spazio ingrandito a quello originale.
 *
 * Con `factor` 1 non tocca niente, così il chiamante non deve ramificare.
 */
export function scaleBoxBack(box: BoxLike, factor: number): BoxLike {
  if (factor <= 1) return box;
  return {
    x0: box.x0 / factor,
    y0: box.y0 / factor,
    x1: box.x1 / factor,
    y1: box.y1 / factor,
  };
}

/**
 * Ingrandisce un PNG base64 con nearest-neighbour, in un canvas.
 *
 * Ritorna l'originale immutato quando il fattore è 1 o quando il canvas non è
 * disponibile: un ingrandimento mancato deve degradare la lettura, non far
 * fallire la cattura.
 */
export async function upscaleBase64(
  base64: string,
  factor: number
): Promise<{ imageData: string; factor: number }> {
  if (factor <= 1 || typeof document === 'undefined') {
    return { imageData: base64, factor: 1 };
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('immagine non decodificabile'));
      el.src = `data:image/png;base64,${base64}`;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width * factor;
    canvas.height = img.height * factor;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { imageData: base64, factor: 1 };

    // Il punto di tutta la funzione: niente levigatura.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return {
      imageData: canvas.toDataURL('image/png').replace('data:image/png;base64,', ''),
      factor,
    };
  } catch {
    return { imageData: base64, factor: 1 };
  }
}
