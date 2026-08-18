import { describe, expect, test } from 'vitest';
import { D1RequestRateLimiter } from '../../src/adapters/worker/d1-request-rate-limiter';

describe('D1RequestRateLimiter', () => {
  test('uses one conditional upsert per viewer, route and fixed time window', async () => {
    const binds: unknown[][] = [];
    const database = {
      prepare: () => ({
        bind: (...values: unknown[]) => {
          binds.push(values);
          return { run: async () => ({ meta: { changes: 1 } }) };
        }
      })
    } as unknown as D1Database;
    const limiter = new D1RequestRateLimiter(database);

    await expect(limiter.consume('viewer-1', 'media-upload', { limit: 6, windowMs: 60_000 }, 125_000)).resolves.toBe(true);
    expect(binds).toEqual([['viewer-1', 'media-upload', 120_000, 1, 125_000, 6]]);
  });

  test('reports a rejected request when the database has reached the route cap', async () => {
    const database = {
      prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) })
    } as unknown as D1Database;
    const limiter = new D1RequestRateLimiter(database);

    await expect(limiter.consume('viewer-1', 'final-vote', { limit: 6, windowMs: 60_000 }, 125_000)).resolves.toBe(false);
  });
});
