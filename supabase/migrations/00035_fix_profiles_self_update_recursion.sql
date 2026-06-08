-- Fix infinite recursion in profiles RLS (regression introduced by 00025 CR-02)
--
-- 00025_security_fixes.sql tightened profiles_self_update_meta to block role
-- self-escalation by adding to its WITH CHECK:
--   role = (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
-- That inline subquery reads `profiles` from inside a policy ON `profiles`, so
-- evaluating ANY update on the table re-enters the same policy. PostgreSQL
-- aborts with: "infinite recursion detected in policy for relation profiles".
-- This blocked every profile UPDATE, including HR_ADMIN manager reassignment
-- from the admin UI.
--
-- Fix: read the caller's current role through the existing SECURITY DEFINER
-- helper private.current_user_role(). It runs as the table owner and bypasses
-- RLS, so the cycle is broken while CR-02's protection is preserved: a user
-- still cannot change their own role (new role must equal their stored role),
-- but managers/HR admins changing OTHER columns (e.g. manager_id) no longer
-- trip the recursion.

-- Ensure the helper exists and is SECURITY DEFINER (idempotent; matches 00001).
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = (SELECT auth.uid())
$$;

-- Replace the recursive self-update policy with a non-recursive equivalent.
DROP POLICY IF EXISTS profiles_self_update_meta ON profiles;

CREATE POLICY profiles_self_update_meta
  ON profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = private.current_user_role()
  );
