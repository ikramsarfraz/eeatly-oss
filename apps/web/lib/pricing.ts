/**
 * Pricing + AI-credits config — single source of truth for the numbers
 * shown on the marketing/settings surfaces AND the metering math.
 *
 * DISPLAY amounts here must match the amounts on the Stripe Prices you
 * create; nothing reconciles them automatically. Stripe price *IDs* come
 * from env (`STRIPE_PRICE_*`, read in `services/billing.ts`); the env →
 * tier/pack mapping also lives in the billing service.
 *
 * Three tiers, genuinely differentiated (R20):
 *   - Free   — personal cooking library + 15 AI credits/mo. No sharing,
 *              no plans, no household.
 *   - Plus   — shared household + invites, meal plans (+clone), public
 *              recipe share links, 300 AI credits/mo.
 *   - Pro    — everything in Plus + 1,500 credits, co-editing (family can
 *              Edit/Admin your recipes & plans), shareable meal plans, and
 *              priority AI (no burst limit).
 * Everyone can buy one-time top-up packs that roll over.
 *
 * First-time sign-ups get a 14-day Pro trial automatically — no card. It's
 * tracked off the account's `createdAt` (see `resolveTier`), so it needs no
 * extra column and a real subscription always supersedes it.
 */

export type Tier = "free" | "plus" | "premium" | "pro";
export type BillingInterval = "monthly" | "annual";

/** Length of the automatic first-time Pro trial, in days. */
export const TRIAL_DAYS = 14;
/** Tier granted during the trial window. */
export const TRIAL_TIER: Tier = "pro";

/**
 * Resolve a user's effective tier from their raw subscription + account
 * age. Pure (no DB) so it's shared by the credit engine and the gate
 * resolver and is unit-testable.
 *
 * Precedence: an active/trialing Stripe subscription always wins; otherwise
 * an account still inside its first `TRIAL_DAYS` is treated as Pro (the
 * no-card trial); otherwise Free.
 */
export function resolveTier(input: {
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  createdAt: Date | null;
  now: Date;
}): { tier: Tier; onTrial: boolean; trialDaysLeft: number; trialEndsAt: Date | null } {
  const active =
    input.subscriptionStatus === "active" || input.subscriptionStatus === "trialing";
  if (active) {
    // Null tier on an active sub = legacy single-tier era → Plus.
    return {
      tier:
        input.subscriptionTier === "pro"
          ? "pro"
          : input.subscriptionTier === "premium"
            ? "premium"
            : "plus",
      onTrial: false,
      trialDaysLeft: 0,
      trialEndsAt: null
    };
  }
  if (input.createdAt) {
    const trialEndsAt = new Date(input.createdAt.getTime() + TRIAL_DAYS * 86_400_000);
    const msLeft = trialEndsAt.getTime() - input.now.getTime();
    if (msLeft > 0) {
      return {
        tier: TRIAL_TIER,
        onTrial: true,
        trialDaysLeft: Math.max(1, Math.ceil(msLeft / 86_400_000)),
        trialEndsAt
      };
    }
  }
  return { tier: "free", onTrial: false, trialDaysLeft: 0, trialEndsAt: null };
}

/** Subscription tiers — display + the monthly AI credit grant each includes.
 *  Annual = pay for 10 months (≈ "2 months free"). Per-credit cost falls as
 *  tiers climb (~$0.023 → $0.016 → $0.012), rewarding the upgrade. */
export const TIERS = {
  free: {
    name: "Cook",
    monthly: { amount: 0, display: "$0" },
    annual: { amount: 0, display: "$0" },
    monthlyCredits: 40,
    blurb: "Your personal cooking library, plus a taste of AI."
  },
  plus: {
    name: "Chef",
    monthly: { amount: 6.99, display: "$6.99", suffix: "/ month" },
    annual: { amount: 69, display: "$69", suffix: "/ year", monthsFree: 2, note: "2 months free" },
    monthlyCredits: 300,
    blurb: "Share your kitchen & cook with AI — 300 credits a month."
  },
  premium: {
    name: "Head Chef",
    monthly: { amount: 11.99, display: "$11.99", suffix: "/ month" },
    annual: { amount: 119, display: "$119", suffix: "/ year", monthsFree: 2, note: "2 months free" },
    monthlyCredits: 750,
    blurb: "More AI room + priority — 750 credits, no burst limits.",
    highlight: true,
    badge: "Most popular"
  },
  pro: {
    name: "Master Chef",
    monthly: { amount: 17.99, display: "$17.99", suffix: "/ month" },
    annual: { amount: 179, display: "$179", suffix: "/ year", monthsFree: 2, note: "2 months free" },
    monthlyCredits: 1500,
    blurb: "Cook at scale — 1,500 credits, co-editing + shareable plan pages."
  }
} as const satisfies Record<
  Tier,
  {
    name: string;
    monthly: { amount: number; display: string; suffix?: string };
    annual: {
      amount: number;
      display: string;
      suffix?: string;
      monthsFree?: number;
      note?: string;
    };
    monthlyCredits: number;
    blurb: string;
    highlight?: boolean;
    badge?: string;
  }
>;

/** The paid tiers, in display order (entry → most popular → top). */
export const PAID_TIERS = ["plus", "premium", "pro"] as const;

/** Monthly included credit grant per tier. */
export const MONTHLY_CREDIT_GRANT: Record<Tier, number> = {
  free: TIERS.free.monthlyCredits,
  plus: TIERS.plus.monthlyCredits,
  premium: TIERS.premium.monthlyCredits,
  pro: TIERS.pro.monthlyCredits
};

/**
 * Back-compat alias — the old single-tier `PRICING.monthly/annual` shape
 * pointed at Plus. Kept so any remaining importers (and pricing.test) keep
 * resolving real numbers; new code should read `TIERS`.
 */
export const PRICING = {
  monthly: { amount: TIERS.plus.monthly.amount, display: TIERS.plus.monthly.display, suffix: "/ month" },
  annual: {
    amount: TIERS.plus.annual.amount,
    display: TIERS.plus.annual.display,
    suffix: "/ year",
    monthsFree: 2,
    note: "2 months free"
  }
} as const;

/**
 * AI operations and their credit cost. Cheap text/LLM ops cost 1; ops that
 * lean on heavier models (vision, Whisper) cost 2; image *generation*
 * (gpt-image-1) is the expensive one at 10. Keys are the `AiOperation`
 * union the metering wrapper passes.
 */
export const AI_CREDIT_COSTS = {
  suggest_text: 1,
  suggest_voice: 2,
  suggest_image: 2,
  refine_text: 1,
  refine_voice: 2,
  refine_photo: 2,
  extract_ingredients: 1,
  share_recipe: 1,
  dish_image: 10
} as const;

export type AiOperation = keyof typeof AI_CREDIT_COSTS;

export function creditCost(op: AiOperation): number {
  return AI_CREDIT_COSTS[op];
}

/**
 * Token list-prices per model, USD per 1M tokens — for admin COGS analysis
 * (never billed). LLM calls record real token counts (ai_usage_events), so
 * the chat/vision part of cost is exact; update these when prices change.
 */
export const MODEL_TOKEN_PRICING_USD: Record<string, { inPer1M: number; outPer1M: number }> = {
  "gpt-4o-mini": { inPer1M: 0.15, outPer1M: 0.6 },
  "claude-sonnet-4-6": { inPer1M: 3, outPer1M: 15 }
};
/** Fallback when a recorded model isn't in the table above. */
export const DEFAULT_TOKEN_PRICING_USD = { inPer1M: 1, outPer1M: 3 };

/**
 * Flat per-invocation surcharge for the NON-token parts of an op, USD: the
 * Whisper transcription on voice ops (the LLM parse is counted via tokens) and
 * the per-image generation cost (Gemini 2.5 Flash Image flat rate; the model
 * mix is shown separately on the admin page). Ops not listed have no non-token
 * surcharge — their cost is fully token-based.
 */
export const AI_OP_SURCHARGE_USD: Partial<Record<AiOperation, number>> = {
  dish_image: 0.039,
  suggest_voice: 0.012,
  refine_voice: 0.012
};

export function tokenCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_TOKEN_PRICING_USD[model] ?? DEFAULT_TOKEN_PRICING_USD;
  return (inputTokens * p.inPer1M + outputTokens * p.outPer1M) / 1_000_000;
}

// Credit top-up packs are NOT configured here — they're synced from Stripe
// (one-time Prices tagged `metadata.kind=credits` + `metadata.credits`), read
// via `services/stripe-catalog.ts`. Add/retire a pack in Stripe, no code change.

/** Launch-promo badge copy, shown when `isLaunchFreeAccess` is on. */
export const LAUNCH_BADGE = "Free during launch · no card needed";

/**
 * Marketing feature lists per tier — the source of truth for the pricing
 * cards and the Settings plan picker. Each list is what that tier UNLOCKS;
 * Pro's list leads with "Everything in Plus" since it's a superset. Keep in
 * sync with the actual gating (registry rules + service-level Pro checks).
 */
export const TIER_FEATURES: Record<Tier, string[]> = {
  free: [
    "Your personal recipe library, forever",
    "Log every cook with notes & photos",
    "Search your full cooking history",
    "Rediscovery suggestions",
    "40 AI credits / month"
  ],
  plus: [
    "300 AI credits / month",
    "Shared household — invite your family",
    "Meal plans for occasions (+ clone past plans)",
    "Public recipe share links",
    "AI capture from photo, text & voice"
  ],
  premium: [
    "Everything in Chef",
    "750 AI credits / month",
    "Priority AI — no burst limits"
  ],
  pro: [
    "Everything in Head Chef",
    "1,500 AI credits / month",
    "Co-editing — let family Edit & Admin your recipes and plans",
    "Shareable meal plans with public plan pages"
  ]
};
