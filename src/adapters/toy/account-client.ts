import type { AccountPort, ToyProfile, Viewer } from '../../types/platform';

export interface ToySdk {
  getUserProfile(): Promise<ToyProfile>;
}

export class ToyAccountClient implements AccountPort {
  constructor(private readonly sdk: ToySdk) {}

  async currentViewer(): Promise<Viewer> {
    const profile = await this.sdk.getUserProfile();
    if (!profile.toyOpenId) throw new Error('Toy account identity is unavailable');
    return {
      id: profile.toyOpenId,
      name: profile.nickname,
      avatarUrl: profile.avatar
    };
  }
}
