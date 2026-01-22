/**
 * Theme Utilities
 * Helpers per garantire consistenza del tema in tutta l'app
 */

// Colori semantici che rispettano il tema
export const themeColors = {
  // Backgrounds
  bg: {
    primary: 'bg-background',
    secondary: 'bg-muted',
    card: 'bg-card',
    popover: 'bg-popover',
    accent: 'bg-accent',
  },
  
  // Text
  text: {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    accent: 'text-accent-foreground',
    card: 'text-card-foreground',
  },
  
  // Borders
  border: {
    default: 'border-border',
    input: 'border-input',
    ring: 'ring-ring',
  },
  
  // Status colors (already theme-aware via CSS variables)
  status: {
    success: 'text-green-500 dark:text-green-400',
    error: 'text-red-500 dark:text-red-400',
    warning: 'text-yellow-500 dark:text-yellow-400',
    info: 'text-blue-500 dark:text-blue-400',
  },
  
  // Status backgrounds
  statusBg: {
    success: 'bg-green-500/10 dark:bg-green-400/10',
    error: 'bg-red-500/10 dark:bg-red-400/10',
    warning: 'bg-yellow-500/10 dark:bg-yellow-400/10',
    info: 'bg-blue-500/10 dark:bg-blue-400/10',
  },
} as const;

// Gradient presets che funzionano in entrambi i temi
export const gradients = {
  primary: 'bg-gradient-to-r from-blue-600 to-cyan-600',
  secondary: 'bg-gradient-to-r from-purple-600 to-pink-600',
  success: 'bg-gradient-to-r from-green-600 to-emerald-600',
  warning: 'bg-gradient-to-r from-yellow-600 to-orange-600',
  danger: 'bg-gradient-to-r from-red-600 to-rose-600',
  
  // Subtle gradients for backgrounds
  subtlePrimary: 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10',
  subtleSecondary: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
} as const;

// Hero header styles consistenti
export const heroStyles = {
  base: 'relative overflow-hidden rounded-xl p-4 text-white',
  gradient: gradients.primary,
  title: 'text-xl font-bold',
  subtitle: 'text-white/80 text-sm',
  stat: 'text-center',
  statValue: 'text-lg font-bold',
  statLabel: 'text-xs text-white/70',
} as const;

// Card styles consistenti
export const cardStyles = {
  base: 'rounded-lg border bg-card text-card-foreground shadow-sm',
  header: 'flex flex-col space-y-1.5 p-6',
  title: 'text-2xl font-semibold leading-none tracking-tight',
  description: 'text-sm text-muted-foreground',
  content: 'p-6 pt-0',
  footer: 'flex items-center p-6 pt-0',
} as const;

// Button variants che rispettano il tema
export const buttonVariants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
} as const;

/**
 * Helper per combinare classi con supporto tema
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get appropriate text color for a background
 */
export function getContrastText(bgColor: 'light' | 'dark'): string {
  return bgColor === 'dark' ? 'text-white' : 'text-gray-900';
}
