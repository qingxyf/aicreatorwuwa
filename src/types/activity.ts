export type ActivityId = 'resonance-theatre' | 'brocade-wardrobe';

export type TrackId =
  | 'best-art-style'
  | 'best-story'
  | 'best-costume-design'
  | 'best-runway-video';

export type ContestPhase = 'submission' | 'pairing' | 'final-vote' | 'closed';

export type WorkStatus = 'draft' | 'pending' | 'approved' | 'finalist' | 'hidden';

export interface TrackDefinition {
  id: TrackId;
  activityId: ActivityId;
  title: string;
  medium: 'images' | 'video';
  summary: string;
  requirements: string[];
}

export interface WorkEntry {
  id: string;
  trackId: TrackId;
  authorId: string;
  title: string;
  status: WorkStatus;
  exposureCount: number;
  pairingWins: number;
  createdAt: string;
}

export type RuleResult = { allowed: true; remainingAfter?: number } | { allowed: false; reason: string };
