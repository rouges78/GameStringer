'use client';

import dynamic from 'next/dynamic';
import { Suspense, ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Loading fallback component
function LoadingFallback({ height = 200 }: { height?: number }) {
  return (
    <div 
      className="flex items-center justify-center bg-muted/30 rounded-lg animate-pulse"
      style={{ minHeight: height }}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// Skeleton components for specific areas
function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-20 bg-muted rounded" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-10 bg-muted rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-muted/50 rounded" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center animate-pulse">
      <div className="text-muted-foreground text-sm">Caricamento grafico...</div>
    </div>
  );
}

// Lazy load heavy components with proper loading states

// Translation Stats Widget
export const LazyTranslationStatsWidget = dynamic(
  () => import('@/components/dashboard/translation-stats-widget'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// Theme Customizer
export const LazyThemeCustomizer = dynamic(
  () => import('@/components/theme/theme-customizer').then(m => ({ default: m.ThemeCustomizer })),
  {
    loading: () => <LoadingFallback height={400} />,
    ssr: false,
  }
);

// Advanced Filters
export const LazyAdvancedFilters = dynamic(
  () => import('@/components/library/advanced-filters').then(m => ({ default: m.AdvancedFilters })),
  {
    loading: () => <div className="h-10 bg-muted rounded animate-pulse" />,
    ssr: false,
  }
);

// Quick Start Guide
export const LazyQuickStartGuide = dynamic(
  () => import('@/components/onboarding/quick-start-guide'),
  {
    loading: () => <CardSkeleton />,
    ssr: false,
  }
);

// Onboarding Wizard
export const LazyOnboardingWizard = dynamic(
  () => import('@/components/onboarding/onboarding-wizard').then(m => ({ default: m.OnboardingWizard })),
  {
    loading: () => null,
    ssr: false,
  }
);

// Interactive Tutorial
export const LazyInteractiveTutorial = dynamic(
  () => import('@/components/onboarding/interactive-tutorial'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Drop Zone
export const LazyDropZone = dynamic(
  () => import('@/components/ui/drop-zone'),
  {
    loading: () => <LoadingFallback height={150} />,
    ssr: false,
  }
);

// Utility: Create lazy component with custom loading
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  LoadingComponent: ReactNode = <LoadingFallback />
) {
  const LazyComponent = dynamic(importFn, {
    loading: () => <>{LoadingComponent}</>,
    ssr: false,
  });

  return LazyComponent;
}

// Prefetch utility for anticipated navigation
export function prefetchComponent(importFn: () => Promise<any>): void {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback if available, otherwise setTimeout
    const schedulePreload = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    schedulePreload(() => {
      importFn().catch(() => {
        // Silently ignore prefetch errors
      });
    });
  }
}

// Intersection Observer based lazy loading
export function useLazyLoad(ref: React.RefObject<HTMLElement>) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}

// Import statements for hook
import { useState, useEffect } from 'react';

// Virtualization helper for large lists
export function useVirtualList<T>(
  items: T[],
  containerRef: React.RefObject<HTMLElement>,
  itemHeight: number,
  overscan: number = 5
) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const end = Math.min(
        items.length,
        Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
      );

      setVisibleRange({ start, end });
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, overscan, containerRef]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  const offsetTop = visibleRange.start * itemHeight;
  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    offsetTop,
    totalHeight,
    visibleRange,
  };
}

// Image lazy loading with blur placeholder
export function LazyImage({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      {error ? (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Immagine non disponibile</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          width={width}
          height={height}
        />
      )}
    </div>
  );
}

export default {
  LazyTranslationStatsWidget,
  LazyThemeCustomizer,
  LazyAdvancedFilters,
  LazyQuickStartGuide,
  LazyOnboardingWizard,
  LazyInteractiveTutorial,
  LazyDropZone,
};
