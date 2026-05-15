import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

/**
 * Round 6 — per-user / per-cohort feature-gate overrides. The resolver
 * consults this table BEFORE evaluating a feature's default rule:
 *
 *   1. Admin role     → always allow
 *   2. user override  → use this row's ruleOverride
 *   3. cohort override → use this row's ruleOverride
 *   4. default rule from `lib/gates/registry.ts`
 *
 * `userId` and `cohort` are mutually exclusive — enforced by a CHECK
 * constraint declared in migration 0020. Drizzle's `check()` is purely
 * advisory at the TS layer; the migration is authoritative.
 *
 * Override values map 1:1 to `lib/gates/rules.ts:GATE_RULES`. A
 * future-proof choice would be a Postgres enum, but text + check
 * constraint keeps the rule list editable without a schema migration.
 */
export const featureOverrides = pgTable(
  "feature_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    featureKey: text("feature_key").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    cohort: text("cohort"),
    ruleOverride: text("rule_override").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    // Lookup paths used by the resolver — one query per dimension.
    featureUserIdx: index("feature_overrides_feature_user_idx").on(
      table.featureKey,
      table.userId
    ),
    featureCohortIdx: index("feature_overrides_feature_cohort_idx").on(
      table.featureKey,
      table.cohort
    ),
    // Exactly one of userId / cohort must be set (the migration also
    // declares this; the Drizzle check is documentation).
    userXorCohort: check(
      "feature_overrides_user_xor_cohort",
      sql`(${table.userId} IS NULL) <> (${table.cohort} IS NULL)`
    )
  })
);

export type FeatureOverride = typeof featureOverrides.$inferSelect;
export type NewFeatureOverride = typeof featureOverrides.$inferInsert;
