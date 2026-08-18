import type { RateLimitRule } from '../types/contest';

export const requestRateLimits: Record<string, RateLimitRule> = {
  'media-upload': { limit: 6, windowMs: 60_000 },
  submission: { limit: 4, windowMs: 60_000 },
  'pairing-next': { limit: 10, windowMs: 60_000 },
  'pairing-vote': { limit: 10, windowMs: 60_000 },
  'final-vote': { limit: 6, windowMs: 60_000 },
  'ops-write': { limit: 30, windowMs: 60_000 }
};
