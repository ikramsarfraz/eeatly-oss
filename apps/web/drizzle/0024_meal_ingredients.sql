-- =============================================================================
-- 0024_meal_ingredients.sql — Round 10 structured ingredients
-- =============================================================================
-- Adds `ingredients` to `meals` as a free-text Postgres array. Each element
-- is one ingredient line as the AI extracted it ("1 cup basmati rice"). We
-- explicitly do NOT parse into {name, quantity, unit} columns — matching
-- against pantry state / normalization is a separate, much larger feature.
--
-- Purely additive — no existing rows touched. Legacy meals stay NULL until
-- they're re-extracted via the on-demand action (Round 10 Task 5).
--
-- No index — v1 never queries by ingredient. Add a GIN index if/when a
-- search-by-ingredient feature lands.
--
-- Rollback: ALTER TABLE "meals" DROP COLUMN "ingredients";
-- =============================================================================

ALTER TABLE "meals" ADD COLUMN "ingredients" text[];
