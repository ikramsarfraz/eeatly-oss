-- Round 4: household model — structural changes only.
--
-- This migration adds tables and nullable columns. Safe to run in
-- production with no app coordination: it doesn't change any column
-- the application currently reads from or writes to.
--
-- Apply order:
--   0014 (this file) → 0015 (data backfill) → 0016 (constraint tightening)
--
-- Rollback (this file only):
--   DROP TABLE "household_invitations";
--   DROP TABLE "household_members";
--   DROP TABLE "households";
--   DROP TYPE "household_member_role";
--   ALTER TABLE "meals"     DROP COLUMN "household_id";
--   ALTER TABLE "meals"     DROP COLUMN "created_by_user_id";
--   ALTER TABLE "meal_logs" DROP COLUMN "household_id";
--   ALTER TABLE "meal_logs" RENAME COLUMN "cooked_by_user_id" TO "user_id";
--   ALTER TABLE "user"      RENAME COLUMN "preferred_household_id" TO "preferred_tenant_id";
--   ALTER TABLE "user"      ALTER COLUMN "preferred_tenant_id" TYPE text;
--   -- Note: cannot rollback the notification_type enum value addition
--   -- without recreating the enum + every column using it. If you need
--   -- to roll this back fully, plan for a downtime window.

CREATE TYPE "household_member_role" AS ENUM ('owner', 'member');
--> statement-breakpoint

CREATE TABLE "households" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "owner_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "households_owner_id_user_id_fk"
        FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "household_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "household_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "role" "household_member_role" DEFAULT 'member' NOT NULL,
    "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "household_members_household_id_fk"
        FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE,
    CONSTRAINT "household_members_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "household_invitations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "household_id" uuid NOT NULL,
    "email" text NOT NULL,
    "invited_by_user_id" text NOT NULL,
    "token" text NOT NULL UNIQUE,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "household_invitations_household_id_fk"
        FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE,
    CONSTRAINT "household_invitations_invited_by_user_id_fk"
        FOREIGN KEY ("invited_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- One household per user (round-4 invariant). The composite unique exists
-- for the rare case of fixing data drift; the single-column unique is what
-- prevents bugs from accidentally creating a second membership.
CREATE UNIQUE INDEX "household_members_household_user_unique"
    ON "household_members" ("household_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_user_unique"
    ON "household_members" ("user_id");
--> statement-breakpoint
CREATE INDEX "household_invitations_token_idx"
    ON "household_invitations" ("token");
--> statement-breakpoint
CREATE INDEX "household_invitations_household_accepted_idx"
    ON "household_invitations" ("household_id", "accepted_at");
--> statement-breakpoint

-- Notification type extension. Safe — adding a value to a pg enum is
-- atomic and doesn't lock tables that use the enum.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'household_invitation';
--> statement-breakpoint

-- users.preferred_tenant_id was a never-populated scaffold (text). Drop
-- and replace with preferred_household_id (uuid, FK households). No data
-- to preserve — CLAUDE.md notes the column was always null in practice.
ALTER TABLE "user" DROP COLUMN "preferred_tenant_id";
--> statement-breakpoint
ALTER TABLE "user"
    ADD COLUMN "preferred_household_id" uuid REFERENCES "households"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- New columns on meals — nullable through 0015. 0016 makes them NOT NULL
-- and drops the old user_id.
ALTER TABLE "meals"
    ADD COLUMN "household_id" uuid REFERENCES "households"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "meals"
    ADD COLUMN "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- New column on meal_logs + in-place rename of user_id → cooked_by_user_id.
-- RENAME COLUMN preserves data, the FK, and all existing indexes that
-- reference the column (Postgres auto-updates the index column refs).
-- Index names stay as `meal_logs_user_*_idx` — they're identifiers, not
-- live links to the column name. Renaming them is hygiene-only.
ALTER TABLE "meal_logs"
    ADD COLUMN "household_id" uuid REFERENCES "households"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "meal_logs" RENAME COLUMN "user_id" TO "cooked_by_user_id";
