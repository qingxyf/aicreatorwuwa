import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App, type PublicActivityApi } from '../../src/app/App';

const viewer = { id: 'toy-open-id', name: '漂泊者', avatarUrl: 'https://avatar.test/wanderer.png' };

function createApi(): PublicActivityApi {
  return {
    loadConfig: async () => ({
      phase: 'final-vote',
      tracks: [
        {
          id: 'resonance-theatre',
          title: '鸣潮·共鸣小剧场',
          acceptedMedia: ['image'],
          minimumMediaCount: 4,
          summary: '用 AI 四格漫画绘出鸣潮角色的万千日常。',
          requirements: ['至少上传 1 组完整四格（4 张）']
        },
        {
          id: 'brocade-wardrobe',
          title: '鸣潮·衣锦还裳',
          acceptedMedia: ['image', 'video'],
          minimumMediaCount: 3,
          videoSatisfiesMinimum: true,
          summary: '为拉海洛角色换上国风新装。',
          requirements: ['图文或视频作品均可投稿']
        }
      ]
    }),
    currentViewer: async () => viewer,
    uploadMedia: async (file) => ({ id: `media-${file.name}`, url: 'https://media.test/work.png', kind: 'image', mimeType: file.type }),
    submit: async (input) => ({ ...input, id: 'submission-1', status: 'pending', createdAt: '2026-08-18T00:00:00.000Z' }),
    nextPair: async () => null,
    castPairingVote: async () => undefined,
    listGallery: async () => [
      {
        id: 'work-rain',
        title: '雨夜新装',
        authorName: '白芷',
        authorAvatar: 'https://avatar.test/baizhi.png',
        media: [{ id: 'media-work', url: 'https://media.test/work.png', kind: 'image', mimeType: 'image/png' }],
        finalVotes: 28
      }
    ],
    castFinalVote: async () => ({ remainingAfter: 2 })
  };
}

describe('public activity experience', () => {
  test('shows only rules, submission and voting in public navigation', async () => {
    render(<App api={createApi()} />);
    expect(screen.getByRole('link', { name: '活动规则' })).toBeVisible();
    expect(screen.getByRole('link', { name: '我要投稿' })).toBeVisible();
    expect(screen.getByRole('link', { name: '参与投票' })).toBeVisible();
    expect(screen.getByText('初选：每赛道 3 次二选一')).toBeVisible();
    expect(screen.queryByText('运营后台')).not.toBeInTheDocument();
    await screen.findByRole('button', { name: '投票给 雨夜新装' });
  });

  test('shows an author avatar and prevents a duplicate daily vote', async () => {
    const user = userEvent.setup();
    render(<App api={createApi()} />);

    await user.click(await screen.findByRole('button', { name: '投票给 雨夜新装' }));
    expect(screen.getByText('每个赛道每日 3 票 · 还可投 2 票')).toBeVisible();
    expect(screen.getByAltText('白芷的头像')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '投票给 雨夜新装' }));
    expect(screen.getByText('同一作品当天只能投一次')).toBeVisible();
  });

  test('uploads a work and saves a single public submission without operational controls', async () => {
    const user = userEvent.setup();
    render(<App api={createApi()} />);

    await user.click(screen.getByRole('link', { name: '我要投稿' }));
    await user.type(screen.getByLabelText('作品标题'), '雨中相逢');
    await user.upload(screen.getByLabelText('添加作品文件'), [
      new File(['image'], 'work-1.png', { type: 'image/png' }),
      new File(['image'], 'work-2.png', { type: 'image/png' }),
      new File(['image'], 'work-3.png', { type: 'image/png' }),
      new File(['image'], 'work-4.png', { type: 'image/png' })
    ]);
    await user.click(screen.getByRole('button', { name: '提交作品' }));

    await waitFor(() => expect(screen.getByText('投稿已保存，等待审核')).toBeVisible());
    expect(screen.queryByText('设置入围')).not.toBeInTheDocument();
  });

  test('shows the track media requirement before uploading an incomplete submission', async () => {
    const user = userEvent.setup();
    render(<App api={createApi()} />);

    await user.click(screen.getByRole('link', { name: '我要投稿' }));
    await user.type(screen.getByLabelText('作品标题'), '雨中相逢');
    await user.upload(screen.getByLabelText('添加作品文件'), [
      new File(['image'], 'work-1.png', { type: 'image/png' }),
      new File(['image'], 'work-2.png', { type: 'image/png' }),
      new File(['image'], 'work-3.png', { type: 'image/png' })
    ]);
    await user.click(screen.getByRole('button', { name: '提交作品' }));

    expect(await screen.findByText('本赛道需要至少 4 张图片')).toBeVisible();
  });
});
