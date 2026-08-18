CREATE TABLE IF NOT EXISTS activity_settings (
  id TEXT PRIMARY KEY CHECK(id = 'default'),
  phase TEXT NOT NULL CHECK(phase IN ('submission', 'pairing', 'final-vote', 'closed')),
  preview_mode INTEGER NOT NULL DEFAULT 0 CHECK(preview_mode IN (0, 1)),
  submission_start_at TEXT,
  submission_end_at TEXT,
  pairing_start_at TEXT,
  pairing_end_at TEXT,
  final_vote_start_at TEXT,
  final_vote_end_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO activity_settings (id, phase, preview_mode, updated_at)
VALUES ('default', 'submission', 0, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  viewer_id TEXT NOT NULL,
  route_key TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (viewer_id, route_key, window_started_at)
);
