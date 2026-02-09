"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useScreenSize, ScreenInfo, getScreenCssVariables } from "@/hooks/use-screen-size";

interface DisplayPrefs {
  uiScale: number;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  sidebarWidth: number;
  animationsEnabled: boolean;
}

const DEFAULT_DISPLAY: DisplayPrefs = {
  uiScale: 100,
  fontSize: 'medium',
  compactMode: false,
  sidebarWidth: 256,
  animationsEnabled: true,
};

interface ScreenContextType {
  screen: ScreenInfo;
  display: DisplayPrefs;
  isCompact: boolean;
  is4K: boolean;
  isUltraWide: boolean;
}

const ScreenContext = createContext<ScreenContextType | null>(null);

export function useScreen() {
  const context = useContext(ScreenContext);
  if (!context) {
    throw new Error("useScreen must be used within ScreenProvider");
  }
  return context;
}

function loadDisplayPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem('gameStringerSettings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.display) {
        return { ...DEFAULT_DISPLAY, ...parsed.display };
      }
    }
  } catch {}
  return DEFAULT_DISPLAY;
}

interface ScreenProviderProps {
  children: ReactNode;
}

export function ScreenProvider({ children }: ScreenProviderProps) {
  const screen = useScreenSize();
  const [mounted, setMounted] = useState(false);
  const [display, setDisplay] = useState<DisplayPrefs>(DEFAULT_DISPLAY);

  useEffect(() => {
    setMounted(true);
    setDisplay(loadDisplayPrefs());

    // Ascolta cambiamenti localStorage da ALTRE tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gameStringerSettings') {
        const next = loadDisplayPrefs();
        setDisplay(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
      }
    };
    window.addEventListener('storage', onStorage);

    // Ascolta cambiamenti dalla STESSA tab (evento custom emesso da settings page)
    const onDisplayChange = () => {
      const next = loadDisplayPrefs();
      setDisplay(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    window.addEventListener('gs-display-changed', onDisplayChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('gs-display-changed', onDisplayChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Applica CSS variables dal rilevamento schermo
    const cssVars = getScreenCssVariables(screen);
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Applica preferenze utente
    const scale = display.uiScale / 100;
    const fontBase = display.fontSize === 'small' ? '14px' : display.fontSize === 'large' ? '18px' : '16px';

    root.style.setProperty('--gs-ui-scale', scale.toString());
    root.style.setProperty('--gs-font-base', fontBase);
    root.style.setProperty('--gs-sidebar-width', `${display.sidebarWidth}px`);
    root.style.setProperty('--gs-sidebar-collapsed', '64px');
    root.style.fontSize = `calc(${fontBase} * ${scale})`;

    // Compact mode
    root.classList.toggle('gs-compact', display.compactMode);

    // Animazioni
    if (!display.animationsEnabled) {
      root.classList.add('gs-no-animations');
    } else {
      root.classList.remove('gs-no-animations');
    }

    // Classi breakpoint
    root.classList.remove("screen-compact", "screen-normal", "screen-4k", "screen-ultrawide");
    if (display.compactMode || screen.isCompact) {
      root.classList.add("screen-compact");
    } else if (screen.is4K) {
      root.classList.add("screen-4k");
    } else {
      root.classList.add("screen-normal");
    }
    if (screen.isUltraWide) {
      root.classList.add("screen-ultrawide");
    }

  }, [screen, display, mounted]);

  return (
    <ScreenContext.Provider
      value={{
        screen,
        display,
        isCompact: display.compactMode || screen.isCompact,
        is4K: screen.is4K,
        isUltraWide: screen.isUltraWide,
      }}
    >
      {children}
    </ScreenContext.Provider>
  );
}

export default ScreenProvider;
