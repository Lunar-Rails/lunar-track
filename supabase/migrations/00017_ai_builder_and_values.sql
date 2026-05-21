-- Add AI Builder fields to quarterly_checkins (employee self-report)
ALTER TABLE quarterly_checkins
  ADD COLUMN IF NOT EXISTS ai_builder_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_builder_description TEXT;

-- Replace company values with BCOMM values
DELETE FROM company_values;

INSERT INTO company_values (name, description, sort_order) VALUES
  ('Truth over comfort',   'We say what needs to be said, even when it''s difficult. Honest feedback and direct communication drive our growth.',                1),
  ('Act with Agency',      'We take ownership and move forward without waiting to be asked. We identify problems and solve them.',                              2),
  ('Focus on the future',  'We invest in long-term thinking and build for what comes next, not just solve today''s problems.',                                 3),
  ('Ship great things',    'We build with quality and pride. Done means delivered, working, and something we''re proud of.',                                   4),
  ('One team, one system', 'We succeed together. Our collective output matters more than individual credit.',                                                   5);
