import { relations, sql } from "drizzle-orm";
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
import { users } from "./auth";

/**
 * Recipe variants — alternate recipes for the same dish.
 *
 * Born from the household-join flow: when a joining member brings a meal
 * whose name already exists in the target kitchen, we keep ONE dish entry
 * (the incumbent meal row) and attach the joiner's recipe as a variant the
 * household can switch to on the recipe view. Nothing is renamed, merged,
 * or dropped: the variant snapshots the source meal's recipe-bearing
 * columns, and its structured rows move over carrying `variant_id`.
 *
 * The base recipe is NOT mirrored here — it stays on the meals row +
 * structured rows with `variant_id IS NULL`. A meal with no variants has
 * no rows in this table.
 */
export const recipeVariants = pgTable(
  "recipe_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    /** Shown on the switcher, e.g. "Ayesha's recipe". */
    label: text("label").notNull(),
    // Same nullable-text shape as meals.created_by_user_id: SET NULL so a
    // member leaving doesn't take their recipe variant with them.
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    // Snapshot of the source meal's recipe-bearing columns at merge time.
    recipeText: text("recipe_text"),
    ingredients: text("ingredients").array(),
    recipeSourceUrl: text("recipe_source_url"),
    servings: text("servings"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    mealIdx: index("recipe_variants_meal_idx").on(table.mealId)
  })
);

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
    // NULL = the meal's base recipe; set = rows belonging to a variant.
    // CASCADE: deleting a variant takes its structured rows with it.
    variantId: uuid("variant_id").references(() => recipeVariants.id, {
      onDelete: "cascade"
    }),
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
    // Positions are unique within a recipe — i.e. per (meal, variant).
    // Split into two partial indexes because variant_id is nullable and
    // Postgres treats NULLs as distinct in a plain composite unique index.
    basePositionUnique: uniqueIndex("meal_ingredients_meal_position_idx")
      .on(table.mealId, table.position)
      .where(sql`${table.variantId} IS NULL`),
    variantPositionUnique: uniqueIndex(
      "meal_ingredients_variant_position_idx"
    )
      .on(table.variantId, table.position)
      .where(sql`${table.variantId} IS NOT NULL`),
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
    // NULL = base recipe; set = steps belonging to a variant (see
    // meal_ingredients.variant_id).
    variantId: uuid("variant_id").references(() => recipeVariants.id, {
      onDelete: "cascade"
    }),
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
    basePositionUnique: uniqueIndex("recipe_steps_meal_position_idx")
      .on(table.mealId, table.position)
      .where(sql`${table.variantId} IS NULL`),
    variantPositionUnique: uniqueIndex("recipe_steps_variant_position_idx")
      .on(table.variantId, table.position)
      .where(sql`${table.variantId} IS NOT NULL`),
    mealIdx: index("recipe_steps_meal_idx").on(table.mealId)
  })
);

export const mealIngredientsRelations = relations(
  mealIngredients,
  ({ one }) => ({
    meal: one(meals, {
      fields: [mealIngredients.mealId],
      references: [meals.id]
    }),
    variant: one(recipeVariants, {
      fields: [mealIngredients.variantId],
      references: [recipeVariants.id]
    })
  })
);

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  meal: one(meals, {
    fields: [recipeSteps.mealId],
    references: [meals.id]
  }),
  variant: one(recipeVariants, {
    fields: [recipeSteps.variantId],
    references: [recipeVariants.id]
  })
}));

export const recipeVariantsRelations = relations(recipeVariants, ({ one }) => ({
  meal: one(meals, {
    fields: [recipeVariants.mealId],
    references: [meals.id]
  })
}));
