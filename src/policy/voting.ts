import { firstStageVoteLimit, secondStageDailyVoteLimit, submissionLimitPerTrack } from '../config/activity';

export const submissionPolicy = { maxActiveEntriesPerTrack: submissionLimitPerTrack } as const;
export const firstStagePolicy = { votesPerTrack: firstStageVoteLimit } as const;
export const secondStagePolicy = { votesPerTrackPerDay: secondStageDailyVoteLimit } as const;
