import { describe, expect, test } from 'vitest';
import { hashOpsPassword, issueOpsSession, verifyOpsPassword, verifyOpsSession } from '../../server/ops-auth';

describe('operations authentication primitives', () => {
  test('accepts the configured password and rejects a different password', async () => {
    const encoded = await hashOpsPassword('LFisSc8MX4xEKzPX');

    await expect(verifyOpsPassword('LFisSc8MX4xEKzPX', encoded)).resolves.toBe(true);
    await expect(verifyOpsPassword('wrong-password', encoded)).resolves.toBe(false);
  });

  test('verifies a signed operations session before expiry', () => {
    const now = 1_750_000_000_000;
    const session = issueOpsSession('test-session-secret', 60, () => now);

    expect(verifyOpsSession(session.token, 'test-session-secret', () => now + 59_000)).toBe(true);
    expect(verifyOpsSession(session.token, 'different-secret', () => now + 59_000)).toBe(false);
  });

  test('rejects tampered and expired operations sessions', () => {
    const now = 1_750_000_000_000;
    const session = issueOpsSession('test-session-secret', 60, () => now);
    const tampered = `${session.token.slice(0, -1)}${session.token.endsWith('a') ? 'b' : 'a'}`;

    expect(verifyOpsSession(tampered, 'test-session-secret', () => now)).toBe(false);
    expect(verifyOpsSession(session.token, 'test-session-secret', () => now + 60_000)).toBe(false);
  });
});
