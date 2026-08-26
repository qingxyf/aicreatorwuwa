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
  const client = new ToyAccountClient({ getUserProfile: window.toy.getUserProfile.bind(window.toy) });
  return readViewerWithHostRetry(client);
}

async function readViewerWithHostRetry(client: ToyAccountClient): Promise<Viewer> {
  // toy-sdk.js performs a postMessage handshake with the Toy container. On a
  // cold page load the first user click can race that handshake, which makes
  // the SDK report "toy id not available on host" even inside a real Toy.
  // Retry briefly so the normal submission gesture is not lost to a startup
  // race; a page opened outside Toy still receives the actionable error below.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.currentViewer();
    } catch (error: unknown) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/toy id .*not available|not available on host/i.test(message) || attempt === 2) break;
      await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  if (/toy id .*not available|not available on host/i.test(message)) {
    throw new Error('请在哔哩哔哩 App 的 Toy 页面内打开后投稿；当前浏览器未接入 Toy 身份');
  }
  throw lastError instanceof Error ? lastError : new Error('Toy account identity is unavailable');
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
