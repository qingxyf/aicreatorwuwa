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
});
