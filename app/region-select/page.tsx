'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function RegionSelectPage() {
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setSelection({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selection) return;
    setSelection(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
  }, [isDragging, selection]);

  const handleMouseUp = useCallback(async () => {
    if (!isDragging || !selection) return;
    setIsDragging(false);

    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    // Minimo 20x20 px per evitare click accidentali
    if (width < 20 || height < 20) {
      setSelection(null);
      return;
    }

    try {
      await invoke('confirm_region_selection', {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
    } catch (err) {
      console.error('Errore conferma regione:', err);
    }
  }, [isDragging, selection]);

  // ESC per annullare
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try {
          await invoke('cancel_region_selection');
        } catch (err) {
          console.error('Errore annullamento:', err);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calcola rettangolo normalizzato
  const rect = selection ? {
    left: Math.min(selection.startX, selection.endX),
    top: Math.min(selection.startY, selection.endY),
    width: Math.abs(selection.endX - selection.startX),
    height: Math.abs(selection.endY - selection.startY),
  } : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 cursor-crosshair select-none"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Istruzioni */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg border border-cyan-500/50">
          <p className="text-sm font-medium text-center">
            Trascina per selezionare la regione OCR &mdash; <span className="text-cyan-400">ESC</span> per annullare
          </p>
        </div>
      </div>

      {/* Rettangolo di selezione */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="absolute border-2 border-cyan-400 bg-cyan-400/10 pointer-events-none"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        >
          {/* Dimensioni */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black/80 text-cyan-300 text-xs px-2 py-1 rounded whitespace-nowrap">
            {Math.round(rect.width)} x {Math.round(rect.height)}
          </div>
        </div>
      )}
    </div>
  );
}
