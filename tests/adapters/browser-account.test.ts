import { afterEach, describe, expect, test } from 'vitest';
import { readToyViewer } from '../../src/adapters/toy/browser-account';

afterEach(() => {
  window.toy = undefined;
});

describe('readToyViewer', () => {
  test('explains when the Toy SDK is loaded outside its Bilibili host', async () => {
    window.toy = {
      getUserProfile: async () => {
        throw new Error('[ToySDK] toy id not available on host');
      }
    };

    await expect(readToyViewer()).rejects.toThrow('请在哔哩哔哩 App 的 Toy 页面内打开后投稿');
  });

  test('retries a cold Toy host handshake before failing', async () => {
    let calls = 0;
    window.toy = {
      getUserProfile: async () => {
        calls += 1;
        if (calls < 2) throw new Error('[ToySDK] toy id not available on host');
        return { nickname: '漂泊者', avatar: 'https://i0.hdslb.com/avatar.png', toyOpenId: 'toy-open-id' };
      }
    };

    await expect(readToyViewer()).resolves.toEqual({
      id: 'toy-open-id',
      name: '漂泊者',
      avatarUrl: 'https://i0.hdslb.com/avatar.png'
    });
    expect(calls).toBe(2);
  });
});
