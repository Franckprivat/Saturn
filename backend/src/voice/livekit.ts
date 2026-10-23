import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from 'livekit-server-sdk';

/**
 * Salons vocaux des communautés : l'audio passe par un serveur média LiveKit
 * (SFU). Chaque participant envoie sa voix une seule fois au serveur, qui la
 * redistribue : la charge ne grandit plus avec le carré du nombre de personnes
 * comme en mesh, et un salon tient bien plus de 6 personnes.
 */
export interface LiveKitConfig {
  /** Adresse vue par le navigateur (ws(s)://… ou http(s)://…) */
  publicUrl: string;
  /** Adresse interne du serveur pour l'API d'administration */
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
}

export function getLiveKitConfig(
  env: NodeJS.ProcessEnv = process.env,
): LiveKitConfig | null {
  const publicUrl = env.LIVEKIT_URL;
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  if (!publicUrl || !apiKey || !apiSecret) return null;
  return {
    publicUrl,
    apiUrl: (env.LIVEKIT_API_URL || publicUrl).replace(/^ws/, 'http'),
    apiKey,
    apiSecret,
  };
}

export const voiceRoomName = (channelId: string) => `voice-${channelId}`;

/** Jeton d'accès à un salon : valable 10 min pour se connecter, audio seulement. */
export async function createVoiceToken(
  config: LiveKitConfig,
  channelId: string,
  user: { id: string; name: string },
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: user.id,
    name: user.name,
    ttl: '10m',
  });
  token.addGrant({
    room: voiceRoomName(channelId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canPublishSources: [TrackSource.MICROPHONE],
  });
  return token.toJwt();
}

/** Retire un utilisateur d'un salon (exclusion ou bannissement de la communauté). */
export async function removeFromVoiceRoom(
  config: LiveKitConfig,
  channelId: string,
  userId: string,
): Promise<void> {
  const rooms = new RoomServiceClient(
    config.apiUrl,
    config.apiKey,
    config.apiSecret,
  );
  await rooms.removeParticipant(voiceRoomName(channelId), userId);
}
