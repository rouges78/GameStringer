'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md shadow-2xl shadow-purple-500/10" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">{t('keyboardShortcutsHelpComp.keyboardShortcuts')}</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center"><span className="text-slate-300">{t('keyboardShortcutsHelpComp.close')}</span><kbd className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 font-mono text-xs">{t('keyboardShortcutsHelpComp.esc')}</kbd></div>
          <div className="flex justify-between items-center"><span className="text-slate-300">{t('keyboardShortcutsHelpComp.navigate')}</span><kbd className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 font-mono text-xs">↑ ↓</kbd></div>
          <div className="flex justify-between items-center"><span className="text-slate-300">{t('keyboardShortcutsHelpComp.select')}</span><kbd className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 font-mono text-xs">{t('keyboardShortcutsHelpComp.enter')}</kbd></div>
        </div>
        <button onClick={onClose} className="mt-6 w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all">
          Close
        </button>
      </div>
    </div>
  );
}



