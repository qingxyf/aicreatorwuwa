import { describe, expect, test } from 'vitest';
import { isActivityActionAllowed, isPublicPhaseVisible } from '../../src/domain/activity-phase';

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

  test('rejects actions outside the configured stage window in public mode', () => {
    const schedule = {
      submission: { label: '投稿阶段', startAt: '2026-09-01T00:00:00.000Z', endAt: '2026-09-10T00:00:00.000Z' },
      pairing: { label: '盲选阶段' },
      finalVote: { label: '投票阶段' }
    };

    expect(isActivityActionAllowed('submission', false, 'submission', schedule, Date.parse('2026-08-31T23:59:59.000Z'))).toBe(false);
    expect(isActivityActionAllowed('submission', false, 'submission', schedule, Date.parse('2026-09-05T00:00:00.000Z'))).toBe(true);
    expect(isActivityActionAllowed('submission', false, 'submission', schedule, Date.parse('2026-09-10T00:00:01.000Z'))).toBe(false);
  });

  test('keeps all stage actions available in preview mode regardless of schedule', () => {
    const schedule = {
      submission: { label: '投稿阶段', startAt: '2030-01-01T00:00:00.000Z' },
      pairing: { label: '盲选阶段' },
      finalVote: { label: '投票阶段' }
    };

    expect(isActivityActionAllowed('submission', true, 'submission', schedule, Date.parse('2026-09-05T00:00:00.000Z'))).toBe(true);
  });
});
