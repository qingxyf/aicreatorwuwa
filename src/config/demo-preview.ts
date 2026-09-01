import { trackDefinitions } from './activity';
import type { ContestTrackId, PairingOffer, PublicContestConfig, PublicGalleryWork } from '../types/contest';

export const demoPreviewConfig: PublicContestConfig = {
  phase: 'submission',
  previewMode: true,
  schedule: {
    submission: { label: '投稿阶段', startAt: '2026-09-01T00:00:00+08:00', endAt: '2026-10-08T23:59:59+08:00' },
    pairing: { label: '盲选阶段', startAt: '2026-10-09T00:00:00+08:00', endAt: '2026-10-12T23:59:59+08:00' },
    finalVote: { label: '公开投票阶段', startAt: '2026-10-13T00:00:00+08:00', endAt: '2026-10-18T23:59:59+08:00' },
    results: { label: '结果公示阶段', startAt: '2026-10-19T00:00:00+08:00', endAt: '2026-10-21T23:59:59+08:00' }
  },
  tracks: trackDefinitions
};

function demoImage(baseUrl: string, id: string, filename: string, authorName: string, title: string): PublicGalleryWork {
  return {
    id,
    title,
    authorName,
    authorAvatar: `${baseUrl}assets/${filename}`,
    media: [{ id: `${id}-media`, url: `${baseUrl}assets/${filename}`, kind: 'image', mimeType: 'image/png' }],
    finalVotes: id === 'demo-work-rain' ? 28 : id === 'demo-work-silk' ? 19 : 12
  };
}

export interface DemoPreviewData {
  pairingByTrack: Partial<Record<ContestTrackId, PairingOffer>>;
  galleryByTrack: Partial<Record<ContestTrackId, PublicGalleryWork[]>>;
}

export function createDemoPreviewData(baseUrl: string): DemoPreviewData {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const rain = demoImage(normalizedBaseUrl, 'demo-work-rain', 'rainy-wuwa-hero.png', '白芷', '雨夜新装');
  const silk = demoImage(normalizedBaseUrl, 'demo-work-silk', 'blonde-character-soft-smile.png', '今汐同好会', '绢灯照归人');
  const grey = demoImage(normalizedBaseUrl, 'demo-work-grey', 'grey-character-soft-smile.png', '云陵客', '檐下听雨');
  const pairMedia = (work: PublicGalleryWork) => ({ id: `${work.id}-pair`, title: work.title, media: work.media });

  return {
    pairingByTrack: {
      'wardrobe-design': { assignmentId: 'demo-pair-wardrobe-design', works: [pairMedia(silk), pairMedia(rain)] },
      'wardrobe-video': { assignmentId: 'demo-pair-wardrobe-video', works: [pairMedia(rain), pairMedia(silk)] }
    },
    galleryByTrack: {
      'wardrobe-design': [silk, rain, grey],
      'wardrobe-video': [rain, silk, grey]
    }
  };
}
