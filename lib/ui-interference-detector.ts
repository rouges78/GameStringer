'use client';

import React from 'react';

/**
 * Sistema per rilevare interferenze UI e gestire il posizionamento delle notifiche
 * Monitora dialoghi, modal, sheet e altri elementi che potrebbero interferire con i toast
 */

export interface UIInterference {
  id: string;
  type: 'dialog' | 'modal' | 'sheet' | 'drawer' | 'dropdown' | 'tooltip' | 'popover';
  element: HTMLElement;
  zIndex: number;
  bounds: DOMRect;
  priority: 'low' | 'medium' | 'high';
}

export interface ToastPosition {
  x: number;
  y: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  offset: { x: number; y: number };
}

export interface InterferenceDetectorOptions {
  checkInterval?: number;
  minZIndex?: number;
  safeDistance?: number;
  enableDynamicPositioning?: boolean;
  debugMode?: boolean;
}

class UIInterferenceDetector {
  private static instance: UIInterferenceDetector;
  private interferences: Map<string, UIInterference> = new Map();
  private observers: MutationObserver[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private callbacks: Set<(interferences: UIInterference[]) => void> = new Set();
  
  private options: Required<InterferenceDetectorOptions> = {
    checkInterval: 500,
    minZIndex: 1000,
    safeDistance: 16,
    enableDynamicPositioning: true,
    debugMode: false
  };

  private constructor(options?: InterferenceDetectorOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this.initialize();
  }

  public static getInstance(options?: InterferenceDetectorOptions): UIInterferenceDetector {
    if (!UIInterferenceDetector.instance) {
      UIInterferenceDetector.instance = new UIInterferenceDetector(options);
    }
    return UIInterferenceDetector.instance;
  }

  private initialize(): void {
    if (typeof window === 'undefined') return;

    // Avvia il monitoraggio periodico
    this.startPeriodicCheck();

    // Monitora cambiamenti nel DOM
    this.setupDOMObserver();

    // Ascolta eventi di resize e scroll
    window.addEventListener('resize', this.handleWindowChange);
    window.addEventListener('scroll', this.handleWindowChange, true);

    if (this.options.debugMode) {
      console.log('[UIInterferenceDetector] Inizializzato con opzioni:', this.options);
    }
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.detectInterferences();
    }, this.options.checkInterval);
  }

  private setupDOMObserver(): void {
    // Osserva cambiamenti negli attributi e nella struttura del DOM
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (this.isRelevantElement(target)) {
            shouldCheck = true;
          }
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (this.isRelevantElement(element) || 
                  element.querySelector(this.getRelevantSelectors())) {
                shouldCheck = true;
              }
            }
          });
        }
      });

      if (shouldCheck) {
        // Debounce per evitare controlli troppo frequenti
        setTimeout(() => this.detectInterferences(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-state', 'aria-hidden']
    });

    this.observers.push(observer);
  }

  private handleWindowChange = (): void => {
    // Debounce per evitare controlli troppo frequenti durante resize/scroll
    setTimeout(() => this.detectInterferences(), 150);
  };

  private getRelevantSelectors(): string {
    return [
      // Radix UI components
      '[data-radix-dialog-overlay]',
      '[data-radix-dialog-content]',
      '[data-radix-sheet-overlay]',
      '[data-radix-sheet-content]',
      '[data-radix-drawer-overlay]',
      '[data-radix-drawer-content]',
      '[data-radix-popover-content]',
      '[data-radix-dropdown-menu-content]',
      '[data-radix-tooltip-content]',
      
      // Classi comuni per modal/dialog
      '.modal',
      '.dialog',
      '.overlay',
      '.backdrop',
      '.sheet',
      '.drawer',
      '.popover',
      '.dropdown',
      '.tooltip',
      
      // Attributi ARIA
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[role="tooltip"]',
      '[role="menu"]',
      '[role="listbox"]',
      
      // Classi specifiche dell'app
      '.notification-center',
      '.profile-menu',
      '.settings-panel'
    ].join(', ');
  }

  private isRelevantElement(element: HTMLElement): boolean {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    // Controlla se l'elemento corrisponde ai selettori rilevanti
    return element.matches(this.getRelevantSelectors());
  }

  private detectInterferences(): void {
    const newInterferences = new Map<string, UIInterference>();
    
    // Trova tutti gli elementi potenzialmente interferenti
    const elements = document.querySelectorAll(this.getRelevantSelectors());
    
    elements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      
      // Controlla se l'elemento è visibile e attivo
      if (!this.isElementVisible(htmlElement)) return;
      
      const interference = this.createInterferenceFromElement(htmlElement);
      if (interference) {
        newInterferences.set(interference.id, interference);
      }
    });

    // Aggiorna la mappa delle interferenze
    const hasChanges = this.updateInterferences(newInterferences);
    
    if (hasChanges) {
      this.notifyCallbacks();
      
      if (this.options.debugMode) {
        console.log('[UIInterferenceDetector] Interferenze rilevate:', 
          Array.from(newInterferences.values()));
      }
    }
  }

  private isElementVisible(element: HTMLElement): boolean {
    // Controlla se l'elemento è visibile
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none' || 
        style.visibility === 'hidden' || 
        style.opacity === '0') {
      return false;
    }

    // Controlla attributi specifici di Radix UI
    if (element.hasAttribute('data-state')) {
      const state = element.getAttribute('data-state');
      if (state === 'closed' || state === 'hidden') {
        return false;
      }
    }

    if (element.hasAttribute('aria-hidden')) {
      const ariaHidden = element.getAttribute('aria-hidden');
      if (ariaHidden === 'true') {
        return false;
      }
    }

    // Controlla se l'elemento ha dimensioni
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    return true;
  }

  private createInterferenceFromElement(element: HTMLElement): UIInterference | null {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const zIndex = parseInt(style.zIndex) || 0;

    // Ignora elementi con z-index troppo basso
    if (zIndex < this.options.minZIndex) return null;

    const id = this.generateElementId(element);
    const type = this.determineElementType(element);
    const priority = this.determineElementPriority(element, type);

    return {
      id,
      type,
      element,
      zIndex,
      bounds: rect,
      priority
    };
  }

  private generateElementId(element: HTMLElement): string {
    // Genera un ID unico per l'elemento
    if (element.id) return element.id;
    
    const className = element.className.toString().replace(/\s+/g, '-');
    const tagName = element.tagName.toLowerCase();
    const timestamp = Date.now();
    
    return `${tagName}-${className}-${timestamp}`;
  }

  private determineElementType(element: HTMLElement): UIInterference['type'] {
    // Determina il tipo di interferenza basandosi su attributi e classi
    if (element.hasAttribute('data-radix-dialog-overlay') || 
        element.hasAttribute('data-radix-dialog-content') ||
        element.matches('[role="dialog"], [role="alertdialog"]')) {
      return 'dialog';
    }
    
    if (element.hasAttribute('data-radix-sheet-overlay') || 
        element.hasAttribute('data-radix-sheet-content') ||
        element.classList.contains('sheet')) {
      return 'sheet';
    }
    
    if (element.hasAttribute('data-radix-drawer-overlay') || 
        element.hasAttribute('data-radix-drawer-content') ||
        element.classList.contains('drawer')) {
      return 'drawer';
    }
    
    if (element.hasAttribute('data-radix-popover-content') ||
        element.classList.contains('popover')) {
      return 'popover';
    }
    
    if (element.hasAttribute('data-radix-dropdown-menu-content') ||
        element.matches('[role="menu"], [role="listbox"]') ||
        element.classList.contains('dropdown')) {
      return 'dropdown';
    }
    
    if (element.hasAttribute('data-radix-tooltip-content') ||
        element.matches('[role="tooltip"]') ||
        element.classList.contains('tooltip')) {
      return 'tooltip';
    }
    
    if (element.classList.contains('modal') ||
        element.classList.contains('overlay') ||
        element.classList.contains('backdrop')) {
      return 'modal';
    }
    
    return 'dialog'; // Default
  }

  private determineElementPriority(
    element: HTMLElement, 
    type: UIInterference['type']
  ): UIInterference['priority'] {
    // Determina la priorità basandosi sul tipo e sugli attributi
    if (type === 'dialog' || type === 'modal') {
      return 'high';
    }
    
    if (type === 'sheet' || type === 'drawer') {
      return 'medium';
    }
    
    if (element.hasAttribute('data-priority')) {
      const priority = element.getAttribute('data-priority');
      if (priority === 'high' || priority === 'medium' || priority === 'low') {
        return priority as UIInterference['priority'];
      }
    }
    
    return 'low';
  }

  private updateInterferences(newInterferences: Map<string, UIInterference>): boolean {
    const oldSize = this.interferences.size;
    const oldKeys = new Set(this.interferences.keys());
    const newKeys = new Set(newInterferences.keys());
    
    // Controlla se ci sono cambiamenti
    if (oldSize !== newInterferences.size) {
      this.interferences = newInterferences;
      return true;
    }
    
    // Controlla se le chiavi sono diverse
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        this.interferences = newInterferences;
        return true;
      }
    }
    
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        this.interferences = newInterferences;
        return true;
      }
    }
    
    // Controlla se le posizioni sono cambiate significativamente
    for (const [id, newInterference] of newInterferences) {
      const oldInterference = this.interferences.get(id);
      if (oldInterference && this.hasSignificantChange(oldInterference, newInterference)) {
        this.interferences = newInterferences;
        return true;
      }
    }
    
    return false;
  }

  private hasSignificantChange(old: UIInterference, current: UIInterference): boolean {
    const threshold = 10; // pixel
    
    return Math.abs(old.bounds.x - current.bounds.x) > threshold ||
           Math.abs(old.bounds.y - current.bounds.y) > threshold ||
           Math.abs(old.bounds.width - current.bounds.width) > threshold ||
           Math.abs(old.bounds.height - current.bounds.height) > threshold ||
           old.zIndex !== current.zIndex;
  }

  private notifyCallbacks(): void {
    const interferences = Array.from(this.interferences.values());
    this.callbacks.forEach(callback => {
      try {
        callback(interferences);
      } catch (error) {
        console.error('[UIInterferenceDetector] Errore nel callback:', error);
      }
    });
  }

  // API pubblica
  public getInterferences(): UIInterference[] {
    return Array.from(this.interferences.values());
  }

  public hasInterferences(): boolean {
    return this.interferences.size > 0;
  }

  public hasHighPriorityInterferences(): boolean {
    return Array.from(this.interferences.values())
      .some(interference => interference.priority === 'high');
  }

  public getOptimalToastPosition(
    preferredPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right',
    toastSize: { width: number; height: number } = { width: 400, height: 100 }
  ): ToastPosition {
    if (!this.options.enableDynamicPositioning || !this.hasInterferences()) {
      return this.getDefaultPosition(preferredPosition);
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const safeDistance = this.options.safeDistance;

    // Prova tutte le posizioni possibili
    const positions: Array<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'> = [
      preferredPosition,
      'top-right',
      'top-left', 
      'bottom-right',
      'bottom-left'
    ];

    for (const position of positions) {
      const testPosition = this.getDefaultPosition(position);
      const toastRect = {
        x: testPosition.x,
        y: testPosition.y,
        width: toastSize.width,
        height: toastSize.height
      };

      if (this.isPositionSafe(toastRect, safeDistance)) {
        return testPosition;
      }
    }

    // Se nessuna posizione è sicura, trova la migliore disponibile
    return this.findBestAvailablePosition(toastSize, safeDistance);
  }

  private getDefaultPosition(position: string): ToastPosition {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;

    switch (position) {
      case 'top-right':
        return {
          x: viewportWidth - 400 - margin,
          y: margin,
          position: 'top-right',
          offset: { x: -margin, y: margin }
        };
      case 'top-left':
        return {
          x: margin,
          y: margin,
          position: 'top-left',
          offset: { x: margin, y: margin }
        };
      case 'bottom-right':
        return {
          x: viewportWidth - 400 - margin,
          y: viewportHeight - 100 - margin,
          position: 'bottom-right',
          offset: { x: -margin, y: -margin }
        };
      case 'bottom-left':
        return {
          x: margin,
          y: viewportHeight - 100 - margin,
          position: 'bottom-left',
          offset: { x: margin, y: -margin }
        };
      default:
        return this.getDefaultPosition('top-right');
    }
  }

  private isPositionSafe(
    toastRect: { x: number; y: number; width: number; height: number },
    safeDistance: number
  ): boolean {
    for (const interference of this.interferences.values()) {
      if (this.rectsOverlap(toastRect, interference.bounds, safeDistance)) {
        return false;
      }
    }
    return true;
  }

  private rectsOverlap(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: DOMRect,
    margin: number = 0
  ): boolean {
    return !(rect1.x + rect1.width + margin < rect2.left ||
             rect2.right + margin < rect1.x ||
             rect1.y + rect1.height + margin < rect2.top ||
             rect2.bottom + margin < rect1.y);
  }

  private findBestAvailablePosition(
    toastSize: { width: number; height: number },
    safeDistance: number
  ): ToastPosition {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;

    // Cerca spazi liberi nel viewport
    const candidates: ToastPosition[] = [];

    // Prova diverse posizioni lungo i bordi
    for (let x = margin; x <= viewportWidth - toastSize.width - margin; x += 50) {
      for (let y = margin; y <= viewportHeight - toastSize.height - margin; y += 50) {
        const testRect = { x, y, width: toastSize.width, height: toastSize.height };
        
        if (this.isPositionSafe(testRect, safeDistance)) {
          const position = this.determinePositionType(x, y, viewportWidth, viewportHeight);
          candidates.push({
            x,
            y,
            position,
            offset: { x: 0, y: 0 }
          });
        }
      }
    }

    // Restituisci la posizione più vicina al preferito o fallback
    return candidates.length > 0 
      ? candidates[0] 
      : this.getDefaultPosition('top-right');
  }

  private determinePositionType(
    x: number, 
    y: number, 
    viewportWidth: number, 
    viewportHeight: number
  ): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' {
    const isTop = y < viewportHeight / 2;
    const isRight = x > viewportWidth / 2;

    if (isTop && isRight) return 'top-right';
    if (isTop && !isRight) return 'top-left';
    if (!isTop && isRight) return 'bottom-right';
    return 'bottom-left';
  }

  public onInterferenceChange(callback: (interferences: UIInterference[]) => void): () => void {
    this.callbacks.add(callback);
    
    // Restituisci funzione di cleanup
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public destroy(): void {
    // Cleanup
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    window.removeEventListener('resize', this.handleWindowChange);
    window.removeEventListener('scroll', this.handleWindowChange, true);

    this.interferences.clear();
    this.callbacks.clear();

    if (this.options.debugMode) {
      console.log('[UIInterferenceDetector] Distrutto');
    }
  }
}

// Hook React per utilizzare il detector
export function useUIInterferenceDetector(options?: InterferenceDetectorOptions) {
  const [interferences, setInterferences] = React.useState<UIInterference[]>([]);
  const [detector] = React.useState(() => UIInterferenceDetector.getInstance(options));

  React.useEffect(() => {
    const unsubscribe = detector.onInterferenceChange(setInterferences);
    
    // Carica stato iniziale
    setInterferences(detector.getInterferences());
    
    return unsubscribe;
  }, [detector]);

  return {
    interferences,
    hasInterferences: interferences.length > 0,
    hasHighPriorityInterferences: interferences.some(i => i.priority === 'high'),
    getOptimalToastPosition: detector.getOptimalToastPosition.bind(detector)
  };
}

export default UIInterferenceDetector;