/** @type {import('next').NextConfig} */
const isTauri = process.env.TAURI_BUILD === 'true';

const nextConfig = {
  // Disabilita Next.js Dev Tools indicator
  devIndicators: false,
  // Permetti richieste cross-origin da Tauri in dev
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'tauri.localhost'],
  // Static export for Tauri production build
  ...(isTauri && {
    output: 'export',
    trailingSlash: true,
    distDir: 'out',
  }),
  eslint: {
    // Errori ESLint azzerati il 2026-06-11 — la build ora blocca sugli errori
    // (i warning non bloccano; il lint gira anche in CI come gate bloccante)
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Errori TS azzerati il 2026-06-11 — il build ora blocca su errori di tipo
    // (tsc --noEmit gira anche in CI come gate bloccante)
    ignoreBuildErrors: false,
  },
  // Bundle size optimizations
  compiler: {
    // Rimuovi console.log in produzione
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  experimental: {
    // Ottimizza pacchetti grandi — tree-shaking automatico
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'radix-ui',
      'framer-motion',
      'cmdk',
      'recharts',
      'class-variance-authority',
    ],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.akamai.steamstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'shared.akamai.steamstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.steamgriddb.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.steamgriddb.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.steampowered.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cloudflare.steamstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'store.steampowered.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Turbopack config (equivalente del webpack externals per winreg)
  turbopack: {
    resolveAlias: {
      winreg: { browser: './lib/winreg-stub.js' },
    },
  },
  webpack: (config, { isServer }) => {
    // Risolve l'errore 'Module not found: Can't resolve 'winreg''
    // Marcando 'winreg' come modulo esterno, diciamo a Webpack di non provare a includerlo nel bundle.
    // Questo è necessario per i pacchetti nativi di Node.js che non sono destinati al browser.
    if (isServer) {
      config.externals.push('winreg');
    }

    return config;
  },
};

module.exports = nextConfig;
