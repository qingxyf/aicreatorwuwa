import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { contestTimezone, defaultContestPhase, trackDefinitions } from '../config/activity';
import { D1ContestRepository } from '../adapters/worker/d1-contest-repository';
import { verifyIdentity } from '../adapters/worker/identity-verifier';
import { R2MediaStore } from '../adapters/worker/r2-media-store';
import { ContestService } from '../services/contest-service';
import type { ContestTrackId, FinalVoteInput, PairingVoteInput, SubmissionInput } from '../types/contest';
import type { WorkStatus } from '../types/activity';

export interface WorkerBindings {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  MODE?: 'development' | 'production';
  IDENTITY_VERIFY_URL?: string;
  IDENTITY_VERIFY_SECRET?: string;
  MEDIA_PUBLIC_BASE_URL?: string;
}

type WorkerEnvironment = { Bindings: WorkerBindings };
const app = new Hono<WorkerEnvironment>();

const trackIds = new Set(trackDefinitions.map((track) => track.id));
const statusValues = new Set<WorkStatus>(['pending', 'approved', 'finalist', 'hidden', 'draft']);

function isTrackId(value: unknown): value is ContestTrackId {
  return typeof value === 'string' && trackIds.has(value as ContestTrackId);
}

function dateInContestTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: contestTimezone }).format(new Date());
}

function errorStatus(message: string): number {
  if (message === 'identity_verifier_unconfigured') return 503;
  if (message === 'identity_assertion_missing' || message === 'identity_assertion_rejected' || message === 'identity_assertion_invalid') return 401;
  if (message === 'operator_required') return 403;
  if (message === 'submission_limit' || message === 'pairing_limit' || message === 'duplicate_work' || message === 'daily_limit') return 409;
  return 400;
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

async function operatorRepository(request: Request, bindings: WorkerBindings) {
  const viewer = await viewerForRequest(request, bindings);
  const repository = repositoryForRequest(request, bindings);
  if (!(await repository.isOperator(viewer.id))) throw new Error('operator_required');
  return repository;
}

app.use('/api/*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type', 'X-Dev-Viewer'] }));

app.get('/api/v1/config', (context) =>
  context.json({
    phase: defaultContestPhase,
    tracks: trackDefinitions
  })
);

app.post('/api/v1/session', async (context) => context.json(await viewerForRequest(context.req.raw, context.env)));

app.get('/api/v1/tracks/:trackId/gallery', async (context) => {
  const trackId = context.req.param('trackId');
  if (!isTrackId(trackId)) return context.json({ error: 'invalid_track' }, 400);
  const repository = repositoryForRequest(context.req.raw, context.env);
  return context.json(await repository.listGallery(trackId));
});

app.post('/api/v1/media', async (context) => {
  const viewer = await viewerForRequest(context.req.raw, context.env);
  const body = await context.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return context.json({ error: 'media_file_required' }, 400);
  const store = new R2MediaStore(context.env.MEDIA_BUCKET, context.env.MEDIA_PUBLIC_BASE_URL ?? new URL(context.req.url).origin);
  const media = await store.save(file);
  await repositoryForRequest(context.req.raw, context.env).recordMedia(viewer.id, media, file.size);
  return context.json({ ...media, uploadedBy: viewer.id }, 201);
});

app.get('/api/v1/media/:id', async (context) => {
  const object = await new R2MediaStore(context.env.MEDIA_BUCKET, '').read(context.req.param('id'));
  if (!object) return context.notFound();
  return new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream' } });
});

app.post('/api/v1/submissions', async (context) => {
  const viewer = await viewerForRequest(context.req.raw, context.env);
  const payload = await context.req.json<Partial<SubmissionInput>>();
  if (!isTrackId(payload.trackId) || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    return context.json({ error: 'invalid_submission' }, 400);
  }
  const submission: SubmissionInput = {
    authorId: viewer.id,
    authorName: viewer.name,
    authorAvatar: viewer.avatarUrl,
    trackId: payload.trackId,
    title: payload.title.trim(),
    characterName: payload.characterName?.trim(),
    aiTool: payload.aiTool?.trim(),
    description: payload.description?.trim(),
    mediaIds: payload.mediaIds ?? []
  };
  const service = new ContestService(repositoryForRequest(context.req.raw, context.env));
  return context.json(await service.createSubmission(submission), 201);
});

app.post('/api/v1/pairings/next', async (context) => {
  const viewer = await viewerForRequest(context.req.raw, context.env);
  const payload = await context.req.json<{ trackId?: string }>();
  if (!isTrackId(payload.trackId)) return context.json({ error: 'invalid_track' }, 400);
  const pair = await new ContestService(repositoryForRequest(context.req.raw, context.env)).requestPairing(viewer.id, payload.trackId);
  return context.json({ pair });
});

app.post('/api/v1/pairings/votes', async (context) => {
  const viewer = await viewerForRequest(context.req.raw, context.env);
  const payload = await context.req.json<Partial<PairingVoteInput>>();
  if (!isTrackId(payload.trackId) || typeof payload.assignmentId !== 'string' || typeof payload.preferredWorkId !== 'string') {
    return context.json({ error: 'invalid_pairing_vote' }, 400);
  }
  const vote: PairingVoteInput = {
    viewerId: viewer.id,
    trackId: payload.trackId,
    assignmentId: payload.assignmentId,
    preferredWorkId: payload.preferredWorkId,
  };
  await new ContestService(repositoryForRequest(context.req.raw, context.env)).castPairingVote(vote);
  return context.body(null, 204);
});

app.post('/api/v1/final-votes', async (context) => {
  const viewer = await viewerForRequest(context.req.raw, context.env);
  const payload = await context.req.json<Partial<FinalVoteInput>>();
  if (!isTrackId(payload.trackId) || typeof payload.workId !== 'string') return context.json({ error: 'invalid_final_vote' }, 400);
  const vote: FinalVoteInput = { viewerId: viewer.id, trackId: payload.trackId, workId: payload.workId, day: dateInContestTimezone() };
  return context.json(await new ContestService(repositoryForRequest(context.req.raw, context.env)).castFinalVote(vote));
});

app.get('/api/v1/ops/submissions', async (context) => context.json(await (await operatorRepository(context.req.raw, context.env)).listOperatorSubmissions()));

app.patch('/api/v1/ops/submissions/:id', async (context) => {
  const payload = await context.req.json<{ status?: string; isDisplayed?: boolean }>();
  if (!payload.status || !statusValues.has(payload.status as WorkStatus)) return context.json({ error: 'invalid_status' }, 400);
  const status = payload.status as WorkStatus;
  const isDisplayed = status === 'finalist' && payload.isDisplayed === true;
  await (await operatorRepository(context.req.raw, context.env)).setSubmissionState(context.req.param('id'), status, isDisplayed);
  return context.body(null, 204);
});

app.onError((error) => new Response(JSON.stringify({ error: error.message }), {
  status: errorStatus(error.message),
  headers: { 'content-type': 'application/json; charset=utf-8' }
}));

export default app;
