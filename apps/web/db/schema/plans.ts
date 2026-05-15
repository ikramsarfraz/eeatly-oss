import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { households } from "./households";
import { effortLevelEnum, meals } from "./meals";
import { users } from "./auth";

/**
 * Round 5: a "Plan" (DB term) / "Occasion" (UI term) is a named, dated
 * collection of dishes. Per-dish annotations capture retrospective wisdom
 * — verdict, actual effort, time taken, free-form notes. Plans support
 * cloning from past plans; annotations are intentionally NOT copied on
 * clone (they're hints, not state).
 */
export const verdictEnum = pgEnum("plan_dish_verdict", [
  "repeat",
  "modify",
  "do_not_repeat"
]);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // Attribution: who first created the plan. ON DELETE SET NULL so the
    // plan survives the creator's account deletion — household history
    // contract, same as meals.created_by_user_id post-0018.
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    name: text("name").notNull(),
    // `date` (not timestamp) — occasion dates are calendar-level, not
    // moment-in-time. Birthday lunches don't have time zones.
    scheduledDate: date("scheduled_date").notNull(),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    // Listing query: WHERE householdId = ? AND archivedAt IS NULL ORDER BY
    // scheduled_date DESC. The composite index covers both filter and sort.
    householdScheduledDateIdx: index("plans_household_scheduled_date_idx").on(
      table.householdId,
      table.scheduledDate
    ),
    // Active-vs-archived split. Cheap covering index for "show archived"
    // toggle on the list page.
    householdArchivedAtIdx: index("plans_household_archived_at_idx").on(
      table.householdId,
      table.archivedAt
    )
  })
);

export const planDishes = pgTable(
  "plan_dishes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    // Who added this dish to the plan. SET NULL on user delete — matches
    // the broader Round 4.5 / 4.7 / 5-Task-0 attribution contract.
    addedByUserId: text("added_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    sortOrder: integer("sort_order").notNull().default(0),

    // Retrospective annotation fields (all nullable; collected after the
    // event, optional). The verdict + notes drive the clone-time hint
    // badges on the next instance of the same plan.
    actualEffort: effortLevelEnum("actual_effort"),
    timeTakenMinutes: integer("time_taken_minutes"),
    verdict: verdictEnum("verdict"),
    annotationNotes: text("annotation_notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    // Render order: WHERE plan_id = ? ORDER BY sort_order ASC.
    planSortOrderIdx: index("plan_dishes_plan_sort_order_idx").on(
      table.planId,
      table.sortOrder
    ),
    // A dish appears at most once per plan. `addDishToPlan` relies on this
    // for idempotent inserts (ON CONFLICT DO NOTHING).
    planMealUniqueIdx: uniqueIndex("plan_dishes_plan_meal_unique_idx").on(
      table.planId,
      table.mealId
    )
  })
);

export const planRelations = relations(plans, ({ many, one }) => ({
  household: one(households, {
    fields: [plans.householdId],
    references: [households.id]
  }),
  creator: one(users, {
    fields: [plans.createdByUserId],
    references: [users.id]
  }),
  dishes: many(planDishes)
}));

export const planDishRelations = relations(planDishes, ({ one }) => ({
  plan: one(plans, {
    fields: [planDishes.planId],
    references: [plans.id]
  }),
  meal: one(meals, {
    fields: [planDishes.mealId],
    references: [meals.id]
  }),
  addedBy: one(users, {
    fields: [planDishes.addedByUserId],
    references: [users.id]
  })
}));

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanDish = typeof planDishes.$inferSelect;
export type NewPlanDish = typeof planDishes.$inferInsert;
export type Verdict = (typeof verdictEnum.enumValues)[number];
