/**
 * Screen Capture Service
 * Uses Tauri commands for native screen capture when available,
 * falls back to browser APIs when running in web mode
 */
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';

export interface CaptureResult {
  success: boolean;
  imageData?: string; // Base64 encoded image
  width?: number;
  height?: number;
  error?: string;
}

export interface CaptureOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  monitor?: number;
  /**
   * Nome del processo del gioco (es. 'RPG_RT.exe'). Se valorizzato e gs-hook
   * sta pubblicando, il fotogramma arriva da DENTRO il gioco invece che dallo
   * schermo.
   *
   * Perché conviene: la cattura dallo schermo prende ciò che è composito alle
   * coordinate della finestra. Puntando a un gioco ha restituito i pixel di un
   * browser che gli stava davanti — misurato, vedi
   * `docs/METODI-DI-TRADUZIONE.md`. Dal gioco invece il fotogramma è quello
   * vero: finestra coperta, minimizzata o fuori schermo non fa differenza, e
   * overlay, notifiche e cursore non possono finirci dentro perché il desktop
   * non è ancora stato composto.
   */
  gameProcess?: string;
  /**
   * Titolo (o parte del titolo) della finestra da catturare. Usato quando il
   * gioco non e' agganciato: `capture_window` chiede alla finestra di
   * disegnarsi, quindi funziona anche se e' coperta — a differenza della
   * cattura per area, che restituisce i pixel di chi le sta davanti.
   */
  windowTitle?: string;
}

export interface MonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

/**
 * Check if native screen capture is available (Tauri)
 */
export async function isNativeCaptureAvailable(): Promise<boolean> {
  try {
    const result = await invoke('check_screen_capture_available');
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Get list of available monitors
 */
export async function getMonitors(): Promise<MonitorInfo[]> {
  try {
    const monitors = await invoke('get_monitors') as MonitorInfo[];
    return monitors || [];
  } catch {
    return [{
      id: 0,
      name: 'Primary Monitor',
      width: window.screen.width,
      height: window.screen.height,
      isPrimary: true
    }];
  }
}

/**
 * Capture the entire screen or a specific region
 */
export async function captureScreen(options: CaptureOptions = {}): Promise<CaptureResult> {
  try {
    // Il fotogramma del gioco viene PRIMA di tutto il resto, quando c'è: è
    // l'unica sorgente che garantisce di riprendere il gioco e non ciò che gli
    // sta davanti. Se non c'è si prosegue con le altre, che restano l'unica
    // strada per i giochi non agganciati.
    if (options.gameProcess) {
      const dalGioco = await captureGameFrame(options.gameProcess);
      if (dalGioco.success) return dalGioco;
      // Il motivo non si perde: senza, «cattura riuscita» dallo schermo
      // nasconderebbe che il percorso migliore non era disponibile, ed è il
      // genere di silenzio che rende indiagnosticabile una traduzione sbagliata.
      console.info(
        `[capture] fotogramma dal gioco non disponibile (${dalGioco.error}), si ripiega sullo schermo`
      );
    }

    // Seconda scelta: la finestra. Non e' buona come il fotogramma dal gioco
    // (che e' nativo e sincronizzato col rendering) ma e' molto meglio dello
    // schermo, perche' chiede alla finestra di disegnarsi invece di copiare
    // un'area: coperta o meno, i pixel sono i suoi.
    if (options.windowTitle) {
      const daFinestra = await captureWindow(options.windowTitle);
      if (daFinestra.success) return daFinestra;
      console.info(
        `[capture] cattura finestra non riuscita (${daFinestra.error}), si ripiega sullo schermo`
      );
    }

    const isNative = await isNativeCaptureAvailable();

    if (isNative) {
      return await captureScreenNative(options);
    } else {
      return await captureScreenBrowser(options);
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Capture failed'
    };
  }
}

export interface PublishingGame {
  pid: number;
  process_name: string;
}

/**
 * Individua il gioco da cui prendere i fotogrammi, se ce n'è esattamente uno.
 *
 * Ritorna `null` sia quando non pubblica nessuno — caso normale, si cattura
 * dallo schermo — sia quando ne pubblicano **più d'uno**. Con due candidati la
 * scelta giusta è non sceglierne nessuno: prendere il primo tradurrebbe in
 * silenzio il gioco sbagliato, che è esattamente il difetto da cui è nata
 * questa parte del codice.
 */
export async function detectGameProcess(): Promise<string | null> {
  try {
    const giochi = (await invoke('list_publishing_games')) as PublishingGame[] | null;
    if (!giochi || giochi.length === 0) return null;
    if (giochi.length > 1) {
      console.info(
        `[capture] ${giochi.length} giochi stanno pubblicando ` +
          `(${giochi.map((g) => g.process_name).join(', ')}): non ne scelgo uno, ` +
          `si cattura dallo schermo`
      );
      return null;
    }
    return giochi[0].process_name;
  } catch {
    return null;
  }
}

/**
 * Legge l'ultimo fotogramma che gs-hook pubblica in memoria condivisa.
 *
 * Il contratto sta in `gs-hook/include/gs_frame_share.h`; il lettore è il
 * comando Tauri `read_game_frame` (`src-tauri/src/commands/game_frame.rs`).
 * Richiede che il gioco giri con gs-hook iniettato e `GS_HOOK_FRAME_SHARE=1`.
 */
export async function captureGameFrame(processName: string): Promise<CaptureResult> {
  try {
    const result = await invoke('read_game_frame', { processName }) as {
      image_data: string;
      width: number;
      height: number;
      sequence: number;
    };
    return {
      success: true,
      imageData: result.image_data,
      width: result.width,
      height: result.height
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Native screen capture using Tauri
 */
async function captureScreenNative(options: CaptureOptions): Promise<CaptureResult> {
  try {
    const result = await invoke('capture_screen', {
      x: options.x || 0,
      y: options.y || 0,
      width: options.width || 0,
      height: options.height || 0,
      monitor: options.monitor || 0
    }) as { image_data: string; width: number; height: number };
    
    return {
      success: true,
      imageData: result.image_data,
      width: result.width,
      height: result.height
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Native capture failed'
    };
  }
}

/**
 * Browser-based screen capture using getDisplayMedia API
 */
async function captureScreenBrowser(options: CaptureOptions): Promise<CaptureResult> {
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return {
        success: false,
        error: 'Screen capture not supported in this browser'
      };
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor'
      } as MediaTrackConstraints
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement('canvas');
    const width = options.width || video.videoWidth;
    const height = options.height || video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      stream.getTracks().forEach(track => track.stop());
      return {
        success: false,
        error: 'Failed to get canvas context'
      };
    }

    const sourceX = options.x || 0;
    const sourceY = options.y || 0;
    ctx.drawImage(video, sourceX, sourceY, width, height, 0, 0, width, height);

    stream.getTracks().forEach(track => track.stop());

    const imageData = canvas.toDataURL('image/png');

    return {
      success: true,
      imageData: imageData.replace('data:image/png;base64,', ''),
      width,
      height
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Screen capture permission denied by user'
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Browser capture failed'
    };
  }
}

/**
 * Capture a specific window (browser fallback not supported)
 */
export async function captureWindow(windowTitle: string): Promise<CaptureResult> {
  try {
    const result = await invoke('capture_window', { windowTitle }) as {
      image_data: string;
      width: number;
      height: number;
    };
    
    return {
      success: true,
      imageData: result.image_data,
      width: result.width,
      height: result.height
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Window capture not available'
    };
  }
}

/**
 * Elenco delle finestre catturabili.
 *
 * Usa `list_capture_windows`, che e' il comando VERO: `get_windows` (sotto)
 * appartiene al modulo stub e ritorna sempre una lista vuota. Le finestre
 * senza area client — come la finestra fantasma che ogni app Delphi espone —
 * sono gia' escluse a monte, in `ocr_translator::screen_capture::list_windows`.
 */
export async function getCaptureWindows(): Promise<{ hwnd: number; title: string }[]> {
  try {
    const w = (await invoke('list_capture_windows')) as { hwnd: number; title: string }[] | null;
    return w ?? [];
  } catch {
    return [];
  }
}

/**
 * Get list of capturable windows
 */
export async function getWindows(): Promise<{ title: string; id: number }[]> {
  try {
    const windows = await invoke('get_windows') as { title: string; id: number }[];
    return windows || [];
  } catch {
    return [];
  }
}

/**
 * Convert base64 image data to ImageData for processing
 */
export async function base64ToImageData(base64: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/png;base64,${base64}`;
  });
}

/**
 * Create a continuous capture stream
 */
export function createCaptureStream(
  intervalMs: number,
  options: CaptureOptions,
  onCapture: (result: CaptureResult) => void,
  onError: (error: Error) => void
): { stop: () => void } {
  let running = true;
  
  const capture = async () => {
    if (!running) return;
    
    try {
      const result = await captureScreen(options);
      if (running) {
        onCapture(result);
      }
    } catch (error: unknown) {
      if (running) {
        onError(error instanceof Error ? error : new Error('Capture failed'));
      }
    }
    
    if (running) {
      setTimeout(capture, intervalMs);
    }
  };
  
  capture();
  
  return {
    stop: () => {
      running = false;
    }
  };
}

