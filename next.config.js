/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.akamai.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.steamgriddb.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.steamgriddb.com',
      },
      {
        protocol: 'https',
        hostname: 'media.steampowered.com',
      },
    ],
  },
};

module.exports = nextConfig;
