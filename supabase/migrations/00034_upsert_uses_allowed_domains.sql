-- Replace hardcoded domain list in upsert_profile_on_login with a table lookup.
-- allowed_domains is now the single source of truth (see 00033_allowed_domains_table.sql).
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
DECLARE
  email_domain TEXT := lower(split_part(user_email, '@', 2));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM allowed_domains WHERE domain = email_domain) THEN
    RAISE EXCEPTION 'Email domain not allowed: %', email_domain;
  END IF;

  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (user_id, user_email, user_full_name, user_avatar_url)
  ON CONFLICT (id) DO UPDATE
    SET
      full_name  = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();

  INSERT INTO org_closure (ancestor_id, descendant_id, depth)
  VALUES (user_id, user_id, 0)
  ON CONFLICT DO NOTHING;
END;
$$;
