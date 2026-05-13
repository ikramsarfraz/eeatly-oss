-- =============================================================================
-- 0017_cooked_by_set_null.sql — preserve cooked-by attribution across user delete
-- =============================================================================
-- Round 4.5 promised that cooked-by attribution stays in the household when a
-- member is removed. The original meal_logs.user_id FK (renamed to
-- cooked_by_user_id in 0014) was `ON DELETE CASCADE` from a single-tenant era
-- when "the cook owns the log." That cascade silently wipes every meal_log a
-- former member ever cooked across every household they ever joined when they
-- later delete their account — a data-loss bug for the households they left.
--
-- This migration:
--   1. Drops NOT NULL on meal_logs.cooked_by_user_id so SET NULL can fire.
--   2. Drops the existing CASCADE foreign key.
--   3. Recreates the foreign key with ON DELETE SET NULL.
--
-- After this migration, deleting a user nulls out cooked_by_user_id on logs
-- they cooked elsewhere; the rows survive and the UI renders "Former member"
-- attribution (TS schema + recent-meal/history queries updated in the same PR).
--
-- DO NOT REVERT TO CASCADE without removing the round-4.5 attribution
-- contract. The lost data is silent — there is no recovery path once a user
-- deletes their account.
--
-- Rollback (only if absolutely necessary and you accept future data loss):
--   ALTER TABLE "meal_logs" DROP CONSTRAINT "meal_logs_user_id_user_id_fk";
--   ALTER TABLE "meal_logs" ALTER COLUMN "cooked_by_user_id" SET NOT NULL;
--   ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_user_id_fk"
--     FOREIGN KEY ("cooked_by_user_id") REFERENCES "user"("id")
--     ON DELETE CASCADE ON UPDATE NO ACTION;
-- =============================================================================

-- Step 1: allow NULLs so SET NULL has a value to set.
ALTER TABLE "meal_logs" ALTER COLUMN "cooked_by_user_id" DROP NOT NULL;
--> statement-breakpoint

-- Step 2: drop the existing CASCADE FK. Constraint name was preserved through
-- the 0014 column rename — Postgres constraint names are independent of the
-- columns they reference.
ALTER TABLE "meal_logs" DROP CONSTRAINT "meal_logs_user_id_user_id_fk";
--> statement-breakpoint

-- Step 3: add the FK back with ON DELETE SET NULL. Constraint name kept
-- identical so the schema introspection diff stays minimal and the journal
-- snapshot doesn't churn names that callers don't care about.
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_user_id_fk"
  FOREIGN KEY ("cooked_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
