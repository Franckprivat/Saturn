import { createHmac } from 'crypto';
import { buildIceServers } from './ice-servers';

describe('buildIceServers', () => {
  it('renvoie seulement STUN sans TURN configuré', () => {
    const servers = buildIceServers('u1', {});
    expect(servers).toHaveLength(1);
    expect(JSON.stringify(servers)).not.toContain('turn:');
  });

  it('génère des identifiants temporaires avec TURN_SECRET', () => {
    const now = 1_700_000_000_000;
    const servers = buildIceServers(
      'u1',
      {
        TURN_URLS: 'turn:t.example:3478, http://ignored',
        TURN_SECRET: 's3cret',
        TURN_TTL: '60',
      },
      now,
    );
    const turn = servers[1];
    expect(turn.urls).toEqual(['turn:t.example:3478']);
    expect(turn.username).toBe(`${1_700_000_000 + 60}:u1`);
    expect(turn.credential).toBe(
      createHmac('sha1', 's3cret').update(turn.username!).digest('base64'),
    );
  });

  it('utilise les identifiants fixes à défaut de secret', () => {
    const servers = buildIceServers('u1', {
      TURN_URLS: 'turns:t.example:5349',
      TURN_USERNAME: 'saturn',
      TURN_CREDENTIAL: 'pw',
    });
    expect(servers[1]).toMatchObject({ username: 'saturn', credential: 'pw' });
  });
});
