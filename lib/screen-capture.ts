/**
 * Screen Capture Service
 * Uses Tauri commands for native screen capture when available,
 * falls back to browser APIs when running in web mode
 */
import { safeInvoke as invoke } from './tauri-wrapper';

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
    const isNative = await isNativeCaptureAvailable();
    
    if (isNative) {
      return await captureScreenNative(options);
    } else {
      return await captureScreenBrowser(options);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Capture failed'
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
  } catch (error) {
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
      } as any
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
  } catch (error) {
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Window capture not available'
    };
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
    } catch (error) {
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
