import { describe, expect, test, vi } from 'vitest';
import { R2MediaStore } from '../../src/adapters/worker/r2-media-store';

describe('R2MediaStore', () => {
  test('rejects a file whose bytes do not match its declared media type', async () => {
    const bucket = { put: vi.fn() } as unknown as R2Bucket;
    const store = new R2MediaStore(bucket, 'https://media.test');
    const forgedPng = {
      type: 'image/png',
      size: 20,
      slice: () => ({ arrayBuffer: async () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer }),
      stream: vi.fn()
    } as unknown as File;

    await expect(store.save(forgedPng)).rejects.toThrow('invalid_media_signature');
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
