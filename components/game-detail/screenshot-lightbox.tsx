'use client';

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';

interface Screenshot {
  id?: number;
  path_thumbnail: string;
  path_full: string;
}

interface ScreenshotLightboxProps {
  screenshots: Screenshot[];
  selectedIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ScreenshotLightbox({ screenshots, selectedIndex, onClose, onNavigate }: ScreenshotLightboxProps) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Reset zoom when changing image
  useEffect(() => {
    setZoom(1);
    setIsLoading(true);
  }, [selectedIndex]);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.5, 3)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.5, 0.5)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  const handleDownload = useCallback(() => {
    const url = screenshots[selectedIndex]?.path_full || screenshots[selectedIndex]?.path_thumbnail;
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${selectedIndex + 1}.jpg`;
      a.click();
    }
  }, [screenshots, selectedIndex]);

  if (typeof document === 'undefined') return null;

  const currentScreenshot = screenshots[selectedIndex];
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex < screenshots.length - 1;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight' && hasNext) onNavigate(selectedIndex + 1);
        if (e.key === 'ArrowLeft' && hasPrev) onNavigate(selectedIndex - 1);
        if (e.key === '+' || e.key === '=') handleZoomIn();
        if (e.key === '-') handleZoomOut();
        if (e.key === '0') handleZoomReset();
      }}
      tabIndex={0}
      ref={(el) => el?.focus()}
    >
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-noir-950 via-noir-900 to-noir-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,59,74,0.08),transparent_70%)]" />
      
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-noir-900/80 backdrop-blur-sm border-b border-noir-800/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{t('common.screenshot')}</span>
          <span className="px-2 py-0.5 rounded-full bg-rouge-500/20 text-rouge-300 text-xs font-medium">
            {selectedIndex + 1} / {screenshots.length}
          </span>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-noir-800 text-noir-400 hover:text-white transition-colors"
            title={t('common.zoomOut') + ' (-)'}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs text-noir-500 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-noir-800 text-noir-400 hover:text-white transition-colors"
            title={t('common.zoomIn') + ' (+)'}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-noir-700 mx-2" />
          <button
            onClick={handleZoomReset}
            className="p-2 rounded-lg hover:bg-noir-800 text-noir-400 hover:text-white transition-colors"
            title={t('common.fitToScreen') + ' (0)'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-noir-800 text-noir-400 hover:text-white transition-colors"
            title={t('common.download')}
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-noir-700 mx-2" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-red-500/20 text-noir-400 hover:text-red-400 transition-colors"
            title={t('common.close') + ' (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden" onClick={onClose}>
        {/* Navigation buttons - large clickable areas */}
        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(selectedIndex - 1); }}
            className="absolute left-0 top-0 bottom-0 w-24 z-20 flex items-center justify-start pl-4 group"
          >
            <div className="w-12 h-12 rounded-full bg-noir-900/80 backdrop-blur-sm border border-noir-700/50 flex items-center justify-center text-noir-400 group-hover:text-white group-hover:bg-noir-800 group-hover:border-noir-600 transition-all group-hover:scale-110">
              <ChevronLeft className="w-6 h-6" />
            </div>
          </button>
        )}
        
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(selectedIndex + 1); }}
            className="absolute right-0 top-0 bottom-0 w-24 z-20 flex items-center justify-end pr-4 group"
          >
            <div className="w-12 h-12 rounded-full bg-noir-900/80 backdrop-blur-sm border border-noir-700/50 flex items-center justify-center text-noir-400 group-hover:text-white group-hover:bg-noir-800 group-hover:border-noir-600 transition-all group-hover:scale-110">
              <ChevronRight className="w-6 h-6" />
            </div>
          </button>
        )}

        {/* Image container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading skeleton */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-rouge-500/30 border-t-rouge-500 animate-spin" />
              </div>
            )}
            
            {/* Main image */}
            <motion.img
              src={currentScreenshot?.path_full || currentScreenshot?.path_thumbnail}
              alt={`Screenshot ${selectedIndex + 1}`}
              className="max-w-[85vw] max-h-[70vh] object-contain rounded-xl shadow-2xl shadow-black/50 cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoom})` }}
              onLoad={() => setIsLoading(false)}
              draggable={false}
            />
            
            {/* Image frame glow */}
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-rouge-500/20 via-rouge-500/20 to-rouge-500/20 blur-xl -z-10 opacity-50" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Thumbnail strip */}
      <div className="relative z-10 bg-noir-900/80 backdrop-blur-sm border-t border-noir-800/50 px-4 py-3">
        <div className="flex items-center justify-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pb-1">
          {screenshots.map((screenshot, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200 ${
                index === selectedIndex
                  ? 'ring-2 ring-rouge-500 ring-offset-2 ring-offset-noir-900'
                  : 'opacity-50 hover:opacity-100'
              }`}
              onClick={() => onNavigate(index)}
            >
              <img 
                src={screenshot.path_thumbnail} 
                alt={`Thumbnail ${index + 1}`}
                className="w-20 h-12 object-cover"
              />
              {index === selectedIndex && (
                <motion.div 
                  layoutId="thumbnail-indicator"
                  className="absolute inset-0 bg-rouge-500/10"
                />
              )}
            </motion.button>
          ))}
        </div>
        
        {/* Keyboard hints */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-noir-500">
          <span><kbd className="px-1.5 py-0.5 rounded bg-noir-800 text-noir-400">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-noir-800 text-noir-400">→</kbd> Naviga</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-noir-800 text-noir-400">+</kbd> <kbd className="px-1.5 py-0.5 rounded bg-noir-800 text-noir-400">-</kbd> Zoom</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-noir-800 text-noir-400">Esc</kbd> Chiudi</span>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

