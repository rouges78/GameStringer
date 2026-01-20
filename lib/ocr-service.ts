/**
 * OCR Service using Tesseract.js
 * Real OCR implementation for text extraction from images
 */
import Tesseract from 'tesseract.js';

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

export async function recognizeText(
  image: string | File | Blob,
  language: OCRLanguage = 'eng',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  const startTime = Date.now();
  
  try {
    const result = await Tesseract.recognize(image, language, {
      logger: (m) => {
        if (onProgress && m.status) {
          onProgress({
            status: translateStatus(m.status),
            progress: Math.round((m.progress || 0) * 100)
          });
        }
      }
    });

    const data = result.data as any;
    
    const words: OCRWord[] = (data.words || []).map((w: any) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: {
        x0: w.bbox.x0,
        y0: w.bbox.y0,
        x1: w.bbox.x1,
        y1: w.bbox.y1
      }
    }));

    const lines: OCRLine[] = (data.lines || []).map((l: any) => ({
      text: l.text,
      confidence: l.confidence,
      bbox: {
        x0: l.bbox.x0,
        y0: l.bbox.y0,
        x1: l.bbox.x1,
        y1: l.bbox.y1
      },
      words: (l.words || []).map((w: any) => ({
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
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      } catch (error) {
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
