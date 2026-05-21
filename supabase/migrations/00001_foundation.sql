-- ============================================================
-- LunarTrack Foundation Migration
-- Run this in Supabase SQL Editor in a single pass
-- NOTE: Run once only — will error if objects already exist
-- ============================================================

-- ============================================================
-- STEP 1: Custom types
-- ============================================================
CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'MANAGER', 'HR_ADMIN');
CREATE TYPE period_status AS ENUM ('open', 'closed');

-- ============================================================
-- STEP 2: Core tables
-- ============================================================

-- profiles: one row per authenticated user
CREATE TABLE profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT,
  avatar_url  TEXT,
  role        user_role   NOT NULL DEFAULT 'EMPLOYEE',
  manager_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- org_closure: closure table for fast hierarchy queries
CREATE TABLE org_closure (
  ancestor_id   UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  descendant_id UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  depth         INTEGER NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_org_closure_ancestor   ON org_closure(ancestor_id);
CREATE INDEX idx_org_closure_descendant ON org_closure(descendant_id);

-- performance_periods: Q1–Q4 periods per year
CREATE TABLE performance_periods (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT          NOT NULL,
  year       INTEGER       NOT NULL,
  quarter    INTEGER       NOT NULL CHECK (quarter IN (1, 2, 3, 4)),
  start_date DATE          NOT NULL,
  end_date   DATE          NOT NULL,
  status     period_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (year, quarter)
);

CREATE INDEX idx_periods_year   ON performance_periods(year);
CREATE INDEX idx_periods_status ON performance_periods(status);

-- ============================================================
-- STEP 3: Private schema + SECURITY DEFINER helpers
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;

-- Returns the current authenticated user's role
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = (SELECT auth.uid())
$$;

-- Returns true if the current user is HR_ADMIN
CREATE OR REPLACE FUNCTION private.is_hr_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid()) AND role = 'HR_ADMIN'
  )
$$;

-- Returns true if target_user_id is in the current manager's subtree
-- Uses indexed EXISTS + (SELECT auth.uid()) for PostgreSQL initPlan caching
CREATE OR REPLACE FUNCTION private.is_in_my_subtree(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_closure
    WHERE ancestor_id   = (SELECT auth.uid())
      AND descendant_id = target_user_id
      AND depth > 0
  )
$$;

-- ============================================================
-- STEP 4: Public utility functions
-- ============================================================

-- Returns all subordinates of a manager (depth > 0)
CREATE OR REPLACE FUNCTION get_subordinates(manager_uuid UUID)
RETURNS TABLE (
  id          UUID,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  role        user_role,
  manager_id  UUID,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  depth       INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.email, p.full_name, p.avatar_url, p.role,
    p.manager_id, p.created_at, p.updated_at,
    oc.depth
  FROM org_closure oc
  JOIN profiles p ON p.id = oc.descendant_id
  WHERE oc.ancestor_id = manager_uuid
    AND oc.depth > 0
  ORDER BY oc.depth, p.full_name
$$;

-- Upserts profile on login — NEVER overwrites role or manager_id
-- Also inserts self-closure row (depth = 0)
CREATE OR REPLACE FUNCTION upsert_profile_on_login(
  user_id       UUID,
  user_email    TEXT,
  user_full_name TEXT,
  user_avatar_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (user_id, user_email, user_full_name, user_avatar_url)
  ON CONFLICT (id) DO UPDATE
    SET
      full_name  = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
  -- Ensure self-closure row exists (depth = 0)
  INSERT INTO org_closure (ancestor_id, descendant_id, depth)
  VALUES (user_id, user_id, 0)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Atomically rebuilds closure rows when a manager assignment changes
-- Handles subtree moves: deletes old parent links, inserts new ones
CREATE OR REPLACE FUNCTION rebuild_closure_for_employee(
  employee_uuid   UUID,
  new_manager_uuid UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subtree_ids UUID[];
BEGIN
  -- Collect all descendants of the employee (inclusive)
  SELECT ARRAY(
    SELECT descendant_id FROM org_closure
    WHERE ancestor_id = employee_uuid
  ) INTO subtree_ids;

  -- Remove old parent links: delete closure rows where
  -- descendant is in the subtree AND ancestor is NOT in the subtree
  DELETE FROM org_closure
  WHERE descendant_id = ANY(subtree_ids)
    AND ancestor_id != ALL(subtree_ids);

  -- Insert new parent links if a new manager is specified
  IF new_manager_uuid IS NOT NULL THEN
    INSERT INTO org_closure (ancestor_id, descendant_id, depth)
    SELECT
      anc.ancestor_id,
      desc_id.descendant_id,
      anc.depth + desc_id.depth + 1
    FROM
      org_closure anc
      CROSS JOIN (
        SELECT descendant_id, depth FROM org_closure
        WHERE ancestor_id = employee_uuid
      ) desc_id
    WHERE anc.descendant_id = new_manager_uuid
    ON CONFLICT (ancestor_id, descendant_id)
      DO UPDATE SET depth = EXCLUDED.depth;
  END IF;
END;
$$;

-- ============================================================
-- STEP 5: Row Level Security
-- ============================================================

-- Enable RLS
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_closure         ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_periods ENABLE ROW LEVEL SECURITY;

-- ---- profiles policies ----

CREATE POLICY profiles_self_read
  ON profiles FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_manager_reads_reports
  ON profiles FOR SELECT
  USING (private.is_in_my_subtree(id));

CREATE POLICY profiles_hr_admin_reads_all
  ON profiles FOR SELECT
  USING (private.is_hr_admin());

CREATE POLICY profiles_hr_admin_writes
  ON profiles FOR UPDATE
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());

CREATE POLICY profiles_self_update_meta
  ON profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_self_insert
  ON profiles FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

-- ---- org_closure policies ----

CREATE POLICY closure_hr_admin_all
  ON org_closure FOR ALL
  USING (private.is_hr_admin());

CREATE POLICY closure_self_row
  ON org_closure FOR SELECT
  USING (
    ancestor_id   = (SELECT auth.uid())
    AND descendant_id = (SELECT auth.uid())
  );

CREATE POLICY closure_manager_reads_subtree
  ON org_closure FOR SELECT
  USING (ancestor_id = (SELECT auth.uid()));

-- ---- performance_periods policies ----

CREATE POLICY periods_authenticated_read
  ON performance_periods FOR SELECT
  USING (true);

CREATE POLICY periods_hr_admin_writes
  ON performance_periods FOR ALL
  USING (private.is_hr_admin());

-- ============================================================
-- END OF MIGRATION
-- ============================================================
