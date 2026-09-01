import type { WorkEntry, WorkStatus } from '../../types/activity';
import { defaultActivitySettings } from '../../config/activity';
import { firstStagePolicy, secondStagePolicy } from '../../policy/voting';
import type {
  ContestRepository,
  ContestTrackId,
  ActivitySettings,
  ActivitySettingsRepository,
  FinalVoteInput,
  OperatorSubmission,
  PairingVoteInput,
  PublicGalleryWork,
  PublicPairingWork,
  SubmissionInput,
  SubmissionRecord
} from '../../types/contest';
import type { UploadedMedia } from '../../types/platform';

interface StoredMediaRow {
  id: string;
  mimeType: string;
}

interface StoredMediaKindRow {
  kind: 'image' | 'video';
}

interface StoredGalleryRow {
  id: string;
  title: string;
  authorName: string;
  authorAvatar: string;
  mediaJson: string;
  finalVotes: number;
}

interface StoredOperatorRow extends StoredGalleryRow {
  trackId: ContestTrackId;
  status: WorkStatus;
  isDisplayed: number;
  pairingWins: number;
  exposureCount: number;
  createdAt: string;
}

interface StoredPairingRow {
  id: string;
  title: string;
  mediaJson: string;
}

interface StoredActivitySettingsRow {
  phase: ActivitySettings['phase'];
  previewMode: number;
  submissionStartAt: string | null;
  submissionEndAt: string | null;
  pairingStartAt: string | null;
  pairingEndAt: string | null;
  finalVoteStartAt: string | null;
  finalVoteEndAt: string | null;
  resultsStartAt: string | null;
  resultsEndAt: string | null;
}

function mediaIdsFrom(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export class D1ContestRepository implements ContestRepository, ActivitySettingsRepository {
  constructor(
    private readonly database: D1Database,
    private readonly mediaBaseUrl = ''
  ) {}

  async getActivitySettings(): Promise<ActivitySettings> {
    const row = await this.database
      .prepare(`SELECT phase, preview_mode AS previewMode,
        submission_start_at AS submissionStartAt, submission_end_at AS submissionEndAt,
        pairing_start_at AS pairingStartAt, pairing_end_at AS pairingEndAt,
        final_vote_start_at AS finalVoteStartAt, final_vote_end_at AS finalVoteEndAt,
        results_start_at AS resultsStartAt, results_end_at AS resultsEndAt
        FROM activity_settings WHERE id = 'default'`)
      .first<StoredActivitySettingsRow>();
    if (!row) return this.defaultActivitySettings();
    return {
      phase: row.phase,
      previewMode: row.previewMode === 1,
      schedule: {
        submission: { label: '投稿阶段', startAt: row.submissionStartAt ?? undefined, endAt: row.submissionEndAt ?? undefined },
        pairing: { label: '盲选阶段', startAt: row.pairingStartAt ?? undefined, endAt: row.pairingEndAt ?? undefined },
        finalVote: { label: '公开投票阶段', startAt: row.finalVoteStartAt ?? undefined, endAt: row.finalVoteEndAt ?? undefined },
        results: { label: '结果公示阶段', startAt: row.resultsStartAt ?? undefined, endAt: row.resultsEndAt ?? undefined }
      }
    };
  }

  async saveActivitySettings(settings: ActivitySettings): Promise<ActivitySettings> {
    await this.database
      .prepare(
        `INSERT INTO activity_settings (
          id, phase, preview_mode,
          submission_start_at, submission_end_at,
          pairing_start_at, pairing_end_at,
          final_vote_start_at, final_vote_end_at, results_start_at, results_end_at, updated_at
        ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          phase = excluded.phase,
          preview_mode = excluded.preview_mode,
          submission_start_at = excluded.submission_start_at,
          submission_end_at = excluded.submission_end_at,
          pairing_start_at = excluded.pairing_start_at,
          pairing_end_at = excluded.pairing_end_at,
          final_vote_start_at = excluded.final_vote_start_at,
          final_vote_end_at = excluded.final_vote_end_at,
          results_start_at = excluded.results_start_at,
          results_end_at = excluded.results_end_at,
          updated_at = excluded.updated_at`
      )
      .bind(
        settings.phase, settings.previewMode ? 1 : 0,
        settings.schedule.submission.startAt ?? null, settings.schedule.submission.endAt ?? null,
        settings.schedule.pairing.startAt ?? null, settings.schedule.pairing.endAt ?? null,
        settings.schedule.finalVote.startAt ?? null, settings.schedule.finalVote.endAt ?? null,
        settings.schedule.results.startAt ?? null, settings.schedule.results.endAt ?? null,
        new Date().toISOString()
      )
      .run();
    return settings;
  }

  async countActiveSubmissions(authorId: string, trackId: ContestTrackId): Promise<number> {
    const row = await this.database
      .prepare("SELECT COUNT(*) AS count FROM submissions WHERE author_id = ? AND track_id = ? AND status != 'hidden'")
      .bind(authorId, trackId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async areMediaOwnedBy(authorId: string, mediaIds: string[]): Promise<boolean> {
    const uniqueIds = [...new Set(mediaIds)];
    if (uniqueIds.length !== mediaIds.length || uniqueIds.length === 0) return false;
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const row = await this.database
      .prepare(`SELECT COUNT(*) AS count FROM media_objects WHERE owner_id = ? AND id IN (${placeholders})`)
      .bind(authorId, ...uniqueIds)
      .first<{ count: number }>();
    return (row?.count ?? 0) === uniqueIds.length;
  }

  async listOwnedMediaKinds(authorId: string, mediaIds: string[]): Promise<Array<'image' | 'video'>> {
    const uniqueIds = [...new Set(mediaIds)];
    if (uniqueIds.length !== mediaIds.length || uniqueIds.length === 0) return [];
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const result = await this.database
      .prepare(`SELECT kind FROM media_objects WHERE owner_id = ? AND id IN (${placeholders})`)
      .bind(authorId, ...uniqueIds)
      .all<StoredMediaKindRow>();
    return result.results.map((row) => row.kind);
  }

  async createSubmission(input: SubmissionInput): Promise<SubmissionRecord> {
    const submission: SubmissionRecord = {
      ...input,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await this.database
      .prepare(
        `INSERT INTO submissions (id, track_id, author_id, author_name, author_avatar, title, character_name, ai_tool, description, media_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        submission.id,
        submission.trackId,
        submission.authorId,
        input.authorName ?? '',
        input.authorAvatar ?? '',
        submission.title,
        submission.characterName ?? '',
        '',
        submission.description ?? '',
        JSON.stringify(submission.mediaIds ?? []),
        submission.status,
        submission.createdAt
      )
      .run();
    return submission;
  }

  async listApprovedWorks(trackId: ContestTrackId): Promise<WorkEntry[]> {
    const result = await this.database
      .prepare(
        `SELECT s.id, s.track_id AS trackId, s.author_id AS authorId, s.title, s.status,
          (SELECT COUNT(*) FROM pairing_votes pv WHERE pv.work_a_id = s.id OR pv.work_b_id = s.id) AS exposureCount,
          (SELECT COUNT(*) FROM pairing_votes pv WHERE pv.winner_work_id = s.id) AS pairingWins,
          s.created_at AS createdAt
         FROM submissions s WHERE s.track_id = ? AND s.status = 'approved'`
      )
      .bind(trackId)
      .all<WorkEntry>();
    return result.results;
  }

  async listComparedWorkIds(viewerId: string, trackId: ContestTrackId): Promise<string[]> {
    const result = await this.database
      .prepare(
        `SELECT work_a_id AS workId FROM pairing_votes WHERE viewer_id = ? AND track_id = ?
         UNION SELECT work_b_id AS workId FROM pairing_votes WHERE viewer_id = ? AND track_id = ?`
      )
      .bind(viewerId, trackId, viewerId, trackId)
      .all<{ workId: string }>();
    return result.results.map((row) => row.workId);
  }

  async countPairingVotes(viewerId: string, trackId: ContestTrackId): Promise<number> {
    const row = await this.database
      .prepare('SELECT COUNT(*) AS count FROM pairing_votes WHERE viewer_id = ? AND track_id = ?')
      .bind(viewerId, trackId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async createPairingAssignment(viewerId: string, trackId: ContestTrackId, workIds: [string, string]): Promise<string> {
    const id = crypto.randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 15 * 60 * 1000);
    await this.database
      .prepare('INSERT INTO pairing_assignments (id, viewer_id, track_id, work_a_id, work_b_id, issued_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, viewerId, trackId, workIds[0], workIds[1], issuedAt.toISOString(), expiresAt.toISOString())
      .run();
    return id;
  }

  async recordPairingVote(input: PairingVoteInput): Promise<boolean> {
    const votedAt = new Date().toISOString();
    const result = await this.database
      .prepare(
        `INSERT OR IGNORE INTO pairing_votes (id, assignment_id, viewer_id, track_id, winner_work_id, work_a_id, work_b_id, voted_at)
         SELECT ?, ?, assignment.viewer_id, assignment.track_id, ?, assignment.work_a_id, assignment.work_b_id, ?
         FROM pairing_assignments assignment
         JOIN submissions work_a ON work_a.id = assignment.work_a_id AND work_a.status = 'approved'
         JOIN submissions work_b ON work_b.id = assignment.work_b_id AND work_b.status = 'approved'
         WHERE assignment.id = ? AND assignment.viewer_id = ? AND assignment.track_id = ?
           AND assignment.consumed_at IS NULL AND assignment.expires_at > ?
           AND ? IN (assignment.work_a_id, assignment.work_b_id)
           AND (SELECT COUNT(*) FROM pairing_votes WHERE viewer_id = assignment.viewer_id AND track_id = assignment.track_id) < ?`
      )
      .bind(
        crypto.randomUUID(),
        input.assignmentId,
        input.preferredWorkId,
        votedAt,
        input.assignmentId,
        input.viewerId,
        input.trackId,
        votedAt,
        input.preferredWorkId,
        firstStagePolicy.votesPerTrack
      )
      .run();
    if ((result.meta.changes ?? 0) !== 1) return false;
    await this.database
      .prepare('UPDATE pairing_assignments SET consumed_at = ? WHERE id = ?')
      .bind(votedAt, input.assignmentId)
      .run();
    return true;
  }

  async listDailyFinalVoteWorkIds(viewerId: string, trackId: ContestTrackId, day: string): Promise<string[]> {
    const result = await this.database
      .prepare('SELECT work_id AS workId FROM final_votes WHERE viewer_id = ? AND track_id = ? AND vote_day = ?')
      .bind(viewerId, trackId, day)
      .all<{ workId: string }>();
    return result.results.map((row) => row.workId);
  }

  async recordFinalVote(input: FinalVoteInput): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT OR IGNORE INTO final_votes (id, viewer_id, track_id, work_id, vote_day, voted_at)
         SELECT ?, ?, ?, ?, ?, ?
         FROM submissions
         WHERE id = ? AND track_id = ? AND status = 'finalist' AND is_displayed = 1
           AND NOT EXISTS (SELECT 1 FROM final_votes WHERE viewer_id = ? AND track_id = ? AND vote_day = ? AND work_id = ?)
           AND (SELECT COUNT(*) FROM final_votes WHERE viewer_id = ? AND track_id = ? AND vote_day = ?) < ?`
      )
      .bind(
        crypto.randomUUID(), input.viewerId, input.trackId, input.workId, input.day, new Date().toISOString(),
        input.workId, input.trackId,
        input.viewerId, input.trackId, input.day, input.workId,
        input.viewerId, input.trackId, input.day, secondStagePolicy.votesPerTrackPerDay
      )
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async recordMedia(ownerId: string, media: UploadedMedia, byteSize: number): Promise<void> {
    await this.database
      .prepare('INSERT INTO media_objects (id, owner_id, kind, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(media.id, ownerId, media.kind, media.mimeType, byteSize, new Date().toISOString())
      .run();
  }

  async listGallery(trackId: ContestTrackId): Promise<PublicGalleryWork[]> {
    const result = await this.database
      .prepare(
        `SELECT s.id, s.title, s.author_name AS authorName, s.author_avatar AS authorAvatar, s.media_json AS mediaJson,
          (SELECT COUNT(*) FROM final_votes fv WHERE fv.work_id = s.id) AS finalVotes
         FROM submissions s
         WHERE s.track_id = ? AND s.status = 'finalist' AND s.is_displayed = 1
         ORDER BY finalVotes DESC, s.created_at ASC`
      )
      .bind(trackId)
      .all<StoredGalleryRow>();
    const mediaById = await this.mediaById(result.results.flatMap((row) => mediaIdsFrom(row.mediaJson)));
    return result.results.map((row) => ({
      id: row.id,
      title: row.title,
      authorName: row.authorName,
      authorAvatar: row.authorAvatar,
      media: this.hydrateMedia(mediaIdsFrom(row.mediaJson), mediaById),
      finalVotes: row.finalVotes
    }));
  }

  async listPairingWorks(ids: [string, string]): Promise<PublicPairingWork[]> {
    const result = await this.database
      .prepare('SELECT id, title, media_json AS mediaJson FROM submissions WHERE id IN (?, ?) AND status = \'approved\'')
      .bind(...ids)
      .all<StoredPairingRow>();
    const mediaById = await this.mediaById(result.results.flatMap((row) => mediaIdsFrom(row.mediaJson)));
    const byId = new Map(result.results.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [{ id: row.id, title: row.title, media: this.hydrateMedia(mediaIdsFrom(row.mediaJson), mediaById) }] : [];
    });
  }

  async isOperator(viewerId: string): Promise<boolean> {
    return Boolean(await this.database.prepare('SELECT viewer_id FROM admins WHERE viewer_id = ?').bind(viewerId).first());
  }

  async listOperatorSubmissions(): Promise<OperatorSubmission[]> {
    const result = await this.database
      .prepare(
        `SELECT s.id, s.track_id AS trackId, s.title, s.author_name AS authorName, s.author_avatar AS authorAvatar, s.media_json AS mediaJson,
          (SELECT COUNT(*) FROM final_votes fv WHERE fv.work_id = s.id) AS finalVotes,
          s.status, s.is_displayed AS isDisplayed,
          (SELECT COUNT(*) FROM pairing_votes pv WHERE pv.winner_work_id = s.id) AS pairingWins,
          (SELECT COUNT(*) FROM pairing_votes pv WHERE pv.work_a_id = s.id OR pv.work_b_id = s.id) AS exposureCount,
          s.created_at AS createdAt
         FROM submissions s ORDER BY s.created_at DESC`
      )
      .all<StoredOperatorRow>();
    const mediaById = await this.mediaById(result.results.flatMap((row) => mediaIdsFrom(row.mediaJson)));
    return result.results.map((row) => ({
      id: row.id,
      title: row.title,
      authorName: row.authorName,
      authorAvatar: row.authorAvatar,
      media: this.hydrateMedia(mediaIdsFrom(row.mediaJson), mediaById),
      finalVotes: row.finalVotes,
      trackId: row.trackId,
      status: row.status,
      isDisplayed: row.isDisplayed === 1,
      pairingWins: row.pairingWins,
      exposureCount: row.exposureCount,
      createdAt: row.createdAt
    }));
  }

  async setSubmissionState(id: string, status: WorkStatus, isDisplayed: boolean): Promise<void> {
    await this.database.prepare('UPDATE submissions SET status = ?, is_displayed = ? WHERE id = ?').bind(status, isDisplayed ? 1 : 0, id).run();
  }

  private async mediaById(ids: string[]): Promise<Map<string, UploadedMedia>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const result = await this.database
      .prepare(`SELECT id, mime_type AS mimeType FROM media_objects WHERE id IN (${placeholders})`)
      .bind(...uniqueIds)
      .all<StoredMediaRow>();
    return new Map(result.results.map((row) => [
      row.id,
      {
        id: row.id,
        url: `${this.mediaBaseUrl.replace(/\/$/, '')}/api/v1/media/${row.id}`,
        kind: row.mimeType.startsWith('video/') ? 'video' : 'image',
        mimeType: row.mimeType
      }
    ]));
  }

  private hydrateMedia(ids: string[], mediaById: Map<string, UploadedMedia>): UploadedMedia[] {
    return ids.flatMap((id) => {
      const media = mediaById.get(id);
      return media ? [media] : [];
    });
  }

  private defaultActivitySettings(): ActivitySettings {
    return {
      ...defaultActivitySettings,
      schedule: {
        submission: { ...defaultActivitySettings.schedule.submission },
        pairing: { ...defaultActivitySettings.schedule.pairing },
        finalVote: { ...defaultActivitySettings.schedule.finalVote },
        results: { ...defaultActivitySettings.schedule.results }
      }
    };
  }
}
