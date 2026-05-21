-- Cleanup all demo / fake activity data.
-- Preserves profiles, org hierarchy, company values, and performance periods.
-- Run this once in the Supabase SQL editor to reset to a clean state.

-- Remove all initiatives (child of key_results)
DELETE FROM initiatives;

-- Remove all key results (child of okrs)
DELETE FROM key_results;

-- Remove all OKRs / goals
DELETE FROM okrs;

-- Remove all monthly check-ins
DELETE FROM checkins;

-- Remove all quarterly check-ins
DELETE FROM quarterly_checkins;

-- Remove all quarterly scores
DELETE FROM quarterly_scores;

-- Remove all annual scores
DELETE FROM annual_scores;
