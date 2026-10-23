/**
 * Tests d'intégration des règles d'accès : vrai serveur (dist/src/main.js),
 * vraie base Postgres, vrai better-auth. Prérequis : `npm run build`, une base
 * de test migrée (`npx prisma migrate deploy`) et DATABASE_URL,
 * BETTER_AUTH_DATABASE_URL, BETTER_AUTH_SECRET définis. Puis `npm run test:e2e`.
 */
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { Pool } from 'pg';

jest.setTimeout(60_000);

type Agent = { id: string; cookie: string };

const PORT = Number(process.env.E2E_PORT ?? 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3000';

async function waitForServer(server: ChildProcess) {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Le serveur a quitté');
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Serveur injoignable');
}

describe('Règles d’accès (intégration)', () => {
  let server: ChildProcess;
  let pool: Pool;
  const http = BASE;
  const run = randomUUID().slice(0, 8);

  async function signUp(name: string): Promise<Agent> {
    const res = await request(http)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({
        email: `${name}-${run}@test.local`,
        password: 'motdepasse-solide-123',
        name,
        nickname: name,
      })
      .expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return {
      id: (res.body as { user: { id: string } }).user.id,
      cookie: cookies.map((c) => c.split(';')[0]).join('; '),
    };
  }

  const as = (a: Agent) => ({
    get: (url: string) => request(http).get(url).set('Cookie', a.cookie),
    post: (url: string, body?: object) =>
      request(http).post(url).set('Cookie', a.cookie).send(body),
    patch: (url: string, body?: object) =>
      request(http).patch(url).set('Cookie', a.cookie).send(body),
    delete: (url: string) => request(http).delete(url).set('Cookie', a.cookie),
  });

  async function befriend(a: Agent, b: Agent) {
    const req = await as(a)
      .post('/friends/requests', { addresseeId: b.id })
      .expect(201);
    await as(b)
      .post(`/friends/requests/${(req.body as { id: string }).id}/accept`)
      .expect(201);
  }

  let alice: Agent, bob: Agent, carol: Agent;
  let groupId: string;

  beforeAll(async () => {
    const entry = join(__dirname, '..', 'dist', 'src', 'main.js');
    if (!existsSync(entry)) throw new Error('Lancer `npm run build` avant');
    for (const key of [
      'DATABASE_URL',
      'BETTER_AUTH_DATABASE_URL',
      'BETTER_AUTH_SECRET',
    ]) {
      if (!process.env[key])
        throw new Error(`${key} manquant pour les tests d'intégration`);
    }
    server = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        PORT: String(PORT),
        ALLOWED_ORIGINS: ORIGIN,
        BETTER_AUTH_URL: BASE,
        SMTP_USER: '',
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    await waitForServer(server);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    alice = await signUp('alice');
    bob = await signUp('bob');
    carol = await signUp('carol');
    await befriend(alice, bob);
    await befriend(alice, carol);

    const group = await as(alice)
      .post('/conversations/group', { name: 'Projet', memberIds: [bob.id] })
      .expect(201);
    groupId = (group.body as { id: string }).id;
  });

  afterAll(async () => {
    await pool?.end();
    server?.kill();
  });

  it('refuse toute route sans session, sauf les routes publiques', async () => {
    await request(http).get('/conversations').expect(401);
    await request(http).get('/users/me').expect(401);
    await request(http).post('/upload').expect(401);
    await request(http).get('/health').expect(200);
  });

  it('ignore les champs non autorisés sur le profil (mass assignment)', async () => {
    const res = await as(alice)
      .patch('/users/me', {
        email: 'pirate@evil.test',
        emailVerified: true,
        bio: 'ok',
      })
      .expect(200);
    const me = await as(alice).get('/users/me').expect(200);
    expect((me.body as { email: string }).email).toBe(
      `alice-${run}@test.local`,
    );
    expect((res.body as { bio: string }).bio).toBe('ok');
  });

  it("interdit l'accès à un groupe dont on n'est pas membre", async () => {
    await as(carol).get(`/conversations/${groupId}`).expect(403);
    await as(carol).get(`/conversations/${groupId}/messages`).expect(403);
  });

  it("n'expose pas les e-mails des autres membres", async () => {
    const res = await as(bob).get(`/conversations/${groupId}`).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('@test.local');
  });

  it('ne montre un chuchotement qu’à ses destinataires', async () => {
    await as(alice)
      .post(`/conversations/${groupId}/members`, { memberIds: [carol.id] })
      .expect(201);
    // L'envoi passe par le socket : on insère le chuchotement directement en base
    await pool.query(
      `INSERT INTO "Message" (id, content, "senderId", "conversationId", "whisperTo", "isWhisper")
       VALUES ($1, 'secret pour Bob', $2, $3, $4, true)`,
      [randomUUID(), alice.id, groupId, [bob.id]],
    );

    const seenBy = async (a: Agent) => {
      const res = await as(a)
        .get(`/conversations/${groupId}/messages`)
        .expect(200);
      return JSON.stringify(res.body).includes('secret pour Bob');
    };
    expect(await seenBy(bob)).toBe(true);
    expect(await seenBy(alice)).toBe(true);
    expect(await seenBy(carol)).toBe(false);
  });

  it('protège le créateur du groupe face aux autres admins', async () => {
    await as(alice)
      .patch(`/conversations/${groupId}/members/${bob.id}/role`, {
        role: 'ADMIN',
      })
      .expect(200);
    await as(bob)
      .delete(`/conversations/${groupId}/members/${alice.id}`)
      .expect(403);
    await as(bob)
      .patch(`/conversations/${groupId}/members/${alice.id}/role`, {
        role: 'MEMBER',
      })
      .expect(403);
    await as(bob).delete(`/conversations/${groupId}`).expect(403);
    // Un admin peut toujours gérer un simple membre
    await as(bob)
      .delete(`/conversations/${groupId}/members/${carol.id}`)
      .expect(200);
  });

  it('trie les conversations par dernier message (trigger SQL)', async () => {
    const other = await as(alice)
      .post('/conversations/group', { name: 'Autre', memberIds: [bob.id] })
      .expect(201);
    const otherId = (other.body as { id: string }).id;
    let list = await as(alice).get('/conversations').expect(200);
    expect((list.body as { id: string }[])[0].id).toBe(otherId);

    await pool.query(
      `INSERT INTO "Message" (id, content, "senderId", "conversationId") VALUES ($1, 'relance', $2, $3)`,
      [randomUUID(), bob.id, groupId],
    );
    list = await as(alice).get('/conversations?limit=1').expect(200);
    expect((list.body as { id: string }[]).map((c) => c.id)).toEqual([groupId]);
    await as(alice).get('/conversations?limit=0').expect(400);
  });

  it('valide les entrées (DTO) et rejette les rôles inconnus', async () => {
    await as(alice)
      .patch(`/conversations/${groupId}/members/${bob.id}/role`, {
        role: 'OWNER',
      })
      .expect(400);
    await as(alice)
      .post('/conversations/group', { name: '', memberIds: [] })
      .expect(400);
  });

  it("empêche un banni de revenir par un lien d'invitation", async () => {
    const community = await as(alice)
      .post('/communities', { name: `Club ${run}` })
      .expect(201);
    const communityId = (community.body as { id: string }).id;
    const link = await as(alice)
      .post(`/communities/${communityId}/invite-links`, {})
      .expect(201);
    const token = (link.body as { token: string }).token;

    await as(carol)
      .post(`/community-invitations/link/${token}/join`, {})
      .expect(201);
    await as(alice)
      .post(`/communities/${communityId}/bans`, { userId: carol.id })
      .expect(201);
    await as(carol)
      .post(`/community-invitations/link/${token}/join`, {})
      .expect(403);
    await as(carol).post(`/communities/join/${token}`, {}).expect(403);
    await as(carol).get(`/communities/${communityId}`).expect(403);
  });
});
