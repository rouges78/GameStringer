'use client';

import React, { useEffect, useRef, useMemo } from 'react';

// Lettere da vari alfabeti del mondo
const ALPHABETS = {
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя',
  greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω',
  japanese: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',
  chinese: '中国文字游戏翻译语言世界你好谢谢再见朋友家人爱心梦想希望力量勇气智慧',
  korean: 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ가나다라마바사아자차카타파하',
  arabic: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
  hebrew: 'אבגדהוזחטיכלמנסעפצקרשת',
  thai: 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ',
  hindi: 'अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह',
  symbols: '♠♣♥♦★☆◆◇○●□■△▽▲▼'
};

// Combina tutti gli alfabeti
const ALL_LETTERS = Object.values(ALPHABETS).join('');

interface FloatingLetter {
  id: number;
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
}

interface AlphabetBackgroundProps {
  letterCount?: number;
  className?: string;
}

export function AlphabetBackground({ 
  letterCount = 60,
  className = ''
}: AlphabetBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lettersRef = useRef<FloatingLetter[]>([]);

  // Genera lettere casuali
  const initLetters = useMemo(() => {
    const letters: FloatingLetter[] = [];
    for (let i = 0; i < letterCount; i++) {
      letters.push({
        id: i,
        char: ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        size: 12 + Math.random() * 20,
        opacity: 0.03 + Math.random() * 0.08,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.5
      });
    }
    return letters;
  }, [letterCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    lettersRef.current = [...initLetters];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      if (!ctx || !canvas) return;

      // Sfondo blu scuro con gradiente
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0a1628');
      gradient.addColorStop(0.5, '#0d1f3c');
      gradient.addColorStop(1, '#0a1628');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Disegna e aggiorna ogni lettera
      lettersRef.current.forEach((letter) => {
        // Aggiorna posizione
        letter.x += letter.vx;
        letter.y += letter.vy;
        letter.rotation += letter.rotationSpeed;

        // Wrap around ai bordi
        if (letter.x < -5) letter.x = 105;
        if (letter.x > 105) letter.x = -5;
        if (letter.y < -5) letter.y = 105;
        if (letter.y > 105) letter.y = -5;

        // Converti percentuale in pixel
        const px = (letter.x / 100) * canvas.width;
        const py = (letter.y / 100) * canvas.height;

        // Disegna lettera
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((letter.rotation * Math.PI) / 180);
        
        // Colore blu leggermente più chiaro dello sfondo
        ctx.fillStyle = `rgba(59, 130, 246, ${letter.opacity})`;
        ctx.font = `${letter.size}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter.char, 0, 0);
        
        ctx.restore();

        // Occasionalmente cambia lettera
        if (Math.random() < 0.001) {
          letter.char = ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)];
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initLetters]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  );
}
