-- checkins: add employee-owned next_mits (enriched with okr link + status)
-- The old mgr_next_mits column is kept for backward compatibility with existing rows.
alter table checkins
  add column if not exists next_mits jsonb;

-- quarterly_checkins: goals review, next-quarter goals and MITs, value assessments v2
alter table quarterly_checkins
  add column if not exists goals              jsonb,
  add column if not exists next_quarter_goals jsonb,
  add column if not exists next_quarter_mits  jsonb,
  add column if not exists value_assessments  jsonb;
