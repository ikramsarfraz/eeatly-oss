import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { subscriptionStatusEnum, users } from "./auth";

/**
 * Round 6 — Stripe subscription state. One row per user (well, per
 * `stripe_customer_id` — the unique constraint enforces that). Updates
 * exclusively land via the webhook handler in
 * `app/api/webhooks/stripe/route.ts`; nothing in the action layer
 * writes to this table.
 *
 * The denormalized columns on `user` (stripe_customer_id,
 * subscription_status, subscription_current_period_end) mirror this row
 * for fast reads in `lib/gates/resolver.ts`. The webhook handler writes
 * both inside one transaction.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    // Null between cancellation and renewal. The status enum may still
    // read `canceled` with a populated `currentPeriodEnd` (cancel-at-
    // period-end with grace remaining).
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: subscriptionStatusEnum("status").notNull(),
    priceId: text("price_id"),
    // 'plus' | 'pro' — resolved from the Stripe price id at webhook time
    // (services/billing.ts `tierForPriceId`). Null for unknown/legacy
    // prices; readers treat null-with-active-status as 'plus' for
    // back-compat with the single-tier era.
    tier: text("tier"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: index("subscriptions_user_id_idx").on(table.userId)
  })
);

/**
 * Stripe webhook idempotency log. Same shape as `resend_webhook_receipts`
 * (Round 3) — keyed by the provider's event id so a replay is a no-op
 * lookup, not a re-execution of the handler. `processed_at` is set after
 * the handler commits its transaction; `error` captures the failure
 * reason if it doesn't.
 */
export const stripeWebhookReceipts = pgTable(
  "stripe_webhook_receipts",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    eventTypeIdx: index("stripe_webhook_receipts_event_type_idx").on(table.eventType)
  })
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type StripeWebhookReceipt = typeof stripeWebhookReceipts.$inferSelect;
