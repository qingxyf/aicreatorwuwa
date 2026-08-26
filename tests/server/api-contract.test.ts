import { describe, expect, test, vi } from 'vitest';
import { createServerApp } from '../../server/app';
import { hashOpsPassword } from '../../server/ops-auth';

async function setup() {
  const pool = { query: vi.fn(async (sql: string) => sql.includes('SELECT 1') ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 }) } as never;
  const mediaStore = { save: vi.fn(), read: vi.fn() } as never;
  return createServerApp({
    pool,
    mediaStore,
    mode: 'development',
    identity: { mode: 'development' },
    opsAuth: { passwordHash: await hashOpsPassword('test-ops-password'), sessionSecret: 'test-session-secret' },
    publicAppOrigin: 'https://toy.example'
  });
}

const mediaId = '11111111-1111-4111-8111-111111111111';

describe('Node API contract', () => {
  test('exposes a health endpoint without authenticating', async () => {
    const response = await (await setup()).request('http://api.test/healthz');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test('normalizes a Toy development viewer through the session endpoint', async () => {
    const payload = JSON.stringify({ id: 'viewer-1', name: '测试用户', avatarUrl: 'https://avatar.test/1.png' });
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
    const response = await (await setup()).request('http://api.test/api/v1/session', { method: 'POST', headers: { 'x-dev-viewer': encoded } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(JSON.parse(payload));
  });

  test('returns a session token for the configured operations password', async () => {
    const response = await (await setup()).request('http://api.test/api/v1/ops/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-ops-password' })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ token: expect.any(String), expiresAt: expect.any(String) });
  });

  test('rejects an incorrect operations password without revealing configuration details', async () => {
    const response = await (await setup()).request('http://api.test/api/v1/ops/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'operator_login_failed' });
  });

  test('requires a valid operations session for the protected submission list', async () => {
    const app = await setup();
    const withoutToken = await app.request('http://api.test/api/v1/ops/submissions');
    expect(withoutToken.status).toBe(401);

    const login = await app.request('http://api.test/api/v1/ops/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-ops-password' })
    });
    const { token } = await login.json() as { token: string };
    const withToken = await app.request('http://api.test/api/v1/ops/submissions', { headers: { authorization: `Bearer ${token}` } });
    expect(withToken.status).toBe(200);
    await expect(withToken.json()).resolves.toEqual([]);
  });

  test('does not read or expose media that belongs only to an unapproved submission', async () => {
    const read = vi.fn(async () => ({ content: new Uint8Array([1, 2, 3]), type: 'image/png' }));
    const pool = { query: vi.fn(async (sql: string) => sql.includes('AS is_public') ? { rows: [{ is_public: false }], rowCount: 1 } : { rows: [], rowCount: 0 }) } as never;
    const app = createServerApp({
      pool,
      mediaStore: { save: vi.fn(), read } as never,
      mode: 'development',
      identity: { mode: 'development' }
    });

    const response = await app.request(`http://api.test/api/v1/media/${mediaId}`);
    expect(response.status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });

  test('serves public media with immutable caching', async () => {
    const read = vi.fn(async () => ({ content: new Uint8Array([1, 2, 3]), type: 'image/png' }));
    const pool = { query: vi.fn(async (sql: string) => sql.includes('AS is_public') ? { rows: [{ is_public: true }], rowCount: 1 } : { rows: [], rowCount: 0 }) } as never;
    const app = createServerApp({
      pool,
      mediaStore: { save: vi.fn(), read } as never,
      mode: 'development',
      identity: { mode: 'development' }
    });

    const response = await app.request(`http://api.test/api/v1/media/${mediaId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(read).toHaveBeenCalledWith(mediaId);
  });

  test('gives authenticated operators a short-lived private preview URL for pending media', async () => {
    const read = vi.fn(async () => ({ content: new Uint8Array([1, 2, 3]), type: 'image/png' }));
    const pool = { query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM submissions s ORDER BY')) return {
        rows: [{ id: 'submission-1', track_id: 'resonance-style', title: '待审核作品', author_name: '作者', author_avatar: '', media_json: [mediaId], final_votes: '0', status: 'pending', is_displayed: false, pairing_wins: '0', exposure_count: '0', created_at: '2026-08-26T00:00:00.000Z' }],
        rowCount: 1
      };
      if (sql.includes('FROM media_objects WHERE id = ANY')) return { rows: [{ id: mediaId, mime_type: 'image/png' }], rowCount: 1 };
      if (sql.includes('AS is_public')) return { rows: [{ is_public: false }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }) } as never;
    const app = createServerApp({
      pool,
      mediaStore: { save: vi.fn(), read } as never,
      mode: 'development',
      identity: { mode: 'development' },
      mediaBaseUrl: 'http://api.test',
      opsAuth: { passwordHash: await hashOpsPassword('test-ops-password'), sessionSecret: 'test-session-secret' }
    });
    const login = await app.request('http://api.test/api/v1/ops/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-ops-password' })
    });
    const { token } = await login.json() as { token: string };
    const list = await app.request('http://api.test/api/v1/ops/submissions', { headers: { authorization: `Bearer ${token}` } });
    const [submission] = await list.json() as Array<{ media: Array<{ url: string }> }>;
    const previewUrl = submission.media[0].url;

    expect(previewUrl).toContain(`api/v1/media/${mediaId}?`);
    expect(previewUrl).not.toContain(token);
    const preview = await app.request(previewUrl);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('cache-control')).toBe('private, no-store');
  });
});
