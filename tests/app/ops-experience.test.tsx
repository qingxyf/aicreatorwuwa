import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { OpsApp, type OperationsApi } from '../../src/app/OpsApp';

const activitySettings = {
  phase: 'submission' as const,
  previewMode: false,
  schedule: {
    submission: { label: '投稿阶段' },
    pairing: { label: '盲选阶段' },
    finalVote: { label: '投票阶段' }
  }
};

describe('operations experience', () => {
  test('waits for a user gesture before requesting the Toy profile', async () => {
    const currentViewer = vi.fn(async () => ({ id: 'operator', name: '运营', avatarUrl: '' }));
    const api: OperationsApi = {
      currentViewer,
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    };
    const user = userEvent.setup();

    render(<OpsApp api={api} />);

    expect(currentViewer).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '验证身份并进入' }));
    expect(await screen.findByRole('heading', { name: '运营工作台' })).toBeVisible();
    expect(screen.getByText('白名单验证通过')).toBeVisible();
    expect(currentViewer).toHaveBeenCalledTimes(1);
  });

  test('lets an operator control finalist and public-display state separately', async () => {
    const setSubmissionStatus = vi.fn(async () => undefined);
    const api: OperationsApi = {
      currentViewer: async () => ({ id: 'operator', name: '运营', avatarUrl: '' }),
      listSubmissions: async () => [{
        id: 'work-1',
        title: '雨夜新装',
        authorName: '白芷',
        authorAvatar: '',
        media: [],
        finalVotes: 15,
        trackId: 'brocade-wardrobe',
        status: 'finalist',
        isDisplayed: false,
        pairingWins: 8,
        exposureCount: 24,
        createdAt: '2026-08-18T00:00:00.000Z'
      }],
      setSubmissionStatus,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    };
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.click(screen.getByRole('button', { name: '验证身份并进入' }));
    await user.click(await screen.findByRole('switch', { name: '展示 雨夜新装' }));

    expect(setSubmissionStatus).toHaveBeenCalledWith('work-1', 'finalist', true);
  });

  test('lets an operator save the public phase, preview mode and schedule', async () => {
    const saveActivitySettings = vi.fn(async () => activitySettings);
    const api: OperationsApi = {
      currentViewer: async () => ({ id: 'operator', name: '运营', avatarUrl: '' }),
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings
    };
    const user = userEvent.setup();
    render(<OpsApp api={api} />);
    await user.click(screen.getByRole('button', { name: '验证身份并进入' }));

    await user.click(await screen.findByRole('button', { name: '保存活动流程' }));

    expect(saveActivitySettings).toHaveBeenCalledWith(activitySettings);
  });
});
