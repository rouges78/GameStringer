/**
 * Hook for managing global keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';

interface GlobalShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  callback: () => void;
  description: string;
  preventDefault?: boolean;
}

interface UseGlobalShortcutsOptions {
  shortcuts: GlobalShortcut[];
  enabled?: boolean;
}

export function useGlobalShortcuts({ shortcuts, enabled = true }: UseGlobalShortcutsOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't handle shortcuts when user is typing in input fields
    const activeElement = document.activeElement;
    const isInputField = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true'
    );

    // Allow some shortcuts even in input fields (like Escape)
    const allowInInputFields = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
    
    if (isInputField && !allowInInputFields.includes(e.key)) {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatches = e.key === shortcut.key;
      const ctrlMatches = (shortcut.ctrlKey ?? false) === (e.ctrlKey || e.metaKey);
      const altMatches = (shortcut.altKey ?? false) === e.altKey;
      const shiftMatches = (shortcut.shiftKey ?? false) === e.shiftKey;

      if (keyMatches && ctrlMatches && altMatches && shiftMatches) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
          e.stopPropagation();
        }
        shortcut.callback();
        break;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown, enabled]);

  return {
    shortcuts: shortcuts.map(s => ({
      key: s.key,
      modifiers: [
        s.ctrlKey && 'Ctrl',
        s.altKey && 'Alt', 
        s.shiftKey && 'Shift',
        s.metaKey && 'Cmd'
      ].filter(Boolean).join('+'),
      description: s.description
    }))
  };
}

/**
 * Hook specifically for notification-related global shortcuts
 */
export function useNotificationShortcuts(
  onOpenNotificationCenter: () => void,
  onToggleNotificationCenter?: () => void
) {
  const shortcuts: GlobalShortcut[] = [
    {
      key: 'n',
      ctrlKey: true,
      shiftKey: true,
      callback: onOpenNotificationCenter,
      description: 'Apri centro notifiche'
    },
    {
      key: 'F2',
      callback: onToggleNotificationCenter || onOpenNotificationCenter,
      description: 'Attiva/disattiva centro notifiche'
    },
    {
      key: 'b',
      ctrlKey: true,
      altKey: true,
      callback: onOpenNotificationCenter,
      description: 'Vai alle notifiche (Bell)'
    }
  ];

  return useGlobalShortcuts({
    shortcuts,
    enabled: true
  });
}