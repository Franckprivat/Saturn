import { TokenVerifier } from 'livekit-server-sdk';
import { createVoiceToken, getLiveKitConfig, voiceRoomName } from './livekit';

describe('LiveKit (salons vocaux)', () => {
  const env = {
    LIVEKIT_URL: 'wss://saturn.example.com/livekit',
    LIVEKIT_API_URL: 'http://livekit:7880',
    LIVEKIT_API_KEY: 'saturn',
    LIVEKIT_API_SECRET: 'un-secret-de-test-suffisamment-long-123',
  };

  it('est désactivé tant que la configuration est incomplète', () => {
    expect(getLiveKitConfig({})).toBeNull();
    expect(
      getLiveKitConfig({ ...env, LIVEKIT_API_SECRET: undefined }),
    ).toBeNull();
  });

  it("déduit l'adresse d'administration de l'adresse publique", () => {
    const config = getLiveKitConfig({ ...env, LIVEKIT_API_URL: undefined });
    expect(config?.apiUrl).toBe('https://saturn.example.com/livekit');
    expect(getLiveKitConfig(env)?.apiUrl).toBe('http://livekit:7880');
  });

  it('délivre un jeton limité au salon, micro seulement', async () => {
    const config = getLiveKitConfig(env)!;
    const jwt = await createVoiceToken(config, 'chan-1', {
      id: 'user-1',
      name: 'Alice',
    });
    const claims = await new TokenVerifier(
      env.LIVEKIT_API_KEY,
      env.LIVEKIT_API_SECRET,
    ).verify(jwt);
    expect(claims.sub).toBe('user-1');
    expect(claims.name).toBe('Alice');
    expect(claims.video?.room).toBe(voiceRoomName('chan-1'));
    expect(claims.video?.roomJoin).toBe(true);
    expect(claims.video?.canPublishData).toBe(false);
    expect(claims.video?.canPublishSources).toEqual(['microphone']);
    expect(claims.exp! - claims.nbf!).toBeLessThanOrEqual(600);
  });
});
