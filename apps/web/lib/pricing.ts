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
 *   - Free   — personal cooking library + 40 AI credits/mo. No sharing,
 *              no plans, no household.
 *   - Plus   — shared household + invites, meal plans (+clone), public
 *              recipe share links, 300 AI credits/mo.
 *   - Pro    — everything in Plus + 1,500 credits, co-editing (family can
 *              Edit/Admin your recipes & plans), shareable meal plans, and
 *              priority AI (no burst limit).
 * Everyone can buy one-time top-up packs that roll over.
 *
 * First-time sign-ups get a 7-day Pro trial automatically — no card. It's
 * tracked off the account's `createdAt` (see `resolveTier`), so it needs no
 * extra column and a real subscription always supersedes it. Admins can grant
 * extra Pro days per user (`users.complimentaryAccessUntil`); that override
 * outranks the account-age trial.
 */

export type Tier = "free" | "plus" | "premium" | "pro";
export type BillingInterval = "monthly" | "annual";

/** Resolved display prices for one tier (live Stripe price, or TIERS fallback). */
export type TierDisplay = {
  monthly: string; // e.g. "$6.99"
  annualPerMonth: string; // e.g. "$5.75"
  annualTotal: string; // e.g. "$69"
  credits: number;
};
export type TierDisplayMap = Record<Tier, TierDisplay>;

/** Length of the automatic first-time Pro trial, in days. */
export const TRIAL_DAYS = 7;
/** Tier granted during the trial window. */
export const TRIAL_TIER: Tier = "pro";

/**
 * Resolve a user's effective tier from their raw subscription + account
 * age. Pure (no DB) so it's shared by the credit engine and the gate
 * resolver and is unit-testable.
 *
 * Precedence: an active/trialing Stripe subscription always wins; otherwise an
 * admin-granted complimentary-access window (Pro, no card) wins; otherwise an
 * account still inside its first `TRIAL_DAYS` is treated as Pro (the auto
 * no-card trial); otherwise Free.
 *
 * Both the complimentary grant and the auto trial surface as `onTrial: true`
 * with `trialDaysLeft` / `trialEndsAt` set, so the UI's existing trial
 * treatment covers them without new states.
 */
export function resolveTier(input: {
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  createdAt: Date | null;
  /** Admin-granted Pro access window end (null when none). Outranks the auto trial. */
  complimentaryAccessUntil?: Date | null;
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
  // Admin-granted complimentary Pro access — outranks the account-age trial so
  // an admin can extend someone past their auto trial (e.g. before Stripe is
  // wired). Whichever of (grant end, auto-trial end) is later is the window.
  const autoTrialEndsAt = input.createdAt
    ? new Date(input.createdAt.getTime() + TRIAL_DAYS * 86_400_000)
    : null;
  const candidates = [input.complimentaryAccessUntil ?? null, autoTrialEndsAt].filter(
    (d): d is Date => d != null
  );
  const endsAt = candidates.reduce<Date | null>(
    (latest, d) => (!latest || d.getTime() > latest.getTime() ? d : latest),
    null
  );
  if (endsAt) {
    const msLeft = endsAt.getTime() - input.now.getTime();
    if (msLeft > 0) {
      return {
        tier: TRIAL_TIER,
        onTrial: true,
        trialDaysLeft: Math.max(1, Math.ceil(msLeft / 86_400_000)),
        trialEndsAt: endsAt
      };
    }
  }
  return { tier: "free", onTrial: false, trialDaysLeft: 0, trialEndsAt: null };
}

/** Subscription tiers — display + the monthly AI credit grant each includes.
 *  Annual is a fixed discounted per-month rate (annual.perMonthDisplay),
 *  billed yearly. Per-credit cost falls as tiers climb, rewarding the upgrade. */
export const TIERS = {
  free: {
    name: "Cook",
    monthly: { amount: 0, display: "$0" },
    annual: { amount: 0, display: "$0", perMonthDisplay: "$0" },
    monthlyCredits: 40,
    blurb: "Your personal cooking library, plus a taste of AI."
  },
  plus: {
    name: "Chef",
    monthly: { amount: 6.99, display: "$6.99", suffix: "/ month" },
    annual: { amount: 71.88, display: "$71.88", suffix: "/ year", perMonthDisplay: "$5.99" },
    monthlyCredits: 300,
    blurb: "Share your kitchen & cook with AI — 300 credits a month."
  },
  premium: {
    name: "Head Chef",
    monthly: { amount: 11.99, display: "$11.99", suffix: "/ month" },
    annual: { amount: 119.88, display: "$119.88", suffix: "/ year", perMonthDisplay: "$9.99" },
    monthlyCredits: 750,
    blurb: "More AI room + priority — 750 credits, no burst limits.",
    highlight: true,
    badge: "Most popular"
  },
  pro: {
    name: "Master Chef",
    monthly: { amount: 17.99, display: "$17.99", suffix: "/ month" },
    annual: { amount: 179.88, display: "$179.88", suffix: "/ year", perMonthDisplay: "$14.99" },
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
      /** Fixed discounted per-month rate when billed annually, e.g. "$5.99". */
      perMonthDisplay?: string;
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
 * Launch-promo credit floor. While `isLaunchFreeAccess()` is on (Stripe not
 * yet wired, or forced via `LAUNCH_FREE_ACCESS=true`), the credits a user is
 * actually GRANTED are floored at this amount regardless of tier, so the
 * "all plans open, free during launch" experience isn't undercut by the
 * 40-credit free bucket once the 7-day trial ends. Set to the Chef grant:
 * generous for normal use, bounded for COGS. Auto-reverts to plain per-tier
 * grants the moment the launch flag flips off.
 *
 * This floors the GRANT only, NOT what the pricing surfaces advertise. Plans
 * show their real per-tier credits (`MONTHLY_CREDIT_GRANT`), so Cook reads
 * "40 / month" even while the engine still seeds 300. See `effectiveMonthlyGrant`.
 */
export const LAUNCH_CREDIT_GRANT = TIERS.plus.monthlyCredits; // 300

/**
 * The credits a user is actually GRANTED for a tier: floored at the launch
 * grant while the promo is on, so the credit engine seeds the launch amount.
 * Distinct from the advertised plan number (`MONTHLY_CREDIT_GRANT`, the real
 * per-tier base shown on pricing/settings). Pure (no env read) so the caller
 * passes whether launch access is on.
 */
export function effectiveMonthlyGrant(tier: Tier, launchFreeAccess: boolean): number {
  const base = MONTHLY_CREDIT_GRANT[tier];
  return launchFreeAccess ? Math.max(base, LAUNCH_CREDIT_GRANT) : base;
}

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
    perMonthDisplay: TIERS.plus.annual.perMonthDisplay
  }
} as const;

/**
 * AI operations and their credit cost — a deliberate `1 · 2 · 3 · 5 · 10`
 * ladder rather than a strict COGS pass-through, so the dish-image price
 * (10, Gemini 2.5 Flash Image) doesn't dwarf everything else:
 *   - share link            → 1
 *   - text capture / refine  → 2
 *   - ingredient extraction  → 3
 *   - voice / photo capture / refine → 5 (vision + Whisper lean on heavier models)
 *   - dish image generation  → 10
 * Keys are the `AiOperation` union the metering wrapper passes. The grouped
 * "voice or photo" and "text" rows in the UI read one representative key each
 * (`suggest_voice` / `suggest_text`), so the capture+refine variants are kept
 * in lockstep below.
 */
export const AI_CREDIT_COSTS = {
  suggest_text: 2,
  suggest_voice: 5,
  suggest_image: 5,
  refine_text: 2,
  refine_voice: 5,
  refine_photo: 5,
  extract_ingredients: 3,
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
    "AI capture from photo, text & voice",
    "Rediscovery suggestions",
    "40 AI credits / month"
  ],
  plus: [
    "300 AI credits / month",
    "Shared household — invite your family",
    "Meal plans for occasions (+ clone past plans)",
    "Public recipe share links"
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
