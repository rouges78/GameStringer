'use client';

import { motion } from 'framer-motion';
import { Image as ImageIcon } from 'lucide-react';

interface Screenshot {
  id?: number;
  path_thumbnail: string;
  path_full: string;
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  onScreenshotClick: (index: number) => void;
}

export function ScreenshotGallery({ screenshots, onScreenshotClick }: ScreenshotGalleryProps) {
  if (!screenshots || screenshots.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> Screenshot</span>
        <span className="text-2xs text-slate-600">{screenshots.length} immagini</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x snap-mandatory">
        {screenshots.slice(0, 12).map((screenshot: Screenshot, index: number) => (
          <div key={index} className="relative shrink-0 w-[280px] aspect-video bg-slate-950 rounded-xl overflow-hidden cursor-pointer ring-1 ring-white/[0.06] hover:ring-2 hover:ring-indigo-500/40 transition-all duration-300 group snap-start"
            onClick={() => onScreenshotClick(index)}
          >
            <img src={screenshot.path_full || screenshot.path_thumbnail} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300 pointer-events-none" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
