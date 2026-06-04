-- =============================================================================
-- 0036_drop_meal_shared_at.sql — remove the vestigial meals.shared_at flag
-- =============================================================================
-- Sharing is fully per-item now (item_grants). The legacy `shared_at` flag and
-- its visibility clause were removed in the role/visibility work; nothing reads
-- or writes the column anymore. Drop it and its covering index.
--
-- Irreversible: the column held no information the grant model needs (the 0030
-- backfill already converted every shared meal into explicit grants).
--
-- Rollback: ALTER TABLE "meals" ADD COLUMN "shared_at" timestamptz;
--           CREATE INDEX "meals_household_shared_at_idx"
--             ON "meals" ("household_id","shared_at");
-- =============================================================================

DROP INDEX IF EXISTS "meals_household_shared_at_idx";
ALTER TABLE "meals" DROP COLUMN IF EXISTS "shared_at";
