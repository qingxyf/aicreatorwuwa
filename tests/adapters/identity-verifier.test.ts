import { describe, expect, test } from 'vitest';
import { verifyIdentity } from '../../src/adapters/worker/identity-verifier';

describe('identity verifier', () => {
  test('allows an explicit development identity only in development mode', async () => {
    const payload = JSON.stringify({ id: 'dev-user', name: '开发者', avatarUrl: 'https://avatar.test/a.png' });
    const encodedViewer = btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
    const request = new Request('https://worker.example/session', {
      headers: { 'x-dev-viewer': encodedViewer }
    });

    await expect(verifyIdentity(request, { mode: 'development' })).resolves.toEqual({
      id: 'dev-user',
      name: '开发者',
      avatarUrl: 'https://avatar.test/a.png'
    });
  });

  test('rejects production writes when a platform verification endpoint is absent', async () => {
    await expect(verifyIdentity(new Request('https://worker.example/session'), { mode: 'production' })).rejects.toThrow('identity_verifier_unconfigured');
  });
});
