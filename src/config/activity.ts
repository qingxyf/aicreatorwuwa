import type { ActivitySettings } from '../types/contest';
import type { ContestPhase, TrackDefinition } from '../types/activity';

export const contestTimezone = 'Asia/Shanghai';
export const firstStageVoteLimit = 3;
export const secondStageDailyVoteLimit = 3;
export const submissionLimitPerTrack = 1;

export const trackDefinitions: TrackDefinition[] = [
  {
    id: 'wardrobe-design',
    title: '鸣潮·衣锦还裳｜最佳服装设计奖',
    acceptedMedia: ['image'],
    minimumMediaCount: 3,
    summary: '为拉海洛角色换上国风新装，展示完整设计细节。',
    requirements: ['至少上传 3 张设计图（建议正面、背面、细节）', '填写角色名称与不少于 30 字设计理念', '二创作品中，禁止出现丑化、拉踩角色等不当行为']
  },
  {
    id: 'wardrobe-video',
    title: '鸣潮·衣锦还裳｜最佳走秀视频奖',
    acceptedMedia: ['video'],
    minimumMediaCount: 1,
    summary: '用 AI 视频工具完成一场国风走秀或角色展示。',
    requirements: ['上传 1 个 10–60 秒 MP4/WebM 视频', '填写角色名称与不少于 30 字创作说明', '二创作品中，禁止出现丑化、拉踩角色等不当行为']
  }
];

export const defaultContestPhase: ContestPhase = 'submission';

export const defaultActivitySettings: ActivitySettings = {
  phase: defaultContestPhase,
  previewMode: false,
  schedule: {
    submission: { label: '投稿阶段', startAt: '2026-09-01T00:00:00+08:00', endAt: '2026-10-08T23:59:59+08:00' },
    pairing: { label: '盲选阶段', startAt: '2026-10-09T00:00:00+08:00', endAt: '2026-10-12T23:59:59+08:00' },
    finalVote: { label: '公开投票阶段', startAt: '2026-10-13T00:00:00+08:00', endAt: '2026-10-18T23:59:59+08:00' },
    results: { label: '结果公示阶段', startAt: '2026-10-19T00:00:00+08:00', endAt: '2026-10-21T23:59:59+08:00' }
  }
};
