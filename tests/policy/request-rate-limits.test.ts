import { describe, expect, test } from 'vitest';
import { requestRateLimits } from '../../src/policy/request-rate-limits';

describe('request rate limits', () => {
  test('allows a multi-image submission to be retried within one minute', () => {
    expect(requestRateLimits['media-upload']).toEqual({ limit: 12, windowMs: 60_000 });
  });
});
