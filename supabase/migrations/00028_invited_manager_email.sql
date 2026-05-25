-- Allow employees to store an invited manager email when their manager
-- isn't yet in the system. Cleared once the manager onboards and the
-- pending_manager_id is resolved.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_manager_email TEXT;
