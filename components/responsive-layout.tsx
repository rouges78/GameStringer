'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
}

type BreakpointSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface BreakpointConfig {
  size: BreakpointSize;
  minWidth: number;
  columns: number;
  cardSize: string;
  spacing: string;
}

const breakpoints: BreakpointConfig[] = [
  { size: 'xs', minWidth: 0, columns: 1, cardSize: 'w-full', spacing: 'gap-2' },
  { size: 'sm', minWidth: 640, columns: 2, cardSize: 'w-full', spacing: 'gap-3' },
  { size: 'md', minWidth: 768, columns: 3, cardSize: 'w-full', spacing: 'gap-4' },
  { size: 'lg', minWidth: 1024, columns: 4, cardSize: 'w-full', spacing: 'gap-4' },
  { size: 'xl', minWidth: 1280, columns: 5, cardSize: 'w-full', spacing: 'gap-5' },
  { size: '2xl', minWidth: 1536, columns: 6, cardSize: 'w-full', spacing: 'gap-6' },
];

export const useResponsive = () => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<BreakpointConfig>(breakpoints[0]);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setWindowSize({ width, height });
      
      // Trova il breakpoint corretto
      const breakpoint = breakpoints
        .slice()
        .reverse()
        .find(bp => width >= bp.minWidth) || breakpoints[0];
      
      setCurrentBreakpoint(breakpoint);
    };

    // Imposta dimensioni iniziali
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = currentBreakpoint.size === 'xs' || currentBreakpoint.size === 'sm';
  const isTablet = currentBreakpoint.size === 'md';
  const isDesktop = currentBreakpoint.size === 'lg' || currentBreakpoint.size === 'xl' || currentBreakpoint.size === '2xl';

  return {
    breakpoint: currentBreakpoint,
    windowSize,
    isMobile,
    isTablet,
    isDesktop,
    columns: currentBreakpoint.columns,
    cardSize: currentBreakpoint.cardSize,
    spacing: currentBreakpoint.spacing
  };
};

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ children, className }) => {
  const { breakpoint, isMobile, isTablet, isDesktop } = useResponsive();

  return (
    <div className={cn(
      'w-full transition-all duration-300',
      {
        'px-2 py-2': isMobile,
        'px-4 py-3': isTablet,
        'px-6 py-4': isDesktop,
      },
      className
    )}>
      {children}
    </div>
  );
};

export default ResponsiveLayout;

// Componente per griglia responsive
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  minItemWidth?: number;
  maxColumns?: number;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className,
  minItemWidth = 280,
  maxColumns = 6
}) => {
  const { windowSize, spacing } = useResponsive();
  
  const calculateColumns = () => {
    if (windowSize.width === 0) return 1;
    
    const availableWidth = windowSize.width - 48; // Padding
    const columns = Math.floor(availableWidth / minItemWidth);
    return Math.min(Math.max(columns, 1), maxColumns);
  };

  const columns = calculateColumns();

  return (
    <div 
      className={cn(
        'grid w-full',
        spacing,
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
      }}
    >
      {children}
    </div>
  );
};

// Hook per classi responsive
export const useResponsiveClasses = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  return {
    container: cn({
      'max-w-full px-2': isMobile,
      'max-w-4xl px-4': isTablet,
      'max-w-7xl px-6': isDesktop,
    }),
    text: cn({
      'text-sm': isMobile,
      'text-base': isTablet,
      'text-lg': isDesktop,
    }),
    heading: cn({
      'text-xl': isMobile,
      'text-2xl': isTablet,
      'text-3xl': isDesktop,
    }),
    button: cn({
      'px-3 py-2 text-sm': isMobile,
      'px-4 py-2 text-base': isTablet,
      'px-6 py-3 text-lg': isDesktop,
    }),
    card: cn({
      'p-3 rounded-lg': isMobile,
      'p-4 rounded-xl': isTablet,
      'p-6 rounded-2xl': isDesktop,
    }),
  };
};
