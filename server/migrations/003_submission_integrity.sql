DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM submissions
    GROUP BY author_id, track_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'cannot enforce one submission per account and track: historical duplicates require manual reconciliation';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_author_track_unique_idx
  ON submissions(author_id, track_id);
