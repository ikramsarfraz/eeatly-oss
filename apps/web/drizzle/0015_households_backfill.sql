-- Round 4: household model — data backfill.
--
-- Creates one household per existing user, makes them owner, and
-- back-fills `household_id` + `created_by_user_id` on meals + meal_logs
-- so 0016 can lock the columns NOT NULL safely.
--
-- Idempotent: re-running is a no-op (every step has WHERE clauses that
-- skip already-migrated rows). Safe to run multiple times in case of
-- partial failure.
--
-- This file contains no DDL and no destructive changes. Pure data movement.
--
-- Rollback:
--   The data this migration writes is what 0016 then locks in.
--   To "undo" this migration alone, you'd nullify household_id +
--   created_by_user_id on meals + meal_logs and DELETE FROM
--   household_members + DELETE FROM households. Realistically: if
--   something went wrong here, debug + re-run rather than roll back.

-- Step 1: create a household for every user who doesn't have one yet.
INSERT INTO "households" ("id", "name", "owner_id", "created_at")
SELECT
    gen_random_uuid(),
    CASE
        WHEN coalesce(u."name", '') = '' THEN 'My Kitchen'
        ELSE u."name" || E'’s Kitchen'
    END,
    u."id",
    now()
FROM "user" u
WHERE NOT EXISTS (
    SELECT 1 FROM "households" h WHERE h."owner_id" = u."id"
);
--> statement-breakpoint

-- Step 2: owner membership row for each newly-created household.
INSERT INTO "household_members" ("household_id", "user_id", "role", "joined_at")
SELECT h."id", h."owner_id", 'owner', now()
FROM "households" h
WHERE NOT EXISTS (
    SELECT 1 FROM "household_members" m
    WHERE m."household_id" = h."id" AND m."user_id" = h."owner_id"
);
--> statement-breakpoint

-- Step 3: point users.preferred_household_id at the owned household.
UPDATE "user" u
SET "preferred_household_id" = h."id"
FROM "households" h
WHERE h."owner_id" = u."id"
  AND u."preferred_household_id" IS NULL;
--> statement-breakpoint

-- Step 4: backfill meals.household_id + meals.created_by_user_id from
-- the existing user_id column. user_id is dropped in 0016.
UPDATE "meals" m
SET
    "household_id" = h."id",
    "created_by_user_id" = m."user_id"
FROM "households" h
WHERE h."owner_id" = m."user_id"
  AND m."household_id" IS NULL;
--> statement-breakpoint

-- Step 5: backfill meal_logs.household_id. cooked_by_user_id was already
-- populated by 0014's in-place rename of user_id → cooked_by_user_id.
UPDATE "meal_logs" ml
SET "household_id" = h."id"
FROM "households" h
WHERE h."owner_id" = ml."cooked_by_user_id"
  AND ml."household_id" IS NULL;
