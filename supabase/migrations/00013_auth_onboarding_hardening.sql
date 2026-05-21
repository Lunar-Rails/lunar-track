-- ============================================================
-- 00013_auth_onboarding_hardening.sql
-- Hardens onboarding and auth flows for fresh environments.
-- ============================================================

-- Allow any authenticated user to see the manager list needed for onboarding,
-- even if the PostgREST RPC schema cache has not picked up get_managers yet.
DROP POLICY IF EXISTS profiles_authenticated_reads_managers ON profiles;
CREATE POLICY profiles_authenticated_reads_managers
  ON profiles FOR SELECT
  USING (role IN ('MANAGER', 'HR_ADMIN') AND is_onboarded = true);

-- Ensure closure rebuilding always seeds the employee's self row so onboarding
-- approvals work even if the profile was created via the direct fallback path.
CREATE OR REPLACE FUNCTION rebuild_closure_for_employee(
  employee_uuid UUID,
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
  INSERT INTO org_closure (ancestor_id, descendant_id, depth)
  VALUES (employee_uuid, employee_uuid, 0)
  ON CONFLICT DO NOTHING;

  SELECT ARRAY(
    SELECT descendant_id
    FROM org_closure
    WHERE ancestor_id = employee_uuid
  ) INTO subtree_ids;

  DELETE FROM org_closure
  WHERE descendant_id = ANY(subtree_ids)
    AND ancestor_id != ALL(subtree_ids);

  IF new_manager_uuid IS NOT NULL THEN
    INSERT INTO org_closure (ancestor_id, descendant_id, depth)
    SELECT
      anc.ancestor_id,
      desc_id.descendant_id,
      anc.depth + desc_id.depth + 1
    FROM org_closure anc
    CROSS JOIN (
      SELECT descendant_id, depth
      FROM org_closure
      WHERE ancestor_id = employee_uuid
    ) desc_id
    WHERE anc.descendant_id = new_manager_uuid
    ON CONFLICT (ancestor_id, descendant_id)
      DO UPDATE SET depth = EXCLUDED.depth;
  END IF;
END;
$$;
