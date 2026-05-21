-- Add a JSONB column to store unlimited MITs as [{title, description}]
-- The old mit_1/2/3 columns are kept for backwards compatibility with existing rows.
-- New rows will use this column; the form migrates legacy data on first load.
alter table checkins add column if not exists mits jsonb;
alter table checkins add column if not exists mgr_next_mits jsonb;
