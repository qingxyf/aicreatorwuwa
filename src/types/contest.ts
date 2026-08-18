export type ContestTrackId = 'resonance-theatre' | 'brocade-wardrobe';

export type ContestPhase = 'submission' | 'pairing' | 'final-vote' | 'closed';

export type ContestWorkStatus = 'draft' | 'pending' | 'approved' | 'finalist' | 'hidden';

export interface ContestWorkEntry {
  id: string;
  trackId: ContestTrackId;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  title: string;
  status: ContestWorkStatus;
  exposureCount: number;
  pairingWins: number;
  createdAt: string;
}

export interface SubmissionInput {
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  trackId: ContestTrackId;
  title: string;
  characterName?: string;
  description?: string;
  mediaIds?: string[];
}

export interface SubmissionRecord extends SubmissionInput {
  id: string;
  status: ContestWorkStatus;
  createdAt: string;
}

export interface PairingVoteInput {
  viewerId: string;
  trackId: ContestTrackId;
  assignmentId: string;
  preferredWorkId: string;
}

export interface FinalVoteInput {
  viewerId: string;
  trackId: ContestTrackId;
  workId: string;
  day: string;
}

export interface ContestRepository {
  countActiveSubmissions(authorId: string, trackId: ContestTrackId): Promise<number>;
  areMediaOwnedBy(authorId: string, mediaIds: string[]): Promise<boolean>;
  createSubmission(input: SubmissionInput): Promise<SubmissionRecord | SubmissionInput>;
  listApprovedWorks(trackId: ContestTrackId): Promise<ContestWorkEntry[]>;
  listPairingWorks(ids: [string, string]): Promise<PublicPairingWork[]>;
  createPairingAssignment(viewerId: string, trackId: ContestTrackId, workIds: [string, string]): Promise<string>;
  listComparedWorkIds(viewerId: string, trackId: ContestTrackId): Promise<string[]>;
  countPairingVotes(viewerId: string, trackId: ContestTrackId): Promise<number>;
  recordPairingVote(input: PairingVoteInput): Promise<boolean>;
  listDailyFinalVoteWorkIds(viewerId: string, trackId: ContestTrackId, day: string): Promise<string[]>;
  recordFinalVote(input: FinalVoteInput): Promise<boolean>;
  listOwnedMediaKinds(authorId: string, mediaIds: string[]): Promise<Array<'image' | 'video'>>;
}

export interface PublicTrack {
  id: ContestTrackId;
  title: string;
  acceptedMedia: Array<'image' | 'video'>;
  minimumMediaCount: number;
  videoSatisfiesMinimum?: boolean;
  summary: string;
  requirements: string[];
}

export interface PublicContestConfig {
  phase: ContestPhase;
  previewMode: boolean;
  schedule: PublicContestSchedule;
  tracks: PublicTrack[];
}

export interface ActivityStageSchedule {
  label: string;
  startAt?: string;
  endAt?: string;
}

export interface PublicContestSchedule {
  submission: ActivityStageSchedule;
  pairing: ActivityStageSchedule;
  finalVote: ActivityStageSchedule;
}

export interface ActivitySettings {
  phase: ContestPhase;
  previewMode: boolean;
  schedule: PublicContestSchedule;
}

export interface ActivitySettingsRepository {
  getActivitySettings(): Promise<ActivitySettings>;
  saveActivitySettings(settings: ActivitySettings): Promise<ActivitySettings>;
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RequestRateLimiter {
  consume(viewerId: string, route: string, rule: RateLimitRule, now?: number): Promise<boolean>;
}

export interface PublicGalleryWork {
  id: string;
  title: string;
  authorName: string;
  authorAvatar: string;
  media: Array<{ id: string; url: string; kind: 'image' | 'video'; mimeType: string }>;
  finalVotes: number;
}

export interface PublicPairingWork {
  id: string;
  title: string;
  media: Array<{ id: string; url: string; kind: 'image' | 'video'; mimeType: string }>;
}

export interface PairingOffer {
  assignmentId: string;
  works: PublicPairingWork[];
}

export interface ClientSubmissionInput {
  trackId: ContestTrackId;
  title: string;
  characterName?: string;
  description?: string;
  mediaIds: string[];
}

export interface OperatorSubmission extends PublicGalleryWork {
  trackId: ContestTrackId;
  status: ContestWorkStatus;
  isDisplayed: boolean;
  pairingWins: number;
  exposureCount: number;
  createdAt: string;
}
