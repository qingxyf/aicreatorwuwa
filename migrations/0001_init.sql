CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT NOT NULL,
  title TEXT NOT NULL,
  character_name TEXT NOT NULL,
  ai_tool TEXT NOT NULL,
  description TEXT NOT NULL,
  media_json TEXT NOT NULL,
  status TEXT NOT NULL,
  is_displayed INTEGER NOT NULL DEFAULT 0,
  pairing_wins INTEGER NOT NULL DEFAULT 0,
  exposure_count INTEGER NOT NULL DEFAULT 0,
  final_votes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_track_status_idx ON submissions(track_id, status);
CREATE INDEX IF NOT EXISTS submissions_author_track_idx ON submissions(author_id, track_id);

CREATE TABLE IF NOT EXISTS media_objects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS media_objects_owner_idx ON media_objects(owner_id);

CREATE TABLE IF NOT EXISTS pairing_assignments (
  id TEXT PRIMARY KEY,
  viewer_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  work_a_id TEXT NOT NULL,
  work_b_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS pairing_assignments_viewer_track_idx ON pairing_assignments(viewer_id, track_id, expires_at);

CREATE TABLE IF NOT EXISTS pairing_votes (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE,
  viewer_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  winner_work_id TEXT NOT NULL,
  work_a_id TEXT NOT NULL,
  work_b_id TEXT NOT NULL,
  voted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pairing_votes_viewer_track_idx ON pairing_votes(viewer_id, track_id);

CREATE TABLE IF NOT EXISTS final_votes (
  id TEXT PRIMARY KEY,
  viewer_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  vote_day TEXT NOT NULL,
  voted_at TEXT NOT NULL,
  UNIQUE(viewer_id, track_id, vote_day, work_id)
);
CREATE INDEX IF NOT EXISTS final_votes_viewer_track_day_idx ON final_votes(viewer_id, track_id, vote_day);

CREATE TABLE IF NOT EXISTS admins (
  viewer_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
