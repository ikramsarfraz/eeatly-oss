-- Round 4: household model — constraint tightening. *** RISKY ***
--
-- This is the migration to take a Neon branch for before applying to
-- production. Three categories of change, each more dangerous than the
-- last:
--
--   1. NOT NULL adds. Safe IFF 0015 backfill ran completely. If any row
--      slipped through (e.g. user created between 0014 and 0015), these
--      will fail and the whole migration rolls back inside its
--      transaction. Re-run 0015 first, then this.
--
--   2. DROP COLUMN meals.user_id. Irreversible without a backup. The
--      service layer must already be scoping all queries by household_id
--      (Task 2) — if any read path still uses meals.user_id, it breaks
--      at deploy. Verify by grepping `meals.user_id` and `meals.userId`
--      in the codebase BEFORE running this.
--
--   3. UNIQUE INDEX swap on meals: drop (user_id, normalized_name),
--      add (household_id, normalized_name). This is the single most
--      sensitive change. The new constraint allows distinct users in
--      the SAME household to no longer have collision-free unique
--      meal names — uniqueness moves to the household scope, which is
--      the round-4 design intent. If two members add a meal with the
--      same name (after backfill, before they're in the same household),
--      this index creation fails on a duplicate.
--
--      The backfill in 0015 makes each existing user the sole member of
--      their own household, so (household_id, normalized_name) is
--      guaranteed unique at backfill time. The risk surfaces when
--      household membership changes (acceptInvitationAction in Task 4
--      pulls a user's meals into another household). The application
--      logic in that action must handle name collisions explicitly.
--      That's a Task 4 concern; 0016 itself is safe on the current data.
--
-- Rollback plan (RUN IN A TRANSACTION):
--   DROP INDEX "meals_household_normalized_name_idx";
--   ALTER TABLE "meals" ADD COLUMN "user_id" text;
--   UPDATE "meals" SET "user_id" = "created_by_user_id"
--     WHERE "user_id" IS NULL;  -- best-effort, may not match original
--   ALTER TABLE "meals" ALTER COLUMN "user_id" SET NOT NULL;
--   ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_fk"
--     FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--   CREATE UNIQUE INDEX "meals_user_normalized_name_idx"
--     ON "meals" ("user_id", "normalized_name");
--   ALTER TABLE "meals" ALTER COLUMN "household_id" DROP NOT NULL;
--   ALTER TABLE "meals" ALTER COLUMN "created_by_user_id" DROP NOT NULL;
--   ALTER TABLE "meal_logs" ALTER COLUMN "household_id" DROP NOT NULL;
--
--   NOTE: rolling back meals.user_id loses the original ownership for any
--   meal whose creator left the household after 0016 ran. Take a Neon
--   branch BEFORE applying this migration and roll back to it if
--   anything goes wrong — that's the only true rollback path.

-- 1. NOT NULL: household_id on meals + meal_logs.
ALTER TABLE "meals" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "meal_logs" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint

-- 2. The unique-index swap. Drop the old user-scoped unique BEFORE adding
-- the household-scoped one — Postgres allows both to exist briefly but
-- holding both means any insert through the transition pays two index
-- updates and any conflict surfaces as an opaque constraint name.
DROP INDEX "meals_user_normalized_name_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "meals_household_normalized_name_idx"
    ON "meals" ("household_id", "normalized_name");
--> statement-breakpoint

-- 3. Optional hygiene: swap the secondary user-scoped indexes for
-- household-scoped equivalents. Existing app reads will use household_id
-- after Task 2's service refactor.
DROP INDEX "meals_user_updated_at_idx";
--> statement-breakpoint
DROP INDEX "meals_user_archived_at_idx";
--> statement-breakpoint
CREATE INDEX "meals_household_updated_at_idx"
    ON "meals" ("household_id", "updated_at");
--> statement-breakpoint
CREATE INDEX "meals_household_archived_at_idx"
    ON "meals" ("household_id", "archived_at");
--> statement-breakpoint

-- 4. Finally, drop the now-redundant meals.user_id. Once this lands,
-- there is no way to reconstruct original ownership for meals whose
-- creator's user row was deleted via the SET NULL cascade on
-- created_by_user_id. Take the Neon branch first.
ALTER TABLE "meals" DROP COLUMN "user_id";
