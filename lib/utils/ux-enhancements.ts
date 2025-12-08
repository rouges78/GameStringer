// General utilities for UX enhancements
import type { SystemEvent, ErrorInfo } from '@/lib/types/index';

/**
 * Generate unique IDs for operations
 */
export function generateOperationId(prefix: string = 'op'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Create system event for logging
 */
export function createSystemEvent(
  type: string,
  source: 'tutorial' | 'batch' | 'progress' | 'memory',
  data?: any,
  userId?: string
): SystemEvent {
  return {
    id: generateOperationId('event'),
    type,
    timestamp: new Date(),
    userId,
    data,
    source
  };
}

/**
 * Create error info object
 */
export function createErrorInfo(
  code: string,
  message: string,
  details?: any,
  recoverable: boolean = true,
  userMessage?: string
): ErrorInfo {
  return {
    code,
    message,
    details,
    timestamp: new Date(),
    recoverable,
    userMessage: userMessage || message
  };
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string for use as CSS selector
 */
export function sanitizeSelector(selector: string): string {
  return selector.replace(/[^a-zA-Z0-9\-_]/g, '');
}

/**
 * Check if element exists in DOM
 */
export function elementExists(selector: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector(selector) !== null;
}

/**
 * Get element position for tutorial positioning
 */
export function getElementPosition(selector: string): {
  top: number;
  left: number;
  width: number;
  height: number;
} | null {
  if (typeof document === 'undefined') return null;
  
  const element = document.querySelector(selector);
  if (!element) return null;
  
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height
  };
}

/**
 * Scroll element into view smoothly
 */
export function scrollToElement(selector: string, offset: number = 0): void {
  if (typeof document === 'undefined') return;
  
  const element = document.querySelector(selector);
  if (!element) return;
  
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetTop = rect.top + scrollTop - offset;
  
  window.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate random color for UI elements
 */
export function generateRandomColor(): string {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#06B6D4', // cyan
    '#F97316', // orange
    '#84CC16', // lime
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Local storage helpers with error handling
 */
export const LocalStorage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  
  set(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  },
  
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }
};

/**
 * Session storage helpers with error handling
 */
export const SessionStorage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  
  set(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to sessionStorage:', error);
    }
  },
  
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from sessionStorage:', error);
    }
  }
};

/**
 * Keyboard shortcut helper
 */
export function createKeyboardShortcut(
  keys: string[],
  callback: () => void,
  options: { preventDefault?: boolean; stopPropagation?: boolean } = {}
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    const pressedKeys = [];
    
    if (event.ctrlKey) pressedKeys.push('ctrl');
    if (event.altKey) pressedKeys.push('alt');
    if (event.shiftKey) pressedKeys.push('shift');
    if (event.metaKey) pressedKeys.push('meta');
    
    pressedKeys.push(event.key.toLowerCase());
    
    const normalizedKeys = keys.map(k => k.toLowerCase());
    const matches = normalizedKeys.every(key => pressedKeys.includes(key)) &&
                   pressedKeys.length === normalizedKeys.length;
    
    if (matches) {
      if (options.preventDefault) event.preventDefault();
      if (options.stopPropagation) event.stopPropagation();
      callback();
    }
  };
}