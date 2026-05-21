-- ============================================================
-- 00015_fix_auth_identities.sql
-- Backfills auth.identities for seeded auth.users entries that
-- were inserted via raw SQL without going through GoTrue.
-- Without identities, GoTrue can't find users by email and
-- returns "Database error saving new user" on login attempts.
-- ============================================================

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', false,
    'phone_verified', false
  ),
  NULL,
  u.created_at,
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
)
ON CONFLICT (provider_id, provider) DO NOTHING;
