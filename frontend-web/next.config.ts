import type { NextConfig } from 'next';

const securityHeaders = [
  // Empêche le sniffing MIME (ex: servir un .js comme HTML)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Empêche l'intégration dans une iframe externe
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Limite les infos envoyées dans le header Referer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions : caméra/micro autorisés (WebRTC appels), géoloc désactivée
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
  // Désactive la détection XSS heuristique (obsolète mais utile IE/Edge legacy)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer && process.env.WATCHPACK_POLLING === 'true') {
      config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
    }
    return config;
  },
};

export default nextConfig;
