import { api } from './api';

const FALLBACK: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let cached: { config: RTCConfiguration; at: number } | null = null;
const MAX_AGE = 60 * 60 * 1000; // 1 h (les identifiants TURN durent 24 h)

/** Serveurs ICE fournis par le backend (TURN compris s'il est configuré). */
export async function getIceConfig(): Promise<RTCConfiguration> {
  if (cached && Date.now() - cached.at < MAX_AGE) return cached.config;
  try {
    const res = await api.get<{ iceServers: RTCIceServer[] }>('/calls/ice-servers');
    if (Array.isArray(res.data?.iceServers) && res.data.iceServers.length) {
      cached = { config: { iceServers: res.data.iceServers }, at: Date.now() };
      return cached.config;
    }
  } catch { /* STUN public en secours */ }
  return FALLBACK;
}

/** Précharge la config pour qu'elle soit prête au moment de l'appel. */
export function prefetchIceConfig() {
  void getIceConfig();
}

/** Config disponible tout de suite : celle du backend si déjà chargée, sinon STUN. */
export function currentIceConfig(): RTCConfiguration {
  return cached?.config ?? FALLBACK;
}
