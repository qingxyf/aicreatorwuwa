import type { ActivitySettings } from '../types/contest';
import type { ContestPhase, TrackDefinition } from '../types/activity';

export const contestTimezone = 'Asia/Shanghai';
export const firstStageVoteLimit = 3;
export const secondStageDailyVoteLimit = 3;
export const submissionLimitPerTrack = 1;

export const trackDefinitions: TrackDefinition[] = [
  {
    id: 'resonance-style',
    title: '鸣潮·共鸣小剧场｜最佳画风奖',
    acceptedMedia: ['image'],
    minimumMediaCount: 4,
    summary: '用 AI 四格漫画绘出鸣潮角色的万千日常。',
    requirements: ['至少上传 1 组完整四格（4 张图片）', '填写角色名称与不少于 30 字剧情概述']
  },
  {
    id: 'resonance-story',
    title: '鸣潮·共鸣小剧场｜最佳剧情奖',
    acceptedMedia: ['image'],
    minimumMediaCount: 8,
    summary: '用 AI 四格漫画讲出完整故事。',
    requirements: ['至少上传 2 组完整四格（8 张图片）', '填写角色名称与不少于 50 字剧情梗概']
  },
  {
    id: 'wardrobe-design',
    title: '鸣潮·衣锦还裳｜最佳服装设计奖',
    acceptedMedia: ['image'],
    minimumMediaCount: 3,
    summary: '为拉海洛角色换上国风新装，展示完整设计细节。',
    requirements: ['至少上传 3 张设计图（建议正面、背面、细节）', '填写角色名称与不少于 30 字设计理念']
  },
  {
    id: 'wardrobe-video',
    title: '鸣潮·衣锦还裳｜最佳走秀视频奖',
    acceptedMedia: ['video'],
    minimumMediaCount: 1,
    summary: '用 AI 视频工具完成一场国风走秀或角色展示。',
    requirements: ['上传 1 个 10–60 秒 MP4/WebM 视频', '填写角色名称与不少于 30 字创作说明']
  }
];

export const defaultContestPhase: ContestPhase = 'submission';

export const defaultActivitySettings: ActivitySettings = {
  phase: defaultContestPhase,
  previewMode: false,
  schedule: {
    submission: { label: '投稿阶段' },
    pairing: { label: '盲选阶段' },
    finalVote: { label: '投票阶段' }
  }
};
