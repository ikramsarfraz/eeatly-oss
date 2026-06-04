-- =============================================================================
-- 0026_structured_recipe.sql — Round 18 Refine: structured ingredients + steps
-- =============================================================================
-- Adds two new tables that sit alongside the existing legacy storage:
--
--   meals.ingredients (text[])      — R10 free-form per-line strings (kept)
--   meals.recipe_text (text)        — original prose blob (kept)
--   ↓
--   meal_ingredients (row per item) — NEW: structured with prep_note + qty
--   recipe_steps (row per step)     — NEW: structured with title + time + body
--
-- Purely additive. Legacy fields stay populated for every meal that
-- predates Refine; the new tables only fill in when the Refine save
-- path (or a future manual edit form) writes structured data.
--
-- The reader contract for R19+ mobile UI:
--   1. If `meal_ingredients` has rows for this meal → render structured.
--   2. Else fall back to `meals.ingredients` (legacy array).
--   3. Likewise for steps vs `meals.recipe_text`.
--
-- No backfill in this migration. Old recipes continue to work read-only;
-- Refine itself becomes the migration path (the AI proposes structured
-- replacements, the user accepts, the save populates the new tables).
--
-- Rollback:
--   DROP TABLE "recipe_steps";
--   DROP TABLE "meal_ingredients";
-- =============================================================================

CREATE TABLE "meal_ingredients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meal_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "name" text NOT NULL,
  -- Free-form display string ("400 g", "½ tsp", "1 large"). Not parsed
  -- into numeric+unit columns; matches the R10 stance on `meals.ingredients`.
  "quantity_string" text NOT NULL DEFAULT '',
  -- Optional prep note ("julienned", "boneless, sliced"). Italic-rendered.
  "prep_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "meal_ingredients" ADD CONSTRAINT "meal_ingredients_meal_id_meals_id_fk"
  FOREIGN KEY ("meal_id") REFERENCES "meals"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- One ingredient row per (meal, position) — keeps the array-like
-- ordering explicit and prevents accidental dup-inserts at the same slot.
CREATE UNIQUE INDEX "meal_ingredients_meal_position_idx"
  ON "meal_ingredients" ("meal_id", "position");
--> statement-breakpoint

CREATE INDEX "meal_ingredients_meal_idx"
  ON "meal_ingredients" ("meal_id");
--> statement-breakpoint

CREATE TABLE "recipe_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meal_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "title" text NOT NULL,
  -- Free-form time string ("10 min · then 20 min rest"). Rendered as-is
  -- in mono caps on mobile. NOT summed across steps — the "~30 min" top
  -- chip is independently authored.
  "time" text,
  "body" text NOT NULL DEFAULT '',
  -- Array of `meal_ingredients.id` values used in this step. Stored as
  -- text[] rather than a junction table because steps are read in bulk
  -- with their meal and a junction join adds round-trips for no payoff
  -- (we rarely query "which steps use ingredient X").
  "ingredient_ids" text[] NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_meal_id_meals_id_fk"
  FOREIGN KEY ("meal_id") REFERENCES "meals"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE UNIQUE INDEX "recipe_steps_meal_position_idx"
  ON "recipe_steps" ("meal_id", "position");
--> statement-breakpoint

CREATE INDEX "recipe_steps_meal_idx"
  ON "recipe_steps" ("meal_id");
