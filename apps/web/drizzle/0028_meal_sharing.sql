-- =============================================================================
-- 0028_meal_sharing.sql — Round 32: shared-by-default meal visibility
-- =============================================================================
-- Adds a single `shared_at` column to `meals` that controls cross-member
-- visibility within a household:
--
--   shared_at IS NULL      → personal. Only the creator can see the meal.
--   shared_at IS NOT NULL  → shared. Every household member can see it.
--
-- The timestamp value also doubles as "when did this become shared,"
-- surfaced in the UI as a `Shared {timeAgo}` chip on Recipe Detail.
--
-- The canonical visibility predicate lives at
-- `apps/web/lib/meals/visibility.ts` (both as a SQL builder helper for
-- server-side queries and as a pure-function for client-side filtering)
-- and every meal-reading procedure applies it:
--
--   creator_user_id = :userId
--     OR (shared_at IS NOT NULL AND household_id = :householdId)
--
-- Backfill: every pre-R32 meal is marked shared. The product launched
-- with household-wide visibility, so this preserves the existing
-- behavior for every recipe already in the database. Members opt
-- specific meals back to personal via the new "Move to personal"
-- affordance on Recipe Detail.
--
-- Idempotency: the column ADD is guarded by IF NOT EXISTS so re-running
-- is a no-op. The backfill UPDATE only touches rows where shared_at is
-- still NULL — running it a second time updates zero rows because R32+
-- inserts already populate shared_at on insert.
--
-- Index: `meals_household_shared_at_idx` covers the (household_id,
-- shared_at) compound the visibility predicate's second clause filters
-- on. The existing household-scoped indexes cover the creator-only
-- clause via the foreign key already.
--
-- Rollback:
--   DROP INDEX IF EXISTS "meals_household_shared_at_idx";
--   ALTER TABLE "meals" DROP COLUMN IF EXISTS "shared_at";
-- =============================================================================

ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "shared_at" timestamp with time zone;

-- Backfill: every existing meal is shared (preserves R0..R31 behavior).
-- Touches only rows where shared_at is still NULL, so re-running this
-- migration is a no-op.
UPDATE "meals" SET "shared_at" = NOW() WHERE "shared_at" IS NULL;

-- Covering index for the visibility-predicate's "shared in this
-- household" branch. The existing meals_household_updated_at_idx
-- already covers (household_id, ...) scans, so this is purely a hot
-- path optimization once a household accumulates personal meals.
CREATE INDEX IF NOT EXISTS "meals_household_shared_at_idx"
  ON "meals" ("household_id", "shared_at");
