import { describe, expect, test, vi } from 'vitest';
import { hasMatchingMediaSignature, mediaObjectHeaders, OssMediaStore } from '../../server/oss';

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

  test('fails closed when a recorded legacy object is missing during hardening', async () => {
    const missing = Object.assign(new Error('missing'), { code: 'NoSuchKey' });
    const client = { get: vi.fn(async () => { throw missing; }), put: vi.fn() };
    const store = new OssMediaStore({ region: 'oss-test', bucket: 'test', accessKeyId: 'id', accessKeySecret: 'secret' }, client as never);

    await expect(store.rewritePrivate('missing-media')).rejects.toBe(missing);
    expect(client.put).not.toHaveBeenCalled();
  });

  test('counts a rewrite only after the private object PUT succeeds', async () => {
    const client = {
      get: vi.fn(async () => ({ content: Buffer.from('image'), res: { headers: { 'content-type': 'image/png' } } })),
      put: vi.fn(async () => ({ name: 'media-a' }))
    };
    const store = new OssMediaStore({ region: 'oss-test', bucket: 'test', accessKeyId: 'id', accessKeySecret: 'secret' }, client as never);

    await expect(store.rewritePrivate('media-a')).resolves.toBeUndefined();
    expect(client.put).toHaveBeenCalledWith('media-a', Buffer.from('image'), { headers: mediaObjectHeaders('image/png') });
  });
});
