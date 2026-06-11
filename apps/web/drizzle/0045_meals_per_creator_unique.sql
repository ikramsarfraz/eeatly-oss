-- =============================================================================
-- 0045_meals_per_creator_unique.sql — meals uniqueness scoped per creator
-- =============================================================================
-- The R4 unique index on (household_id, normalized_name) predates R32's
-- per-item privacy model. Once recipes became private-by-default
-- (own-or-granted visibility), two members each privately owning
-- "chicken biryani" in the same kitchen is legitimate product state — but
-- the household-wide constraint made it impossible:
--
--   * joining a household with a same-named meal hard-blocked the accept
--     (MEAL_NAME_COLLISION), pushing users to delete their own recipes
--     just to get through the door;
--   * the log-time upsert attached logs (and recipe-field updates!) to
--     ANOTHER member's private row purely because the names matched.
--
-- New scope: (household_id, created_by_user_id, normalized_name). Each
-- member keeps one row per dish name; different members can hold their own
-- copies side by side; ownership and visibility never transfer on join.
--
-- NULL creators (created_by_user_id is SET NULL when a member deletes
-- their account) are treated as distinct by Postgres, so former-member
-- rows can theoretically share a name. Acceptable: new inserts always
-- carry a creator, and those rows are read-only legacy attribution.
--
-- The plain lookup index replaces the unique one for the name-scoped
-- queries (log upsert, join duplicate detection) that previously rode it.
--
-- Rollback (only safe while no household has per-member duplicates):
--   DROP INDEX "meals_household_normalized_name_lookup_idx";
--   DROP INDEX "meals_household_creator_normalized_name_idx";
--   CREATE UNIQUE INDEX "meals_household_normalized_name_idx"
--     ON "meals" ("household_id", "normalized_name");
-- =============================================================================

DROP INDEX "meals_household_normalized_name_idx";
--> statement-breakpoint

CREATE UNIQUE INDEX "meals_household_creator_normalized_name_idx"
  ON "meals" ("household_id", "created_by_user_id", "normalized_name");
--> statement-breakpoint

CREATE INDEX "meals_household_normalized_name_lookup_idx"
  ON "meals" ("household_id", "normalized_name");
