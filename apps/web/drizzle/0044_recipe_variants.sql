-- =============================================================================
-- 0044_recipe_variants.sql — Recipe variants: one dish, switchable recipes
-- =============================================================================
-- Born from the household-join flow. When a joining member brings a meal
-- whose normalized name already exists in the target kitchen, the accept
-- flow no longer blocks with MEAL_NAME_COLLISION. Instead it keeps ONE
-- dish entry (the incumbent `meals` row) and attaches the joiner's recipe
-- as a variant:
--
--   recipe_variants                 — NEW: per-meal alternate recipes.
--                                     Snapshots the source meal's
--                                     recipe-bearing columns (legacy blob,
--                                     ingredients array, source URL,
--                                     servings, photo, notes).
--   meal_ingredients.variant_id     — NEW: NULL = base recipe rows (all
--   recipe_steps.variant_id           existing data); set = rows that
--                                     belong to a variant.
--
-- The base recipe is NOT mirrored into recipe_variants — it stays on the
-- meals row + structured rows with variant_id IS NULL, so every existing
-- read path is untouched. A meal with no variants has no variant rows.
--
-- Index surgery: the (meal_id, position) unique indexes from 0026 assumed
-- one recipe per meal. Position uniqueness is now per-recipe, i.e. per
-- (meal, variant). Postgres treats NULLs as distinct inside a composite
-- unique index, so the nullable variant_id needs a partial-index pair
-- instead of one three-column index.
--
-- Rollback:
--   DROP INDEX "meal_ingredients_variant_position_idx";
--   DROP INDEX "recipe_steps_variant_position_idx";
--   DROP INDEX "meal_ingredients_meal_position_idx";
--   DROP INDEX "recipe_steps_meal_position_idx";
--   CREATE UNIQUE INDEX "meal_ingredients_meal_position_idx"
--     ON "meal_ingredients" ("meal_id", "position");
--   CREATE UNIQUE INDEX "recipe_steps_meal_position_idx"
--     ON "recipe_steps" ("meal_id", "position");
--   ALTER TABLE "meal_ingredients" DROP COLUMN "variant_id";
--   ALTER TABLE "recipe_steps" DROP COLUMN "variant_id";
--   DROP TABLE "recipe_variants";
--   (rollback of the index recreation assumes no variant rows exist yet)
-- =============================================================================

CREATE TABLE "recipe_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meal_id" uuid NOT NULL,
  -- Shown on the recipe-view switcher, e.g. "Ayesha's recipe".
  "label" text NOT NULL,
  -- Same nullable-text shape as meals.created_by_user_id: SET NULL so a
  -- member leaving doesn't take their recipe variant with them.
  "created_by_user_id" text,
  -- Snapshot of the source meal's recipe-bearing columns at merge time.
  "recipe_text" text,
  "ingredients" text[],
  "recipe_source_url" text,
  "servings" text,
  "photo_url" text,
  "notes" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "recipe_variants" ADD CONSTRAINT "recipe_variants_meal_id_meals_id_fk"
  FOREIGN KEY ("meal_id") REFERENCES "meals"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "recipe_variants" ADD CONSTRAINT "recipe_variants_created_by_user_id_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "recipe_variants_meal_idx"
  ON "recipe_variants" ("meal_id");
--> statement-breakpoint

ALTER TABLE "meal_ingredients" ADD COLUMN "variant_id" uuid;
--> statement-breakpoint

ALTER TABLE "meal_ingredients" ADD CONSTRAINT "meal_ingredients_variant_id_recipe_variants_id_fk"
  FOREIGN KEY ("variant_id") REFERENCES "recipe_variants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "recipe_steps" ADD COLUMN "variant_id" uuid;
--> statement-breakpoint

ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_variant_id_recipe_variants_id_fk"
  FOREIGN KEY ("variant_id") REFERENCES "recipe_variants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

DROP INDEX "meal_ingredients_meal_position_idx";
--> statement-breakpoint

CREATE UNIQUE INDEX "meal_ingredients_meal_position_idx"
  ON "meal_ingredients" ("meal_id", "position")
  WHERE "variant_id" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "meal_ingredients_variant_position_idx"
  ON "meal_ingredients" ("variant_id", "position")
  WHERE "variant_id" IS NOT NULL;
--> statement-breakpoint

DROP INDEX "recipe_steps_meal_position_idx";
--> statement-breakpoint

CREATE UNIQUE INDEX "recipe_steps_meal_position_idx"
  ON "recipe_steps" ("meal_id", "position")
  WHERE "variant_id" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "recipe_steps_variant_position_idx"
  ON "recipe_steps" ("variant_id", "position")
  WHERE "variant_id" IS NOT NULL;
