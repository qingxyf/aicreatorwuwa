import { describe, expect, test } from 'vitest';
import { issueMediaAccessGrant, verifyMediaAccessGrant } from '../../server/media-access';

describe('operator media access grants', () => {
  test('binds a short-lived grant to one media object', () => {
    const now = () => Date.parse('2026-08-26T00:00:00.000Z');
    const grant = issueMediaAccessGrant('media-a', 'test-secret', 60, now);

    expect(verifyMediaAccessGrant('media-a', grant.expires, grant.signature, 'test-secret', now)).toBe(true);
    expect(verifyMediaAccessGrant('media-b', grant.expires, grant.signature, 'test-secret', now)).toBe(false);
    expect(verifyMediaAccessGrant('media-a', grant.expires, grant.signature, 'wrong-secret', now)).toBe(false);
  });

  test('rejects an expired grant', () => {
    const grant = issueMediaAccessGrant('media-a', 'test-secret', 60, () => 1_000_000);
    expect(verifyMediaAccessGrant('media-a', grant.expires, grant.signature, 'test-secret', () => 1_061_000)).toBe(false);
  });
});
