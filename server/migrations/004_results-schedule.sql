ALTER TABLE activity_settings
  ADD COLUMN IF NOT EXISTS results_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS results_end_at TIMESTAMPTZ;

UPDATE activity_settings SET
  submission_start_at = '2026-09-01T00:00:00+08:00',
  submission_end_at = '2026-10-08T23:59:59+08:00',
  pairing_start_at = '2026-10-09T00:00:00+08:00',
  pairing_end_at = '2026-10-12T23:59:59+08:00',
  final_vote_start_at = '2026-10-13T00:00:00+08:00',
  final_vote_end_at = '2026-10-18T23:59:59+08:00',
  results_start_at = '2026-10-19T00:00:00+08:00',
  results_end_at = '2026-10-21T23:59:59+08:00'
WHERE id = 'default';
