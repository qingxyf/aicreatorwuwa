import { describe, expect, test } from 'vitest';
import { isOperationsRoute } from '../../src/app/route';

describe('application entry routes', () => {
  test('recognizes the Toy-safe operations HTML entry without exposing it in the public page', () => {
    expect(isOperationsRoute('/toy/preview/example/ops.html')).toBe(true);
    expect(isOperationsRoute('/toy/preview/example/ops')).toBe(true);
    expect(isOperationsRoute('/toy/preview/example/index.html')).toBe(false);
  });
});
