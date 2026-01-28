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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = {
      primary: '#8b5cf6',
      secondary: '#06b6d4', 
      accent: '#ec4899',
      trace: '#22d3ee',
    };

    // Genera tracce PCB
    interface Trace {
      points: { x: number; y: number }[];
      color: string;
      width: number;
    }

    interface Pulse {
      traceIndex: number;
      progress: number;
      speed: number;
      color: string;
      length: number;
    }

    const traces: Trace[] = [];
    const pulses: Pulse[] = [];

    const generateTraces = () => {
      traces.length = 0;
      pulses.length = 0;
      
      const gridSize = 30;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Genera tracce dal centro verso l'esterno
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const trace: Trace = {
          points: [{ x: centerX, y: centerY }],
          color: [colors.primary, colors.secondary, colors.accent, colors.trace][i % 4],
          width: 2
        };

        let x = centerX;
        let y = centerY;
        const targetX = centerX + Math.cos(angle) * (300 + Math.random() * 200);
        const targetY = centerY + Math.sin(angle) * (200 + Math.random() * 150);

        // Percorso ortogonale (solo angoli 90°)
        while (Math.abs(x - targetX) > gridSize || Math.abs(y - targetY) > gridSize) {
          const moveHorizontal = Math.random() > 0.5;
          
          if (moveHorizontal && Math.abs(x - targetX) > gridSize) {
            const dir = targetX > x ? 1 : -1;
            const steps = Math.floor(Math.random() * 4) + 1;
            x += dir * gridSize * steps;
          } else if (Math.abs(y - targetY) > gridSize) {
            const dir = targetY > y ? 1 : -1;
            const steps = Math.floor(Math.random() * 4) + 1;
            y += dir * gridSize * steps;
          }
          
          trace.points.push({ x, y });
          
          if (trace.points.length > 20) break;
        }

        // Ramificazioni
        if (trace.points.length > 3 && Math.random() > 0.3) {
          const branchPoint = trace.points[Math.floor(trace.points.length / 2)];
          const branch: Trace = {
            points: [{ x: branchPoint.x, y: branchPoint.y }],
            color: trace.color,
            width: 1.5
          };
          
          let bx = branchPoint.x;
          let by = branchPoint.y;
          for (let j = 0; j < 5; j++) {
            if (Math.random() > 0.5) {
              bx += (Math.random() > 0.5 ? 1 : -1) * gridSize * 2;
            } else {
              by += (Math.random() > 0.5 ? 1 : -1) * gridSize * 2;
            }
            branch.points.push({ x: bx, y: by });
          }
          traces.push(branch);
        }

        traces.push(trace);
      }

      // Tracce aggiuntive sparse
      for (let i = 0; i < 8; i++) {
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;
        const trace: Trace = {
          points: [{ x: startX, y: startY }],
          color: [colors.primary, colors.secondary, colors.accent, colors.trace][i % 4],
          width: 1.5
        };

        let x = startX;
        let y = startY;
        for (let j = 0; j < 8; j++) {
          if (Math.random() > 0.5) {
            x += (Math.random() > 0.5 ? 1 : -1) * gridSize * (2 + Math.floor(Math.random() * 3));
          } else {
            y += (Math.random() > 0.5 ? 1 : -1) * gridSize * (2 + Math.floor(Math.random() * 3));
          }
          x = Math.max(20, Math.min(canvas.width - 20, x));
          y = Math.max(20, Math.min(canvas.height - 20, y));
          trace.points.push({ x, y });
        }
        traces.push(trace);
      }

      // Crea impulsi per ogni traccia
      traces.forEach((_, index) => {
        for (let i = 0; i < 2; i++) {
          pulses.push({
            traceIndex: index,
            progress: Math.random(),
            speed: 0.003 + Math.random() * 0.005,
            color: traces[index].color,
            length: 0.08 + Math.random() * 0.06
          });
        }
      });
    };

    generateTraces();

    // Calcola punto lungo una traccia
    const getPointOnTrace = (trace: Trace, progress: number): { x: number; y: number } => {
      if (trace.points.length < 2) return trace.points[0];
      
      let totalLength = 0;
      const segments: number[] = [];
      
      for (let i = 1; i < trace.points.length; i++) {
        const dx = trace.points[i].x - trace.points[i-1].x;
        const dy = trace.points[i].y - trace.points[i-1].y;
        const len = Math.sqrt(dx * dx + dy * dy);
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Disegna tracce base
      traces.forEach(trace => {
        if (trace.points.length < 2) return;
        
        ctx.strokeStyle = trace.color + '25';
        ctx.lineWidth = trace.width;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        
        ctx.beginPath();
        ctx.moveTo(trace.points[0].x, trace.points[0].y);
        for (let i = 1; i < trace.points.length; i++) {
          ctx.lineTo(trace.points[i].x, trace.points[i].y);
        }
        ctx.stroke();

        // Giunzioni (piccoli quadrati)
        ctx.fillStyle = trace.color + '30';
        trace.points.forEach((point, i) => {
          if (i > 0 && i < trace.points.length - 1) {
            ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
          }
        });
      });

      // Disegna e aggiorna impulsi
      pulses.forEach(pulse => {
        const trace = traces[pulse.traceIndex];
        if (!trace || trace.points.length < 2) return;

        // Disegna scia luminosa
        const headPos = getPointOnTrace(trace, pulse.progress);
        const tailProgress = Math.max(0, pulse.progress - pulse.length);
        const tailPos = getPointOnTrace(trace, tailProgress);

        // Skip se posizioni non valide
        if (!headPos || !tailPos || 
            !isFinite(headPos.x) || !isFinite(headPos.y) || 
            !isFinite(tailPos.x) || !isFinite(tailPos.y)) {
          pulse.progress += pulse.speed;
          if (pulse.progress > 1 + pulse.length) pulse.progress = 0;
          return;
        }

        // Glow dell'impulso
        const gradient = ctx.createLinearGradient(tailPos.x, tailPos.y, headPos.x, headPos.y);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.5, pulse.color + '80');
        gradient.addColorStop(1, pulse.color);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = trace.width + 2;
        ctx.lineCap = 'round';
        
        // Disegna segmento illuminato
        ctx.beginPath();
        ctx.moveTo(tailPos.x, tailPos.y);
        ctx.lineTo(headPos.x, headPos.y);
        ctx.stroke();

        // Punto luminoso alla testa
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headPos.x - 2, headPos.y - 2, 4, 4);
        ctx.shadowBlur = 0;

        // Aggiorna progresso
        pulse.progress += pulse.speed;
        if (pulse.progress > 1 + pulse.length) {
          pulse.progress = 0;
        }
      });

      // Chip centrale stilizzato (solo contorno)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const chipSize = 50;

      ctx.strokeStyle = colors.primary + '50';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - chipSize/2, centerY - chipSize/2, chipSize, chipSize);
      
      // Pin del chip centrale
      ctx.strokeStyle = colors.primary + '40';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const offset = -15 + i * 10;
        // Top
        ctx.beginPath();
        ctx.moveTo(centerX + offset, centerY - chipSize/2);
        ctx.lineTo(centerX + offset, centerY - chipSize/2 - 10);
        ctx.stroke();
        // Bottom
        ctx.beginPath();
        ctx.moveTo(centerX + offset, centerY + chipSize/2);
        ctx.lineTo(centerX + offset, centerY + chipSize/2 + 10);
        ctx.stroke();
        // Left
        ctx.beginPath();
        ctx.moveTo(centerX - chipSize/2, centerY + offset);
        ctx.lineTo(centerX - chipSize/2 - 10, centerY + offset);
        ctx.stroke();
        // Right
        ctx.beginPath();
        ctx.moveTo(centerX + chipSize/2, centerY + offset);
        ctx.lineTo(centerX + chipSize/2 + 10, centerY + offset);
        ctx.stroke();
      }

      // Glow centrale
      const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, chipSize);
      glowGradient.addColorStop(0, colors.primary + '30');
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(centerX - chipSize, centerY - chipSize, chipSize * 2, chipSize * 2);

      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      resizeCanvas();
      generateTraces();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ opacity: 0.7 }}
      />
    </div>
  );
}

export default AINetworkBackground;
