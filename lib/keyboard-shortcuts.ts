import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  enabled?: boolean;
}

/**
 * Hook per registrare shortcut tastiera globali
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignora se focus su input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Permetti solo Escape in questi contesti
      if (event.key !== 'Escape') return;
    }
    
    for (const shortcut of shortcuts) {
      if (shortcut.enabled === false) continue;
      
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      
      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Shortcut predefiniti dell'applicazione
 */
export const defaultShortcuts = {
  // Navigazione globale
  search: { key: 'f', ctrl: true, description: 'Cerca' },
  escape: { key: 'Escape', description: 'Chiudi modale' },
  goHome: { key: 'h', ctrl: true, description: 'Vai a Dashboard' },
  goLibrary: { key: '1', ctrl: true, description: 'Vai a Libreria' },
  goTranslator: { key: '2', ctrl: true, description: 'Vai a Traduttore AI' },
  goTools: { key: '3', ctrl: true, description: 'Vai a Strumenti' },
  goCommunity: { key: '4', ctrl: true, description: 'Vai a Community' },
  
  // Library
  refresh: { key: 'r', ctrl: true, description: 'Aggiorna libreria' },
  gridView: { key: 'g', ctrl: true, alt: true, description: 'Vista griglia' },
  listView: { key: 'l', ctrl: true, alt: true, description: 'Vista lista' },
  selectAll: { key: 'a', ctrl: true, description: 'Seleziona tutto' },
  
  // Traduzione
  translate: { key: 't', ctrl: true, description: 'Avvia traduzione' },
  pause: { key: 'p', ctrl: true, description: 'Pausa traduzione' },
  save: { key: 's', ctrl: true, description: 'Salva progetto' },
  undo: { key: 'z', ctrl: true, description: 'Annulla' },
  redo: { key: 'z', ctrl: true, shift: true, description: 'Ripeti' },
  nextString: { key: 'ArrowDown', ctrl: true, description: 'Stringa successiva' },
  prevString: { key: 'ArrowUp', ctrl: true, description: 'Stringa precedente' },
  copySource: { key: 'd', ctrl: true, description: 'Copia sorgente' },
  
  // Generali
  settings: { key: ',', ctrl: true, description: 'Impostazioni' },
  help: { key: '?', shift: true, description: 'Mostra shortcuts' },
  toggleTheme: { key: 'j', ctrl: true, description: 'Cambia tema' },
  toggleSidebar: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
  notifications: { key: 'n', ctrl: true, description: 'Notifiche' },
};

/**
 * Formatta shortcut per visualizzazione
 */
export function formatShortcut(shortcut: Partial<ShortcutConfig>): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  
  // Formatta tasto speciale
  let key = shortcut.key || '';
  if (key === 'Escape') key = 'Esc';
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();
  
  parts.push(key);
  
  return parts.join(' + ');
}

/**
 * Hook per shortcut comune: focus su search
 */
export function useSearchShortcut(searchRef: React.RefObject<HTMLInputElement>) {
  useKeyboardShortcuts([
    {
      key: 'f',
      ctrl: true,
      description: 'Focus search',
      action: () => {
        searchRef.current?.focus();
        searchRef.current?.select();
      },
    },
  ]);
}

/**
 * Hook per shortcut Escape (chiudi modal)
 */
export function useEscapeShortcut(onEscape: () => void, enabled: boolean = true) {
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Chiudi',
      action: onEscape,
      enabled,
    },
  ]);
}

/**
 * Componente per mostrare lista shortcut disponibili
 */
export function getShortcutsList(): Array<{ shortcut: string; description: string }> {
  return [
    { shortcut: formatShortcut(defaultShortcuts.search), description: defaultShortcuts.search.description },
    { shortcut: formatShortcut(defaultShortcuts.escape), description: defaultShortcuts.escape.description },
    { shortcut: formatShortcut(defaultShortcuts.refresh), description: defaultShortcuts.refresh.description },
    { shortcut: formatShortcut(defaultShortcuts.settings), description: defaultShortcuts.settings.description },
    { shortcut: formatShortcut(defaultShortcuts.help), description: defaultShortcuts.help.description },
  ];
}
