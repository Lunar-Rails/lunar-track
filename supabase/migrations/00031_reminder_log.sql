-- Tracks successfully delivered check-in reminders.
-- One row = one confirmed send. Used to:
--   1. Avoid re-sending if the cron runs on multiple days within the window.
--   2. Provide an audit trail (who was reminded, when, via which channel).
--
-- Only accessed by the service-role key in scheduled functions — no RLS needed.

CREATE TABLE IF NOT EXISTS reminder_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel       TEXT        NOT NULL CHECK (channel IN ('slack', 'email')),
  reminder_type TEXT        NOT NULL CHECK (reminder_type IN ('monthly', 'quarterly')),
  month         INTEGER     NOT NULL,
  year          INTEGER     NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At-most-once delivery per employee / channel / period.
  UNIQUE (employee_id, channel, reminder_type, month, year)
);

CREATE INDEX IF NOT EXISTS reminder_log_period_idx ON reminder_log (channel, reminder_type, month, year);
