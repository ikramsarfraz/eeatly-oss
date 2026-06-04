-- =============================================================================
-- 0019_plans.sql — Round 5: Plans (occasions) + per-dish annotations
-- =============================================================================
-- Two new tables (`plans`, `plan_dishes`) and one new enum (`plan_dish_verdict`).
-- Purely additive: no existing data touched, no backfill required.
--
-- Clone-from-past is the killer flow this schema supports: a new plan
-- references the same meals as the source plan via plan_dishes.meal_id, but
-- the new plan_dishes rows have NULL annotation fields (verdict, actual
-- effort, etc.). The clone helper in services/plans.ts surfaces the
-- previous plan's annotations as advisory hints in the UI without
-- persisting them on the new plan.
--
-- All user-id FKs use ON DELETE SET NULL to match the Round 4.5 / 4.7 / 5
-- attribution contract: plans / plan_dishes survive a user's account
-- deletion with their attribution dropped to "Former member" in the UI.
-- Household + meal FKs cascade — destroying a household or a meal takes
-- its plan_dishes with it (no orphans).
--
-- Rollback (rarely):
--   DROP TABLE "plan_dishes";
--   DROP TABLE "plans";
--   DROP TYPE "plan_dish_verdict";
-- =============================================================================

CREATE TYPE "plan_dish_verdict" AS ENUM ('repeat', 'modify', 'do_not_repeat');
--> statement-breakpoint

CREATE TABLE "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL,
  "created_by_user_id" text,
  "name" text NOT NULL,
  "scheduled_date" date NOT NULL,
  "notes" text,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "plans" ADD CONSTRAINT "plans_household_id_households_id_fk"
  FOREIGN KEY ("household_id") REFERENCES "households"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_user_id_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "plans_household_scheduled_date_idx"
  ON "plans" USING btree ("household_id", "scheduled_date");
--> statement-breakpoint

CREATE INDEX "plans_household_archived_at_idx"
  ON "plans" USING btree ("household_id", "archived_at");
--> statement-breakpoint

CREATE TABLE "plan_dishes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL,
  "meal_id" uuid NOT NULL,
  "added_by_user_id" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "actual_effort" "effort_level",
  "time_taken_minutes" integer,
  "verdict" "plan_dish_verdict",
  "annotation_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "plan_dishes" ADD CONSTRAINT "plan_dishes_plan_id_plans_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "plan_dishes" ADD CONSTRAINT "plan_dishes_meal_id_meals_id_fk"
  FOREIGN KEY ("meal_id") REFERENCES "meals"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "plan_dishes" ADD CONSTRAINT "plan_dishes_added_by_user_id_user_id_fk"
  FOREIGN KEY ("added_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "plan_dishes_plan_sort_order_idx"
  ON "plan_dishes" USING btree ("plan_id", "sort_order");
--> statement-breakpoint

CREATE UNIQUE INDEX "plan_dishes_plan_meal_unique_idx"
  ON "plan_dishes" USING btree ("plan_id", "meal_id");
