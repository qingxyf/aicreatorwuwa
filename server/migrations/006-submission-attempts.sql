CREATE TABLE IF NOT EXISTS submission_attempts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_avatar TEXT NOT NULL DEFAULT '',
  track_id TEXT CHECK (track_id IS NULL OR track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video')),
  title TEXT NOT NULL DEFAULT '',
  character_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('uploading', 'failed', 'submitted')) DEFAULT 'uploading',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

ALTER TABLE media_objects ADD COLUMN IF NOT EXISTS attempt_id TEXT REFERENCES submission_attempts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS media_objects_attempt_idx ON media_objects(attempt_id);
CREATE INDEX IF NOT EXISTS submission_attempts_owner_idx ON submission_attempts(owner_id, created_at DESC);
