import { describe, expect, test } from 'vitest';
import { canCreateSubmission } from '../../src/domain/submission';

describe('submission quota', () => {
  test('allows the first active submission in a track', () => {
    expect(canCreateSubmission(0)).toEqual({ allowed: true });
  });

  test('rejects a second active submission in the same track', () => {
    expect(canCreateSubmission(1)).toEqual({ allowed: false, reason: 'submission_limit' });
  });
});
