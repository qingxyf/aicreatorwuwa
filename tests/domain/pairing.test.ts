import { describe, expect, test } from 'vitest';
import { selectBalancedPair } from '../../src/domain/pairing';

const entries = [
  { id: 'work-a', exposureCount: 8, status: 'approved' as const },
  { id: 'work-b', exposureCount: 7, status: 'approved' as const },
  { id: 'work-c', exposureCount: 2, status: 'approved' as const },
  { id: 'work-d', exposureCount: 1, status: 'approved' as const }
];

describe('balanced first-stage pairing', () => {
  test('selects the two least exposed eligible entries', () => {
    expect(selectBalancedPair(entries, new Set())).toEqual(['work-d', 'work-c']);
  });

  test('does not offer a work that the voter already compared', () => {
    expect(selectBalancedPair(entries, new Set(['work-d']))).toEqual(['work-c', 'work-b']);
  });
});
