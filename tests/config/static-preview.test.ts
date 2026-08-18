import { describe, expect, test } from 'vitest';
import { canUseDemoPreview } from '../../src/config/static-preview';

describe('static preview configuration', () => {
  test('enables the demo fallback for an explicit static preview build', () => {
    expect(canUseDemoPreview({ DEV: false, VITE_STATIC_PREVIEW: 'true' })).toBe(true);
  });

  test('keeps a production build connected to its configured backend', () => {
    expect(canUseDemoPreview({ DEV: false })).toBe(false);
  });
});
