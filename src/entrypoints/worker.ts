import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { defaultActivitySettings, contestTimezone, trackDefinitions } from '../config/activity';
import { D1ContestRepository } from '../adapters/worker/d1-contest-repository';
import { D1RequestRateLimiter } from '../adapters/worker/d1-request-rate-limiter';
import { verifyIdentity } from '../adapters/worker/identity-verifier';
import { R2MediaStore } from '../adapters/worker/r2-media-store';
import { isActivityActionAllowed } from '../domain/activity-phase';
import { requestRateLimits } from '../policy/request-rate-limits';
import { ContestService } from '../services/contest-service';
import type { WorkStatus } from '../types/activity';
import type { ActivitySettings, ContestPhase, ContestTrackId, FinalVoteInput, PairingVoteInput, SubmissionInput } from '../types/contest';

export interface WorkerBindings {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  MODE?: 'development' | 'production';
  IDENTITY_VERIFY_URL?: string;
  IDENTITY_VERIFY_SECRET?: string;
  MEDIA_PUBLIC_BASE_URL?: string;
  PUBLIC_APP_ORIGIN?: string;
}

type WorkerEnvironment = { Bindings: WorkerBindings };
type PublicActivityPhase = Exclude<ContestPhase, 'closed'>;
type ActivitySettingsPayload = {
  phase?: unknown;
  previewMode?: unknown;
  schedule?: Record<string, { startAt?: unknown; endAt?: unknown }>;
};

const app = new Hono<WorkerEnvironment>();
const trackIds = new Set(trackDefinitions.map((track) => track.id));
const phaseValues = new Set<ContestPhase>(['submission', 'pairing', 'final-vote', 'closed']);
const statusValues = new Set<WorkStatus>(['pending', 'approved', 'finalist', 'hidden', 'draft']);
const maxJsonRequestBytes = 64 * 1024;
const maxMediaRequestBytes = 101 * 1024 * 1024;
const mediaIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeClientErrors = new Set([
  'identity_verifier_unconfigured', 'identity_assertion_missing', 'identity_assertion_rejected', 'identity_assertion_invalid',
  'operator_required', 'submission_limit', 'pairing_limit', 'duplicate_work', 'daily_limit', 'media_required',
  'media_not_owned', 'media_requirement_not_met', 'pairing_assignment_invalid', 'final_vote_not_recorded',
  'unsupported_media_type', 'media_too_large', 'invalid_media_signature', 'media_file_required', 'invalid_track',
  'invalid_submission', 'invalid_pairing_vote', 'invalid_final_vote', 'invalid_activity_settings', 'activity_phase_inactive',
  'rate_limit_exceeded', 'request_too_large', 'invalid_content_length', 'invalid_media_id'
]);

function isTrackId(value: unknown): value is ContestTrackId {
  return typeof value === 'string' && trackIds.has(value as ContestTrackId);
}

function isContestPhase(value: unknown): value is ContestPhase {
  return typeof value === 'string' && phaseValues.has(value as ContestPhase);
}

function dateInContestTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: contestTimezone }).format(new Date());
}

function errorStatus(message: string): number {
  if (message === 'identity_verifier_unconfigured') return 503;
  if (message === 'identity_assertion_missing' || message === 'identity_assertion_rejected' || message === 'identity_assertion_invalid') return 401;
  if (message === 'operator_required') return 403;
  if (message === 'request_too_large') return 413;
  if (message === 'rate_limit_exceeded') return 429;
  if (message === 'submission_limit' || message === 'pairing_limit' || message === 'duplicate_work' || message === 'daily_limit' || message === 'activity_phase_inactive') return 409;
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
  for (const stage of Object.values(schedule)) {
    if (stage.startAt && stage.endAt && Date.parse(stage.startAt) > Date.parse(stage.endAt)) throw new Error('invalid_activity_settings');
  }
  return { phase: payload.phase, previewMode: payload.previewMode, schedule };
}

async function viewerForRequest(request: Request, bindings: WorkerBindings) {
  return verifyIdentity(request, {
    mode: bindings.MODE ?? 'production',
    verificationUrl: bindings.IDENTITY_VERIFY_URL,
    verificationSecret: bindings.IDENTITY_VERIFY_SECRET
  });
}

function repositoryForRequest(request: Request, bindings: WorkerBindings) {
  return new D1ContestRepository(bindings.DB, bindings.MEDIA_PUBLIC_BASE_URL ?? new URL(request.url).origin);
}

async function viewerWithRateLimit(request: Request, bindings: WorkerBindings, route: keyof typeof requestRateLimits) {
  const viewer = await viewerForRequest(request, bindings);
  const allowed = await new D1RequestRateLimiter(bindings.DB).consume(viewer.id, route, requestRateLimits[route]);
  if (!allowed) throw new Error('rate_limit_exceeded');
  return viewer;
}

async function assertActivityPhase(request: Request, bindings: WorkerBindings, phase: PublicActivityPhase): Promise<void> {
  const settings = await repositoryForRequest(request, bindings).getActivitySettings();
  if (!isActivityActionAllowed(settings.phase, settings.previewMode, phase)) throw new Error('activity_phase_inactive');
}

async function operatorContext(request: Request, bindings: WorkerBindings) {
  const viewer = await viewerForRequest(request, bindings);
  const repository = repositoryForRequest(request, bindings);
  if (!(await repository.isOperator(viewer.id))) throw new Error('operator_required');
  return { viewer, repository };
}

app.use('/api/*', cors({
  origin: (origin, context) => {
    const mode = context.env.MODE ?? 'production';
    if (mode !== 'production') return origin || '*';
    return origin && origin === context.env.PUBLIC_APP_ORIGIN ? origin : '';
  },
  allowHeaders: ['Authorization', 'Content-Type', 'X-Dev-Viewer'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS']
}));

app.get('/api/v1/config', async (context) => {
  const settings = await repositoryForRequest(context.req.raw, context.env).getActivitySettings();
  return context.json({ ...settings, tracks: trackDefinitions });
});

app.post('/api/v1/session', async (context) => context.json(await viewerForRequest(context.req.raw, context.env)));

app.get('/api/v1/tracks/:trackId/gallery', async (context) => {
  const trackId = context.req.param('trackId');
  if (!isTrackId(trackId)) return context.json({ error: 'invalid_track' }, 400);
  return context.json(await repositoryForRequest(context.req.raw, context.env).listGallery(trackId));
});

app.post('/api/v1/media', async (context) => {
  assertRequestSize(context.req.raw, maxMediaRequestBytes);
  const viewer = await viewerWithRateLimit(context.req.raw, context.env, 'media-upload');
  await assertActivityPhase(context.req.raw, context.env, 'submission');
  const body = await context.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return context.json({ error: 'media_file_required' }, 400);
  const store = new R2MediaStore(context.env.MEDIA_BUCKET, context.env.MEDIA_PUBLIC_BASE_URL ?? new URL(context.req.url).origin);
  const media = await store.save(file);
  await repositoryForRequest(context.req.raw, context.env).recordMedia(viewer.id, media, file.size);
  return context.json({ ...media, uploadedBy: viewer.id }, 201);
});

app.get('/api/v1/media/:id', async (context) => {
  const id = context.req.param('id');
  if (!mediaIdPattern.test(id)) return context.json({ error: 'invalid_media_id' }, 400);
  const object = await new R2MediaStore(context.env.MEDIA_BUCKET, '').read(id);
  if (!object) return context.notFound();
  return new Response(object.body, {
    headers: {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff'
    }
  });
});

app.post('/api/v1/submissions', async (context) => {
  assertRequestSize(context.req.raw, maxJsonRequestBytes);
  const viewer = await viewerWithRateLimit(context.req.raw, context.env, 'submission');
  await assertActivityPhase(context.req.raw, context.env, 'submission');
  const payload = await context.req.json<Partial<SubmissionInput>>();
  if (!isTrackId(payload.trackId)) throw new Error('invalid_submission');
  const title = normalizedText(payload.title, 40);
  if (!title) throw new Error('invalid_submission');
  if (payload.mediaIds && (!Array.isArray(payload.mediaIds) || payload.mediaIds.some((id) => typeof id !== 'string' || !mediaIdPattern.test(id)))) throw new Error('invalid_submission');
  const submission: SubmissionInput = {
    authorId: viewer.id,
    authorName: viewer.name,
    authorAvatar: viewer.avatarUrl,
    trackId: payload.trackId,
    title,
    characterName: normalizedText(payload.characterName, 40),
    aiTool: normalizedText(payload.aiTool, 60),
    description: normalizedText(payload.description, 500),
    mediaIds: payload.mediaIds ?? []
  };
  return context.json(await new ContestService(repositoryForRequest(context.req.raw, context.env)).createSubmission(submission), 201);
});

app.post('/api/v1/pairings/next', async (context) => {
  assertRequestSize(context.req.raw, maxJsonRequestBytes);
  const viewer = await viewerWithRateLimit(context.req.raw, context.env, 'pairing-next');
  await assertActivityPhase(context.req.raw, context.env, 'pairing');
  const payload = await context.req.json<{ trackId?: string }>();
  if (!isTrackId(payload.trackId)) return context.json({ error: 'invalid_track' }, 400);
  const pair = await new ContestService(repositoryForRequest(context.req.raw, context.env)).requestPairing(viewer.id, payload.trackId);
  return context.json({ pair });
});

app.post('/api/v1/pairings/votes', async (context) => {
  assertRequestSize(context.req.raw, maxJsonRequestBytes);
  const viewer = await viewerWithRateLimit(context.req.raw, context.env, 'pairing-vote');
  await assertActivityPhase(context.req.raw, context.env, 'pairing');
  const payload = await context.req.json<Partial<PairingVoteInput>>();
  if (!isTrackId(payload.trackId) || typeof payload.assignmentId !== 'string' || typeof payload.preferredWorkId !== 'string') return context.json({ error: 'invalid_pairing_vote' }, 400);
  await new ContestService(repositoryForRequest(context.req.raw, context.env)).castPairingVote({
    viewerId: viewer.id,
    trackId: payload.trackId,
    assignmentId: payload.assignmentId,
    preferredWorkId: payload.preferredWorkId
  });
  return context.body(null, 204);
});

app.post('/api/v1/final-votes', async (context) => {
  assertRequestSize(context.req.raw, maxJsonRequestBytes);
  const viewer = await viewerWithRateLimit(context.req.raw, context.env, 'final-vote');
  await assertActivityPhase(context.req.raw, context.env, 'final-vote');
  const payload = await context.req.json<Partial<FinalVoteInput>>();
  if (!isTrackId(payload.trackId) || typeof payload.workId !== 'string') return context.json({ error: 'invalid_final_vote' }, 400);
  const vote: FinalVoteInput = { viewerId: viewer.id, trackId: payload.trackId, workId: payload.workId, day: dateInContestTimezone() };
  return context.json(await new ContestService(repositoryForRequest(context.req.raw, context.env)).castFinalVote(vote));
});

app.get('/api/v1/ops/submissions', async (context) => context.json(await (await operatorContext(context.req.raw, context.env)).repository.listOperatorSubmissions()));

app.patch('/api/v1/ops/submissions/:id', async (context) => {
  assertRequestSize(context.req.raw, maxJsonRequestBytes);
  const { viewer, repository } = await operatorContext(context.req.raw, context.env);
  if (!(await new D1RequestRateLimiter(context.env.DB).consume(viewer.id, 'ops-write', requestRateLimits['ops-write']))) throw new Error('rate_limit_exceeded');
  const payload = await context.req.json<{ status?: string; isDisplayed?: boolean }>();
  if (!payload.status || !statusValues.has(payload.status as WorkStatus)) return context.json({ error: 'invalid_status' }, 400);
  const status = payload.status as WorkStatus;
  await repository.setSubmissionState(context.req.param('id'), status, status === 'finalist' && payload.isDisplayed === true);
  return context.body(null, 204);
});

app.get('/api/v1/ops/activity-settings', async (context) => context.json(await (await operatorContext(context.req.raw, context.env)).repository.getActivitySettings()));

app.put('/api/v1/ops/activity-settings', async (context) => {
  assertRequestSize(context.req.raw, maxJsonRequestBytes);
  const { viewer, repository } = await operatorContext(context.req.raw, context.env);
  if (!(await new D1RequestRateLimiter(context.env.DB).consume(viewer.id, 'ops-write', requestRateLimits['ops-write']))) throw new Error('rate_limit_exceeded');
  return context.json(await repository.saveActivitySettings(activitySettingsFromPayload(await context.req.json<ActivitySettingsPayload>())));
});

app.onError((error) => {
  const message = safeClientErrors.has(error.message) ? error.message : 'internal_error';
  return new Response(JSON.stringify({ error: message }), {
    status: errorStatus(error.message),
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
});

export default app;
