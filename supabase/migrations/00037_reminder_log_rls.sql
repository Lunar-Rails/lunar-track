-- Enable RLS on reminder_log (was a public table without RLS — flagged CRITICAL by
-- the Supabase security advisor: "RLS Disabled in Public").
--
-- Safe: the reminder cron (netlify/functions/email-reminders.mts) uses the
-- service-role key, which BYPASSES RLS, so reminder sends are unaffected. No app
-- code reads this table with a user session. HR admins get full read/write from
-- the app via the policy below; everyone else (and the anon API) is denied.

ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminder_log_hr_admin ON reminder_log;
CREATE POLICY reminder_log_hr_admin ON reminder_log
  FOR ALL
  USING (private.is_hr_admin())
  WITH CHECK (private.is_hr_admin());
