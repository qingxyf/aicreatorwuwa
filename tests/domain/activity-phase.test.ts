import { describe, expect, test } from 'vitest';
import { isPublicPhaseVisible } from '../../src/domain/activity-phase';

describe('public activity phase visibility', () => {
  test('shows only the active public phase outside of operations preview mode', () => {
    expect(isPublicPhaseVisible('final-vote', false, 'submission')).toBe(false);
    expect(isPublicPhaseVisible('final-vote', false, 'pairing')).toBe(false);
    expect(isPublicPhaseVisible('final-vote', false, 'final-vote')).toBe(true);
  });

  test('shows every available phase while operations preview mode is enabled', () => {
    expect(isPublicPhaseVisible('submission', true, 'submission')).toBe(true);
    expect(isPublicPhaseVisible('submission', true, 'pairing')).toBe(true);
    expect(isPublicPhaseVisible('submission', true, 'final-vote')).toBe(true);
  });
});
