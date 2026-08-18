import type { RateLimitRule, RequestRateLimiter } from '../../types/contest';

export class D1RequestRateLimiter implements RequestRateLimiter {
  constructor(private readonly database: D1Database) {}

  async consume(viewerId: string, route: string, rule: RateLimitRule, now = Date.now()): Promise<boolean> {
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    const result = await this.database
      .prepare(
        `INSERT INTO request_rate_limits (viewer_id, route_key, window_started_at, request_count, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(viewer_id, route_key, window_started_at) DO UPDATE SET
           request_count = request_count + 1,
           updated_at = excluded.updated_at
         WHERE request_count < ?`
      )
      .bind(viewerId, route, windowStart, 1, now, rule.limit)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }
}
