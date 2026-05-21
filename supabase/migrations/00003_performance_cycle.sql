-- Phase 3: Performance Cycle
-- Quarterly OKR reviews, quarterly scores, annual roll-up

-- ───────────────────────────────────────────────────────────────────
-- Quarterly OKR Reviews
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE quarterly_okr_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      UUID NOT NULL REFERENCES profiles(id),
  employee_id     UUID NOT NULL REFERENCES profiles(id),
  period_id       UUID NOT NULL REFERENCES performance_periods(id),

  -- Per-OKR progress notes stored as JSON array: [{okr_id, progress_note}]
  okr_progress    JSONB NOT NULL DEFAULT '[]',

  -- Continue/Stop/Start
  continue_doing  TEXT,
  stop_doing      TEXT,
  start_doing     TEXT,

  -- Capability needs
  capability_needs TEXT,

  -- AI Builder checkbox: did employee have an active AI project this quarter?
  ai_builder_active BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (manager_id, employee_id, period_id)
);

-- ───────────────────────────────────────────────────────────────────
-- Quarterly Scores
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE quarterly_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id          UUID NOT NULL REFERENCES profiles(id),
  employee_id         UUID NOT NULL REFERENCES profiles(id),
  period_id           UUID NOT NULL REFERENCES performance_periods(id),

  -- Three component scores (1–5)
  professional_mastery  SMALLINT CHECK (professional_mastery BETWEEN 1 AND 5),
  okrs_stretch_goals    SMALLINT CHECK (okrs_stretch_goals BETWEEN 1 AND 5),
  behaviours_values     SMALLINT CHECK (behaviours_values BETWEEN 1 AND 5),

  -- Manager notes per component
  professional_mastery_notes  TEXT,
  okrs_stretch_goals_notes    TEXT,
  behaviours_values_notes     TEXT,

  -- Score visibility: hidden from employee until HR Admin unlocks
  visible_to_employee BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (manager_id, employee_id, period_id)
);

-- ───────────────────────────────────────────────────────────────────
-- Annual Scores
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE annual_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES profiles(id),
  year                INTEGER NOT NULL,

  -- Suggested (calculated average from quarterly scores)
  suggested_professional_mastery  NUMERIC(3,2),
  suggested_okrs_stretch_goals    NUMERIC(3,2),
  suggested_behaviours_values     NUMERIC(3,2),

  -- Manager override (NULL = use suggested)
  final_professional_mastery  NUMERIC(3,2),
  final_okrs_stretch_goals    NUMERIC(3,2),
  final_behaviours_values     NUMERIC(3,2),

  -- Overall final (average of three components, or NULL if not finalized)
  final_overall       NUMERIC(3,2),
  override_rationale  TEXT,

  finalized_by        UUID REFERENCES profiles(id),
  finalized_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, year)
);

-- ───────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE quarterly_okr_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_scores ENABLE ROW LEVEL SECURITY;

-- Quarterly OKR Reviews: manager reads/writes their own; employee reads their own
CREATE POLICY "qokr_reviews_manager_rw"
  ON quarterly_okr_reviews
  FOR ALL
  TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "qokr_reviews_employee_read"
  ON quarterly_okr_reviews
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- HR Admin reads all OKR reviews
CREATE POLICY "qokr_reviews_hradmin_read"
  ON quarterly_okr_reviews
  FOR SELECT
  TO authenticated
  USING (private.is_hr_admin());

-- Quarterly Scores: manager reads/writes their own
CREATE POLICY "qscores_manager_rw"
  ON quarterly_scores
  FOR ALL
  TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Employee reads their own score only if visible_to_employee = true
CREATE POLICY "qscores_employee_read"
  ON quarterly_scores
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() AND visible_to_employee = true);

-- HR Admin reads and updates all scores (for visibility toggle)
CREATE POLICY "qscores_hradmin_all"
  ON quarterly_scores
  FOR ALL
  TO authenticated
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());

-- Annual Scores: HR Admin writes; managers read their subtree; employees read their own
CREATE POLICY "annual_scores_hradmin_all"
  ON annual_scores
  FOR ALL
  TO authenticated
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());

CREATE POLICY "annual_scores_manager_write"
  ON annual_scores
  FOR ALL
  TO authenticated
  USING (private.is_in_my_subtree(employee_id))
  WITH CHECK (private.is_in_my_subtree(employee_id));

CREATE POLICY "annual_scores_employee_read"
  ON annual_scores
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────
-- Helper: compute suggested annual scores for an employee/year
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_annual_averages(
  p_employee_id UUID,
  p_year INTEGER
)
RETURNS TABLE(
  avg_professional_mastery NUMERIC,
  avg_okrs_stretch_goals   NUMERIC,
  avg_behaviours_values    NUMERIC,
  quarters_counted         INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ROUND(AVG(qs.professional_mastery)::NUMERIC, 2),
    ROUND(AVG(qs.okrs_stretch_goals)::NUMERIC, 2),
    ROUND(AVG(qs.behaviours_values)::NUMERIC, 2),
    COUNT(*)::INTEGER
  FROM quarterly_scores qs
  JOIN performance_periods pp ON pp.id = qs.period_id
  WHERE qs.employee_id = p_employee_id
    AND pp.year = p_year
    AND qs.professional_mastery IS NOT NULL
    AND qs.okrs_stretch_goals IS NOT NULL
    AND qs.behaviours_values IS NOT NULL;
$$;
