import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiCreditLedger, aiUsageEvents, dishImages, subscriptions, users } from "@/db/schema";
import {
  AI_OP_SURCHARGE_USD,
  TIERS,
  resolveTier,
  tokenCostUsd,
  type AiOperation,
  type Tier
} from "@/lib/pricing";

/**
 * Admin AI-usage analytics — credits spent vs. provider COGS vs. revenue over a
 * trailing window. Invocations/credits come from the append-only
 * `ai_credit_ledger`. COGS is the REAL LLM token cost (`ai_usage_events`,
 * tokens × model price) PLUS a flat surcharge for the non-token parts (Whisper
 * on voice ops, per-image generation). Revenue is the user's tier monthly
 * price; the window keeps spend (a flow) comparable to MRR (monthly).
 */

const OP_LABEL: Record<string, string> = {
  suggest_text: "Capture · text",
  suggest_voice: "Capture · voice",
  suggest_image: "Capture · photo",
  refine_text: "Refine · text",
  refine_voice: "Refine · voice",
  refine_photo: "Refine · photo",
  extract_ingredients: "Extract ingredients",
  share_recipe: "Share link",
  dish_image: "Dish image"
};

/** Flat non-token surcharge per invocation (Whisper / image gen). */
function surchargeFor(op: string): number {
  return AI_OP_SURCHARGE_USD[op as AiOperation] ?? 0;
}

export type AiUsageSummary = {
  /** Trailing window in days, or null for all-time (lifetime). */
  windowDays: number | null;
  totals: {
    creditsSpent: number;
    estCogsUsd: number;
    mrrUsd: number;
    grossMarginUsd: number;
    activePaidSubs: number;
    spendingUsers: number;
  };
  byOperation: Array<{
    operation: string;
    label: string;
    invocations: number;
    creditsSpent: number;
    estCogsUsd: number;
  }>;
  byTier: Array<{
    tier: Tier;
    users: number;
    creditsSpent: number;
    estCogsUsd: number;
    revenueUsd: number;
  }>;
  users: Array<{
    userId: string;
    email: string;
    tier: Tier;
    creditsSpent: number;
    estCogsUsd: number;
    monthlyRevenueUsd: number;
    marginUsd: number;
  }>;
  /** Which model actually produced the cached dish images (all-time). */
  imageModels: Array<{ model: string; count: number; lastAt: Date | null }>;
};

const IMAGE_MODEL_LABEL: Record<string, string> = {
  "gemini-2.5-flash-image": "Gemini 2.5 Flash Image",
  "gpt-image-1": "OpenAI gpt-image-1"
};

export function imageModelLabel(model: string): string {
  return IMAGE_MODEL_LABEL[model] ?? model;
}

export async function getAiUsageSummary(
  windowDays: number | null = null
): Promise<AiUsageSummary> {
  const now = new Date();
  // null window = all-time (lifetime). Otherwise a trailing N-day window.
  const since = windowDays ? new Date(now.getTime() - windowDays * 86_400_000) : null;

  // 1. Per (user, op, reason) consume/refund aggregates in the window.
  const rows = await db
    .select({
      userId: aiCreditLedger.userId,
      operation: aiCreditLedger.operation,
      reason: aiCreditLedger.reason,
      events: sql<number>`count(*)::int`,
      creditsDelta: sql<number>`coalesce(sum(${aiCreditLedger.delta}), 0)::int`
    })
    .from(aiCreditLedger)
    .where(
      and(
        since ? gte(aiCreditLedger.createdAt, since) : undefined,
        inArray(aiCreditLedger.reason, ["consume", "refund"])
      )
    )
    .groupBy(aiCreditLedger.userId, aiCreditLedger.operation, aiCreditLedger.reason);

  // Fold: net invocations (consume − refund) and net credits spent (−delta,
  // since consume deltas are negative and refunds positive).
  const opInv = new Map<string, number>();
  const opCredits = new Map<string, number>();
  const userCredits = new Map<string, number>();
  const userInvByOp = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const op = r.operation ?? "unknown";
    const inv = (r.reason === "consume" ? 1 : -1) * r.events;
    const credits = -r.creditsDelta;
    opInv.set(op, (opInv.get(op) ?? 0) + inv);
    opCredits.set(op, (opCredits.get(op) ?? 0) + credits);
    userCredits.set(r.userId, (userCredits.get(r.userId) ?? 0) + credits);
    const m = userInvByOp.get(r.userId) ?? new Map<string, number>();
    m.set(op, (m.get(op) ?? 0) + inv);
    userInvByOp.set(r.userId, m);
  }

  const userIds = [...userCredits.keys()];

  // 1b. Real LLM token cost from ai_usage_events (window), per user + per op,
  // priced per model. Wrapped in try/catch so an env without the table yet just
  // degrades to surcharge-only cost rather than 500ing.
  const tokenCostByUser = new Map<string, number>();
  const tokenCostByOp = new Map<string, number>();
  try {
    const tokenQuery = db
      .select({
        userId: aiUsageEvents.userId,
        operation: aiUsageEvents.operation,
        model: aiUsageEvents.model,
        inTok: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens}), 0)::int`,
        outTok: sql<number>`coalesce(sum(${aiUsageEvents.outputTokens}), 0)::int`
      })
      .from(aiUsageEvents)
      .$dynamic();
    const tokenRows = await (since
      ? tokenQuery.where(gte(aiUsageEvents.createdAt, since))
      : tokenQuery
    ).groupBy(aiUsageEvents.userId, aiUsageEvents.operation, aiUsageEvents.model);
    for (const r of tokenRows) {
      const cost = tokenCostUsd(r.model, Number(r.inTok), Number(r.outTok));
      const op = r.operation ?? "unknown";
      tokenCostByOp.set(op, (tokenCostByOp.get(op) ?? 0) + cost);
      if (r.userId) tokenCostByUser.set(r.userId, (tokenCostByUser.get(r.userId) ?? 0) + cost);
    }
  } catch {
    // ai_usage_events not migrated on this env — token cost stays empty.
  }

  // 2. Resolve each spending user's tier + monthly revenue.
  const userMeta = new Map<string, { email: string; tier: Tier; revenue: number }>();
  if (userIds.length) {
    const metaRows = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        subStatus: subscriptions.status,
        subTier: subscriptions.tier
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(inArray(users.id, userIds));
    for (const u of metaRows) {
      const { tier } = resolveTier({
        subscriptionStatus: u.subStatus,
        subscriptionTier: u.subTier,
        createdAt: u.createdAt,
        now
      });
      // Only an *active* paid sub is revenue; trials (Stripe or no-card) are $0.
      const revenue = u.subStatus === "active" && tier !== "free" ? TIERS[tier].monthly.amount : 0;
      userMeta.set(u.id, { email: u.email, tier, revenue });
    }
  }

  // 3. Per-user COGS = Σ (op invocations × op cost). Build the top-spender list.
  const perUser = userIds.map((uid) => {
    const invByOp = userInvByOp.get(uid) ?? new Map<string, number>();
    let cogs = tokenCostByUser.get(uid) ?? 0;
    for (const [op, inv] of invByOp) cogs += inv * surchargeFor(op);
    const meta = userMeta.get(uid) ?? { email: "(unknown)", tier: "free" as Tier, revenue: 0 };
    return {
      userId: uid,
      email: meta.email,
      tier: meta.tier,
      creditsSpent: userCredits.get(uid) ?? 0,
      estCogsUsd: cogs,
      monthlyRevenueUsd: meta.revenue,
      marginUsd: meta.revenue - cogs
    };
  });
  // ALL users with activity in the window, sorted by AI cost (top spenders
  // first) — no cap.
  const usersByCost = [...perUser].sort((a, b) => b.estCogsUsd - a.estCogsUsd);

  // By-operation (union of ledger ops + any op that recorded token cost).
  const byOperation = [...new Set([...opInv.keys(), ...tokenCostByOp.keys()])]
    .map((op) => {
      const invocations = opInv.get(op) ?? 0;
      return {
        operation: op,
        label: OP_LABEL[op] ?? op,
        invocations,
        creditsSpent: opCredits.get(op) ?? 0,
        estCogsUsd: (tokenCostByOp.get(op) ?? 0) + invocations * surchargeFor(op)
      };
    })
    .sort((a, b) => b.estCogsUsd - a.estCogsUsd);

  // By-tier (over spending users).
  const tierAgg = new Map<Tier, { users: number; creditsSpent: number; estCogsUsd: number; revenueUsd: number }>();
  for (const u of perUser) {
    const a = tierAgg.get(u.tier) ?? { users: 0, creditsSpent: 0, estCogsUsd: 0, revenueUsd: 0 };
    a.users += 1;
    a.creditsSpent += u.creditsSpent;
    a.estCogsUsd += u.estCogsUsd;
    a.revenueUsd += u.monthlyRevenueUsd;
    tierAgg.set(u.tier, a);
  }
  const tierOrder: Tier[] = ["free", "plus", "premium", "pro"];
  const byTier = tierOrder.flatMap((t) => {
    const a = tierAgg.get(t);
    return a ? [{ tier: t, ...a }] : [];
  });

  // 4. MRR over ALL active paid subs (not just spenders).
  const mrrRows = await db
    .select({ tier: subscriptions.tier, count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))
    .groupBy(subscriptions.tier);
  let mrrUsd = 0;
  let activePaidSubs = 0;
  for (const r of mrrRows) {
    const t: Tier = r.tier === "pro" ? "pro" : r.tier === "premium" ? "premium" : "plus";
    mrrUsd += r.count * TIERS[t].monthly.amount;
    activePaidSubs += r.count;
  }

  const creditsSpent = [...opCredits.values()].reduce((a, b) => a + b, 0);
  const estCogsUsd = byOperation.reduce((a, b) => a + b.estCogsUsd, 0);

  // Which model produced the cached dish images (all-time; the row records the
  // model that actually succeeded after the Gemini → gpt-image-1 fallback).
  const imageModelRows = await db
    .select({
      model: dishImages.model,
      count: sql<number>`count(*)::int`,
      lastAt: sql<Date | null>`max(${dishImages.generatedAt})`
    })
    .from(dishImages)
    .where(eq(dishImages.status, "ready"))
    .groupBy(dishImages.model)
    .orderBy(sql`count(*) desc`);
  const imageModels = imageModelRows.map((r) => ({
    model: r.model ?? "unknown",
    count: r.count,
    lastAt: r.lastAt
  }));

  return {
    windowDays,
    imageModels,
    totals: {
      creditsSpent,
      estCogsUsd,
      mrrUsd,
      grossMarginUsd: mrrUsd - estCogsUsd,
      activePaidSubs,
      spendingUsers: userIds.length
    },
    byOperation,
    byTier,
    users: usersByCost
  };
}
