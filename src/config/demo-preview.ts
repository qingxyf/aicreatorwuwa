import { trackDefinitions } from './activity';
import type { ContestTrackId, PairingOffer, PublicContestConfig, PublicGalleryWork } from '../types/contest';

export const demoPreviewConfig: PublicContestConfig = {
  phase: 'submission',
  previewMode: true,
  schedule: {
    submission: { label: '投稿阶段', startAt: '2026-08-20T00:00:00+08:00', endAt: '2026-09-02T23:59:59+08:00' },
    pairing: { label: '盲选阶段', startAt: '2026-09-03T00:00:00+08:00', endAt: '2026-09-09T23:59:59+08:00' },
    finalVote: { label: '投票阶段', startAt: '2026-09-10T00:00:00+08:00', endAt: '2026-09-16T23:59:59+08:00' }
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
  pairingByTrack: Record<ContestTrackId, PairingOffer>;
  galleryByTrack: Record<ContestTrackId, PublicGalleryWork[]>;
}

export function createDemoPreviewData(baseUrl: string): DemoPreviewData {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const rain = demoImage(normalizedBaseUrl, 'demo-work-rain', 'rainy-wuwa-hero.png', '白芷', '雨夜新装');
  const silk = demoImage(normalizedBaseUrl, 'demo-work-silk', 'blonde-character-soft-smile.png', '今汐同好会', '绢灯照归人');
  const grey = demoImage(normalizedBaseUrl, 'demo-work-grey', 'grey-character-soft-smile.png', '云陵客', '檐下听雨');
  const pairMedia = (work: PublicGalleryWork) => ({ id: `${work.id}-pair`, title: work.title, media: work.media });

  return {
    pairingByTrack: {
      'resonance-style': { assignmentId: 'demo-pair-resonance-style', works: [pairMedia(rain), pairMedia(grey)] },
      'resonance-story': { assignmentId: 'demo-pair-resonance-story', works: [pairMedia(grey), pairMedia(silk)] },
      'wardrobe-design': { assignmentId: 'demo-pair-wardrobe-design', works: [pairMedia(silk), pairMedia(rain)] },
      'wardrobe-video': { assignmentId: 'demo-pair-wardrobe-video', works: [pairMedia(rain), pairMedia(silk)] }
    },
    galleryByTrack: {
      'resonance-style': [rain, grey, silk],
      'resonance-story': [grey, silk, rain],
      'wardrobe-design': [silk, rain, grey],
      'wardrobe-video': [rain, silk, grey]
    }
  };
}
