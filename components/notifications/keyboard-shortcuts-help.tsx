'use client';

import React from 'react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border rounded-lg p-6 max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Scorciatoie Tastiera</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Chiudi</span><kbd className="px-2 py-1 bg-muted rounded">Esc</kbd></div>
          <div className="flex justify-between"><span>Naviga</span><kbd className="px-2 py-1 bg-muted rounded">↑ ↓</kbd></div>
          <div className="flex justify-between"><span>Seleziona</span><kbd className="px-2 py-1 bg-muted rounded">Enter</kbd></div>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-primary text-primary-foreground rounded">
          Chiudi
        </button>
      </div>
    </div>
  );
}
