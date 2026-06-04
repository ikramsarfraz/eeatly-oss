-- =============================================================================
-- 0030_sharing_model.sql — Per-item "Yours / Shared with you" sharing engine
-- =============================================================================
-- Adds the Google-Drive-style per-item, per-person sharing model on TOP of the
-- existing per-user workspace (each user's solo household stays their private
-- library). Nothing here removes households or changes existing scoping
-- columns; visibility becomes "I own it OR I hold an active grant", layered in
-- additively (see lib/meals/visibility.ts — the legacy household clause stays
-- during the UI transition, so no existing access is lost).
--
-- New tables:
--   item_grants            — live read-only grant of one item to one person
--   item_requests          — recipient asks owner to share a (locked) item
--   share_tombstones       — recipient-side record of a removed live copy
--   connections            — symmetric "sharing circle" between two users
--   connection_invitations — email invite to join a sharing circle
--
-- Backfill (per the chosen migration path — preserve existing access):
--   1. Give every meal/plan a concrete owner (created_by_user_id), filling
--      nulls with the household owner.
--   2. For multi-member households, convert currently-visible items into
--      explicit grants to each co-member: shared meals (shared_at set) and all
--      non-archived plans (old model showed every plan to the whole household).
--   3. Connect co-members to each other (sharing circle).
--
-- Rollback:
--   DROP TABLE IF EXISTS "connection_invitations","connections",
--     "share_tombstones","item_requests","item_grants";
--   (the created_by_user_id backfill is left in place — it's harmless.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "item_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_type" text NOT NULL,
  "item_id" uuid NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "grantee_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "saved_copy_item_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "item_grants_item_grantee_idx"
  ON "item_grants" ("item_type","item_id","grantee_user_id");
CREATE INDEX IF NOT EXISTS "item_grants_grantee_idx"
  ON "item_grants" ("grantee_user_id","revoked_at");
CREATE INDEX IF NOT EXISTS "item_grants_item_idx"
  ON "item_grants" ("item_type","item_id","revoked_at");

CREATE TABLE IF NOT EXISTS "item_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_type" text NOT NULL,
  "item_id" uuid NOT NULL,
  "requester_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "owner_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "item_requests_pending_idx"
  ON "item_requests" ("item_type","item_id","requester_user_id")
  WHERE "status" = 'pending';
CREATE INDEX IF NOT EXISTS "item_requests_owner_idx"
  ON "item_requests" ("owner_user_id","status");

CREATE TABLE IF NOT EXISTS "share_tombstones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "grantee_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "item_type" text NOT NULL,
  "item_name" text NOT NULL,
  "owner_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "owner_name" text,
  "kind" text NOT NULL,
  "saved_copy_item_id" uuid,
  "dismissed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "share_tombstones_grantee_idx"
  ON "share_tombstones" ("grantee_user_id","dismissed_at","created_at");

CREATE TABLE IF NOT EXISTS "connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_low_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "user_high_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "connections_pair_idx"
  ON "connections" ("user_low_id","user_high_id");
CREATE INDEX IF NOT EXISTS "connections_low_idx" ON "connections" ("user_low_id");
CREATE INDEX IF NOT EXISTS "connections_high_idx" ON "connections" ("user_high_id");

CREATE TABLE IF NOT EXISTS "connection_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inviter_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "connection_invitations_token_idx"
  ON "connection_invitations" ("token");
CREATE INDEX IF NOT EXISTS "connection_invitations_inviter_idx"
  ON "connection_invitations" ("inviter_user_id","status");

-- ---------------------------------------------------------------------------
-- Backfill 1: every item gets a concrete owner. created_by_user_id is nullable
-- (ON DELETE SET NULL); fill any nulls with the household owner so ownership is
-- always resolvable under the new model.
-- ---------------------------------------------------------------------------
UPDATE "meals" m
  SET "created_by_user_id" = h."owner_id"
  FROM "households" h
  WHERE h."id" = m."household_id" AND m."created_by_user_id" IS NULL;

UPDATE "plans" p
  SET "created_by_user_id" = h."owner_id"
  FROM "households" h
  WHERE h."id" = p."household_id" AND p."created_by_user_id" IS NULL;

-- ---------------------------------------------------------------------------
-- Backfill 2: convert currently-visible items in multi-member households into
-- explicit per-person grants to each co-member (everyone but the owner).
--   - recipes: only those marked shared (shared_at IS NOT NULL), non-archived.
--   - plans:   all non-archived (old model showed every plan household-wide).
-- ---------------------------------------------------------------------------
INSERT INTO "item_grants" ("item_type","item_id","owner_user_id","grantee_user_id")
SELECT 'recipe', m."id", m."created_by_user_id", hm."user_id"
FROM "meals" m
JOIN "household_members" hm ON hm."household_id" = m."household_id"
WHERE m."shared_at" IS NOT NULL
  AND m."archived_at" IS NULL
  AND m."created_by_user_id" IS NOT NULL
  AND hm."user_id" <> m."created_by_user_id"
ON CONFLICT ("item_type","item_id","grantee_user_id") DO NOTHING;

INSERT INTO "item_grants" ("item_type","item_id","owner_user_id","grantee_user_id")
SELECT 'plan', p."id", p."created_by_user_id", hm."user_id"
FROM "plans" p
JOIN "household_members" hm ON hm."household_id" = p."household_id"
WHERE p."archived_at" IS NULL
  AND p."created_by_user_id" IS NOT NULL
  AND hm."user_id" <> p."created_by_user_id"
ON CONFLICT ("item_type","item_id","grantee_user_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill 3: connect co-members to each other (the sharing circle). Canonical
-- pair ordering (low < high) keeps it unique regardless of direction.
-- ---------------------------------------------------------------------------
INSERT INTO "connections" ("user_low_id","user_high_id")
SELECT DISTINCT LEAST(a."user_id", b."user_id"), GREATEST(a."user_id", b."user_id")
FROM "household_members" a
JOIN "household_members" b
  ON b."household_id" = a."household_id" AND a."user_id" < b."user_id"
ON CONFLICT ("user_low_id","user_high_id") DO NOTHING;
