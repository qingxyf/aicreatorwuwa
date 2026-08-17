import type { ActivityId, ContestPhase, TrackDefinition } from '../types/activity';

export const contestTimezone = 'Asia/Shanghai';
export const firstStageVoteLimit = 5;
export const secondStageDailyVoteLimit = 3;
export const submissionLimitPerTrack = 1;

export const activityTitles: Record<ActivityId, string> = {
  'resonance-theatre': '鸣潮·共鸣小剧场',
  'brocade-wardrobe': '鸣潮·衣锦还裳'
};

export const trackDefinitions: TrackDefinition[] = [
  {
    id: 'best-art-style',
    activityId: 'resonance-theatre',
    title: '最佳画风奖',
    medium: 'images',
    summary: '用 AI 绘出鸣潮角色的四格日常。',
    requirements: ['至少 1 组完整四格', '填写角色名称、AI 工具与不少于 30 字剧情概述']
  },
  {
    id: 'best-story',
    activityId: 'resonance-theatre',
    title: '最佳剧情奖',
    medium: 'images',
    summary: '用完整故事线讲述角色的片段。',
    requirements: ['至少 2 组四格', '填写角色名称、AI 工具与不少于 50 字剧情梗概']
  },
  {
    id: 'best-costume-design',
    activityId: 'brocade-wardrobe',
    title: '最佳服装设计奖',
    medium: 'images',
    summary: '为拉海洛角色设计国风新装。',
    requirements: ['至少 3 张设计图', '填写角色名称、AI 工具与不少于 30 字设计理念']
  },
  {
    id: 'best-runway-video',
    activityId: 'brocade-wardrobe',
    title: '最佳走秀视频奖',
    medium: 'video',
    summary: '让国风服装在镜头中完成一场走秀。',
    requirements: ['视频时长 10–60 秒', '填写角色名称、AI 工具与不少于 30 字创作说明']
  }
];

export const defaultContestPhase: ContestPhase = 'submission';
