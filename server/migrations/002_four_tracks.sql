-- The first internal-test schema grouped the two activities into two tracks.
-- Preserve those records while moving them to the four published award tracks.
UPDATE submissions SET track_id = 'resonance-style' WHERE track_id = 'resonance-theatre';
UPDATE submissions SET track_id = CASE
  WHEN EXISTS (
    SELECT 1 FROM media_objects media
    WHERE media.id IN (
      SELECT jsonb_array_elements_text(submissions.media_json)
    ) AND media.kind = 'video'
  ) THEN 'wardrobe-video'
  ELSE 'wardrobe-design'
END WHERE track_id = 'brocade-wardrobe';
UPDATE pairing_assignments SET track_id = 'resonance-style' WHERE track_id = 'resonance-theatre';
UPDATE pairing_votes SET track_id = 'resonance-style' WHERE track_id = 'resonance-theatre';
UPDATE final_votes SET track_id = 'resonance-style' WHERE track_id = 'resonance-theatre';
UPDATE pairing_assignments assignment SET track_id = submission.track_id
FROM submissions submission
WHERE assignment.track_id = 'brocade-wardrobe' AND submission.id = assignment.work_a_id;
UPDATE pairing_votes vote SET track_id = submission.track_id
FROM submissions submission
WHERE vote.track_id = 'brocade-wardrobe' AND submission.id = vote.winner_work_id;
UPDATE final_votes vote SET track_id = submission.track_id
FROM submissions submission
WHERE vote.track_id = 'brocade-wardrobe' AND submission.id = vote.work_id;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_track_id_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_track_id_check CHECK (track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video'));
ALTER TABLE pairing_assignments DROP CONSTRAINT IF EXISTS pairing_assignments_track_id_check;
ALTER TABLE pairing_assignments ADD CONSTRAINT pairing_assignments_track_id_check CHECK (track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video'));
ALTER TABLE final_votes DROP CONSTRAINT IF EXISTS final_votes_track_id_check;
ALTER TABLE final_votes ADD CONSTRAINT final_votes_track_id_check CHECK (track_id IN ('resonance-style', 'resonance-story', 'wardrobe-design', 'wardrobe-video'));
