import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // lib/ contiene classi colore usate dai componenti (gradienti avatar,
    // badge di stato): senza questa riga Tailwind non le genera.
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    'bg-orange-400',
    'bg-orange-500',
    'bg-orange-500/10',
    'bg-orange-500/20',
    'text-orange-400',
    'text-orange-300',
    'text-orange-400/60',
    'border-orange-500/30',
    'hover:text-orange-300',
    'hover:bg-orange-500/20',
    'group-hover:text-orange-300',
    'shadow-orange-500/20',
    // Guide page category colors
    'text-noir-400',
    'bg-noir-500/20',
    'text-emerald-400',
    'bg-emerald-500/20',
    'text-rouge-400',
    'bg-rouge-500/20',
  ],
  theme: {
    extend: {
      fontSize: {
        'micro': ['0.5625rem', { lineHeight: '0.75rem' }],   // 9px  — replaces text-micro
        '2xs':   ['0.625rem',  { lineHeight: '0.875rem' }],  // 10px — replaces text-2xs
      },
      // Font di sistema della suite Rouges (come rouges-db e LightMail): Segoe UI
      // Variable per il testo, Cascadia Mono per i dati.
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // Tailwind 3.3 salta da opacity-10 a opacity-20: opacity-15 è usata nelle
      // copertine degli header e senza questa voce non genera CSS.
      opacity: {
        15: '0.15',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // Scale della suite Rouges ("Rouge Noir"), con le stesse gradazioni di
        // Tailwind. noir = grigi neutri (900 = superficie #161618, 950 = fondo
        // #0f0f10, 400 = testo tenue #9b9ba3, 700 = bordo forte #3a3a40);
        // rouge = rosso della suite (500 = #ff3b4a). Sostituiscono le vecchie
        // classi slate/gray/zinc/blue/cyan/teal (→ noir) e viola/rosa (→ rouge).
        noir: {
          50: '#f7f7f8',
          100: '#f2f2f2',
          200: '#e4e4e7',
          300: '#c9c9cf',
          400: '#9b9ba3',
          500: '#6e6e77',
          600: '#505057',
          700: '#3a3a40',
          800: '#26262a',
          900: '#161618',
          950: '#0f0f10',
        },
        rouge: {
          50: '#fff1f2',
          100: '#ffe1e3',
          200: '#ffc7cb',
          300: '#ffa0a7',
          400: '#ff6b76',
          500: '#ff3b4a',
          600: '#ed1c2c',
          700: '#c81222',
          800: '#a51321',
          900: '#881622',
          950: '#4b060d',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'gradient-shift': {
          '0%, 100%': {
            'background-position': '0% 50%',
          },
          '50%': {
            'background-position': '100% 50%',
          },
        },
        'shimmer': {
          '0%, 100%': { 
            'background-size': '200% 200%',
            'background-position': '50% 50%'
          },
          '50%': { 
            'background-size': '300% 300%',
            'background-position': '50% 50%'
          },
        },
        'marquee': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
        'shimmer': 'shimmer 12s ease-in-out infinite',
        'marquee': 'marquee 8s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;

