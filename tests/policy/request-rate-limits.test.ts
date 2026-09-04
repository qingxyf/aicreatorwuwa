import { describe, expect, test } from 'vitest';
import { requestRateLimits } from '../../src/policy/request-rate-limits';

describe('request rate limits', () => {
  test('allows several multi-image submissions to be retried within one minute', () => {
    expect(requestRateLimits['media-upload']).toEqual({ limit: 20, windowMs: 60_000 });
  });
});
