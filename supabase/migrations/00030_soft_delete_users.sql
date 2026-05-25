-- Soft-delete support: is_active flag on profiles.
-- Deactivated users disappear from all UI but data is preserved.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active) WHERE is_active = false;

-- Update get_managers to exclude inactive users
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
    AND p.is_active = true
  ORDER BY COALESCE(p.full_name, p.email)
$$;

-- Update get_subordinates to exclude inactive users
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
    p.id, p.email, p.full_name, p.avatar_url, p.role,
    p.manager_id, p.is_onboarded, p.pending_manager_id,
    p.created_at, p.updated_at, oc.depth
  FROM org_closure oc
  JOIN profiles p ON p.id = oc.descendant_id
  WHERE oc.ancestor_id = manager_uuid
    AND oc.depth > 0
    AND p.is_active = true
  ORDER BY oc.depth, p.full_name
$$;

-- Security-definer RPC: HR_ADMIN deactivates a user without needing service role key.
-- Clears all manager relationships atomically.
CREATE OR REPLACE FUNCTION deactivate_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role != 'HR_ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: HR Admin access required';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  -- Soft delete
  UPDATE profiles SET is_active = false, manager_id = null
  WHERE id = target_user_id;

  -- Remove as direct manager for others
  UPDATE profiles SET manager_id = null WHERE manager_id = target_user_id;

  -- Remove as pending manager for others
  UPDATE profiles SET pending_manager_id = null WHERE pending_manager_id = target_user_id;

  -- Clean up org hierarchy closure rows
  DELETE FROM org_closure
  WHERE ancestor_id = target_user_id OR descendant_id = target_user_id;
END;
$$;
