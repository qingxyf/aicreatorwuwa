import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App, type PublicActivityApi } from '../../src/app/App';

const viewer = { id: 'toy-open-id', name: '漂泊者', avatarUrl: 'https://avatar.test/wanderer.png' };

function createApi(configOverrides: Partial<Awaited<ReturnType<PublicActivityApi['loadConfig']>>> = {}): PublicActivityApi {
  return {
    loadConfig: async () => ({
      phase: 'final-vote',
      previewMode: false,
      schedule: {
        submission: { label: '投稿阶段', startAt: '2026-08-20T00:00:00+08:00', endAt: '2026-09-02T23:59:59+08:00' },
        pairing: { label: '盲选阶段', startAt: '2026-09-03T00:00:00+08:00', endAt: '2026-09-09T23:59:59+08:00' },
        finalVote: { label: '投票阶段', startAt: '2026-09-10T00:00:00+08:00', endAt: '2026-09-16T23:59:59+08:00' }
      },
      ...configOverrides,
      tracks: configOverrides.tracks ?? [
        {
          id: 'resonance-style',
          title: '鸣潮·共鸣小剧场｜最佳画风奖',
          acceptedMedia: ['image'],
          minimumMediaCount: 4,
          summary: '用 AI 四格漫画绘出鸣潮角色的万千日常。',
          requirements: ['至少上传 1 组完整四格（4 张）']
        },
        {
          id: 'resonance-story',
          title: '鸣潮·共鸣小剧场｜最佳剧情奖',
          acceptedMedia: ['image'],
          minimumMediaCount: 8,
          summary: '用 AI 四格漫画讲出完整故事。',
          requirements: ['至少上传 2 组完整四格（8 张）']
        },
        {
          id: 'wardrobe-design',
          title: '鸣潮·衣锦还裳｜最佳服装设计奖',
          acceptedMedia: ['image'],
          minimumMediaCount: 3,
          summary: '为拉海洛角色设计国风服装。',
          requirements: ['至少上传 3 张设计图']
        },
        {
          id: 'wardrobe-video',
          title: '鸣潮·衣锦还裳｜最佳走秀视频奖',
          acceptedMedia: ['video'],
          minimumMediaCount: 1,
          summary: '用 AI 视频完成国风走秀展示。',
          requirements: ['上传 1 个 10–60 秒视频']
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
  test('reveals public sections immediately when scroll observation is unavailable', async () => {
    render(<App api={createApi()} />);

    const section = await screen.findByRole('heading', { name: '选择赛道，再开始创作' });
    expect(section.closest('[data-motion-reveal]')).toHaveAttribute('data-motion-visible', 'true');
  });

  test('shows the current phase only in public navigation and content', async () => {
    render(<App api={createApi()} />);
    expect(screen.getByRole('link', { name: '活动规则' })).toBeVisible();
    expect(await screen.findByRole('link', { name: '参与投票' })).toBeVisible();
    expect(screen.queryByRole('link', { name: '我要投稿' })).not.toBeInTheDocument();
    expect(screen.queryByText('让作品公平地相遇')).not.toBeInTheDocument();
    expect(screen.getByText('为喜欢的作品投票')).toBeVisible();
    expect(screen.queryByText('运营后台')).not.toBeInTheDocument();
    await screen.findByRole('button', { name: '投票给 雨夜新装' });
  });

  test('opens the complete rules dialog with safety and disclaimer provisions', async () => {
    const user = userEvent.setup();
    render(<App api={createApi()} />);

    await user.click(screen.getByRole('link', { name: '活动规则' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: '活动完整规则' })).toBeVisible());
    expect(screen.getByText('禁止刷票与破坏服务')).toBeVisible();
    expect(screen.getByText('责任与处理说明')).toBeVisible();
  });

  test('lets a creator explicitly choose a track and exposes the detected media type', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ phase: 'submission' })} />);

    await user.click(await screen.findByRole('link', { name: '我要投稿' }));
    await user.click(screen.getByRole('radio', { name: '鸣潮·衣锦还裳｜最佳服装设计奖' }));
    await user.upload(screen.getByLabelText('添加作品文件'), new File(['image'], 'look.png', { type: 'image/png' }));

    expect(screen.getByText('当前投稿赛道：').parentElement).toHaveTextContent('当前投稿赛道：鸣潮·衣锦还裳｜最佳服装设计奖');
    expect(screen.getByText(/已识别为图片/)).toBeVisible();
  });

  test('shows all three public flows only when the operations preview switch is enabled', async () => {
    const api = createApi();
    api.loadConfig = async () => ({
      ...(await createApi().loadConfig()),
      phase: 'submission',
      previewMode: true
    });

    render(<App api={api} />);

    expect(await screen.findByText('让作品公平地相遇')).toBeVisible();
    expect(screen.getByText('为喜欢的作品投票')).toBeVisible();
    expect(screen.getAllByText('投稿阶段').length).toBeGreaterThan(0);
    expect(screen.getAllByText('盲选阶段').length).toBeGreaterThan(0);
    expect(screen.getAllByText('投票阶段').length).toBeGreaterThan(0);
  });

  test('restores the complete single-page preview when the local backend is unavailable', async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.loadConfig = async () => { throw new Error('offline'); };

    render(<App api={api} />);

    expect(await screen.findByText('鸣潮小站 × AI 创作小站联合举办')).toBeVisible();
    expect(screen.getByText('Bilibili Toy 小站活动')).toBeVisible();
    expect(screen.queryByText('Bilibili Toy 小站活动 · 非鸣潮官方活动')).not.toBeInTheDocument();
    expect(screen.getByText('投稿时间')).toBeVisible();
    expect(screen.getByText('奖励信息即将公布')).toBeVisible();
    expect(screen.getByText('让作品公平地相遇')).toBeVisible();
    expect(screen.getByText('为喜欢的作品投票')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '开始盲选' }));
    expect(await screen.findAllByRole('button', { name: /选这一件/ })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: /选这一件/ })[0]);
    expect(await screen.findByText(/本地演示/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: '投票给 雨夜新装' }));
    expect(await screen.findByText(/每个赛道每日 3 票 · 还可投 2 票/)).toBeVisible();
  });

  test('shows an author avatar and prevents a duplicate daily vote', async () => {
    const user = userEvent.setup();
    render(<App api={createApi()} />);

    await user.click(await screen.findByRole('button', { name: '投票给 雨夜新装' }));
    expect(screen.getByText(/每个赛道每日 3 票 · 还可投 2 票/)).toBeVisible();
    expect(screen.getByAltText('白芷的头像')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '投票给 雨夜新装' }));
    expect(screen.getByText('同一作品当天只能投一次')).toBeVisible();
  });

  test('uploads a work and saves a single public submission without operational controls', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ phase: 'submission' })} />);

    await user.click(await screen.findByRole('link', { name: '我要投稿' }));
    await user.type(screen.getByLabelText('作品标题'), '雨中相逢');
    await user.upload(screen.getByLabelText('添加作品文件'), [
      new File(['image'], 'work-1.png', { type: 'image/png' }),
      new File(['image'], 'work-2.png', { type: 'image/png' }),
      new File(['image'], 'work-3.png', { type: 'image/png' }),
      new File(['image'], 'work-4.png', { type: 'image/png' })
    ]);
    await user.click(screen.getByRole('button', { name: '提交作品' }));

    await waitFor(() => expect(screen.getByText('投稿已提交，审核通过后才会进入盲选和展示')).toBeVisible());
    expect(screen.queryByText('设置入围')).not.toBeInTheDocument();
  });

  test('shows the track media requirement before uploading an incomplete submission', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ phase: 'submission' })} />);

    await user.click(await screen.findByRole('link', { name: '我要投稿' }));
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
