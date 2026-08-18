import { describe, expect, test } from 'vitest';
import { firstStageVoteLimit, trackDefinitions } from '../../src/config/activity';
import { createDemoPreviewData, demoPreviewConfig } from '../../src/config/demo-preview';

describe('confirmed contest configuration', () => {
  test('keeps the two announced activities as the only two contest tracks', () => {
    expect(trackDefinitions.map((track) => track.id)).toEqual([
      'resonance-theatre',
      'brocade-wardrobe'
    ]);
  });

  test('gives each viewer three first-stage choices in each track', () => {
    expect(firstStageVoteLimit).toBe(3);
  });

  test('provides a complete local preview without inventing real prize data', () => {
    const demo = createDemoPreviewData('/');

    expect(demoPreviewConfig.previewMode).toBe(true);
    expect(Object.values(demoPreviewConfig.schedule).map((stage) => stage.label)).toEqual(['投稿阶段', '盲选阶段', '投票阶段']);
    expect(demo.galleryByTrack['resonance-theatre']).toHaveLength(3);
    expect(demo.pairingByTrack['brocade-wardrobe'].works).toHaveLength(2);
    expect(demo.galleryByTrack['resonance-theatre'][0].media[0].url).toBe('/assets/rainy-wuwa-hero.png');
  });
});
