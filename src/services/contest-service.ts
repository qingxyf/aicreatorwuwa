import { canCreateSubmission } from '../domain/submission';
import { meetsTrackMediaRequirement } from '../domain/submission-media';
import { selectBalancedPair } from '../domain/pairing';
import { validateFinalVote } from '../domain/final-vote';
import { trackDefinitions } from '../config/activity';
import { firstStagePolicy } from '../policy/voting';
import type { ContestRepository, ContestTrackId, FinalVoteInput, PairingOffer, PairingVoteInput, SubmissionInput } from '../types/contest';

function enforce(result: { allowed: boolean; reason?: string }): void {
  if (!result.allowed) throw new Error(result.reason ?? 'rule_rejected');
}

export class ContestService {
  constructor(private readonly repository: ContestRepository) {}

  async createSubmission(input: SubmissionInput) {
    enforce(canCreateSubmission(await this.repository.countActiveSubmissions(input.authorId, input.trackId)));
    if (!input.mediaIds?.length) throw new Error('media_required');
    if (!(await this.repository.areMediaOwnedBy(input.authorId, input.mediaIds))) throw new Error('media_not_owned');
    const track = trackDefinitions.find((definition) => definition.id === input.trackId);
    const mediaKinds = await this.repository.listOwnedMediaKinds(input.authorId, input.mediaIds);
    if (!track || mediaKinds.length !== input.mediaIds.length || !meetsTrackMediaRequirement(mediaKinds, track)) {
      throw new Error('media_requirement_not_met');
    }
    return this.repository.createSubmission(input);
  }

  async requestPairing(viewerId: string, trackId: ContestTrackId): Promise<PairingOffer | null> {
    const usedVotes = await this.repository.countPairingVotes(viewerId, trackId);
    if (usedVotes >= firstStagePolicy.votesPerTrack) throw new Error('pairing_limit');
    const seenWorkIds = new Set(await this.repository.listComparedWorkIds(viewerId, trackId));
    const pair = selectBalancedPair(await this.repository.listApprovedWorks(trackId), seenWorkIds);
    if (!pair) return null;
    const works = await this.repository.listPairingWorks(pair);
    if (works.length !== 2) return null;
    return { assignmentId: await this.repository.createPairingAssignment(viewerId, trackId, pair), works };
  }

  async castPairingVote(input: PairingVoteInput): Promise<void> {
    if (!(await this.repository.recordPairingVote(input))) throw new Error('pairing_assignment_invalid');
  }

  async castFinalVote(input: FinalVoteInput): Promise<{ remainingAfter: number }> {
    const history = await this.repository.listDailyFinalVoteWorkIds(input.viewerId, input.trackId, input.day);
    const decision = validateFinalVote(history, input.workId);
    if (!decision.allowed) throw new Error(decision.reason);
    if (!(await this.repository.recordFinalVote(input))) {
      const currentHistory = await this.repository.listDailyFinalVoteWorkIds(input.viewerId, input.trackId, input.day);
      const currentDecision = validateFinalVote(currentHistory, input.workId);
      if (!currentDecision.allowed) throw new Error(currentDecision.reason);
      throw new Error('final_vote_not_recorded');
    }
    return { remainingAfter: decision.remainingAfter ?? 0 };
  }
}
