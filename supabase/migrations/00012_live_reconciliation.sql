-- ============================================================
-- 00012_live_reconciliation.sql
-- Reconciles the checked-in migration history with the schema
-- shape expected by the live app and current production data.
-- ============================================================

-- ------------------------------------------------------------
-- Profiles: onboarding support
-- ------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pending_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_pending_manager_id
  ON profiles(pending_manager_id);

-- Existing live users already attached to a manager should be considered onboarded.
UPDATE profiles
SET is_onboarded = true
WHERE is_onboarded = false
  AND (
    manager_id IS NOT NULL
    OR role IN ('MANAGER', 'HR_ADMIN')
  );

DROP POLICY IF EXISTS profiles_manager_reads_pending_requests ON profiles;
CREATE POLICY profiles_manager_reads_pending_requests
  ON profiles FOR SELECT
  USING (pending_manager_id = (SELECT auth.uid()));

DROP FUNCTION IF EXISTS get_subordinates(UUID);
CREATE OR REPLACE FUNCTION get_subordinates(manager_uuid UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role user_role,
  manager_id UUID,
  is_onboarded BOOLEAN,
  pending_manager_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  depth INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.role,
    p.manager_id,
    p.is_onboarded,
    p.pending_manager_id,
    p.created_at,
    p.updated_at,
    oc.depth
  FROM org_closure oc
  JOIN profiles p ON p.id = oc.descendant_id
  WHERE oc.ancestor_id = manager_uuid
    AND oc.depth > 0
  ORDER BY oc.depth, p.full_name
$$;

-- ------------------------------------------------------------
-- OKR hierarchy: key results + initiatives
-- ------------------------------------------------------------
DROP TABLE IF EXISTS okr_initiatives CASCADE;

CREATE TABLE IF NOT EXISTS key_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id          UUID        NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  progress_status TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (progress_status IN ('not_started', 'in_progress', 'on_track', 'at_risk', 'done')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_key_results_okr_id
  ON key_results(okr_id);

CREATE INDEX IF NOT EXISTS idx_key_results_sort_order
  ON key_results(okr_id, sort_order);

CREATE TABLE IF NOT EXISTS initiatives (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id  UUID        NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  completed      BOOLEAN     NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_initiatives_key_result_id
  ON initiatives(key_result_id);

CREATE INDEX IF NOT EXISTS idx_initiatives_sort_order
  ON initiatives(key_result_id, sort_order);

ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS key_results_owner_all ON key_results;
CREATE POLICY key_results_owner_all
  ON key_results FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM okrs
      WHERE okrs.id = key_results.okr_id
        AND okrs.employee_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM okrs
      WHERE okrs.id = key_results.okr_id
        AND okrs.employee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS key_results_manager_reads ON key_results;
CREATE POLICY key_results_manager_reads
  ON key_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM okrs
      WHERE okrs.id = key_results.okr_id
        AND private.is_in_my_subtree(okrs.employee_id)
    )
  );

DROP POLICY IF EXISTS key_results_hr_admin_all ON key_results;
CREATE POLICY key_results_hr_admin_all
  ON key_results FOR ALL
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());

DROP POLICY IF EXISTS initiatives_owner_all ON initiatives;
CREATE POLICY initiatives_owner_all
  ON initiatives FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM key_results
      JOIN okrs ON okrs.id = key_results.okr_id
      WHERE key_results.id = initiatives.key_result_id
        AND okrs.employee_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM key_results
      JOIN okrs ON okrs.id = key_results.okr_id
      WHERE key_results.id = initiatives.key_result_id
        AND okrs.employee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS initiatives_manager_reads ON initiatives;
CREATE POLICY initiatives_manager_reads
  ON initiatives FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM key_results
      JOIN okrs ON okrs.id = key_results.okr_id
      WHERE key_results.id = initiatives.key_result_id
        AND private.is_in_my_subtree(okrs.employee_id)
    )
  );

DROP POLICY IF EXISTS initiatives_hr_admin_all ON initiatives;
CREATE POLICY initiatives_hr_admin_all
  ON initiatives FOR ALL
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());

-- ------------------------------------------------------------
-- Onboarding RPCs used by the app
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_managers()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name
  FROM profiles p
  WHERE p.role IN ('MANAGER', 'HR_ADMIN')
    AND p.is_onboarded = true
  ORDER BY COALESCE(p.full_name, p.email)
$$;

CREATE OR REPLACE FUNCTION approve_team_request(employee_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uuid UUID := auth.uid();
  caller_role user_role;
  requested_manager UUID;
BEGIN
  IF caller_uuid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role
  FROM profiles
  WHERE id = caller_uuid;

  SELECT pending_manager_id INTO requested_manager
  FROM profiles
  WHERE id = employee_uuid
  FOR UPDATE;

  IF requested_manager IS NULL THEN
    RAISE EXCEPTION 'No pending manager request found';
  END IF;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Caller profile not found';
  END IF;

  IF caller_role <> 'HR_ADMIN' AND requested_manager <> caller_uuid THEN
    RAISE EXCEPTION 'Not authorized to approve this request';
  END IF;

  UPDATE profiles
  SET
    manager_id = requested_manager,
    pending_manager_id = NULL,
    is_onboarded = true,
    updated_at = now()
  WHERE id = employee_uuid;

  PERFORM rebuild_closure_for_employee(employee_uuid, requested_manager);
END;
$$;

CREATE OR REPLACE FUNCTION decline_team_request(employee_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uuid UUID := auth.uid();
  caller_role user_role;
  requested_manager UUID;
BEGIN
  IF caller_uuid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role
  FROM profiles
  WHERE id = caller_uuid;

  SELECT pending_manager_id INTO requested_manager
  FROM profiles
  WHERE id = employee_uuid
  FOR UPDATE;

  IF requested_manager IS NULL THEN
    RAISE EXCEPTION 'No pending manager request found';
  END IF;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Caller profile not found';
  END IF;

  IF caller_role <> 'HR_ADMIN' AND requested_manager <> caller_uuid THEN
    RAISE EXCEPTION 'Not authorized to decline this request';
  END IF;

  UPDATE profiles
  SET
    pending_manager_id = NULL,
    updated_at = now()
  WHERE id = employee_uuid;
END;
$$;
