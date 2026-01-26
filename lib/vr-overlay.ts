/**
 * VR Text Overlay - Supporto per giochi VR con testo spaziale
 * Gestisce posizionamento 3D, tracking e rendering di sottotitoli in VR
 */

export interface VROverlayConfig {
  id: string;
  name: string;
  enabled: boolean;
  position: Vector3;
  rotation: Vector3;
  scale: number;
  opacity: number;
  followHead: boolean;
  lockDistance: number;
  style: VRTextStyle;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface VRTextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
  borderRadius: number;
  maxWidth: number;
  textAlign: 'left' | 'center' | 'right';
  shadow: boolean;
  outline: boolean;
  outlineColor: string;
}

export interface VRSubtitle {
  id: string;
  text: string;
  speaker?: string;
  startTime: number;
  endTime: number;
  position?: Vector3;
  emotion?: string;
}

export interface VRHeadset {
  name: string;
  id: string;
  sdk: 'openvr' | 'openxr' | 'oculus' | 'wavevr';
  isConnected: boolean;
  trackingStatus: 'tracking' | 'lost' | 'calibrating';
}

// Preset posizioni per sottotitoli VR
export const VR_POSITION_PRESETS: Record<string, { position: Vector3; rotation: Vector3 }> = {
  bottom_center: {
    position: { x: 0, y: -0.5, z: 2 },
    rotation: { x: -15, y: 0, z: 0 },
  },
  top_center: {
    position: { x: 0, y: 0.8, z: 2 },
    rotation: { x: 10, y: 0, z: 0 },
  },
  left_peripheral: {
    position: { x: -1.2, y: 0, z: 1.5 },
    rotation: { x: 0, y: 25, z: 0 },
  },
  right_peripheral: {
    position: { x: 1.2, y: 0, z: 1.5 },
    rotation: { x: 0, y: -25, z: 0 },
  },
  floating_center: {
    position: { x: 0, y: 0.2, z: 1.8 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  wrist_mounted: {
    position: { x: -0.3, y: -0.4, z: 0.4 },
    rotation: { x: -45, y: 30, z: 0 },
  },
};

// Stili preset per VR
export const VR_STYLE_PRESETS: Record<string, VRTextStyle> = {
  standard: {
    fontSize: 24,
    fontFamily: 'Arial, sans-serif',
    color: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    padding: 16,
    borderRadius: 8,
    maxWidth: 600,
    textAlign: 'center',
    shadow: true,
    outline: false,
    outlineColor: '#000000',
  },
  minimal: {
    fontSize: 20,
    fontFamily: 'Roboto, sans-serif',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    padding: 8,
    borderRadius: 0,
    maxWidth: 500,
    textAlign: 'center',
    shadow: true,
    outline: true,
    outlineColor: '#000000',
  },
  cinematic: {
    fontSize: 28,
    fontFamily: 'Georgia, serif',
    color: '#F5F5DC',
    backgroundColor: '#1a1a1a',
    backgroundOpacity: 0.85,
    padding: 20,
    borderRadius: 4,
    maxWidth: 700,
    textAlign: 'center',
    shadow: true,
    outline: false,
    outlineColor: '#000000',
  },
  gaming: {
    fontSize: 22,
    fontFamily: 'Consolas, monospace',
    color: '#00FF00',
    backgroundColor: '#0a0a0a',
    backgroundOpacity: 0.8,
    padding: 12,
    borderRadius: 0,
    maxWidth: 550,
    textAlign: 'left',
    shadow: false,
    outline: true,
    outlineColor: '#003300',
  },
  accessibility: {
    fontSize: 32,
    fontFamily: 'OpenDyslexic, Arial, sans-serif',
    color: '#FFFF00',
    backgroundColor: '#000033',
    backgroundOpacity: 0.9,
    padding: 24,
    borderRadius: 12,
    maxWidth: 650,
    textAlign: 'center',
    shadow: true,
    outline: true,
    outlineColor: '#FFFFFF',
  },
};

class VROverlayService {
  private config: VROverlayConfig | null = null;
  private currentSubtitles: VRSubtitle[] = [];
  private activeSubtitle: VRSubtitle | null = null;
  private headset: VRHeadset | null = null;
  private isRunning = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gamestringer_vr_overlay');
      if (stored) {
        this.config = JSON.parse(stored);
      } else {
        this.config = this.getDefaultConfig();
      }
    }
  }

  private saveConfig() {
    if (typeof window !== 'undefined' && this.config) {
      localStorage.setItem('gamestringer_vr_overlay', JSON.stringify(this.config));
    }
  }

  getDefaultConfig(): VROverlayConfig {
    return {
      id: crypto.randomUUID(),
      name: 'Default VR Overlay',
      enabled: true,
      position: VR_POSITION_PRESETS.bottom_center.position,
      rotation: VR_POSITION_PRESETS.bottom_center.rotation,
      scale: 1.0,
      opacity: 1.0,
      followHead: true,
      lockDistance: 2.0,
      style: VR_STYLE_PRESETS.standard,
    };
  }

  getConfig(): VROverlayConfig | null {
    return this.config;
  }

  updateConfig(updates: Partial<VROverlayConfig>) {
    if (this.config) {
      this.config = { ...this.config, ...updates };
      this.saveConfig();
    }
  }

  applyPositionPreset(presetName: string) {
    const preset = VR_POSITION_PRESETS[presetName];
    if (preset && this.config) {
      this.config.position = preset.position;
      this.config.rotation = preset.rotation;
      this.saveConfig();
    }
  }

  applyStylePreset(presetName: string) {
    const preset = VR_STYLE_PRESETS[presetName];
    if (preset && this.config) {
      this.config.style = preset;
      this.saveConfig();
    }
  }

  async detectHeadset(): Promise<VRHeadset | null> {
    // Simula rilevamento headset VR
    // In produzione, userebbe OpenVR/OpenXR API
    try {
      // Check for WebXR support
      if ('xr' in navigator) {
        const xr = (navigator as any).xr;
        const isSupported = await xr.isSessionSupported('immersive-vr');
        
        if (isSupported) {
          this.headset = {
            name: 'WebXR Compatible Headset',
            id: 'webxr-default',
            sdk: 'openxr',
            isConnected: true,
            trackingStatus: 'tracking',
          };
          return this.headset;
        }
      }

      // Fallback: check for common VR processes (Tauri backend)
      // This would use invoke() to check system processes
      return null;
    } catch (error) {
      console.error('Errore rilevamento headset:', error);
      return null;
    }
  }

  getHeadset(): VRHeadset | null {
    return this.headset;
  }

  loadSubtitles(subtitles: VRSubtitle[]) {
    this.currentSubtitles = subtitles.sort((a, b) => a.startTime - b.startTime);
  }

  getSubtitleAt(time: number): VRSubtitle | null {
    return this.currentSubtitles.find(
      sub => time >= sub.startTime && time <= sub.endTime
    ) || null;
  }

  setActiveSubtitle(subtitle: VRSubtitle | null) {
    this.activeSubtitle = subtitle;
  }

  getActiveSubtitle(): VRSubtitle | null {
    return this.activeSubtitle;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // In produzione, questo invierebbe dati all'overlay VR
    this.updateInterval = setInterval(() => {
      // Update loop per sincronizzazione
    }, 16); // ~60fps
  }

  stop() {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  // Calcola posizione 3D basata sulla posizione della testa
  calculateWorldPosition(headPosition: Vector3, headRotation: Vector3): Vector3 {
    if (!this.config) return { x: 0, y: 0, z: 0 };

    const { position, lockDistance, followHead } = this.config;

    if (!followHead) {
      return position;
    }

    // Semplice calcolo: posiziona il testo davanti alla testa
    const radY = (headRotation.y * Math.PI) / 180;
    const radX = (headRotation.x * Math.PI) / 180;

    return {
      x: headPosition.x + Math.sin(radY) * lockDistance + position.x,
      y: headPosition.y + Math.sin(radX) * lockDistance + position.y,
      z: headPosition.z + Math.cos(radY) * lockDistance + position.z,
    };
  }

  // Genera CSS per preview 2D
  generatePreviewStyle(): React.CSSProperties {
    if (!this.config) return {};

    const { style, opacity } = this.config;

    return {
      fontSize: `${style.fontSize}px`,
      fontFamily: style.fontFamily,
      color: style.color,
      backgroundColor: `rgba(${this.hexToRgb(style.backgroundColor)}, ${style.backgroundOpacity})`,
      padding: `${style.padding}px`,
      borderRadius: `${style.borderRadius}px`,
      maxWidth: `${style.maxWidth}px`,
      textAlign: style.textAlign,
      opacity,
      textShadow: style.shadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
      WebkitTextStroke: style.outline ? `1px ${style.outlineColor}` : 'none',
    };
  }

  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 0, 0';
  }

  // Export config per SteamVR/OVR Toolkit
  exportForSteamVR(): object {
    if (!this.config) return {};

    return {
      type: 'overlay',
      name: this.config.name,
      transform: {
        position: this.config.position,
        rotation: this.config.rotation,
        scale: this.config.scale,
      },
      settings: {
        opacity: this.config.opacity,
        curvature: 0,
        width: this.config.style.maxWidth / 1000,
      },
    };
  }
}

export const vrOverlayService = new VROverlayService();
