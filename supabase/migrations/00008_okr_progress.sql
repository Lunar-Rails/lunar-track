-- OKR progress tracking: per-KR status and per-initiative completion.
-- Adds progress_status to key_results and completed/completed_at to initiatives.

-- Key Result status
ALTER TABLE IF EXISTS key_results
  ADD COLUMN progress_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (progress_status IN ('not_started', 'in_progress', 'on_track', 'at_risk', 'done'));

-- Initiative completion
ALTER TABLE IF EXISTS initiatives
  ADD COLUMN completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS initiatives
  ADD COLUMN completed_at TIMESTAMPTZ;
