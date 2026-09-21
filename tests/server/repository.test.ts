import { describe, expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PostgresContestRepository } from '../../server/repository';

function createPool(rows: unknown[] = []) {
  const query = vi.fn(async () => ({ rows, rowCount: rows.length }));
  return { pool: { query } as never, query };
}

describe('PostgresContestRepository query contracts', () => {
  test('checks for historical duplicates before adding the lifetime submission constraint', async () => {
    const migration = await readFile('server/migrations/003_submission_integrity.sql', 'utf8');
    const duplicateCheck = migration.indexOf('HAVING COUNT(*) > 1');
    const uniqueIndex = migration.indexOf('CREATE UNIQUE INDEX');

    expect(duplicateCheck).toBeGreaterThanOrEqual(0);
    expect(uniqueIndex).toBeGreaterThan(duplicateCheck);
  });

  test('counts every historical submission for the per-account track limit', async () => {
    const { pool, query } = createPool([{ count: '1' }]);
    const repository = new PostgresContestRepository(pool);

    await expect(repository.countActiveSubmissions('viewer-1', 'resonance-style')).resolves.toBe(1);
    expect(query.mock.calls[0][0]).not.toContain("status <> 'hidden'");
  });

  test('orders the gallery by an integer vote alias valid in PostgreSQL', async () => {
    const { pool, query } = createPool([]);
    const repository = new PostgresContestRepository(pool);

    await expect(repository.listGallery('resonance-style')).resolves.toEqual([]);
    expect(query.mock.calls[0][0]).toContain(')::int AS final_votes');
    expect(query.mock.calls[0][0]).toContain('ORDER BY final_votes DESC');
    expect(query.mock.calls[0][0]).not.toContain('final_votes::int');
  });

  test('uses issued pairing assignments for exposure counts and seen works', async () => {
    const approved = createPool([]);
    const repository = new PostgresContestRepository(approved.pool);
    await repository.listApprovedWorks('resonance-style');
    expect(approved.query.mock.calls[0][0]).toContain('FROM pairing_assignments');

    const compared = createPool([{ work_id: 'work-a' }]);
    const comparedRepository = new PostgresContestRepository(compared.pool);
    await expect(comparedRepository.listComparedWorkIds('viewer-1', 'resonance-style')).resolves.toEqual(['work-a']);
    expect(compared.query.mock.calls[0][0]).toContain('FROM pairing_assignments');

    const operations = createPool([]);
    const operationsRepository = new PostgresContestRepository(operations.pool);
    await operationsRepository.listOperatorSubmissions();
    expect(operations.query.mock.calls[0][0]).toContain('FROM pairing_assignments');
  });

  test('only treats approved or displayed finalist media as public', async () => {
    const { pool, query } = createPool([{ is_public: true }]);
    const repository = new PostgresContestRepository(pool);

    await expect(repository.isMediaPublic('media-1')).resolves.toBe(true);
    expect(query.mock.calls[0][0]).toContain("s.status = 'approved'");
    expect(query.mock.calls[0][0]).toContain("s.status = 'finalist' AND s.is_displayed = TRUE");
  });

  test('groups unreferenced media by submission attempt and historical upload window', async () => {
    const { pool, query } = createPool([
      { id: 'media-attempt-1', owner_id: 'owner-a', attempt_id: 'attempt-1', attempt_status: 'failed', failure_reason: 'submission_limit', track_id: 'wardrobe-design', title: '失败尝试', author_name: '投稿人 A', mime_type: 'image/png', kind: 'image', byte_size: '100', created_at: '2026-09-04T12:00:00.000Z' },
      { id: 'media-history-1', owner_id: 'owner-b', attempt_id: null, attempt_status: null, failure_reason: null, track_id: null, title: null, author_name: null, mime_type: 'image/jpeg', kind: 'image', byte_size: '200', created_at: '2026-09-04T12:10:00.000Z' },
      { id: 'media-history-2', owner_id: 'owner-b', attempt_id: null, attempt_status: null, failure_reason: null, track_id: null, title: null, author_name: null, mime_type: 'image/jpeg', kind: 'image', byte_size: '300', created_at: '2026-09-04T12:15:00.000Z' }
    ]);
    const repository = new PostgresContestRepository(pool, 'https://api.test');

    await expect(repository.listOperatorOrphanMedia()).resolves.toEqual([
      {
        id: 'attempt-1',
        ownerId: 'owner-a',
        authorName: '投稿人 A',
        attemptId: 'attempt-1',
        trackId: 'wardrobe-design',
        title: '失败尝试',
        status: 'failed',
        failureReason: 'submission_limit',
        firstUploadedAt: '2026-09-04T12:00:00.000Z',
        lastUploadedAt: '2026-09-04T12:00:00.000Z',
        media: [{ id: 'media-attempt-1', url: 'https://api.test/api/v1/media/media-attempt-1', kind: 'image', mimeType: 'image/png' }]
      },
      {
        id: 'historical-owner-b-2026-09-04T12:10:00.000Z',
        ownerId: 'owner-b',
        authorName: '',
        attemptId: undefined,
        trackId: undefined,
        title: undefined,
        status: 'historical',
        failureReason: 'uploaded_without_submission',
        firstUploadedAt: '2026-09-04T12:10:00.000Z',
        lastUploadedAt: '2026-09-04T12:15:00.000Z',
        media: [
          { id: 'media-history-1', url: 'https://api.test/api/v1/media/media-history-1', kind: 'image', mimeType: 'image/jpeg' },
          { id: 'media-history-2', url: 'https://api.test/api/v1/media/media-history-2', kind: 'image', mimeType: 'image/jpeg' }
        ]
      }
    ]);
    expect(query.mock.calls[0][0]).toContain('NOT EXISTS');
    expect(query.mock.calls[0][0]).toContain('submission_attempts');
  });
});
