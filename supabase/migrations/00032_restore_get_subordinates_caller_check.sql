-- Restore auth.uid() caller check on get_subordinates that was dropped by 00030.
-- 00025 added the check; 00030 replaced the function to add is_active filtering
-- but used LANGUAGE sql (no procedural block for the guard). Convert back to
-- plpgsql and re-add the caller check while keeping the 00030 return type and
-- is_active filter.

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT p.id FROM profiles p WHERE p.id = auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id, p.email, p.full_name, p.avatar_url, p.role,
      p.manager_id, p.is_onboarded, p.pending_manager_id,
      p.created_at, p.updated_at, oc.depth
    FROM org_closure oc
    JOIN profiles p ON p.id = oc.descendant_id
    WHERE oc.ancestor_id = manager_uuid
      AND oc.depth > 0
      AND p.is_active = true
    ORDER BY oc.depth, p.full_name;
END;
$$;
