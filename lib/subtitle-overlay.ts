/**
 * Real-time Subtitle Overlay
 * Sistema per mostrare traduzioni live come sottotitoli trasparenti
 * Ideale per streaming e recording
 */

export interface SubtitleConfig {
  position: 'top' | 'bottom' | 'center';
  fontSize: number;
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  maxLines: number;
  displayDuration: number; // ms
  fadeInDuration: number;
  fadeOutDuration: number;
  showOriginal: boolean;
  originalPosition: 'above' | 'below' | 'inline';
  originalFontSize: number;
  originalColor: string;
  borderRadius: number;
  padding: number;
  margin: number;
  shadow: boolean;
  animation: 'fade' | 'slide' | 'typewriter' | 'none';
}

export interface Subtitle {
  id: string;
  originalText: string;
  translatedText: string;
  startTime: number;
  endTime?: number;
  isVisible: boolean;
  speaker?: string;
  confidence?: number;
}

export interface OverlayState {
  isActive: boolean;
  isPaused: boolean;
  currentSubtitles: Subtitle[];
  history: Subtitle[];
  config: SubtitleConfig;
  stats: OverlayStats;
}

export interface OverlayStats {
  totalSubtitles: number;
  avgDisplayTime: number;
  charactersTranslated: number;
  sessionDuration: number;
}

export const DEFAULT_CONFIG: SubtitleConfig = {
  position: 'bottom',
  fontSize: 24,
  fontFamily: 'Inter, system-ui, sans-serif',
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  maxLines: 3,
  displayDuration: 5000,
  fadeInDuration: 200,
  fadeOutDuration: 300,
  showOriginal: true,
  originalPosition: 'above',
  originalFontSize: 16,
  originalColor: '#AAAAAA',
  borderRadius: 8,
  padding: 16,
  margin: 32,
  shadow: true,
  animation: 'fade',
};

// Preset per diversi stili
export const STYLE_PRESETS: Record<string, Partial<SubtitleConfig>> = {
  netflix: {
    position: 'bottom',
    fontSize: 28,
    fontFamily: 'Netflix Sans, Helvetica, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    shadow: true,
    showOriginal: false,
  },
  youtube: {
    position: 'bottom',
    fontSize: 22,
    fontFamily: 'Roboto, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#0D0D0D',
    backgroundOpacity: 0.8,
    borderRadius: 4,
    padding: 8,
  },
  gaming: {
    position: 'bottom',
    fontSize: 20,
    fontFamily: 'Consolas, monospace',
    textColor: '#00FF00',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    showOriginal: true,
    originalColor: '#666666',
  },
  anime: {
    position: 'bottom',
    fontSize: 26,
    fontFamily: 'Yu Gothic, sans-serif',
    textColor: '#FFFF00',
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    shadow: true,
    borderRadius: 0,
  },
  minimal: {
    position: 'bottom',
    fontSize: 18,
    fontFamily: 'system-ui, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    shadow: true,
    showOriginal: false,
    padding: 8,
  },
  highContrast: {
    position: 'bottom',
    fontSize: 28,
    fontFamily: 'Arial, sans-serif',
    textColor: '#FFFF00',
    backgroundColor: '#000000',
    backgroundOpacity: 1,
    showOriginal: false,
    borderRadius: 0,
    padding: 12,
  },
};

/**
 * Genera CSS per l'overlay
 */
export function generateOverlayCSS(config: SubtitleConfig): string {
  const positionStyles = {
    top: 'top: 0; left: 50%; transform: translateX(-50%);',
    bottom: 'bottom: 0; left: 50%; transform: translateX(-50%);',
    center: 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
  };

  const bgColor = hexToRgba(config.backgroundColor, config.backgroundOpacity);
  
  return `
.subtitle-overlay {
  position: fixed;
  ${positionStyles[config.position]}
  margin: ${config.margin}px;
  z-index: 999999;
  pointer-events: none;
  font-family: ${config.fontFamily};
  max-width: calc(100vw - ${config.margin * 2}px);
}

.subtitle-container {
  background: ${bgColor};
  border-radius: ${config.borderRadius}px;
  padding: ${config.padding}px ${config.padding * 1.5}px;
  text-align: center;
  ${config.shadow ? 'text-shadow: 2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5);' : ''}
}

.subtitle-original {
  font-size: ${config.originalFontSize}px;
  color: ${config.originalColor};
  margin-bottom: 4px;
  opacity: 0.8;
}

.subtitle-translated {
  font-size: ${config.fontSize}px;
  color: ${config.textColor};
  line-height: 1.4;
}

.subtitle-speaker {
  font-size: ${config.fontSize * 0.7}px;
  color: ${config.textColor};
  opacity: 0.7;
  margin-bottom: 4px;
  font-weight: bold;
}

/* Animations */
.subtitle-fade-enter {
  opacity: 0;
}
.subtitle-fade-enter-active {
  opacity: 1;
  transition: opacity ${config.fadeInDuration}ms ease-in;
}
.subtitle-fade-exit {
  opacity: 1;
}
.subtitle-fade-exit-active {
  opacity: 0;
  transition: opacity ${config.fadeOutDuration}ms ease-out;
}

.subtitle-slide-enter {
  opacity: 0;
  transform: translateY(20px);
}
.subtitle-slide-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all ${config.fadeInDuration}ms ease-out;
}
.subtitle-slide-exit {
  opacity: 1;
  transform: translateY(0);
}
.subtitle-slide-exit-active {
  opacity: 0;
  transform: translateY(-20px);
  transition: all ${config.fadeOutDuration}ms ease-in;
}

.subtitle-typewriter {
  overflow: hidden;
  white-space: nowrap;
  animation: typewriter 0.5s steps(40) forwards;
}

@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}
`;
}

/**
 * Converte hex a rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Genera HTML per un sottotitolo
 */
export function generateSubtitleHTML(
  subtitle: Subtitle, 
  config: SubtitleConfig
): string {
  let html = '<div class="subtitle-container">';
  
  if (subtitle.speaker) {
    html += `<div class="subtitle-speaker">[${subtitle.speaker}]</div>`;
  }
  
  if (config.showOriginal && config.originalPosition === 'above') {
    html += `<div class="subtitle-original">${escapeHTML(subtitle.originalText)}</div>`;
  }
  
  html += `<div class="subtitle-translated">${escapeHTML(subtitle.translatedText)}</div>`;
  
  if (config.showOriginal && config.originalPosition === 'below') {
    html += `<div class="subtitle-original">${escapeHTML(subtitle.originalText)}</div>`;
  }
  
  if (config.showOriginal && config.originalPosition === 'inline') {
    html = `<div class="subtitle-container">
      <div class="subtitle-translated">
        ${escapeHTML(subtitle.translatedText)}
        <span class="subtitle-original" style="display: block; margin-top: 4px;">
          (${escapeHTML(subtitle.originalText)})
        </span>
      </div>
    </div>`;
  }
  
  html += '</div>';
  return html;
}

/**
 * Escape HTML
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Storage keys
 */
const CONFIG_KEY = 'gamestringer_subtitle_config';
const HISTORY_KEY = 'gamestringer_subtitle_history';

/**
 * Salva configurazione
 */
export function saveConfig(config: SubtitleConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Carica configurazione
 */
export function loadConfig(): SubtitleConfig {
  const stored = localStorage.getItem(CONFIG_KEY);
  return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
}

/**
 * Salva history sottotitoli
 */
export function saveHistory(history: Subtitle[]): void {
  // Mantieni solo ultimi 100
  const trimmed = history.slice(-100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

/**
 * Carica history
 */
export function loadHistory(): Subtitle[] {
  const stored = localStorage.getItem(HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Genera ID univoco
 */
export function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Esporta sottotitoli in formato SRT
 */
export function exportToSRT(subtitles: Subtitle[]): string {
  return subtitles
    .filter(s => s.endTime)
    .map((sub, index) => {
      const start = formatSRTTime(sub.startTime);
      const end = formatSRTTime(sub.endTime!);
      return `${index + 1}\n${start} --> ${end}\n${sub.translatedText}\n`;
    })
    .join('\n');
}

/**
 * Formatta tempo per SRT (HH:MM:SS,mmm)
 */
function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0');
}

/**
 * Esporta sottotitoli in formato VTT
 */
export function exportToVTT(subtitles: Subtitle[]): string {
  const header = 'WEBVTT\n\n';
  const content = subtitles
    .filter(s => s.endTime)
    .map((sub, index) => {
      const start = formatVTTTime(sub.startTime);
      const end = formatVTTTime(sub.endTime!);
      return `${index + 1}\n${start} --> ${end}\n${sub.translatedText}\n`;
    })
    .join('\n');
  
  return header + content;
}

/**
 * Formatta tempo per VTT (HH:MM:SS.mmm)
 */
function formatVTTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}
