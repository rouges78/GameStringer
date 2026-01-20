/** @type {import('next').NextConfig} */
const isTauri = process.env.TAURI === 'true';

const nextConfig = {
  // Disabilita Next.js Dev Tools indicator
  devIndicators: false,
  // Permetti richieste cross-origin da Tauri in dev
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'tauri.localhost'],
  ...(isTauri && {
    output: 'export',
    trailingSlash: true,
    distDir: 'out',
  }),
  eslint: {
    // Disabilita ESLint durante il build per velocizzare la compilazione
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disabilita type checking durante il build per velocizzare la compilazione
    ignoreBuildErrors: true,
  },
  // Bundle size optimizations
  compiler: {
    // Rimuovi console.log in produzione
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  experimental: {
    // Ottimizza pacchetti grandi
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      '@tabler/icons-react',
    ],
  },
  // Modularize imports per ridurre bundle
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
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
    ],
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
