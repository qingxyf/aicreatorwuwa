import type { Viewer } from '../../types/platform';

export interface IdentityVerifierOptions {
  mode: 'development' | 'production';
  verificationUrl?: string;
  verificationSecret?: string;
  fetcher?: typeof fetch;
}

function isViewer(value: unknown): value is Viewer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Viewer>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.avatarUrl === 'string';
}

export async function verifyIdentity(request: Request, options: IdentityVerifierOptions): Promise<Viewer> {
  if (options.mode === 'development') {
    const developmentViewer = request.headers.get('x-dev-viewer');
    if (developmentViewer) {
      const bytes = Uint8Array.from(atob(developmentViewer), (character) => character.charCodeAt(0));
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (isViewer(parsed)) return parsed;
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
