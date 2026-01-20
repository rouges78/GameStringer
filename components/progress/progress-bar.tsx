'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDuration, formatProgress, ProgressEasing } from '@/lib/utils/progress-calculations';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showPercentage?: boolean;
  showTimeRemaining?: boolean;
  estimatedTimeRemaining?: number;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  striped?: boolean;
  pulse?: boolean;
}

export function ProgressBar({
  progress,
  className,
  showPercentage = true,
  showTimeRemaining = false,
  estimatedTimeRemaining,
  animated = true,
  size = 'md',
  variant = 'default',
  striped = false,
  pulse = false
}: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Animazione smooth del progresso
  useEffect(() => {
    if (!animated) {
      setDisplayProgress(progress);
      return;
    }

    const startProgress = displayProgress;
    const targetProgress = progress;
    const duration = 300; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Usa easing per animazione smooth
      const easedT = ProgressEasing.easeOut(t);
      const currentProgress = startProgress + (targetProgress - startProgress) * easedT;
      
      setDisplayProgress(currentProgress);

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [progress, animated, displayProgress]);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const variantClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  const clampedProgress = Math.max(0, Math.min(100, displayProgress));

  return (
    <div className={cn('w-full', className)}>
      {/* Header con percentuale e tempo */}
      {(showPercentage || showTimeRemaining) && (
        <div className="flex justify-between items-center mb-2 text-sm text-gray-600 dark:text-gray-400">
          {showPercentage && (
            <span className="font-medium">
              {formatProgress(clampedProgress)}
            </span>
          )}
          {showTimeRemaining && estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
            <span>
              {formatDuration(estimatedTimeRemaining)} rimanenti
            </span>
          )}
        </div>
      )}

      {/* Barra di progresso */}
      <div
        className={cn(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out rounded-full relative',
            variantClasses[variant],
            {
              'animate-pulse': pulse,
              'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-[shimmer_2s_infinite]': striped
            }
          )}
          style={{ width: `${clampedProgress}%` }}
        >
          {/* Effetto striped */}
          {striped && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:20px_100%] animate-[slide_1s_infinite_linear]" />
          )}
        </div>
      </div>
    </div>
  );
}

// Componente per progresso indeterminato
interface IndeterminateProgressProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function IndeterminateProgress({
  className,
  size = 'md',
  variant = 'default'
}: IndeterminateProgressProps) {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const variantClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full animate-[indeterminate_2s_infinite_linear]',
            variantClasses[variant]
          )}
          style={{
            width: '30%',
            background: `linear-gradient(90deg, transparent, currentColor, transparent)`
          }}
        />
      </div>
    </div>
  );
}

// Componente per progresso circolare
interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function CircularProgress({
  progress,
  size = 64,
  strokeWidth = 4,
  className,
  showPercentage = true,
  variant = 'default'
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const variantColors = {
    default: 'stroke-blue-500',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    error: 'stroke-red-500'
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-300 ease-out',
            variantColors[variant]
          )}
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}


