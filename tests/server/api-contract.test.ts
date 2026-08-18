import { describe, expect, test, vi } from 'vitest';
import { createServerApp } from '../../server/app';

function setup() {
  const pool = { query: vi.fn(async (sql: string) => sql.includes('SELECT 1') ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 }) } as never;
  const mediaStore = { save: vi.fn(), read: vi.fn() } as never;
  return createServerApp({ pool, mediaStore, mode: 'development', identity: { mode: 'development' }, publicAppOrigin: 'https://toy.example' });
}

describe('Node API contract', () => {
  test('exposes a health endpoint without authenticating', async () => {
    const response = await setup().request('http://api.test/healthz');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test('normalizes a Toy development viewer through the session endpoint', async () => {
    const payload = JSON.stringify({ id: 'viewer-1', name: '测试用户', avatarUrl: 'https://avatar.test/1.png' });
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
    const response = await setup().request('http://api.test/api/v1/session', { method: 'POST', headers: { 'x-dev-viewer': encoded } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(JSON.parse(payload));
  });
});
