import type { Viewer } from '../../types/platform';
import { ToyAccountClient, type ToySdk } from './account-client';

declare global {
  interface Window {
    toy?: Partial<ToySdk>;
    __TOY_IDENTITY_ASSERTION__?: string;
  }
}

export function readToyViewer(): Promise<Viewer> {
  if (typeof window === 'undefined' || typeof window.toy?.getUserProfile !== 'function') {
    return Promise.reject(new Error('请在哔哩哔哩 Toy 内打开后继续'));
  }
  return new ToyAccountClient({ getUserProfile: window.toy.getUserProfile.bind(window.toy) }).currentViewer();
}

export function identityHeaders(viewer: Viewer): HeadersInit {
  if (typeof window !== 'undefined' && window.__TOY_IDENTITY_ASSERTION__) {
    return { authorization: `Bearer ${window.__TOY_IDENTITY_ASSERTION__}` };
  }

  if (import.meta.env.DEV) {
    return { 'x-dev-viewer': btoa(unescape(encodeURIComponent(JSON.stringify(viewer)))) };
  }

  if (import.meta.env.VITE_TRUST_TOY_PROFILE === 'true') {
    return { 'x-toy-profile': btoa(unescape(encodeURIComponent(JSON.stringify(viewer)))) };
  }

  return {};
}
