'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
  className?: string;
  particleCount?: number;
  showGradient?: boolean;
  showParticles?: boolean;
}

export function AnimatedBackground({ 
  className = '',
  particleCount = 50,
  showGradient = true,
  showParticles = true
}: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particelle animate con Canvas per performance
  useEffect(() => {
    if (!showParticles) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particelle
    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
    }

    const particles: Particle[] = [];
    const colors = [
      'rgba(168, 85, 247, ', // purple
      'rgba(59, 130, 246, ', // blue
      'rgba(236, 72, 153, ', // pink
      'rgba(34, 211, 238, ', // cyan
    ];

    // Crea particelle
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Muovi particella
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Disegna particella con glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.opacity + ')';
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (p.opacity * 0.2) + ')';
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [showParticles, particleCount]);

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Gradient Mesh Animato */}
      {showGradient && (
        <div className="absolute inset-0">
          {/* Blob 1 - Purple */}
          <motion.div
            className="absolute w-[1000px] h-[1000px] rounded-full opacity-70 blur-[60px]"
            style={{
              background: 'radial-gradient(circle, rgba(168, 85, 247, 1) 0%, rgba(168, 85, 247, 0.5) 40%, transparent 70%)',
              top: '-25%',
              left: '-15%',
            }}
            animate={{
              x: [0, 100, 50, 0],
              y: [0, 50, 100, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Blob 2 - Blue */}
          <motion.div
            className="absolute w-[900px] h-[900px] rounded-full opacity-60 blur-[50px]"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 1) 0%, rgba(59, 130, 246, 0.5) 40%, transparent 70%)',
              top: '10%',
              right: '-20%',
            }}
            animate={{
              x: [0, -80, -40, 0],
              y: [0, 80, 40, 0],
              scale: [1, 0.9, 1.05, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Blob 3 - Pink/Magenta */}
          <motion.div
            className="absolute w-[800px] h-[800px] rounded-full opacity-55 blur-[50px]"
            style={{
              background: 'radial-gradient(circle, rgba(236, 72, 153, 1) 0%, rgba(236, 72, 153, 0.5) 40%, transparent 70%)',
              bottom: '-15%',
              left: '20%',
            }}
            animate={{
              x: [0, 60, -30, 0],
              y: [0, -60, -30, 0],
              scale: [1, 1.15, 0.9, 1],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Blob 4 - Cyan */}
          <motion.div
            className="absolute w-[700px] h-[700px] rounded-full opacity-50 blur-[40px]"
            style={{
              background: 'radial-gradient(circle, rgba(34, 211, 238, 1) 0%, rgba(34, 211, 238, 0.5) 40%, transparent 70%)',
              top: '40%',
              left: '0%',
            }}
            animate={{
              x: [0, 40, -20, 0],
              y: [0, -40, 20, 0],
              scale: [1, 0.95, 1.1, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
      )}

      {/* Canvas per particelle */}
      {showParticles && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10"
          style={{ opacity: 0.8 }}
        />
      )}

      {/* Overlay grain per texture */}
      <div 
        className="absolute inset-0 z-20 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default AnimatedBackground;
