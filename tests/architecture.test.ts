import { expect, test } from 'vitest';
import { validateArchitecture } from '../scripts/harness/check-architecture.mjs';

test('rejects imports from a lower layer to a higher layer', () => {
  expect(validateArchitecture('domain', '../app/App')).toBe(false);
});
