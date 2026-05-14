import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { households } from "./households";
import { users } from "./auth";

export const effortLevelEnum = pgEnum("effort_level", [
  "quick",
  "easy",
  "medium",
  "high_effort"
]);

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Round 4 households: meals scope to a household, not a single user.
    // TS shape reflects the POST-0016 schema. If this code is deployed
    // before all three round-4 migrations have run, inserts will reject
    // (the live DB still has user_id NOT NULL with no default).
    // APPLY 0014 + 0015 + 0016 BEFORE DEPLOYING this code.
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // Attribution: who first added this recipe to the household. Set on
    // insert only; never overwritten when other members cook the meal.
    // ON DELETE SET NULL so removing a member doesn't cascade-delete
    // recipes other members still want. POST-0018: nullable in DB too —
    // 0016 had tightened it to NOT NULL which contradicted the SET NULL
    // FK and silently broke account deletion. UI renders "Former member"
    // via lib/meals/attribution.ts when this is null.
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    recipeText: text("recipe_text"),
    recipeSourceUrl: text("recipe_source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => ({
    // Round 4: unique scope moved to (householdId, normalizedName). Two
    // members in the same household can't add the same recipe twice;
    // two households can both have "Soy ginger noodles" with no conflict.
    householdMealIdx: uniqueIndex("meals_household_normalized_name_idx").on(
      table.householdId,
      table.normalizedName
    ),
    householdUpdatedAtIdx: index("meals_household_updated_at_idx").on(
      table.householdId,
      table.updatedAt
    ),
    householdArchivedAtIdx: index("meals_household_archived_at_idx").on(
      table.householdId,
      table.archivedAt
    )
  })
);

export const mealLogs = pgTable(
  "meal_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    // Round 4 households: logs scope to a household + carry attribution
    // for who actually cooked the meal. cookedByUserId is renamed from
    // user_id in migration 0014 (preserves existing data + indexes).
    // POST-0016 state: NOT NULL.
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // POST-0017 state: nullable + ON DELETE SET NULL. The original CASCADE
    // silently wiped a former member's logs across every household they ever
    // joined when they deleted their account. SET NULL preserves the log
    // (history stays in the household) but nulls the attribution — UI
    // renders "Former member" in that case. APPLY 0017 BEFORE deploying
    // this schema.
    cookedByUserId: text("cooked_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    effortLevel: effortLevelEnum("effort_level").notNull(),
    notes: text("notes"),
    cookedAt: date("cooked_at").notNull(),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    // Index names retain the pre-rename "user" stem — Postgres index names
    // are independent of column references, so renaming is hygiene-only
    // and intentionally deferred.
    userCookedAtIdx: index("meal_logs_user_cooked_at_idx").on(
      table.cookedByUserId,
      table.cookedAt
    ),
    userMealCookedAtIdx: index("meal_logs_user_meal_cooked_at_idx").on(
      table.cookedByUserId,
      table.mealId,
      table.cookedAt
    ),
    userEffortIdx: index("meal_logs_user_effort_idx").on(
      table.cookedByUserId,
      table.effortLevel
    ),
    mealCookedAtIdx: index("meal_logs_meal_cooked_at_idx").on(
      table.mealId,
      table.cookedAt
    )
  })
);

export const mealRelations = relations(meals, ({ many, one }) => ({
  creator: one(users, {
    fields: [meals.createdByUserId],
    references: [users.id]
  }),
  household: one(households, {
    fields: [meals.householdId],
    references: [households.id]
  }),
  logs: many(mealLogs)
}));

export const mealLogRelations = relations(mealLogs, ({ one }) => ({
  meal: one(meals, {
    fields: [mealLogs.mealId],
    references: [meals.id]
  }),
  cookedBy: one(users, {
    fields: [mealLogs.cookedByUserId],
    references: [users.id]
  }),
  household: one(households, {
    fields: [mealLogs.householdId],
    references: [households.id]
  })
}));
