import { useState, useEffect, useCallback } from 'react';
import { safeSetItem, safeGetItem } from './safe-storage';

const FONT_SIZE_KEY = 'app_font_size';

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface FontSizeConfig {
  size: FontSize;
  scale: number;
  label: string;
}

export const fontSizeConfigs: Record<FontSize, FontSizeConfig> = {
  small: { size: 'small', scale: 0.875, label: 'Piccolo' },
  medium: { size: 'medium', scale: 1, label: 'Medio' },
  large: { size: 'large', scale: 1.125, label: 'Grande' },
  xlarge: { size: 'xlarge', scale: 1.25, label: 'Molto Grande' },
};

/**
 * Carica font size salvato
 */
export function loadFontSize(): FontSize {
  const saved = safeGetItem<FontSize>(FONT_SIZE_KEY);
  if (saved && saved in fontSizeConfigs) {
    return saved;
  }
  return 'medium';
}

/**
 * Salva font size
 */
export function saveFontSize(size: FontSize): void {
  safeSetItem(FONT_SIZE_KEY, size);
}

/**
 * Applica font size al documento
 */
export function applyFontSize(size: FontSize): void {
  const config = fontSizeConfigs[size];
  document.documentElement.style.fontSize = `${config.scale * 16}px`;
  document.documentElement.setAttribute('data-font-size', size);
}

/**
 * Hook per gestire font size
 */
export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  
  // Carica e applica all'avvio
  useEffect(() => {
    const saved = loadFontSize();
    setFontSizeState(saved);
    applyFontSize(saved);
  }, []);
  
  // Setter che salva e applica
  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    saveFontSize(size);
    applyFontSize(size);
  }, []);
  
  // Incrementa/decrementa
  const increaseFontSize = useCallback(() => {
    const sizes: FontSize[] = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = sizes.indexOf(fontSize);
    if (currentIndex < sizes.length - 1) {
      setFontSize(sizes[currentIndex + 1]);
    }
  }, [fontSize, setFontSize]);
  
  const decreaseFontSize = useCallback(() => {
    const sizes: FontSize[] = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = sizes.indexOf(fontSize);
    if (currentIndex > 0) {
      setFontSize(sizes[currentIndex - 1]);
    }
  }, [fontSize, setFontSize]);
  
  const resetFontSize = useCallback(() => {
    setFontSize('medium');
  }, [setFontSize]);
  
  return {
    fontSize,
    fontSizeConfig: fontSizeConfigs[fontSize],
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    availableSizes: Object.values(fontSizeConfigs),
  };
}
