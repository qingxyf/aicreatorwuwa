import { describe, expect, test } from 'vitest';
import { ToyAccountClient } from '../../src/adapters/toy/account-client';

describe('ToyAccountClient', () => {
  test('maps the official Toy user profile to an app viewer', async () => {
    const account = new ToyAccountClient({
      getUserProfile: async () => ({
        nickname: '漂泊者',
        avatar: 'https://i0.hdslb.com/avatar.png',
        toyOpenId: 'toy-open-id'
      })
    });

    await expect(account.currentViewer()).resolves.toEqual({
      id: 'toy-open-id',
      name: '漂泊者',
      avatarUrl: 'https://i0.hdslb.com/avatar.png'
    });
  });

  test('rejects a profile without the opaque Toy identity', async () => {
    const account = new ToyAccountClient({
      getUserProfile: async () => ({ nickname: '漂泊者', avatar: 'https://i0.hdslb.com/avatar.png' })
    });

    await expect(account.currentViewer()).rejects.toThrow('Toy account identity is unavailable');
  });
});
