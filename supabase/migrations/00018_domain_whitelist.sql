-- Domain whitelist guard on upsert_profile_on_login.
-- Keep this list in sync with src/lib/auth/allowed-domains.ts.
CREATE OR REPLACE FUNCTION upsert_profile_on_login(
  user_id         UUID,
  user_email      TEXT,
  user_full_name  TEXT,
  user_avatar_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF split_part(user_email, '@', 2) NOT IN (
    'lunarrails.io', '40acres.pro', 'chainlabs.ai', 'podproza.cz', 'osirisconcepts.com'
  ) THEN
    RAISE EXCEPTION 'Email domain not allowed: %', split_part(user_email, '@', 2);
  END IF;

  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (user_id, user_email, user_full_name, user_avatar_url)
  ON CONFLICT (id) DO UPDATE
    SET
      full_name  = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();

  -- Ensure self-closure row exists (depth = 0)
  INSERT INTO org_closure (ancestor_id, descendant_id, depth)
  VALUES (user_id, user_id, 0)
  ON CONFLICT DO NOTHING;
END;
$$;
