import type { ContestPhase } from '../types/contest';

type PublicActivityPhase = Exclude<ContestPhase, 'closed'>;

export function isPublicPhaseVisible(activePhase: ContestPhase, previewMode: boolean, targetPhase: PublicActivityPhase): boolean {
  return previewMode || activePhase === targetPhase;
}

export function isActivityActionAllowed(activePhase: ContestPhase, previewMode: boolean, targetPhase: PublicActivityPhase): boolean {
  return isPublicPhaseVisible(activePhase, previewMode, targetPhase);
}
