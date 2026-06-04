-- Security fixes: CR-02, WR-08, WR-09

-- CR-02: Restrict profiles_self_update_meta to prevent role self-escalation.
-- The previous WITH CHECK only verified id = auth.uid(), allowing any user to
-- PATCH their own role to HR_ADMIN via a direct PostgREST call.
DROP POLICY IF EXISTS profiles_self_update_meta ON profiles;

CREATE POLICY profiles_self_update_meta
  ON profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- WR-08: Add caller existence check to get_subordinates.
-- Previously any authenticated user could query any manager's full org subtree.
-- Drop first because CREATE OR REPLACE cannot change an existing function's return type.
DROP FUNCTION IF EXISTS get_subordinates(UUID);
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be an authenticated profile
  IF (SELECT id FROM profiles WHERE id = auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id, p.email, p.full_name, p.avatar_url, p.role,
      p.manager_id, p.created_at, p.updated_at,
      oc.depth
    FROM org_closure oc
    JOIN profiles p ON p.id = oc.descendant_id
    WHERE oc.ancestor_id = manager_uuid
      AND oc.depth > 0
    ORDER BY oc.depth, p.full_name;
END;
$$;

-- WR-09: Restrict compute_annual_averages to own data or manager/HR_ADMIN.
-- Previously any employee could fetch another employee's aggregated scores.
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Employees can only see their own averages
  IF v_caller_role = 'EMPLOYEE' AND auth.uid() != p_employee_id THEN
    RAISE EXCEPTION 'Unauthorized: employees may only view their own averages';
  END IF;

  RETURN QUERY
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
END;
$$;
