import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { meals } from "./meals";

/**
 * Round 18 — structured ingredient + step storage.
 *
 * These tables sit alongside (not in place of) the legacy
 * `meals.ingredients` text[] (R10) and `meals.recipe_text` blob. Writes
 * from the Refine save path populate the new tables; the read path on
 * R19 mobile UI prefers structured rows when present and falls back to
 * the legacy fields otherwise. Migration of existing meals is opt-in
 * via the Refine flow itself — no batch backfill in this round.
 *
 * `quantity_string` is intentionally free-form ("400 g", "½ tsp",
 * "1 large") matching the design spec's "render as-is in mono" stance.
 * Pantry-state matching is a much larger feature that would justify a
 * separate normalised qty+unit projection on top of this.
 */
export const mealIngredients = pgTable(
  "meal_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    quantityString: text("quantity_string").notNull().default(""),
    prepNote: text("prep_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    mealPositionUnique: uniqueIndex("meal_ingredients_meal_position_idx").on(
      table.mealId,
      table.position
    ),
    mealIdx: index("meal_ingredients_meal_idx").on(table.mealId)
  })
);

/**
 * Structured steps. `time` and `body` are free-form strings rendered
 * as-is (see the recipe-detail handoff). `ingredient_ids` is a
 * Postgres text[] of `meal_ingredients.id` values — denormalised on
 * purpose so a single read of a meal's steps doesn't need a junction
 * join. The Refine save path keeps this in sync; readers tolerate
 * stale ids (filter to known ingredients before render).
 */
export const recipeSteps = pgTable(
  "recipe_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    time: text("time"),
    body: text("body").notNull().default(""),
    ingredientIds: text("ingredient_ids").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    mealPositionUnique: uniqueIndex("recipe_steps_meal_position_idx").on(
      table.mealId,
      table.position
    ),
    mealIdx: index("recipe_steps_meal_idx").on(table.mealId)
  })
);

export const mealIngredientsRelations = relations(
  mealIngredients,
  ({ one }) => ({
    meal: one(meals, {
      fields: [mealIngredients.mealId],
      references: [meals.id]
    })
  })
);

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  meal: one(meals, {
    fields: [recipeSteps.mealId],
    references: [meals.id]
  })
}));
