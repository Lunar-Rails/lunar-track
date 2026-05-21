-- ============================================================
-- 00014_fix_postgrest_authenticator_grants.sql
-- Grants SELECT on public tables/functions to `authenticator`
-- so PostgREST can build its schema cache.
--
-- Supabase sets authenticator to NOINHERIT, meaning it does
-- not inherit privileges from anon/authenticated/service_role
-- during schema introspection. Without explicit grants,
-- PostgREST returns PGRST002 on every REST call.
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticator;

NOTIFY pgrst, 'reload schema';
