import { describe, expect, test } from 'vitest';
import { firstStageVoteLimit, trackDefinitions } from '../../src/config/activity';
import { createDemoPreviewData, demoPreviewConfig } from '../../src/config/demo-preview';

describe('confirmed contest configuration', () => {
  test('exposes only the two active 拉海洛国风换装秀 tracks', () => {
    expect(trackDefinitions.map((track) => track.id)).toEqual([
      'wardrobe-design',
      'wardrobe-video'
    ]);
    expect(trackDefinitions.map((track) => track.title)).toEqual([
      '鸣潮·衣锦还裳｜最佳服装设计奖',
      '鸣潮·衣锦还裳｜最佳走秀视频奖'
    ]);
  });

  test('gives each viewer three first-stage choices in each track', () => {
    expect(firstStageVoteLimit).toBe(3);
  });

  test('provides a complete local preview for the two active tracks', () => {
    const demo = createDemoPreviewData('/');

    expect(demoPreviewConfig.previewMode).toBe(true);
    expect(Object.values(demoPreviewConfig.schedule).map((stage) => stage.label)).toEqual(['投稿阶段', '盲选阶段', '公开投票阶段', '结果公示阶段']);
    expect(demoPreviewConfig.schedule).toMatchObject({
      submission: { startAt: '2026-09-01T00:00:00+08:00', endAt: '2026-10-08T23:59:59+08:00' },
      pairing: { startAt: '2026-10-09T00:00:00+08:00', endAt: '2026-10-12T23:59:59+08:00' },
      finalVote: { startAt: '2026-10-13T00:00:00+08:00', endAt: '2026-10-18T23:59:59+08:00' },
      results: { startAt: '2026-10-19T00:00:00+08:00', endAt: '2026-10-21T23:59:59+08:00' }
    });
    expect(Object.keys(demo.galleryByTrack)).toEqual(['wardrobe-design', 'wardrobe-video']);
    expect(demo.pairingByTrack['wardrobe-video']?.works).toHaveLength(2);
    expect(demo.galleryByTrack['wardrobe-design']?.[0].media[0].url).toBe('/assets/blonde-character-soft-smile.png');
  });
});
