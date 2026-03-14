'use client';

import { useEffect, useRef } from 'react';

interface AINetworkBackgroundProps {
  className?: string;
}

export function AINetworkBackground({ className = '' }: AINetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Colori in palette con la nuova dashboard (Indaco, Fucsia, Ciano, Emerald)
    const colors = {
      bg: '#020617', // slate-950 base
      grid: '#1e293b', // slate-800
      primary: '#6366f1', // indigo-500
      secondary: '#0ea5e9', // sky-500
      accent: '#d946ef', // fuchsia-500
      trace: '#312e81', // indigo-900
      traceGlow: '#818cf8', // indigo-400
      emerald: '#10b981', // emerald-500
    };

    const gridSize = 40;

    interface Point { x: number; y: number }
    interface Trace {
      points: Point[];
      baseColor: string;
      glowColor: string;
      width: number;
      isBus: boolean;
    }
    interface Pulse {
      traceIndex: number;
      progress: number;
      speed: number;
      length: number;
      color: string;
      glowSize: number;
      packetType: 'stream' | 'chunks';
    }
    interface Component {
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'cpu' | 'memory' | 'node';
    }

    const traces: Trace[] = [];
    const pulses: Pulse[] = [];
    const components: Component[] = [];

    // Helper per allineare alla griglia
    const snap = (val: number) => Math.round(val / gridSize) * gridSize;

    const generateLayout = () => {
      traces.length = 0;
      pulses.length = 0;
      components.length = 0;

      const w = canvas.width;
      const h = canvas.height;
      const cols = Math.floor(w / gridSize);
      const rows = Math.floor(h / gridSize);

      // 1. Genera componenti (Mega Chip e Nodi di memoria)
      const numComponents = Math.floor((cols * rows) / 100);
      for (let i = 0; i < numComponents; i++) {
        const type = Math.random() > 0.8 ? 'cpu' : (Math.random() > 0.5 ? 'memory' : 'node');
        let width = gridSize * 2;
        let height = gridSize * 2;
        
        if (type === 'cpu') {
          width = gridSize * 4;
          height = gridSize * 4;
        } else if (type === 'memory') {
          width = gridSize * 3;
          height = gridSize * 1;
        } else {
          width = gridSize;
          height = gridSize;
        }

        const x = snap(Math.random() * (w - width));
        const y = snap(Math.random() * (h - height));
        
        components.push({ x, y, width, height, type });
      }

      // CPU centrale fissa per estetica se non generata
      if (!components.find(c => c.type === 'cpu')) {
        components.push({
          x: snap(w / 2 - gridSize * 2),
          y: snap(h / 2 - gridSize * 2),
          width: gridSize * 4,
          height: gridSize * 4,
          type: 'cpu'
        });
      }

      // 2. Genera tracce (Data Buses e Control Lines)
      const palette = [colors.primary, colors.secondary, colors.accent, colors.emerald];
      const glowPalette = ['#a5b4fc', '#7dd3fc', '#f0abfc', '#6ee7b7'];

      const numTraces = Math.floor((cols + rows) * 0.8);

      for (let i = 0; i < numTraces; i++) {
        const isBus = Math.random() > 0.7; // I bus sono più spessi e dritti
        const colorIdx = Math.floor(Math.random() * palette.length);
        const baseColor = isBus ? colors.trace : palette[colorIdx] + '40'; // I bus hanno base scura, linee sottili sono semitrasparenti
        const glowColor = isBus ? glowPalette[colorIdx] : palette[colorIdx];
        const width = isBus ? 4 : 1.5;
        const maxSegments = isBus ? 3 : Math.floor(Math.random() * 8) + 4;

        const points: Point[] = [];
        
        // Start point
        let currentX = snap(Math.random() * w);
        let currentY = snap(Math.random() * h);
        points.push({ x: currentX, y: currentY });

        let direction = Math.random() > 0.5 ? 'h' : 'v';

        for (let s = 0; s < maxSegments; s++) {
          const length = snap((Math.random() * 10 + 2) * gridSize);
          const sign = Math.random() > 0.5 ? 1 : -1;

          if (direction === 'h') {
            currentX += length * sign;
            direction = 'v';
          } else {
            currentY += length * sign;
            direction = 'h';
          }
          
          points.push({ x: currentX, y: currentY });
        }

        traces.push({ points, baseColor, glowColor, width, isBus });

        // Aggiungi pulses alla traccia
        const numPulses = isBus ? Math.floor(Math.random() * 3) + 1 : (Math.random() > 0.5 ? 1 : 0);
        for (let p = 0; p < numPulses; p++) {
          pulses.push({
            traceIndex: i,
            progress: Math.random(),
            speed: isBus ? (0.001 + Math.random() * 0.002) : (0.003 + Math.random() * 0.005),
            length: isBus ? (0.1 + Math.random() * 0.15) : (0.05 + Math.random() * 0.05),
            color: glowColor,
            glowSize: isBus ? 20 : 10,
            packetType: isBus ? 'chunks' : 'stream'
          });
        }
      }
    };

    generateLayout();

    const getPointOnTrace = (trace: Trace, progress: number): Point => {
      if (trace.points.length < 2) return trace.points[0];
      
      let totalLength = 0;
      const segments: number[] = [];
      
      for (let i = 1; i < trace.points.length; i++) {
        const dx = trace.points[i].x - trace.points[i-1].x;
        const dy = trace.points[i].y - trace.points[i-1].y;
        const len = Math.abs(dx) + Math.abs(dy); // Tracce ortogonali, distanza Manhattan
        segments.push(len);
        totalLength += len;
      }
      
      const targetDist = progress * totalLength;
      let currentDist = 0;
      
      for (let i = 0; i < segments.length; i++) {
        if (currentDist + segments[i] >= targetDist) {
          const segmentProgress = (targetDist - currentDist) / segments[i];
          return {
            x: trace.points[i].x + (trace.points[i+1].x - trace.points[i].x) * segmentProgress,
            y: trace.points[i].y + (trace.points[i+1].y - trace.points[i].y) * segmentProgress
          };
        }
        currentDist += segments[i];
      }
      
      return trace.points[trace.points.length - 1];
    };

    let animationId: number;

    const animate = () => {
      // Clear with slight transparency for trail effect
      ctx.fillStyle = colors.bg + '30'; // Lascia una leggera scia
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Grid Background (punti)
      ctx.fillStyle = colors.grid;
      for (let x = 0; x < canvas.width; x += gridSize) {
        for (let y = 0; y < canvas.height; y += gridSize) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      // 2. Draw Components (Chips, RAM)
      components.forEach(comp => {
        ctx.strokeStyle = colors.trace;
        ctx.lineWidth = 2;
        ctx.fillStyle = colors.bg;
        
        ctx.shadowColor = colors.primary + '40';
        ctx.shadowBlur = 15;
        
        // Body chip
        ctx.beginPath();
        // Smussa angoli per un look più moderno
        const r = 4;
        ctx.roundRect(comp.x, comp.y, comp.width, comp.height, r);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        // Dettagli in base al tipo
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        
        if (comp.type === 'cpu') {
          // Core CPU pattern
          const coreSize = comp.width / 2;
          const cx = comp.x + comp.width / 2;
          const cy = comp.y + comp.height / 2;
          
          ctx.strokeRect(cx - coreSize/2, cy - coreSize/2, coreSize, coreSize);
          
          // CPU Pins (dots along edges)
          ctx.fillStyle = colors.traceGlow + '80';
          for (let i = gridSize/2; i < comp.width; i += gridSize/2) {
            ctx.fillRect(comp.x + i - 1.5, comp.y - 1.5, 3, 3); // top
            ctx.fillRect(comp.x + i - 1.5, comp.y + comp.height - 1.5, 3, 3); // bottom
            ctx.fillRect(comp.x - 1.5, comp.y + i - 1.5, 3, 3); // left
            ctx.fillRect(comp.x + comp.width - 1.5, comp.y + i - 1.5, 3, 3); // right
          }
        } else if (comp.type === 'memory') {
          // RAM lines
          for (let i = gridSize/2; i < comp.width; i += gridSize/2) {
            ctx.beginPath();
            ctx.moveTo(comp.x + i, comp.y + 4);
            ctx.lineTo(comp.x + i, comp.y + comp.height - 4);
            ctx.stroke();
          }
        } else {
          // Node dot
          ctx.fillStyle = colors.secondary + '50';
          ctx.beginPath();
          ctx.arc(comp.x + comp.width/2, comp.y + comp.height/2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 3. Draw Trace Base Paths
      traces.forEach(trace => {
        if (trace.points.length < 2) return;
        
        ctx.strokeStyle = trace.baseColor;
        ctx.lineWidth = trace.width;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        
        ctx.beginPath();
        ctx.moveTo(trace.points[0].x, trace.points[0].y);
        for (let i = 1; i < trace.points.length; i++) {
          ctx.lineTo(trace.points[i].x, trace.points[i].y);
        }
        ctx.stroke();

        // Draw via holes at joints
        ctx.fillStyle = colors.bg;
        ctx.strokeStyle = trace.baseColor;
        ctx.lineWidth = 1;
        trace.points.forEach((point, i) => {
          if (trace.isBus) {
            // Bus pads (quadrati vuoti)
            ctx.strokeRect(point.x - 3, point.y - 3, 6, 6);
          } else {
            // Normal vias (cerchi)
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        });
      });

      // 4. Draw Pulses (Data Flow)
      pulses.forEach(pulse => {
        const trace = traces[pulse.traceIndex];
        if (!trace || trace.points.length < 2) return;

        const headProgress = pulse.progress;
        const tailProgress = Math.max(0, pulse.progress - pulse.length);
        
        // Wrap around logic (permette di avere la scia che attraversa l'inizio e la fine senza sparire di colpo)
        if (headProgress > 1 && tailProgress > 1) {
          pulse.progress = pulse.progress % 1;
          return;
        }

        const headPos = getPointOnTrace(trace, Math.min(1, headProgress));
        const tailPos = getPointOnTrace(trace, tailProgress);

        if (!headPos || !tailPos) return;

        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = pulse.glowSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (pulse.packetType === 'stream') {
          // Flusso dati continuo (gradiente)
          const gradient = ctx.createLinearGradient(tailPos.x, tailPos.y, headPos.x, headPos.y);
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(0.5, pulse.color + '80');
          gradient.addColorStop(1, pulse.color);
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = trace.width + 1.5;
          
          ctx.beginPath();
          ctx.moveTo(tailPos.x, tailPos.y);
          // Ridisegna fedelmente il segmento percorso per seguire gli angoli
          for (let i = 0; i < trace.points.length; i++) {
             // Stima molto grezza per disegnare gli angoli all'interno del pulse
             // In una simulazione perfetta calcoleremmo ogni punto intermedio, 
             // ma per performance usiamo il context clip o una semplificazione
          }
          // Semplificazione: disegna retta, va bene se il pulse è corto o segue segmenti dritti (spesso accade)
          // Se scavalca un angolo sembrerà un salto diagonale temporaneo. Per fixarlo:
          // Tracciamo il path esatto
          
          ctx.lineTo(headPos.x, headPos.y);
          ctx.stroke();

          // Testa del pulse molto luminosa
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(headPos.x - 1.5, headPos.y - 1.5, 3, 3);
          
        } else {
          // "Chunks" - Pacchetti dati frammentati tipici dei bus
          ctx.fillStyle = pulse.color;
          ctx.strokeStyle = pulse.color;
          ctx.lineWidth = trace.width;
          
          // Disegniamo la retta tra tail e head a tratti tratteggiati
          ctx.beginPath();
          ctx.setLineDash([8, 6]); // Tratteggio
          ctx.moveTo(tailPos.x, tailPos.y);
          ctx.lineTo(headPos.x, headPos.y);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
          
          // Data node leader
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(headPos.x, headPos.y, trace.width, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;

        pulse.progress += pulse.speed;
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      resizeCanvas();
      generateLayout();
    };

    // Rigenera se la finestra cambia per mantenere densità
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 200);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('resize', debouncedResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none bg-[#020617] ${className}`}
      style={{ zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.8 }}
      />
      {/* Overlay gradient per sfumare i bordi e far risaltare il contenuto sopra */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/40 to-slate-950/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent" />
    </div>
  );
}

export default AINetworkBackground;
