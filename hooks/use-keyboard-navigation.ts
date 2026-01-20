/**
 * Hook for managing keyboard navigation in notification components
 */

import { useEffect, useCallback, useRef } from 'react';
import { NotificationFocusManager } from '@/lib/notification-accessibility';

interface UseKeyboardNavigationOptions {
  isActive?: boolean;
  onEscape?: () => void;
  onEnter?: () => void;
  onSpace?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onDelete?: () => void;
  onCtrlA?: () => void;
  onCtrlF?: () => void;
  onCtrlDelete?: () => void;
  enableGlobalShortcuts?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
  const {
    isActive = true,
    onEscape,
    onEnter,
    onSpace,
    onArrowUp,
    onArrowDown,
    onHome,
    onEnd,
    onDelete,
    onCtrlA,
    onCtrlF,
    onCtrlDelete,
    enableGlobalShortcuts = false
  } = options;

  const focusManager = useRef(NotificationFocusManager.getInstance());

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    // Prevent default for handled keys
    const shouldPreventDefault = () => {
      switch (e.key) {
        case 'Escape':
        case 'Enter':
        case 'ArrowUp':
        case 'ArrowDown':
        case 'Home':
        case 'End':
          return true;
        case ' ':
          return e.target !== document.querySelector('input, textarea, [contenteditable]');
        case 'a':
        case 'f':
        case 'Delete':
          return e.ctrlKey || e.metaKey;
        default:
          return false;
      }
    };

    if (shouldPreventDefault()) {
      e.preventDefault();
    }

    // Handle keyboard shortcuts
    switch (e.key) {
      case 'Escape':
        onEscape?.();
        break;
      
      case 'Enter':
        onEnter?.();
        break;
      
      case ' ':
        // Only handle space if not in input field
        if (e.target !== document.querySelector('input, textarea, [contenteditable]')) {
          onSpace?.();
        }
        break;
      
      case 'ArrowUp':
        onArrowUp?.();
        break;
      
      case 'ArrowDown':
        onArrowDown?.();
        break;
      
      case 'Home':
        onHome?.();
        break;
      
      case 'End':
        onEnd?.();
        break;
      
      case 'Delete':
        if (e.ctrlKey || e.metaKey) {
          onCtrlDelete?.();
        } else {
          onDelete?.();
        }
        break;
      
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          onCtrlA?.();
        }
        break;
      
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          onCtrlF?.();
        }
        break;
    }
  }, [
    isActive,
    onEscape,
    onEnter,
    onSpace,
    onArrowUp,
    onArrowDown,
    onHome,
    onEnd,
    onDelete,
    onCtrlA,
    onCtrlF,
    onCtrlDelete
  ]);

  useEffect(() => {
    if (!isActive) return;

    const target = enableGlobalShortcuts ? document : document.body;
    target.addEventListener('keydown', handleKeyDown);
    
    return () => {
      target.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isActive, enableGlobalShortcuts]);

  return {
    focusManager: focusManager.current
  };
}

/**
 * Hook for managing notification list navigation
 */
export function useNotificationListNavigation(
  notifications: any[],
  selectedIndex: number,
  onSelectionChange: (index: number) => void,
  onActivateItem: (index: number) => void,
  isActive: boolean = true
) {
  const handleArrowUp = useCallback(() => {
    if (notifications.length === 0) return;
    const newIndex = selectedIndex <= 0 ? notifications.length - 1 : selectedIndex - 1;
    onSelectionChange(newIndex);
    
    // Focus the notification item
    const notificationElement = document.querySelector(
      `[data-notification-index="${newIndex}"]`
    ) as HTMLElement;
    if (notificationElement) {
      notificationElement.focus();
    }
  }, [notifications.length, selectedIndex, onSelectionChange]);

  const handleArrowDown = useCallback(() => {
    if (notifications.length === 0) return;
    const newIndex = selectedIndex >= notifications.length - 1 ? 0 : selectedIndex + 1;
    onSelectionChange(newIndex);
    
    // Focus the notification item
    const notificationElement = document.querySelector(
      `[data-notification-index="${newIndex}"]`
    ) as HTMLElement;
    if (notificationElement) {
      notificationElement.focus();
    }
  }, [notifications.length, selectedIndex, onSelectionChange]);

  const handleHome = useCallback(() => {
    if (notifications.length === 0) return;
    onSelectionChange(0);
    
    const firstElement = document.querySelector(
      '[data-notification-index="0"]'
    ) as HTMLElement;
    if (firstElement) {
      firstElement.focus();
    }
  }, [notifications.length, onSelectionChange]);

  const handleEnd = useCallback(() => {
    if (notifications.length === 0) return;
    const lastIndex = notifications.length - 1;
    onSelectionChange(lastIndex);
    
    const lastElement = document.querySelector(
      `[data-notification-index="${lastIndex}"]`
    ) as HTMLElement;
    if (lastElement) {
      lastElement.focus();
    }
  }, [notifications.length, onSelectionChange]);

  const handleEnter = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < notifications.length) {
      onActivateItem(selectedIndex);
    }
  }, [selectedIndex, notifications.length, onActivateItem]);

  useKeyboardNavigation({
    isActive,
    onArrowUp: handleArrowUp,
    onArrowDown: handleArrowDown,
    onHome: handleHome,
    onEnd: handleEnd,
    onEnter: handleEnter
  });

  return {
    selectedIndex,
    handleArrowUp,
    handleArrowDown,
    handleHome,
    handleEnd,
    handleEnter
  };
}