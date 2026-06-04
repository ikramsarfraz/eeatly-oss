import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { effortLevelEnum } from "./meals";
// NOTE: no runtime import of `./households` here. households.ts imports
// users from this file; reciprocating creates a circular type reference
// that TS can't resolve for inferred PgTable shapes. The FK from
// preferred_household_id → households.id is declared at the SQL layer in
// migration 0014 instead — Drizzle relations are decorative, not required.

export const userRoleEnum = pgEnum("user_role", [
  "root_app_user",
  "tenant_user",
  "platform_admin"
]);

export const betaCohortEnum = pgEnum("beta_cohort", [
  "alpha",
  "beta_wave_1",
  "beta_wave_2",
  "internal",
  // Round 6: backfill cohort for all users who existed before the paid
  // tier launched. The gate resolver treats any non-null beta cohort as
  // "unlocked" via the `beta_or_paid` default rule.
  "beta_2026"
]);

// Round 6 — subscription status mirrors Stripe's status strings exactly.
// Order in this array is non-load-bearing; the column type is text-enum
// either way. DO rename a value (drop + add) if Stripe ever does.
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "unpaid"
]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("root_app_user"),
  // Round 4 households: each user belongs to exactly one household.
  // Nullable so account creation can land before the membership row is
  // inserted (onboarding bootstraps the household, then sets this).
  // Renamed from the unused `preferred_tenant_id` scaffold. The FK to
  // households.id is declared in migration 0014 (not here, to avoid the
  // auth↔households TS circular import).
  preferredHouseholdId: uuid("preferred_household_id"),
  betaCohort: betaCohortEnum("beta_cohort"),
  // Set when the user explicitly completes the onboarding card. Authoritative
  // source for "did this user finish onboarding" — analytics events
  // (completed_onboarding) remain for funnel analysis but are fire-and-forget.
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  // Captured during multi-step onboarding. Used to tune rediscovery cadence
  // and lifecycle-email frequency. Nullable — user can complete onboarding
  // without answering these (skipped path).
  cooksPerWeek: integer("cooks_per_week"),
  weeknightEffort: effortLevelEnum("weeknight_effort"),
  // Round 6: Stripe denormalization. The full `subscriptions` row lives
  // in db/schema/subscriptions.ts; these three columns are mirrored on
  // `user` so the gate resolver doesn't join on every page render. Kept
  // in sync inside the Stripe webhook handler (one transaction).
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end", {
    withTimezone: true
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: index("session_user_id_idx").on(table.userId)
  })
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: index("account_user_id_idx").on(table.userId),
    // Better Auth enforces this uniqueness in application code, but the DB
    // should back it up — without this, an application bug could end up
    // with two `account` rows pointing at the same OAuth identity.
    providerAccountUnique: uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId
    )
  })
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier)
  })
);
