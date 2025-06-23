const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
    images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.steamgriddb.com',
        port: '',
        pathname: '/grid/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.steamgriddb.com',
        port: '',
        pathname: '/grid/**',
      },
    ],
  },
};

module.exports = nextConfig;
