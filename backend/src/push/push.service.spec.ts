import { getVapidConfig } from './push.service';

describe('PushService', () => {
  it('reste désactivé sans clés VAPID', () => {
    expect(getVapidConfig({})).toBeNull();
    expect(getVapidConfig({ VAPID_PUBLIC_KEY: 'pub' })).toBeNull();
  });

  it('utilise un sujet par défaut', () => {
    expect(
      getVapidConfig({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }),
    ).toEqual({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:admin@saturn.local',
    });
  });
});
