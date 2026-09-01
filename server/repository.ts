import type pg from 'pg';
import { defaultActivitySettings } from '../src/config/activity';
import { firstStagePolicy, secondStagePolicy } from '../src/policy/voting';
import type { WorkStatus } from '../src/types/activity';
import type {
  ActivitySettings,
  ActivitySettingsRepository,
  ContestRepository,
  ContestTrackId,
  FinalVoteInput,
  OperatorSubmission,
  PairingVoteInput,
  PublicGalleryWork,
  PublicPairingWork,
  RateLimitRule,
  SubmissionInput,
  SubmissionRecord
} from '../src/types/contest';
import type { UploadedMedia } from '../src/types/platform';
import { withTransaction } from './db';

interface MediaRow { id: string; mime_type: string; }
interface ActivityRow { phase: ActivitySettings['phase']; preview_mode: boolean; submission_start_at: string | null; submission_end_at: string | null; pairing_start_at: string | null; pairing_end_at: string | null; final_vote_start_at: string | null; final_vote_end_at: string | null; results_start_at: string | null; results_end_at: string | null; }

function mediaIdsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try { return mediaIdsFrom(JSON.parse(value)); } catch { return []; }
}

function activityFromRow(row: ActivityRow): ActivitySettings {
  return {
    phase: row.phase,
    previewMode: row.preview_mode,
    schedule: {
      submission: { label: '投稿阶段', startAt: row.submission_start_at ?? undefined, endAt: row.submission_end_at ?? undefined },
      pairing: { label: '盲选阶段', startAt: row.pairing_start_at ?? undefined, endAt: row.pairing_end_at ?? undefined },
      finalVote: { label: '公开投票阶段', startAt: row.final_vote_start_at ?? undefined, endAt: row.final_vote_end_at ?? undefined },
      results: { label: '结果公示阶段', startAt: row.results_start_at ?? undefined, endAt: row.results_end_at ?? undefined }
    }
  };
}

export class PostgresContestRepository implements ContestRepository, ActivitySettingsRepository {
  constructor(private readonly pool: pg.Pool, private readonly mediaBaseUrl = '') {}

  async consumeRateLimit(viewerId: string, route: string, rule: RateLimitRule, now = Date.now()): Promise<boolean> {
    const windowStartedAt = Math.floor(now / rule.windowMs) * rule.windowMs;
    const result = await this.pool.query<{ request_count: number }>(`INSERT INTO request_rate_limits (viewer_id, route_key, window_started_at, request_count, updated_at)
      VALUES ($1, $2, $3, 1, $4)
      ON CONFLICT (viewer_id, route_key, window_started_at)
      DO UPDATE SET request_count = request_rate_limits.request_count + 1, updated_at = EXCLUDED.updated_at
      WHERE request_rate_limits.request_count < $5
      RETURNING request_count`, [viewerId, route, windowStartedAt, now, rule.limit]);
    return result.rowCount === 1;
  }

  async getActivitySettings(): Promise<ActivitySettings> {
    const result = await this.pool.query<ActivityRow>(`SELECT phase, preview_mode, submission_start_at, submission_end_at,
      pairing_start_at, pairing_end_at, final_vote_start_at, final_vote_end_at, results_start_at, results_end_at
      FROM activity_settings WHERE id = 'default'`);
    return result.rows[0] ? activityFromRow(result.rows[0]) : this.defaultSettings();
  }

  async saveActivitySettings(settings: ActivitySettings): Promise<ActivitySettings> {
    await this.pool.query(`INSERT INTO activity_settings (id, phase, preview_mode, submission_start_at, submission_end_at,
      pairing_start_at, pairing_end_at, final_vote_start_at, final_vote_end_at, results_start_at, results_end_at, updated_at)
      VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO UPDATE SET phase = EXCLUDED.phase, preview_mode = EXCLUDED.preview_mode,
      submission_start_at = EXCLUDED.submission_start_at, submission_end_at = EXCLUDED.submission_end_at,
      pairing_start_at = EXCLUDED.pairing_start_at, pairing_end_at = EXCLUDED.pairing_end_at,
      final_vote_start_at = EXCLUDED.final_vote_start_at, final_vote_end_at = EXCLUDED.final_vote_end_at,
      results_start_at = EXCLUDED.results_start_at, results_end_at = EXCLUDED.results_end_at, updated_at = NOW()`, [
      settings.phase, settings.previewMode, settings.schedule.submission.startAt ?? null, settings.schedule.submission.endAt ?? null,
      settings.schedule.pairing.startAt ?? null, settings.schedule.pairing.endAt ?? null,
      settings.schedule.finalVote.startAt ?? null, settings.schedule.finalVote.endAt ?? null,
      settings.schedule.results.startAt ?? null, settings.schedule.results.endAt ?? null
    ]);
    return settings;
  }

  async countActiveSubmissions(authorId: string, trackId: ContestTrackId): Promise<number> {
    const result = await this.pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM submissions
      WHERE author_id = $1 AND track_id = $2`, [authorId, trackId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async areMediaOwnedBy(authorId: string, mediaIds: string[]): Promise<boolean> {
    const unique = [...new Set(mediaIds)];
    if (unique.length === 0 || unique.length !== mediaIds.length) return false;
    const result = await this.pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM media_objects WHERE owner_id = $1 AND id = ANY($2::text[])`, [authorId, unique]);
    return Number(result.rows[0]?.count ?? 0) === unique.length;
  }

  async listOwnedMediaKinds(authorId: string, mediaIds: string[]): Promise<Array<'image' | 'video'>> {
    const unique = [...new Set(mediaIds)];
    if (unique.length === 0 || unique.length !== mediaIds.length) return [];
    const result = await this.pool.query<{ kind: 'image' | 'video' }>(`SELECT kind FROM media_objects WHERE owner_id = $1 AND id = ANY($2::text[]) ORDER BY array_position($2::text[], id)`, [authorId, unique]);
    return result.rows.map((row) => row.kind);
  }

  async createSubmission(input: SubmissionInput): Promise<SubmissionRecord> {
    return withTransaction(this.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`submission:${input.authorId}:${input.trackId}`]);
      const count = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM submissions WHERE author_id = $1 AND track_id = $2`, [input.authorId, input.trackId]);
      if (Number(count.rows[0]?.count ?? 0) >= 1) throw new Error('submission_limit');
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      try {
        await client.query(`INSERT INTO submissions (id, track_id, author_id, author_name, author_avatar, title, character_name, description, media_json, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)`, [
          id, input.trackId, input.authorId, input.authorName ?? '', input.authorAvatar ?? '', input.title,
          input.characterName ?? '', input.description ?? '', JSON.stringify(input.mediaIds ?? []), createdAt
        ]);
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new Error('submission_limit');
        throw error;
      }
      return { ...input, id, status: 'pending', createdAt };
    });
  }

  async listApprovedWorks(trackId: ContestTrackId) {
    const result = await this.pool.query(`SELECT id, track_id AS "trackId", author_id AS "authorId", title, status,
      (SELECT COUNT(*) FROM pairing_assignments pa WHERE pa.work_a_id = s.id OR pa.work_b_id = s.id)::int AS "exposureCount",
      (SELECT COUNT(*) FROM pairing_votes pv WHERE pv.winner_work_id = s.id)::int AS "pairingWins", created_at AS "createdAt"
      FROM submissions s WHERE track_id = $1 AND status = 'approved' ORDER BY "exposureCount", "pairingWins", created_at`, [trackId]);
    return result.rows;
  }

  async listComparedWorkIds(viewerId: string, trackId: ContestTrackId): Promise<string[]> {
    const result = await this.pool.query<{ work_id: string }>(`SELECT work_a_id AS work_id FROM pairing_assignments WHERE viewer_id = $1 AND track_id = $2
      UNION SELECT work_b_id FROM pairing_assignments WHERE viewer_id = $1 AND track_id = $2`, [viewerId, trackId]);
    return result.rows.map((row) => row.work_id);
  }

  async countPairingVotes(viewerId: string, trackId: ContestTrackId): Promise<number> {
    const result = await this.pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM pairing_votes WHERE viewer_id = $1 AND track_id = $2', [viewerId, trackId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async createPairingAssignment(viewerId: string, trackId: ContestTrackId, workIds: [string, string]): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(`INSERT INTO pairing_assignments (id, viewer_id, track_id, work_a_id, work_b_id, issued_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '15 minutes')`, [id, viewerId, trackId, workIds[0], workIds[1]]);
    return id;
  }

  async recordPairingVote(input: PairingVoteInput): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const assignment = await client.query<{ viewer_id: string; track_id: ContestTrackId; work_a_id: string; work_b_id: string; consumed_at: string | null; expires_at: string }>(`SELECT viewer_id, track_id, work_a_id, work_b_id, consumed_at, expires_at
        FROM pairing_assignments WHERE id = $1 FOR UPDATE`, [input.assignmentId]);
      const row = assignment.rows[0];
      if (!row || row.viewer_id !== input.viewerId || row.track_id !== input.trackId || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now() || ![row.work_a_id, row.work_b_id].includes(input.preferredWorkId)) return false;
      const count = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM pairing_votes WHERE viewer_id = $1 AND track_id = $2', [input.viewerId, input.trackId]);
      if (Number(count.rows[0]?.count ?? 0) >= firstStagePolicy.votesPerTrack) return false;
      const workCheck = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM submissions WHERE id = ANY($1::text[]) AND status = 'approved'`, [[row.work_a_id, row.work_b_id]]);
      if (Number(workCheck.rows[0]?.count ?? 0) !== 2) return false;
      await client.query(`INSERT INTO pairing_votes (id, assignment_id, viewer_id, track_id, winner_work_id, work_a_id, work_b_id, voted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`, [crypto.randomUUID(), input.assignmentId, input.viewerId, input.trackId, input.preferredWorkId, row.work_a_id, row.work_b_id]);
      await client.query('UPDATE pairing_assignments SET consumed_at = NOW() WHERE id = $1', [input.assignmentId]);
      return true;
    });
  }

  async listDailyFinalVoteWorkIds(viewerId: string, trackId: ContestTrackId, day: string): Promise<string[]> {
    const result = await this.pool.query<{ work_id: string }>('SELECT work_id FROM final_votes WHERE viewer_id = $1 AND track_id = $2 AND vote_day = $3', [viewerId, trackId, day]);
    return result.rows.map((row) => row.work_id);
  }

  async recordFinalVote(input: FinalVoteInput): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`final-vote:${input.viewerId}:${input.trackId}:${input.day}`]);
      const count = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM final_votes WHERE viewer_id = $1 AND track_id = $2 AND vote_day = $3', [input.viewerId, input.trackId, input.day]);
      if (Number(count.rows[0]?.count ?? 0) >= secondStagePolicy.votesPerTrackPerDay) return false;
      const finalist = await client.query<{ id: string }>(`SELECT id FROM submissions WHERE id = $1 AND track_id = $2 AND status = 'finalist' AND is_displayed = TRUE`, [input.workId, input.trackId]);
      if (!finalist.rows[0]) return false;
      try {
        await client.query(`INSERT INTO final_votes (id, viewer_id, track_id, work_id, vote_day, voted_at) VALUES ($1, $2, $3, $4, $5, NOW())`, [crypto.randomUUID(), input.viewerId, input.trackId, input.workId, input.day]);
        return true;
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') return false;
        throw error;
      }
    });
  }

  async recordMedia(ownerId: string, media: UploadedMedia, byteSize: number): Promise<void> {
    await this.pool.query(`INSERT INTO media_objects (id, owner_id, kind, mime_type, byte_size, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`, [media.id, ownerId, media.kind, media.mimeType, byteSize]);
  }

  async isMediaPublic(id: string): Promise<boolean> {
    const result = await this.pool.query<{ is_public: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.media_json @> jsonb_build_array($1::text)
        AND (s.status = 'approved' OR (s.status = 'finalist' AND s.is_displayed = TRUE))
    ) AS is_public`, [id]);
    return result.rows[0]?.is_public === true;
  }

  async listPairingWorks(ids: [string, string]): Promise<PublicPairingWork[]> {
    const result = await this.pool.query<{ id: string; title: string; media_json: unknown }>(`SELECT id, title, media_json FROM submissions WHERE id = ANY($1::text[]) AND status = 'approved'`, [ids]);
    const media = await this.mediaById(result.rows.flatMap((row) => mediaIdsFrom(row.media_json)));
    const byId = new Map(result.rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => { const row = byId.get(id); return row ? [{ id: row.id, title: row.title, media: this.hydrateMedia(mediaIdsFrom(row.media_json), media) }] : []; });
  }

  async listGallery(trackId: ContestTrackId): Promise<PublicGalleryWork[]> {
    const result = await this.pool.query<{ id: string; title: string; author_name: string; author_avatar: string; media_json: unknown; final_votes: number }>(`SELECT s.id, s.title, s.author_name, s.author_avatar, s.media_json,
      (SELECT COUNT(*) FROM final_votes fv WHERE fv.work_id = s.id)::int AS final_votes
      FROM submissions s WHERE s.track_id = $1 AND s.status = 'finalist' AND s.is_displayed = TRUE
      ORDER BY final_votes DESC, s.created_at ASC`, [trackId]);
    const media = await this.mediaById(result.rows.flatMap((row) => mediaIdsFrom(row.media_json)));
    return result.rows.map((row) => ({ id: row.id, title: row.title, authorName: row.author_name, authorAvatar: row.author_avatar, media: this.hydrateMedia(mediaIdsFrom(row.media_json), media), finalVotes: Number(row.final_votes) }));
  }

  async isOperator(viewerId: string): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 FROM admins WHERE viewer_id = $1', [viewerId]);
    return result.rowCount === 1;
  }

  async listOperatorSubmissions(): Promise<OperatorSubmission[]> {
    const result = await this.pool.query<{ id: string; track_id: ContestTrackId; title: string; author_name: string; author_avatar: string; media_json: unknown; final_votes: string; status: WorkStatus; is_displayed: boolean; pairing_wins: string; exposure_count: string; created_at: string }>(`SELECT s.id, s.track_id, s.title, s.author_name, s.author_avatar, s.media_json,
      (SELECT COUNT(*) FROM final_votes fv WHERE fv.work_id = s.id)::text AS final_votes, s.status, s.is_displayed,
      (SELECT COUNT(*) FROM pairing_votes pv WHERE pv.winner_work_id = s.id)::text AS pairing_wins,
      (SELECT COUNT(*) FROM pairing_assignments pa WHERE pa.work_a_id = s.id OR pa.work_b_id = s.id)::text AS exposure_count, s.created_at
      FROM submissions s ORDER BY s.created_at DESC`);
    const media = await this.mediaById(result.rows.flatMap((row) => mediaIdsFrom(row.media_json)));
    return result.rows.map((row) => ({ id: row.id, title: row.title, authorName: row.author_name, authorAvatar: row.author_avatar, media: this.hydrateMedia(mediaIdsFrom(row.media_json), media), finalVotes: Number(row.final_votes), trackId: row.track_id, status: row.status, isDisplayed: row.is_displayed, pairingWins: Number(row.pairing_wins), exposureCount: Number(row.exposure_count), createdAt: row.created_at }));
  }

  async setSubmissionState(id: string, status: WorkStatus, isDisplayed: boolean): Promise<void> {
    await this.pool.query('UPDATE submissions SET status = $1, is_displayed = $2 WHERE id = $3', [status, status === 'finalist' && isDisplayed, id]);
  }

  private async mediaById(ids: string[]): Promise<Map<string, UploadedMedia>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const result = await this.pool.query<MediaRow>('SELECT id, mime_type FROM media_objects WHERE id = ANY($1::text[])', [unique]);
    return new Map(result.rows.map((row) => [row.id, { id: row.id, url: `${this.mediaBaseUrl.replace(/\/$/, '')}/api/v1/media/${row.id}`, kind: row.mime_type.startsWith('video/') ? 'video' : 'image', mimeType: row.mime_type }]));
  }

  private hydrateMedia(ids: string[], media: Map<string, UploadedMedia>): UploadedMedia[] {
    return ids.flatMap((id) => { const item = media.get(id); return item ? [item] : []; });
  }

  private defaultSettings(): ActivitySettings {
    return { ...defaultActivitySettings, schedule: { submission: { ...defaultActivitySettings.schedule.submission }, pairing: { ...defaultActivitySettings.schedule.pairing }, finalVote: { ...defaultActivitySettings.schedule.finalVote }, results: { ...defaultActivitySettings.schedule.results } } };
  }
}
