import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { households } from "./households";
import { meals } from "./meals";
import { plans } from "./plans";
import { users } from "./auth";

/**
 * Round 7 — public share links for recipes.
 *
 * The token IS the access control. Anyone with the URL can read the
 * underlying recipe; the only "auth" is knowing the unguessable token
 * (32 bytes of randomness, base64url-encoded → 43 chars). Compare to
 * household_invitations, which also use bearer tokens — same threat
 * model.
 *
 * The view reflects current recipe state (no snapshot for v1). If the
 * owner edits the recipe, the public page updates too. That's the
 * desired behavior; if it ever bites, snapshot on `created_at` becomes
 * a column-level change.
 *
 * `revoked_at` is the soft-delete signal. The public lookup filters on
 * `revoked_at IS NULL`; revoking is reversible at the SQL level if a
 * user un-revokes by accident (no UI for that today).
 */
export const recipeShares = pgTable(
  "recipe_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    // Denormalized for fast authorization on revoke / list. A meal is
    // already scoped to a household via meals.household_id, but pulling
    // both inline saves a join in the resolver-hot path.
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    // SET NULL on user delete so a creator deleting their account doesn't
    // take the public link offline for everyone else in the household.
    // Matches the Round 4.5 / 4.7 attribution contract.
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    // Public lookup path: WHERE token = ? AND revoked_at IS NULL. The
    // unique on token is the lookup index; revoked_at is checked in
    // application code after the row resolves.
    tokenIdx: uniqueIndex("recipe_shares_token_idx").on(table.token),
    // Listing query for a household / meal — used by the share UI to
    // surface the existing link instead of generating a new one.
    householdMealIdx: index("recipe_shares_household_meal_idx").on(
      table.householdId,
      table.mealId
    ),
    // "Is this meal currently shared?" — composite index supports the
    // revocation-aware filter cheaply.
    mealRevokedAtIdx: index("recipe_shares_meal_revoked_at_idx").on(
      table.mealId,
      table.revokedAt
    )
  })
);

export type RecipeShare = typeof recipeShares.$inferSelect;
export type NewRecipeShare = typeof recipeShares.$inferInsert;

/**
 * Public "anyone with the link" share of a PLAN (R-sharing model). Mirrors
 * recipeShares: token is the access, soft-revoked via revoked_at. Sharing a
 * plan link exposes the plan's structure + dish names read-only — NOT the
 * underlying recipes (those need their own recipe links).
 */
export const planShares = pgTable(
  "plan_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenIdx: uniqueIndex("plan_shares_token_idx").on(table.token),
    householdPlanIdx: index("plan_shares_household_plan_idx").on(
      table.householdId,
      table.planId
    ),
    planRevokedAtIdx: index("plan_shares_plan_revoked_at_idx").on(
      table.planId,
      table.revokedAt
    )
  })
);

export type PlanShare = typeof planShares.$inferSelect;
export type NewPlanShare = typeof planShares.$inferInsert;
