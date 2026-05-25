-- Clean all test performance data for the core team before go-live.
-- Removes check-ins, quarterly check-ins, quarterly scores, OKRs,
-- key results, and initiatives. Profiles and org structure are preserved.

DO $$
DECLARE
  target_ids uuid[] := ARRAY[
    '7bf0d1e4-1133-42be-b5df-0881c4c7e70d', -- Max
    'bbbbbbbb-0005-0000-0000-000000000000', -- Ben
    'bbbbbbbb-0009-0000-0000-000000000000', -- Kevin
    'bbbbbbbb-0008-0000-0000-000000000000', -- Lisa
    'bbbbbbbb-0004-0000-0000-000000000000', -- Marthe
    'bbbbbbbb-0007-0000-0000-000000000000', -- Ronnie
    'bbbbbbbb-0006-0000-0000-000000000000'  -- Callum
  ];
BEGIN
  DELETE FROM initiatives
    WHERE key_result_id IN (
      SELECT id FROM key_results
      WHERE okr_id IN (SELECT id FROM okrs WHERE employee_id = ANY(target_ids))
    );

  DELETE FROM key_results
    WHERE okr_id IN (SELECT id FROM okrs WHERE employee_id = ANY(target_ids));

  DELETE FROM okrs WHERE employee_id = ANY(target_ids);

  DELETE FROM checkins WHERE employee_id = ANY(target_ids);

  DELETE FROM quarterly_checkins WHERE employee_id = ANY(target_ids);

  DELETE FROM quarterly_scores WHERE employee_id = ANY(target_ids);
END $$;
