import { expect, test } from 'vitest';
import { inspectArchitecture, validateArchitecture } from '../scripts/harness/check-architecture.mjs';

test('rejects imports from a lower layer to a higher layer', () => {
  expect(validateArchitecture('domain', '../app/App')).toBe(false);
});

test('keeps the application source free of layer-boundary violations', () => {
  expect(inspectArchitecture()).toEqual([]);
});
