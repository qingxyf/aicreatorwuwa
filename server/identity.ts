import type { Viewer } from '../src/types/platform';

export interface IdentityOptions {
  mode: 'development' | 'production';
  verificationUrl?: string;
  verificationSecret?: string;
  fetcher?: typeof fetch;
  allowToyProfile?: boolean;
}

function isViewer(value: unknown): value is Viewer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Viewer>;
  return typeof candidate.id === 'string' && candidate.id.length <= 128
    && typeof candidate.name === 'string' && candidate.name.length <= 80
    && typeof candidate.avatarUrl === 'string' && candidate.avatarUrl.length <= 2048;
}

export async function verifyIdentity(request: Request, options: IdentityOptions): Promise<Viewer> {
  if (options.mode === 'development') {
    const encoded = request.headers.get('x-dev-viewer');
    if (encoded) {
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))));
        if (isViewer(parsed)) return parsed;
      } catch {
        // Fall through to the production verifier so malformed development data is never trusted.
      }
    }
  }

  if (options.allowToyProfile) {
    const encoded = request.headers.get('x-toy-profile');
    if (encoded) {
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))));
        if (isViewer(parsed)) return parsed;
      } catch {
        // Invalid profile data is rejected below; never fall back to arbitrary IDs.
      }
    }
  }

  if (!options.verificationUrl) throw new Error('identity_verifier_unconfigured');
  const assertion = request.headers.get('authorization');
  if (!assertion) throw new Error('identity_assertion_missing');
  const response = await (options.fetcher ?? fetch)(options.verificationUrl, {
    method: 'POST',
    headers: {
      authorization: assertion,
      ...(options.verificationSecret ? { 'x-identity-verifier-secret': options.verificationSecret } : {})
    }
  });
  if (!response.ok) throw new Error('identity_assertion_rejected');
  const verified: unknown = await response.json();
  if (!isViewer(verified)) throw new Error('identity_assertion_invalid');
  return verified;
}
