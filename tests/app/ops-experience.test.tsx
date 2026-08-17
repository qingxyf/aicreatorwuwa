import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { OpsApp, type OperationsApi } from '../../src/app/OpsApp';

describe('operations experience', () => {
  test('renders only after the protected operations API has accepted the viewer', async () => {
    const api: OperationsApi = {
      currentViewer: async () => ({ id: 'operator', name: '运营', avatarUrl: '' }),
      listSubmissions: async () => [],
      setSubmissionStatus: async () => undefined
    };

    render(<OpsApp api={api} />);

    expect(await screen.findByRole('heading', { name: '运营工作台' })).toBeVisible();
    expect(screen.getByText('白名单验证通过')).toBeVisible();
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
      setSubmissionStatus
    };
    const user = userEvent.setup();

    render(<OpsApp api={api} />);
    await user.click(await screen.findByRole('switch', { name: '展示 雨夜新装' }));

    expect(setSubmissionStatus).toHaveBeenCalledWith('work-1', 'finalist', true);
  });
});
