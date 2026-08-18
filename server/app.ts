import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { defaultActivitySettings, contestTimezone, trackDefinitions } from '../src/config/activity';
import { isActivityActionAllowed } from '../src/domain/activity-phase';
import { ContestService } from '../src/services/contest-service';
import { requestRateLimits } from '../src/policy/request-rate-limits';
import type { WorkStatus } from '../src/types/activity';
import type { ActivitySettings, ContestPhase, ContestTrackId, FinalVoteInput, PairingVoteInput, SubmissionInput } from '../src/types/contest';
import type { Viewer } from '../src/types/platform';
import { verifyIdentity, type IdentityOptions } from './identity';
import { PostgresContestRepository } from './repository';
import type { OssMediaStore } from './oss';
import type pg from 'pg';

export interface ServerDependencies {
  pool: pg.Pool;
  mediaStore: OssMediaStore;
  identity: IdentityOptions;
  publicAppOrigin?: string;
  mediaBaseUrl?: string;
  mode?: 'development' | 'production';
}

type AppEnv = { Variables: { repository: PostgresContestRepository } };
type PublicActivityPhase = Exclude<ContestPhase, 'closed'>;
type ActivitySettingsPayload = { phase?: unknown; previewMode?: unknown; schedule?: Record<string, { startAt?: unknown; endAt?: unknown }> };

const app = new Hono<AppEnv>();
const trackIds = new Set(trackDefinitions.map((track) => track.id));
const phaseValues = new Set<ContestPhase>(['submission', 'pairing', 'final-vote', 'closed']);
const statusValues = new Set<WorkStatus>(['pending', 'approved', 'finalist', 'hidden', 'draft']);
const safeClientErrors = new Set([
  'identity_verifier_unconfigured', 'identity_assertion_missing', 'identity_assertion_rejected', 'identity_assertion_invalid', 'operator_required',
  'submission_limit', 'pairing_limit', 'duplicate_work', 'daily_limit', 'media_required', 'media_not_owned', 'media_requirement_not_met',
  'pairing_assignment_invalid', 'final_vote_not_recorded', 'unsupported_media_type', 'media_too_large', 'invalid_media_signature',
  'media_file_required', 'invalid_track', 'invalid_submission', 'invalid_pairing_vote', 'invalid_final_vote', 'invalid_activity_settings',
  'activity_phase_inactive', 'rate_limit_exceeded', 'request_too_large', 'invalid_content_length', 'invalid_media_id', 'request_failed'
]);
const mediaIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isTrackId(value: unknown): value is ContestTrackId { return typeof value === 'string' && trackIds.has(value as ContestTrackId); }
function isContestPhase(value: unknown): value is ContestPhase { return typeof value === 'string' && phaseValues.has(value as ContestPhase); }
function dateInContestTimezone(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: contestTimezone }).format(new Date()); }
function errorStatus(message: string): number {
  if (message === 'identity_verifier_unconfigured') return 503;
  if (message === 'identity_assertion_missing' || message === 'identity_assertion_rejected' || message === 'identity_assertion_invalid') return 401;
  if (message === 'operator_required') return 403;
  if (message === 'request_too_large') return 413;
  if (message === 'rate_limit_exceeded') return 429;
  if (message === 'submission_limit' || message === 'pairing_limit' || message === 'daily_limit' || message === 'activity_phase_inactive') return 409;
  if (safeClientErrors.has(message)) return 400;
  return 500;
}
function assertRequestSize(request: Request, maximumBytes: number): void {
  const rawLength = request.headers.get('content-length');
  if (!rawLength) return;
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length) || length < 0) throw new Error('invalid_content_length');
  if (length > maximumBytes) throw new Error('request_too_large');
}
function normalizedText(value: unknown, maximumLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error('invalid_submission');
  const normalized = value.trim();
  if (normalized.length > maximumLength) throw new Error('invalid_submission');
  return normalized || undefined;
}
function normalizedTimestamp(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid_activity_settings');
  return new Date(value).toISOString();
}
function activitySettingsFromPayload(payload: ActivitySettingsPayload): ActivitySettings {
  if (!isContestPhase(payload.phase) || typeof payload.previewMode !== 'boolean' || !payload.schedule) throw new Error('invalid_activity_settings');
  const schedule = {
    submission: { label: defaultActivitySettings.schedule.submission.label, startAt: normalizedTimestamp(payload.schedule.submission?.startAt), endAt: normalizedTimestamp(payload.schedule.submission?.endAt) },
    pairing: { label: defaultActivitySettings.schedule.pairing.label, startAt: normalizedTimestamp(payload.schedule.pairing?.startAt), endAt: normalizedTimestamp(payload.schedule.pairing?.endAt) },
    finalVote: { label: defaultActivitySettings.schedule.finalVote.label, startAt: normalizedTimestamp(payload.schedule.finalVote?.startAt), endAt: normalizedTimestamp(payload.schedule.finalVote?.endAt) }
  };
  for (const stage of Object.values(schedule)) if (stage.startAt && stage.endAt && Date.parse(stage.startAt) > Date.parse(stage.endAt)) throw new Error('invalid_activity_settings');
  return { phase: payload.phase, previewMode: payload.previewMode, schedule };
}

export function createServerApp(dependencies: ServerDependencies) {
  const repository = new PostgresContestRepository(dependencies.pool, dependencies.mediaBaseUrl ?? '');
  const server = new Hono<AppEnv>();
  const mode = dependencies.mode ?? dependencies.identity.mode;
  server.use('/api/*', cors({
    origin: (origin) => mode !== 'production' ? origin || '*' : origin === dependencies.publicAppOrigin ? origin : '',
    allowHeaders: ['Authorization', 'Content-Type', 'X-Dev-Viewer', 'X-Toy-Profile'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS']
  }));
  server.use('/api/*', async (context, next) => { context.set('repository', repository); await next(); });

  const viewerForRequest = (request: Request): Promise<Viewer> => verifyIdentity(request, dependencies.identity);
  const rateLimitedViewer = async (request: Request, route: keyof typeof requestRateLimits): Promise<Viewer> => {
    const viewer = await viewerForRequest(request);
    const allowed = await repository.consumeRateLimit(viewer.id, route, requestRateLimits[route]);
    if (!allowed) throw new Error('rate_limit_exceeded');
    return viewer;
  };
  const assertActivityPhase = async (phase: PublicActivityPhase): Promise<void> => {
    const settings = await repository.getActivitySettings();
    if (!isActivityActionAllowed(settings.phase, settings.previewMode, phase)) throw new Error('activity_phase_inactive');
  };
  const operatorContext = async (request: Request) => {
    const viewer = await viewerForRequest(request);
    if (!(await repository.isOperator(viewer.id))) throw new Error('operator_required');
    return viewer;
  };

  server.get('/healthz', async (context) => {
    await dependencies.pool.query('SELECT 1');
    return context.json({ ok: true });
  });
  server.get('/api/v1/config', async (context) => context.json({ ...(await repository.getActivitySettings()), tracks: trackDefinitions }));
  server.post('/api/v1/session', async (context) => context.json(await viewerForRequest(context.req.raw)));
  server.get('/api/v1/tracks/:trackId/gallery', async (context) => {
    const trackId = context.req.param('trackId');
    if (!isTrackId(trackId)) return context.json({ error: 'invalid_track' }, 400);
    return context.json(await repository.listGallery(trackId));
  });
  server.post('/api/v1/media', async (context) => {
    assertRequestSize(context.req.raw, 101 * 1024 * 1024);
    const viewer = await rateLimitedViewer(context.req.raw, 'media-upload');
    await assertActivityPhase('submission');
    const body = await context.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) throw new Error('media_file_required');
    const media = await dependencies.mediaStore.save(file);
    try { await repository.recordMedia(viewer.id, media, file.size); } catch (error) { await dependencies.mediaStore.remove(media.id); throw error; }
    return context.json({ ...media, uploadedBy: viewer.id }, 201);
  });
  server.get('/api/v1/media/:id', async (context) => {
    const id = context.req.param('id');
    if (!mediaIdPattern.test(id)) return context.json({ error: 'invalid_media_id' }, 400);
    const object = await dependencies.mediaStore.read(id);
    if (!object) return context.notFound();
    return new Response(object.content, { headers: { 'cache-control': 'public, max-age=31536000, immutable', 'content-type': object.type ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' } });
  });
  server.post('/api/v1/submissions', async (context) => {
    assertRequestSize(context.req.raw, 64 * 1024);
    const viewer = await rateLimitedViewer(context.req.raw, 'submission');
    await assertActivityPhase('submission');
    const payload = await context.req.json<Partial<SubmissionInput>>();
    if (!isTrackId(payload.trackId)) throw new Error('invalid_submission');
    const title = normalizedText(payload.title, 40);
    if (!title) throw new Error('invalid_submission');
    if (payload.mediaIds && (!Array.isArray(payload.mediaIds) || payload.mediaIds.some((id) => typeof id !== 'string' || !mediaIdPattern.test(id)))) throw new Error('invalid_submission');
    return context.json(await new ContestService(repository).createSubmission({ authorId: viewer.id, authorName: viewer.name, authorAvatar: viewer.avatarUrl, trackId: payload.trackId, title, characterName: normalizedText(payload.characterName, 40), description: normalizedText(payload.description, 500), mediaIds: payload.mediaIds ?? [] }), 201);
  });
  server.post('/api/v1/pairings/next', async (context) => {
    assertRequestSize(context.req.raw, 64 * 1024);
    const viewer = await rateLimitedViewer(context.req.raw, 'pairing-next');
    await assertActivityPhase('pairing');
    const payload = await context.req.json<{ trackId?: string }>();
    if (!isTrackId(payload.trackId)) throw new Error('invalid_track');
    return context.json({ pair: await new ContestService(repository).requestPairing(viewer.id, payload.trackId) });
  });
  server.post('/api/v1/pairings/votes', async (context) => {
    assertRequestSize(context.req.raw, 64 * 1024);
    const viewer = await rateLimitedViewer(context.req.raw, 'pairing-vote');
    await assertActivityPhase('pairing');
    const payload = await context.req.json<Partial<PairingVoteInput>>();
    if (!isTrackId(payload.trackId) || typeof payload.assignmentId !== 'string' || typeof payload.preferredWorkId !== 'string') throw new Error('invalid_pairing_vote');
    await new ContestService(repository).castPairingVote({ viewerId: viewer.id, trackId: payload.trackId, assignmentId: payload.assignmentId, preferredWorkId: payload.preferredWorkId });
    return context.body(null, 204);
  });
  server.post('/api/v1/final-votes', async (context) => {
    assertRequestSize(context.req.raw, 64 * 1024);
    const viewer = await rateLimitedViewer(context.req.raw, 'final-vote');
    await assertActivityPhase('final-vote');
    const payload = await context.req.json<Partial<FinalVoteInput>>();
    if (!isTrackId(payload.trackId) || typeof payload.workId !== 'string') throw new Error('invalid_final_vote');
    return context.json(await new ContestService(repository).castFinalVote({ viewerId: viewer.id, trackId: payload.trackId, workId: payload.workId, day: dateInContestTimezone() }));
  });
  server.get('/api/v1/ops/submissions', async (context) => { await operatorContext(context.req.raw); return context.json(await repository.listOperatorSubmissions()); });
  server.patch('/api/v1/ops/submissions/:id', async (context) => {
    assertRequestSize(context.req.raw, 64 * 1024);
    const viewer = await operatorContext(context.req.raw);
    if (!(await repository.consumeRateLimit(viewer.id, 'ops-write', requestRateLimits['ops-write']))) throw new Error('rate_limit_exceeded');
    const payload = await context.req.json<{ status?: string; isDisplayed?: boolean }>();
    if (!payload.status || !statusValues.has(payload.status as WorkStatus)) throw new Error('invalid_status');
    await repository.setSubmissionState(context.req.param('id'), payload.status as WorkStatus, payload.isDisplayed === true);
    return context.body(null, 204);
  });
  server.get('/api/v1/ops/activity-settings', async (context) => { await operatorContext(context.req.raw); return context.json(await repository.getActivitySettings()); });
  server.put('/api/v1/ops/activity-settings', async (context) => {
    assertRequestSize(context.req.raw, 64 * 1024);
    const viewer = await operatorContext(context.req.raw);
    if (!(await repository.consumeRateLimit(viewer.id, 'ops-write', requestRateLimits['ops-write']))) throw new Error('rate_limit_exceeded');
    return context.json(await repository.saveActivitySettings(activitySettingsFromPayload(await context.req.json<ActivitySettingsPayload>())));
  });
  server.onError((error) => new Response(JSON.stringify({ error: safeClientErrors.has(error.message) ? error.message : 'internal_error' }), { status: errorStatus(error.message), headers: { 'content-type': 'application/json; charset=utf-8' } }));
  return server;
}
