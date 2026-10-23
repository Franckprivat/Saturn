import { createHmac } from 'crypto';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN: IceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/**
 * Serveurs ICE pour WebRTC. STUN suffit sur la plupart des réseaux ; un relais
 * TURN est indispensable derrière les NAT stricts (4G, entreprises).
 *
 * - TURN_URLS : liste séparée par des virgules (ex. `turn:turn.exemple.fr:3478,turns:turn.exemple.fr:5349`)
 * - TURN_SECRET : secret partagé coturn (`use-auth-secret`) → identifiants
 *   temporaires (REST API TURN), valables `TURN_TTL` secondes (24 h par défaut)
 * - sinon TURN_USERNAME / TURN_CREDENTIAL : identifiants fixes
 */
export function buildIceServers(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): IceServer[] {
  const urls = (env.TURN_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^turns?:/.test(u));
  if (!urls.length) return DEFAULT_STUN;

  if (env.TURN_SECRET) {
    const ttl = Number(env.TURN_TTL) > 0 ? Number(env.TURN_TTL) : 86_400;
    const username = `${Math.floor(now / 1000) + ttl}:${userId}`;
    const credential = createHmac('sha1', env.TURN_SECRET)
      .update(username)
      .digest('base64');
    return [...DEFAULT_STUN, { urls, username, credential }];
  }
  if (env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    return [
      ...DEFAULT_STUN,
      { urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL },
    ];
  }
  return DEFAULT_STUN;
}
