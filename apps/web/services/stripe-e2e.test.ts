// @vitest-environment node
//
// End-to-end Stripe integration test against the REAL Neon database (no db
// mock). Drives the actual webhook handler + credit engine with realistic
// Stripe event payloads and asserts the resulting rows, then cleans up.
//
// Gated behind E2E_STRIPE so it never runs in the normal suite (it needs a
// live DATABASE_URL and performs real writes). Run with:
//   E2E_STRIPE=1 pnpm --filter @eeatly/web exec vitest run stripe-e2e
//
// Loads .env.local for the connection + required env, and injects test Stripe
// price ids so tier resolution can be exercised without real Stripe Prices.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

// The catalog is synced from Stripe by Price metadata; the webhook resolves
// tier from the price's own metadata (no env). hasStripeEnv just needs the
// core trio — use whatever real test keys .env.local already has, else dummies.
process.env.STRIPE_SECRET_KEY ??= "sk_test_e2e";
process.env.STRIPE_PUBLISHABLE_KEY ??= "pk_test_e2e";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_e2e";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db/client";
import { aiCredits, aiCreditLedger, subscriptions, users } from "@/db/schema";
import { ingestStripeEvent } from "@/services/billing";
import {
  getCreditBalance,
  getUserTier,
  withAiCredits
} from "@/services/ai-credits";
import { InsufficientCreditsError } from "@/lib/errors/credits";

const run = describe.runIf(Boolean(process.env.E2E_STRIPE));

const USER_ID = `e2e-stripe-${Date.now()}`;
const CUSTOMER_ID = `cus_e2e_${Date.now()}`;
const SUB_ID = `sub_e2e_${Date.now()}`;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

run("Stripe integration — end to end (real DB)", () => {
  beforeAll(async () => {
    await db.insert(users).values({
      id: USER_ID,
      name: "E2E Stripe",
      email: `${USER_ID}@e2e.test`,
      emailVerified: true
    });
  });

  afterAll(async () => {
    // Cascades delete subscriptions / ai_credits / ai_credit_ledger.
    await db.delete(users).where(eq(users.id, USER_ID));
  });

  it("a free user starts on the free tier with the free monthly grant", async () => {
    expect(await getUserTier(USER_ID)).toBe("free");
    const balance = await getCreditBalance(USER_ID);
    expect(balance.tier).toBe("free");
    expect(balance.monthlyGrant).toBe(15);
    expect(balance.total).toBe(15);
  });

  it("consumes credits per AI op and refunds when the op fails", async () => {
    // suggest_text costs 1.
    await withAiCredits(USER_ID, "suggest_text", async () => "ok");
    let balance = await getCreditBalance(USER_ID);
    expect(balance.total).toBe(14);

    // A failing op is refunded — net zero.
    await expect(
      withAiCredits(USER_ID, "suggest_text", async () => {
        throw new Error("provider boom");
      })
    ).rejects.toThrow("provider boom");
    balance = await getCreditBalance(USER_ID);
    expect(balance.total).toBe(14);
  });

  it("grants credits on a one-time credit Checkout (idempotent)", async () => {
    const event = {
      id: `evt_credits_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_e2e_credits",
          mode: "payment",
          customer: CUSTOMER_ID,
          client_reference_id: USER_ID,
          metadata: { userId: USER_ID, kind: "credits", packId: "small", credits: "200" }
        }
      }
    } as unknown as Stripe.Event;

    await ingestStripeEvent(event);
    let balance = await getCreditBalance(USER_ID);
    expect(balance.topupRemaining).toBe(200);
    expect(balance.total).toBe(214); // 14 monthly + 200 top-up

    // Replay the SAME event id → no double credit.
    await ingestStripeEvent(event);
    balance = await getCreditBalance(USER_ID);
    expect(balance.topupRemaining).toBe(200);
  });

  it("activates a Pro subscription and bumps the monthly grant", async () => {
    const event = {
      id: `evt_sub_${Date.now()}`,
      type: "customer.subscription.created",
      data: {
        object: {
          id: SUB_ID,
          customer: CUSTOMER_ID,
          status: "active",
          cancel_at_period_end: false,
          metadata: { userId: USER_ID, tier: "pro" },
          items: {
            data: [
              {
                // Tier is resolved from the price's metadata (catalog contract).
                price: {
                  id: "price_e2e_pro_month",
                  metadata: { plan: "pro", interval: "month" }
                },
                current_period_start: nowSec(),
                current_period_end: nowSec() + 30 * 86400
              }
            ]
          }
        }
      }
    } as unknown as Stripe.Event;

    await ingestStripeEvent(event);

    expect(await getUserTier(USER_ID)).toBe("pro");

    const [sub] = await db
      .select({ tier: subscriptions.tier, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, USER_ID))
      .limit(1);
    expect(sub?.tier).toBe("pro");
    expect(sub?.status).toBe("active");

    const balance = await getCreditBalance(USER_ID);
    expect(balance.tier).toBe("pro");
    // Upgrade grant raised the monthly bucket to Pro's 1500; top-ups persist.
    expect(balance.monthlyRemaining).toBe(1500);
    expect(balance.topupRemaining).toBe(200);
  });

  it("blocks an AI op when out of credits (and the ledger reflects the spend)", async () => {
    // Drain to zero by overdrawing in one shot isn't possible (atomic), so
    // assert the empty-balance behavior by spending everything then one more.
    // Cheaper: directly assert InsufficientCreditsError once balance is 0.
    await db
      .update(aiCredits)
      .set({ monthlyRemaining: 0, topupRemaining: 0 })
      .where(eq(aiCredits.userId, USER_ID));

    await expect(
      withAiCredits(USER_ID, "suggest_image", async () => "should not run")
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    // Ledger has consume + refund + purchase + monthly_grant rows.
    const ledger = await db
      .select({ reason: aiCreditLedger.reason })
      .from(aiCreditLedger)
      .where(eq(aiCreditLedger.userId, USER_ID));
    const reasons = new Set(ledger.map((r) => r.reason));
    expect(reasons.has("consume")).toBe(true);
    expect(reasons.has("refund")).toBe(true);
    expect(reasons.has("purchase")).toBe(true);
  });
});
