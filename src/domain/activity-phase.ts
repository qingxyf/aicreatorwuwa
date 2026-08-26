import type { ContestPhase, PublicContestSchedule } from '../types/contest';

type PublicActivityPhase = Exclude<ContestPhase, 'closed'>;

export function isPublicPhaseVisible(activePhase: ContestPhase, previewMode: boolean, targetPhase: PublicActivityPhase): boolean {
  return previewMode || activePhase === targetPhase;
}

export function isActivityActionAllowed(
  activePhase: ContestPhase,
  previewMode: boolean,
  targetPhase: PublicActivityPhase,
  schedule?: PublicContestSchedule,
  now = Date.now()
): boolean {
  if (previewMode) return true;
  if (activePhase !== targetPhase) return false;
  const stage = targetPhase === 'final-vote' ? schedule?.finalVote : schedule?.[targetPhase];
  if (stage?.startAt && now < Date.parse(stage.startAt)) return false;
  if (stage?.endAt && now > Date.parse(stage.endAt)) return false;
  return true;
}
