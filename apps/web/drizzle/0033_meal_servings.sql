-- =============================================================================
-- 0033_meal_servings.sql — free-form yield/servings on a recipe
-- =============================================================================
-- A single free-form column carrying the recipe's yield, e.g. "Serves 4",
-- "Makes 8 sliders", "Feeds 6". String (not a number) so it can hold the unit
-- naturally. AI-filled on capture/refine; editable via Refine.
--
-- Rollback: ALTER TABLE "meals" DROP COLUMN IF EXISTS "servings";
-- =============================================================================

ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "servings" text;
