'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const router = useRouter();

  const shortcuts: ShortcutConfig[] = [
    // Navigation shortcuts
    { key: 'd', ctrl: true, action: () => router.push('/'), description: 'Dashboard' },
    { key: 'l', ctrl: true, action: () => router.push('/library'), description: 'Libreria' },
    { key: 't', ctrl: true, action: () => router.push('/ai-translator'), description: 'Traduci' },
    { key: 'p', ctrl: true, action: () => router.push('/unity-patcher'), description: 'Patcher' },
    { key: 'u', ctrl: true, action: () => router.push('/community-hub'), description: 'Community' },
    { key: ',', ctrl: true, action: () => router.push('/settings'), description: 'Impostazioni' },
    
    // Quick actions
    { key: 'b', ctrl: true, action: () => router.push('/batch-translation'), description: 'Batch Translation' },
    { key: 'j', ctrl: true, action: () => router.push('/projects'), description: 'Progetti' },
    { key: 'w', ctrl: true, action: () => router.push('/workshop'), description: 'Steam Workshop' },
    
    // Help
    { key: '/', ctrl: true, action: () => showShortcutsHelp(), description: 'Mostra shortcuts' },
  ];

  const showShortcutsHelp = useCallback(() => {
    const shortcutsList = shortcuts
      .map(s => {
        const keys = [];
        if (s.ctrl) keys.push('Ctrl');
        if (s.shift) keys.push('Shift');
        if (s.alt) keys.push('Alt');
        keys.push(s.key.toUpperCase());
        return `${keys.join('+')} → ${s.description}`;
      })
      .join('\n');
    
    toast.info('Shortcuts Tastiera', {
      description: shortcutsList,
      duration: 8000,
    });
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignora se focus su input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault();
        shortcut.action();
        
        // Feedback visivo
        toast.success(`${shortcut.description}`, {
          duration: 1500,
          icon: '⌨️',
        });
        return;
      }
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts, showShortcutsHelp };
}

export default useKeyboardShortcuts;
