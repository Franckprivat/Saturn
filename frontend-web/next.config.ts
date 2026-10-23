import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/** Origines (http + ws) de l'API, de l'auth et du socket, déduites de l'environnement. */
function backendOrigins(): string[] {
  const urls = [
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    process.env.NEXT_PUBLIC_AUTH_URL,
    process.env.NEXT_PUBLIC_SOCKET_URL,
  ];
  const origins = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    try {
      const { origin, protocol, host } = new URL(raw);
      origins.add(origin);
      origins.add(`${protocol === 'https:' ? 'wss' : 'ws'}://${host}`);
    } catch { /* URL invalide : ignorée */ }
  }
  return [...origins];
}

const backend = backendOrigins().join(' ');

// CSP : scripts uniquement depuis l'app (le script inline du thème et ceux de
// Next imposent 'unsafe-inline' sans nonce), aucun plugin, pas d'iframe externe.
// Images et médias : app, API (/uploads), blob: (aperçus) et https (avatars, R2).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${backend}`,
  `media-src 'self' blob: https: ${backend}`,
  "font-src 'self' data:",
  `connect-src 'self' ${backend}${isDev ? ' ws: http://localhost:*' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Empêche le sniffing MIME (ex: servir un .js comme HTML)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Empêche l'intégration dans une iframe externe (doublé par frame-ancestors)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Limite les infos envoyées dans le header Referer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions : caméra/micro autorisés (WebRTC appels), géoloc désactivée
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
  // HTTPS forcé pendant un an (ignoré par les navigateurs tant que le site est en HTTP)
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
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
