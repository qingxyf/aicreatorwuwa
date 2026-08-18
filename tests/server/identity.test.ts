import { describe, expect, test } from 'vitest';
import { verifyIdentity } from '../../server/identity';

describe('Node identity adapter', () => {
  test('accepts the development viewer header only in development mode', async () => {
    const payload = JSON.stringify({ id: 'dev-user', name: '开发者', avatarUrl: 'https://avatar.test/a.png' });
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
    await expect(verifyIdentity(new Request('https://api.test/session', { headers: { 'x-dev-viewer': encoded } }), { mode: 'development' })).resolves.toEqual(JSON.parse(payload));
  });

  test('rejects production requests without a verifier', async () => {
    await expect(verifyIdentity(new Request('https://api.test/session'), { mode: 'production' })).rejects.toThrow('identity_verifier_unconfigured');
  });

  test('can use an explicitly enabled Toy profile fallback without calling it a UID', async () => {
    const payload = JSON.stringify({ id: 'toy-open-id', name: 'Toy 用户', avatarUrl: 'https://avatar.test/toy.png' });
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
    await expect(verifyIdentity(new Request('https://api.test/session', { headers: { 'x-toy-profile': encoded } }), { mode: 'production', allowToyProfile: true })).resolves.toEqual(JSON.parse(payload));
  });
});
