'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUIInterferenceDetector, ToastPosition } from '@/lib/ui-interference-detector';
import OptimalPositioningAlgorithm from '@/lib/optimal-positioning-algorithm';
import NotificationStackManager from '@/lib/notification-stack-manager';

/**
 * Componente per gestire il posizionamento dinamico dei toast
 * Calcola automaticamente la posizione ottimale evitando interferenze
 */

export interface ToastStackItem {
  id: string;
  element: HTMLElement;
  position: ToastPosition;
  size: { width: number; height: number };
  priority: 'urgent' | 'high' | 'normal' | 'low';
  timestamp: number;
}

export interface DynamicPositionerOptions {
  maxToastsPerStack?: number;
  stackSpacing?: number;
  animationDuration?: number;
  repositionDelay?: number;
  enableStacking?: boolean;
  debugMode?: boolean;
}

interface DynamicToastPositionerProps {
  children: React.ReactNode;
  options?: DynamicPositionerOptions;
}

const DynamicToastPositioner: React.FC<DynamicToastPositionerProps> = ({
  children,
  options = {}
}) => {
  const [toastStack, setToastStack] = useState<ToastStackItem[]>([]);
  const [repositionTrigger, setRepositionTrigger] = useState(0);

  const {
    interferences,
    hasInterferences,
    getOptimalToastPosition
  } = useUIInterferenceDetector({
    debugMode: options.debugMode
  });

  // Algoritmi avanzati
  const [positioningAlgorithm] = useState(() => 
    OptimalPositioningAlgorithm.getInstance(options.debugMode)
  );
  
  const [stackManager] = useState(() => 
    NotificationStackManager.getInstance({
      maxVisible: options.maxToastsPerStack || 5,
      spacing: options.stackSpacing || 16,
      animationDuration: options.animationDuration || 300,
      stackDirection: 'adaptive',
      enableAutoCollapse: true,
      enablePriorityReordering: true
    })
  );

  const defaultOptions: Required<DynamicPositionerOptions> = {
    maxToastsPerStack: 5,
    stackSpacing: 16,
    animationDuration: 300,
    repositionDelay: 100,
    enableStacking: true,
    debugMode: false,
    ...options
  };

  // Calcola posizioni ottimali usando l'algoritmo avanzato
  const calculateOptimalPositions = useCallback(() => {
    if (toastStack.length === 0) return [];

    // Usa lo stack manager per il posizionamento avanzato
    stackManager.repositionAllToasts(interferences);
    
    // Ottieni le posizioni calcolate
    const visibleToasts = stackManager.getVisibleToasts();
    
    return visibleToasts.map(toast => ({
      ...toast.position,
      id: toast.id
    }));
  }, [toastStack, interferences, stackManager]);

  // Applica le posizioni calcolate agli elementi DOM
  const applyPositions = useCallback((positions: Array<ToastPosition & { id: string }>) => {
    positions.forEach(position => {
      const toast = toastStack.find(t => t.id === position.id);
      if (toast && toast.element) {
        const element = toast.element;
        
        // Applica transizione smooth
        element.style.transition = `transform ${defaultOptions.animationDuration}ms ease-out`;
        element.style.transform = `translate(${position.x}px, ${position.y}px)`;
        
        // Aggiorna attributi per debugging
        if (defaultOptions.debugMode) {
          element.setAttribute('data-position', position.position);
          element.setAttribute('data-x', position.x.toString());
          element.setAttribute('data-y', position.y.toString());
        }
      }
    });
  }, [toastStack, defaultOptions]);

  // Registra un nuovo toast nello stack
  const registerToast = useCallback((
    id: string,
    element: HTMLElement,
    priority: ToastStackItem['priority'] = 'normal'
  ) => {
    const rect = element.getBoundingClientRect();
    
    // Mappa priorità per il sistema di notifiche
    const priorityMap = {
      urgent: 'urgent' as const,
      high: 'high' as const,
      normal: 'normal' as const,
      low: 'low' as const
    };

    // Registra con lo stack manager
    const success = stackManager.addToast(
      id, 
      element, 
      priorityMap[priority] as any, // Conversione temporanea
      { width: rect.width, height: rect.height }
    );

    if (success) {
      const newToast: ToastStackItem = {
        id,
        element,
        position: getOptimalToastPosition('top-right', { width: rect.width, height: rect.height }),
        size: { width: rect.width, height: rect.height },
        priority,
        timestamp: Date.now()
      };

      setToastStack(prev => {
        const filtered = prev.filter(t => t.id !== id);
        return [...filtered, newToast];
      });

      if (defaultOptions.debugMode) {
        console.log('[DynamicToastPositioner] Toast registrato:', id, priority);
      }
    }
  }, [getOptimalToastPosition, defaultOptions.debugMode, stackManager]);

  // Rimuove un toast dallo stack
  const unregisterToast = useCallback((id: string) => {
    stackManager.removeToast(id);
    setToastStack(prev => prev.filter(t => t.id !== id));
    
    if (defaultOptions.debugMode) {
      console.log('[DynamicToastPositioner] Toast rimosso:', id);
    }
  }, [defaultOptions.debugMode, stackManager]);

  // Forza il ricalcolo delle posizioni
  const forceReposition = useCallback(() => {
    setRepositionTrigger(prev => prev + 1);
  }, []);

  // Effetto per ricalcolare posizioni quando cambiano le interferenze
  useEffect(() => {
    if (toastStack.length === 0) return;

    const timeoutId = setTimeout(() => {
      const positions = calculateOptimalPositions();
      applyPositions(positions);
    }, defaultOptions.repositionDelay);

    return () => clearTimeout(timeoutId);
  }, [
    interferences, 
    toastStack, 
    repositionTrigger,
    calculateOptimalPositions,
    applyPositions,
    defaultOptions.repositionDelay
  ]);

  // Espone le funzioni tramite context o ref
  React.useEffect(() => {
    // Registra le funzioni globalmente per l'uso da parte dei toast
    if (typeof window !== 'undefined') {
      (window as any).toastPositioner = {
        registerToast,
        unregisterToast,
        forceReposition
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).toastPositioner;
      }
    };
  }, [registerToast, unregisterToast, forceReposition]);

  return (
    <div className="dynamic-toast-positioner">
      {children}
      
      {/* Debug overlay */}
      {defaultOptions.debugMode && (
        <div className="fixed top-4 left-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-[9999]">
          <div>Toast attivi: {toastStack.length}</div>
          <div>Interferenze: {interferences.length}</div>
          <div>Repositioning: {hasInterferences ? 'Attivo' : 'Inattivo'}</div>
        </div>
      )}
    </div>
  );
};

// Funzioni di utilità
function areasOverlap(
  area1: { x: number; y: number; width: number; height: number },
  area2: { x: number; y: number; width: number; height: number },
  margin: number = 0
): boolean {
  return !(
    area1.x + area1.width + margin < area2.x ||
    area2.x + area2.width + margin < area1.x ||
    area1.y + area1.height + margin < area2.y ||
    area2.y + area2.height + margin < area1.y
  );
}

function findAlternativePosition(
  toastSize: { width: number; height: number },
  usedAreas: Array<{ x: number; y: number; width: number; height: number }>,
  spacing: number
): ToastPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 16;

  // Prova diverse posizioni
  const candidates: ToastPosition[] = [
    // Top-right
    {
      x: viewportWidth - toastSize.width - margin,
      y: margin,
      position: 'top-right',
      offset: { x: -margin, y: margin }
    },
    // Top-left
    {
      x: margin,
      y: margin,
      position: 'top-left',
      offset: { x: margin, y: margin }
    },
    // Bottom-right
    {
      x: viewportWidth - toastSize.width - margin,
      y: viewportHeight - toastSize.height - margin,
      position: 'bottom-right',
      offset: { x: -margin, y: -margin }
    },
    // Bottom-left
    {
      x: margin,
      y: viewportHeight - toastSize.height - margin,
      position: 'bottom-left',
      offset: { x: margin, y: -margin }
    }
  ];

  for (const candidate of candidates) {
    const candidateArea = {
      x: candidate.x,
      y: candidate.y,
      width: toastSize.width,
      height: toastSize.height
    };

    let hasOverlap = false;
    for (const usedArea of usedAreas) {
      if (areasOverlap(candidateArea, usedArea, spacing)) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      return candidate;
    }
  }

  // Fallback: ritorna la prima posizione anche se si sovrappone
  return candidates[0];
}

// Hook per utilizzare il positioner
export function useDynamicToastPositioner() {
  const registerToast = useCallback((
    id: string,
    element: HTMLElement,
    priority: ToastStackItem['priority'] = 'normal'
  ) => {
    if (typeof window !== 'undefined' && (window as any).toastPositioner) {
      (window as any).toastPositioner.registerToast(id, element, priority);
    }
  }, []);

  const unregisterToast = useCallback((id: string) => {
    if (typeof window !== 'undefined' && (window as any).toastPositioner) {
      (window as any).toastPositioner.unregisterToast(id);
    }
  }, []);

  const forceReposition = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).toastPositioner) {
      (window as any).toastPositioner.forceReposition();
    }
  }, []);

  return {
    registerToast,
    unregisterToast,
    forceReposition
  };
}

export default DynamicToastPositioner;