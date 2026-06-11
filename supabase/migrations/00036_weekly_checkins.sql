-- supabase/migrations/00036_weekly_checkins.sql
-- Weekly Check-in (Beta): 3Ps (Progress / Plan / Problem), one row per work week.
-- Employee writes; manager reads subtree; HR reads all — mirrors `checkins` RLS.

CREATE TABLE IF NOT EXISTS weekly_checkins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start            DATE NOT NULL,                 -- Monday of the work week
  progress              TEXT,
  plan_tasks            JSONB NOT NULL DEFAULT '[]',   -- max 2; [{title, mit_id|null, mit_label|null}]
  problems              TEXT,
  last_minute_requests  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, week_start)
);

CREATE INDEX idx_weekly_checkins_employee_week
  ON weekly_checkins (employee_id, week_start DESC);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Employee: full control of own rows
CREATE POLICY weekly_self_rw ON weekly_checkins
  FOR ALL
  USING (employee_id = (SELECT auth.uid()))
  WITH CHECK (employee_id = (SELECT auth.uid()));

-- Manager: read reports' rows (subtree)
CREATE POLICY weekly_manager_read ON weekly_checkins
  FOR SELECT
  USING (private.is_in_my_subtree(employee_id));

-- HR Admin: read all
CREATE POLICY weekly_hr_read ON weekly_checkins
  FOR SELECT
  USING (private.is_hr_admin());
