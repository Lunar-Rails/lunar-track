-- Phase 6: Company Values
-- Per-value rating and self-assessment for the seven BCOMM company values.
-- Replaces the single "Behaviours/Values" rating with structured per-value scoring.

-- ───────────────────────────────────────────────────────────────────
-- company_values lookup
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE company_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  sort_order  INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE company_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_values_read_all
  ON company_values
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY company_values_hr_write
  ON company_values
  FOR ALL
  TO authenticated
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());

INSERT INTO company_values (name, description, sort_order) VALUES
  ('Excellence', 'We hold ourselves to the highest standard in everything we produce.', 1),
  ('Ownership', 'We take full responsibility for our work and its outcomes.', 2),
  ('Collaboration', 'We achieve more together than alone.', 3),
  ('Integrity', 'We do what we say, say what we mean.', 4),
  ('Curiosity', 'We stay hungry to learn.', 5),
  ('Adaptability', 'We thrive in change.', 6),
  ('AI Builder Mindset', 'We actively build, experiment with, and integrate AI tools into our work.', 7);

-- ───────────────────────────────────────────────────────────────────
-- JSONB columns on existing tables
-- ───────────────────────────────────────────────────────────────────

-- Manager per-value ratings stored on the quarterly score
-- Format: [{value_id: UUID, value_name: text, rating: 1-5, evidence: text}]
ALTER TABLE quarterly_scores
  ADD COLUMN value_ratings JSONB NOT NULL DEFAULT '[]';

-- Employee per-value self-assessments on the quarterly check-in
-- Format: [{value_id: UUID, value_name: text, rating: 1-5, examples: text}]
ALTER TABLE quarterly_checkins
  ADD COLUMN value_self_assessments JSONB NOT NULL DEFAULT '[]';
