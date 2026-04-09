'use client';

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

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
  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight' && selectedIndex < screenshots.length - 1) {
          onNavigate(selectedIndex + 1);
        }
        if (e.key === 'ArrowLeft' && selectedIndex > 0) {
          onNavigate(selectedIndex - 1);
        }
      }}
      tabIndex={0}
      ref={(el) => el?.focus()}
    >
      {/* Container con immagine e controlli */}
      <motion.div
        key={selectedIndex}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Immagine con controlli attaccati */}
        <div className="relative">
          <img
            src={screenshots[selectedIndex]?.path_full || screenshots[selectedIndex]?.path_thumbnail}
            alt={`Screenshot ${selectedIndex + 1}`}
            className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg shadow-xl"
          />

          {/* X chiudi - angolo alto destra della foto */}
          <button
            className="absolute -top-2 -right-2 w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-lg"
            onClick={onClose}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Freccia sinistra - bordo sinistro della foto */}
          {selectedIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center text-slate-300 hover:text-white transition-all"
              onClick={(e) => { e.stopPropagation(); onNavigate(selectedIndex - 1); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Freccia destra - bordo destro della foto */}
          {selectedIndex < screenshots.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center text-slate-300 hover:text-white transition-all"
              onClick={(e) => { e.stopPropagation(); onNavigate(selectedIndex + 1); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Thumbnails sotto */}
        <div className="flex items-center gap-1.5 mt-3">
          {screenshots.slice(0, 10).map((screenshot: Screenshot, index: number) => (
            <button
              key={index}
              className={`w-12 h-7 rounded overflow-hidden transition-all border ${
                index === selectedIndex
                  ? 'border-purple-500 scale-105'
                  : 'border-transparent opacity-50 hover:opacity-80'
              }`}
              onClick={(e) => { e.stopPropagation(); onNavigate(index); }}
            >
              <img src={screenshot.path_thumbnail} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        <div className="text-slate-500 text-xs mt-1.5">
          {selectedIndex + 1} / {screenshots.length}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
