import { secondStagePolicy } from '../policy/voting';
import type { RuleResult } from '../types/activity';

export function validateFinalVote(votedWorkIds: string[], targetWorkId: string): RuleResult {
  if (votedWorkIds.includes(targetWorkId)) return { allowed: false, reason: 'duplicate_work' };
  if (votedWorkIds.length >= secondStagePolicy.votesPerTrackPerDay) return { allowed: false, reason: 'daily_limit' };
  return { allowed: true, remainingAfter: secondStagePolicy.votesPerTrackPerDay - votedWorkIds.length - 1 };
}
