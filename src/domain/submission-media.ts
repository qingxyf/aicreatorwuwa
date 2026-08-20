import type { TrackDefinition } from '../types/activity';

export function isVideoDurationAllowed(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 10 && seconds <= 60;
}

export function meetsTrackMediaRequirement(
  mediaKinds: Array<'image' | 'video'>,
  track: TrackDefinition
): boolean {
  if (mediaKinds.length === 0 || mediaKinds.some((kind) => !track.acceptedMedia.includes(kind))) return false;
  if (track.acceptedMedia.length === 1 && track.acceptedMedia[0] === 'video') {
    return mediaKinds.length === 1 && mediaKinds[0] === 'video';
  }
  if (track.videoSatisfiesMinimum && mediaKinds.includes('video')) return true;
  return mediaKinds.filter((kind) => kind === 'image').length >= track.minimumMediaCount;
}
