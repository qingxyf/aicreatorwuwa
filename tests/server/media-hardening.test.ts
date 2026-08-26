import { describe, expect, test, vi } from 'vitest';
import { hardenExistingMedia } from '../../server/media-hardening';

describe('existing media hardening', () => {
  test('rewrites every recorded media object as object-level private', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 'media-a' }, { id: 'media-b' }], rowCount: 2 }));
    const rewritePrivate = vi.fn(async () => undefined);

    await expect(hardenExistingMedia({ query } as never, { rewritePrivate })).resolves.toBe(2);
    expect(query).toHaveBeenCalledWith('SELECT id FROM media_objects ORDER BY created_at, id');
    expect(rewritePrivate.mock.calls).toEqual([['media-a'], ['media-b']]);
  });

  test('stops without reporting success when an OSS rewrite fails', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 'media-a' }], rowCount: 1 }));
    const rewritePrivate = vi.fn(async () => { throw new Error('oss_unavailable'); });

    await expect(hardenExistingMedia({ query } as never, { rewritePrivate })).rejects.toThrow('oss_unavailable');
  });
});
