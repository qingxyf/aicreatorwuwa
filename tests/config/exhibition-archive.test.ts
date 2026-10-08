import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { exhibitionManifest } from '../../src/config/exhibition';
import { resolveExhibitionBackupDirectory, selectExhibitionWorks, verifyExhibitionArchive } from '../../scripts/export-exhibition.mjs';

describe('exhibition export safeguards', () => {
  test('keeps private backup snapshots outside the repository and published assets', () => {
    const root = resolve('example-repository');
    expect(() => resolveExhibitionBackupDirectory(root, root)).toThrow(/outside the repository/);
    expect(() => resolveExhibitionBackupDirectory(root, resolve(root, 'public/backups'))).toThrow(/outside the repository/);
    const sibling = resolve(root, '../example-private-archive');
    expect(resolveExhibitionBackupDirectory(root, sibling)).toBe(sibling);
  });
  test('verifies every original media file and author avatar against its saved byte size and SHA-256', async () => {
    const manifest = await verifyExhibitionArchive(resolve('.'));
    expect(manifest.works).toHaveLength(2);
    expect(manifest.works.flatMap((work: { media: unknown[] }) => work.media)).toHaveLength(12);
  });

  test('rejects incomplete real submissions or a changed author instead of publishing a partial exhibition', () => {
    const incomplete = structuredClone(exhibitionManifest.works);
    incomplete[1].media.pop();
    expect(() => selectExhibitionWorks(incomplete)).toThrow(/confirmed submission/);
    const changedAuthor = structuredClone(exhibitionManifest.works);
    changedAuthor[0].authorName = '测试';
    expect(() => selectExhibitionWorks(changedAuthor)).toThrow(/confirmed submission/);
  });

  test.each(['extra', 'duplicate'] as const)('rejects a public manifest containing an additional %s work instead of silently publishing it', async (kind) => {
    const root = await mkdtemp(resolve(tmpdir(), 'wuwa-exhibition-test-'));
    try {
      const manifest = structuredClone(exhibitionManifest);
      const bytes = Buffer.from('test archive asset');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      await mkdir(resolve(root, 'src/config'), { recursive: true });
      await mkdir(resolve(root, 'public/exhibition'), { recursive: true });
      for (const work of manifest.works) {
        const assets = [work.avatar, ...work.media, ...work.media.flatMap((media) => media.preview ? [media.preview] : [])];
        for (const asset of assets) {
          asset.byteSize = bytes.length;
          asset.sha256 = sha256;
          await writeFile(resolve(root, 'public', asset.path), bytes);
        }
      }
      const extra = structuredClone(manifest.works[0]);
      if (kind === 'extra') extra.id = 'test-work-not-approved-for-display';
      manifest.works.push(extra);
      await writeFile(resolve(root, 'src/config/exhibition-manifest.json'), JSON.stringify(manifest));
      await expect(verifyExhibitionArchive(root)).rejects.toThrow(/exactly the two confirmed works/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
