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
});
