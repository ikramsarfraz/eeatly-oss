import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * AI credit balance — one row per user. AI operations are metered against
 * credits (see `lib/pricing.ts` `AI_CREDIT_COSTS`). Two buckets:
 *
 *   - `monthlyRemaining` — the tier's included monthly grant (Free / Plus /
 *     Pro). Reset to the tier amount at the start of each monthly period;
 *     use-it-or-lose-it. `monthlyPeriodStart` anchors the rollover (the
 *     credits service lazily refills on read once a calendar month has
 *     elapsed).
 *   - `topupRemaining` — credits bought à la carte (Stripe one-time
 *     payments). These NEVER reset; they roll over indefinitely.
 *
 * Consumption draws down `monthlyRemaining` first, then `topupRemaining`,
 * so a paying user's included grant is spent before their purchased packs.
 */
export const aiCredits = pgTable("ai_credits", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  monthlyRemaining: integer("monthly_remaining").notNull().default(0),
  monthlyPeriodStart: timestamp("monthly_period_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
  topupRemaining: integer("topup_remaining").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

/**
 * Append-only audit trail for every credit movement. `delta` is positive
 * for grants / purchases / refunds and negative for consumption. `reason`
 * discriminates the movement; `operation` carries the AI op key for
 * consume/refund rows. `stripeEventId` is set on purchase rows and is the
 * idempotency key — the partial unique index below makes a webhook replay
 * a no-op even if it slips past the receipt lock.
 */
export const aiCreditLedger = pgTable(
  "ai_credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // 'monthly_grant' | 'purchase' | 'consume' | 'refund'
    operation: text("operation"), // AI op key for consume/refund
    stripeEventId: text("stripe_event_id"), // idempotency for purchases
    balanceAfter: integer("balance_after"), // monthly + topup snapshot after the move
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userCreatedIdx: index("ai_credit_ledger_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    // One ledger row per Stripe event (purchase idempotency).
    stripeEventIdx: uniqueIndex("ai_credit_ledger_stripe_event_idx").on(
      table.stripeEventId
    )
  })
);

export type AiCreditsRow = typeof aiCredits.$inferSelect;
export type AiCreditLedgerRow = typeof aiCreditLedger.$inferSelect;
