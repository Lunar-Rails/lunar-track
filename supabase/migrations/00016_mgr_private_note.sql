-- Manager-only private notes on monthly and quarterly check-ins.
-- Not visible to employees; used by manager forms in the app.

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS mgr_private_note TEXT;

ALTER TABLE quarterly_checkins
  ADD COLUMN IF NOT EXISTS mgr_private_note TEXT;
