import { describe, expect, test } from 'vitest';
import { firstStageVoteLimit, trackDefinitions } from '../../src/config/activity';
import { createDemoPreviewData, demoPreviewConfig } from '../../src/config/demo-preview';

describe('confirmed contest configuration', () => {
  test('exposes the four announced contest tracks independently', () => {
    expect(trackDefinitions.map((track) => track.id)).toEqual([
      'resonance-style',
      'resonance-story',
      'wardrobe-design',
      'wardrobe-video'
    ]);
    expect(trackDefinitions.map((track) => track.title)).toEqual([
      '鸣潮·共鸣小剧场｜最佳画风奖',
      '鸣潮·共鸣小剧场｜最佳剧情奖',
      '鸣潮·衣锦还裳｜最佳服装设计奖',
      '鸣潮·衣锦还裳｜最佳走秀视频奖'
    ]);
  });

  test('gives each viewer three first-stage choices in each track', () => {
    expect(firstStageVoteLimit).toBe(3);
  });

  test('provides a complete local preview without inventing real prize data', () => {
    const demo = createDemoPreviewData('/');

    expect(demoPreviewConfig.previewMode).toBe(true);
    expect(Object.values(demoPreviewConfig.schedule).map((stage) => stage.label)).toEqual(['投稿阶段', '盲选阶段', '投票阶段']);
    expect(demo.galleryByTrack['resonance-style']).toHaveLength(3);
    expect(demo.pairingByTrack['wardrobe-video'].works).toHaveLength(2);
    expect(demo.galleryByTrack['resonance-style'][0].media[0].url).toBe('/assets/rainy-wuwa-hero.png');
  });
});
