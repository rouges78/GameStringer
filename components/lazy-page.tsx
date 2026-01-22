'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { ComponentType, Suspense } from 'react';

/**
 * Loading skeleton for lazy-loaded pages
 */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    </div>
  );
}

/**
 * Create a lazy-loaded page component
 */
export function lazyPage<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options?: { ssr?: boolean }
) {
  return dynamic(importFn, {
    loading: () => <PageLoader />,
    ssr: options?.ssr ?? true,
  });
}

/**
 * Wrap component with Suspense for client-side lazy loading
 */
export function LazyWrapper({ 
  children,
  fallback = <PageLoader />
}: { 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

// Pre-configured lazy loaders for heavy pages
export const LazyEditorPage = lazyPage(
  () => import('@/app/editor/page'),
  { ssr: false }
);

export const LazyHeatmapPage = lazyPage(
  () => import('@/app/heatmap/page'),
  { ssr: false }
);

export const LazyTranslatorProPage = lazyPage(
  () => import('@/app/translator/pro/page'),
  { ssr: false }
);

export const LazyOcrTranslatorPage = lazyPage(
  () => import('@/app/ocr-translator/page'),
  { ssr: false }
);

export const LazyVisualEditorPage = lazyPage(
  () => import('@/app/visual-editor/page'),
  { ssr: false }
);
