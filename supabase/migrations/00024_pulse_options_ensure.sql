-- Ensure pulse_options table exists (re-apply if 00023 was missed by auto-deploy)
CREATE TABLE IF NOT EXISTS pulse_options (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text NOT NULL CHECK (type IN ('energy', 'flow')),
  slug       text NOT NULL,
  label      text NOT NULL,
  color      text NOT NULL DEFAULT '#7c5cfc',
  emoji      text NOT NULL DEFAULT '😐',
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (type, slug)
);

ALTER TABLE pulse_options ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pulse_options' AND policyname = 'pulse_options_read'
  ) THEN
    CREATE POLICY "pulse_options_read" ON pulse_options
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pulse_options' AND policyname = 'pulse_options_admin_write'
  ) THEN
    CREATE POLICY "pulse_options_admin_write" ON pulse_options
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'HR_ADMIN'
        )
      );
  END IF;
END $$;

INSERT INTO pulse_options (type, slug, label, color, emoji, sort_order) VALUES
  ('energy', 'terrible', 'Terrible',        '#ef4444', '😩', 1),
  ('energy', 'meh',      'Meh',             '#f59e0b', '😐', 2),
  ('energy', 'okay',     'Okay',            '#06b6d4', '🙂', 3),
  ('energy', 'great',    'Great',           '#7c5cfc', '🔥', 4),
  ('flow',   'waste',    'Waste of time',   '#ef4444', '🐌', 1),
  ('flow',   'fine',     'Can''t complain', '#06b6d4', '👍', 2),
  ('flow',   'ludicrous','Ludicrous Speed', '#7c5cfc', '🚀', 3)
ON CONFLICT (type, slug) DO NOTHING;
