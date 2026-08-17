import { describe, expect, test } from 'vitest';
import { meetsTrackMediaRequirement } from '../../src/domain/submission-media';

describe('track media requirements', () => {
  test('requires a full four-panel image set for the resonance theatre track', () => {
    expect(meetsTrackMediaRequirement(['image', 'image', 'image'], {
      id: 'resonance-theatre',
      acceptedMedia: ['image'],
      minimumMediaCount: 4,
      title: '鸣潮·共鸣小剧场',
      summary: '',
      requirements: []
    })).toBe(false);
  });

  test('accepts either three design images or one video for the wardrobe track', () => {
    const track = {
      id: 'brocade-wardrobe' as const,
      acceptedMedia: ['image', 'video'] as const,
      minimumMediaCount: 3,
      videoSatisfiesMinimum: true,
      title: '鸣潮·衣锦还裳',
      summary: '',
      requirements: []
    };

    expect(meetsTrackMediaRequirement(['image', 'image', 'image'], track)).toBe(true);
    expect(meetsTrackMediaRequirement(['video'], track)).toBe(true);
  });
});
