import { describe, expect, test } from 'vitest';
import { hasMatchingMediaSignature, mediaObjectHeaders } from '../../server/oss';

function file(type: string, bytes: number[]): File {
  return { type, slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) } as unknown as File;
}

describe('Alibaba OSS media validation', () => {
  test('accepts a PNG signature only when the declared type matches', async () => {
    await expect(hasMatchingMediaSignature(file('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).resolves.toBe(true);
    await expect(hasMatchingMediaSignature(file('image/png', [0, 1, 2, 3]))).resolves.toBe(false);
  });

  test('stores uploaded objects as private even when the bucket permits public reads', () => {
    expect(mediaObjectHeaders('image/png')).toMatchObject({
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'x-oss-object-acl': 'private'
    });
  });
});
