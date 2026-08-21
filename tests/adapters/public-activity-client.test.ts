import { afterEach, describe, expect, test, vi } from 'vitest';
import { PublicActivityClient } from '../../src/adapters/http/public-activity-client';

describe('PublicActivityClient fetch binding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('invokes the platform fetch with its global receiver', async () => {
    const nativeFetch = globalThis.fetch;
    const fetchSpy = vi.fn(function (this: unknown, input: RequestInfo | URL) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      expect(String(input)).toBe('https://api.test/api/v1/config');
      return Promise.resolve(new Response(JSON.stringify({ phase: 'submission' }), { status: 200 }));
    });
    globalThis.fetch = fetchSpy as typeof fetch;

    try {
      const client = new PublicActivityClient('https://api.test');
      await expect(client.loadConfig()).resolves.toEqual({ phase: 'submission' });
      expect(fetchSpy).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = nativeFetch;
    }
  });
});
