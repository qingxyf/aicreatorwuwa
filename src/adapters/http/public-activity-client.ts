import { identityHeaders, readToyViewer } from '../toy/browser-account';
import type {
  ClientSubmissionInput,
  ContestWorkStatus,
  ActivitySettings,
  OperatorSubmission,
  PublicContestConfig,
  PublicGalleryWork,
  PairingOffer
} from '../../types/contest';
import type { UploadedMedia, Viewer } from '../../types/platform';

export interface ActivityHttpClient {
  loadConfig(): Promise<PublicContestConfig>;
  currentViewer(): Promise<Viewer>;
  uploadMedia(file: File): Promise<UploadedMedia>;
  submit(input: ClientSubmissionInput): Promise<ClientSubmissionInput & { id: string; status: ContestWorkStatus; createdAt: string }>;
  nextPair(trackId: ClientSubmissionInput['trackId']): Promise<PairingOffer | null>;
  castPairingVote(input: { trackId: ClientSubmissionInput['trackId']; assignmentId: string; preferredWorkId: string }): Promise<void>;
  listGallery(trackId: ClientSubmissionInput['trackId']): Promise<PublicGalleryWork[]>;
  castFinalVote(input: { trackId: ClientSubmissionInput['trackId']; workId: string }): Promise<{ remainingAfter: number }>;
}

export interface OperationsHttpClient {
  loginOperations(password: string): Promise<{ expiresAt: string }>;
  clearOperationsSession(): void;
  listSubmissions(): Promise<OperatorSubmission[]>;
  setSubmissionStatus(id: string, status: ContestWorkStatus, isDisplayed: boolean): Promise<void>;
  getActivitySettings(): Promise<ActivitySettings>;
  saveActivitySettings(settings: ActivitySettings): Promise<ActivitySettings>;
}

export class PublicActivityClient implements ActivityHttpClient, OperationsHttpClient {
  private viewerPromise: Promise<Viewer> | undefined;
  private opsSessionToken: string | undefined;

  constructor(
    private readonly baseUrl = import.meta.env.VITE_API_BASE_URL ?? '',
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {}

  async loadConfig(): Promise<PublicContestConfig> {
    return this.request<PublicContestConfig>('/api/v1/config', { authenticated: false });
  }

  currentViewer(): Promise<Viewer> {
    this.viewerPromise ??= readToyViewer();
    return this.viewerPromise;
  }

  async uploadMedia(file: File): Promise<UploadedMedia> {
    const form = new FormData();
    form.append('file', file);
    return this.request<UploadedMedia>('/api/v1/media', { method: 'POST', body: form });
  }

  submit(input: ClientSubmissionInput): Promise<ClientSubmissionInput & { id: string; status: ContestWorkStatus; createdAt: string }> {
    return this.request('/api/v1/submissions', { method: 'POST', json: input });
  }

  async nextPair(trackId: ClientSubmissionInput['trackId']): Promise<PairingOffer | null> {
    const response = await this.request<{ pair: PairingOffer | null }>('/api/v1/pairings/next', { method: 'POST', json: { trackId } });
    return response.pair;
  }

  async castPairingVote(input: { trackId: ClientSubmissionInput['trackId']; assignmentId: string; preferredWorkId: string }): Promise<void> {
    await this.request('/api/v1/pairings/votes', { method: 'POST', json: input });
  }

  listGallery(trackId: ClientSubmissionInput['trackId']): Promise<PublicGalleryWork[]> {
    return this.request(`/api/v1/tracks/${trackId}/gallery`, { authenticated: false });
  }

  castFinalVote(input: { trackId: ClientSubmissionInput['trackId']; workId: string }): Promise<{ remainingAfter: number }> {
    return this.request('/api/v1/final-votes', { method: 'POST', json: input });
  }

  async loginOperations(password: string): Promise<{ expiresAt: string }> {
    const session = await this.request<{ token: string; expiresAt: string }>('/api/v1/ops/login', { method: 'POST', json: { password }, authenticated: false });
    this.opsSessionToken = session.token;
    return { expiresAt: session.expiresAt };
  }

  clearOperationsSession(): void {
    this.opsSessionToken = undefined;
  }

  listSubmissions(): Promise<OperatorSubmission[]> {
    return this.request('/api/v1/ops/submissions', { operations: true });
  }

  async setSubmissionStatus(id: string, status: ContestWorkStatus, isDisplayed: boolean): Promise<void> {
    await this.request(`/api/v1/ops/submissions/${id}`, { method: 'PATCH', json: { status, isDisplayed }, operations: true });
  }

  getActivitySettings(): Promise<ActivitySettings> {
    return this.request('/api/v1/ops/activity-settings', { operations: true });
  }

  saveActivitySettings(settings: ActivitySettings): Promise<ActivitySettings> {
    return this.request('/api/v1/ops/activity-settings', { method: 'PUT', json: settings, operations: true });
  }

  private async request<T>(path: string, options: { method?: string; json?: unknown; body?: BodyInit; authenticated?: boolean; operations?: boolean } = {}): Promise<T> {
    const authenticated = options.authenticated ?? true;
    if (options.operations && !this.opsSessionToken) throw new Error('operator_session_required');
    const viewer = authenticated && !options.operations ? await this.currentViewer() : undefined;
    const headers = new Headers(options.json ? { 'content-type': 'application/json' } : undefined);
    if (options.operations && this.opsSessionToken) headers.set('authorization', `Bearer ${this.opsSessionToken}`);
    if (viewer) {
      for (const [name, value] of Object.entries(identityHeaders(viewer))) headers.set(name, value);
    }
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.json ? JSON.stringify(options.json) : options.body
    });
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null && 'error' in payload ? String(payload.error) : 'request_failed';
      throw new Error(message);
    }
    return payload as T;
  }
}
