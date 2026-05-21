-- ============================================================
-- LunarTrack Core Features Migration (Phase 2)
-- Run after 00001_foundation.sql
-- ============================================================

-- ============================================================
-- STEP 1: New enums
-- ============================================================
CREATE TYPE okr_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REVISION_REQUESTED');

-- ============================================================
-- STEP 2: OKRs
-- ============================================================
CREATE TABLE okrs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_id        UUID        NOT NULL REFERENCES performance_periods(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  status           okr_status  NOT NULL DEFAULT 'DRAFT',
  manager_comment  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_okrs_employee_id ON okrs(employee_id);
CREATE INDEX idx_okrs_period_id   ON okrs(period_id);
CREATE INDEX idx_okrs_status      ON okrs(status);

-- ============================================================
-- STEP 3: OKR Initiatives
-- ============================================================
CREATE TABLE okr_initiatives (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id     UUID        NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_okr_initiatives_okr_id ON okr_initiatives(okr_id);

-- ============================================================
-- STEP 4: Monthly Check-ins (typed columns, not JSONB)
-- ============================================================
CREATE TABLE checkins (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_id          UUID        NOT NULL REFERENCES performance_periods(id) ON DELETE CASCADE,
  month              INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year               INTEGER     NOT NULL,

  -- Employee pre-meeting section
  mit_1_title        TEXT,
  mit_1_description  TEXT,
  mit_2_title        TEXT,
  mit_2_description  TEXT,
  mit_3_title        TEXT,
  mit_3_description  TEXT,
  done_well          TEXT,
  do_differently     TEXT,
  support_requests   TEXT,
  ai_builder         TEXT,
  employee_submitted_at TIMESTAMPTZ,

  -- Manager post-meeting section
  mgr_mit_notes          TEXT,
  mgr_done_well          TEXT,
  mgr_do_differently     TEXT,
  mgr_support_commitments TEXT,
  mgr_next_mit_1_title   TEXT,
  mgr_next_mit_1_description TEXT,
  mgr_next_mit_2_title   TEXT,
  mgr_next_mit_2_description TEXT,
  mgr_next_mit_3_title   TEXT,
  mgr_next_mit_3_description TEXT,
  manager_submitted_at   TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (employee_id, period_id, month, year)
);

CREATE INDEX idx_checkins_employee_id ON checkins(employee_id);
CREATE INDEX idx_checkins_period_id   ON checkins(period_id);
CREATE INDEX idx_checkins_year_month  ON checkins(year, month);

-- ============================================================
-- STEP 5: RLS — OKRs
-- ============================================================
ALTER TABLE okrs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_initiatives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins         ENABLE ROW LEVEL SECURITY;

-- okrs: employees see own
CREATE POLICY okrs_self_read
  ON okrs FOR SELECT
  USING (employee_id = (SELECT auth.uid()));

-- okrs: employees write own (INSERT + UPDATE on own rows)
CREATE POLICY okrs_self_insert
  ON okrs FOR INSERT
  WITH CHECK (employee_id = (SELECT auth.uid()));

CREATE POLICY okrs_self_update
  ON okrs FOR UPDATE
  USING (employee_id = (SELECT auth.uid()))
  WITH CHECK (employee_id = (SELECT auth.uid()));

-- okrs: managers see direct reports in subtree
CREATE POLICY okrs_manager_reads_reports
  ON okrs FOR SELECT
  USING (private.is_in_my_subtree(employee_id));

-- okrs: managers can update (for approval/revision comment)
CREATE POLICY okrs_manager_updates_reports
  ON okrs FOR UPDATE
  USING (private.is_in_my_subtree(employee_id))
  WITH CHECK (private.is_in_my_subtree(employee_id));

-- okrs: HR Admin sees all
CREATE POLICY okrs_hr_admin_all
  ON okrs FOR ALL
  USING (private.is_hr_admin());

-- ---- okr_initiatives policies ----
CREATE POLICY initiatives_via_okr_owner
  ON okr_initiatives FOR ALL
  USING (
    EXISTS (SELECT 1 FROM okrs WHERE id = okr_id AND employee_id = (SELECT auth.uid()))
  );

CREATE POLICY initiatives_via_manager
  ON okr_initiatives FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM okrs WHERE id = okr_id AND private.is_in_my_subtree(employee_id))
  );

CREATE POLICY initiatives_hr_admin_all
  ON okr_initiatives FOR ALL
  USING (private.is_hr_admin());

-- ============================================================
-- STEP 6: RLS — Check-ins
-- ============================================================

-- Employees see own check-ins
CREATE POLICY checkins_self_read
  ON checkins FOR SELECT
  USING (employee_id = (SELECT auth.uid()));

-- Employees can insert own check-ins
CREATE POLICY checkins_self_insert
  ON checkins FOR INSERT
  WITH CHECK (employee_id = (SELECT auth.uid()));

-- Employees can update own check-ins (employee section only — column restriction at app layer)
CREATE POLICY checkins_self_update
  ON checkins FOR UPDATE
  USING (employee_id = (SELECT auth.uid()))
  WITH CHECK (employee_id = (SELECT auth.uid()));

-- Managers see submitted check-ins of their reports (visibility gate)
CREATE POLICY checkins_manager_reads_submitted
  ON checkins FOR SELECT
  USING (
    private.is_in_my_subtree(employee_id)
    AND employee_submitted_at IS NOT NULL
  );

-- Managers can update post-meeting section of submitted check-ins
CREATE POLICY checkins_manager_updates
  ON checkins FOR UPDATE
  USING (
    private.is_in_my_subtree(employee_id)
    AND employee_submitted_at IS NOT NULL
  )
  WITH CHECK (
    private.is_in_my_subtree(employee_id)
  );

-- HR Admin sees all check-ins
CREATE POLICY checkins_hr_admin_all
  ON checkins FOR ALL
  USING (private.is_hr_admin());

-- ============================================================
-- STEP 7: Helper function — get pending OKR approvals count
-- ============================================================
CREATE OR REPLACE FUNCTION get_pending_okr_count(manager_uuid UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM okrs o
  WHERE o.status = 'PENDING_REVIEW'
    AND EXISTS (
      SELECT 1 FROM org_closure oc
      WHERE oc.ancestor_id = manager_uuid
        AND oc.descendant_id = o.employee_id
        AND oc.depth > 0
    )
$$;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
