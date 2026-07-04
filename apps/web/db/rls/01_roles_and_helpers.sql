-- =============================================================================
-- RLS phase 1 — restricted role + helper functions
-- =============================================================================
-- Run as the TABLE OWNER (the DATABASE_URL connection). Establishes the
-- non-owner role the app connects as (DATABASE_URL_APP) and the two helper
-- functions every policy keys on. Nothing here enables RLS yet (phases 2-4 do),
-- so applying this file alone changes no behavior.
--
-- See db/rls/README.md for the full apply order + the operator runbook.
-- =============================================================================

-- 1. Restricted role -----------------------------------------------------------
-- Create ONCE, out of band, with a password from your secrets manager:
--
--   CREATE ROLE eeatly_app LOGIN PASSWORD '<from-secrets>';
--
-- It MUST NOT own the tables and MUST NOT have BYPASSRLS — otherwise RLS is
-- silently skipped. Then point DATABASE_URL_APP at it (same host/db, this role).

GRANT USAGE ON SCHEMA public TO eeatly_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eeatly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eeatly_app;

-- Future tables/sequences created by the owner stay reachable by the app role
-- without re-granting after every migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eeatly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO eeatly_app;

-- 2. Identity helper -----------------------------------------------------------
-- The current request's user id, set by withRlsContext() via
--   select set_config('app.current_user_id', <userId>, true)
-- The second arg to current_setting() is `missing_ok` = true, so an unset GUC
-- yields NULL → coalesced to '' → matches no row (fail-closed) rather than
-- erroring. Returns text because users.id (and every *_user_id column) is text.
CREATE OR REPLACE FUNCTION app_current_user() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT coalesce(current_setting('app.current_user_id', true), '')
$$;

-- 3. Household-membership helper ----------------------------------------------
-- The set of household ids the current user belongs to. SECURITY DEFINER so it
-- executes as the function owner (the table owner, which bypasses RLS) — this
-- is what prevents infinite recursion: the meals/plans policies call this
-- function, and without DEFINER the read of household_members would re-invoke
-- household_members' own policy, which could call this function again.
--
-- `search_path` is pinned so a malicious search_path can't shadow the table.
CREATE OR REPLACE FUNCTION app_user_households() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = app_current_user()
$$;

GRANT EXECUTE ON FUNCTION app_current_user() TO eeatly_app;
GRANT EXECUTE ON FUNCTION app_user_households() TO eeatly_app;
