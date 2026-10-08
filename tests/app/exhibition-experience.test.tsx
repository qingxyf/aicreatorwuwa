import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ExhibitionApp } from '../../src/app/ExhibitionApp';

afterEach(() => vi.unstubAllGlobals());

describe('static exhibition experience', () => {
  test('shows only the two confirmed real submissions, all twelve images, and local author avatars without API requests', () => {
    const fetch = vi.fn(() => { throw new Error('Backend is offline'); });
    vi.stubGlobal('fetch', fetch);
    render(<ExhibitionApp />);

    expect(screen.getByText('投稿已结束 · 本期作品展示')).toBeVisible();
    expect(screen.getByRole('heading', { name: '弥汐辞' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '拉海洛全角色国风服装' })).toBeVisible();
    expect(screen.getByText('朴一文')).toBeVisible();
    expect(screen.getByText('ai凌时工作室')).toBeVisible();
    expect(screen.getAllByRole('img', { name: /第 \d+ 张作品图$/ })).toHaveLength(12);
    const imagePaths = screen.getAllByRole('img', { name: /作品图$|的头像$/ }).map((image) => image.getAttribute('src'));
    expect(imagePaths).toHaveLength(14);
    expect(imagePaths.every((path) => path?.includes('exhibition/') && !path.includes('://'))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: '我要投稿' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '参与投票' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /投票|提交作品|盲选/ })).not.toBeInTheDocument();
    expect(screen.queryByText('测试')).not.toBeInTheDocument();
  });

  test('opens the image viewer with the full image and lets visitors view the next image', async () => {
    const user = userEvent.setup();
    render(<ExhibitionApp />);
    await user.click(screen.getByRole('img', { name: '弥汐辞 · 第 1 张作品图' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toBeVisible());
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', expect.stringContaining('exhibition/0bd02f8c-6e0d-44b9-8a2f-870f129f0e18.jpg'));
    expect(document.querySelector('.ant-image-preview-switch-right')).not.toBeNull();
    await user.click(document.querySelector('.ant-image-preview-switch-right')!);
    await waitFor(() => expect(within(dialog).getByRole('img')).toHaveAttribute('src', expect.stringContaining('exhibition/ab05783f-633c-4bff-a83a-b0e2f2bc7b12.jpg')));
  });
});
