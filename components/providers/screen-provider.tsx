"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useScreenSize, ScreenInfo, getScreenCssVariables } from "@/hooks/use-screen-size";

interface ScreenContextType {
  screen: ScreenInfo;
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

interface ScreenProviderProps {
  children: ReactNode;
}

export function ScreenProvider({ children }: ScreenProviderProps) {
  const screen = useScreenSize();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Applica CSS variables al root
    const cssVars = getScreenCssVariables(screen);
    const root = document.documentElement;

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Aggiungi classi per breakpoint
    root.classList.remove("screen-compact", "screen-normal", "screen-4k", "screen-ultrawide");
    
    if (screen.isCompact) {
      root.classList.add("screen-compact");
    } else if (screen.is4K) {
      root.classList.add("screen-4k");
    } else {
      root.classList.add("screen-normal");
    }

    if (screen.isUltraWide) {
      root.classList.add("screen-ultrawide");
    }

    // Log per debug
    console.log(`📐 Screen: ${screen.width}x${screen.height} (${screen.size}) - Scale: ${screen.scaleFactor}`);

  }, [screen, mounted]);

  return (
    <ScreenContext.Provider
      value={{
        screen,
        isCompact: screen.isCompact,
        is4K: screen.is4K,
        isUltraWide: screen.isUltraWide,
      }}
    >
      {children}
    </ScreenContext.Provider>
  );
}

export default ScreenProvider;
