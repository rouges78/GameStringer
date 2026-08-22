/**
 * OCR Service using Tesseract.js
 * Real OCR implementation for text extraction from images
 */
import Tesseract from 'tesseract.js';
import { clientLogger } from '@/lib/client-logger';

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  processingTime: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OCRWord[];
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRProgress {
  status: string;
  progress: number;
}

export type OCRLanguage = 'eng' | 'ita' | 'fra' | 'deu' | 'spa' | 'por' | 'jpn' | 'kor' | 'chi_sim' | 'chi_tra' | 'rus';

const languageNames: Record<OCRLanguage, string> = {
  eng: 'English',
  ita: 'Italiano',
  fra: 'Français',
  deu: 'Deutsch',
  spa: 'Español',
  por: 'Português',
  jpn: '日本語',
  kor: '한국어',
  chi_sim: '简体中文',
  chi_tra: '繁體中文',
  rus: 'Русский'
};

export function getAvailableLanguages(): { code: OCRLanguage; name: string }[] {
  return Object.entries(languageNames).map(([code, name]) => ({
    code: code as OCRLanguage,
    name
  }));
}

/**
 * Worker Tesseract riusato fra le chiamate.
 *
 * PERCHE' NON LA SCORCIATOIA. `Tesseract.recognize` crea un worker, carica il
 * core wasm e i dati lingua, riconosce, e poi distrugge tutto — a ogni
 * chiamata. Nel loop live succederebbe ogni due secondi. Tenerne uno vivo
 * elimina quel lavoro ripetuto, ed e' anche l'unico modo di chiedere `blocks`,
 * che sulla scorciatoia non si puo' passare.
 *
 * ASSET IN LOCALE, NON DA UN CDN. Tesseract.js scarica worker, core e dati
 * lingua a runtime. In una finestra Tauri quella richiesta NON passa: la CSP
 * elenca gli host delle API di traduzione e nessun CDN, e in `public/` non
 * c'era niente. Il risultato era `OCR failed: Unknown error` a ogni fotogramma
 * — misurato nell'app: 44 catture, zero traduzioni. Serviti da `self` non serve
 * toccare la CSP, non si aggiunge nessun host, e l'OCR funziona offline.
 */
let workerCorrente: { lingua: OCRLanguage; worker: Tesseract.Worker } | null = null;

async function ottieniWorker(
  language: OCRLanguage,
  onProgress?: (progress: OCRProgress) => void
): Promise<Tesseract.Worker> {
  if (workerCorrente?.lingua === language) return workerCorrente.worker;
  if (workerCorrente) {
    await workerCorrente.worker.terminate().catch(() => {});
    workerCorrente = null;
  }
  const worker = await Tesseract.createWorker(language, undefined, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    langPath: '/tesseract',
    // NIENTE BLOB URL. Di default tesseract.js scarica lo script del worker e
    // ne fa un `blob:`, poi ci crea sopra il Worker. La CSP dell'applicazione ha
    // `default-src 'self'` e non elenca `blob:`, quindi quel Worker non nasce e
    // `createWorker` rigetta con **undefined** — nessun messaggio, nessun
    // indizio. Era questo il guasto, non il formato dell'immagine.
    //
    // Caricandolo direttamente dal percorso, l'origine e' la stessa
    // dell'applicazione e `script-src 'self'` lo consente gia': nessuna
    // modifica alla CSP, che e' una scelta di sicurezza da non fare per far
    // funzionare una libreria.
    workerBlobURL: false,
    // I file di `tessdata_fast` non sono compressi: chiedendo gzip, Tesseract
    // cercherebbe `eng.traineddata.gz` e fallirebbe.
    gzip: false,
    logger: (m: { status?: string; progress?: number }) => {
      if (onProgress && m.status) {
        onProgress({ status: translateStatus(m.status), progress: Math.round((m.progress || 0) * 100) });
      }
    },
  });
  workerCorrente = { lingua: language, worker };
  return worker;
}

/** Estrae qualcosa di leggibile da un errore che potrebbe non essere un `Error`. */
function dettaglioErrore(e: unknown): string {
  if (e instanceof Error) return e.message || e.name || 'Error senza messaggio';
  if (typeof e === 'string') return e;
  if (e === undefined) return 'rigettato con undefined (nessun motivo fornito)';
  if (e === null) return 'rigettato con null';
  try { return JSON.stringify(e); } catch { return String(e); }
}

/**
 * Rende utilizzabile un'immagine passata come base64 NUDO.
 *
 * PERCHE' SERVE (22/08/2026). Tesseract accetta una stringa, ma la interpreta
 * come URL da SCARICARE a meno che non cominci con `data:`. La cattura schermo
 * restituisce base64 senza prefisso — sia il percorso Tauri sia il ripiego su
 * canvas lo tolgono — quindi il motore riceveva quattro megabyte di base64 e
 * provava a farne una richiesta di rete. Falliva rigettando `undefined`, che il
 * codice a valle mostrava come «Unknown error»: nessun indizio, per minuti.
 *
 * Non e' un difetto introdotto oggi: il codice precedente passava la stessa
 * stringa nuda. Non se n'era accorto nessuno perche' la pagina di traduzione
 * live non era raggiungibile dal menu, quindi non l'aveva mai eseguita nessuno.
 *
 * Il riconoscimento e' sulle FIRME dei formati, non sulla lunghezza: `iVBORw0KGgo`
 * per PNG, `/9j/` per JPEG. Un percorso di file o un URL non cominciano cosi',
 * quindi non c'e' modo di scambiarli per immagini incorporate.
 */
function normalizzaImmagine(image: string | File | Blob): string | File | Blob {
  if (typeof image !== 'string') return image;
  const s = image.trim();
  if (s.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${s}`;
  if (s.startsWith('/9j/')) return `data:image/jpeg;base64,${s}`;
  return image;
}

export async function recognizeText(
  image: string | File | Blob,
  language: OCRLanguage = 'eng',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    image = normalizzaImmagine(image);

    // I due passi sono separati di proposito: un solo messaggio per entrambi
    // non distingue «il motore non si carica» da «il motore non legge questa
    // immagine», che si curano in modi opposti. Restringere il guasto prima di
    // ripararlo costa due righe.
    let worker: Tesseract.Worker;
    try {
      worker = await ottieniWorker(language, onProgress);
    } catch (e) {
      throw new Error(`OCR: creazione worker fallita — ${dettaglioErrore(e)}`);
    }

    // Il quarto argomento esiste solo sull'API del worker: senza, `blocks`
    // resta nullo e le righe non arrivano.
    let result: Tesseract.RecognizeResult;
    try {
      result = await worker.recognize(image, {}, { text: true, blocks: true });
    } catch (e) {
      const tipo = typeof image === 'string'
        ? (image.startsWith('data:') ? `data url, ${image.length} car.` : `stringa, ${image.length} car.`)
        : 'blob/file';
      throw new Error(`OCR: riconoscimento fallito su ${tipo} — ${dettaglioErrore(e)}`);
    }

    interface TesseractWord { text: string; confidence: number; bbox: BoundingBox }
    interface TesseractLine { text: string; confidence: number; bbox: BoundingBox; words: TesseractWord[] }
    interface TesseractParagraph { lines?: TesseractLine[] }
    interface TesseractBlock { paragraphs?: TesseractParagraph[] }
    interface TesseractData { words?: TesseractWord[]; lines?: TesseractLine[]; blocks?: TesseractBlock[] }
    const raw = result.data as unknown as TesseractData;

    // Le righe stanno DENTRO i blocchi: blocchi → paragrafi → righe. `data.lines`
    // esiste come campo ma resta vuoto, e leggere solo quello fa concludere
    // «nessun testo» su immagini perfettamente leggibili. Il ripiego su
    // `data.lines` resta per non dipendere da un dettaglio di versione.
    const righeDaiBlocchi: TesseractLine[] = (raw.blocks ?? [])
      .flatMap((b) => b.paragraphs ?? [])
      .flatMap((p) => p.lines ?? []);

    const data = {
      words: raw.words ?? [],
      lines: righeDaiBlocchi.length > 0 ? righeDaiBlocchi : (raw.lines ?? []),
    };

    const words: OCRWord[] = (data.words || []).map((w: TesseractWord) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: {
        x0: w.bbox.x0,
        y0: w.bbox.y0,
        x1: w.bbox.x1,
        y1: w.bbox.y1
      }
    }));

    const lines: OCRLine[] = (data.lines || []).map((l: TesseractLine) => ({
      text: l.text,
      confidence: l.confidence,
      bbox: {
        x0: l.bbox.x0,
        y0: l.bbox.y0,
        x1: l.bbox.x1,
        y1: l.bbox.y1
      },
      words: (l.words || []).map((w: TesseractWord) => ({
        text: w.text,
        confidence: w.confidence,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1
        }
      }))
    }));

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words,
      lines,
      processingTime: Date.now() - startTime
    };
  } catch (error: unknown) {
    // «Unknown error» non è un messaggio, è una rinuncia: buttava via l'unica
    // informazione utile ogni volta che il motivo NON era un `Error`. E
    // tesseract.js rigetta spesso con una stringa o un oggetto, quindi era il
    // caso normale, non l'eccezione. Un fotogramma al secondo per minuti
    // interi, tutti con la stessa riga che non diceva niente.
    const dettaglio = dettaglioErrore(error);
    clientLogger.error(`OCR Error: ${dettaglio}`, 'OCR', { error });
    throw new Error(dettaglio.startsWith('OCR') ? dettaglio : `OCR failed: ${dettaglio}`);
  }
}

export async function recognizeTextFromCanvas(
  canvas: HTMLCanvasElement,
  language: OCRLanguage = 'eng',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to convert canvas to blob'));
        return;
      }
      try {
        const result = await recognizeText(blob, language, onProgress);
        resolve(result);
      } catch (error: unknown) {
        reject(error);
      }
    }, 'image/png');
  });
}

export async function recognizeTextFromUrl(
  imageUrl: string,
  language: OCRLanguage = 'eng',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  return recognizeText(imageUrl, language, onProgress);
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'loading tesseract core': 'Caricamento motore OCR...',
    'initializing tesseract': 'Inizializzazione...',
    'loading language traineddata': 'Caricamento lingua...',
    'initializing api': 'Preparazione API...',
    'recognizing text': 'Riconoscimento testo...',
    'loaded language traineddata': 'Lingua caricata'
  };
  return statusMap[status] || status;
}

export async function preprocessImage(
  imageData: ImageData,
  options: {
    grayscale?: boolean;
    contrast?: number;
    threshold?: number;
  } = {}
): Promise<ImageData> {
  const { grayscale = true, contrast = 1.2, threshold } = options;
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    if (grayscale) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gray;
    }
    
    if (contrast !== 1) {
      r = Math.min(255, Math.max(0, ((r / 255 - 0.5) * contrast + 0.5) * 255));
      g = Math.min(255, Math.max(0, ((g / 255 - 0.5) * contrast + 0.5) * 255));
      b = Math.min(255, Math.max(0, ((b / 255 - 0.5) * contrast + 0.5) * 255));
    }
    
    if (threshold !== undefined) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const binary = gray > threshold ? 255 : 0;
      r = g = b = binary;
    }
    
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

