import { describe, expect, test } from 'vitest';
import { ContestService } from '../../src/services/contest-service';

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    countActiveSubmissions: async () => 0,
    areMediaOwnedBy: async () => true,
    createSubmission: async (input: unknown) => input,
    listApprovedWorks: async () => [],
    listPairingWorks: async () => [],
    createPairingAssignment: async () => 'assignment-1',
    listComparedWorkIds: async () => [],
    countPairingVotes: async () => 0,
    recordPairingVote: async () => true,
    listDailyFinalVoteWorkIds: async () => [],
    recordFinalVote: async () => true,
    listOwnedMediaKinds: async () => ['image', 'image', 'image', 'image'],
    ...overrides
  };
}

describe('ContestService', () => {
  test('does not persist a second active submission in one track', async () => {
    const repository = createRepository({ countActiveSubmissions: async () => 1 });
    const service = new ContestService(repository);

    await expect(service.createSubmission({ authorId: 'u1', trackId: 'resonance-theatre', title: '雨夜' })).rejects.toThrow('submission_limit');
  });

  test('does not attach media uploaded by a different account', async () => {
    const repository = createRepository({ areMediaOwnedBy: async () => false });
    const service = new ContestService(repository);

    await expect(service.createSubmission({
      authorId: 'u1',
      trackId: 'resonance-theatre',
      title: '雨夜',
      mediaIds: ['other-users-file']
    })).rejects.toThrow('media_not_owned');
  });

  test('enforces the track-specific media requirement after ownership checks', async () => {
    const repository = createRepository({
      listOwnedMediaKinds: async () => ['image', 'image', 'image']
    });
    const service = new ContestService(repository);

    await expect(service.createSubmission({
      authorId: 'u1',
      trackId: 'resonance-theatre',
      title: '四格雨夜',
      mediaIds: ['panel-1', 'panel-2', 'panel-3']
    })).rejects.toThrow('media_requirement_not_met');
  });

  test('records a pairing vote only when its server-issued assignment can be consumed once', async () => {
    const recordPairingVote = async () => false;
    const repository = createRepository({ recordPairingVote });
    const service = new ContestService(repository);

    await expect(service.castPairingVote({
      viewerId: 'u1',
      trackId: 'resonance-theatre',
      assignmentId: 'assignment-1',
      preferredWorkId: 'work-a'
    })).rejects.toThrow('pairing_assignment_invalid');
  });

  test('does not persist an invalid duplicate final vote', async () => {
    const recordFinalVote = async () => {
      throw new Error('should not persist');
    };
    const repository = createRepository({ listDailyFinalVoteWorkIds: async () => ['work-a'], recordFinalVote });
    const service = new ContestService(repository);

    await expect(service.castFinalVote({ viewerId: 'u1', trackId: 'resonance-theatre', workId: 'work-a', day: '2026-08-18' })).rejects.toThrow('duplicate_work');
  });

  test('records a valid second-stage vote and returns the remaining quota', async () => {
    const calls: unknown[] = [];
    const repository = createRepository({
      listDailyFinalVoteWorkIds: async () => ['work-a'],
      recordFinalVote: async (input: unknown) => {
        calls.push(input);
        return true;
      }
    });
    const service = new ContestService(repository);

    await expect(service.castFinalVote({ viewerId: 'u1', trackId: 'resonance-theatre', workId: 'work-b', day: '2026-08-18' })).resolves.toEqual({ remainingAfter: 1 });
    expect(calls).toHaveLength(1);
  });

  test('does not report success when the database atomically rejects a concurrent final vote', async () => {
    const repository = createRepository({
      listDailyFinalVoteWorkIds: async () => [],
      recordFinalVote: async () => false
    });
    const service = new ContestService(repository);

    await expect(service.castFinalVote({
      viewerId: 'u1',
      trackId: 'resonance-theatre',
      workId: 'work-b',
      day: '2026-08-18'
    })).rejects.toThrow('final_vote_not_recorded');
  });
});
