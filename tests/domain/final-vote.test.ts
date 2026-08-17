import { describe, expect, test } from 'vitest';
import { validateFinalVote } from '../../src/domain/final-vote';

describe('second-stage daily voting', () => {
  test('allows a new work while fewer than three votes exist', () => {
    expect(validateFinalVote(['work-a', 'work-b'], 'work-c')).toEqual({ allowed: true, remainingAfter: 0 });
  });

  test('rejects a duplicate work', () => {
    expect(validateFinalVote(['work-a'], 'work-a')).toEqual({ allowed: false, reason: 'duplicate_work' });
  });

  test('rejects a fourth daily vote in the same track', () => {
    expect(validateFinalVote(['work-a', 'work-b', 'work-c'], 'work-d')).toEqual({ allowed: false, reason: 'daily_limit' });
  });
});
