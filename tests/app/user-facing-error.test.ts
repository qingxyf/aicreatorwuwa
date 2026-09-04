import { describe, expect, test } from 'vitest';
import { userFacingError } from '../../src/app/user-facing-error';

describe('user-facing error messages', () => {
  test('translates API error codes instead of exposing implementation names', () => {
    expect(userFacingError(new Error('rate_limit_exceeded'), 'fallback')).toBe('操作太频繁，请稍后再试。');
    expect(userFacingError(new Error('submission_limit'), 'fallback')).toContain('投稿数量已达上限');
  });

  test('uses a safe fallback for unknown errors', () => {
    expect(userFacingError(new Error('some_internal_code'), '操作失败，请稍后重试。')).toBe('操作失败，请稍后重试。');
  });
});
