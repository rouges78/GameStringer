'use client';

import { UIInterference } from './ui-interference-detector';

/**
 * Algoritmo avanzato per il posizionamento ottimale delle notifiche
 * Utilizza algoritmi di ottimizzazione per trovare le migliori posizioni
 */

export interface PositionCandidate {
  x: number;
  y: number;
  score: number;
  reason: string;
  conflicts: number;
  area: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

export interface ToastDimensions {
  width: number;
  height: number;
}

export interface PositioningConstraints {
  minMargin: number;
  maxToastsPerArea: number;
  preferredAreas: string[];
  avoidAreas: string[];
  stackDirection: 'vertical' | 'horizontal' | 'grid';
  allowOverlap: boolean;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  safeArea: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

class OptimalPositioningAlgorithm {
  private static instance: OptimalPositioningAlgorithm;
  private gridSize: number = 20; // Griglia per campionamento posizioni
  private debugMode: boolean = false;

  private constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  public static getInstance(debugMode: boolean = false): OptimalPositioningAlgorithm {
    if (!OptimalPositioningAlgorithm.instance) {
      OptimalPositioningAlgorithm.instance = new OptimalPositioningAlgorithm(debugMode);
    }
    return OptimalPositioningAlgorithm.instance;
  }

  /**
   * Trova la posizione ottimale per un toast
   */
  public findOptimalPosition(
    toastDimensions: ToastDimensions,
    interferences: UIInterference[],
    existingToasts: Array<{ x: number; y: number; width: number; height: number }> = [],
    constraints: Partial<PositioningConstraints> = {}
  ): PositionCandidate {
    const viewport = this.getViewportInfo();
    const fullConstraints = this.mergeConstraints(constraints);
    
    // Genera candidati di posizione
    const candidates = this.generatePositionCandidates(
      toastDimensions,
      viewport,
      fullConstraints
    );

    // Valuta ogni candidato
    const scoredCandidates = candidates.map(candidate => 
      this.scorePosition(candidate, interferences, existingToasts, fullConstraints, viewport)
    );

    // Ordina per punteggio (più alto è meglio)
    scoredCandidates.sort((a, b) => b.score - a.score);

    if (this.debugMode) {
      console.log('[OptimalPositioningAlgorithm] Candidati valutati:', scoredCandidates.slice(0, 5));
    }

    return scoredCandidates[0] || this.getFallbackPosition(toastDimensions, viewport);
  }

  /**
   * Trova posizioni ottimali per multiple notifiche (stack)
   */
  public findOptimalStackPositions(
    toasts: Array<{ id: string; dimensions: ToastDimensions; priority: number }>,
    interferences: UIInterference[],
    constraints: Partial<PositioningConstraints> = {}
  ): Array<PositionCandidate & { id: string }> {
    const viewport = this.getViewportInfo();
    const fullConstraints = this.mergeConstraints(constraints);
    const positions: Array<PositionCandidate & { id: string }> = [];

    // Ordina per priorità (più alta prima)
    const sortedToasts = [...toasts].sort((a, b) => b.priority - a.priority);

    for (const toast of sortedToasts) {
      const existingPositions = positions.map(p => ({
        x: p.x,
        y: p.y,
        width: toast.dimensions.width,
        height: toast.dimensions.height
      }));

      const optimalPosition = this.findOptimalPosition(
        toast.dimensions,
        interferences,
        existingPositions,
        fullConstraints
      );

      positions.push({
        ...optimalPosition,
        id: toast.id
      });
    }

    return positions;
  }

  /**
   * Ottimizza il posizionamento di uno stack esistente
   */
  public optimizeStackLayout(
    currentPositions: Array<{ id: string; x: number; y: number; dimensions: ToastDimensions }>,
    interferences: UIInterference[],
    constraints: Partial<PositioningConstraints> = {}
  ): Array<PositionCandidate & { id: string }> {
    const viewport = this.getViewportInfo();
    const fullConstraints = this.mergeConstraints(constraints);

    // Prova diverse configurazioni di layout
    const layoutConfigurations = this.generateLayoutConfigurations(
      currentPositions,
      viewport,
      fullConstraints
    );

    let bestConfiguration = layoutConfigurations[0];
    let bestScore = -Infinity;

    for (const config of layoutConfigurations) {
      const totalScore = config.reduce((sum, pos) => {
        const scored = this.scorePosition(
          pos,
          interferences,
          config.filter(p => p.id !== pos.id).map(p => ({
            x: p.x,
            y: p.y,
            width: pos.dimensions?.width || 400,
            height: pos.dimensions?.height || 100
          })),
          fullConstraints,
          viewport
        );
        return sum + scored.score;
      }, 0);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestConfiguration = config;
      }
    }

    if (this.debugMode) {
      console.log('[OptimalPositioningAlgorithm] Layout ottimizzato con punteggio:', bestScore);
    }

    return bestConfiguration;
  }

  private getViewportInfo(): ViewportInfo {
    if (typeof window === 'undefined') {
      return {
        width: 1920,
        height: 1080,
        scrollX: 0,
        scrollY: 0,
        safeArea: { top: 20, right: 20, bottom: 20, left: 20 }
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      safeArea: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      }
    };
  }

  private mergeConstraints(partial: Partial<PositioningConstraints>): PositioningConstraints {
    return {
      minMargin: 16,
      maxToastsPerArea: 5,
      preferredAreas: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
      avoidAreas: [],
      stackDirection: 'vertical',
      allowOverlap: false,
      ...partial
    };
  }

  private generatePositionCandidates(
    dimensions: ToastDimensions,
    viewport: ViewportInfo,
    constraints: PositioningConstraints
  ): PositionCandidate[] {
    const candidates: PositionCandidate[] = [];
    const { width: vw, height: vh, safeArea } = viewport;
    const { width: tw, height: th } = dimensions;

    // Posizioni standard negli angoli
    const standardPositions = [
      // Top-right
      {
        x: vw - tw - safeArea.right,
        y: safeArea.top,
        area: 'top-right' as const,
        reason: 'Standard top-right position'
      },
      // Top-left
      {
        x: safeArea.left,
        y: safeArea.top,
        area: 'top-left' as const,
        reason: 'Standard top-left position'
      },
      // Bottom-right
      {
        x: vw - tw - safeArea.right,
        y: vh - th - safeArea.bottom,
        area: 'bottom-right' as const,
        reason: 'Standard bottom-right position'
      },
      // Bottom-left
      {
        x: safeArea.left,
        y: vh - th - safeArea.bottom,
        area: 'bottom-left' as const,
        reason: 'Standard bottom-left position'
      }
    ];

    // Aggiungi posizioni standard se nell'area preferita
    for (const pos of standardPositions) {
      if (constraints.preferredAreas.includes(pos.area) && 
          !constraints.avoidAreas.includes(pos.area)) {
        candidates.push({
          ...pos,
          score: 0,
          conflicts: 0
        });
      }
    }

    // Genera posizioni aggiuntive con campionamento a griglia
    if (candidates.length < 10) {
      const gridCandidates = this.generateGridCandidates(
        dimensions,
        viewport,
        constraints
      );
      candidates.push(...gridCandidates);
    }

    return candidates;
  }

  private generateGridCandidates(
    dimensions: ToastDimensions,
    viewport: ViewportInfo,
    constraints: PositioningConstraints
  ): PositionCandidate[] {
    const candidates: PositionCandidate[] = [];
    const { width: vw, height: vh, safeArea } = viewport;
    const { width: tw, height: th } = dimensions;

    // Campiona posizioni su una griglia
    for (let x = safeArea.left; x <= vw - tw - safeArea.right; x += this.gridSize) {
      for (let y = safeArea.top; y <= vh - th - safeArea.bottom; y += this.gridSize) {
        const area = this.determineArea(x, y, vw, vh);
        
        if (constraints.preferredAreas.includes(area) && 
            !constraints.avoidAreas.includes(area)) {
          candidates.push({
            x,
            y,
            score: 0,
            conflicts: 0,
            reason: `Grid position in ${area}`,
            area
          });
        }
      }
    }

    return candidates.slice(0, 20); // Limita il numero di candidati
  }

  private generateLayoutConfigurations(
    currentPositions: Array<{ id: string; x: number; y: number; dimensions: ToastDimensions }>,
    viewport: ViewportInfo,
    constraints: PositioningConstraints
  ): Array<Array<PositionCandidate & { id: string; dimensions: ToastDimensions }>> {
    const configurations: Array<Array<PositionCandidate & { id: string; dimensions: ToastDimensions }>> = [];

    // Configurazione attuale (baseline)
    configurations.push(currentPositions.map(pos => ({
      ...pos,
      score: 0,
      conflicts: 0,
      reason: 'Current position',
      area: this.determineArea(pos.x, pos.y, viewport.width, viewport.height)
    })));

    // Configurazione stack verticale
    if (constraints.stackDirection === 'vertical') {
      const verticalConfig = this.createVerticalStackConfiguration(
        currentPositions,
        viewport,
        constraints
      );
      configurations.push(verticalConfig);
    }

    // Configurazione stack orizzontale
    if (constraints.stackDirection === 'horizontal') {
      const horizontalConfig = this.createHorizontalStackConfiguration(
        currentPositions,
        viewport,
        constraints
      );
      configurations.push(horizontalConfig);
    }

    // Configurazione griglia
    if (constraints.stackDirection === 'grid') {
      const gridConfig = this.createGridStackConfiguration(
        currentPositions,
        viewport,
        constraints
      );
      configurations.push(gridConfig);
    }

    return configurations;
  }

  private createVerticalStackConfiguration(
    positions: Array<{ id: string; x: number; y: number; dimensions: ToastDimensions }>,
    viewport: ViewportInfo,
    constraints: PositioningConstraints
  ): Array<PositionCandidate & { id: string; dimensions: ToastDimensions }> {
    const config: Array<PositionCandidate & { id: string; dimensions: ToastDimensions }> = [];
    const baseX = viewport.width - 420; // Posizione base a destra
    let currentY = viewport.safeArea.top;

    for (const pos of positions) {
      config.push({
        id: pos.id,
        dimensions: pos.dimensions,
        x: baseX,
        y: currentY,
        score: 0,
        conflicts: 0,
        reason: 'Vertical stack position',
        area: 'top-right'
      });

      currentY += pos.dimensions.height + constraints.minMargin;
    }

    return config;
  }

  private createHorizontalStackConfiguration(
    positions: Array<{ id: string; x: number; y: number; dimensions: ToastDimensions }>,
    viewport: ViewportInfo,
    constraints: PositioningConstraints
  ): Array<PositionCandidate & { id: string; dimensions: ToastDimensions }> {
    const config: Array<PositionCandidate & { id: string; dimensions: ToastDimensions }> = [];
    let currentX = viewport.safeArea.left;
    const baseY = viewport.safeArea.top;

    for (const pos of positions) {
      config.push({
        id: pos.id,
        dimensions: pos.dimensions,
        x: currentX,
        y: baseY,
        score: 0,
        conflicts: 0,
        reason: 'Horizontal stack position',
        area: 'top-left'
      });

      currentX += pos.dimensions.width + constraints.minMargin;
    }

    return config;
  }

  private createGridStackConfiguration(
    positions: Array<{ id: string; x: number; y: number; dimensions: ToastDimensions }>,
    viewport: ViewportInfo,
    constraints: PositioningConstraints
  ): Array<PositionCandidate & { id: string; dimensions: ToastDimensions }> {
    const config: Array<PositionCandidate & { id: string; dimensions: ToastDimensions }> = [];
    const cols = Math.floor(viewport.width / (400 + constraints.minMargin));
    let col = 0;
    let row = 0;

    for (const pos of positions) {
      const x = viewport.safeArea.left + col * (400 + constraints.minMargin);
      const y = viewport.safeArea.top + row * (pos.dimensions.height + constraints.minMargin);

      config.push({
        id: pos.id,
        dimensions: pos.dimensions,
        x,
        y,
        score: 0,
        conflicts: 0,
        reason: 'Grid position',
        area: this.determineArea(x, y, viewport.width, viewport.height)
      });

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    }

    return config;
  }

  private scorePosition(
    candidate: PositionCandidate,
    interferences: UIInterference[],
    existingToasts: Array<{ x: number; y: number; width: number; height: number }>,
    constraints: PositioningConstraints,
    viewport: ViewportInfo
  ): PositionCandidate {
    let score = 100; // Punteggio base
    let conflicts = 0;
    const reasons: string[] = [candidate.reason];

    // Penalità per interferenze
    for (const interference of interferences) {
      const overlap = this.calculateOverlap(
        { x: candidate.x, y: candidate.y, width: 400, height: 100 },
        interference.bounds
      );

      if (overlap > 0) {
        const penalty = overlap * (interference.priority === 'high' ? 50 : 20);
        score -= penalty;
        conflicts++;
        reasons.push(`Interference overlap: ${Math.round(overlap)}px`);
      }
    }

    // Penalità per sovrapposizione con toast esistenti
    if (!constraints.allowOverlap) {
      for (const toast of existingToasts) {
        const overlap = this.calculateOverlap(
          { x: candidate.x, y: candidate.y, width: 400, height: 100 },
          toast
        );

        if (overlap > 0) {
          score -= overlap * 30;
          conflicts++;
          reasons.push(`Toast overlap: ${Math.round(overlap)}px`);
        }
      }
    }

    // Bonus per posizioni preferite
    if (constraints.preferredAreas.includes(candidate.area)) {
      score += 20;
      reasons.push('Preferred area bonus');
    }

    // Penalità per posizioni da evitare
    if (constraints.avoidAreas.includes(candidate.area)) {
      score -= 40;
      reasons.push('Avoided area penalty');
    }

    // Bonus per visibilità (distanza dai bordi)
    const edgeDistance = Math.min(
      candidate.x,
      candidate.y,
      viewport.width - candidate.x - 400,
      viewport.height - candidate.y - 100
    );

    if (edgeDistance > 50) {
      score += 10;
      reasons.push('Good edge distance');
    }

    // Penalità per posizioni troppo vicine ai bordi
    if (edgeDistance < 10) {
      score -= 30;
      reasons.push('Too close to edge');
    }

    return {
      ...candidate,
      score: Math.max(0, score),
      conflicts,
      reason: reasons.join('; ')
    };
  }

  private calculateOverlap(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x?: number; y?: number; width?: number; height?: number; left?: number; top?: number; right?: number; bottom?: number }
  ): number {
    // Normalizza rect2 per gestire sia DOMRect che oggetti semplici
    const r2 = {
      x: rect2.x ?? rect2.left ?? 0,
      y: rect2.y ?? rect2.top ?? 0,
      width: rect2.width ?? ((rect2.right ?? 0) - (rect2.left ?? 0)),
      height: rect2.height ?? ((rect2.bottom ?? 0) - (rect2.top ?? 0))
    };

    const overlapX = Math.max(0, Math.min(rect1.x + rect1.width, r2.x + r2.width) - Math.max(rect1.x, r2.x));
    const overlapY = Math.max(0, Math.min(rect1.y + rect1.height, r2.y + r2.height) - Math.max(rect1.y, r2.y));

    return overlapX * overlapY;
  }

  private determineArea(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
  ): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' {
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    if (x < centerX && y < centerY) return 'top-left';
    if (x >= centerX && y < centerY) return 'top-right';
    if (x < centerX && y >= centerY) return 'bottom-left';
    if (x >= centerX && y >= centerY) return 'bottom-right';
    
    return 'center';
  }

  private getFallbackPosition(
    dimensions: ToastDimensions,
    viewport: ViewportInfo
  ): PositionCandidate {
    return {
      x: viewport.width - dimensions.width - viewport.safeArea.right,
      y: viewport.safeArea.top,
      score: 50,
      conflicts: 0,
      reason: 'Fallback position',
      area: 'top-right'
    };
  }

  public setGridSize(size: number): void {
    this.gridSize = Math.max(10, Math.min(50, size));
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

export default OptimalPositioningAlgorithm;