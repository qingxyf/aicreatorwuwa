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
    finalVote: { label: '公开投票阶段' },
    results: { label: '结果公示阶段' }
  }
};

function testLogin(api: OperationsApi) {
  return { ...api, loginOperations: api.loginOperations ?? (async () => ({ expiresAt: '2026-08-21T14:00:00.000Z' })), clearOperationsSession: api.clearOperationsSession ?? vi.fn() };
}

describe('operations experience', () => {
  test('waits for a user gesture before submitting the operations password', async () => {
    const loginOperations = vi.fn(async () => ({ expiresAt: '2026-08-21T14:00:00.000Z' }));
    const api: OperationsApi = testLogin({
      loginOperations,
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    });
    const user = userEvent.setup();

    render(<OpsApp api={api} />);

    expect(loginOperations).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('运营后台密码'), 'test-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));
    expect(await screen.findByRole('heading', { name: '运营工作台' })).toBeVisible();
    expect(screen.getByText('密码验证通过')).toBeVisible();
    expect(loginOperations).toHaveBeenCalledWith('test-password');
  });

  test('keeps the login card visible when the operations password is rejected', async () => {
    const api: OperationsApi = testLogin({
      loginOperations: vi.fn(async () => { throw new Error('operator_login_failed'); }),
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    });
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.type(screen.getByLabelText('运营后台密码'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));

    expect(await screen.findByText('operator_login_failed')).toBeVisible();
    expect(screen.getByLabelText('运营后台密码')).toBeVisible();
  });

  test('explains when the operations endpoint has not been deployed', async () => {
    const api: OperationsApi = testLogin({
      loginOperations: vi.fn(async () => { throw new Error('operator_endpoint_unavailable'); }),
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    });
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.type(screen.getByLabelText('运营后台密码'), 'test-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));

    expect(await screen.findByText('运营后台接口尚未部署到服务器，请先更新 ECS 后端。')).toBeVisible();
  });

  test('lets an operator control finalist and public-display state separately', async () => {
    const setSubmissionStatus = vi.fn(async () => undefined);
    const api: OperationsApi = testLogin({
      listSubmissions: async () => [{
        id: 'work-1',
        title: '雨夜新装',
        authorName: '白芷',
        authorAvatar: '',
        media: [],
        finalVotes: 15,
        trackId: 'wardrobe-design',
        status: 'finalist',
        isDisplayed: false,
        pairingWins: 8,
        exposureCount: 24,
        createdAt: '2026-08-18T00:00:00.000Z'
      }],
      setSubmissionStatus,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    });
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.type(screen.getByLabelText('运营后台密码'), 'test-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));
    await user.click(await screen.findByRole('switch', { name: '展示 雨夜新装' }));

    expect(setSubmissionStatus).toHaveBeenCalledWith('work-1', 'finalist', true);
  });

  test('returns to the password card when an operations session expires', async () => {
    const clearOperationsSession = vi.fn();
    const api: OperationsApi = testLogin({
      clearOperationsSession,
      listSubmissions: async () => [{
        id: 'work-expired',
        title: '会话过期作品',
        authorName: '投稿者',
        authorAvatar: '',
        media: [],
        finalVotes: 0,
        trackId: 'wardrobe-design',
        status: 'finalist',
        isDisplayed: false,
        pairingWins: 0,
        exposureCount: 0,
        createdAt: '2026-08-20T00:00:00.000Z'
      }],
      setSubmissionStatus: async () => { throw new Error('operator_session_required'); },
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    });
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.type(screen.getByLabelText('运营后台密码'), 'test-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));
    await user.click(await screen.findByRole('switch', { name: '展示 会话过期作品' }));

    expect(clearOperationsSession).toHaveBeenCalled();
    expect(screen.getByLabelText('运营后台密码')).toBeVisible();
  });

  test('shows the submitted media to the operator before it is approved', async () => {
    const api: OperationsApi = testLogin({
      listSubmissions: async () => [{
        id: 'pending-work',
        title: '待审作品',
        authorName: '投稿者',
        authorAvatar: '',
        media: [{ id: 'media-1', url: 'https://media.test/pending.png', kind: 'image', mimeType: 'image/png' }],
        finalVotes: 0,
        trackId: 'resonance-style',
        status: 'pending',
        isDisplayed: false,
        pairingWins: 0,
        exposureCount: 0,
        createdAt: '2026-08-20T00:00:00.000Z'
      }],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings: async () => activitySettings
    });
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.type(screen.getByLabelText('运营后台密码'), 'test-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));

    expect(await screen.findByAltText('待审作品的作品预览')).toBeVisible();
    expect(screen.getAllByText('待审核').length).toBeGreaterThan(0);
  });

  test('lets an operator save the public phase, preview mode and schedule', async () => {
    const saveActivitySettings = vi.fn(async (settings) => settings);
    const api: OperationsApi = testLogin({
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined,
      getActivitySettings: async () => activitySettings,
      saveActivitySettings
    });
    const user = userEvent.setup();
    render(<OpsApp api={api} />);
    await user.type(screen.getByLabelText('运营后台密码'), 'test-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));

    await user.click(screen.getByTitle('投稿阶段'));
    const phaseOptions = screen.getAllByText('盲选阶段', { exact: true });
    await user.click(phaseOptions[phaseOptions.length - 1]);
    await user.click(await screen.findByRole('button', { name: '保存活动流程' }));

    expect(saveActivitySettings).toHaveBeenCalledWith(expect.objectContaining({ phase: 'pairing' }));
  });

});
