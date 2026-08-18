import { submissionPolicy } from '../policy/voting';
import type { RuleResult } from '../types/activity';

export function canCreateSubmission(activeSubmissions: number): RuleResult {
  return activeSubmissions < submissionPolicy.maxActiveEntriesPerTrack
    ? { allowed: true }
    : { allowed: false, reason: 'submission_limit' };
}
