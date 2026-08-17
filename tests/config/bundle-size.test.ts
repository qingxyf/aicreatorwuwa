import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { readBundleSize, toyBundleLimitBytes } from '../../scripts/harness/check-bundle-size.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

describe('Toy deployment bundle limit', () => {
  test('counts files recursively and keeps the limit at 140 MB', () => {
    const directory = mkdtempSync(join(tmpdir(), 'wuwa-toy-bundle-'));
    temporaryDirectories.push(directory);
    mkdirSync(join(directory, 'assets'));
    writeFileSync(join(directory, 'index.html'), '1234');
    writeFileSync(join(directory, 'assets', 'app.js'), '123456');

    expect(readBundleSize(directory)).toBe(10);
    expect(toyBundleLimitBytes).toBe(140 * 1024 * 1024);
  });
});
