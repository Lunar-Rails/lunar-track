-- Single source of truth for the login domain whitelist.
-- To add a domain: INSERT INTO allowed_domains (domain) VALUES ('example.com');
-- To remove a domain: DELETE FROM allowed_domains WHERE domain = 'example.com';
CREATE TABLE IF NOT EXISTS allowed_domains (
  domain     TEXT PRIMARY KEY CHECK (domain = lower(domain)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE allowed_domains ENABLE ROW LEVEL SECURITY;

-- Both anon (pre-auth form validation) and authenticated users may read.
-- Domain names are not sensitive.
CREATE POLICY "Anyone can read allowed_domains"
  ON allowed_domains FOR SELECT
  USING (true);

-- Seed with the current whitelist (superset of both prior TS and SQL lists).
INSERT INTO allowed_domains (domain) VALUES
  ('lunarrails.io'),
  ('clovrlabs.com'),
  ('40acres.pro'),
  ('chainlabs.ai'),
  ('podproza.cz'),
  ('osirisconcepts.com')
ON CONFLICT DO NOTHING;
