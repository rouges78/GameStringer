/**
 * 🔍 OCR Multi-Engine Service — OneOCR + PaddleOCR + RapidOCR + Tesseract
 * 
 * Supporta 4 engine OCR con fallback automatico:
 * 
 * 1. OneOCR (Windows 11 AI) — Il più preciso per testo in-game, font stylizzati.
 *    Usa le DLL native di Windows 11 via webserver locale (porta 17231).
 *    Repo: github.com/AuroraWright/oneocr
 * 
 * 2. PaddleOCR — Engine open-source Baidu, eccellente per CJK (cinese, giapponese, coreano).
 *    Usa PaddleOCR-server via HTTP (porta 8866).
 *    Repo: github.com/PaddlePaddle/PaddleOCR
 * 
 * 3. RapidOCR — Wrapper veloce di PaddleOCR senza dipendenze pesanti.
 *    Usa rapidocr-server via HTTP (porta 9003).
 *    Repo: github.com/RapidAI/RapidOCR
 * 
 * 4. Tesseract.js — Fallback browser-native, sempre disponibile.
 *    Già integrato in ocr-service.ts.
 * 
 * Architettura:
 * - Ogni engine viene avviato come processo locale (o è già in esecuzione)
 * - Probing automatico per rilevare quali engine sono disponibili
 * - Fallback chain: OneOCR → PaddleOCR → RapidOCR → Tesseract
 * - Preprocessing immagine opzionale (grayscale, contrast, threshold)
 */

import { recognizeText, type OCRResult, type OCRWord, type OCRLine, type BoundingBox, type OCRProgress, type OCRLanguage } from './ocr-service';

// ============================================================================
// TYPES
// ============================================================================

export type OCREngineId = 'oneocr' | 'paddleocr' | 'rapidocr' | 'tesseract';

export interface OCREngineInfo {
  id: OCREngineId;
  name: string;
  description: string;
  available: boolean;
  port?: number;
  url?: string;
  /** Punti di forza */
  strengths: string[];
  /** Lingue ottimali */
  bestFor: string[];
  /** Se richiede installazione esterna */
  requiresSetup: boolean;
  /** Istruzioni di setup */
  setupInstructions: string;
  /** Latenza media stimata (ms) */
  avgLatencyMs: number;
  /** Qualità stimata (1-10) */
  qualityScore: number;
}

export interface MultiOCROptions {
  /** Engine preferito (fallback agli altri se non disponibile) */
  preferredEngine?: OCREngineId;
  /** Lingua del testo */
  language?: OCRLanguage;
  /** Se true, prova tutti gli engine e ritorna il risultato migliore */
  compareAll?: boolean;
  /** Timeout per singolo engine (ms) */
  timeout?: number;
  /** Callback progress */
  onProgress?: (progress: OCRProgress) => void;
  /** Preprocessing options */
  preprocessing?: {
    grayscale?: boolean;
    contrast?: number;
    threshold?: number;
    /** Upscale per testo piccolo (2x, 3x) */
    upscale?: number;
  };
}

export interface MultiOCRResult extends OCRResult {
  /** Engine che ha prodotto il risultato */
  engine: OCREngineId;
  /** Tutti i risultati se compareAll=true */
  allResults?: Array<{ engine: OCREngineId; result: OCRResult }>;
}

export interface EngineProbeResult {
  engine: OCREngineId;
  available: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}

// ============================================================================
// ENGINE REGISTRY
// ============================================================================

const ENGINE_INFO: Record<OCREngineId, Omit<OCREngineInfo, 'available'>> = {
  oneocr: {
    id: 'oneocr',
    name: 'OneOCR (Windows 11 AI)',
    description: 'Engine OCR nativo di Windows 11, basato su AI. Il più preciso per testo stylizzato nei giochi.',
    port: 17231,
    url: 'http://localhost:17231',
    strengths: ['Font stylizzati', 'Testo sovrapposto', 'Bassa risoluzione', 'Multi-lingua nativo'],
    bestFor: ['eng', 'jpn', 'kor', 'chi_sim', 'chi_tra'],
    requiresSetup: true,
    setupInstructions: 'Scarica oneocr da github.com/AuroraWright/oneocr e avvia il webserver: oneocr.exe --server --port 17231',
    avgLatencyMs: 100,
    qualityScore: 9,
  },
  paddleocr: {
    id: 'paddleocr',
    name: 'PaddleOCR (Baidu)',
    description: 'Engine OCR open-source di Baidu. Eccellente per lingue CJK e testo complesso.',
    port: 8866,
    url: 'http://localhost:8866',
    strengths: ['CJK eccellente', 'Testo verticale', 'Multi-lingua', 'Alta precisione'],
    bestFor: ['chi_sim', 'chi_tra', 'jpn', 'kor'],
    requiresSetup: true,
    setupInstructions: 'pip install paddlepaddle paddleocr && paddleocr --server --port 8866 (oppure Docker: docker run -p 8866:8866 paddlecloud/paddleocr)',
    avgLatencyMs: 200,
    qualityScore: 8,
  },
  rapidocr: {
    id: 'rapidocr',
    name: 'RapidOCR',
    description: 'Wrapper leggero di PaddleOCR/ONNX. Veloce e senza dipendenze pesanti.',
    port: 9003,
    url: 'http://localhost:9003',
    strengths: ['Veloce', 'Leggero', 'ONNX Runtime', 'Facile da installare'],
    bestFor: ['chi_sim', 'chi_tra', 'jpn', 'kor', 'eng'],
    requiresSetup: true,
    setupInstructions: 'pip install rapidocr-onnxruntime && rapidocr_api --port 9003 (oppure Docker: docker run -p 9003:9003 rapidai/rapidocr)',
    avgLatencyMs: 150,
    qualityScore: 7,
  },
  tesseract: {
    id: 'tesseract',
    name: 'Tesseract.js',
    description: 'OCR classico, integrato nel browser. Sempre disponibile come fallback.',
    strengths: ['Sempre disponibile', 'Nessun setup', 'Browser-native', '100+ lingue'],
    bestFor: ['eng', 'ita', 'fra', 'deu', 'spa', 'por', 'rus'],
    requiresSetup: false,
    setupInstructions: 'Nessun setup richiesto — integrato nel browser.',
    avgLatencyMs: 800,
    qualityScore: 5,
  },
};

// Default fallback chain (ordine di preferenza)
const DEFAULT_CHAIN: OCREngineId[] = ['oneocr', 'paddleocr', 'rapidocr', 'tesseract'];

// CJK-optimized chain
const CJK_CHAIN: OCREngineId[] = ['paddleocr', 'oneocr', 'rapidocr', 'tesseract'];

// ============================================================================
// ENGINE PROBING
// ============================================================================

/**
 * Verifica se un engine è disponibile e misura la latenza
 */
async function probeEngine(engineId: OCREngineId, timeout = 3000): Promise<EngineProbeResult> {
  if (engineId === 'tesseract') {
    return { engine: 'tesseract', available: true, latencyMs: 0, version: 'browser' };
  }

  const info = ENGINE_INFO[engineId];
  if (!info.url) {
    return { engine: engineId, available: false, latencyMs: 0, error: 'No URL configured' };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Ogni engine ha un endpoint di health check diverso
    let healthUrl: string;
    switch (engineId) {
      case 'oneocr':
        healthUrl = `${info.url}/api/health`;
        break;
      case 'paddleocr':
        healthUrl = `${info.url}/ping`;
        break;
      case 'rapidocr':
        healthUrl = `${info.url}/`;
        break;
      default:
        healthUrl = info.url;
    }

    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;

    if (res.ok || res.status === 404) {
      // 404 è accettabile — l'engine è in esecuzione ma l'endpoint potrebbe essere diverso
      let version: string | undefined;
      try {
        const data = await res.json();
        version = data?.version || data?.status || undefined;
      } catch {}

      return { engine: engineId, available: true, latencyMs, version };
    }

    return { engine: engineId, available: false, latencyMs, error: `HTTP ${res.status}` };
  } catch (e) {
    return {
      engine: engineId,
      available: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : 'Connection failed'
    };
  }
}

/**
 * Proba tutti gli engine e ritorna lo stato
 */
export async function probeAllEngines(): Promise<EngineProbeResult[]> {
  const results = await Promise.all(
    DEFAULT_CHAIN.map(engine => probeEngine(engine))
  );
  return results;
}

/**
 * Ritorna le info di tutti gli engine con stato disponibilità
 */
export async function getEngineInfoList(): Promise<OCREngineInfo[]> {
  const probes = await probeAllEngines();
  return DEFAULT_CHAIN.map(engineId => ({
    ...ENGINE_INFO[engineId],
    available: probes.find(p => p.engine === engineId)?.available ?? false,
  }));
}

// ============================================================================
// ENGINE-SPECIFIC OCR CALLS
// ============================================================================

/**
 * OCR con OneOCR (Windows 11 AI)
 */
async function ocrWithOneOCR(
  imageData: string | Blob,
  language: string,
  timeout: number,
): Promise<OCRResult> {
  const startTime = Date.now();
  const url = ENGINE_INFO.oneocr.url!;

  const formData = new FormData();
  if (typeof imageData === 'string') {
    // Base64 o URL
    if (imageData.startsWith('data:')) {
      const response = await fetch(imageData);
      const blob = await response.blob();
      formData.append('image', blob, 'screenshot.png');
    } else {
      formData.append('url', imageData);
    }
  } else {
    formData.append('image', imageData, 'screenshot.png');
  }
  formData.append('language', language);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const res = await fetch(`${url}/api/ocr`, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`OneOCR error: ${res.status}`);

  const data = await res.json();

  // Normalizza output OneOCR al formato OCRResult
  const words: OCRWord[] = [];
  const lines: OCRLine[] = [];

  if (data.lines) {
    for (const line of data.lines) {
      const lineWords: OCRWord[] = (line.words || []).map((w: any) => ({
        text: w.text,
        confidence: w.confidence ?? 90,
        bbox: normalizeBbox(w.bounding_box || w.bbox),
      }));
      words.push(...lineWords);
      lines.push({
        text: line.text,
        confidence: line.confidence ?? 90,
        bbox: normalizeBbox(line.bounding_box || line.bbox),
        words: lineWords,
      });
    }
  }

  return {
    text: data.text || lines.map(l => l.text).join('\n'),
    confidence: data.confidence ?? (lines.length > 0 ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length : 0),
    words,
    lines,
    processingTime: Date.now() - startTime,
  };
}

/**
 * OCR con PaddleOCR
 */
async function ocrWithPaddleOCR(
  imageData: string | Blob,
  language: string,
  timeout: number,
): Promise<OCRResult> {
  const startTime = Date.now();
  const url = ENGINE_INFO.paddleocr.url!;

  const formData = new FormData();
  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:')) {
      const response = await fetch(imageData);
      const blob = await response.blob();
      formData.append('image', blob, 'screenshot.png');
    } else {
      // PaddleOCR può accettare base64 nel body
      formData.append('image', imageData);
    }
  } else {
    formData.append('image', imageData, 'screenshot.png');
  }

  // Mappa lingua per PaddleOCR
  const paddleLangMap: Record<string, string> = {
    eng: 'en', ita: 'it', fra: 'fr', deu: 'de', spa: 'es', por: 'pt',
    jpn: 'japan', kor: 'korean', chi_sim: 'ch', chi_tra: 'chinese_cht', rus: 'ru',
  };
  formData.append('lang', paddleLangMap[language] || 'en');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const res = await fetch(`${url}/predict/ocr_system`, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`PaddleOCR error: ${res.status}`);

  const data = await res.json();

  // Normalizza output PaddleOCR
  const words: OCRWord[] = [];
  const lines: OCRLine[] = [];

  const results = data.results || data.result || data;
  if (Array.isArray(results)) {
    for (const item of results) {
      const textItems = item.data || item;
      if (Array.isArray(textItems)) {
        for (const t of textItems) {
          const text = t.text || t[1]?.[0] || '';
          const conf = t.confidence || t[1]?.[1] || 0;
          const bbox = t.box || t[0] || null;

          if (text) {
            const normalizedBbox = bbox ? normalizePaddleBbox(bbox) : { x0: 0, y0: 0, x1: 0, y1: 0 };
            const word: OCRWord = { text, confidence: conf * 100, bbox: normalizedBbox };
            words.push(word);
            lines.push({ text, confidence: conf * 100, bbox: normalizedBbox, words: [word] });
          }
        }
      }
    }
  }

  return {
    text: lines.map(l => l.text).join('\n'),
    confidence: lines.length > 0 ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length : 0,
    words,
    lines,
    processingTime: Date.now() - startTime,
  };
}

/**
 * OCR con RapidOCR
 */
async function ocrWithRapidOCR(
  imageData: string | Blob,
  language: string,
  timeout: number,
): Promise<OCRResult> {
  const startTime = Date.now();
  const url = ENGINE_INFO.rapidocr.url!;

  const formData = new FormData();
  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:')) {
      const response = await fetch(imageData);
      const blob = await response.blob();
      formData.append('image_file', blob, 'screenshot.png');
    } else {
      formData.append('image_data', imageData);
    }
  } else {
    formData.append('image_file', imageData, 'screenshot.png');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const res = await fetch(`${url}/ocr`, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`RapidOCR error: ${res.status}`);

  const data = await res.json();

  // Normalizza output RapidOCR
  const words: OCRWord[] = [];
  const lines: OCRLine[] = [];

  const ocrResult = data.ocr_result || data.result || data.data || [];
  if (Array.isArray(ocrResult)) {
    for (const item of ocrResult) {
      const text = Array.isArray(item) ? item[1] : item.text || '';
      const conf = Array.isArray(item) ? (item[2] ?? 0.9) : (item.confidence ?? 0.9);
      const bbox = Array.isArray(item) ? item[0] : item.box;

      if (text) {
        const normalizedBbox = bbox ? normalizePaddleBbox(bbox) : { x0: 0, y0: 0, x1: 0, y1: 0 };
        const word: OCRWord = { text, confidence: conf * 100, bbox: normalizedBbox };
        words.push(word);
        lines.push({ text, confidence: conf * 100, bbox: normalizedBbox, words: [word] });
      }
    }
  }

  return {
    text: lines.map(l => l.text).join('\n'),
    confidence: lines.length > 0 ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length : 0,
    words,
    lines,
    processingTime: Date.now() - startTime,
  };
}

// ============================================================================
// BBOX NORMALIZATION
// ============================================================================

function normalizeBbox(bbox: any): BoundingBox {
  if (!bbox) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  if (bbox.x0 !== undefined) return bbox;
  if (bbox.left !== undefined) {
    return { x0: bbox.left, y0: bbox.top, x1: bbox.right || bbox.left + bbox.width, y1: bbox.bottom || bbox.top + bbox.height };
  }
  if (bbox.x !== undefined) {
    return { x0: bbox.x, y0: bbox.y, x1: bbox.x + (bbox.w || bbox.width || 0), y1: bbox.y + (bbox.h || bbox.height || 0) };
  }
  return { x0: 0, y0: 0, x1: 0, y1: 0 };
}

/**
 * PaddleOCR/RapidOCR usano [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] (4 punti, senso orario)
 */
function normalizePaddleBbox(points: any): BoundingBox {
  if (!points || !Array.isArray(points)) return { x0: 0, y0: 0, x1: 0, y1: 0 };

  // [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] → BoundingBox
  if (Array.isArray(points[0])) {
    const xs = points.map((p: number[]) => p[0]);
    const ys = points.map((p: number[]) => p[1]);
    return {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
    };
  }

  return normalizeBbox(points);
}

// ============================================================================
// MAIN MULTI-ENGINE OCR
// ============================================================================

/**
 * Esegue OCR con l'engine migliore disponibile (con fallback automatico)
 */
export async function recognizeMultiEngine(
  image: string | File | Blob,
  options: MultiOCROptions = {},
): Promise<MultiOCRResult> {
  const {
    preferredEngine,
    language = 'eng',
    compareAll = false,
    timeout = 15000,
    onProgress,
  } = options;

  // Determina chain di fallback
  let chain: OCREngineId[];
  const isCJK = ['jpn', 'kor', 'chi_sim', 'chi_tra'].includes(language);

  if (preferredEngine) {
    chain = [preferredEngine, ...DEFAULT_CHAIN.filter(e => e !== preferredEngine)];
  } else if (isCJK) {
    chain = CJK_CHAIN;
  } else {
    chain = DEFAULT_CHAIN;
  }

  // Converti File a Blob se necessario
  let imageInput: string | Blob = image instanceof File ? image : image;

  // Se compareAll, esegui tutti gli engine in parallelo
  if (compareAll) {
    return runCompareAll(imageInput, language, chain, timeout, onProgress);
  }

  // Fallback chain
  for (const engineId of chain) {
    onProgress?.({ status: `Tentativo con ${ENGINE_INFO[engineId].name}...`, progress: 0 });

    try {
      const result = await runSingleEngine(engineId, imageInput, language, timeout, onProgress);

      // Se il risultato è vuoto o ha confidenza troppo bassa, prova il prossimo
      if (!result.text.trim() || result.confidence < 10) {
        console.warn(`[OCR] ${engineId} returned empty/low-confidence result, trying next...`);
        continue;
      }

      return { ...result, engine: engineId };
    } catch (e) {
      console.warn(`[OCR] ${engineId} failed:`, e instanceof Error ? e.message : e);
      continue;
    }
  }

  // Ultimo fallback: Tesseract (sempre disponibile)
  onProgress?.({ status: 'Fallback a Tesseract...', progress: 0 });
  const tesseractResult = await recognizeText(imageInput, language, onProgress);
  return { ...tesseractResult, engine: 'tesseract' };
}

/**
 * Esegue un singolo engine
 */
async function runSingleEngine(
  engineId: OCREngineId,
  image: string | Blob,
  language: string,
  timeout: number,
  onProgress?: (progress: OCRProgress) => void,
): Promise<OCRResult> {
  switch (engineId) {
    case 'oneocr': {
      const probe = await probeEngine('oneocr', 2000);
      if (!probe.available) throw new Error('OneOCR non disponibile');
      return ocrWithOneOCR(image, language, timeout);
    }
    case 'paddleocr': {
      const probe = await probeEngine('paddleocr', 2000);
      if (!probe.available) throw new Error('PaddleOCR non disponibile');
      return ocrWithPaddleOCR(image, language, timeout);
    }
    case 'rapidocr': {
      const probe = await probeEngine('rapidocr', 2000);
      if (!probe.available) throw new Error('RapidOCR non disponibile');
      return ocrWithRapidOCR(image, language, timeout);
    }
    case 'tesseract':
      return recognizeText(image, language as OCRLanguage, onProgress);
    default:
      throw new Error(`Engine sconosciuto: ${engineId}`);
  }
}

/**
 * Esegue tutti gli engine disponibili e ritorna il risultato migliore
 */
async function runCompareAll(
  image: string | Blob,
  language: string,
  chain: OCREngineId[],
  timeout: number,
  onProgress?: (progress: OCRProgress) => void,
): Promise<MultiOCRResult> {
  const allResults: Array<{ engine: OCREngineId; result: OCRResult }> = [];

  // Proba quali engine sono disponibili
  const probes = await probeAllEngines();
  const available = probes.filter(p => p.available).map(p => p.engine);

  // Esegui tutti in parallelo
  const promises = available.map(async (engineId) => {
    try {
      const result = await runSingleEngine(engineId, image, language, timeout, onProgress);
      return { engine: engineId, result };
    } catch {
      return null;
    }
  });

  const results = await Promise.all(promises);

  for (const r of results) {
    if (r && r.result.text.trim()) {
      allResults.push(r);
    }
  }

  if (allResults.length === 0) {
    // Fallback totale
    const tesseractResult = await recognizeText(image, language as OCRLanguage, onProgress);
    return { ...tesseractResult, engine: 'tesseract', allResults: [] };
  }

  // Scegli il risultato con confidenza più alta
  allResults.sort((a, b) => b.result.confidence - a.result.confidence);
  const best = allResults[0];

  return {
    ...best.result,
    engine: best.engine,
    allResults,
  };
}

// ============================================================================
// SETTINGS STORAGE
// ============================================================================

const OCR_SETTINGS_KEY = 'gamestringer_ocr_settings';

export interface OCRSettings {
  preferredEngine: OCREngineId;
  enableAutoFallback: boolean;
  compareMode: boolean;
  customPorts: Partial<Record<OCREngineId, number>>;
}

export const DEFAULT_OCR_SETTINGS: OCRSettings = {
  preferredEngine: 'tesseract',
  enableAutoFallback: true,
  compareMode: false,
  customPorts: {},
};

export function getOCRSettings(): OCRSettings {
  if (typeof window === 'undefined') return DEFAULT_OCR_SETTINGS;
  try {
    const data = localStorage.getItem(OCR_SETTINGS_KEY);
    return data ? { ...DEFAULT_OCR_SETTINGS, ...JSON.parse(data) } : DEFAULT_OCR_SETTINGS;
  } catch {
    return DEFAULT_OCR_SETTINGS;
  }
}

export function saveOCRSettings(settings: Partial<OCRSettings>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getOCRSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(OCR_SETTINGS_KEY, JSON.stringify(merged));
  } catch {}
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export type { OCRResult, OCRWord, OCRLine, BoundingBox, OCRProgress, OCRLanguage };
