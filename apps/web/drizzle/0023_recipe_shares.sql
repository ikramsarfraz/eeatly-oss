-- =============================================================================
-- 0023_recipe_shares.sql — Round 7 public recipe share links
-- =============================================================================
-- Single new table. Purely additive — no existing data touched, no
-- backfill. Creation is feature-gated (Round 6 `recipe_share_create`
-- key, `beta_or_paid` default), but viewing is open: anyone with the
-- unguessable token can read the underlying recipe. Treat tokens as
-- bearer secrets — DON'T log them unredacted.
--
-- FK behaviors mirror the round 4.5 / 4.7 attribution contract:
--   - meal CASCADE — if a meal is hard-deleted, its shares die too.
--     Soft-archived meals (meals.archivedAt) still resolve here; the
--     application layer chooses whether to surface them as 404.
--   - household CASCADE — same shape, defensive against orphaned shares
--     pointing at a household that no longer exists.
--   - createdByUserId SET NULL — a former member deleting their account
--     doesn't take their shares down; another household member can
--     still revoke. Attribution drops to NULL ("Former member" if ever
--     rendered).
--
-- Rollback: DROP TABLE "recipe_shares";
-- =============================================================================

CREATE TABLE "recipe_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meal_id" uuid NOT NULL,
  "household_id" uuid NOT NULL,
  "token" text NOT NULL,
  "created_by_user_id" text,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recipe_shares_token_unique" UNIQUE ("token")
);
--> statement-breakpoint

ALTER TABLE "recipe_shares" ADD CONSTRAINT "recipe_shares_meal_id_meals_id_fk"
  FOREIGN KEY ("meal_id") REFERENCES "meals"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "recipe_shares" ADD CONSTRAINT "recipe_shares_household_id_households_id_fk"
  FOREIGN KEY ("household_id") REFERENCES "households"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "recipe_shares" ADD CONSTRAINT "recipe_shares_created_by_user_id_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE UNIQUE INDEX "recipe_shares_token_idx"
  ON "recipe_shares" USING btree ("token");
--> statement-breakpoint

CREATE INDEX "recipe_shares_household_meal_idx"
  ON "recipe_shares" USING btree ("household_id", "meal_id");
--> statement-breakpoint

CREATE INDEX "recipe_shares_meal_revoked_at_idx"
  ON "recipe_shares" USING btree ("meal_id", "revoked_at");
