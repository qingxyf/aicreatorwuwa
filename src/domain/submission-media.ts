import type { TrackDefinition } from '../types/activity';

export function meetsTrackMediaRequirement(
  mediaKinds: Array<'image' | 'video'>,
  track: TrackDefinition
): boolean {
  if (mediaKinds.length === 0 || mediaKinds.some((kind) => !track.acceptedMedia.includes(kind))) return false;
  if (track.videoSatisfiesMinimum && mediaKinds.includes('video')) return true;
  return mediaKinds.filter((kind) => kind === 'image').length >= track.minimumMediaCount;
}
