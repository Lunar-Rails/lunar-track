-- ============================================================
-- quarterly_checkins: employee quarterly self-assessment
-- ============================================================
CREATE TABLE quarterly_checkins (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_id             UUID        NOT NULL REFERENCES performance_periods(id) ON DELETE CASCADE,

  -- OKR progress: JSON array [{okr_id: UUID, okr_title: text, status: 'on_track'|'at_risk'|'off_track', narrative: text}]
  okr_progress          JSONB       NOT NULL DEFAULT '[]',

  -- Continue / Stop / Start
  continue_doing        TEXT,
  stop_doing            TEXT,
  start_doing           TEXT,

  -- OKR adjustments: free-text description of changes needed for next quarter
  okr_adjustments       TEXT,

  -- Capability and resource needs
  capability_needs      TEXT,

  employee_submitted_at TIMESTAMPTZ,

  -- Manager review section
  mgr_okr_feedback      TEXT,
  mgr_css_feedback      TEXT,        -- continue/stop/start feedback
  mgr_adjustments_notes TEXT,
  mgr_support_plan      TEXT,
  manager_submitted_at  TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (employee_id, period_id)
);

CREATE INDEX idx_quarterly_checkins_employee_id ON quarterly_checkins(employee_id);
CREATE INDEX idx_quarterly_checkins_period_id   ON quarterly_checkins(period_id);

ALTER TABLE quarterly_checkins ENABLE ROW LEVEL SECURITY;

-- Employee sees own
CREATE POLICY qcheckins_self_read
  ON quarterly_checkins FOR SELECT
  USING (employee_id = (SELECT auth.uid()));

CREATE POLICY qcheckins_self_insert
  ON quarterly_checkins FOR INSERT
  WITH CHECK (employee_id = (SELECT auth.uid()));

CREATE POLICY qcheckins_self_update
  ON quarterly_checkins FOR UPDATE
  USING (employee_id = (SELECT auth.uid()))
  WITH CHECK (employee_id = (SELECT auth.uid()));

-- Manager sees submitted check-ins of reports
CREATE POLICY qcheckins_manager_reads
  ON quarterly_checkins FOR SELECT
  USING (
    private.is_in_my_subtree(employee_id)
    AND employee_submitted_at IS NOT NULL
  );

CREATE POLICY qcheckins_manager_updates
  ON quarterly_checkins FOR UPDATE
  USING (
    private.is_in_my_subtree(employee_id)
    AND employee_submitted_at IS NOT NULL
  )
  WITH CHECK (private.is_in_my_subtree(employee_id));

-- HR Admin sees all
CREATE POLICY qcheckins_hr_admin_all
  ON quarterly_checkins FOR ALL
  USING (private.is_hr_admin());
