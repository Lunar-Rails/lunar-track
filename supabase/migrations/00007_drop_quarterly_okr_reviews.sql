-- Drop the redundant quarterly_okr_reviews table.
-- Its functionality is replaced by the newer quarterly_checkins flow
-- (see migration 00005_quarterly_checkins.sql).
DROP TABLE IF EXISTS quarterly_okr_reviews CASCADE;
