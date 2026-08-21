import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const PASSWORD_SALT_BYTES = 16;

export interface OpsSession {
  token: string;
  expiresAt: string;
}

function toBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function deriveKey(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return scrypt(password, salt, SCRYPT_KEY_LENGTH, { N: n, r, p }) as Promise<Buffer>;
}

export async function hashOpsPassword(password: string): Promise<string> {
  if (!password) throw new Error('ops_password_required');
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const key = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${toBase64Url(salt)}$${toBase64Url(key)}`;
}

export async function verifyOpsPassword(password: string, encoded: string): Promise<boolean> {
  if (!password || !encoded) return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || n < 1 || r < 1 || p < 1) return false;
  try {
    const expected = fromBase64Url(parts[5]);
    const actual = await deriveKey(password, fromBase64Url(parts[4]), n, r, p);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function sessionPayload(expiresAt: number): string {
  return toBase64Url(Buffer.from(JSON.stringify({ purpose: 'ops', exp: expiresAt }), 'utf8'));
}

function sessionSignature(payload: string, secret: string): string {
  return toBase64Url(createHmac('sha256', secret).update(payload).digest());
}

export function issueOpsSession(secret: string, ttlSeconds: number, now = Date.now): OpsSession {
  if (!secret) throw new Error('ops_session_secret_required');
  const expiresAt = Math.floor(now() / 1000) + Math.max(60, Math.floor(ttlSeconds));
  const payload = sessionPayload(expiresAt);
  return { token: `${payload}.${sessionSignature(payload, secret)}`, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export function verifyOpsSession(token: string, secret: string, now = Date.now): boolean {
  if (!token || !secret) return false;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length > 0) return false;
  const expectedSignature = sessionSignature(payload, secret);
  const supplied = fromBase64Url(signature);
  const expected = fromBase64Url(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const parsed = JSON.parse(fromBase64Url(payload).toString('utf8')) as { purpose?: unknown; exp?: unknown };
    return parsed.purpose === 'ops' && typeof parsed.exp === 'number' && Number.isSafeInteger(parsed.exp) && parsed.exp > Math.floor(now() / 1000);
  } catch {
    return false;
  }
}
