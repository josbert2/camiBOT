import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@camibot/db', '@camibot/core', '@camibot/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    return [
      { source: '/wz', destination: '/wz/index.html' },
    ];
  },
};

export default config;
