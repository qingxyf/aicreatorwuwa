export type TrackId = 'resonance-theatre' | 'brocade-wardrobe';

export type ContestPhase = 'submission' | 'pairing' | 'final-vote' | 'closed';

export type WorkStatus = 'draft' | 'pending' | 'approved' | 'finalist' | 'hidden';

export interface TrackDefinition {
  id: TrackId;
  title: string;
  acceptedMedia: Array<'image' | 'video'>;
  minimumMediaCount: number;
  videoSatisfiesMinimum?: boolean;
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
