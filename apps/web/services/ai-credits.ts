import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiCredits, aiCreditLedger, subscriptions } from "@/db/schema";
import { InsufficientCreditsError } from "@/lib/errors/credits";
import { logger } from "@/lib/observability/logger";
import {
  creditCost,
  MONTHLY_CREDIT_GRANT,
  type AiOperation,
  type Tier
} from "@/lib/pricing";

/**
 * AI credit metering. Two buckets per user (see db/schema/ai-credits.ts):
 *   - monthly grant (resets each calendar month to the tier amount)
 *   - purchased top-ups (roll over forever)
 *
 * Consumption draws from the monthly bucket first, then top-ups. Every
 * movement is mirrored to `ai_credit_ledger`. All public entry points are
 * idempotent or safe to retry.
 */

const TIER_RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

/** The user's effective tier from their subscription state. */
export async function getUserTier(userId: string): Promise<Tier> {
  const [row] = await db
    .select({ status: subscriptions.status, tier: subscriptions.tier })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (!row) return "free";
  const active = row.status === "active" || row.status === "trialing";
  if (!active) return "free";
  // Null tier on an active sub = legacy single-tier era → Plus.
  return row.tier === "pro" ? "pro" : "plus";
}

function sameCalendarMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/**
 * Ensure the user's credit row exists and its monthly grant is current.
 * Lazily refills the monthly bucket to the tier amount when a new calendar
 * month has begun. Returns the up-to-date row.
 */
async function ensureCurrentRow(userId: string, tier: Tier) {
  const grant = MONTHLY_CREDIT_GRANT[tier];
  const now = new Date();

  // First touch — seed a full monthly grant.
  await db
    .insert(aiCredits)
    .values({
      userId,
      monthlyRemaining: grant,
      monthlyPeriodStart: now,
      topupRemaining: 0,
      updatedAt: now
    })
    .onConflictDoNothing({ target: aiCredits.userId });

  const [row] = await db
    .select()
    .from(aiCredits)
    .where(eq(aiCredits.userId, userId))
    .limit(1);
  if (!row) throw new Error("ai_credits row missing after upsert.");

  // Brand-new row from the insert above — already current.
  if (sameCalendarMonth(row.monthlyPeriodStart, now)) return row;

  // New calendar month → reset the monthly bucket to the tier grant.
  const [updated] = await db
    .update(aiCredits)
    .set({ monthlyRemaining: grant, monthlyPeriodStart: now, updatedAt: now })
    .where(eq(aiCredits.userId, userId))
    .returning();
  await db.insert(aiCreditLedger).values({
    userId,
    delta: grant,
    reason: "monthly_grant",
    balanceAfter: grant + row.topupRemaining
  });
  return updated ?? row;
}

export type CreditBalance = {
  tier: Tier;
  monthlyRemaining: number;
  monthlyGrant: number;
  topupRemaining: number;
  total: number;
};

/** Read the user's current balance (refilling the monthly bucket if due). */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const tier = await getUserTier(userId);
  const row = await ensureCurrentRow(userId, tier);
  return {
    tier,
    monthlyRemaining: row.monthlyRemaining,
    monthlyGrant: MONTHLY_CREDIT_GRANT[tier],
    topupRemaining: row.topupRemaining,
    total: row.monthlyRemaining + row.topupRemaining
  };
}

/**
 * Meter an AI operation against the user's credits: atomically deduct the
 * op's cost (monthly bucket first, then top-ups), run `fn`, and refund on
 * failure. Throws `InsufficientCreditsError` before running `fn` when the
 * balance can't cover the cost.
 */
export async function withAiCredits<T>(
  userId: string,
  operation: AiOperation,
  fn: () => Promise<T>
): Promise<T> {
  const cost = creditCost(operation);
  const tier = await getUserTier(userId);
  await ensureCurrentRow(userId, tier);

  // Atomic check-and-deduct: monthly first, the remainder from top-ups.
  // The WHERE clause makes it a no-op (0 rows) when the balance is short.
  const fromMonthly = sql`LEAST(${aiCredits.monthlyRemaining}, ${cost})`;
  const [deducted] = await db
    .update(aiCredits)
    .set({
      monthlyRemaining: sql`${aiCredits.monthlyRemaining} - ${fromMonthly}`,
      topupRemaining: sql`${aiCredits.topupRemaining} - (${cost} - ${fromMonthly})`,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(aiCredits.userId, userId),
        sql`${aiCredits.monthlyRemaining} + ${aiCredits.topupRemaining} >= ${cost}`
      )
    )
    .returning({
      monthlyRemaining: aiCredits.monthlyRemaining,
      topupRemaining: aiCredits.topupRemaining
    });

  if (!deducted) {
    const balance = await getCreditBalance(userId);
    throw new InsufficientCreditsError(cost, balance.total);
  }

  await db.insert(aiCreditLedger).values({
    userId,
    delta: -cost,
    reason: "consume",
    operation,
    balanceAfter: deducted.monthlyRemaining + deducted.topupRemaining
  });

  try {
    return await fn();
  } catch (error) {
    // Refund the op cost (to the monthly bucket) so a provider failure
    // doesn't cost the user credits.
    await db
      .update(aiCredits)
      .set({
        monthlyRemaining: sql`${aiCredits.monthlyRemaining} + ${cost}`,
        updatedAt: new Date()
      })
      .where(eq(aiCredits.userId, userId));
    await db.insert(aiCreditLedger).values({
      userId,
      delta: cost,
      reason: "refund",
      operation
    });
    logger.info("ai_credits_refunded", {
      userId,
      operation,
      cost,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Grant purchased top-up credits. Idempotent by `stripeEventId` — a webhook
 * replay inserts no duplicate ledger row and credits exactly once. Safe to
 * call inside the webhook transaction.
 */
export async function grantPurchasedCredits(args: {
  userId: string;
  credits: number;
  stripeEventId: string;
  packId?: string;
}): Promise<{ granted: boolean }> {
  // Reserve the idempotency key first. The unique index on stripe_event_id
  // rejects a replay; `onConflictDoNothing` makes that a clean no-op.
  const inserted = await db
    .insert(aiCreditLedger)
    .values({
      userId: args.userId,
      delta: args.credits,
      reason: "purchase",
      operation: args.packId ?? null,
      stripeEventId: args.stripeEventId
    })
    .onConflictDoNothing({ target: aiCreditLedger.stripeEventId })
    .returning({ id: aiCreditLedger.id });

  if (inserted.length === 0) {
    logger.info("ai_credits_purchase_replay_skipped", {
      userId: args.userId,
      stripeEventId: args.stripeEventId
    });
    return { granted: false };
  }

  // Ensure a row exists (a buyer who never used AI may have none yet), then
  // add the purchased credits to the rolling top-up bucket.
  await db
    .insert(aiCredits)
    .values({ userId: args.userId, topupRemaining: args.credits, monthlyRemaining: 0 })
    .onConflictDoUpdate({
      target: aiCredits.userId,
      set: {
        topupRemaining: sql`${aiCredits.topupRemaining} + ${args.credits}`,
        updatedAt: new Date()
      }
    });

  logger.info("ai_credits_purchased", {
    userId: args.userId,
    credits: args.credits,
    stripeEventId: args.stripeEventId
  });
  return { granted: true };
}

/**
 * On a subscription tier change, top the monthly bucket up to the new tier's
 * grant when the tier INCREASED (so an upgrade is felt immediately).
 * Downgrades and same-tier webhooks are no-ops, so this is safe to call on
 * every subscription event.
 */
export async function applyTierGrant(args: {
  userId: string;
  oldTier: Tier;
  newTier: Tier;
}): Promise<void> {
  if (TIER_RANK[args.newTier] <= TIER_RANK[args.oldTier]) return;
  const grant = MONTHLY_CREDIT_GRANT[args.newTier];

  await db
    .insert(aiCredits)
    .values({ userId: args.userId, monthlyRemaining: grant, topupRemaining: 0 })
    .onConflictDoUpdate({
      target: aiCredits.userId,
      // Raise the monthly bucket to the new grant without ever lowering it.
      set: {
        monthlyRemaining: sql`GREATEST(${aiCredits.monthlyRemaining}, ${grant})`,
        updatedAt: new Date()
      }
    });
  await db.insert(aiCreditLedger).values({
    userId: args.userId,
    delta: grant,
    reason: "monthly_grant",
    operation: `upgrade:${args.newTier}`
  });
  logger.info("ai_credits_tier_grant", {
    userId: args.userId,
    oldTier: args.oldTier,
    newTier: args.newTier
  });
}

export { InsufficientCreditsError };
