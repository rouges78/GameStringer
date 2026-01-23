"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 📐 Screen Size Detection Hook
 * 
 * Rileva e adatta l'interfaccia alla risoluzione dello schermo dell'utente.
 * Supporta:
 * - Schermi piccoli (laptop 1366x768)
 * - Schermi medi (1920x1080 Full HD)
 * - Schermi grandi (2560x1440 QHD)
 * - Schermi ultra-wide (3440x1440)
 * - Schermi 4K (3840x2160)
 */

export type ScreenSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "4k";
export type ScreenDensity = "low" | "medium" | "high" | "ultra";

export interface ScreenInfo {
  width: number;
  height: number;
  size: ScreenSize;
  density: ScreenDensity;
  isCompact: boolean;      // < 1400px width
  isUltraWide: boolean;    // > 2560px width or aspect ratio > 2
  is4K: boolean;           // >= 3840px width
  aspectRatio: number;
  scaleFactor: number;     // Per UI scaling
  sidebarWidth: number;    // Larghezza sidebar consigliata
  fontSize: "sm" | "base" | "lg";
  spacing: "compact" | "normal" | "relaxed";
  gridCols: number;        // Colonne griglia consigliate
}

const BREAKPOINTS = {
  xs: 640,
  sm: 768,
  md: 1024,
  lg: 1280,
  xl: 1536,
  "2xl": 1920,
  "4k": 3840,
};

function getScreenSize(width: number): ScreenSize {
  if (width < BREAKPOINTS.xs) return "xs";
  if (width < BREAKPOINTS.sm) return "sm";
  if (width < BREAKPOINTS.md) return "md";
  if (width < BREAKPOINTS.lg) return "lg";
  if (width < BREAKPOINTS.xl) return "xl";
  if (width < BREAKPOINTS["4k"]) return "2xl";
  return "4k";
}

function getScreenDensity(width: number, height: number): ScreenDensity {
  const pixels = width * height;
  if (pixels < 1920 * 1080) return "low";
  if (pixels < 2560 * 1440) return "medium";
  if (pixels < 3840 * 2160) return "high";
  return "ultra";
}

function getScaleFactor(width: number): number {
  if (width < 1400) return 0.85;
  if (width < 1920) return 0.95;
  if (width < 2560) return 1.0;
  if (width < 3840) return 1.1;
  return 1.25;
}

function getSidebarWidth(width: number, isCollapsed: boolean): number {
  if (isCollapsed) return 64;
  if (width < 1400) return 200;
  if (width < 1920) return 240;
  if (width < 2560) return 260;
  return 280;
}

function getFontSize(width: number): "sm" | "base" | "lg" {
  if (width < 1400) return "sm";
  if (width < 2560) return "base";
  return "lg";
}

function getSpacing(width: number): "compact" | "normal" | "relaxed" {
  if (width < 1400) return "compact";
  if (width < 2560) return "normal";
  return "relaxed";
}

function getGridCols(width: number): number {
  if (width < 768) return 1;
  if (width < 1024) return 2;
  if (width < 1400) return 3;
  if (width < 1920) return 4;
  if (width < 2560) return 5;
  return 6;
}

export function useScreenSize(sidebarCollapsed: boolean = false): ScreenInfo {
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(() => {
    // Default per SSR
    return {
      width: 1920,
      height: 1080,
      size: "2xl",
      density: "medium",
      isCompact: false,
      isUltraWide: false,
      is4K: false,
      aspectRatio: 16 / 9,
      scaleFactor: 1.0,
      sidebarWidth: 240,
      fontSize: "base",
      spacing: "normal",
      gridCols: 4,
    };
  });

  const updateScreenInfo = useCallback(() => {
    if (typeof window === "undefined") return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;

    setScreenInfo({
      width,
      height,
      size: getScreenSize(width),
      density: getScreenDensity(width, height),
      isCompact: width < 1400,
      isUltraWide: width > 2560 || aspectRatio > 2,
      is4K: width >= 3840,
      aspectRatio,
      scaleFactor: getScaleFactor(width),
      sidebarWidth: getSidebarWidth(width, sidebarCollapsed),
      fontSize: getFontSize(width),
      spacing: getSpacing(width),
      gridCols: getGridCols(width),
    });
  }, [sidebarCollapsed]);

  useEffect(() => {
    updateScreenInfo();

    const handleResize = () => {
      updateScreenInfo();
    };

    window.addEventListener("resize", handleResize);
    
    // Anche su orientationchange per tablet/mobile
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [updateScreenInfo]);

  return screenInfo;
}

/**
 * Hook per ottenere classi CSS responsive
 */
export function useResponsiveClasses() {
  const screen = useScreenSize();

  return {
    // Container
    containerClass: screen.isCompact 
      ? "px-3 py-2" 
      : screen.is4K 
        ? "px-8 py-6" 
        : "px-4 py-4",

    // Card
    cardClass: screen.isCompact
      ? "p-3"
      : screen.is4K
        ? "p-6"
        : "p-4",

    // Grid
    gridClass: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(screen.gridCols, 4)} gap-${screen.isCompact ? "3" : "4"}`,

    // Font
    textClass: screen.fontSize === "sm" 
      ? "text-sm" 
      : screen.fontSize === "lg" 
        ? "text-lg" 
        : "text-base",

    // Spacing
    spacingClass: screen.spacing === "compact"
      ? "space-y-2"
      : screen.spacing === "relaxed"
        ? "space-y-6"
        : "space-y-4",

    // Header
    headerClass: screen.isCompact
      ? "h-12"
      : screen.is4K
        ? "h-20"
        : "h-16",

    // Sidebar
    sidebarClass: screen.isCompact
      ? "w-[200px]"
      : screen.is4K
        ? "w-[280px]"
        : "w-[240px]",
  };
}

/**
 * Hook per stili inline responsive
 */
export function useResponsiveStyles() {
  const screen = useScreenSize();

  return {
    fontSize: screen.fontSize === "sm" ? 14 : screen.fontSize === "lg" ? 18 : 16,
    padding: screen.spacing === "compact" ? 8 : screen.spacing === "relaxed" ? 24 : 16,
    gap: screen.spacing === "compact" ? 8 : screen.spacing === "relaxed" ? 20 : 12,
    borderRadius: screen.isCompact ? 6 : 8,
    iconSize: screen.isCompact ? 16 : screen.is4K ? 24 : 20,
  };
}

/**
 * CSS Variables da applicare al root
 */
export function getScreenCssVariables(screen: ScreenInfo): Record<string, string> {
  return {
    "--screen-scale": screen.scaleFactor.toString(),
    "--sidebar-width": `${screen.sidebarWidth}px`,
    "--font-size-base": screen.fontSize === "sm" ? "14px" : screen.fontSize === "lg" ? "18px" : "16px",
    "--spacing-unit": screen.spacing === "compact" ? "0.5rem" : screen.spacing === "relaxed" ? "1.5rem" : "1rem",
    "--grid-cols": screen.gridCols.toString(),
    "--card-padding": screen.spacing === "compact" ? "0.75rem" : screen.spacing === "relaxed" ? "1.5rem" : "1rem",
  };
}

export default useScreenSize;
