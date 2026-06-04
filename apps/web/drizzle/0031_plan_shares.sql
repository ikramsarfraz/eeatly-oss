-- =============================================================================
-- 0031_plan_shares.sql — "anyone with the link" shares for plans
-- =============================================================================
-- Mirrors recipe_shares for plans. A plan link exposes the plan's structure +
-- dish names read-only (NOT the underlying recipes). Token is the access;
-- soft-revoked via revoked_at.
--
-- Rollback:
--   DROP TABLE IF EXISTS "plan_shares";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "plan_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_shares_token_idx" ON "plan_shares" ("token");
CREATE INDEX IF NOT EXISTS "plan_shares_household_plan_idx" ON "plan_shares" ("household_id","plan_id");
CREATE INDEX IF NOT EXISTS "plan_shares_plan_revoked_at_idx" ON "plan_shares" ("plan_id","revoked_at");
