import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MediaAccessGrant {
  expires: string;
  signature: string;
}

function signatureFor(mediaId: string, expires: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${mediaId}.${expires}`).digest();
}

export function issueMediaAccessGrant(mediaId: string, secret: string, ttlSeconds: number, now = Date.now): MediaAccessGrant {
  if (!mediaId || !secret) throw new Error('media_access_grant_unconfigured');
  const expires = String(Math.floor(now() / 1000) + Math.max(1, Math.floor(ttlSeconds)));
  return { expires, signature: signatureFor(mediaId, expires, secret).toString('base64url') };
}

export function verifyMediaAccessGrant(mediaId: string, expires: string | undefined, signature: string | undefined, secret: string | undefined, now = Date.now): boolean {
  if (!mediaId || !expires || !signature || !secret || !/^\d+$/.test(expires)) return false;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now() / 1000)) return false;
  try {
    const supplied = Buffer.from(signature, 'base64url');
    const expected = signatureFor(mediaId, expires, secret);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}
