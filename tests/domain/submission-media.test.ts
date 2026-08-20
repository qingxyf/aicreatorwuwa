import { describe, expect, test } from 'vitest';
import { isVideoDurationAllowed, meetsTrackMediaRequirement } from '../../src/domain/submission-media';

describe('track media requirements', () => {
  test('requires a full four-panel image set for the style track', () => {
    expect(meetsTrackMediaRequirement(['image', 'image', 'image'], {
      id: 'resonance-style',
      acceptedMedia: ['image'],
      minimumMediaCount: 4,
      title: '鸣潮·共鸣小剧场',
      summary: '',
      requirements: []
    })).toBe(false);
  });

  test('accepts only one video for the runway video track', () => {
    const track = {
      id: 'wardrobe-video' as const,
      acceptedMedia: ['video'] as const,
      minimumMediaCount: 1,
      title: '鸣潮·衣锦还裳｜最佳走秀视频奖',
      summary: '',
      requirements: []
    };

    expect(meetsTrackMediaRequirement(['video'], track)).toBe(true);
    expect(meetsTrackMediaRequirement(['video', 'video'], track)).toBe(false);
    expect(meetsTrackMediaRequirement(['image'], track)).toBe(false);
  });

  test('accepts runway videos only when their duration is between 10 and 60 seconds', () => {
    expect(isVideoDurationAllowed(10)).toBe(true);
    expect(isVideoDurationAllowed(60)).toBe(true);
    expect(isVideoDurationAllowed(9.99)).toBe(false);
    expect(isVideoDurationAllowed(60.01)).toBe(false);
  });
});
