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
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    userMealIdx: uniqueIndex("meals_user_normalized_name_idx").on(
      table.userId,
      table.normalizedName
    ),
    userUpdatedAtIdx: index("meals_user_updated_at_idx").on(table.userId, table.updatedAt),
    userArchivedAtIdx: index("meals_user_archived_at_idx").on(table.userId, table.archivedAt)
  })
);

export const mealLogs = pgTable(
  "meal_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    effortLevel: effortLevelEnum("effort_level").notNull(),
    notes: text("notes"),
    cookedAt: date("cooked_at").notNull(),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    userCookedAtIdx: index("meal_logs_user_cooked_at_idx").on(
      table.userId,
      table.cookedAt
    ),
    userMealCookedAtIdx: index("meal_logs_user_meal_cooked_at_idx").on(
      table.userId,
      table.mealId,
      table.cookedAt
    ),
    userEffortIdx: index("meal_logs_user_effort_idx").on(table.userId, table.effortLevel),
    mealCookedAtIdx: index("meal_logs_meal_cooked_at_idx").on(
      table.mealId,
      table.cookedAt
    )
  })
);

export const mealRelations = relations(meals, ({ many, one }) => ({
  user: one(users, {
    fields: [meals.userId],
    references: [users.id]
  }),
  logs: many(mealLogs)
}));

export const mealLogRelations = relations(mealLogs, ({ one }) => ({
  meal: one(meals, {
    fields: [mealLogs.mealId],
    references: [meals.id]
  }),
  user: one(users, {
    fields: [mealLogs.userId],
    references: [users.id]
  })
}));
