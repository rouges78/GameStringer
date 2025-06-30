/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
