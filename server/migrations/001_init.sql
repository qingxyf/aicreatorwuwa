CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL CHECK (track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video')),
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT NOT NULL,
  title TEXT NOT NULL,
  character_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  media_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'finalist', 'hidden')),
  is_displayed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS submissions_track_status_idx ON submissions(track_id, status);
CREATE INDEX IF NOT EXISTS submissions_author_track_idx ON submissions(author_id, track_id);

CREATE TABLE IF NOT EXISTS media_objects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS media_objects_owner_idx ON media_objects(owner_id);

CREATE TABLE IF NOT EXISTS pairing_assignments (
  id TEXT PRIMARY KEY,
  viewer_id TEXT NOT NULL,
  track_id TEXT NOT NULL CHECK (track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video')),
  work_a_id TEXT NOT NULL REFERENCES submissions(id),
  work_b_id TEXT NOT NULL REFERENCES submissions(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pairing_assignments_viewer_track_idx ON pairing_assignments(viewer_id, track_id, expires_at);

CREATE TABLE IF NOT EXISTS pairing_votes (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE REFERENCES pairing_assignments(id),
  viewer_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  winner_work_id TEXT NOT NULL REFERENCES submissions(id),
  work_a_id TEXT NOT NULL REFERENCES submissions(id),
  work_b_id TEXT NOT NULL REFERENCES submissions(id),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pairing_votes_viewer_track_idx ON pairing_votes(viewer_id, track_id);

CREATE TABLE IF NOT EXISTS final_votes (
  id TEXT PRIMARY KEY,
  viewer_id TEXT NOT NULL,
  track_id TEXT NOT NULL CHECK (track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video')),
  work_id TEXT NOT NULL REFERENCES submissions(id),
  vote_day DATE NOT NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(viewer_id, track_id, vote_day, work_id)
);
CREATE INDEX IF NOT EXISTS final_votes_viewer_track_day_idx ON final_votes(viewer_id, track_id, vote_day);

CREATE TABLE IF NOT EXISTS admins (
  viewer_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  phase TEXT NOT NULL CHECK (phase IN ('submission', 'pairing', 'final-vote', 'closed')),
  preview_mode BOOLEAN NOT NULL DEFAULT FALSE,
  submission_start_at TIMESTAMPTZ,
  submission_end_at TIMESTAMPTZ,
  pairing_start_at TIMESTAMPTZ,
  pairing_end_at TIMESTAMPTZ,
  final_vote_start_at TIMESTAMPTZ,
  final_vote_end_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO activity_settings (id, phase) VALUES ('default', 'submission') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS request_rate_limits (
  viewer_id TEXT NOT NULL,
  route_key TEXT NOT NULL,
  window_started_at BIGINT NOT NULL,
  request_count INTEGER NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (viewer_id, route_key, window_started_at)
);
