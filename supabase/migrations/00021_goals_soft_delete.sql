-- Soft delete for goals (okrs)
ALTER TABLE okrs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
