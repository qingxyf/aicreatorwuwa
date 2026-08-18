import type { ActivitySettings } from '../types/contest';
import type { ContestPhase, TrackDefinition } from '../types/activity';

export const contestTimezone = 'Asia/Shanghai';
export const firstStageVoteLimit = 3;
export const secondStageDailyVoteLimit = 3;
export const submissionLimitPerTrack = 1;

export const trackDefinitions: TrackDefinition[] = [
  {
    id: 'resonance-theatre',
    title: '鸣潮·共鸣小剧场',
    acceptedMedia: ['image'],
    minimumMediaCount: 4,
    summary: '用 AI 四格漫画绘出鸣潮角色的万千日常。',
    requirements: ['至少上传 1 组完整四格（4 张）', '填写角色名称、AI 工具与不少于 30 字剧情概述']
  },
  {
    id: 'brocade-wardrobe',
    title: '鸣潮·衣锦还裳',
    acceptedMedia: ['image', 'video'],
    minimumMediaCount: 3,
    videoSatisfiesMinimum: true,
    summary: '为拉海洛角色换上国风新装，也可以用镜头完成一场走秀。',
    requirements: ['设计图请上传至少 3 张；走秀视频时长 10–60 秒', '填写角色名称、AI 工具与不少于 30 字创作说明']
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
